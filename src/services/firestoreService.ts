import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { StockHolding, Transaction, JournalEntry, UserProfile, TransactionType } from '../types';

// Storage keys for guest mode
const GUEST_STOCKS_KEY = 'aegis_guest_stocks';
const GUEST_TX_KEY = 'aegis_guest_transactions';
const GUEST_JOURNAL_KEY = 'aegis_guest_journal';
const GUEST_DATA_CHANGE_EVENT = 'aegis_guest_data_change';

const isGuestId = (uid: string) => uid.startsWith('guest_');

function emitGuestDataChange() {
  window.dispatchEvent(new CustomEvent(GUEST_DATA_CHANGE_EVENT));
}

function getGuestStocks(): StockHolding[] {
  try {
    const raw = localStorage.getItem(GUEST_STOCKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setGuestStocks(stocks: StockHolding[]) {
  localStorage.setItem(GUEST_STOCKS_KEY, JSON.stringify(stocks));
  emitGuestDataChange();
}

function getGuestTransactions(): Transaction[] {
  try {
    const raw = localStorage.getItem(GUEST_TX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setGuestTransactions(txs: Transaction[]) {
  localStorage.setItem(GUEST_TX_KEY, JSON.stringify(txs));
  emitGuestDataChange();
}

function getGuestJournal(): JournalEntry[] {
  try {
    const raw = localStorage.getItem(GUEST_JOURNAL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setGuestJournal(entries: JournalEntry[]) {
  localStorage.setItem(GUEST_JOURNAL_KEY, JSON.stringify(entries));
  emitGuestDataChange();
}

/**
 * Sync user profile to Firestore or Local Storage
 */
export async function syncUserProfile(user: { uid: string; email: string | null; displayName: string | null; photoURL: string | null }): Promise<UserProfile> {
  const now = new Date().toISOString();
  
  if (isGuestId(user.uid)) {
    const guestProfile: UserProfile = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || 'Demo Portfolio Manager',
      photoURL: user.photoURL,
      createdAt: now,
      updatedAt: now
    };
    // Seed initial guest data if empty
    if (getGuestStocks().length === 0 && getGuestTransactions().length === 0) {
      await seedSamplePortfolio(user.uid);
    }
    return guestProfile;
  }

  try {
    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);
    let profile: UserProfile;
    
    if (!userDoc.exists()) {
      profile = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || 'Investor',
        photoURL: user.photoURL,
        createdAt: now,
        updatedAt: now
      };
      await setDoc(userRef, profile);
    } else {
      profile = {
        ...userDoc.data() as UserProfile,
        updatedAt: now
      };
      await setDoc(userRef, { updatedAt: now }, { merge: true });
    }
    
    return profile;
  } catch (err) {
    console.warn('Sync user profile Firestore fallback:', err);
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || 'Investor',
      photoURL: user.photoURL,
      createdAt: now,
      updatedAt: now
    };
  }
}

/**
 * Subscribe to Real-Time Stock Holdings
 */
export function subscribeToStocks(
  userId: string, 
  onUpdate: (stocks: StockHolding[]) => void, 
  onError?: (error: Error) => void
) {
  if (isGuestId(userId)) {
    const sendUpdate = () => {
      const stocks = getGuestStocks();
      stocks.sort((a, b) => a.ticker.localeCompare(b.ticker));
      onUpdate(stocks);
    };
    sendUpdate();
    window.addEventListener(GUEST_DATA_CHANGE_EVENT, sendUpdate);
    return () => {
      window.removeEventListener(GUEST_DATA_CHANGE_EVENT, sendUpdate);
    };
  }

  const stocksRef = collection(db, 'users', userId, 'stocks');
  return onSnapshot(
    stocksRef,
    (snapshot) => {
      const holdings: StockHolding[] = [];
      snapshot.forEach((docSnap) => {
        holdings.push(docSnap.data() as StockHolding);
      });
      holdings.sort((a, b) => a.ticker.localeCompare(b.ticker));
      onUpdate(holdings);
    },
    (err) => {
      console.error('Firestore stocks subscription error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Subscribe to Real-Time Transaction Logs
 */
export function subscribeToTransactions(
  userId: string, 
  onUpdate: (txs: Transaction[]) => void, 
  onError?: (error: Error) => void
) {
  if (isGuestId(userId)) {
    const sendUpdate = () => {
      const txs = getGuestTransactions();
      txs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      onUpdate(txs);
    };
    sendUpdate();
    window.addEventListener(GUEST_DATA_CHANGE_EVENT, sendUpdate);
    return () => {
      window.removeEventListener(GUEST_DATA_CHANGE_EVENT, sendUpdate);
    };
  }

  const txRef = collection(db, 'users', userId, 'transactions');
  const q = query(txRef, orderBy('timestamp', 'desc'));
  
  return onSnapshot(
    q,
    (snapshot) => {
      const transactions: Transaction[] = [];
      snapshot.forEach((docSnap) => {
        transactions.push(docSnap.data() as Transaction);
      });
      onUpdate(transactions);
    },
    (err) => {
      console.error('Firestore transactions subscription error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Add a Buy/Sell Transaction and update the Dollar-Weighted Average Cost
 */
export async function addStockTransaction(
  userId: string,
  data: {
    ticker: string;
    type: TransactionType;
    quantity: number;
    price: number;
    notes?: string;
  }
): Promise<{ transaction: Transaction; updatedStock: StockHolding }> {
  const cleanTicker = data.ticker.trim().toUpperCase();
  const quantity = Number(data.quantity);
  const price = Number(data.price);
  const totalAmount = quantity * price;
  const now = new Date().toISOString();
  const txId = 'tx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

  if (isGuestId(userId)) {
    const existingStocks = getGuestStocks();
    const existingStock = existingStocks.find(s => s.ticker === cleanTicker);

    let currentQty = existingStock ? Number(existingStock.total_quantity) || 0 : 0;
    let currentAvgCost = existingStock ? Number(existingStock.average_cost) || 0 : 0;
    let currentInvested = existingStock ? Number(existingStock.total_invested) || (currentQty * currentAvgCost) : 0;

    let newQty = currentQty;
    let newAvgCost = currentAvgCost;
    let newInvested = currentInvested;

    if (data.type === 'BUY') {
      newQty = currentQty + quantity;
      newInvested = currentInvested + totalAmount;
      newAvgCost = newQty > 0 ? (newInvested / newQty) : price;
    } else {
      newQty = Math.max(0, currentQty - quantity);
      if (newQty === 0) {
        newAvgCost = 0;
        newInvested = 0;
      } else {
        newAvgCost = currentAvgCost;
        newInvested = newQty * newAvgCost;
      }
    }

    newAvgCost = Math.round(newAvgCost * 10000) / 10000;
    newInvested = Math.round(newInvested * 100) / 100;

    const updatedStock: StockHolding = {
      ticker: cleanTicker,
      total_quantity: newQty,
      average_cost: newAvgCost,
      total_invested: newInvested,
      last_updated: now
    };

    const transaction: Transaction = {
      id: txId,
      ticker: cleanTicker,
      type: data.type,
      quantity,
      price,
      totalAmount,
      calculatedAvgCostAfter: newAvgCost,
      timestamp: now,
      notes: data.notes || ''
    };

    const updatedStockList = existingStocks.filter(s => s.ticker !== cleanTicker);
    if (newQty > 0) {
      updatedStockList.push(updatedStock);
    }
    setGuestStocks(updatedStockList);

    const existingTxs = getGuestTransactions();
    setGuestTransactions([transaction, ...existingTxs]);

    return { transaction, updatedStock };
  }

  // Firestore path
  const stockRef = doc(db, 'users', userId, 'stocks', cleanTicker);
  const stockSnap = await getDoc(stockRef);
  
  let currentQty = 0;
  let currentInvested = 0;
  let currentAvgCost = 0;

  if (stockSnap.exists()) {
    const existing = stockSnap.data() as StockHolding;
    currentQty = Number(existing.total_quantity) || 0;
    currentAvgCost = Number(existing.average_cost) || 0;
    currentInvested = Number(existing.total_invested) || (currentQty * currentAvgCost);
  }

  let newQty = currentQty;
  let newAvgCost = currentAvgCost;
  let newInvested = currentInvested;

  if (data.type === 'BUY') {
    newQty = currentQty + quantity;
    newInvested = currentInvested + totalAmount;
    newAvgCost = newQty > 0 ? (newInvested / newQty) : price;
  } else {
    newQty = Math.max(0, currentQty - quantity);
    if (newQty === 0) {
      newAvgCost = 0;
      newInvested = 0;
    } else {
      newAvgCost = currentAvgCost;
      newInvested = newQty * newAvgCost;
    }
  }

  newAvgCost = Math.round(newAvgCost * 10000) / 10000;
  newInvested = Math.round(newInvested * 100) / 100;

  const updatedStock: StockHolding = {
    ticker: cleanTicker,
    total_quantity: newQty,
    average_cost: newAvgCost,
    total_invested: newInvested,
    last_updated: now
  };

  const transaction: Transaction = {
    id: txId,
    ticker: cleanTicker,
    type: data.type,
    quantity,
    price,
    totalAmount,
    calculatedAvgCostAfter: newAvgCost,
    timestamp: now,
    notes: data.notes || ''
  };

  const txRef = doc(db, 'users', userId, 'transactions', txId);

  const batch = writeBatch(db);
  batch.set(txRef, transaction);
  batch.set(stockRef, updatedStock);

  await batch.commit();

  return { transaction, updatedStock };
}

/**
 * Delete a Stock Holding
 */
export async function deleteStockHolding(userId: string, ticker: string): Promise<void> {
  const cleanTicker = ticker.toUpperCase();
  if (isGuestId(userId)) {
    const existing = getGuestStocks().filter(s => s.ticker !== cleanTicker);
    setGuestStocks(existing);
    return;
  }
  const stockRef = doc(db, 'users', userId, 'stocks', cleanTicker);
  await deleteDoc(stockRef);
}

/**
 * Delete a specific Transaction
 */
export async function deleteTransaction(userId: string, txId: string): Promise<void> {
  if (isGuestId(userId)) {
    const existing = getGuestTransactions().filter(t => t.id !== txId);
    setGuestTransactions(existing);
    return;
  }
  const txRef = doc(db, 'users', userId, 'transactions', txId);
  await deleteDoc(txRef);
}

/**
 * Subscribe to Past Journal Entries
 */
export function subscribeToJournalEntries(
  userId: string, 
  onUpdate: (entries: JournalEntry[]) => void, 
  onError?: (error: Error) => void
) {
  if (isGuestId(userId)) {
    const sendUpdate = () => {
      const entries = getGuestJournal();
      entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      onUpdate(entries);
    };
    sendUpdate();
    window.addEventListener(GUEST_DATA_CHANGE_EVENT, sendUpdate);
    return () => {
      window.removeEventListener(GUEST_DATA_CHANGE_EVENT, sendUpdate);
    };
  }

  const journalRef = collection(db, 'users', userId, 'journal_entries');
  const q = query(journalRef, orderBy('timestamp', 'desc'));
  
  return onSnapshot(
    q,
    (snapshot) => {
      const entries: JournalEntry[] = [];
      snapshot.forEach((docSnap) => {
        entries.push(docSnap.data() as JournalEntry);
      });
      onUpdate(entries);
    },
    (err) => {
      console.error('Firestore journal subscription error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Save a new Journal Reflection Entry to Firestore or Local Guest Storage
 */
export async function saveJournalEntry(
  userId: string,
  data: {
    prompt: string;
    response: string;
    summary?: string;
    stockContextUsed?: string[];
    calculations?: JournalEntry['calculations'];
  }
): Promise<JournalEntry> {
  const entryId = 'entry_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const now = new Date().toISOString();

  const entry: JournalEntry = {
    id: entryId,
    prompt: data.prompt,
    response: data.response,
    summary: data.summary || '',
    stockContextUsed: data.stockContextUsed || [],
    timestamp: now,
    calculations: data.calculations
  };

  if (isGuestId(userId)) {
    const existing = getGuestJournal();
    setGuestJournal([entry, ...existing]);
    return entry;
  }

  const entryRef = doc(db, 'users', userId, 'journal_entries', entryId);
  await setDoc(entryRef, entry);

  return entry;
}

/**
 * Delete a Journal Entry
 */
export async function deleteJournalEntry(userId: string, entryId: string): Promise<void> {
  if (isGuestId(userId)) {
    const existing = getGuestJournal().filter(e => e.id !== entryId);
    setGuestJournal(existing);
    return;
  }
  const entryRef = doc(db, 'users', userId, 'journal_entries', entryId);
  await deleteDoc(entryRef);
}

/**
 * Seed initial sample portfolio for instant first-time delight (e.g. AAPL, NVDA, GOOGL, MSFT)
 */
export async function seedSamplePortfolio(userId: string): Promise<void> {
  const sampleTransactions = [
    { ticker: 'AAPL', type: 'BUY' as const, quantity: 10, price: 175.50, notes: 'Initial core position build' },
    { ticker: 'AAPL', type: 'BUY' as const, quantity: 5, price: 185.00, notes: 'Dollar-cost averaging dip' },
    { ticker: 'NVDA', type: 'BUY' as const, quantity: 15, price: 112.20, notes: 'AI compute exposure' },
    { ticker: 'GOOGL', type: 'BUY' as const, quantity: 20, price: 165.40, notes: 'Search & Cloud foundation' },
    { ticker: 'MSFT', type: 'BUY' as const, quantity: 8, price: 410.00, notes: 'Enterprise software anchor' },
  ];

  for (const item of sampleTransactions) {
    await addStockTransaction(userId, item);
  }

  await saveJournalEntry(userId, {
    prompt: "I started building my tech portfolio today with AAPL, NVDA, GOOGL, and MSFT. How is my cost basis distributed, and what happens if I take profit on AAPL at $240?",
    response: "Welcome to your financial journal! Your portfolio is established with 4 core tech pillars:\n\n1. **AAPL**: 15 shares at a dollar-weighted Average Cost of **$178.67** ($2,680.00 total invested).\n2. **NVDA**: 15 shares at **$112.20** ($1,683.00 total invested).\n3. **GOOGL**: 20 shares at **$165.40** ($3,308.00 total invested).\n4. **MSFT**: 8 shares at **$410.00** ($3,280.00 total invested).\n\n### Scenario Analysis (AAPL Sell at $240.00):\n- **Total Sale Proceeds**: 15 shares × $240.00 = **$3,600.00**\n- **Total Cost Basis**: 15 shares × $178.67 = **$2,680.00**\n- **Net Realized Profit**: **+$920.00** (+34.33% gain).\n\nYou have balanced blue-chip safety with high-growth AI compute. Let me know anytime you want to test entry/exit prices!",
    summary: "Portfolio initialized with 4 tech holdings. Calculated AAPL profit at $240 target (+$920.00 / +34.33%).",
    stockContextUsed: ['AAPL', 'NVDA', 'GOOGL', 'MSFT'],
    calculations: {
      ticker: 'AAPL',
      action: 'PROFIT_SIMULATION',
      calculatedAvgCost: 178.67,
      simulatedProfitLoss: 920.00,
      notes: '15 shares at $178.67 sold at $240.00 target'
    }
  });
}

