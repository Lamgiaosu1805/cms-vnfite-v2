import { useEffect, useState } from 'react';
import { BarChart3, CircleDollarSign, RefreshCw, ShieldCheck, TrendingUp, Users } from 'lucide-react';
import { fetchChart, fetchStats, type ChartPoint, type DashboardStats } from '../api/client';

function formatMoney(value: number | string | undefined) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function Metric({ label, value, icon, sub }: { label: string; value: string | number; icon: React.ReactNode; sub?: string }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500">{label}</span>
        <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function maxVolume(points: ChartPoint[]) {
  return Math.max(...points.map((p) => Number(p.loanVolume || 0)), 0);
}

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chart, setChart] = useState<ChartPoint[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([fetchStats(), fetchChart()])
      .then(([s, c]) => {
        setStats(s);
        setChart(c.points || []);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <RefreshCw size={20} className="animate-spin mr-2" /> Đang tải...
    </div>
  );

  if (error) return (
    <div className="bg-red-50 text-red-600 rounded-xl p-6 text-sm">
      {error} <button onClick={load} className="underline ml-2">Thử lại</button>
    </div>
  );

  const max = maxVolume(chart);

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Metric label="Tổng khách hàng" value={stats?.totalUsers ?? 0} icon={<Users size={18} />} />
        <Metric label="Chờ duyệt KYC" value={stats?.pendingKycCount ?? 0} icon={<ShieldCheck size={18} />} />
        <Metric label="Tổng khoản vay" value={stats?.totalLoans ?? 0} icon={<CircleDollarSign size={18} />} />
        <Metric
          label="Tổng giá trị funded"
          value={formatMoney(stats?.totalFundedVolume)}
          icon={<BarChart3 size={18} />}
        />
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-gray-800">Hoạt động 30 ngày gần nhất</h3>
          <TrendingUp size={18} className="text-gray-400" />
        </div>
        <div className="space-y-2.5">
          {chart.length === 0 && (
            <p className="text-sm text-gray-400 py-4 text-center">Chưa có dữ liệu</p>
          )}
          {chart.map((point) => {
            const width = max > 0 ? Math.max(2, (Number(point.loanVolume || 0) / max) * 100) : 2;
            return (
              <div key={point.date} className="flex items-center gap-3 text-sm">
                <span className="w-24 shrink-0 text-gray-400 text-right">{point.date}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                    style={{ width: `${width}%` }}
                  />
                </div>
                <span className="w-32 shrink-0 text-gray-600 font-medium">
                  {formatMoney(point.loanVolume)}
                </span>
                <span className="text-xs text-gray-400 w-16 shrink-0">
                  {point.newLoans} vay
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
