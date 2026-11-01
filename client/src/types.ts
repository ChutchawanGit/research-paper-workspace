export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export interface Collection {
  id: string;
  user_id: string;
  name: string;
  description: string;
  color: string;
  paper_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  name: string;
}

export type ReadingStatus = 'to_read' | 'reading' | 'completed';

export interface Paper {
  id: string;
  user_id: string;
  collection_id?: string;
  collection_name?: string;
  collection_color?: string;
  title: string;
  authors: string;
  abstract: string;
  publication_date: string;
  doi: string;
  file_hash: string;
  file_path: string;
  file_size: number;
  page_count: number;
  reading_status: ReadingStatus;
  tags?: Tag[];
  highlight_count?: number;
  note_count?: number;
  created_at: string;
  updated_at: string;
}

export interface HighlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Highlight {
  id: string;
  paper_id: string;
  user_id?: string;
  page_index: number;
  rects: HighlightRect[];
  selected_text: string;
  color: string;
  created_at: string;
}

export interface Note {
  id: string;
  paper_id: string;
  user_id?: string;
  highlight_id?: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface ShareLink {
  id: string;
  paper_id: string;
  token: string;
  include_notes: boolean;
  expires_at?: string;
  created_at: string;
}

export interface PublicSharedData {
  paper: Paper;
  highlights: Highlight[];
  notes?: Note[];
}
