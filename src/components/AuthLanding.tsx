import React, { useState } from 'react';
import { 
  Sparkles, 
  TrendingUp, 
  BookOpen, 
  ShieldCheck, 
  ArrowRight, 
  Lock, 
  CheckCircle2, 
  Database,
  Calculator,
  UserCheck
} from 'lucide-react';
import { signInWithGoogle, signInAsGuest } from '../lib/firebase';

interface AuthLandingProps {
  onAuthSuccess: () => void;
}

export const AuthLanding: React.FC<AuthLandingProps> = ({ onAuthSuccess }) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [guestLoading, setGuestLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      onAuthSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google sign-in was cancelled or blocked by browser.';
      console.warn('Sign-in error:', msg);
      setError('Google Sign-In popup was closed or blocked. You can also use "Continue as Guest" to test immediately.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestSignIn = async () => {
    setGuestLoading(true);
    setError(null);
    try {
      await signInAsGuest('Demo Portfolio Manager');
      onAuthSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Guest sign-in failed.';
      setError(msg);
    } finally {
      setGuestLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E5E5E5] flex flex-col justify-between selection:bg-[#C4A77D]/30 selection:text-[#FFFFFF]">
      
      {/* Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-gradient-to-b from-[#C4A77D]/10 to-transparent blur-3xl opacity-40 rounded-full" />
      </div>

      {/* Header */}
      <header className="relative z-10 mx-auto w-full max-w-7xl px-6 py-8 flex items-center justify-between border-b border-[#1A1A1A]">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#141414] border border-[#C4A77D]/40 text-[#C4A77D] shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-serif text-lg font-bold tracking-wider text-[#F5F5F5]">OMEGA</h1>
            <p className="text-xs text-[#888888]">Financial Journal & Portfolio Ledger</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-[#262626] bg-[#121212] px-3 py-1 text-xs text-[#A3A3A3] font-mono">
            <ShieldCheck className="h-3.5 w-3.5 text-[#C4A77D]" />
            Private & Isolated Ledger
          </span>
        </div>
      </header>

      {/* Main Hero & Auth Card */}
      <main className="relative z-10 mx-auto max-w-5xl px-6 py-12 flex-1 flex flex-col justify-center items-center text-center">
        
        <div className="inline-flex items-center gap-2 rounded-full border border-[#C4A77D]/30 bg-[#C4A77D]/10 px-3.5 py-1 text-xs font-semibold text-[#C4A77D] mb-6">
          <Sparkles className="h-3.5 w-3.5" />
          Reflective Financial Journey & Portfolio Intelligence
        </div>

        <h2 className="font-serif text-3xl sm:text-5xl font-bold tracking-tight text-[#F5F5F5] max-w-3xl leading-tight sm:leading-none">
          Reflect on Markets. Track Cost Basis. Master Your Journey.
        </h2>

        <p className="mt-4 max-w-2xl text-base text-[#A3A3A3] leading-relaxed">
          An intuitive financial companion combining multi-turn trade journaling with real-time dollar-weighted average cost calculations and profit/loss simulations.
        </p>

        {/* Error Alert */}
        {error && (
          <div className="mt-6 w-full max-w-md rounded-xl border border-rose-500/40 bg-rose-950/30 p-4 text-xs text-rose-300 text-left">
            <p className="font-semibold mb-1 flex items-center gap-1.5">
              <Lock className="h-4 w-4 text-rose-400" />
              Sign-In Notice
            </p>
            <p>{error}</p>
          </div>
        )}

        {/* Auth Action Box */}
        <div className="mt-8 w-full max-w-md rounded-2xl border border-[#222222] bg-[#111111] p-6 shadow-2xl space-y-4 text-left">
          <div className="space-y-1">
            <h3 className="font-serif text-base font-bold text-[#F5F5F5]">
              Access Your Personal Journey
            </h3>
            <p className="text-xs text-[#888888]">
              All stock records and reflections are securely isolated and persisted to your account.
            </p>
          </div>

          <button
            id="google-signin-btn"
            onClick={handleGoogleSignIn}
            disabled={loading || guestLoading}
            className="w-full flex items-center justify-center gap-3 rounded-xl bg-[#F5F5F5] hover:bg-[#FFFFFF] px-5 py-3 text-sm font-semibold text-[#0A0A0A] shadow-md transition-all disabled:opacity-60 cursor-pointer"
          >
            {loading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#0A0A0A] border-t-transparent" />
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-.143-.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>Sign In with Google</span>
          </button>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-[#222222] w-full" />
            <span className="bg-[#111111] px-3 text-[11px] font-mono text-[#666666] uppercase">or</span>
            <div className="border-t border-[#222222] w-full" />
          </div>

          <button
            id="guest-signin-btn"
            onClick={handleGuestSignIn}
            disabled={loading || guestLoading}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-[#2D2D2D] bg-[#181818] hover:bg-[#202020] px-4 py-2.5 text-xs font-semibold text-[#D4D4D4] hover:text-[#FFFFFF] transition-all disabled:opacity-60 cursor-pointer"
          >
            {guestLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#C4A77D] border-t-transparent" />
            ) : (
              <UserCheck className="h-4 w-4 text-[#C4A77D]" />
            )}
            <span>Instant Demo Mode</span>
          </button>
        </div>

        {/* Feature Grid */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-4xl text-left">
          
          <div className="rounded-2xl border border-[#1F1F1F] bg-[#111111]/80 p-5 space-y-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#C4A77D]/10 text-[#C4A77D] border border-[#C4A77D]/20">
              <BookOpen className="h-4 w-4" />
            </div>
            <h4 className="font-serif text-sm font-bold text-[#F5F5F5]">Financial Journal & Notes</h4>
            <p className="text-xs text-[#888888] leading-relaxed">
              Multi-turn trade reflections and thesis analysis. Log your emotions, strategy, and automatically sync trade executions.
            </p>
          </div>

          <div className="rounded-2xl border border-[#1F1F1F] bg-[#111111]/80 p-5 space-y-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#C4A77D]/10 text-[#C4A77D] border border-[#C4A77D]/20">
              <TrendingUp className="h-4 w-4" />
            </div>
            <h4 className="font-serif text-sm font-bold text-[#F5F5F5]">Dollar-Weighted AVR Cost</h4>
            <p className="text-xs text-[#888888] leading-relaxed">
              Automatically calculates your real average cost basis and portfolio value across all Buy/Sell tranches.
            </p>
          </div>

          <div className="rounded-2xl border border-[#1F1F1F] bg-[#111111]/80 p-5 space-y-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#C4A77D]/10 text-[#C4A77D] border border-[#C4A77D]/20">
              <Calculator className="h-4 w-4" />
            </div>
            <h4 className="font-serif text-sm font-bold text-[#F5F5F5]">P&L Exit Simulations</h4>
            <p className="text-xs text-[#888888] leading-relaxed">
              Simulate profit targets, risk-reward ratios, and exit scenarios linked directly to your current holdings.
            </p>
          </div>

        </div>

      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[#1A1A1A] py-6 text-center text-xs text-[#666666] font-mono">
        <p>OMEGA • Financial Journal & Portfolio Ledger</p>
      </footer>

    </div>
  );
};
