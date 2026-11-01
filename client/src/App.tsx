import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Dashboard } from './components/Dashboard';
import { DualPaneReader } from './components/reader/DualPaneReader';
import { PublicShareView } from './pages/PublicShareView';
import { AuthModal } from './components/AuthModal';
import { ShareModal } from './components/ShareModal';
import type { Paper } from './types';
import { papersApi } from './api';

function MainApp() {
  const { user, loading } = useAuth();
  const [activePaper, setActivePaper] = useState<Paper | null>(null);
  const [sharePaper, setSharePaper] = useState<Paper | null>(null);
  const [publicShareToken, setPublicShareToken] = useState<string | null>(null);

  useEffect(() => {
    // Check for public share link in URL: /share/:token
    const path = window.location.pathname;
    const match = path.match(/^\/share\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      setPublicShareToken(match[1]);
    }
  }, []);

  const handleGoHome = () => {
    window.history.pushState({}, '', '/');
    setPublicShareToken(null);
    setActivePaper(null);
  };

  // If viewing a public share link, render immediately without auth
  if (publicShareToken) {
    return <PublicShareView token={publicShareToken} onGoHome={handleGoHome} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-slate-300">
        <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-lg font-semibold tracking-tight">Paper Platform</h2>
        <p className="text-xs text-slate-500 mt-1">Starting session...</p>
      </div>
    );
  }

  // Not logged in: Show Auth Screen
  if (!user) {
    return <AuthModal isOpen={true} />;
  }

  // Active Reader View
  if (activePaper) {
    return (
      <>
        <DualPaneReader
          paper={activePaper}
          pdfUrl={papersApi.pdfUrl(activePaper.id)}
          onBack={() => setActivePaper(null)}
          onShare={() => setSharePaper(activePaper)}
        />
        {sharePaper && (
          <ShareModal
            paper={sharePaper}
            isOpen={true}
            onClose={() => setSharePaper(null)}
          />
        )}
      </>
    );
  }

  // Authenticated Dashboard
  return <Dashboard onOpenReader={(paper) => setActivePaper(paper)} />;
}

export function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

export default App;
