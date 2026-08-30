import express, { Request, Response } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

// Top-Level Request Deserialization (Ordering Guarantee)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize Gemini SDK with User-Agent header
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY || '';
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Strict Undefined-Stripping Utility
export function stripUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(stripUndefined) as unknown as T;
  }
  if (typeof obj === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = stripUndefined(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}

// Resilient Model Fallback Ladder (Gemini 3.6 Flash -> 3.1 Flash-Lite -> Flash Latest -> 3.7 Flash)
const FALLBACK_MODEL_LADDER = [
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.7-flash',
] as const;

export interface FallbackResult {
  text: string;
  modelUsed: string;
  attempts: Array<{ model: string; success: boolean; error?: string; latencyMs: number }>;
}

export async function generateContentWithFallback(
  prompt: string,
  options?: {
    systemInstruction?: string;
    temperature?: number;
  }
): Promise<FallbackResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is missing in server environment.');
  }

  const ai = getGenAI();
  const attempts: FallbackResult['attempts'] = [];

  for (let i = 0; i < FALLBACK_MODEL_LADDER.length; i++) {
    const model = FALLBACK_MODEL_LADDER[i];
    const startTime = Date.now();
    try {
      console.log(`[Gemini Fallback Ladder] Attempting tier ${i + 1}/${FALLBACK_MODEL_LADDER.length}: ${model}`);
      
      const config: Record<string, unknown> = {};
      if (options?.systemInstruction) {
        config.systemInstruction = options.systemInstruction;
      }
      if (typeof options?.temperature === 'number') {
        config.temperature = options.temperature;
      }

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: Object.keys(config).length > 0 ? config : undefined,
      });

      const latencyMs = Date.now() - startTime;
      const text = response.text || '';
      attempts.push({ model, success: true, latencyMs });
      
      console.log(`[Gemini Fallback Ladder] Success with ${model} in ${latencyMs}ms`);
      return {
        text,
        modelUsed: model,
        attempts,
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.warn(`[Gemini Fallback Ladder] Tier ${i + 1} (${model}) failed in ${latencyMs}ms: ${errorMessage}`);
      
      attempts.push({
        model,
        success: false,
        error: errorMessage,
        latencyMs,
      });

      if (i === FALLBACK_MODEL_LADDER.length - 1) {
        throw new Error(
          `All Gemini models in fallback ladder failed. Last error: ${errorMessage}`
        );
      }
    }
  }

  throw new Error('Failed to generate content: Fallback ladder exhausted without response.');
}

// ---------------- API ROUTES ----------------

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    envKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
    fallbackLadder: FALLBACK_MODEL_LADDER,
  });
});

