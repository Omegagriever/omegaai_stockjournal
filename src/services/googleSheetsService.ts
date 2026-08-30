import { StockHolding, Transaction, JournalEntry, GoogleBackupRecord } from '../types';
import { requestGoogleWorkspaceToken } from '../lib/firebase';

const BACKUP_HISTORY_KEY = 'omega_google_backup_history';

/**
 * Format dollar or numbers safely
 */
function fmtNum(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) return '0.00';
  return Number(val).toFixed(2);
}

/**
 * Sanitize tab name for Google Sheets (max 100 chars, no illegal characters)
 */
function sanitizeSheetTitle(title: string): string {
  return title.replace(/[*?:/\\[\]']/g, '').trim().substring(0, 30);
}

/**
 * Get locally stored backup history
 */
export function getSavedBackups(): GoogleBackupRecord[] {
  try {
    const raw = localStorage.getItem(BACKUP_HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to parse backup history:', err);
    return [];
  }
}

/**
 * Save backup record to local history
 */
export function saveBackupRecord(record: GoogleBackupRecord): GoogleBackupRecord[] {
  try {
    const current = getSavedBackups().filter(b => b.spreadsheetId !== record.spreadsheetId);
    const updated = [record, ...current].slice(0, 10);
    localStorage.setItem(BACKUP_HISTORY_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn('Failed to save backup record:', err);
    return [];
  }
}

/**
 * Calculate trade-by-trade running history for a given ticker
 */
function calculateTickerTradeHistory(ticker: string, transactions: Transaction[], holding?: StockHolding) {
  // Sort oldest to newest
  const tickerTx = transactions
    .filter(t => t.ticker.toUpperCase() === ticker.toUpperCase())
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  let runningShares = 0;
  let runningInvested = 0;
  let runningAvgCost = 0;

  const rows = tickerTx.map((t, idx) => {
    const qty = Number(t.quantity) || 0;
    const price = Number(t.price) || 0;
    const tradeTotal = qty * price;
    let realizedPnl = 0;

    if (t.type === 'BUY') {
      runningInvested += tradeTotal;
      runningShares += qty;
      runningAvgCost = runningShares > 0 ? runningInvested / runningShares : 0;
    } else {
      // SELL
      realizedPnl = qty * (price - runningAvgCost);
      runningInvested = Math.max(0, runningInvested - qty * runningAvgCost);
      runningShares = Math.max(0, runningShares - qty);
      if (runningShares === 0) {
        runningAvgCost = 0;
      }
    }

    const txDate = t.timestamp ? new Date(t.timestamp).toLocaleString() : '';

    return [
      `#${idx + 1}`,
      txDate,
      t.type,
      qty,
      `$${fmtNum(price)}`,
      `$${fmtNum(tradeTotal)}`,
      runningShares,
      `$${fmtNum(runningInvested)}`,
      `$${fmtNum(runningAvgCost)}`,
      t.type === 'SELL' ? `$${fmtNum(realizedPnl)}` : '-',
      t.notes || ''
    ];
  });

  return {
    tickerTx,
    rows,
    finalShares: holding ? holding.total_quantity : runningShares,
    finalAvgCost: holding ? holding.average_cost : runningAvgCost,
    finalInvested: holding ? holding.total_invested : runningInvested
  };
}

/**
 * Build all sheet titles and formatted datasets
 */
function buildSpreadsheetData({
  stocks,
  transactions,
  pastEntries,
}: {
  stocks: StockHolding[];
  transactions: Transaction[];
  pastEntries: JournalEntry[];
}) {
  // 1. Unique tickers list
  const tickerMap = new Map<string, StockHolding>();
  stocks.forEach(s => tickerMap.set(s.ticker.toUpperCase(), s));
  
  const allTickerSet = new Set<string>();
  stocks.forEach(s => allTickerSet.add(s.ticker.toUpperCase()));
  transactions.forEach(t => allTickerSet.add(t.ticker.toUpperCase()));
  const uniqueTickers = Array.from(allTickerSet).filter(Boolean).sort();

  // Aggregate Portfolio Totals
  const totalPortfolioInvested = stocks.reduce((acc, s) => acc + s.total_invested, 0);
  const totalPortfolioValue = stocks.reduce((acc, s) => {
    const p = s.current_price || s.average_cost;
    return acc + (s.total_quantity * p);
  }, 0);
  const netPortfolioPnl = totalPortfolioValue - totalPortfolioInvested;
  const netPortfolioReturnPct = totalPortfolioInvested > 0 ? (netPortfolioPnl / totalPortfolioInvested) * 100 : 0;

  // TAB 1: Portfolio Summary (Summarize of Average)
  const summarySheetTitle = 'Portfolio Summary';
  const summaryRows: (string | number)[][] = [
    ['PORTFOLIO AVERAGE & VALUATION SUMMARY', '', '', '', '', '', '', '', ''],
    ['Generated At:', new Date().toLocaleString(), '', 'Total Invested:', `$${fmtNum(totalPortfolioInvested)}`, 'Total Value:', `$${fmtNum(totalPortfolioValue)}`, 'Net P&L:', `${netPortfolioPnl >= 0 ? '+' : ''}$${fmtNum(netPortfolioPnl)} (${fmtNum(netPortfolioReturnPct)}%)`],
    ['', '', '', '', '', '', '', '', ''],
    [
      'Ticker',
      'Total Shares Owned',
      'Dollar-Weighted Avg Cost ($)',
      'Est. Market Price ($)',
      'Total Capital Invested ($)',
      'Est. Total Value ($)',
      'Unrealized Profit/Loss ($)',
      'Return (%)',
      'Last Activity Date'
    ],
    ...stocks.map(s => {
      const curPrice = s.current_price || s.average_cost;
      const totalVal = s.total_quantity * curPrice;
      const pnl = totalVal - s.total_invested;
      const pnlPct = s.total_invested > 0 ? (pnl / s.total_invested) * 100 : 0;
      return [
        s.ticker,
        s.total_quantity,
        `$${fmtNum(s.average_cost)}`,
        `$${fmtNum(curPrice)}`,
        `$${fmtNum(s.total_invested)}`,
        `$${fmtNum(totalVal)}`,
        `${pnl >= 0 ? '+' : ''}$${fmtNum(pnl)}`,
        `${pnlPct >= 0 ? '+' : ''}${fmtNum(pnlPct)}%`,
        s.last_updated ? new Date(s.last_updated).toLocaleString() : new Date().toLocaleString()
      ];
    })
  ];

  if (stocks.length === 0) {
    summaryRows.push(['No active stock holdings found in your portfolio ledger.', '', '', '', '', '', '', '', '']);
  }

  // Ticker tabs configuration
  const tickerSheets: { title: string; rows: (string | number)[][] }[] = [];

  uniqueTickers.forEach(ticker => {
    const holding = tickerMap.get(ticker);
    const sheetTitle = sanitizeSheetTitle(`${ticker} History`);
    const history = calculateTickerTradeHistory(ticker, transactions, holding);

    const curPrice = holding?.current_price || history.finalAvgCost;
    const curVal = history.finalShares * curPrice;
    const curPnl = curVal - history.finalInvested;
    const curPnlPct = history.finalInvested > 0 ? (curPnl / history.finalInvested) * 100 : 0;

    const tickerTabRows: (string | number)[][] = [
      [`${ticker} - POSITION SUMMARY & AVERAGE COST BASIS`, '', '', '', '', '', '', '', '', '', ''],
      [
        'Shares Owned:',
        history.finalShares,
        'Dollar-Weighted Avg Cost:',
        `$${fmtNum(history.finalAvgCost)}`,
        'Total Invested:',
        `$${fmtNum(history.finalInvested)}`,
        'Est. Market Value:',
        `$${fmtNum(curVal)}`,
        'Unrealized P&L:',
        `${curPnl >= 0 ? '+' : ''}$${fmtNum(curPnl)} (${fmtNum(curPnlPct)}%)`,
        ''
      ],
      ['', '', '', '', '', '', '', '', '', '', ''],
      ['PURCHASE & TRANSACTION HISTORY (CHRONOLOGICAL)', '', '', '', '', '', '', '', '', '', ''],
      [
        'Trade #',
        'Date & Time',
        'Action (BUY/SELL)',
        'Shares',
        'Execution Price ($)',
        'Trade Total Amount ($)',
        'Running Shares Held',
        'Running Total Invested ($)',
        'Avg Cost After Trade ($)',
        'Realized P&L ($)',
        'Trade / Strategy Notes'
      ],
      ...(history.rows.length > 0 ? history.rows : [
        ['-', 'No individual trade records logged yet for this ticker', '-', '-', '-', '-', '-', '-', '-', '-', '-']
      ])
    ];

    tickerSheets.push({
      title: sheetTitle,
      rows: tickerTabRows
    });
  });

  // Master Transaction Ledger Tab
  const allTxSheetTitle = 'All Transactions Ledger';
  const allTxRows: (string | number)[][] = [
    [
      'Date & Time',
      'Action Type',
      'Ticker',
      'Shares / Qty',
      'Execution Price ($)',
      'Total Amount ($)',
      'Avg Cost After ($)',
      'Transaction Notes'
    ],
    ...transactions.map(t => [
      t.timestamp ? new Date(t.timestamp).toLocaleString() : '',
      t.type,
      t.ticker,
      t.quantity,
      `$${fmtNum(t.price)}`,
      `$${fmtNum(t.totalAmount)}`,
      t.calculatedAvgCostAfter ? `$${fmtNum(t.calculatedAvgCostAfter)}` : '-',
      t.notes || ''
    ])
  ];

  // Journal & Reflections Tab
  const journalSheetTitle = 'Journal & Reflections';
  const journalRows: (string | number)[][] = [
    [
      'Date & Time',
      'Associated Ticker / Action',
      'User Reflection / Strategy Note',
      'Executive Summary & Advice',
      'Calculated Avg Cost ($)',
      'Simulated P&L ($)'
    ],
    ...pastEntries.map(j => [
      j.timestamp ? new Date(j.timestamp).toLocaleString() : '',
      j.calculations?.ticker ? `${j.calculations.ticker} (${j.calculations.action || 'NOTE'})` : 'GENERAL',
      j.prompt || '',
      j.summary || j.response || '',
      j.calculations?.calculatedAvgCost ? `$${fmtNum(j.calculations.calculatedAvgCost)}` : '-',
      j.calculations?.simulatedProfitLoss ? `$${fmtNum(j.calculations.simulatedProfitLoss)}` : '-'
    ])
  ];

  return {
    summarySheetTitle,
    summaryRows,
    tickerSheets,
    allTxSheetTitle,
    allTxRows,
    journalSheetTitle,
    journalRows,
    uniqueTickers
  };
}

/**
 * Export live Portfolio, Individual Stock Tabs, Master Transactions, and Journal entries into a new Google Spreadsheet
 */
export async function exportToGoogleSheets({
  stocks,
  transactions,
  pastEntries,
  customTitle,
}: {
  stocks: StockHolding[];
  transactions: Transaction[];
  pastEntries: JournalEntry[];
  customTitle?: string;
}): Promise<GoogleBackupRecord> {
  const token = await requestGoogleWorkspaceToken();

  const now = new Date();
  const dateString = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const title = customTitle || `OMEGA - Portfolio & Stock History Backup (${dateString})`;

  const dataPayload = buildSpreadsheetData({ stocks, transactions, pastEntries });

  // Define initial sheet list: 1st tab is Portfolio Summary, followed by ticker tabs, then master ledger & journal
  const initialSheets = [
    {
      properties: {
        title: dataPayload.summarySheetTitle,
        gridProperties: { frozenRowCount: 4 }
      }
    },
    ...dataPayload.tickerSheets.map(ts => ({
      properties: {
        title: ts.title,
        gridProperties: { frozenRowCount: 5 }
      }
    })),
    {
      properties: {
        title: dataPayload.allTxSheetTitle,
        gridProperties: { frozenRowCount: 1 }
      }
    },
    {
      properties: {
        title: dataPayload.journalSheetTitle,
        gridProperties: { frozenRowCount: 1 }
      }
    }
  ];

  // 1. Create Spreadsheet
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { title },
      sheets: initialSheets,
    }),
  });

  if (!createRes.ok) {
    const errJson = await createRes.json().catch(() => ({}));
    throw new Error(errJson.error?.message || `Failed to create Google Spreadsheet (${createRes.status})`);
  }

  const spreadsheetData = await createRes.json();
  const spreadsheetId = spreadsheetData.spreadsheetId;
  const spreadsheetUrl = spreadsheetData.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // 2. Prepare all value ranges to write in batch
  const valueRanges: { range: string; values: (string | number)[][] }[] = [
    {
      range: `'${dataPayload.summarySheetTitle}'!A1:I`,
      values: dataPayload.summaryRows
    },
    ...dataPayload.tickerSheets.map(ts => ({
      range: `'${ts.title}'!A1:K`,
      values: ts.rows
    })),
    {
      range: `'${dataPayload.allTxSheetTitle}'!A1:H`,
      values: dataPayload.allTxRows
    },
    {
      range: `'${dataPayload.journalSheetTitle}'!A1:F`,
      values: dataPayload.journalRows
    }
  ];

  // 3. Write data to all sheets via batchUpdate
  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: valueRanges,
      }),
    }
  );

  if (!updateRes.ok) {
    const errJson = await updateRes.json().catch(() => ({}));
    throw new Error(errJson.error?.message || `Failed to write data to Google Spreadsheet (${updateRes.status})`);
  }

  const record: GoogleBackupRecord = {
    id: `backup_${Date.now()}`,
    spreadsheetId,
    spreadsheetUrl,
    title,
    timestamp: now.toISOString(),
    stocksCount: stocks.length,
    transactionsCount: transactions.length,
    journalCount: pastEntries.length,
  };

  saveBackupRecord(record);
  return record;
}

