import React from 'react';
import { BookOpen, TrendingUp, Calculator, ShieldCheck, LogOut, Sparkles, User as UserIcon } from 'lucide-react';
import { UserProfile, StockHolding } from '../types';

interface NavbarProps {
  user: UserProfile | null;
  activeTab: 'journal' | 'portfolio' | 'simulator' | 'security';
  setActiveTab: (tab: 'journal' | 'portfolio' | 'simulator' | 'security') => void;
  onLogout: () => void;
  holdingsCount: number;
  entriesCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  activeTab,
  setActiveTab,
  onLogout,
  holdingsCount,
  entriesCount,
}) => {
  return (
    <header className="sticky top-0 z-40 border-b border-[#222222] bg-[#0D0D0D]/90 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#C4A77D]/20 to-[#C4A77D]/5 border border-[#C4A77D]/40 text-[#C4A77D] shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif text-lg font-bold tracking-wide text-[#F5F5F5]">
                  AEGIS
                </span>
                <span className="rounded border border-[#C4A77D]/30 bg-[#C4A77D]/10 px-1.5 py-0.5 text-[10px] font-mono font-medium text-[#C4A77D]">
                  GEMINI 3.6
                </span>
              </div>
              <p className="hidden text-xs text-[#888888] sm:block">
                AI Financial Journal & Portfolio Ledger
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              id="tab-journal-btn"
              onClick={() => setActiveTab('journal')}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'journal'
                  ? 'bg-[#1F1F1F] text-[#F5F5F5] border border-[#333333] shadow-xs'
                  : 'text-[#A3A3A3] hover:bg-[#141414] hover:text-[#E5E5E5]'
              }`}
            >
              <BookOpen className={`h-4 w-4 ${activeTab === 'journal' ? 'text-[#C4A77D]' : 'text-[#888888]'}`} />
              <span>Journal</span>
              {entriesCount > 0 && (
                <span className="hidden sm:inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#262626] px-1 text-[10px] font-mono text-[#D4D4D4]">
                  {entriesCount}
                </span>
              )}
            </button>

            <button
              id="tab-portfolio-btn"
              onClick={() => setActiveTab('portfolio')}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'portfolio'
                  ? 'bg-[#1F1F1F] text-[#F5F5F5] border border-[#333333] shadow-xs'
                  : 'text-[#A3A3A3] hover:bg-[#141414] hover:text-[#E5E5E5]'
              }`}
            >
              <TrendingUp className={`h-4 w-4 ${activeTab === 'portfolio' ? 'text-[#C4A77D]' : 'text-[#888888]'}`} />
              <span>Portfolio</span>
              {holdingsCount > 0 && (
                <span className="hidden sm:inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#C4A77D]/20 px-1 text-[10px] font-mono text-[#C4A77D]">
                  {holdingsCount}
                </span>
              )}
            </button>

            <button
              id="tab-simulator-btn"
              onClick={() => setActiveTab('simulator')}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'simulator'
                  ? 'bg-[#1F1F1F] text-[#F5F5F5] border border-[#333333] shadow-xs'
                  : 'text-[#A3A3A3] hover:bg-[#141414] hover:text-[#E5E5E5]'
              }`}
            >
              <Calculator className={`h-4 w-4 ${activeTab === 'simulator' ? 'text-[#C4A77D]' : 'text-[#888888]'}`} />
              <span>P&L Sim</span>
            </button>

            <button
              id="tab-security-btn"
              onClick={() => setActiveTab('security')}
              className={`hidden md:flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'security'
                  ? 'bg-[#1F1F1F] text-[#F5F5F5] border border-[#333333] shadow-xs'
                  : 'text-[#A3A3A3] hover:bg-[#141414] hover:text-[#E5E5E5]'
              }`}
            >
              <ShieldCheck className={`h-4 w-4 ${activeTab === 'security' ? 'text-[#C4A77D]' : 'text-[#888888]'}`} />
              <span>Firestore Rules</span>
            </button>
          </nav>

          {/* User Profile & Sign Out */}
          <div className="flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-2.5 rounded-xl border border-[#262626] bg-[#141414] px-3 py-1.5">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="h-6 w-6 rounded-full border border-[#333333]"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#C4A77D]/20 text-[#C4A77D] text-xs font-bold">
                    <UserIcon className="h-3.5 w-3.5" />
                  </div>
                )}
                <div className="hidden lg:block text-left">
                  <p className="text-xs font-semibold text-[#E5E5E5] leading-tight truncate max-w-[120px]">
                    {user.displayName || 'Investor'}
                  </p>
                  <p className="text-[10px] text-[#888888] font-mono truncate max-w-[120px]">
                    {user.email || user.uid.substring(0, 8)}
                  </p>
                </div>
                <button
                  id="logout-btn"
                  onClick={onLogout}
                  title="Sign Out"
                  className="ml-1 rounded-lg p-1 text-[#888888] hover:bg-[#222222] hover:text-[#EF4444] transition-colors cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};
