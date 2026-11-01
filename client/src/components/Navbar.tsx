import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { BookOpen, Search, Upload, LogOut, User as UserIcon, Menu, X, LogIn } from 'lucide-react';
import { LogoutConfirmModal } from './LogoutConfirmModal';

interface NavbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenUpload: () => void;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
  onOpenSignIn?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  searchQuery,
  onSearchChange,
  onOpenUpload,
  onToggleSidebar,
  isSidebarOpen = false,
  onOpenSignIn,
}) => {
  const { user, logout } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-sm">
      {/* Left: Mobile Sidebar Toggle & Brand */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-2 -ml-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl lg:hidden transition-colors"
            title={isSidebarOpen ? 'Close Menu' : 'Open Menu'}
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        )}

        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
          <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>

        <div className="truncate">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="font-bold text-slate-900 tracking-tight text-base sm:text-lg truncate">
              Paper Platform
            </span>
            <span className="hidden sm:inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 shrink-0">
              Dev Portfolio
            </span>
          </div>
          <p className="hidden xs:block text-[11px] sm:text-xs text-slate-400 truncate">
            Research Reader & Knowledge Hub
          </p>
        </div>
      </div>

      {/* Center: Global Search (Desktop) */}
      <div className="max-w-md w-full mx-4 lg:mx-6 hidden md:block">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search papers by title, abstract, or authors..."
            className="w-full pl-10 pr-4 py-2 bg-slate-100 hover:bg-slate-100/80 focus:bg-white border border-transparent focus:border-blue-500 rounded-xl text-sm transition-all focus:outline-none focus:ring-4 focus:ring-blue-500/10"
          />
        </div>
      </div>

      {/* Right: Actions, Mobile Search Toggle & User Menu */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Mobile Search Button */}
        <button
          onClick={() => setShowMobileSearch(!showMobileSearch)}
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl md:hidden transition-colors"
          title="Search"
        >
          <Search className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenUpload}
          className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm hover:shadow transition-all shrink-0"
        >
          <Upload className="w-4 h-4" />
          <span className="hidden sm:inline">Upload Paper</span>
        </button>

        {user ? (
          <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-3 border-l border-slate-200">
            <div className="hidden xl:flex flex-col text-right max-w-[140px] truncate">
              <span className="text-xs font-semibold text-slate-800 truncate leading-tight">{user.name}</span>
              <span className="text-[10px] text-slate-400 truncate leading-tight">{user.email}</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
              <UserIcon className="w-4 h-4" />
            </div>
            <button
              onClick={() => setShowLogoutModal(true)}
              title="Sign Out"
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : onOpenSignIn ? (
          <button
            onClick={onOpenSignIn}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all ml-1 shrink-0"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In</span>
          </button>
        ) : null}
      </div>

      {/* Mobile Search Dropdown Bar */}
      {showMobileSearch && (
        <div className="absolute top-16 left-0 right-0 bg-white border-b border-slate-200 p-3 shadow-md md:hidden animate-in slide-in-from-top-2 duration-150 z-30">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search papers..."
              className="w-full pl-10 pr-4 py-2 bg-slate-100 focus:bg-white border border-transparent focus:border-blue-500 rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>
      )}

      <LogoutConfirmModal
        isOpen={showLogoutModal}
        onConfirm={() => {
          setShowLogoutModal(false);
          logout();
        }}
        onCancel={() => setShowLogoutModal(false)}
      />
    </header>
  );
};
