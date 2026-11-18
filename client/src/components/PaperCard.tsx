import React, { useState } from 'react';
import type { Paper, ReadingStatus } from '../types';
import {
  BookOpen,
  Highlighter,
  FileText,
  Share2,
  Trash2,
  User,
  Clock,
  CheckCircle2,
  BookMarked,
  Globe,
  Lock,
  GitFork
} from 'lucide-react';

interface PaperCardProps {
  paper: Paper;
  currentUserId?: string;
  onOpenReader: (paper: Paper) => void;
  onShare: (paper: Paper) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: ReadingStatus) => void;
  onTogglePublish?: (id: string, isPublished: boolean) => void;
  onFork?: (paper: Paper) => Promise<void>;
}

export const PaperCard: React.FC<PaperCardProps> = ({
  paper,
  currentUserId,
  onOpenReader,
  onShare,
  onDelete,
  onStatusChange,
  onTogglePublish,
  onFork,
}) => {
  const [forking, setForking] = useState(false);
  const isOwner = Boolean(currentUserId && paper.user_id === currentUserId);

  const handleForkClick = async () => {
    if (!onFork || forking) return;
    setForking(true);
    try {
      await onFork(paper);
    } finally {
      setForking(false);
    }
  };
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getStatusBadge = (status: ReadingStatus) => {
    switch (status) {
      case 'completed':
        return {
          label: 'Completed',
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
          className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        };
      case 'reading':
        return {
          label: 'Reading',
          icon: <BookMarked className="w-3.5 h-3.5 text-blue-600" />,
          className: 'bg-blue-50 text-blue-700 border-blue-200',
        };
      default:
        return {
          label: 'To Read',
          icon: <Clock className="w-3.5 h-3.5 text-amber-600" />,
          className: 'bg-amber-50 text-amber-700 border-amber-200',
        };
    }
  };

  const statusBadge = getStatusBadge(paper.reading_status);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
      {/* Top Metadata */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {isOwner ? (
              paper.collection_name ? (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
                  style={{
                    backgroundColor: `${paper.collection_color || '#3B82F6'}15`,
                    color: paper.collection_color || '#3B82F6',
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: paper.collection_color || '#3B82F6' }}
                  />
                  {paper.collection_name}
                </span>
              ) : (
                <span className="text-xs text-slate-400">Uncategorized</span>
              )
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Globe className="w-3 h-3" />
                {paper.owner_name ? `By ${paper.owner_name}` : 'Published'}
              </span>
            )}

            {paper.forked_from_id && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-200">
                <GitFork className="w-3 h-3" />
                Cloned
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Publish / Private Toggle (Owner only) */}
            {isOwner && onTogglePublish && (
              <button
                type="button"
                onClick={() => onTogglePublish(paper.id, !paper.is_published)}
                title={paper.is_published ? 'Published (Click to make Private)' : 'Private (Click to Publish)'}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold border transition-all ${
                  paper.is_published
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                }`}
              >
                {paper.is_published ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                <span>{paper.is_published ? 'Public' : 'Private'}</span>
              </button>
            )}

            {/* Reading Status Selector (Owner only) */}
            {isOwner && (
              <select
                value={paper.reading_status}
                onChange={(e) => onStatusChange(paper.id, e.target.value as ReadingStatus)}
                className={`text-xs font-semibold px-2.5 py-1 rounded-lg border appearance-none cursor-pointer focus:outline-none ${statusBadge.className}`}
              >
                <option value="to_read">To Read</option>
                <option value="reading">Reading</option>
                <option value="completed">Completed</option>
              </select>
            )}
          </div>
        </div>

        {/* Paper Title */}
        <h3
          onClick={() => onOpenReader(paper)}
          className="font-bold text-slate-900 text-base leading-snug mb-2 group-hover:text-blue-600 cursor-pointer line-clamp-2 transition-colors"
        >
          {paper.title}
        </h3>

        {/* Authors */}
        {paper.authors && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2 truncate">
            <User className="w-3.5 h-3.5 shrink-0 text-slate-400" />
            <span className="truncate">{paper.authors}</span>
          </div>
        )}

        {/* Abstract */}
        {paper.abstract && (
          <p className="text-xs text-slate-600 line-clamp-2 mb-4 leading-relaxed">
            {paper.abstract}
          </p>
        )}

        {/* Tags */}
        {paper.tags && paper.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {paper.tags.map((t) => (
              <span
                key={t.id}
                className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium"
              >
                #{t.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Footer Details & Actions */}
      <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1" title="Highlights">
            <Highlighter className="w-3.5 h-3.5 text-amber-500" />
            <span>{paper.highlight_count || 0}</span>
          </span>
          <span className="flex items-center gap-1" title="Notes">
            <FileText className="w-3.5 h-3.5 text-blue-500" />
            <span>{paper.note_count || 0}</span>
          </span>
          {paper.page_count > 0 && (
            <span className="text-slate-300">• {paper.page_count} pages</span>
          )}
          <span className="text-slate-300">• {formatBytes(paper.file_size)}</span>
        </div>

        <div className="flex items-center gap-1">
          {isOwner ? (
            <>
              <button
                onClick={() => onShare(paper)}
                title="Create Share Link"
                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <Share2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(paper.id)}
                title="Delete Paper"
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          ) : (
            onFork && (
              <button
                onClick={handleForkClick}
                disabled={forking}
                title="Clone this paper to your own workspace"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white text-xs font-semibold rounded-lg transition-all shadow-sm disabled:opacity-50"
              >
                <GitFork className="w-3.5 h-3.5" />
                <span>{forking ? 'Cloning...' : 'Clone'}</span>
              </button>
            )
          )}
          <button
            onClick={() => onOpenReader(paper)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white text-xs font-semibold rounded-lg transition-all ml-1 shadow-sm"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Read</span>
          </button>
        </div>
      </div>
    </div>
  );
};
