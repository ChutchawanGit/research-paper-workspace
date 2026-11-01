import React, { useEffect, useState } from 'react';
import type { Paper, ShareLink } from '../types';
import { shareApi } from '../api';
import {
  Share2,
  X,
  Copy,
  Check,
  Globe,
  Trash2,
  ExternalLink,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

interface ShareModalProps {
  paper: Paper;
  isOpen: boolean;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  paper,
  isOpen,
  onClose,
}) => {
  const [shareLink, setShareLink] = useState<ShareLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError('');
    shareApi.get(paper.id)
      .then((res) => setShareLink(res.data))
      .catch(() => setError('Failed to load share settings.'))
      .finally(() => setLoading(false));
  }, [paper.id, isOpen]);

  if (!isOpen) return null;

  const publicUrl = shareLink
    ? `${window.location.origin}/share/${shareLink.token}`
    : '';

  const handleCreate = async () => {
    setCreating(true);
    setError('');
    try {
      const res = await shareApi.create(paper.id, {
        include_notes: includeNotes,
        expires_in_days: 0, // No expiration
      });
      setShareLink(res.data);
    } catch {
      setError('Failed to create share link.');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async () => {
    if (!shareLink) return;
    try {
      await shareApi.revoke(shareLink.id);
      setShareLink(null);
    } catch {
      setError('Failed to revoke share link.');
    }
  };

  const handleCopy = () => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-900 text-lg">Share Paper</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-500 mb-4 line-clamp-2">
          <span className="font-semibold text-slate-800">{paper.title}</span>
        </p>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2 text-red-600 text-xs mb-4">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="py-8 flex justify-center">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : shareLink ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600">
                <Globe className="w-4 h-4" />
                <span>Public Share Link is Active</span>
              </div>
              <p className="text-xs text-slate-500">
                Anyone with this link can view the paper and read-only annotations without logging in.
              </p>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="text"
                  readOnly
                  value={publicUrl}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-700 select-all"
                />
                <button
                  onClick={handleCopy}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span>Includes Notes: {shareLink.include_notes ? 'Yes' : 'No'}</span>
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline flex items-center gap-1 font-medium"
              >
                <span>Open View</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                onClick={handleRevoke}
                className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg font-medium flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Revoke Public Access</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span>Currently Private</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Only you can view this paper. Generate a cryptographically unguessable link to share it with visitors or on your portfolio.
              </p>

              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={includeNotes}
                  onChange={(e) => setIncludeNotes(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span>Include my reading notes and highlights in public view</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm flex items-center gap-2 disabled:opacity-50"
              >
                {creating ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Globe className="w-4 h-4" />
                    <span>Generate Share Link</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
