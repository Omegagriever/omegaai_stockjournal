import React, { useState } from 'react';
import {
  X,
  Printer,
  Download,
  FileDown,
  Calendar,
  Layers,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  PieChart,
  History,
  FileText
} from 'lucide-react';
import { StockHolding, Transaction, UserProfile } from '../types';
import { safeToFixed, safeNumber } from '../lib/formatters';

interface PortfolioReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  stocks: StockHolding[];
  transactions: Transaction[];
}

export const PortfolioReportModal: React.FC<PortfolioReportModalProps> = ({
  isOpen,
  onClose,
  user,
  stocks,
  transactions,
}) => {
  const [includeTransactions, setIncludeTransactions] = useState<boolean>(true);
  const [includeAllocation, setIncludeAllocation] = useState<boolean>(true);
  const [customNotes, setCustomNotes] = useState<string>('');
  const [reportDate] = useState<string>(new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }));

  if (!isOpen) return null;

  // Aggregate Portfolio Totals
  const totalCostBasis = stocks.reduce((acc, s) => acc + (s.total_invested || (s.total_quantity * s.average_cost)), 0);
  const totalCurrentValue = stocks.reduce((acc, s) => {
    const price = s.current_price || s.average_cost;
    return acc + (s.total_quantity * price);
  }, 0);
  const totalUnrealizedPnl = totalCurrentValue - totalCostBasis;
  const totalReturnPct = totalCostBasis > 0 ? (totalUnrealizedPnl / totalCostBasis) * 100 : 0;
  const totalShares = stocks.reduce((acc, s) => acc + s.total_quantity, 0);

  // Sorted Transactions (Most recent first)
  const recentTransactions = [...transactions].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const handleTriggerPrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/80 backdrop-blur-sm print:p-0 print:bg-white print:static print:inset-auto">
      
      {/* Modal Container */}
      <div 
        id="portfolio-report-modal"
        className="relative w-full max-w-5xl rounded-2xl border border-[#2A2A2A] bg-[#141414] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:border-none print:shadow-none print:bg-white print:w-full print:rounded-none"
      >
        
        {/* Modal Top Bar (Hidden on Print) */}
        <div className="no-print flex items-center justify-between border-b border-[#222222] bg-[#181818] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#C4A77D]/20 text-[#C4A77D]">
              <FileDown className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#F5F5F5] font-serif flex items-center gap-2">
                <span>Portfolio & Performance Report</span>
                <span className="text-[11px] font-mono font-normal px-2 py-0.5 rounded-full bg-[#262626] text-[#C4A77D]">
                  PDF / Print Ready
                </span>
              </h2>
              <p className="text-xs text-[#888888]">
                Audit-grade statement of holdings, cost basis, and performance summary
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="report-print-btn"
              onClick={handleTriggerPrint}
              className="inline-flex items-center gap-2 rounded-xl bg-[#C4A77D] hover:bg-[#D4B78D] text-[#0A0A0A] px-4 py-2 text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>Print / Save PDF</span>
            </button>

            <button
              onClick={onClose}
              className="rounded-lg p-2 text-[#888888] hover:bg-[#222222] hover:text-[#E5E5E5] transition-colors cursor-pointer"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Quick Report Customizer Controls (Hidden on Print) */}
        <div className="no-print bg-[#111111] border-b border-[#222222] px-6 py-3 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-4 text-[#A3A3A3]">
            <label className="flex items-center gap-2 cursor-pointer hover:text-[#F5F5F5] transition-colors">
              <input
                type="checkbox"
                checked={includeAllocation}
                onChange={(e) => setIncludeAllocation(e.target.checked)}
                className="rounded border-[#333333] bg-[#222222] text-[#C4A77D] focus:ring-[#C4A77D]/50"
              />
              <span>Include Capital Allocation Weights</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer hover:text-[#F5F5F5] transition-colors">
              <input
                type="checkbox"
                checked={includeTransactions}
                onChange={(e) => setIncludeTransactions(e.target.checked)}
                className="rounded border-[#333333] bg-[#222222] text-[#C4A77D] focus:ring-[#C4A77D]/50"
              />
              <span>Include Transaction History ({transactions.length} orders)</span>
            </label>
          </div>

          <div className="flex items-center gap-2 text-[#888888] text-[11px] font-mono">
            <span>Tip: In print dialog, select &quot;Save as PDF&quot;</span>
          </div>
        </div>

        {/* PRINTABLE DOCUMENT BODY */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-[#0D0D0D] print:p-0 print:bg-white print:overflow-visible text-[#E5E5E5] print:text-black">
          
          <div 
            id="printable-portfolio-report" 
            className="mx-auto max-w-4xl rounded-xl bg-[#141414] border border-[#222222] p-8 space-y-8 print:p-0 print:border-none print:bg-white print:text-black print:max-w-none print:shadow-none"
          >
            
            {/* 1. Report Header */}
            <div className="border-b border-[#2A2A2A] pb-6 print:border-b-2 print:border-black flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-serif text-2xl font-black tracking-wider text-[#C4A77D] print:text-black">
                    OMEGA
                  </span>
                  <span className="text-xs font-mono uppercase tracking-widest text-[#888888] print:text-gray-600">
                    Portfolio & Cost-Basis Report
                  </span>
                </div>
                <h1 className="text-xl font-bold font-serif text-[#F5F5F5] print:text-black mt-1">
                  Executive Holdings & Performance Statement
                </h1>
                <p className="text-xs text-[#888888] print:text-gray-600 mt-0.5">
                  Official dollar-weighted average cost accounting & asset valuation
                </p>
              </div>

              <div className="text-left sm:text-right text-xs space-y-1 font-mono">
                <div className="text-[#E5E5E5] print:text-black font-bold">
                  Investor: {user.displayName || user.email || 'Verified Account'}
                </div>
                <div className="text-[#888888] print:text-gray-600">
                  Statement Date: {reportDate}
                </div>
                <div className="text-[#888888] print:text-gray-600">
                  Base Currency: USD ($)
                </div>
              </div>
            </div>

            {/* 2. Executive Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 print:gap-3 print:grid-cols-4">
              
              <div className="rounded-xl border border-[#262626] bg-[#181818] p-4 print:bg-gray-50 print:border-gray-300">
                <div className="text-[11px] font-semibold text-[#888888] print:text-gray-600 uppercase tracking-wider">
                  Total Cost Basis
                </div>
                <div className="font-mono text-xl sm:text-2xl font-bold text-[#F5F5F5] print:text-black mt-1">
                  ${totalCostBasis.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-[#888888] print:text-gray-500 mt-1">
                  Dollar-weighted invested
                </div>
              </div>

              <div className="rounded-xl border border-[#262626] bg-[#181818] p-4 print:bg-gray-50 print:border-gray-300">
                <div className="text-[11px] font-semibold text-[#888888] print:text-gray-600 uppercase tracking-wider">
                  Est. Portfolio Value
                </div>
                <div className="font-mono text-xl sm:text-2xl font-bold text-[#F5F5F5] print:text-black mt-1">
                  ${totalCurrentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-[#888888] print:text-gray-500 mt-1">
                  Based on current market
                </div>
              </div>

              <div className="rounded-xl border border-[#262626] bg-[#181818] p-4 print:bg-gray-50 print:border-gray-300">
                <div className="text-[11px] font-semibold text-[#888888] print:text-gray-600 uppercase tracking-wider">
                  Net Unrealized P&amp;L
                </div>
                <div className={`font-mono text-xl sm:text-2xl font-bold mt-1 ${
                  totalUnrealizedPnl >= 0 
                    ? 'text-emerald-400 print:text-green-700' 
                    : 'text-rose-400 print:text-red-700'
                }`}>
                  {totalUnrealizedPnl >= 0 ? '+' : ''}${totalUnrealizedPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className={`text-[10px] font-bold mt-1 ${
                  totalReturnPct >= 0 
                    ? 'text-emerald-400 print:text-green-700' 
                    : 'text-rose-400 print:text-red-700'
                }`}>
                  {totalReturnPct >= 0 ? '+' : ''}{safeToFixed(totalReturnPct, 2)}% Overall Return
                </div>
              </div>

              <div className="rounded-xl border border-[#262626] bg-[#181818] p-4 print:bg-gray-50 print:border-gray-300">
                <div className="text-[11px] font-semibold text-[#888888] print:text-gray-600 uppercase tracking-wider">
                  Positions &amp; Volume
                </div>
                <div className="font-mono text-xl sm:text-2xl font-bold text-[#F5F5F5] print:text-black mt-1">
                  {stocks.length} Assets
                </div>
                <div className="text-[10px] text-[#888888] print:text-gray-500 mt-1">
                  {totalShares.toLocaleString()} Total Shares
                </div>
              </div>

            </div>

            {/* 3. Detailed Holdings Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-[#222222] pb-2 print:border-b print:border-black">
                <h3 className="font-serif text-sm font-bold text-[#F5F5F5] print:text-black uppercase tracking-wider flex items-center gap-2">
                  <Layers className="h-4 w-4 text-[#C4A77D] print:text-black" />
                  <span>Active Stock Holdings &amp; Cost-Basis Summary</span>
                </h3>
                <span className="text-xs font-mono text-[#888888] print:text-gray-600">
                  {stocks.length} positions recorded
                </span>
              </div>

              {stocks.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#888888] border border-dashed border-[#262626] rounded-xl print:border-gray-300">
                  No active stock holdings currently in portfolio.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#2A2A2A] text-[#888888] font-mono text-[11px] print:border-b-2 print:border-black print:text-black">
                        <th className="py-2.5 font-bold">TICKER</th>
                        <th className="py-2.5 font-bold text-right">SHARES</th>
                        <th className="py-2.5 font-bold text-right">AVG COST (AVR)</th>
                        <th className="py-2.5 font-bold text-right">MARKET PRICE</th>
                        <th className="py-2.5 font-bold text-right">TOTAL INVESTED</th>
                        <th className="py-2.5 font-bold text-right">EST. VALUE</th>
                        {includeAllocation && <th className="py-2.5 font-bold text-right">WEIGHT</th>}
                        <th className="py-2.5 font-bold text-right">UNREALIZED P&amp;L</th>
                        <th className="py-2.5 font-bold text-right">RETURN %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1F1F1F] print:divide-y print:divide-gray-200">
                      {stocks.map((stock) => {
                        const curPrice = stock.current_price || stock.average_cost;
                        const invested = stock.total_invested || (stock.total_quantity * stock.average_cost);
                        const val = stock.total_quantity * curPrice;
                        const pnl = val - invested;
                        const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
                        const weight = totalCostBasis > 0 ? (invested / totalCostBasis) * 100 : 0;

                        return (
                          <tr key={stock.ticker} className="hover:bg-[#181818]/50 print:hover:bg-transparent">
                            <td className="py-2.5 font-mono font-bold text-[#F5F5F5] print:text-black">
                              ${stock.ticker}
                            </td>
                            <td className="py-2.5 font-mono text-right text-[#D4D4D4] print:text-black">
                              {stock.total_quantity.toLocaleString()}
                            </td>
                            <td className="py-2.5 font-mono text-right text-[#C4A77D] print:text-black font-semibold">
                              ${safeToFixed(stock.average_cost, 2)}
                            </td>
                            <td className="py-2.5 font-mono text-right text-[#D4D4D4] print:text-black">
                              ${safeToFixed(curPrice, 2)}
                            </td>
                            <td className="py-2.5 font-mono text-right text-[#E5E5E5] print:text-black">
                              ${safeToFixed(invested, 2)}
                            </td>
                            <td className="py-2.5 font-mono text-right text-[#E5E5E5] print:text-black font-semibold">
                              ${safeToFixed(val, 2)}
                            </td>
                            {includeAllocation && (
                              <td className="py-2.5 font-mono text-right text-[#888888] print:text-gray-700">
                                {safeToFixed(weight, 1)}%
                              </td>
                            )}
                            <td className={`py-2.5 font-mono text-right font-semibold ${
                              pnl >= 0 
                                ? 'text-emerald-400 print:text-green-700' 
                                : 'text-rose-400 print:text-red-700'
                            }`}>
                              {pnl >= 0 ? '+' : ''}${safeToFixed(pnl, 2)}
                            </td>
                            <td className={`py-2.5 font-mono text-right font-bold ${
                              pnlPct >= 0 
                                ? 'text-emerald-400 print:text-green-700' 
                                : 'text-rose-400 print:text-red-700'
                            }`}>
                              {pnlPct >= 0 ? '+' : ''}{safeToFixed(pnlPct, 2)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-[#2A2A2A] font-mono text-xs font-bold text-[#F5F5F5] print:border-t-2 print:border-black print:text-black">
                        <td className="py-3">TOTALS</td>
                        <td className="py-3 text-right">{totalShares.toLocaleString()}</td>
                        <td className="py-3 text-right text-[#888888] print:text-gray-500">-</td>
                        <td className="py-3 text-right text-[#888888] print:text-gray-500">-</td>
                        <td className="py-3 text-right">${safeToFixed(totalCostBasis, 2)}</td>
                        <td className="py-3 text-right">${safeToFixed(totalCurrentValue, 2)}</td>
                        {includeAllocation && <td className="py-3 text-right">100.0%</td>}
                        <td className={`py-3 text-right ${totalUnrealizedPnl >= 0 ? 'text-emerald-400 print:text-green-700' : 'text-rose-400 print:text-red-700'}`}>
                          {totalUnrealizedPnl >= 0 ? '+' : ''}${safeToFixed(totalUnrealizedPnl, 2)}
                        </td>
                        <td className={`py-3 text-right ${totalReturnPct >= 0 ? 'text-emerald-400 print:text-green-700' : 'text-rose-400 print:text-red-700'}`}>
                          {totalReturnPct >= 0 ? '+' : ''}{safeToFixed(totalReturnPct, 2)}%
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* 4. Optional: Transaction History Section */}
            {includeTransactions && transactions.length > 0 && (
              <div className="space-y-3 page-break-before print:pt-4">
                <div className="flex items-center justify-between border-b border-[#222222] pb-2 print:border-b print:border-black">
                  <h3 className="font-serif text-sm font-bold text-[#F5F5F5] print:text-black uppercase tracking-wider flex items-center gap-2">
                    <History className="h-4 w-4 text-[#C4A77D] print:text-black" />
                    <span>Transaction History &amp; Execution Audit Log</span>
                  </h3>
                  <span className="text-xs font-mono text-[#888888] print:text-gray-600">
                    {transactions.length} total events
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#2A2A2A] text-[#888888] font-mono text-[11px] print:border-b-2 print:border-black print:text-black">
                        <th className="py-2 font-bold">DATE &amp; TIME</th>
                        <th className="py-2 font-bold">TYPE</th>
                        <th className="py-2 font-bold">TICKER</th>
                        <th className="py-2 font-bold text-right">QUANTITY</th>
                        <th className="py-2 font-bold text-right">PRICE</th>
                        <th className="py-2 font-bold text-right">TOTAL AMOUNT</th>
                        <th className="py-2 font-bold text-right">AVG COST AFTER</th>
                        <th className="py-2 font-bold">NOTES</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1F1F1F] print:divide-y print:divide-gray-200">
                      {recentTransactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-[#181818]/50 print:hover:bg-transparent text-[11px]">
                          <td className="py-2 text-[#888888] print:text-gray-700 font-mono">
                            {tx.timestamp ? new Date(tx.timestamp).toLocaleString() : '-'}
                          </td>
                          <td className="py-2 font-bold">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                              tx.type === 'BUY' 
                                ? 'bg-emerald-500/10 text-emerald-400 print:text-black print:bg-gray-100' 
                                : 'bg-rose-500/10 text-rose-400 print:text-black print:bg-gray-100'
                            }`}>
                              {tx.type}
                            </span>
                          </td>
                          <td className="py-2 font-mono font-bold text-[#F5F5F5] print:text-black">
                            ${tx.ticker}
                          </td>
                          <td className="py-2 font-mono text-right text-[#D4D4D4] print:text-black">
                            {tx.quantity.toLocaleString()}
                          </td>
                          <td className="py-2 font-mono text-right text-[#D4D4D4] print:text-black">
                            ${safeToFixed(tx.price, 2)}
                          </td>
                          <td className="py-2 font-mono text-right text-[#E5E5E5] print:text-black font-semibold">
                            ${safeToFixed(tx.totalAmount, 2)}
                          </td>
                          <td className="py-2 font-mono text-right text-[#C4A77D] print:text-black">
                            {tx.calculatedAvgCostAfter ? `$${safeToFixed(tx.calculatedAvgCostAfter, 2)}` : '-'}
                          </td>
                          <td className="py-2 text-[#888888] print:text-gray-600 max-w-xs truncate">
                            {tx.notes || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 5. Custom Notes (if any) */}
            {customNotes && (
              <div className="rounded-xl border border-[#222222] bg-[#181818] p-4 text-xs space-y-1 print:bg-gray-50 print:border-gray-300">
                <div className="font-bold text-[#C4A77D] print:text-black uppercase text-[10px] tracking-wider">
                  Investor Notes / Commentary
                </div>
                <p className="text-[#D4D4D4] print:text-black whitespace-pre-line">
                  {customNotes}
                </p>
              </div>
            )}

            {/* 6. Legal & Audit Footer */}
            <div className="border-t border-[#262626] pt-4 print:border-t print:border-gray-400 text-[10px] text-[#666666] print:text-gray-500 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                Generated by OMEGA Financial Intelligence • Dollar-Weighted Cost Basis Protocol
              </div>
              <div className="font-mono">
                Document ID: OMEGA-REP-{Date.now().toString(36).toUpperCase()}
              </div>
            </div>

          </div>

        </div>

        {/* Modal Bottom Bar / Action Footer (Hidden on Print) */}
        <div className="no-print border-t border-[#222222] bg-[#181818] px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-xs text-[#888888]">
            Need physical records or PDF export? Click below to open your browser&apos;s high-res print dialog.
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#888888] hover:text-[#E5E5E5] hover:bg-[#222222] rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleTriggerPrint}
              className="inline-flex items-center gap-2 rounded-xl bg-[#C4A77D] hover:bg-[#D4B78D] text-[#0A0A0A] px-5 py-2 text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>Print / Download PDF</span>
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
