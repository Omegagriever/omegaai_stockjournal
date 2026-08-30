import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  HardDrive, 
  ExternalLink, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Download, 
  Clock, 
  ShieldCheck,
  Sparkles,
  Copy,
  Check
} from 'lucide-react';
import { StockHolding, Transaction, JournalEntry, UserProfile, GoogleBackupRecord } from '../types';
import { exportToGoogleSheets, syncExistingGoogleSheet, getSavedBackups } from '../services/googleSheetsService';
import { getCachedGoogleAccessToken, requestGoogleWorkspaceToken } from '../lib/firebase';

interface GoogleSheetsBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  stocks: StockHolding[];
  transactions: Transaction[];
  pastEntries: JournalEntry[];
}

export const GoogleSheetsBackupModal: React.FC<GoogleSheetsBackupModalProps> = ({
  isOpen,
  onClose,
  user,
  stocks,
  transactions,
  pastEntries,
}) => {
  const [backupHistory, setBackupHistory] = useState<GoogleBackupRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [customTitle, setCustomTitle] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Confirmation dialog for sync/overwrite
  const [confirmOverwriteModal, setConfirmOverwriteModal] = useState<{
    isOpen: boolean;
    spreadsheetId: string;
    spreadsheetTitle: string;
  }>({
    isOpen: false,
    spreadsheetId: '',
    spreadsheetTitle: '',
  });

  useEffect(() => {
    if (isOpen) {
      setBackupHistory(getSavedBackups());
      setError(null);
      setSuccessMsg(null);
      const defaultDate = new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      setCustomTitle(`OMEGA Financial Ledger & Journal Backup (${defaultDate})`);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreateNewBackup = async () => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const record = await exportToGoogleSheets({
        stocks,
        transactions,
        pastEntries,
        customTitle: customTitle.trim() || undefined,
      });

      setBackupHistory(getSavedBackups());
      setSuccessMsg(`Successfully created backup in your Google Drive: "${record.title}"`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create Google Spreadsheet backup.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSync = async () => {
    const { spreadsheetId, spreadsheetTitle } = confirmOverwriteModal;
    setConfirmOverwriteModal({ isOpen: false, spreadsheetId: '', spreadsheetTitle: '' });
    setSyncingId(spreadsheetId);
    setError(null);
    setSuccessMsg(null);

    try {
      const record = await syncExistingGoogleSheet({
        spreadsheetId,
        stocks,
        transactions,
        pastEntries,
      });

      setBackupHistory(getSavedBackups());
      setSuccessMsg(`Successfully updated "${spreadsheetTitle}" with your latest portfolio and journal state.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update Google Spreadsheet.';
      setError(msg);
    } finally {
      setSyncingId(null);
    }
  };

  const handleCopyLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl rounded-2xl border border-[#262626] bg-[#121212] p-6 shadow-2xl text-[#E5E5E5] max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#262626] pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold text-[#F5F5F5] flex items-center gap-2">
                Google Sheets & Drive Backup
              </h3>
              <p className="text-xs text-[#888888]">
                Safely export and archive your stock ledger, transactions, and reflections to your Google Drive.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#888888] hover:bg-[#1E1E1E] hover:text-[#FFFFFF] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body - Scrollable */}
        <div className="flex-1 overflow-y-auto space-y-5 pr-1 text-sm custom-scrollbar">

          {/* Feedback Messages */}
          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold mb-0.5">Backup Error</p>
                <p>{error}</p>
              </div>
            </div>
          )}

          {successMsg && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold mb-0.5">Success</p>
                <p>{successMsg}</p>
              </div>
            </div>
          )}

          {/* Data Payload Overview */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-[#262626] bg-[#171717] p-3 text-center">
              <p className="text-[11px] text-[#888888] uppercase tracking-wider">Portfolio Assets</p>
              <p className="text-lg font-bold font-mono text-[#F5F5F5] mt-0.5">{stocks.length}</p>
              <p className="text-[10px] text-[#A3A3A3]">Weighted cost basis</p>
            </div>
            <div className="rounded-xl border border-[#262626] bg-[#171717] p-3 text-center">
              <p className="text-[11px] text-[#888888] uppercase tracking-wider">Transactions</p>
              <p className="text-lg font-bold font-mono text-[#F5F5F5] mt-0.5">{transactions.length}</p>
              <p className="text-[10px] text-[#A3A3A3]">Ledger execution logs</p>
            </div>
            <div className="rounded-xl border border-[#262626] bg-[#171717] p-3 text-center">
              <p className="text-[11px] text-[#888888] uppercase tracking-wider">Journal Entries</p>
              <p className="text-lg font-bold font-mono text-[#F5F5F5] mt-0.5">{pastEntries.length}</p>
              <p className="text-[10px] text-[#A3A3A3]">Strategic reflections</p>
            </div>
          </div>

          {/* Primary Action Card: Create New Backup */}
          <div className="rounded-xl border border-[#2E2E2E] bg-[#171717] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#C4A77D] flex items-center gap-1.5">
                <HardDrive className="h-3.5 w-3.5" />
                Create Multi-Tab Google Spreadsheet
              </h4>
              <span className="text-[10px] font-mono text-emerald-400">
                {stocks.length > 0 ? `1 Summary + ${stocks.length} Stock Tabs + 2 Ledgers` : 'Auto-Tabbed'}
              </span>
            </div>

            {/* Tab Structure Breakdown Preview */}
            <div className="rounded-lg border border-[#262626] bg-[#111111] p-2.5 text-xs text-[#999999] space-y-1.5">
              <div className="flex items-center gap-2 text-[#E5E5E5] font-semibold text-[11px]">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                <span>Tab 1: Portfolio Summary & Weighted Average Valuation</span>
              </div>
              <div className="flex items-center gap-2 text-[#D4D4D4] text-[11px] pl-3.5">
                <span>↳ Dedicated Tab per Stock: Detailed buy/sell history, running shares & running avg cost</span>
              </div>
              <div className="flex items-center gap-2 text-[#888888] text-[11px] pl-3.5">
                <span>↳ Master Transaction Ledger & Strategic Journal Reflections</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">
                Backup File Title
              </label>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="Spreadsheet name..."
                className="w-full rounded-lg border border-[#333333] bg-[#0D0D0D] px-3 py-2 text-xs text-[#F5F5F5] placeholder-[#555555] focus:border-[#C4A77D] focus:outline-none"
              />
            </div>

            <button
              onClick={handleCreateNewBackup}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Creating Spreadsheet in Google Drive...</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  <span>Backup All Data to Google Sheets</span>
                </>
              )}
            </button>
          </div>

          {/* Backup History Section */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#A3A3A3] flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-[#C4A77D]" />
              Recent Google Drive Backups
            </h4>

            {backupHistory.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#2A2A2A] bg-[#141414] p-5 text-center text-xs text-[#666666]">
                <FileSpreadsheet className="h-6 w-6 mx-auto mb-1.5 text-[#444444]" />
                <p>No Google Drive backups created yet.</p>
                <p className="text-[11px] text-[#555555] mt-0.5">Click above to generate your first Google Sheets backup.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {backupHistory.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-[#262626] bg-[#161616] p-3 hover:border-[#3A3A3A] transition-colors"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-semibold text-xs text-[#F5F5F5] truncate max-w-sm">
                        {item.title}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-[#888888] font-mono">
                        <span>{new Date(item.timestamp).toLocaleString()}</span>
                        <span>•</span>
                        <span>{item.stocksCount} holdings</span>
                        <span>•</span>
                        <span>{item.transactionsCount} txs</span>
                        <span>•</span>
                        <span>{item.journalCount} notes</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Copy Link Button */}
                      <button
                        onClick={() => handleCopyLink(item.spreadsheetUrl, item.id)}
                        title="Copy Spreadsheet URL"
                        className="rounded-lg border border-[#333333] bg-[#222222] p-1.5 text-[#A3A3A3] hover:text-[#FFFFFF] hover:bg-[#2A2A2A] transition-colors"
                      >
                        {copiedId === item.id ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>

                      {/* Sync / Overwrite Button */}
                      <button
                        onClick={() =>
                          setConfirmOverwriteModal({
                            isOpen: true,
                            spreadsheetId: item.spreadsheetId,
                            spreadsheetTitle: item.title,
                          })
                        }
                        disabled={syncingId === item.spreadsheetId}
                        title="Update this spreadsheet with current live ledger"
                        className="inline-flex items-center gap-1 rounded-lg border border-[#333333] bg-[#222222] px-2.5 py-1 text-[11px] font-semibold text-[#C4A77D] hover:bg-[#2A2A2A] transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className={`h-3 w-3 ${syncingId === item.spreadsheetId ? 'animate-spin' : ''}`} />
                        <span>Sync</span>
                      </button>

                      {/* Open in Google Sheets */}
                      <a
                        href={item.spreadsheetUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors"
                      >
                        <span>Open Sheet</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Privacy & Safe Sync Note */}
          <div className="rounded-xl border border-[#222222] bg-[#141414] p-3 flex items-center gap-2.5 text-xs text-[#888888]">
            <ShieldCheck className="h-4 w-4 text-[#C4A77D] shrink-0" />
            <p>
              Your Google Sheets files are created directly inside your personal Google Drive account.
            </p>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="border-t border-[#262626] pt-3 mt-4 flex items-center justify-end">
          <button
            onClick={onClose}
            className="rounded-xl border border-[#333333] bg-[#1A1A1A] px-4 py-2 text-xs font-semibold text-[#D4D4D4] hover:bg-[#252525] transition-colors"
          >
            Close
          </button>
        </div>

      </div>

      {/* Confirmation Dialog for Destructive Overwrite / Sync */}
      {confirmOverwriteModal.isOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/90">
          <div className="w-full max-w-md rounded-2xl border border-[#333333] bg-[#181818] p-5 shadow-2xl text-[#E5E5E5] space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertCircle className="h-6 w-6 shrink-0" />
              <h4 className="font-serif text-base font-bold text-[#F5F5F5]">
                Update Existing Google Sheet?
              </h4>
            </div>

            <p className="text-xs text-[#A3A3A3] leading-relaxed">
              Are you sure you want to update <span className="text-[#F5F5F5] font-semibold">"{confirmOverwriteModal.spreadsheetTitle}"</span>? This will overwrite the spreadsheet's tabs with your current live portfolio holdings, ledger transactions, and reflections.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setConfirmOverwriteModal({ isOpen: false, spreadsheetId: '', spreadsheetTitle: '' })}
                className="rounded-lg border border-[#333333] bg-[#222222] px-3.5 py-1.5 text-xs font-semibold text-[#D4D4D4] hover:bg-[#2A2A2A] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSync}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-white transition-colors"
              >
                Confirm Update
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
