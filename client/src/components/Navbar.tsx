import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { BookOpen, Search, Upload, LogOut, User as UserIcon } from 'lucide-react';
import { LogoutConfirmModal } from './LogoutConfirmModal';
interface NavbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenUpload: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  searchQuery,
  onSearchChange,
  onOpenUpload,
}) => {
  const { user, logout } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30 shadow-sm">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
          <BookOpen className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 tracking-tight text-lg">Paper Platform</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
              Dev Portfolio
            </span>
          </div>
          <p className="text-xs text-slate-400">Research Reader & Knowledge Hub</p>
        </div>
      </div>

      {/* Global Search */}
      <div className="max-w-md w-full mx-6 hidden md:block">
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

      {/* Action Controls & User Info */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenUpload}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl shadow-sm hover:shadow transition-all"
        >
          <Upload className="w-4 h-4" />
          <span className="hidden sm:inline">Upload Paper</span>
        </button>

        {user && (
          <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-slate-800 leading-tight">{user.name}</span>
              <span className="text-[11px] text-slate-400 leading-tight">{user.email}</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
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
        )}
      </div>

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
