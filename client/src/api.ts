import { supabase } from './supabase';
import type { Collection, Highlight, Note, Paper, PublicSharedData, ShareLink, User, ReadingStatus } from './types';

// Helper to get current authenticated user
const getCurrentUser = async (): Promise<User | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return {
    id: user.id,
    email: user.email || '',
    name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
    created_at: user.created_at,
  };
};

export const authApi = {
  register: async (data: { email: string; password: string; name: string }) => {
    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { name: data.name },
      },
    });
    if (error) throw error;

    // If session is returned directly
    if (authData.session) {
      const user: User = {
        id: authData.user?.id || '',
        email: authData.user?.email || data.email,
        name: data.name,
        created_at: authData.user?.created_at || new Date().toISOString(),
      };
      return { data: { user, token: authData.session.access_token } };
    }

    // Try instant login in case confirmation was bypassed
    const { data: loginData } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    if (loginData?.session) {
      const user: User = {
        id: loginData.user?.id || '',
        email: loginData.user?.email || data.email,
        name: data.name,
        created_at: loginData.user?.created_at || new Date().toISOString(),
      };
      return { data: { user, token: loginData.session.access_token } };
    }

    const user: User = {
      id: authData.user?.id || '',
      email: authData.user?.email || data.email,
      name: data.name,
      created_at: authData.user?.created_at || new Date().toISOString(),
    };
    return { data: { user, token: '' } };
  },

  login: async (data: { email: string; password: string }) => {
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    if (error) throw error;
    const user: User = {
      id: authData.user?.id || '',
      email: authData.user?.email || data.email,
      name: authData.user?.user_metadata?.name || data.email.split('@')[0],
      created_at: authData.user?.created_at || new Date().toISOString(),
    };
    return { data: { user, token: authData.session?.access_token || '' } };
  },

  logout: async () => {
    await supabase.auth.signOut();
    return { data: true };
  },

  me: async () => {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');
    return { data: user };
  },
};

export const collectionsApi = {
  list: async () => {
    const { data, error } = await supabase
      .from('collections')
      .select('*, papers(id)')
      .order('created_at', { ascending: true });
    if (error) throw error;
    const collections: Collection[] = (data || []).map((c: any) => ({
      id: c.id,
      user_id: c.user_id,
      name: c.name,
      description: c.description || '',
      color: c.color || '#3B82F6',
      paper_count: Array.isArray(c.papers) ? c.papers.length : 0,
      created_at: c.created_at,
      updated_at: c.updated_at,
    }));
    return { data: collections };
  },

  create: async (data: { name: string; description?: string; color?: string }) => {
    const user = await getCurrentUser();
    const { data: col, error } = await supabase
      .from('collections')
      .insert([{
        user_id: user?.id || null,
        name: data.name,
        description: data.description || '',
        color: data.color || '#3B82F6',
      }])
      .select()
      .single();
    if (error) throw error;
    return { data: col as Collection };
  },

  update: async (id: string, data: { name: string; description?: string; color?: string }) => {
    const { data: col, error } = await supabase
      .from('collections')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return { data: col as Collection };
  },

  delete: async (id: string) => {
    const { error } = await supabase.from('collections').delete().eq('id', id);
    if (error) throw error;
    return { data: true };
  },
};