// 1. Multi-Turn Journal & Financial Reflection with Context Injection
app.post('/api/gemini/journal-chat', async (req: Request, res: Response) => {
  try {
    const data = req.body && typeof req.body === 'object' ? req.body : {};
    const { prompt, chatHistory, stocks, recentTransactions, userDisplayName } = data;

    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'prompt string is required.' });
      return;
    }

    // Format user's live stock portfolio for context window
    let portfolioContext = 'User currently has no stock holdings logged in Firestore.';
    if (Array.isArray(stocks) && stocks.length > 0) {
      portfolioContext = stocks.map((s: any) => {
        const qty = Number(s.total_quantity) || 0;
        const avg = Number(s.average_cost) || 0;
        const invested = Number(s.total_invested) || (qty * avg);
        return `- **${s.ticker}**: ${qty} shares @ $${avg.toFixed(2)} Avg Cost (Total Invested: $${invested.toFixed(2)}, Last Updated: ${s.last_updated || 'Recent'})`;
      }).join('\n');
    }

    let transactionContext = 'No recent transactions.';
    if (Array.isArray(recentTransactions) && recentTransactions.length > 0) {
      transactionContext = recentTransactions.slice(0, 10).map((t: any) => {
        const qty = Number(t.quantity) || 0;
        const price = Number(t.price) || 0;
        const total = Number(t.totalAmount) || (qty * price);
        return `- ${t.type} ${qty} ${t.ticker} @ $${price.toFixed(2)} ($${total.toFixed(2)}) on ${new Date(t.timestamp).toLocaleDateString()}`;
      }).join('\n');
    }

    const systemPrompt = `You are "Aegis AI", an elite Financial Portfolio Advisor and Reflective Journaling Mentor.
You are embedded directly inside the user's private financial journal.
You have live, secure access to the user's Cloud Firestore stock portfolio ledger.

### Current User Profile:
- Name: ${userDisplayName || 'Investor'}

### Live Firestore Portfolio State:
${portfolioContext}

### Recent Transaction Ledger:
${transactionContext}

### Core Directives:
1. **Financial & Mathematical Precision**:
   - When the user asks about Average Cost (AVR), calculate it using the exact Dollar-Weighted formula:
     $$\\text{Average Cost} = \\frac{\\sum (\\text{Buy Quantity} \\times \\text{Buy Price})}{\\sum \\text{Buy Quantity}}$$
   - When asked about profit/loss scenarios (e.g. "What if I sell AAPL at $200?"):
     - State the current position: Total shares & current Dollar-Weighted Average Cost.
     - Compute Gross Proceeds = Shares × Target Price.
     - Compute Cost Basis = Shares × Average Cost.
     - Compute Net Realized Profit/Loss = Gross Proceeds - Cost Basis.
     - Compute Return on Investment (ROI) % = (Net Profit / Cost Basis) × 100%.
2. **Journaling & Reflection**:
   - Provide thoughtful commentary on portfolio balance, risk concentration, market psychology, and discipline.
   - Maintain a supportive, articulate, professional tone.
3. **Structured Summary & Extracted Metrics**:
   - If the user describes executing, buying, selling, or purchasing a new stock (e.g., "I just bought 15 shares of TSLA at 195 dollars", "Added 5 NVDA at 120", "Sold 10 AAPL at 220"), extract this into detectedTrade so the UI can provide an instant 1-click sync button to their live portfolio.
   At the very end of your response, ALWAYS include an XML-like block for parsing:
   <METADATA>
   {
     "summary": "1-2 sentence high-level summary of this journal entry for the archive list",
     "calculations": {
       "ticker": "AAPL",
       "action": "BUY",
       "calculatedAvgCost": 178.67,
       "simulatedProfitLoss": 920.00,
       "notes": "Brief calc summary",
       "detectedTrade": {
         "ticker": "AAPL",
         "type": "BUY",
         "quantity": 10,
         "price": 180.50,
         "notes": "Added via Journal Reflection"
       }
     }
   }
   </METADATA>
   (Note: If no trade was executed or mentioned, set detectedTrade to null)`;

    let combinedPrompt = '';
    if (Array.isArray(chatHistory) && chatHistory.length > 0) {
      const priorTurns = chatHistory.map((m: any) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n');
      combinedPrompt = `Prior Conversation History:\n${priorTurns}\n\nCurrent User Journal Entry / Question:\n${prompt}`;
    } else {
      combinedPrompt = `User Journal Entry / Question:\n${prompt}`;
    }

    const result = await generateContentWithFallback(combinedPrompt, {
      systemInstruction: systemPrompt,
      temperature: 0.3,
    });

    // Parse the metadata block if present
    let cleanReply = result.text;
    let parsedSummary = '';
    let parsedCalculations = undefined;

    const metadataMatch = result.text.match(/<METADATA>([\s\S]*?)<\/METADATA>/);
    if (metadataMatch) {
      cleanReply = result.text.replace(/<METADATA>[\s\S]*?<\/METADATA>/, '').trim();
      try {
        const metaJson = JSON.parse(metadataMatch[1].trim());
        parsedSummary = metaJson.summary || '';
        parsedCalculations = metaJson.calculations || undefined;

        // Sanitize detected trade if present
        if (parsedCalculations && parsedCalculations.detectedTrade) {
          const dt = parsedCalculations.detectedTrade;
          const cleanTicker = String(dt.ticker || '').toUpperCase().replace(/[^A-Z0-9.-]/g, '');
          const cleanType = String(dt.type).toUpperCase() === 'SELL' ? 'SELL' : 'BUY';
          const cleanQty = Number(dt.quantity);
          const cleanPrice = Number(dt.price);

          if (cleanTicker && cleanQty > 0 && cleanPrice > 0) {
            parsedCalculations.detectedTrade = {
              ticker: cleanTicker,
              type: cleanType,
              quantity: cleanQty,
              price: cleanPrice,
              notes: dt.notes || 'Logged via AI Financial Journal'
            };
          } else {
            delete parsedCalculations.detectedTrade;
          }
        }
      } catch (e) {
        console.warn('Could not parse metadata JSON from model response');
      }
    }

    // If summary wasn't extracted, create a clean fallback
    if (!parsedSummary) {
      const firstLine = cleanReply.split('\n').filter(l => l.trim().length > 0)[0] || '';
      parsedSummary = firstLine.replace(/[#*`_]/g, '').slice(0, 140) + '...';
    }

    res.json(stripUndefined({
      reply: cleanReply,
      summary: parsedSummary,
      calculations: parsedCalculations,
      modelUsed: result.modelUsed,
      attempts: result.attempts,
      latencyMs: result.attempts[result.attempts.length - 1]?.latencyMs || 0,
    }));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal AI Journal processing failure';
    console.error('Journal chat error:', message);
    res.status(500).json({ error: message });
  }
});

