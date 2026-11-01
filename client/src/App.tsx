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
  const [showAuthModal, setShowAuthModal] = useState(false);

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

  // Bright, clean loading state (Never pitch-black)
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-800">
        <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-lg font-bold tracking-tight text-slate-900">Paper Platform</h2>
        <p className="text-xs text-slate-400 mt-1">Starting research workspace...</p>
      </div>
    );
  }

  // Active Reader View (Works for logged-in users and public visitors in read-only mode)
  if (activePaper) {
    return (
      <>
        <DualPaneReader
          paper={activePaper}
          pdfUrl={papersApi.pdfUrl(activePaper.id)}
          isPublic={!user}
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
        {showAuthModal && (
          <AuthModal
            isOpen={true}
            onClose={() => setShowAuthModal(false)}
          />
        )}
      </>
    );
  }

  // Showcase Dashboard (Accessible to everyone without login, sign-in accessible from navbar)
  return (
    <>
      <Dashboard
        onOpenReader={(paper) => setActivePaper(paper)}
        onOpenSignIn={() => setShowAuthModal(true)}
      />
      {showAuthModal && (
        <AuthModal
          isOpen={true}
          onClose={() => setShowAuthModal(false)}
        />
      )}
    </>
  );
}

export function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

export default App;
