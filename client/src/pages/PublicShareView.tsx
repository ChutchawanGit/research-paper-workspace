import React, { useEffect, useState } from 'react';
import type { PublicSharedData } from '../types';
import { shareApi } from '../api';
import { DualPaneReader } from '../components/reader/DualPaneReader';
import { Globe, AlertCircle, ArrowLeft, BookOpen } from 'lucide-react';

interface PublicShareViewProps {
  token: string;
  onGoHome: () => void;
}

export const PublicShareView: React.FC<PublicShareViewProps> = ({
  token,
  onGoHome,
}) => {
  const [data, setData] = useState<PublicSharedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    shareApi.getPublic(token)
      .then((res) => {
        setData(res.data);
      })
      .catch(() => {
        setError('This shared research paper link is invalid, expired, or has been revoked.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-slate-300">
        <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-lg font-semibold">Loading Shared Research Paper...</h2>
        <p className="text-xs text-slate-500 mt-1">Reading from decentralized repository</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-950/50 border border-red-800 text-red-400 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Paper Unavailable</h2>
        <p className="text-sm text-slate-400 max-w-md mb-6">{error}</p>
        <button
          onClick={onGoHome}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Go to Platform Home</span>
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-900">
      {/* Public Banner */}
      <div className="bg-gradient-to-r from-blue-900/80 to-indigo-950/80 border-b border-blue-800/40 px-4 py-2 flex items-center justify-between text-xs text-blue-200">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-blue-400" />
          <span>
            Public Research Showcase: <strong>{data.paper.title}</strong>
          </span>
          <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-semibold border border-blue-500/30">
            Read-Only
          </span>
        </div>

        <button
          onClick={onGoHome}
          className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex items-center gap-1.5 font-medium"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Paper Platform Home</span>
        </button>
      </div>

      {/* Reader */}
      <div className="flex-1 overflow-hidden">
        <DualPaneReader
          paper={data.paper}
          pdfUrl={shareApi.publicPdfUrl(token)}
          isPublic={true}
          initialHighlights={data.highlights}
          initialNotes={data.notes}
          onBack={onGoHome}
        />
      </div>
    </div>
  );
};