// 2. Dedicated Stock Scenario Simulation Endpoint
app.post('/api/gemini/simulate-stock', async (req: Request, res: Response) => {
  try {
    const data = req.body && typeof req.body === 'object' ? req.body : {};
    const { ticker, targetPrice, shares, holding } = data;

    if (!ticker || !targetPrice) {
      res.status(400).json({ error: 'ticker and targetPrice are required.' });
      return;
    }

    const cleanTicker = String(ticker).toUpperCase();
    const targetP = Number(targetPrice);
    const holdingQty = holding ? Number(holding.total_quantity) : Number(shares || 10);
    const avgCost = holding ? Number(holding.average_cost) : 100;

    const totalProceeds = holdingQty * targetP;
    const costBasis = holdingQty * avgCost;
    const profitLoss = totalProceeds - costBasis;
    const percentageGain = costBasis > 0 ? ((profitLoss / costBasis) * 100) : 0;

    const prompt = `Perform a quantitative trade scenario analysis:
Asset: ${cleanTicker}
Holding Position: ${holdingQty} shares @ $${avgCost.toFixed(2)} average cost basis ($${costBasis.toFixed(2)} total cost basis)
Hypothetical Exit Target: $${targetP.toFixed(2)} per share

Math:
- Gross Proceeds: $${totalProceeds.toFixed(2)}
- Net Profit/Loss: $${profitLoss.toFixed(2)} (${percentageGain.toFixed(2)}%)

Provide a crisp 2-paragraph analysis covering:
1. Exact realized outcome breakdown.
2. Strategic commentary: risk-reward evaluation, capital reallocation suggestion, and re-entry considerations.`;

    const result = await generateContentWithFallback(prompt, {
      systemInstruction: 'You are a quantitative portfolio strategist. Provide concise, highly numerical, actionable insights.',
      temperature: 0.2,
    });

    res.json(stripUndefined({
      ticker: cleanTicker,
      shares: holdingQty,
      avgCost,
      targetPrice: targetP,
      proceeds: totalProceeds,
      costBasis,
      profitLoss,
      percentageGain: Math.round(percentageGain * 100) / 100,
      analysis: result.text,
      modelUsed: result.modelUsed,
      attempts: result.attempts,
    }));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Simulation error';
    res.status(500).json({ error: message });
  }
});

// ---------------- VITE MIDDLEWARE / STATIC ASSETS ----------------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Aegis Portfolio & AI Journal] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
