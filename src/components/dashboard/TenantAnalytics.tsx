import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, DollarSign, Layers, PieChart, CheckCircle2 } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export const TenantAnalytics: React.FC = () => {
  const { tenant } = useAuth();
  const [analytics, setAnalytics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    api
      .getTenantAnalytics()
      .then(setAnalytics)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="py-16 text-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
        <p className="text-xs text-slate-500">Aggregating shop analytics...</p>
      </div>
    );
  }

  const currency = tenant?.settings?.currency_symbol || 'GH₵';
  const totalBwColor = (analytics?.colorVsBw?.color || 0) + (analytics?.colorVsBw?.bw || 0) || 1;
  const colorPercent = Math.round(((analytics?.colorVsBw?.color || 0) / totalBwColor) * 100);
  const bwPercent = 100 - colorPercent;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          Business Performance & Job Analytics
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Detailed metrics on print volumes, revenue generation, and service popularity.
        </p>
      </div>

      {/* Top 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Total Revenue Collected
          </span>
          <div className="text-2xl font-black text-slate-900">
            {currency} {analytics?.totalRevenue?.toFixed(2) || '0.00'}
          </div>
          <span className="text-[11px] text-emerald-600 font-semibold mt-1 inline-block">
            Paid & settled orders
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Total Document Orders
          </span>
          <div className="text-2xl font-black text-slate-900">{analytics?.totalJobs || 0}</div>
          <span className="text-[11px] text-blue-600 font-semibold mt-1 inline-block">
            Digital QR submissions
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Average Job Value
          </span>
          <div className="text-2xl font-black text-slate-900">
            {currency} {analytics?.averageJobValue?.toFixed(2) || '0.00'}
          </div>
          <span className="text-[11px] text-purple-600 font-semibold mt-1 inline-block">
            Per customer transaction
          </span>
        </div>
      </div>

      {/* Breakdown Grids */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Colour vs Black & White Ratio */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-blue-600" />
            <span>Colour Mode Distribution</span>
          </h3>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                <span>Black & White Laser</span>
                <span>
                  {analytics?.colorVsBw?.bw || 0} jobs ({bwPercent}%)
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-slate-800 rounded-full transition-all"
                  style={{ width: `${bwPercent}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                <span>Full Colour Laser</span>
                <span>
                  {analytics?.colorVsBw?.color || 0} jobs ({colorPercent}%)
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all"
                  style={{ width: `${colorPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Paper Sizes */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>Paper Size Breakdown</span>
          </h3>

          <div className="space-y-2 text-xs">
            {Object.entries(analytics?.paperSizes || {}).map(([size, count]: any) => (
              <div
                key={size}
                className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between"
              >
                <span className="font-bold text-slate-800">{size} Format</span>
                <span className="font-semibold text-slate-600">{count} jobs</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
