import React, { useState } from 'react';
import { Search, ArrowRight } from 'lucide-react';
import { api } from '../../services/api';
import { PrintFlowIcon } from '../common/PrintFlowLogo';

interface TrackJobLookupProps {
  onFoundJob: (jobNumber: string, token: string) => void;
  onBackToShop: () => void;
}

export const TrackJobLookup: React.FC<TrackJobLookupProps> = ({ onFoundJob, onBackToShop }) => {
  const [jobNumber, setJobNumber] = useState<string>('');
  const [token, setToken] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobNumber.trim()) {
      setError('Please enter your Job Number.');
      return;
    }
    setIsSearching(true);
    setError(null);

    try {
      // Validate that the job exists
      await api.trackJob(jobNumber.trim(), token.trim());
      onFoundJob(jobNumber.trim(), token.trim());
    } catch (err: any) {
      setError(err.message || 'No active job found with these details.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-8 sm:py-12">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 p-1 flex items-center justify-center mx-auto mb-4 shadow-xs">
          <PrintFlowIcon className="w-9 h-9" />
        </div>

        <h1 className="text-xl font-black text-center text-slate-900 tracking-tight mb-1">
          Track Your Print Job
        </h1>
        <p className="text-xs text-center text-slate-500 mb-6">
          Enter the Job Number provided on your counter receipt or confirmation screen.
        </p>

        <form onSubmit={handleLookup} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Job Number <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={jobNumber}
              onChange={(e) => setJobNumber(e.target.value.toUpperCase())}
              placeholder="e.g. PF-2026-000481"
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm font-bold tracking-wider text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none uppercase"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Security Token (Optional)
            </label>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="e.g. trk_xxxxxx"
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              Embedded in your receipt link to protect private documents.
            </span>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSearching}
            className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-xs transition-colors"
          >
            {isSearching ? (
              <span>Looking up job...</span>
            ) : (
              <>
                <span>Track Live Progress</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={onBackToShop}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800"
          >
            Return to Printing Press Public Page
          </button>
        </div>
      </div>
    </div>
  );
};
