import React, { useState } from 'react';
import type { Collection, ReadingStatus } from '../types';
import {
  Folder,
  Plus,
  BookMarked,
  Clock,
  CheckCircle2,
  Library,
  Tag as TagIcon,
  X
} from 'lucide-react';

interface SidebarProps {
  collections: Collection[];
  activeCollectionId: string | null;
  activeStatus: ReadingStatus | null;
  isOpen?: boolean;
  onClose?: () => void;
  onSelectCollection: (id: string | null) => void;
  onSelectStatus: (status: ReadingStatus | null) => void;
  onCreateCollection: (name: string, description: string, color: string) => Promise<void>;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collections,
  activeCollectionId,
  activeStatus,
  isOpen = false,
  onClose,
  onSelectCollection,
  onSelectStatus,
  onCreateCollection,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColDesc, setNewColDesc] = useState('');
  const [newColColor, setNewColColor] = useState('#3B82F6');
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim()) return;
    setSubmitting(true);
    try {
      await onCreateCollection(newColName, newColDesc, newColColor);
      setNewColName('');
      setNewColDesc('');
      setShowAddModal(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectCol = (id: string | null) => {
    onSelectCollection(id);
    onSelectStatus(null);
    onClose?.();
  };

  const handleSelectStat = (status: ReadingStatus | null) => {
    onSelectStatus(status);
    onClose?.();
  };

  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1'];

  const sidebarContent = (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Mobile Drawer Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 lg:hidden">
        <div className="flex items-center gap-2">
          <Library className="w-5 h-5 text-blue-600" />
          <span className="font-bold text-slate-800 text-sm">Library Navigation</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation: Library Views */}
      <div className="mb-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 px-3">
          Library
        </h3>
        <nav className="space-y-1">
          <button
            onClick={() => handleSelectCol(null)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all ${
              activeCollectionId === null && activeStatus === null
                ? 'bg-blue-50 text-blue-700 font-semibold'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Library className="w-4 h-4 text-slate-400" />
              <span>All Papers</span>
            </div>
          </button>
        </nav>
      </div>

      {/* Reading Status Filters */}
      <div className="mb-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 px-3">
          Reading Status
        </h3>
        <nav className="space-y-1">
          <button
            onClick={() => handleSelectStat('to_read')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all ${
              activeStatus === 'to_read'
                ? 'bg-blue-50 text-blue-700 font-semibold'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-amber-500" />
              <span>To Read</span>
            </div>
          </button>

          <button
            onClick={() => handleSelectStat('reading')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all ${
              activeStatus === 'reading'
                ? 'bg-blue-50 text-blue-700 font-semibold'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <BookMarked className="w-4 h-4 text-blue-500" />
              <span>Reading</span>
            </div>
          </button>

          <button
            onClick={() => handleSelectStat('completed')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all ${
              activeStatus === 'completed'
                ? 'bg-blue-50 text-blue-700 font-semibold'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Completed</span>
            </div>
          </button>
        </nav>
      </div>

      {/* Collections Section */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-2 px-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Collections
          </h3>
          <button
            onClick={() => setShowAddModal(true)}
            className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            title="Create Collection"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <nav className="space-y-1">
          {collections.map((col) => (
            <button
              key={col.id}
              onClick={() => handleSelectCol(col.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all ${
                activeCollectionId === col.id
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: col.color || '#3B82F6' }}
                />
                <span className="truncate">{col.name}</span>
              </div>
              {col.paper_count !== undefined && col.paper_count > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-normal">
                  {col.paper_count}
                </span>
              )}
            </button>
          ))}

          {collections.length === 0 && (
            <div className="px-3 py-4 text-xs text-slate-400 text-center border border-dashed border-slate-200 rounded-xl">
              No collections yet. Click + to create one.
            </div>
          )}
        </nav>
      </div>

      {/* Quick Stats or Footer */}
      <div className="pt-4 border-t border-slate-100 px-3 text-xs text-slate-400 flex items-center gap-2 shrink-0">
        <TagIcon className="w-3.5 h-3.5" />
        <span>Organized by Topic & Tags</span>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 h-[calc(100vh-4rem)] hidden lg:flex flex-col p-4 shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile Off-canvas Slide-over Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          {/* Backdrop */}
          <div
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
          />

          {/* Drawer content */}
          <div className="relative w-72 max-w-[80vw] bg-white h-full z-50 p-4 shadow-2xl flex flex-col animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Add Collection Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-100 p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Folder className="w-5 h-5 text-blue-600" />
              <span>New Collection</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Group papers by domain or research project.
            </p>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Collection Name
                </label>
                <input
                  type="text"
                  required
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  placeholder="e.g. Distributed Systems"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={newColDesc}
                  onChange={(e) => setNewColDesc(e.target.value)}
                  placeholder="Notes, scope, or topics..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">
                  Color Tag
                </label>
                <div className="flex items-center gap-2">
                  {colors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewColColor(c)}
                      className={`w-7 h-7 rounded-full transition-transform ${
                        newColColor === c ? 'scale-125 ring-2 ring-offset-2 ring-slate-400' : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
