import React, { useState, useEffect } from 'react';
import { subscribeAuthState, logOut } from './lib/firebase';
import { 
  subscribeToStocks, 
  subscribeToTransactions, 
  subscribeToJournalEntries,
  syncUserProfile 
} from './services/firestoreService';
import { UserProfile, StockHolding, Transaction, JournalEntry } from './types';
import { safeToFixed } from './lib/formatters';
import { Navbar } from './components/Navbar';
import { AuthLanding } from './components/AuthLanding';
import { JournalTab } from './components/JournalTab';
import { StockPortfolioTab } from './components/StockPortfolioTab';
import { SimulatorTab } from './components/SimulatorTab';
import { GoogleSheetsBackupModal } from './components/GoogleSheetsBackupModal';
import { Sparkles, ShieldCheck, Database, FileSpreadsheet } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'journal' | 'portfolio' | 'simulator' | 'security'>('journal');
  const [isBackupModalOpen, setIsBackupModalOpen] = useState<boolean>(false);
  
  // Real-Time Firestore State
  const [stocks, setStocks] = useState<StockHolding[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pastEntries, setPastEntries] = useState<JournalEntry[]>([]);

  // Cross-Tab Interaction State
  const [activePromptQuery, setActivePromptQuery] = useState<string>('');
  const [simulatorInitialTicker, setSimulatorInitialTicker] = useState<string>('AAPL');

  // Firebase Auth State Listener
  useEffect(() => {
    // Safety fallback: Never stay stuck on loading screen longer than 3 seconds
    const fallbackTimer = setTimeout(() => {
      setAuthLoading(false);
    }, 3000);

    const unsubscribe = subscribeAuthState((firebaseUser) => {
      clearTimeout(fallbackTimer);
      if (firebaseUser) {
        // 1. Immediately set the user profile and clear loading state
        const initialProfile: UserProfile = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || 'Investor',
          photoURL: firebaseUser.photoURL,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setUser(initialProfile);
        setAuthLoading(false);

        // 2. Perform background profile sync with Firestore
        syncUserProfile(firebaseUser)
          .then((profile) => {
            setUser(profile);
          })
          .catch((err) => {
            console.warn('Background user profile sync warning:', err);
          });
      } else {
        setUser(null);
        setStocks([]);
        setTransactions([]);
        setPastEntries([]);
        setAuthLoading(false);
      }
    });

    return () => {
      clearTimeout(fallbackTimer);
      unsubscribe();
    };
  }, []);

  // Real-Time Subscriptions when User is Authenticated
  useEffect(() => {
    if (!user?.uid) return;

    const unsubStocks = subscribeToStocks(user.uid, (data) => {
      setStocks(data);
    });

    const unsubTransactions = subscribeToTransactions(user.uid, (data) => {
      setTransactions(data);
    });

    const unsubJournal = subscribeToJournalEntries(user.uid, (data) => {
      setPastEntries(data);
    });

    return () => {
      unsubStocks();
      unsubTransactions();
      unsubJournal();
    };
  }, [user?.uid]);

  const handleLogout = async () => {
    try {
      await logOut();
      setUser(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Cross-Tab Handler: "Consult Journal" from Portfolio Tab
  const handleAskJournalForTicker = (ticker: string, holding: StockHolding) => {
    setActivePromptQuery(
      `I'm reviewing my position in $${ticker}. I currently hold ${holding.total_quantity} shares at a dollar-weighted Average Cost of $${safeToFixed(holding.average_cost, 2)}. What are key catalysts, risk considerations, and how should I think about my exit strategy?`
    );
    setActiveTab('journal');
  };

  // Cross-Tab Handler: "Simulate P&L" from Portfolio Tab
  const handleOpenSimulatorForTicker = (ticker: string) => {
    setSimulatorInitialTicker(ticker);
    setActiveTab('simulator');
  };

  // Cross-Tab Handler: "Transfer Simulation to Journal" from Simulator Tab
  const handleSendSimulationToJournal = (promptText: string) => {
    setActivePromptQuery(promptText);
    setActiveTab('journal');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center text-[#E5E5E5] space-y-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#141414] border border-[#C4A77D]/40 text-[#C4A77D] shadow-lg animate-pulse">
          <Sparkles className="h-6 w-6" />
        </div>
        <p className="text-xs font-mono text-[#A3A3A3]">
          Loading your financial journey...
        </p>
      </div>
    );
  }

  // If not logged in, render the Auth Landing Screen
  if (!user) {
    return <AuthLanding onAuthSuccess={() => {}} />;
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E5E5E5] flex flex-col selection:bg-[#C4A77D]/25 selection:text-[#F5E8D3]">
      
      {/* Top Navigation Bar */}
      <Navbar
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        onOpenBackupModal={() => setIsBackupModalOpen(true)}
        holdingsCount={stocks.length}
        entriesCount={pastEntries.length}
      />

      {/* Main Content View */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        
        {activeTab === 'journal' && (
          <JournalTab
            user={user}
            stocks={stocks}
            transactions={transactions}
            pastEntries={pastEntries}
            activePromptQuery={activePromptQuery}
            onClearActivePromptQuery={() => setActivePromptQuery('')}
            onOpenSimulatorForTicker={handleOpenSimulatorForTicker}
            onOpenPortfolioTab={() => setActiveTab('portfolio')}
            onOpenBackupModal={() => setIsBackupModalOpen(true)}
          />
        )}

        {activeTab === 'portfolio' && (
          <StockPortfolioTab
            user={user}
            stocks={stocks}
            transactions={transactions}
            onAskJournalForTicker={handleAskJournalForTicker}
            onOpenSimulatorForTicker={handleOpenSimulatorForTicker}
            onOpenBackupModal={() => setIsBackupModalOpen(true)}
          />
        )}

        {activeTab === 'simulator' && (
          <SimulatorTab
            user={user}
            stocks={stocks}
            initialTicker={simulatorInitialTicker}
            onSendToJournal={handleSendSimulationToJournal}
          />
        )}

      </main>

      {/* Google Sheets Backup Modal */}
      <GoogleSheetsBackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        user={user}
        stocks={stocks}
        transactions={transactions}
        pastEntries={pastEntries}
      />

      {/* Footer */}
      <footer className="border-t border-[#1F1F1F] bg-[#0E0E0E] py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#888888]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#C4A77D]" />
            <span>OMEGA • Financial Journal & Portfolio Ledger</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsBackupModalOpen(true)}
              className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Google Drive Backup</span>
            </button>
            <span className="flex items-center gap-1 text-[#A3A3A3]">
              <Database className="h-3.5 w-3.5 text-[#C4A77D]" /> Real-time Synchronization Active
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
}
