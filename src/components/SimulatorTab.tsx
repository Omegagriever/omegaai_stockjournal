import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  Sparkles, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight, 
  DollarSign, 
  Percent, 
  Send,
  Sliders,
  Layers,
  CheckCircle2
} from 'lucide-react';
import { StockHolding, UserProfile } from '../types';
import { safeToFixed, safeNumber, formatCurrency, formatPercent } from '../lib/formatters';

interface SimulatorTabProps {
  user: UserProfile;
  stocks: StockHolding[];
  initialTicker?: string;
  onSendToJournal: (prompt: string) => void;
}

export const SimulatorTab: React.FC<SimulatorTabProps> = ({
  user,
  stocks,
  initialTicker,
  onSendToJournal,
}) => {
  const [selectedTicker, setSelectedTicker] = useState<string>(
    initialTicker || (stocks.length > 0 ? stocks[0].ticker : 'AAPL')
  );
  const [sharesToSell, setSharesToSell] = useState<number>(10);
  const [avgCost, setAvgCost] = useState<number>(150);
  const [targetPrice, setTargetPrice] = useState<number>(200);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState<boolean>(false);

  // Update parameters when selected ticker changes
  useEffect(() => {
    const holding = stocks.find((s) => s.ticker === selectedTicker);
    if (holding) {
      setSharesToSell(holding.total_quantity || 10);
      setAvgCost(holding.average_cost || 150);
      setTargetPrice(Math.round(holding.average_cost * 1.3 * 100) / 100 || 200);
    }
  }, [selectedTicker, stocks]);

  // If initialTicker changes from props
  useEffect(() => {
    if (initialTicker) {
      setSelectedTicker(initialTicker);
    }
  }, [initialTicker]);

  // Mathematical outputs
  const grossProceeds = sharesToSell * targetPrice;
  const totalCostBasis = sharesToSell * avgCost;
  const netProfitLoss = grossProceeds - totalCostBasis;
  const roiPercentage = totalCostBasis > 0 ? (netProfitLoss / totalCostBasis) * 100 : 0;
  const isProfit = netProfitLoss >= 0;

  const handleSimulateWithAi = async () => {
    setLoadingAi(true);
    setAiAnalysis(null);

    const holding = stocks.find((s) => s.ticker === selectedTicker);

    try {
      const response = await fetch('/api/gemini/simulate-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: selectedTicker,
          targetPrice,
          shares: sharesToSell,
          holding: holding || {
            ticker: selectedTicker,
            total_quantity: sharesToSell,
            average_cost: avgCost,
            total_invested: totalCostBasis,
            last_updated: new Date().toISOString(),
          },
        }),
      });

      if (!response.ok) throw new Error('Simulation failed');
      const data = await response.json();
      setAiAnalysis(data.analysis);
    } catch (err) {
      console.error(err);
      setAiAnalysis('Unable to generate AI trade commentary right now.');
    } finally {
      setLoadingAi(false);
    }
  };

  const handleTransferToJournal = () => {
    const promptText = `I am running a profit/loss exit simulation for ${selectedTicker}:
- Position Size: ${sharesToSell} shares
- Dollar-Weighted Average Cost: $${safeToFixed(avgCost, 2)} ($${safeToFixed(totalCostBasis, 2)} total cost basis)
- Target Exit Price: $${safeToFixed(targetPrice, 2)}
- Projected Net ${isProfit ? 'Profit' : 'Loss'}: $${safeToFixed(netProfitLoss, 2)} (${safeToFixed(roiPercentage, 2)}%)

What is your risk/reward critique and should I scale out in tranches?`;

    onSendToJournal(promptText);
  };

  const handlePercentageShares = (pct: number) => {
    const holding = stocks.find((s) => s.ticker === selectedTicker);
    const maxShares = holding ? holding.total_quantity : 100;
    setSharesToSell(Math.max(1, Math.round((maxShares * pct) / 100)));
  };

  return (
    <div className="space-y-8">
      
      {/* Overview Banner */}
      <div className="rounded-2xl border border-[#222222] bg-[#111111] p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#C4A77D]/15 text-[#C4A77D] border border-[#C4A77D]/30 text-xs font-bold font-mono">
                P&L
              </span>
              <h2 className="font-serif text-lg font-bold text-[#F5F5F5]">
                Real-Time Profit / Loss & Exit Price Simulator
              </h2>
            </div>
            <p className="text-xs text-[#A3A3A3] max-w-3xl">
              Model profit scenarios against your real Firestore dollar-weighted average costs. Adjust target exit prices and let Gemini 3.6 evaluate risk-reward ratios.
            </p>
          </div>
          
          <button
            onClick={handleTransferToJournal}
            className="inline-flex items-center gap-2 rounded-xl bg-[#C4A77D] px-4 py-2.5 text-xs font-bold text-[#0A0A0A] hover:bg-[#D4B78D] transition-all cursor-pointer shadow-xs shrink-0"
          >
            <Send className="h-3.5 w-3.5" />
            Transfer Simulation to Journal
          </button>
        </div>
      </div>

      {/* Main Sandbox Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Controls Column (5 cols on lg) */}
        <div className="lg:col-span-5 rounded-2xl border border-[#222222] bg-[#111111] p-6 shadow-xs space-y-5">
          
          <h3 className="font-serif text-sm font-bold text-[#F5F5F5] flex items-center gap-2">
            <Sliders className="h-4 w-4 text-[#C4A77D]" />
            Trade Scenario Parameters
          </h3>

          {/* Ticker Selector */}
          <div>
            <label className="block text-xs font-semibold text-[#A3A3A3] mb-1.5">
              Select Stock Asset
            </label>
            {stocks.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {stocks.map((s) => (
                  <button
                    key={s.ticker}
                    type="button"
                    onClick={() => setSelectedTicker(s.ticker)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-mono font-bold transition-all cursor-pointer ${
                      selectedTicker === s.ticker
                        ? 'bg-[#C4A77D] text-[#0A0A0A] ring-2 ring-[#C4A77D]/40'
                        : 'border border-[#262626] bg-[#141414] text-[#A3A3A3] hover:border-[#333333]'
                    }`}
                  >
                    ${s.ticker} ({s.total_quantity} shs)
                  </button>
                ))}
              </div>
            ) : (
              <input
                type="text"
                value={selectedTicker}
                onChange={(e) => setSelectedTicker(e.target.value.toUpperCase())}
                className="w-full rounded-xl border border-[#262626] bg-[#0A0A0A] p-2.5 text-xs font-mono text-[#F5F5F5] uppercase focus:border-[#C4A77D] focus:outline-none"
              />
            )}
          </div>

          {/* Average Cost (AVR) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[#A3A3A3]">
                Dollar-Weighted Avg Cost Basis ($)
              </label>
              <span className="text-[10px] font-mono text-[#C4A77D]">From Firestore</span>
            </div>
            <input
              type="number"
              step="any"
              value={avgCost}
              onChange={(e) => setAvgCost(parseFloat(e.target.value) || 0)}
              className="w-full rounded-xl border border-[#262626] bg-[#0A0A0A] p-2.5 text-xs font-mono text-[#F5F5F5] focus:border-[#C4A77D] focus:outline-none"
            />
          </div>

          {/* Shares to Exit */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[#A3A3A3]">
                Shares to Sell
              </label>
              <div className="flex gap-1">
                {[25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => handlePercentageShares(pct)}
                    className="rounded bg-[#1A1A1A] hover:bg-[#262626] border border-[#2A2A2A] px-1.5 py-0.5 text-[10px] font-mono text-[#A3A3A3] cursor-pointer"
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
            <input
              type="number"
              step="any"
              value={sharesToSell}
              onChange={(e) => setSharesToSell(parseFloat(e.target.value) || 0)}
              className="w-full rounded-xl border border-[#262626] bg-[#0A0A0A] p-2.5 text-xs font-mono text-[#F5F5F5] focus:border-[#C4A77D] focus:outline-none"
            />
          </div>

          {/* Target Exit Price */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[#A3A3A3]">
                Target Exit Price ($)
              </label>
              <span className="text-xs font-mono font-bold text-[#F5F5F5]">
                ${safeToFixed(targetPrice, 2)}
              </span>
            </div>
            <input
              type="number"
              step="any"
              value={targetPrice}
              onChange={(e) => setTargetPrice(parseFloat(e.target.value) || 0)}
              className="w-full rounded-xl border border-[#262626] bg-[#0A0A0A] p-2.5 text-xs font-mono text-[#F5F5F5] focus:border-[#C4A77D] focus:outline-none mb-2"
            />
            {/* Slider */}
            <input
              type="range"
              min={Math.max(1, Math.round(avgCost * 0.5))}
              max={Math.round(avgCost * 3)}
              step="0.5"
              value={targetPrice}
              onChange={(e) => setTargetPrice(parseFloat(e.target.value))}
              className="w-full accent-[#C4A77D] cursor-pointer"
            />
          </div>

          <button
            onClick={handleSimulateWithAi}
            disabled={loadingAi}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#1F1F1F] hover:bg-[#282828] border border-[#333333] px-4 py-2.5 text-xs font-semibold text-[#F5F5F5] transition-all disabled:opacity-50 cursor-pointer"
          >
            {loadingAi ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#C4A77D] border-t-transparent" />
            ) : (
              <Sparkles className="h-4 w-4 text-[#C4A77D]" />
            )}
            <span>Generate Gemini 3.6 Trade Assessment</span>
          </button>

        </div>

        {/* Results & AI Commentary Column (7 cols on lg) */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* Real-Time Mathematical Output Card */}
          <div className="rounded-2xl border border-[#222222] bg-[#111111] p-6 shadow-xs space-y-5">
            
            <div className="flex items-center justify-between border-b border-[#1F1F1F] pb-3">
              <span className="font-serif text-sm font-bold text-[#F5F5F5]">
                Quantitative Projection for ${selectedTicker}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-mono font-bold ${
                  isProfit
                    ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-950/60 text-rose-400 border border-rose-500/30'
                }`}
              >
                {isProfit ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                {isProfit ? '+' : ''}{safeToFixed(roiPercentage, 2)}% ROI
              </span>
            </div>

            {/* Major Metric: Net Realized Profit/Loss */}
            <div className="rounded-xl bg-[#0A0A0A] border border-[#222222] p-5 text-center">
              <span className="text-[11px] font-mono text-[#888888] uppercase tracking-wider block mb-1">
                Projected Net Realized {isProfit ? 'Profit' : 'Loss'}
              </span>
              <p
                className={`font-mono text-3xl sm:text-4xl font-bold ${
                  isProfit ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isProfit ? '+' : '-'}${Math.abs(netProfitLoss).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>

            {/* Financial Breakdown Table */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              
              <div className="rounded-xl border border-[#222222] bg-[#141414] p-3 text-center">
                <span className="text-[10px] text-[#888888] block">Gross Proceeds</span>
                <span className="font-mono text-sm font-bold text-[#F5F5F5]">
                  ${grossProceeds.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-[#666666] block">
                  {sharesToSell} shs × ${safeToFixed(targetPrice, 2)}
                </span>
              </div>

              <div className="rounded-xl border border-[#222222] bg-[#141414] p-3 text-center">
                <span className="text-[10px] text-[#888888] block">Total Cost Basis</span>
                <span className="font-mono text-sm font-bold text-[#F5F5F5]">
                  ${totalCostBasis.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-[#666666] block">
                  {sharesToSell} shs × ${safeToFixed(avgCost, 2)}
                </span>
              </div>

              <div className="rounded-xl border border-[#222222] bg-[#141414] p-3 text-center sm:col-span-1 col-span-2">
                <span className="text-[10px] text-[#888888] block">Profit per Share</span>
                <span className={`font-mono text-sm font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {isProfit ? '+' : '-'}${safeToFixed(Math.abs(targetPrice - avgCost), 2)}
                </span>
                <span className="text-[10px] text-[#666666] block">
                  Exit vs Average Cost
                </span>
              </div>

            </div>

          </div>

          {/* AI Commentary Card */}
          {aiAnalysis && (
            <div className="rounded-2xl border border-[#C4A77D]/30 bg-[#141414] p-6 shadow-md space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#C4A77D]" />
                <h4 className="font-serif text-sm font-bold text-[#F5F5F5]">
                  Gemini Quantitative Assessment
                </h4>
              </div>
              <div className="prose prose-invert max-w-none text-xs text-[#D4D4D4] whitespace-pre-wrap leading-relaxed">
                {aiAnalysis}
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
