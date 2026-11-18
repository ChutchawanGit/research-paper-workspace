import React, { useEffect, useState } from 'react';
import type { Collection, Paper, ReadingStatus } from '../types';
import { collectionsApi, papersApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { PaperCard } from './PaperCard';
import { UploadModal } from './UploadModal';
import { ShareModal } from './ShareModal';
import { Plus, BookOpen, AlertCircle } from 'lucide-react';

interface DashboardProps {
  onOpenReader: (paper: Paper) => void;
  onOpenSignIn?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onOpenReader, onOpenSignIn }) => {
  const { user } = useAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeView, setActiveView] = useState<'my_library' | 'explore_published'>(
    user ? 'my_library' : 'explore_published'
  );
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState<ReadingStatus | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [sharePaper, setSharePaper] = useState<Paper | null>(null);
  const [error, setError] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  // Auto-switch view when auth state changes
  useEffect(() => {
    if (!user) {
      setActiveView('explore_published');
      setActiveCollectionId(null);
      setActiveStatus(null);
    } else {
      setActiveView('my_library');
    }
  }, [user?.id]);

  // Fetch Collections & Papers
  const fetchCollections = async () => {
    if (!user) {
      setCollections([]);
      return;
    }
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
        collection_id: activeView === 'my_library' ? activeCollectionId || undefined : undefined,
        status: activeView === 'my_library' ? activeStatus || undefined : undefined,
        q: searchQuery || undefined,
        mode: user ? activeView : 'explore_published',
        user_id: user?.id,
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
  }, [user?.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPapers();
    }, 200);
    return () => clearTimeout(timer);
  }, [activeView, activeCollectionId, activeStatus, searchQuery, user?.id]);

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

  const handleTogglePublish = async (id: string, isPublished: boolean) => {
    try {
      await papersApi.togglePublish(id, isPublished);
      setPapers((prev) =>
        prev.map((p) => (p.id === id ? { ...p, is_published: isPublished } : p))
      );
      setToastMsg(isPublished ? 'Paper is now Published to Community Hub!' : 'Paper is now Private.');
      setTimeout(() => setToastMsg(''), 3000);
    } catch (err: unknown) {
      alert('Failed to update visibility');
    }
  };

  const handleForkPaper = async (paper: Paper) => {
    if (!user) {
      onOpenSignIn?.();
      return;
    }
    try {
      await papersApi.fork(paper.id);
      setToastMsg(`Cloned "${paper.title}" to your personal My Library!`);
      setTimeout(() => setToastMsg(''), 3500);
      setActiveView('my_library');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to clone paper');
    }
  };

  const activeCollection = collections.find((c) => c.id === activeCollectionId);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenUpload={() => {
          if (!user) {
            onOpenSignIn?.();
            return;
          }
          setIsUploadOpen(true);
        }}
        onOpenSignIn={onOpenSignIn}
        isSidebarOpen={isMobileSidebarOpen}
        onToggleSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          collections={collections}
          activeCollectionId={activeCollectionId}
          activeStatus={activeStatus}
          activeView={activeView}
          isLoggedIn={Boolean(user)}
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
          onSelectView={setActiveView}
          onSelectCollection={setActiveCollectionId}
          onSelectStatus={setActiveStatus}
          onCreateCollection={handleCreateCollection}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto h-[calc(100vh-4rem)]">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {activeView === 'explore_published'
                    ? 'Explore Published Papers'
                    : activeCollection
                    ? activeCollection.name
                    : 'My Research Library'}
                </h1>
                {activeView === 'my_library' && activeStatus && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 capitalize">
                    {activeStatus.replace('_', ' ')}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {activeView === 'explore_published'
                  ? 'Browse public research papers shared by the community. Clone any paper into your workspace to annotate.'
                  : activeCollection?.description || 'Your personal papers, highlights, and private study notes.'}
              </p>
            </div>

            <button
              onClick={() => {
                if (!user) {
                  onOpenSignIn?.();
                  return;
                }
                setIsUploadOpen(true);
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl shadow-sm hover:shadow transition-all shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Paper</span>
            </button>
          </div>

          {toastMsg && (
            <div className="mb-6 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium flex items-center justify-between shadow-xs">
              <span>{toastMsg}</span>
              <button onClick={() => setToastMsg('')} className="text-emerald-500 hover:text-emerald-700 text-xs font-bold px-2">✕</button>
            </div>
          )}

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
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
              {papers.map((paper) => (
                <PaperCard
                  key={paper.id}
                  paper={paper}
                  currentUserId={user?.id}
                  onOpenReader={onOpenReader}
                  onShare={setSharePaper}
                  onDelete={handleDeletePaper}
                  onStatusChange={handleStatusChange}
                  onTogglePublish={handleTogglePublish}
                  onFork={handleForkPaper}
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
