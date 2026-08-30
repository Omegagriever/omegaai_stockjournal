import React, { useState } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownRight, 
  PlusCircle, 
  Layers, 
  Calculator, 
  Sparkles, 
  Trash2, 
  Clock, 
  History, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  FolderPlus,
  FileSpreadsheet,
  FileDown
} from 'lucide-react';
import { StockHolding, Transaction, TransactionType, UserProfile } from '../types';
import { addStockTransaction, deleteStockHolding, deleteTransaction, seedSamplePortfolio } from '../services/firestoreService';
import { safeToFixed, safeNumber } from '../lib/formatters';
import { PortfolioReportModal } from './PortfolioReportModal';

interface StockPortfolioTabProps {
  user: UserProfile;
  stocks: StockHolding[];
  transactions: Transaction[];
  onAskJournalForTicker: (ticker: string, holding: StockHolding) => void;
  onOpenSimulatorForTicker: (ticker: string) => void;
  onOpenBackupModal?: () => void;
}

export const StockPortfolioTab: React.FC<StockPortfolioTabProps> = ({
  user,
  stocks,
  transactions,
  onAskJournalForTicker,
  onOpenSimulatorForTicker,
  onOpenBackupModal,
}) => {
  // Form State
  const [ticker, setTicker] = useState<string>('');
  const [type, setType] = useState<TransactionType>('BUY');
  const [quantity, setQuantity] = useState<string>('10');
  const [price, setPrice] = useState<string>('150.00');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [seeding, setSeeding] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeLedgerFilter, setActiveLedgerFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);

  // Compute total portfolio metrics
  const totalInvested = stocks.reduce((acc, s) => acc + (s.total_invested || (s.total_quantity * s.average_cost)), 0);
  const totalShares = stocks.reduce((acc, s) => acc + s.total_quantity, 0);

  // Live calculation preview of AVR for the form
  const numQty = parseFloat(quantity) || 0;
  const numPrice = parseFloat(price) || 0;
  const cleanTicker = ticker.trim().toUpperCase();
  const existingHolding = stocks.find((s) => s.ticker === cleanTicker);

  let previewNewQty = numQty;
  let previewNewAvg = numPrice;
  let previewNewInvested = numQty * numPrice;

  if (existingHolding) {
    const currentQty = existingHolding.total_quantity;
    const currentInvested = existingHolding.total_invested || (currentQty * existingHolding.average_cost);

    if (type === 'BUY') {
      previewNewQty = currentQty + numQty;
      previewNewInvested = currentInvested + (numQty * numPrice);
      previewNewAvg = previewNewQty > 0 ? previewNewInvested / previewNewQty : numPrice;
    } else {
      previewNewQty = Math.max(0, currentQty - numQty);
      previewNewAvg = existingHolding.average_cost;
      previewNewInvested = previewNewQty * previewNewAvg;
    }
  }

  const handleLogTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cleanTicker) {
      setErrorMessage('Please enter a valid stock ticker symbol.');
      return;
    }
    if (numQty <= 0 || numPrice <= 0) {
      setErrorMessage('Quantity and Price must be greater than zero.');
      return;
    }
    if (type === 'SELL' && existingHolding && numQty > existingHolding.total_quantity) {
      setErrorMessage(`Cannot sell ${numQty} shares. You currently own ${existingHolding.total_quantity} shares of ${cleanTicker}.`);
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await addStockTransaction(user.uid, {
        ticker: cleanTicker,
        type,
        quantity: numQty,
        price: numPrice,
        notes: notes.trim() || undefined,
      });

      setSuccessMessage(
        `Successfully logged ${type} ${numQty} ${cleanTicker} @ $${safeToFixed(numPrice, 2)}. New Average Cost: $${safeToFixed(result.updatedStock.average_cost, 2)}.`
      );

      // Reset fields
      setNotes('');
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update stock transaction in Firestore.';
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSeedPortfolio = async () => {
    setSeeding(true);
    setErrorMessage(null);
    try {
      await seedSamplePortfolio(user.uid);
      setSuccessMessage('Loaded sample tech portfolio with AAPL, NVDA, GOOGL, and MSFT!');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      setErrorMessage('Failed to seed sample portfolio.');
    } finally {
      setSeeding(false);
    }
  };

  const handleDeletePosition = async (t: string) => {
    if (window.confirm(`Are you sure you want to remove the holding record for ${t}?`)) {
      try {
        await deleteStockHolding(user.uid, t);
      } catch (err) {
        console.error('Failed to delete holding:', err);
      }
    }
  };

  const filteredTransactions = transactions.filter((tx) => {
    if (activeLedgerFilter === 'ALL') return true;
    return tx.type === activeLedgerFilter;
  });

  const popularTickers = ['AAPL', 'NVDA', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'META'];

  return (
    <div className="space-y-6">
      
      {/* Portfolio Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#222222] pb-4">
        <div>
          <h2 className="text-xl font-bold font-serif text-[#F5F5F5] flex items-center gap-2">
            <span>Portfolio & Average Cost Basis</span>
            <span className="text-[11px] font-mono font-normal px-2.5 py-0.5 rounded-full bg-[#1C1C1C] border border-[#2A2A2A] text-[#C4A77D]">
              {stocks.length} Holdings
            </span>
          </h2>
          <p className="text-xs text-[#888888] mt-0.5">
            Automated dollar-weighted cost averaging with real-time Firestore persistence
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            id="header-download-report-btn"
            onClick={() => setIsReportModalOpen(true)}
            title="Download printable PDF report of current portfolio holdings"
            className="inline-flex items-center gap-2 rounded-xl border border-[#C4A77D]/40 bg-[#C4A77D]/10 hover:bg-[#C4A77D]/20 text-[#C4A77D] px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer shadow-xs active:scale-95"
          >
            <FileDown className="h-4 w-4" />
            <span>Download Report</span>
          </button>

          {stocks.length > 0 && onOpenBackupModal && (
            <button
              onClick={onOpenBackupModal}
              title="Sync to Google Drive Spreadsheet"
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer shadow-xs active:scale-95"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Drive Backup</span>
            </button>
          )}
        </div>
      </div>
      
      {/* Portfolio Summary Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="rounded-2xl border border-[#222222] bg-[#111111] p-5 shadow-xs">
          <div className="flex items-center justify-between text-[#888888] mb-2">
            <span className="text-xs font-semibold">Total Cost Basis</span>
            <DollarSign className="h-4 w-4 text-[#C4A77D]" />
          </div>
          <p className="font-mono text-2xl font-bold text-[#F5F5F5]">
            ${totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-[11px] text-[#888888]">
            Dollar-weighted aggregate across all positions
          </p>
        </div>

        <div className="rounded-2xl border border-[#222222] bg-[#111111] p-5 shadow-xs">
          <div className="flex items-center justify-between text-[#888888] mb-2">
            <span className="text-xs font-semibold">Active Holdings</span>
            <Layers className="h-4 w-4 text-[#C4A77D]" />
          </div>
          <p className="font-mono text-2xl font-bold text-[#F5F5F5]">
            {stocks.length}
          </p>
          <p className="mt-1 text-[11px] text-[#888888]">
            Unique stock tickers tracked in your portfolio
          </p>
        </div>

        <div className="rounded-2xl border border-[#222222] bg-[#111111] p-5 shadow-xs">
          <div className="flex items-center justify-between text-[#888888] mb-2">
            <span className="text-xs font-semibold">Total Shares</span>
            <TrendingUp className="h-4 w-4 text-[#C4A77D]" />
          </div>
          <p className="font-mono text-2xl font-bold text-[#F5F5F5]">
            {totalShares.toLocaleString()}
          </p>
          <p className="mt-1 text-[11px] text-[#888888]">
            Cumulative quantity held
          </p>
        </div>

        <div className="rounded-2xl border border-[#222222] bg-[#111111] p-5 shadow-xs">
          <div className="flex items-center justify-between text-[#888888] mb-2">
            <span className="text-xs font-semibold">Transaction Logs</span>
            <History className="h-4 w-4 text-[#C4A77D]" />
          </div>
          <p className="font-mono text-2xl font-bold text-[#F5F5F5]">
            {transactions.length}
          </p>
          <p className="mt-1 text-[11px] text-[#888888]">
            Audit history ledger records
          </p>
        </div>

      </div>

      {/* Main Form & Live Holdings Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT: Update Stock / Transaction Logger (5 cols on lg) */}
        <div className="lg:col-span-5 rounded-2xl border border-[#222222] bg-[#111111] p-6 shadow-xs space-y-5">
          
          <div className="flex items-center justify-between border-b border-[#1F1F1F] pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#C4A77D]/20 text-[#C4A77D]">
                <PlusCircle className="h-4 w-4" />
              </div>
              <h3 className="font-serif text-sm font-bold text-[#F5F5F5]">
                Update Stock / Log Transaction
              </h3>
            </div>
            <span className="rounded bg-[#1A1A1A] border border-[#2A2A2A] px-2 py-0.5 text-[10px] font-mono text-[#888888]">
              Auto-AVR
            </span>
          </div>

          {/* Feedback Messages */}
          {successMessage && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 text-xs text-emerald-300 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 text-xs text-rose-300 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleLogTransaction} className="space-y-4">
            
            {/* Ticker Symbol Input & Quick Chips */}
            <div>
              <label className="block text-xs font-semibold text-[#A3A3A3] mb-1.5">
                Stock Ticker Symbol
              </label>
              <input
                id="stock-ticker-input"
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="e.g. AAPL, NVDA, TSLA"
                className="w-full rounded-xl border border-[#262626] bg-[#0A0A0A] p-2.5 text-xs text-[#F5F5F5] font-mono uppercase tracking-wider focus:border-[#C4A77D] focus:outline-none"
                required
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {popularTickers.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTicker(t)}
                    className={`rounded-lg px-2 py-0.5 text-[10px] font-mono transition-colors cursor-pointer ${
                      ticker === t
                        ? 'bg-[#C4A77D] text-[#0A0A0A] font-bold'
                        : 'border border-[#262626] bg-[#141414] text-[#A3A3A3] hover:border-[#333333] hover:text-[#FFFFFF]'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Type Toggle: BUY vs SELL */}
            <div>
              <label className="block text-xs font-semibold text-[#A3A3A3] mb-1.5">
                Transaction Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  id="tx-type-buy-btn"
                  onClick={() => setType('BUY')}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition-all cursor-pointer ${
                    type === 'BUY'
                      ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400'
                      : 'border border-[#262626] bg-[#141414] text-[#888888] hover:text-[#E5E5E5]'
                  }`}
                >
                  <ArrowUpRight className="h-4 w-4" />
                  BUY (Accumulate)
                </button>
                <button
                  type="button"
                  id="tx-type-sell-btn"
                  onClick={() => setType('SELL')}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition-all cursor-pointer ${
                    type === 'SELL'
                      ? 'bg-rose-600 text-white shadow-sm ring-1 ring-rose-400'
                      : 'border border-[#262626] bg-[#141414] text-[#888888] hover:text-[#E5E5E5]'
                  }`}
                >
                  <ArrowDownRight className="h-4 w-4" />
                  SELL (Take Profit)
                </button>
              </div>
            </div>

            {/* Quantity and Price Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#A3A3A3] mb-1.5">
                  Shares Quantity
                </label>
                <input
                  id="stock-qty-input"
                  type="number"
                  step="any"
                  min="0.0001"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full rounded-xl border border-[#262626] bg-[#0A0A0A] p-2.5 text-xs text-[#F5F5F5] font-mono focus:border-[#C4A77D] focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#A3A3A3] mb-1.5">
                  Price per Share ($)
                </label>
                <input
                  id="stock-price-input"
                  type="number"
                  step="any"
                  min="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full rounded-xl border border-[#262626] bg-[#0A0A0A] p-2.5 text-xs text-[#F5F5F5] font-mono focus:border-[#C4A77D] focus:outline-none"
                  required
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-[#A3A3A3] mb-1.5">
                Trade Notes / Context (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. DCA on dip, earnings breakout, quarterly rebalance"
                className="w-full rounded-xl border border-[#262626] bg-[#0A0A0A] p-2.5 text-xs text-[#E5E5E5] focus:border-[#C4A77D] focus:outline-none"
              />
            </div>

            {/* Live Average Cost Mathematical Preview Callout */}
            {cleanTicker && numQty > 0 && numPrice > 0 && (
              <div className="rounded-xl border border-[#C4A77D]/30 bg-[#161616] p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#C4A77D] flex items-center gap-1.5">
                    <Calculator className="h-3.5 w-3.5" />
                    Calculated AVR Cost Impact:
                  </span>
                  <span className="font-mono text-[11px] text-[#888888]">
                    {existingHolding ? 'Updating Position' : 'New Position'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-[#262626]">
                  <div>
                    <span className="text-[10px] text-[#888888] block">Current AVR</span>
                    <span className="font-mono text-xs font-bold text-[#E5E5E5]">
                      {existingHolding ? `$${safeToFixed(existingHolding.average_cost, 2)}` : '$0.00'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#888888] block">Tx Value</span>
                    <span className="font-mono text-xs font-bold text-[#E5E5E5]">
                      ${safeToFixed(numQty * numPrice, 2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#C4A77D] block font-semibold">New AVR Cost</span>
                    <span className="font-mono text-xs font-bold text-[#C4A77D]">
                      ${safeToFixed(previewNewAvg, 2)}
                    </span>
                  </div>
                </div>

                <p className="text-[10px] font-mono text-[#888888] pt-1 leading-tight">
                  Formula: AVR = Total Invested ($) / Total Quantity ({previewNewQty} shs)
                </p>
              </div>
            )}

            <button
              type="submit"
              id="log-transaction-submit-btn"
              disabled={submitting || !cleanTicker}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#C4A77D] hover:bg-[#D4B78D] px-4 py-3 text-xs font-bold text-[#0A0A0A] shadow-md transition-all disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#0A0A0A] border-t-transparent" />
              ) : (
                <TrendingUp className="h-4 w-4" />
              )}
              <span>Save Transaction to Ledger</span>
            </button>

          </form>

        </div>

        {/* RIGHT: Live Stock Holdings Table (7 cols on lg) */}
        <div className="lg:col-span-7 space-y-4">
          
          <div className="rounded-2xl border border-[#222222] bg-[#111111] p-6 shadow-xs space-y-4">
            
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#1F1F1F] pb-3">
              <div>
                <h3 className="font-serif text-sm font-bold text-[#F5F5F5]">
                  Active Portfolio Holdings
                </h3>
                <p className="text-xs text-[#888888]">
                  Live dollar-weighted average cost ledger synced in real-time
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  id="download-portfolio-report-btn"
                  onClick={() => setIsReportModalOpen(true)}
                  title="Download print-ready PDF statement of holdings & performance"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#C4A77D]/40 bg-[#C4A77D]/10 px-3 py-1.5 text-xs font-semibold text-[#C4A77D] hover:bg-[#C4A77D]/20 transition-colors cursor-pointer"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  <span>Download Report</span>
                </button>

                {stocks.length > 0 && onOpenBackupModal && (
                  <button
                    onClick={onOpenBackupModal}
                    title="Export holdings to Google Sheets"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors cursor-pointer"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    <span>Drive Backup</span>
                  </button>
                )}

                {stocks.length === 0 && (
                  <button
                    onClick={handleSeedPortfolio}
                    disabled={seeding}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#C4A77D]/40 bg-[#C4A77D]/10 px-3 py-1.5 text-xs font-semibold text-[#C4A77D] hover:bg-[#C4A77D]/20 transition-colors cursor-pointer"
                  >
                    {seeding ? (
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#C4A77D] border-t-transparent" />
                    ) : (
                      <FolderPlus className="h-3.5 w-3.5" />
                    )}
                    Load Sample Portfolio
                  </button>
                )}
              </div>
            </div>

            {/* Holdings Table */}
            {stocks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#222222] p-8 text-center space-y-3">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[#181818] text-[#888888]">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[#E5E5E5]">No Stock Holdings Yet</p>
                  <p className="text-xs text-[#888888] max-w-sm mx-auto">
                    Use the form on the left to record your first stock purchase, or load our sample tech portfolio.
                  </p>
                </div>
                <button
                  onClick={handleSeedPortfolio}
                  disabled={seeding}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#C4A77D] px-4 py-2 text-xs font-bold text-[#0A0A0A] hover:bg-[#D4B78D] transition-colors cursor-pointer"
                >
                  <FolderPlus className="h-4 w-4" />
                  Load Sample Tech Portfolio
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#222222] text-[#888888] font-mono text-[11px]">
                      <th className="pb-2.5 font-semibold">TICKER</th>
                      <th className="pb-2.5 font-semibold">SHARES</th>
                      <th className="pb-2.5 font-semibold">AVG COST (AVR)</th>
                      <th className="pb-2.5 font-semibold">COST BASIS</th>
                      <th className="pb-2.5 font-semibold text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1F1F1F]">
                    {stocks.map((s) => (
                      <tr key={s.ticker} className="group hover:bg-[#141414]/60 transition-colors">
                        
                        <td className="py-3 font-mono font-bold text-[#F5F5F5] text-sm">
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded bg-[#1C1C1C] border border-[#2D2D2D] text-xs text-[#C4A77D]">
                              $
                            </span>
                            <span>{s.ticker}</span>
                          </div>
                        </td>

                        <td className="py-3 font-mono text-[#E5E5E5]">
                          {s.total_quantity.toLocaleString()}
                        </td>

                        <td className="py-3 font-mono font-semibold text-[#C4A77D]">
                          ${safeToFixed(s.average_cost, 2)}
                        </td>

                        <td className="py-3 font-mono text-[#D4D4D4]">
                          ${(safeNumber(s.total_invested) || (safeNumber(s.total_quantity) * safeNumber(s.average_cost))).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>

                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            
                            {/* Consult Journal Button */}
                            <button
                              onClick={() => onAskJournalForTicker(s.ticker, s)}
                              title="Reflect in Journal about this holding"
                              className="inline-flex items-center gap-1 rounded-lg border border-[#2A2A2A] bg-[#161616] px-2 py-1 text-[11px] font-semibold text-[#C4A77D] hover:bg-[#222222] transition-colors cursor-pointer"
                            >
                              <Sparkles className="h-3 w-3" />
                              <span className="hidden sm:inline">Journal</span>
                            </button>

                            {/* P&L Simulator Button */}
                            <button
                              onClick={() => onOpenSimulatorForTicker(s.ticker)}
                              title="Simulate Profit/Loss"
                              className="inline-flex items-center gap-1 rounded-lg border border-[#2A2A2A] bg-[#161616] px-2 py-1 text-[11px] font-semibold text-[#A3A3A3] hover:text-[#FFFFFF] hover:bg-[#222222] transition-colors cursor-pointer"
                            >
                              <Calculator className="h-3 w-3" />
                              <span className="hidden sm:inline">Sim</span>
                            </button>

                            {/* Delete Position */}
                            <button
                              onClick={() => handleDeletePosition(s.ticker)}
                              title="Delete Position"
                              className="p-1 rounded-lg text-[#666666] hover:text-rose-400 hover:bg-[#201010] transition-colors cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>

                          </div>
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          </div>

          {/* Transaction History Ledger */}
          <div className="rounded-2xl border border-[#222222] bg-[#111111] p-6 shadow-xs space-y-4">
            
            <div className="flex items-center justify-between border-b border-[#1F1F1F] pb-3">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-[#C4A77D]" />
                <h3 className="font-serif text-sm font-bold text-[#F5F5F5]">
                  Transaction Audit Ledger
                </h3>
              </div>

              {/* Filter Chips */}
              <div className="flex items-center gap-1 bg-[#0A0A0A] p-1 rounded-lg border border-[#222222]">
                {(['ALL', 'BUY', 'SELL'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setActiveLedgerFilter(mode)}
                    className={`px-2.5 py-0.5 text-[10px] font-mono font-semibold rounded transition-colors cursor-pointer ${
                      activeLedgerFilter === mode
                        ? 'bg-[#C4A77D] text-[#0A0A0A]'
                        : 'text-[#888888] hover:text-[#E5E5E5]'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {filteredTransactions.length === 0 ? (
              <p className="text-xs text-[#666666] py-4 text-center">
                No transactions recorded under this filter.
              </p>
            ) : (
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {filteredTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between rounded-xl border border-[#222222] bg-[#0D0D0D] p-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-md font-mono font-bold text-[10px] ${
                          tx.type === 'BUY'
                            ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-400'
                            : 'bg-rose-950/60 border border-rose-500/40 text-rose-400'
                        }`}
                      >
                        {tx.type === 'BUY' ? 'B' : 'S'}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[#F5F5F5]">{tx.ticker}</span>
                          <span className="text-[11px] text-[#A3A3A3]">
                            {tx.quantity} shs @ ${safeToFixed(tx.price, 2)}
                          </span>
                        </div>
                        {tx.notes && (
                          <p className="text-[10px] text-[#666666] italic">{tx.notes}</p>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-bold text-[#E5E5E5] block">
                        ${safeToFixed(tx.totalAmount || (tx.quantity * tx.price), 2)}
                      </span>
                      <span className="text-[10px] font-mono text-[#666666]">
                        {new Date(tx.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>

        </div>

      </div>

      {/* Printable / PDF Portfolio Report Modal */}
      <PortfolioReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        user={user}
        stocks={stocks}
        transactions={transactions}
      />

    </div>
  );
};
