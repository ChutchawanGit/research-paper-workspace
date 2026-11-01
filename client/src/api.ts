import axios from 'axios';
import type { Collection, Highlight, Note, Paper, PublicSharedData, ShareLink, User } from './types';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

export const authApi = {
  register: (data: { email: string; password: string; name: string }) =>
    api.post<{ user: User; token: string }>('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post<{ user: User; token: string }>('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get<User>('/auth/me'),
};

export const collectionsApi = {
  list: () => api.get<Collection[]>('/collections'),
  create: (data: { name: string; description?: string; color?: string }) =>
    api.post<Collection>('/collections', data),
  update: (id: string, data: { name: string; description?: string; color?: string }) =>
    api.put<Collection>(`/collections/${id}`, data),
  delete: (id: string) => api.delete(`/collections/${id}`),
};

export const papersApi = {
  list: (params?: { collection_id?: string; tag_id?: string; status?: string; q?: string; limit?: number; offset?: number }) =>
    api.get<{ papers: Paper[]; total: number }>('/papers', { params }),
  get: (id: string) => api.get<Paper>(`/papers/${id}`),
  upload: (formData: FormData) =>
    api.post<Paper>('/papers/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  update: (id: string, data: Partial<Paper> & { tags?: string[] }) =>
    api.put<Paper>(`/papers/${id}`, data),
  delete: (id: string) => api.delete(`/papers/${id}`),
  pdfUrl: (id: string) => `/api/papers/${id}/pdf`,
};

export const highlightsApi = {
  list: (paperId: string) => api.get<Highlight[]>(`/papers/${paperId}/highlights`),
  create: (paperId: string, data: { page_index: number; rects: Highlight['rects']; selected_text: string; color?: string }) =>
    api.post<Highlight>(`/papers/${paperId}/highlights`, data),
  updateColor: (id: string, color: string) => api.put(`/highlights/${id}/color`, { color }),
  delete: (id: string) => api.delete(`/highlights/${id}`),
};

export const notesApi = {
  list: (paperId: string) => api.get<Note[]>(`/papers/${paperId}/notes`),
  create: (paperId: string, data: { title?: string; content: string; highlight_id?: string }) =>
    api.post<Note>(`/papers/${paperId}/notes`, data),
  update: (id: string, data: { title?: string; content: string; highlight_id?: string }) =>
    api.put<Note>(`/notes/${id}`, data),
  delete: (id: string) => api.delete(`/notes/${id}`),
};

export const shareApi = {
  get: (paperId: string) => api.get<ShareLink | null>(`/papers/${paperId}/share`),
  create: (paperId: string, data: { include_notes: boolean; expires_in_days?: number }) =>
    api.post<ShareLink>(`/papers/${paperId}/share`, data),
  revoke: (id: string) => api.delete(`/share/${id}`),
  getPublic: (token: string) => api.get<PublicSharedData>(`/public/share/${token}`),
  publicPdfUrl: (token: string) => `/api/public/share/${token}/pdf`,
};
