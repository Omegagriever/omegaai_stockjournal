export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TransactionType = 'BUY' | 'SELL';

export interface Transaction {
  id: string;
  ticker: string;
  type: TransactionType;
  quantity: number;
  price: number;
  timestamp: string;
  totalAmount: number;
  calculatedAvgCostAfter?: number;
  notes?: string;
}

export interface StockHolding {
  ticker: string;
  total_quantity: number;
  average_cost: number;
  total_invested: number;
  last_updated: string;
  // Estimated market attributes for enriched analytics
  current_price?: number;
  companyName?: string;
}

export interface DetectedTrade {
  ticker: string;
  type: TransactionType;
  quantity: number;
  price: number;
  notes?: string;
}

export interface JournalEntry {
  id: string;
  prompt: string;
  response: string;
  summary?: string;
  stockContextUsed?: string[];
  timestamp: string;
  calculations?: {
    ticker?: string;
    action?: string;
    calculatedAvgCost?: number;
    simulatedProfitLoss?: number;
    notes?: string;
    detectedTrade?: DetectedTrade;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  summary?: string;
  calculations?: {
    ticker?: string;
    action?: string;
    calculatedAvgCost?: number;
    simulatedProfitLoss?: number;
    notes?: string;
    detectedTrade?: DetectedTrade;
  };
}

export interface GeminiChatResponse {
  reply: string;
  summary?: string;
  calculations?: {
    ticker?: string;
    action?: string;
    calculatedAvgCost?: number;
    simulatedProfitLoss?: number;
    notes?: string;
    detectedTrade?: DetectedTrade;
  };
  modelUsed: string;
  latencyMs: number;
  attempts?: Array<{ model: string; success: boolean; latencyMs: number; error?: string }>;
}

export interface StockSimulationQuery {
  ticker: string;
  targetPrice: number;
  sharesToSell?: number;
  customHoldings?: StockHolding[];
}

export interface SimulationResult {
  ticker: string;
  shares: number;
  avgCost: number;
  targetPrice: number;
  proceeds: number;
  costBasis: number;
  profitLoss: number;
  percentageGain: number;
  analysis: string;
}

export interface GoogleBackupRecord {
  id: string;
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
  timestamp: string;
  stocksCount: number;
  transactionsCount: number;
  journalCount: number;
}
