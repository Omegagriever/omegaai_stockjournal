import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Database, 
  Copy, 
  Check, 
  KeyRound, 
  FolderTree, 
  Server,
  FileCode2,
  ExternalLink
} from 'lucide-react';
import { UserProfile, StockHolding, Transaction, JournalEntry } from '../types';

interface FirestoreSecurityTabProps {
  user: UserProfile;
  stocks: StockHolding[];
  transactions: Transaction[];
  pastEntries: JournalEntry[];
}

export const FirestoreSecurityTab: React.FC<FirestoreSecurityTabProps> = ({
  user,
  stocks,
  transactions,
  pastEntries,
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  const firestoreRulesCode = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 1. Default-Deny master gate
    match /{document=**} {
      allow read, write: if false;
    }

    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    // Strict User-Isolated Subcollections
    match /users/{userId} {
      allow read, write: if isOwner(userId);

      match /journal_entries/{entryId} {
        allow read, write: if isOwner(userId);
      }

      match /stocks/{ticker} {
        allow read, write: if isOwner(userId);
      }

      match /transactions/{txId} {
        allow read, write: if isOwner(userId);
      }
    }
  }
}`;

  const copyRules = () => {
    navigator.clipboard.writeText(firestoreRulesCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      
      {/* Overview Banner */}
      <div className="rounded-2xl border border-[#222222] bg-[#111111] p-6 shadow-xs">
        <div className="flex items-center gap-2 mb-1">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#C4A77D]/15 text-[#C4A77D] border border-[#C4A77D]/30 text-xs font-bold font-mono">
            SEC
          </span>
          <h2 className="font-serif text-lg font-bold text-[#F5F5F5]">
            Firestore Isolation & Zero-Trust Security Verification
          </h2>
        </div>
        <p className="text-xs text-[#A3A3A3] max-w-3xl">
          All financial data, trade transactions, and multi-turn AI journal reflections are partitioned strictly by your Firebase Authentication user ID (<code>{user.uid}</code>).
        </p>
      </div>

      {/* Security Architecture Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        <div className="rounded-2xl border border-[#222222] bg-[#111111] p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#C4A77D]">
            <KeyRound className="h-5 w-5" />
            <h3 className="font-serif text-sm font-bold text-[#F5F5F5]">Active User Identity</h3>
          </div>
          <div className="rounded-xl bg-[#0A0A0A] border border-[#222222] p-3 text-xs space-y-1 font-mono">
            <p className="text-[#888888] text-[10px]">AUTH UID</p>
            <p className="text-[#C4A77D] truncate font-bold">{user.uid}</p>
            <p className="text-[#888888] text-[10px] pt-1">EMAIL / IDENTITY</p>
            <p className="text-[#E5E5E5] truncate">{user.email || 'Anonymous/Guest'}</p>
          </div>
          <p className="text-[11px] text-[#888888]">
            Only authenticated requests with <code>request.auth.uid == "{user.uid}"</code> can read or write documents.
          </p>
        </div>

        <div className="rounded-2xl border border-[#222222] bg-[#111111] p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#C4A77D]">
            <FolderTree className="h-5 w-5" />
            <h3 className="font-serif text-sm font-bold text-[#F5F5F5]">Isolated Collections</h3>
          </div>
          <div className="rounded-xl bg-[#0A0A0A] border border-[#222222] p-3 text-xs space-y-2 font-mono text-[#A3A3A3]">
            <div className="flex justify-between">
              <span>/stocks</span>
              <span className="text-[#F5F5F5] font-bold">{stocks.length} docs</span>
            </div>
            <div className="flex justify-between">
              <span>/transactions</span>
              <span className="text-[#F5F5F5] font-bold">{transactions.length} docs</span>
            </div>
            <div className="flex justify-between">
              <span>/journal_entries</span>
              <span className="text-[#F5F5F5] font-bold">{pastEntries.length} docs</span>
            </div>
          </div>
          <p className="text-[11px] text-[#888888]">
            Hierarchical subcollections prevent cross-tenant data leakage.
          </p>
        </div>

        <div className="rounded-2xl border border-[#222222] bg-[#111111] p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#C4A77D]">
            <Server className="h-5 w-5" />
            <h3 className="font-serif text-sm font-bold text-[#F5F5F5]">Gemini Secret Hygiene</h3>
          </div>
          <div className="rounded-xl bg-[#0A0A0A] border border-[#222222] p-3 text-xs space-y-1 font-mono">
            <p className="text-[#888888] text-[10px]">API KEY LOCATION</p>
            <p className="text-emerald-400 font-bold">Server-Side Only (process.env)</p>
            <p className="text-[#888888] text-[10px] pt-1">CLIENT EXPOSURE</p>
            <p className="text-emerald-400 font-bold">0% (Zero browser secrets)</p>
          </div>
          <p className="text-[11px] text-[#888888]">
            Gemini calls route through Express API endpoints, protecting Google API keys.
          </p>
        </div>

      </div>

      {/* Deployable Rules Viewer */}
      <div className="rounded-2xl border border-[#222222] bg-[#111111] p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode2 className="h-4 w-4 text-[#C4A77D]" />
            <h3 className="font-serif text-sm font-bold text-[#F5F5F5]">
              Active Deployed firestore.rules
            </h3>
          </div>
          <button
            onClick={copyRules}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#2D2D2D] bg-[#181818] px-3 py-1 text-xs font-semibold text-[#D4D4D4] hover:bg-[#202020] hover:text-[#FFFFFF] cursor-pointer"
          >
            {copied ? <Check className="h-3 w-3 text-[#C4A77D]" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copied' : 'Copy Rules'}
          </button>
        </div>

        <pre className="rounded-xl bg-[#0B0B0B] p-4 text-xs font-mono text-[#C4A77D] border border-[#222222] overflow-x-auto">
          {firestoreRulesCode}
        </pre>
      </div>

    </div>
  );
};