export const papersApi = {
  list: async (params?: { collection_id?: string; tag_id?: string; status?: string; q?: string; limit?: number; offset?: number }) => {
    let query = supabase
      .from('papers')
      .select('*, collections(name, color), highlights(id), notes(id)', { count: 'exact' });

    if (params?.collection_id) {
      query = query.eq('collection_id', params.collection_id);
    }
    if (params?.status) {
      query = query.eq('reading_status', params.status);
    }
    if (params?.q) {
      query = query.or(`title.ilike.%${params.q}%,abstract.ilike.%${params.q}%,authors.ilike.%${params.q}%`);
    }

    query = query.order('created_at', { ascending: false });

    if (params?.limit) {
      const offset = params.offset || 0;
      query = query.range(offset, offset + params.limit - 1);
    }

    const { data, count, error } = await query;
    if (error) throw error;

    const papers: Paper[] = (data || []).map((p: any) => ({
      id: p.id,
      user_id: p.user_id,
      collection_id: p.collection_id,
      collection_name: p.collections?.name,
      collection_color: p.collections?.color,
      title: p.title,
      authors: p.authors || '',
      abstract: p.abstract || '',
      publication_date: p.publication_date || '',
      doi: p.doi || '',
      file_hash: p.file_hash || '',
      file_path: p.file_path,
      file_size: p.file_size || 0,
      page_count: p.page_count || 1,
      reading_status: (p.reading_status || 'to_read') as ReadingStatus,
      highlight_count: Array.isArray(p.highlights) ? p.highlights.length : 0,
      note_count: Array.isArray(p.notes) ? p.notes.length : 0,
      created_at: p.created_at,
      updated_at: p.updated_at,
    }));

    return { data: { papers, total: count || papers.length } };
  },

  get: async (id: string) => {
    const { data, error } = await supabase
      .from('papers')
      .select('*, collections(name, color)')
      .eq('id', id)
      .single();
    if (error) throw error;
    const paper: Paper = {
      ...data,
      collection_name: data.collections?.name,
      collection_color: data.collections?.color,
    };
    return { data: paper };
  },

  upload: async (formData: FormData) => {
    const file = formData.get('file') as File;
    if (!file) throw new Error('No PDF file provided');

    const title = (formData.get('title') as string) || file.name.replace(/\.pdf$/i, '');
    const authors = (formData.get('authors') as string) || '';
    const abstract = (formData.get('abstract') as string) || '';
    const publication_date = (formData.get('publication_date') as string) || '';
    const doi = (formData.get('doi') as string) || '';
    const collection_id = (formData.get('collection_id') as string) || null;
    const user = await getCurrentUser();

    // 1. Upload PDF to Supabase Storage Bucket "papers"
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${Date.now()}-${safeName}`;
    
    const { error: storageError } = await supabase.storage
      .from('papers')
      .upload(storagePath, file, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (storageError) throw storageError;

    const { data: { publicUrl } } = supabase.storage
      .from('papers')
      .getPublicUrl(storagePath);

    // 2. Insert metadata into "papers" table
    const { data: paper, error: dbError } = await supabase
      .from('papers')
      .insert([{
        user_id: user?.id || null,
        collection_id: collection_id || null,
        title,
        authors,
        abstract,
        publication_date,
        doi,
        file_hash: '',
        file_path: publicUrl,
        file_size: file.size,
        page_count: 1,
        reading_status: 'to_read',
      }])
      .select()
      .single();

    if (dbError) throw dbError;
    return { data: paper as Paper };
  },

  update: async (id: string, data: Partial<Paper> & { tags?: string[] }) => {
    const { tags, ...paperData } = data;
    const { data: updated, error } = await supabase
      .from('papers')
      .update(paperData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return { data: updated as Paper };
  },

  delete: async (id: string) => {
    await supabase.from('highlights').delete().eq('paper_id', id);
    await supabase.from('notes').delete().eq('paper_id', id);
    const { error } = await supabase.from('papers').delete().eq('id', id);
    if (error) throw error;
    return { data: true };
  },

  pdfUrl: (id: string) => {
    return id;
  },
};

export const highlightsApi = {
  list: async (paperId: string) => {
    const { data, error } = await supabase
      .from('highlights')
      .select('*')
      .eq('paper_id', paperId)
      .order('page_index', { ascending: true });
    if (error) throw error;
    return { data: (data || []) as Highlight[] };
  },

  create: async (paperId: string, data: { page_index: number; rects: Highlight['rects']; selected_text: string; color?: string }) => {
    const user = await getCurrentUser();
    const { data: hl, error } = await supabase
      .from('highlights')
      .insert([{
        paper_id: paperId,
        user_id: user?.id || null,
        page_index: data.page_index,
        rects: data.rects,
        selected_text: data.selected_text,
        color: data.color || '#FBBF24',
      }])
      .select()
      .single();
    if (error) throw error;
    return { data: hl as Highlight };
  },

  updateColor: async (id: string, color: string) => {
    const { data, error } = await supabase
      .from('highlights')
      .update({ color })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return { data: data as Highlight };
  },

  delete: async (id: string) => {
    const { error } = await supabase.from('highlights').delete().eq('id', id);
    if (error) throw error;
    return { data: true };
  },
};

export const notesApi = {
  list: async (paperId: string) => {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('paper_id', paperId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return { data: (data || []) as Note[] };
  },

  create: async (paperId: string, data: { title?: string; content: string; highlight_id?: string }) => {
    const user = await getCurrentUser();
    const { data: note, error } = await supabase
      .from('notes')
      .insert([{
        paper_id: paperId,
        user_id: user?.id || null,
        highlight_id: data.highlight_id || null,
        title: data.title || '',
        content: data.content,
      }])
      .select()
      .single();
    if (error) throw error;
    return { data: note as Note };
  },

  update: async (id: string, data: { title?: string; content: string; highlight_id?: string }) => {
    const { data: note, error } = await supabase
      .from('notes')
      .update({
        title: data.title || '',
        content: data.content,
        highlight_id: data.highlight_id || null,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return { data: note as Note };
  },

  delete: async (id: string) => {
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (error) throw error;
    return { data: true };
  },
};

export const shareApi = {
  get: async (paperId: string) => {
    const { data, error } = await supabase
      .from('share_links')
      .select('*')
      .eq('paper_id', paperId)
      .maybeSingle();
    if (error) throw error;
    return { data: (data || null) as ShareLink | null };
  },

  create: async (paperId: string, data: { include_notes: boolean; expires_in_days?: number }) => {
    const user = await getCurrentUser();
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const expiresAt = data.expires_in_days
      ? new Date(Date.now() + data.expires_in_days * 86400000).toISOString()
      : null;

    const { data: link, error } = await supabase
      .from('share_links')
      .insert([{
        paper_id: paperId,
        user_id: user?.id || null,
        token,
        include_notes: data.include_notes,
        expires_at: expiresAt,
      }])
      .select()
      .single();
    if (error) throw error;
    return { data: link as ShareLink };
  },

  revoke: async (id: string) => {
    const { error } = await supabase.from('share_links').delete().eq('id', id);
    if (error) throw error;
    return { data: true };
  },

  getPublic: async (token: string) => {
    const { data: link, error: linkError } = await supabase
      .from('share_links')
      .select('*, papers(*)')
      .eq('token', token)
      .single();
    if (linkError || !link) throw new Error('Share link not found or expired');

    const paper = link.papers as Paper;
    const { data: highlights } = await supabase
      .from('highlights')
      .select('*')
      .eq('paper_id', paper.id);

    let notes: Note[] = [];
    if (link.include_notes) {
      const { data: notesData } = await supabase
        .from('notes')
        .select('*')
        .eq('paper_id', paper.id);
      notes = notesData || [];
    }

    const result: PublicSharedData = {
      paper,
      highlights: highlights || [],
      notes,
    };
    return { data: result };
  },

  publicPdfUrl: (token: string) => {
    return token;
  },
};
