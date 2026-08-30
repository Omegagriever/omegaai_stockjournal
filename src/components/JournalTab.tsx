import React, { useState } from 'react';
import { 
  Sparkles, 
  Send, 
  BookOpen, 
  Trash2, 
  PlusCircle, 
  Clock, 
  Search, 
  TrendingUp, 
  Calculator, 
  ChevronRight, 
  Cpu, 
  MessageSquare,
  CheckCircle,
  BarChart3,
  Bookmark,
  ArrowRight,
  FileSpreadsheet
} from 'lucide-react';
import { StockHolding, Transaction, JournalEntry, ChatMessage, UserProfile, DetectedTrade } from '../types';
import { saveJournalEntry, deleteJournalEntry, addStockTransaction } from '../services/firestoreService';
import { safeToFixed, safeNumber } from '../lib/formatters';

interface JournalTabProps {
  user: UserProfile;
  stocks: StockHolding[];
  transactions: Transaction[];
  pastEntries: JournalEntry[];
  activePromptQuery?: string;
  onClearActivePromptQuery?: () => void;
  onOpenSimulatorForTicker?: (ticker: string) => void;
  onOpenPortfolioTab?: () => void;
  onOpenBackupModal?: () => void;
}

export const JournalTab: React.FC<JournalTabProps> = ({
  user,
  stocks,
  transactions,
  pastEntries,
  activePromptQuery,
  onClearActivePromptQuery,
  onOpenSimulatorForTicker,
  onOpenPortfolioTab,
  onOpenBackupModal,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentInput, setCurrentInput] = useState<string>(activePromptQuery || '');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [selectedPastEntry, setSelectedPastEntry] = useState<JournalEntry | null>(null);
  const [includePortfolioContext, setIncludePortfolioContext] = useState<boolean>(true);
  const [syncedTradeIds, setSyncedTradeIds] = useState<Set<string>>(new Set());
  const [syncingTradeId, setSyncingTradeId] = useState<string | null>(null);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  const handleSyncTradeToPortfolio = async (id: string, trade: DetectedTrade) => {
    setSyncingTradeId(id);
    try {
      const result = await addStockTransaction(user.uid, {
        ticker: trade.ticker,
        type: trade.type,
        quantity: trade.quantity,
        price: trade.price,
        notes: trade.notes || 'Logged via Journal Reflection'
      });
      setSyncedTradeIds(prev => new Set(prev).add(id));
      setSyncToast(
        `Applied ${trade.type} ${trade.quantity} ${trade.ticker} @ $${safeToFixed(trade.price, 2)} to your portfolio! New AVR: $${safeToFixed(result.updatedStock.average_cost, 2)}`
      );
      setTimeout(() => setSyncToast(null), 6000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to sync trade to portfolio.';
      setError(msg);
    } finally {
      setSyncingTradeId(null);
    }
  };

  // If parent passes a quick prompt (e.g. from Stock Portfolio tab "Ask Gemini")
  React.useEffect(() => {
    if (activePromptQuery) {
      setCurrentInput(activePromptQuery);
      setSelectedPastEntry(null);
      if (onClearActivePromptQuery) onClearActivePromptQuery();
    }
  }, [activePromptQuery, onClearActivePromptQuery]);

  const handleSendMessage = async (customPrompt?: string) => {
    const promptToSend = customPrompt || currentInput.trim();
    if (!promptToSend || loading) return;

    setError(null);
    const userMsgId = 'msg_' + Date.now();
    const newUserMessage: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: promptToSend,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, newUserMessage];
    setMessages(updatedMessages);
    setCurrentInput('');
    setLoading(true);
    setSelectedPastEntry(null);

    try {
      // Send to server-side Gemini route
      const response = await fetch('/api/gemini/journal-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptToSend,
          chatHistory: updatedMessages.slice(-6).map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            content: m.content
          })),
          stocks: includePortfolioContext ? stocks : [],
          recentTransactions: includePortfolioContext ? transactions.slice(0, 10) : [],
          userDisplayName: user.displayName || 'Investor'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with status ${response.status}`);
      }

      const data = await response.json();
      const assistantMsgId = 'msg_ai_' + Date.now();

      const newAssistantMessage: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toISOString(),
        summary: data.summary,
        calculations: data.calculations,
      };

      setMessages([...updatedMessages, newAssistantMessage]);

      // Automatically save to Cloud Firestore isolated to this user
      await saveJournalEntry(user.uid, {
        prompt: promptToSend,
        response: data.reply,
        summary: data.summary || '',
        stockContextUsed: stocks.map(s => s.ticker),
        calculations: data.calculations
      });

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate financial analysis.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleDeleteEntry = async (e: React.MouseEvent, entryId: string) => {
    e.stopPropagation();
    try {
      await deleteJournalEntry(user.uid, entryId);
      if (selectedPastEntry?.id === entryId) {
        setSelectedPastEntry(null);
      }
    } catch (err) {
      console.error('Failed to delete entry:', err);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setSelectedPastEntry(null);
    setCurrentInput('');
    setError(null);
  };

  const filteredPastEntries = pastEntries.filter(entry => {
    if (!searchFilter.trim()) return true;
    const term = searchFilter.toLowerCase();
    return (
      entry.prompt.toLowerCase().includes(term) ||
      entry.response.toLowerCase().includes(term) ||
      (entry.summary && entry.summary.toLowerCase().includes(term)) ||
      (entry.stockContextUsed && entry.stockContextUsed.some(t => t.toLowerCase().includes(term)))
    );
  });

  const promptSuggestions = [
    {
      title: "Calculate Average Cost",
      text: stocks.length > 0
        ? `Calculate my exact dollar-weighted Average Cost (AVR) for ${stocks[0].ticker} and explain the breakdown.`
        : "Explain how dollar-weighted average cost is mathematically calculated on stock purchases."
    },
    {
      title: "Simulate Exit Profit",
      text: stocks.length > 0
        ? `How much net profit would I make if I sell all my ${stocks[0].ticker} shares at $${Math.round(stocks[0].average_cost * 1.35)}?`
        : "How do I calculate realized profit vs unrealized gains when taking profits?"
    },
    {
      title: "Portfolio Health & Thesis",
      text: "Review my current stock holdings and write a thoughtful reflection on my asset allocation and risk exposure."
    },
    {
      title: "DCA Scenario Analysis",
      text: stocks.length > 0
        ? `If I buy 10 additional shares of ${stocks[0].ticker} at a 15% discount, what will my new dollar-weighted average cost become?`
        : "If I buy 10 shares at $150 and 10 shares at $120, what is my new average cost?"
    }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      
      {/* LEFT COLUMN: Past Entries & History Archive (4 cols on lg) */}
      <div className="lg:col-span-4 space-y-4">
        
        <div className="rounded-2xl border border-[#222222] bg-[#111111] p-4 shadow-xs">
          
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-[#C4A77D]" />
              <h3 className="font-serif text-sm font-bold text-[#F5F5F5]">
                Journal Archive
              </h3>
            </div>
            <div className="flex items-center gap-1.5">
              {onOpenBackupModal && (
                <button
                  onClick={onOpenBackupModal}
                  title="Backup entries to Google Sheets"
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-2 py-1 text-xs font-semibold text-emerald-400 transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span className="hidden xl:inline">Drive Backup</span>
                </button>
              )}
              <button
                onClick={startNewChat}
                className="inline-flex items-center gap-1 rounded-lg bg-[#C4A77D]/10 hover:bg-[#C4A77D]/20 border border-[#C4A77D]/30 px-2.5 py-1 text-xs font-semibold text-[#C4A77D] transition-colors cursor-pointer"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                <span>New Entry</span>
              </button>
            </div>
          </div>

          {/* Search Filter */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#666666]" />
            <input
              type="text"
              placeholder="Search reflections, tickers..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full rounded-xl border border-[#262626] bg-[#0A0A0A] pl-8 pr-3 py-2 text-xs text-[#E5E5E5] placeholder-[#666666] focus:border-[#C4A77D] focus:outline-none"
            />
          </div>

          {/* Entries List */}
          <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
            {filteredPastEntries.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#222222] p-6 text-center text-xs text-[#666666]">
                <Bookmark className="h-6 w-6 mx-auto mb-2 text-[#444444]" />
                <p>No journal entries found.</p>
                <p className="mt-1 text-[11px] text-[#555555]">
                  Start typing to reflect and analyze your trades!
                </p>
              </div>
            ) : (
              filteredPastEntries.map((entry) => {
                const isSelected = selectedPastEntry?.id === entry.id;
                return (
                  <div
                    key={entry.id}
                    onClick={() => setSelectedPastEntry(entry)}
                    className={`group relative rounded-xl border p-3 text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#C4A77D] bg-[#1A1A1A] shadow-xs'
                        : 'border-[#222222] bg-[#0D0D0D] hover:border-[#333333] hover:bg-[#141414]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="text-[11px] font-mono text-[#888888] flex items-center gap-1">
                        <Clock className="h-3 w-3 text-[#666666]" />
                        {new Date(entry.timestamp).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      <button
                        onClick={(e) => handleDeleteEntry(e, entry.id)}
                        className="opacity-0 group-hover:opacity-100 text-[#666666] hover:text-rose-400 p-0.5 rounded transition-opacity"
                        title="Delete Entry"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <p className="text-xs font-semibold text-[#E5E5E5] line-clamp-1">
                      {entry.prompt}
                    </p>

                    {entry.summary && (
                      <p className="mt-1 text-[11px] text-[#A3A3A3] line-clamp-2 leading-relaxed">
                        {entry.summary}
                      </p>
                    )}

                    {entry.calculations?.calculatedAvgCost !== undefined && entry.calculations?.calculatedAvgCost !== null && (
                      <div className="mt-2 inline-flex items-center gap-1 rounded bg-[#C4A77D]/10 px-1.5 py-0.5 text-[10px] font-mono text-[#C4A77D]">
                        <Calculator className="h-2.5 w-2.5" />
                        AVR: ${safeToFixed(entry.calculations.calculatedAvgCost, 2)}
                      </div>
                    )}

                    {entry.stockContextUsed && entry.stockContextUsed.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {entry.stockContextUsed.slice(0, 3).map((ticker) => (
                          <span
                            key={ticker}
                            className="rounded border border-[#2A2A2A] bg-[#161616] px-1.5 py-0.2 text-[9px] font-mono text-[#AAAAAA]"
                          >
                            ${ticker}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

        </div>

        {/* Live Holdings Context Summary Card */}
        <div className="rounded-2xl border border-[#222222] bg-[#111111] p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold font-serif text-[#E5E5E5] flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-[#C4A77D]" />
              Active Stock Context
            </h4>
            <span className="text-[10px] font-mono text-[#888888]">
              {stocks.length} Assets
            </span>
          </div>

          <div className="space-y-1.5">
            {stocks.length === 0 ? (
              <p className="text-[11px] text-[#666666]">
                No stocks added yet. Use the Portfolio tab to log your holdings.
              </p>
            ) : (
              stocks.slice(0, 4).map((s) => (
                <div
                  key={s.ticker}
                  className="flex items-center justify-between rounded-lg bg-[#0A0A0A] border border-[#1E1E1E] px-2.5 py-1.5 text-xs"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-[#F5F5F5]">{s.ticker}</span>
                    <span className="text-[10px] text-[#888888]">({s.total_quantity} shs)</span>
                  </div>
                  <span className="font-mono text-[11px] text-[#C4A77D]">
                    ${safeToFixed(s.average_cost, 2)} AVR
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* RIGHT COLUMN: Active Reflection Stream & Gemini Chat (8 cols on lg) */}
      <div className="lg:col-span-8 space-y-4">
        
        {/* Selected Past Entry View Banner */}
        {selectedPastEntry ? (
          <div className="rounded-2xl border border-[#C4A77D]/30 bg-[#141414] p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-[#222222] pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#C4A77D]/20 text-[#C4A77D]">
                  <Bookmark className="h-3.5 w-3.5" />
                </span>
                <div>
                  <h3 className="font-serif text-sm font-bold text-[#F5F5F5]">
                    Archived Reflection from {new Date(selectedPastEntry.timestamp).toLocaleDateString()}
                  </h3>
                  <p className="text-[11px] font-mono text-[#888888]">
                    {new Date(selectedPastEntry.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPastEntry(null)}
                className="rounded-lg bg-[#222222] hover:bg-[#2A2A2A] px-3 py-1 text-xs text-[#D4D4D4] transition-colors cursor-pointer"
              >
                Back to Active Chat
              </button>
            </div>

            {/* Prompt */}
            <div className="rounded-xl bg-[#0D0D0D] border border-[#222222] p-4">
              <span className="text-[10px] font-mono uppercase text-[#888888] tracking-wider block mb-1">
                Your Reflection / Inquiry
              </span>
              <p className="text-sm font-medium text-[#E5E5E5] leading-relaxed">
                {selectedPastEntry.prompt}
              </p>
            </div>

            {/* Summary Box */}
            {selectedPastEntry.summary && (
              <div className="rounded-xl bg-[#C4A77D]/10 border border-[#C4A77D]/30 p-3.5 flex items-start gap-2.5">
                <Sparkles className="h-4 w-4 text-[#C4A77D] shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-[#C4A77D] mb-0.5">Executive Summary & Thesis</p>
                  <p className="text-xs text-[#E5E5E5] leading-relaxed">{selectedPastEntry.summary}</p>
                </div>
              </div>
            )}

            {/* Response */}
            <div className="prose prose-invert max-w-none text-xs text-[#D4D4D4] whitespace-pre-wrap leading-relaxed">
              {selectedPastEntry.response}
            </div>

            {/* Calculations highlight */}
            {selectedPastEntry.calculations && (
              <div className="space-y-3">
                <div className="rounded-xl border border-[#262626] bg-[#0A0A0A] p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-[#C4A77D]" />
                    <span className="text-xs text-[#E5E5E5] font-mono">
                      {selectedPastEntry.calculations.notes || `Calculated for ${selectedPastEntry.calculations.ticker}`}
                    </span>
                  </div>
                  {selectedPastEntry.calculations.calculatedAvgCost !== undefined && selectedPastEntry.calculations.calculatedAvgCost !== null && (
                    <span className="font-mono text-xs text-[#C4A77D] font-bold">
                      AVR: ${safeToFixed(selectedPastEntry.calculations.calculatedAvgCost, 2)}
                    </span>
                  )}
                </div>

                {selectedPastEntry.calculations.detectedTrade && (
                  <div className="rounded-xl bg-[#14120E] border border-[#C4A77D]/50 p-3.5 shadow-md">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                          selectedPastEntry.calculations.detectedTrade.type === 'BUY'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}>
                          {selectedPastEntry.calculations.detectedTrade.type}
                        </span>
                        <span className="font-bold text-sm font-mono text-[#F5F5F5]">
                          ${selectedPastEntry.calculations.detectedTrade.ticker}
                        </span>
                        <span className="text-xs font-mono text-[#A3A3A3]">
                          {selectedPastEntry.calculations.detectedTrade.quantity} shares @ ${safeToFixed(selectedPastEntry.calculations.detectedTrade.price, 2)}
                        </span>
                      </div>
                      <span className="font-mono text-xs font-bold text-[#C4A77D]">
                        Total: ${safeToFixed(selectedPastEntry.calculations.detectedTrade.quantity * selectedPastEntry.calculations.detectedTrade.price, 2)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#2A241A]">
                      <p className="text-[11px] text-[#A3A3A3]">
                        {syncedTradeIds.has(selectedPastEntry.id) 
                          ? '✓ Position & Average Cost updated in live portfolio' 
                          : 'Recorded trade from journal entry.'}
                      </p>

                      <div className="flex items-center gap-2">
                        {syncedTradeIds.has(selectedPastEntry.id) ? (
                          <button
                            type="button"
                            onClick={() => onOpenPortfolioTab && onOpenPortfolioTab()}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 text-xs font-medium hover:bg-emerald-500/30 transition-colors cursor-pointer"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            <span>Synced • View Portfolio</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSyncTradeToPortfolio(selectedPastEntry.id, selectedPastEntry.calculations!.detectedTrade!)}
                            disabled={syncingTradeId === selectedPastEntry.id}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#C4A77D] text-[#0A0A0A] hover:bg-[#B39366] px-3.5 py-1.5 text-xs font-semibold shadow transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                          >
                            {syncingTradeId === selectedPastEntry.id ? (
                              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black border-t-transparent" />
                            ) : (
                              <TrendingUp className="h-3.5 w-3.5" />
                            )}
                            <span>⚡ Apply to Portfolio</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Active Multi-Turn Chat Canvas */
          <div className="rounded-2xl border border-[#222222] bg-[#111111] shadow-xs flex flex-col min-h-[580px]">
            
            {/* Chat Header */}
            <div className="border-b border-[#1F1F1F] bg-[#141414] px-5 py-3.5 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#C4A77D]/20 text-[#C4A77D]">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-serif text-sm font-bold text-[#F5F5F5]">
                    Financial Companion & Analysis
                  </h3>
                  <p className="text-[10px] text-[#888888] flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live portfolio context enabled
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-[11px] text-[#A3A3A3] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includePortfolioContext}
                    onChange={(e) => setIncludePortfolioContext(e.target.checked)}
                    className="rounded border-[#333333] bg-[#1A1A1A] text-[#C4A77D] focus:ring-0"
                  />
                  <span>Inject Portfolio</span>
                </label>
              </div>
            </div>

            {/* Sync Confirmation Toast */}
            {syncToast && (
              <div className="mx-5 mt-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 p-3 text-xs text-emerald-300 flex items-center justify-between gap-3 animate-fade-in">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>{syncToast}</span>
                </div>
                {onOpenPortfolioTab && (
                  <button
                    onClick={onOpenPortfolioTab}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 hover:underline shrink-0 cursor-pointer"
                  >
                    <span>View Ledger</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}

            {/* Chat Message History */}
            <div className="flex-1 p-5 space-y-4 overflow-y-auto max-h-[460px]">
              {messages.length === 0 ? (
                <div className="py-8 space-y-6 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#181818] border border-[#2A2A2A] text-[#C4A77D]">
                    <MessageSquare className="h-6 w-6" />
                  </div>
                  <div className="space-y-1 max-w-md mx-auto">
                    <h4 className="font-serif text-base font-bold text-[#F5F5F5]">
                      Welcome to your Financial Journal
                    </h4>
                    <p className="text-xs text-[#888888] leading-relaxed">
                      Write reflections on your trades, calculate dollar-weighted average costs, or simulate hypothetical profit and loss exits.
                    </p>
                  </div>

                  {/* Suggestion Prompts */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-lg mx-auto text-left pt-2">
                    {promptSuggestions.map((s, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(s.text)}
                        className="rounded-xl border border-[#222222] bg-[#141414] p-3 text-left hover:border-[#C4A77D]/40 hover:bg-[#1A1A1A] transition-all cursor-pointer group"
                      >
                        <p className="text-[11px] font-bold text-[#C4A77D] mb-1 flex items-center justify-between">
                          <span>{s.title}</span>
                          <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </p>
                        <p className="text-[11px] text-[#A3A3A3] line-clamp-2 leading-relaxed">
                          {s.text}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`rounded-2xl px-4 py-3 text-xs leading-relaxed max-w-[85%] ${
                        msg.role === 'user'
                          ? 'bg-[#C4A77D] text-[#0A0A0A] font-medium shadow-sm'
                          : 'bg-[#181818] text-[#E5E5E5] border border-[#262626] shadow-sm'
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        <div className="space-y-3">
                          {msg.summary && (
                            <div className="rounded-lg bg-[#222222] border border-[#333333] p-2.5 text-[11px] text-[#C4A77D] flex items-start gap-2">
                              <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#C4A77D]" />
                              <span>{msg.summary}</span>
                            </div>
                          )}

                          <div className="whitespace-pre-wrap font-sans text-xs">
                            {msg.content}
                          </div>

                          {msg.calculations && (
                            <div className="mt-2 rounded-lg bg-[#111111] border border-[#C4A77D]/30 p-2.5 flex items-center justify-between">
                              <div className="flex items-center gap-1.5 text-[11px] text-[#A3A3A3]">
                                <Calculator className="h-3.5 w-3.5 text-[#C4A77D]" />
                                <span>{msg.calculations.notes || 'Calculated Metric'}</span>
                              </div>
                              {msg.calculations.calculatedAvgCost !== undefined && msg.calculations.calculatedAvgCost !== null && (
                                <span className="font-mono text-xs font-bold text-[#C4A77D]">
                                  AVR: ${safeToFixed(msg.calculations.calculatedAvgCost, 2)}
                                </span>
                              )}
                              {msg.calculations.simulatedProfitLoss !== undefined && msg.calculations.simulatedProfitLoss !== null && (
                                <span className={`font-mono text-xs font-bold ${
                                  safeNumber(msg.calculations.simulatedProfitLoss) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                }`}>
                                  P&L: ${safeToFixed(msg.calculations.simulatedProfitLoss, 2)}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Interactive 1-Click Portfolio Sync for Trade detected in Journal */}
                          {msg.calculations?.detectedTrade && (
                            <div className="mt-3 rounded-xl bg-[#14120E] border border-[#C4A77D]/50 p-3.5 shadow-md">
                              <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                                <div className="flex items-center gap-2">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                                    msg.calculations.detectedTrade.type === 'BUY'
                                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                  }`}>
                                    {msg.calculations.detectedTrade.type}
                                  </span>
                                  <span className="font-bold text-sm font-mono text-[#F5F5F5]">
                                    ${msg.calculations.detectedTrade.ticker}
                                  </span>
                                  <span className="text-xs font-mono text-[#A3A3A3]">
                                    {msg.calculations.detectedTrade.quantity} shares @ ${safeToFixed(msg.calculations.detectedTrade.price, 2)}
                                  </span>
                                </div>
                                <span className="font-mono text-xs font-bold text-[#C4A77D]">
                                  Total: ${safeToFixed(msg.calculations.detectedTrade.quantity * msg.calculations.detectedTrade.price, 2)}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#2A241A]">
                                <p className="text-[11px] text-[#A3A3A3]">
                                  {syncedTradeIds.has(msg.id) 
                                    ? '✓ Position & Average Cost updated in live portfolio' 
                                    : 'Detected trade from journal. Sync to update holdings.'}
                                </p>

                                <div className="flex items-center gap-2">
                                  {syncedTradeIds.has(msg.id) ? (
                                    <button
                                      type="button"
                                      onClick={() => onOpenPortfolioTab && onOpenPortfolioTab()}
                                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 text-xs font-medium hover:bg-emerald-500/30 transition-colors cursor-pointer"
                                    >
                                      <CheckCircle className="h-3.5 w-3.5" />
                                      <span>Synced • View Portfolio</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleSyncTradeToPortfolio(msg.id, msg.calculations!.detectedTrade!)}
                                      disabled={syncingTradeId === msg.id}
                                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#C4A77D] text-[#0A0A0A] hover:bg-[#B39366] px-3.5 py-1.5 text-xs font-semibold shadow transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                                    >
                                      {syncingTradeId === msg.id ? (
                                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black border-t-transparent" />
                                      ) : (
                                        <TrendingUp className="h-3.5 w-3.5" />
                                      )}
                                      <span>⚡ Apply to Portfolio</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                    <span className="mt-1 text-[10px] font-mono text-[#666666] px-1">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              )}

              {loading && (
                <div className="flex items-center gap-2 text-xs text-[#A3A3A3] bg-[#181818] rounded-xl p-3 border border-[#262626] max-w-sm">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#C4A77D] border-t-transparent" />
                  <span>Analyzing portfolio records and generating thesis...</span>
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-rose-500/40 bg-rose-950/20 p-3 text-xs text-rose-300">
                  <p className="font-semibold">Generation Error:</p>
                  <p>{error}</p>
                </div>
              )}
            </div>

            {/* Input Bar */}
            <div className="border-t border-[#1F1F1F] bg-[#141414] p-3.5 rounded-b-2xl">
              <div className="relative flex items-center">
                <textarea
                  id="journal-prompt-input"
                  rows={2}
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Reflect on your trades or ask: 'Calculate average cost for AAPL' or 'What if I sell NVDA at $150?'..."
                  className="w-full resize-none rounded-xl border border-[#262626] bg-[#0A0A0A] p-3 text-xs text-[#E5E5E5] placeholder-[#666666] focus:border-[#C4A77D] focus:outline-none focus:ring-1 focus:ring-[#C4A77D]/30"
                />
                <button
                  id="journal-send-btn"
                  onClick={() => handleSendMessage()}
                  disabled={!currentInput.trim() || loading}
                  className="absolute right-2.5 bottom-2.5 rounded-lg bg-[#C4A77D] hover:bg-[#D4B78D] p-2 text-[#0A0A0A] transition-all disabled:opacity-40 cursor-pointer shadow-xs"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[10px] text-[#666666] font-mono px-1">
                <span>Press Enter to send • Shift+Enter for newline</span>
                <span>Auto-saved to Cloud Ledger</span>
              </div>
            </div>

          </div>
        )}

      </div>

    </div>
  );
};