/**
 * Update / overwrite an existing Google Spreadsheet with the latest data and stock tabs
 */
export async function syncExistingGoogleSheet({
  spreadsheetId,
  stocks,
  transactions,
  pastEntries,
}: {
  spreadsheetId: string;
  stocks: StockHolding[];
  transactions: Transaction[];
  pastEntries: JournalEntry[];
}): Promise<GoogleBackupRecord> {
  const token = await requestGoogleWorkspaceToken();
  const now = new Date();

  // 1. Get existing sheets in this spreadsheet
  const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!metaRes.ok) {
    const errJson = await metaRes.json().catch(() => ({}));
    throw new Error(errJson.error?.message || `Failed to fetch spreadsheet metadata (${metaRes.status})`);
  }

  const metaData = await metaRes.json();
  const existingSheetTitles = new Set(metaData.sheets?.map((s: { properties: { title: string } }) => s.properties.title) || []);

  const dataPayload = buildSpreadsheetData({ stocks, transactions, pastEntries });

  // 2. Identify required tabs that need to be added
  const requiredTabs = [
    dataPayload.summarySheetTitle,
    ...dataPayload.tickerSheets.map(ts => ts.title),
    dataPayload.allTxSheetTitle,
    dataPayload.journalSheetTitle
  ];

  const sheetsToAdd = requiredTabs.filter(t => !existingSheetTitles.has(t));

  if (sheetsToAdd.length > 0) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: sheetsToAdd.map(title => ({
          addSheet: {
            properties: { title }
          }
        }))
      })
    }).catch(() => {});
  }

  // 3. Clear existing content across tabs
  for (const sheetTitle of requiredTabs) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${sheetTitle}'!A1:Z:clear`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    }).catch(() => {});
  }

  // 4. Populate updated data across all tabs
  const valueRanges: { range: string; values: (string | number)[][] }[] = [
    {
      range: `'${dataPayload.summarySheetTitle}'!A1:I`,
      values: dataPayload.summaryRows
    },
    ...dataPayload.tickerSheets.map(ts => ({
      range: `'${ts.title}'!A1:K`,
      values: ts.rows
    })),
    {
      range: `'${dataPayload.allTxSheetTitle}'!A1:H`,
      values: dataPayload.allTxRows
    },
    {
      range: `'${dataPayload.journalSheetTitle}'!A1:F`,
      values: dataPayload.journalRows
    }
  ];

  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: valueRanges,
      }),
    }
  );

  if (!updateRes.ok) {
    const errJson = await updateRes.json().catch(() => ({}));
    throw new Error(errJson.error?.message || `Failed to sync Google Spreadsheet (${updateRes.status})`);
  }

  const record: GoogleBackupRecord = {
    id: `sync_${Date.now()}`,
    spreadsheetId,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    title: metaData.properties?.title || 'OMEGA Synced Ledger',
    timestamp: now.toISOString(),
    stocksCount: stocks.length,
    transactionsCount: transactions.length,
    journalCount: pastEntries.length,
  };

  saveBackupRecord(record);
  return record;
}

