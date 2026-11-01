import React, { useEffect, useState } from 'react';
import type { Collection, Paper, ReadingStatus } from '../types';
import { collectionsApi, papersApi } from '../api';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { PaperCard } from './PaperCard';
import { UploadModal } from './UploadModal';
import { ShareModal } from './ShareModal';
import { Plus, BookOpen, AlertCircle } from 'lucide-react';

interface DashboardProps {
  onOpenReader: (paper: Paper) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onOpenReader }) => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState<ReadingStatus | null>(null);

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [sharePaper, setSharePaper] = useState<Paper | null>(null);
  const [error, setError] = useState('');

  // Fetch Collections & Papers
  const fetchCollections = async () => {
    try {
      const res = await collectionsApi.list();
      setCollections(res.data);
    } catch (err: unknown) {
      console.error('Failed to load collections', err);
    }
  };

  const fetchPapers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await papersApi.list({
        collection_id: activeCollectionId || undefined,
        status: activeStatus || undefined,
        q: searchQuery || undefined,
      });
      setPapers(res.data.papers || []);
    } catch (err: unknown) {
      setError('Failed to load papers. Please refresh or check connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCollections();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPapers();
    }, 200);
    return () => clearTimeout(timer);
  }, [activeCollectionId, activeStatus, searchQuery]);

  const handleCreateCollection = async (name: string, description: string, color: string) => {
    await collectionsApi.create({ name, description, color });
    await fetchCollections();
  };

  const handleUploadPaper = async (formData: FormData) => {
    await papersApi.upload(formData);
    await fetchPapers();
    await fetchCollections();
  };

  const handleDeletePaper = async (id: string) => {
    if (!confirm('Are you sure you want to delete this research paper?')) return;
    try {
      await papersApi.delete(id);
      setPapers((prev) => prev.filter((p) => p.id !== id));
      await fetchCollections();
    } catch (err: unknown) {
      alert('Failed to delete paper');
    }
  };

  const handleStatusChange = async (id: string, status: ReadingStatus) => {
    try {
      await papersApi.update(id, { reading_status: status });
      setPapers((prev) =>
        prev.map((p) => (p.id === id ? { ...p, reading_status: status } : p))
      );
    } catch (err: unknown) {
      alert('Failed to update status');
    }
  };

  const activeCollection = collections.find((c) => c.id === activeCollectionId);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenUpload={() => setIsUploadOpen(true)}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          collections={collections}
          activeCollectionId={activeCollectionId}
          activeStatus={activeStatus}
          onSelectCollection={setActiveCollectionId}
          onSelectStatus={setActiveStatus}
          onCreateCollection={handleCreateCollection}
        />

        <main className="flex-1 p-8 overflow-y-auto h-[calc(100vh-4rem)]">
          {/* Section Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  {activeCollection ? activeCollection.name : 'All Research Papers'}
                </h1>
                {activeStatus && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 capitalize">
                    {activeStatus.replace('_', ' ')}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {activeCollection?.description || 'Your collected papers, annotations, and study notes.'}
              </p>
            </div>

            <button
              onClick={() => setIsUploadOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl shadow-sm hover:shadow transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Paper</span>
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Papers Grid */}
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center text-slate-400">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
              <span className="text-sm">Loading research library...</span>
            </div>
          ) : papers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {papers.map((paper) => (
                <PaperCard
                  key={paper.id}
                  paper={paper}
                  onOpenReader={onOpenReader}
                  onShare={setSharePaper}
                  onDelete={handleDeletePaper}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          ) : (
            <div className="py-24 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white p-8">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-slate-900 text-lg mb-1">No research papers found</h3>
              <p className="text-sm text-slate-400 max-w-sm mx-auto mb-6">
                Upload your first research PDF to start reading, highlighting text, and composing structured study notes.
              </p>
              <button
                onClick={() => setIsUploadOpen(true)}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Upload First Paper</span>
              </button>
            </div>
          )}
        </main>
      </div>

      <UploadModal
        isOpen={isUploadOpen}
        collections={collections}
        onClose={() => setIsUploadOpen(false)}
        onUpload={handleUploadPaper}
      />

      {sharePaper && (
        <ShareModal
          paper={sharePaper}
          isOpen={true}
          onClose={() => setSharePaper(null)}
        />
      )}
    </div>
  );
};
