import { useEffect, useState } from 'react';
import {
  BarChart3, CircleDollarSign, RefreshCw, ShieldCheck, TrendingUp, Users,
  Calendar, CalendarDays, CalendarRange,
} from 'lucide-react';
import { fetchChart, fetchStats, type ChartPeriod, type ChartPoint, type DashboardStats } from '../api/client';

function formatMoney(value: number | string | undefined) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatMoneyShort(value: number) {
  if (value >= 1_000_000_000) return (value / 1_000_000_000).toFixed(1) + ' tỷ';
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(1) + ' tr';
  if (value >= 1_000) return (value / 1_000).toFixed(0) + 'k';
  return value.toString();
}

function Metric({ label, value, icon, color, sub }: {
  label: string; value: string | number; icon: React.ReactNode; color: string; sub?: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-500 font-medium">{label}</span>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white"
          style={{ background: color }}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

const PERIODS: { key: ChartPeriod; label: string; icon: React.ReactNode }[] = [
  { key: 'day',   label: 'Ngày',  icon: <CalendarDays size={14} /> },
  { key: 'week',  label: 'Tuần',  icon: <Calendar size={14} /> },
  { key: 'month', label: 'Tháng', icon: <CalendarRange size={14} /> },
];

export function DashboardPage() {
  const [stats, setStats]         = useState<DashboardStats | null>(null);
  const [chart, setChart]         = useState<ChartPoint[]>([]);
  const [period, setPeriod]       = useState<ChartPeriod>('day');
  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(true);

  const loadStats = () => {
    setLoading(true);
    setError('');
    fetchStats()
      .then(s => setStats(s))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  const loadChart = (p: ChartPeriod) => {
    setChartLoading(true);
    fetchChart(p)
      .then(c => setChart(c.points || []))
      .catch(() => setChart([]))
      .finally(() => setChartLoading(false));
  };

  useEffect(() => { loadStats(); loadChart('day'); }, []);

  const handlePeriod = (p: ChartPeriod) => {
    if (p === period) return;
    setPeriod(p);
    loadChart(p);
  };

  const maxVol  = Math.max(...chart.map(p => Number(p.loanVolume || 0)), 1);
  const maxUsers = Math.max(...chart.map(p => Number(p.newUsers || 0)), 1);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <RefreshCw size={20} className="animate-spin mr-2" style={{ color: '#C82020' }} /> Đang tải...
    </div>
  );

  if (error) return (
    <div className="bg-red-50 text-red-600 rounded-2xl p-6 text-sm border border-red-100">
      {error} <button onClick={loadStats} className="underline ml-2">Thử lại</button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Metric label="Tổng khách hàng" value={stats?.totalUsers ?? 0}
          sub={`+${stats?.todayNewUsers ?? 0} hôm nay`}
          icon={<Users size={16} />} color="linear-gradient(135deg,#C82020,#8B0A0A)" />
        <Metric label="Chờ duyệt KYC" value={stats?.pendingKycCount ?? 0}
          icon={<ShieldCheck size={16} />} color="linear-gradient(135deg,#E8A030,#C47820)" />
        <Metric label="Tổng khoản vay" value={stats?.totalLoans ?? 0}
          sub={`${stats?.pendingLoans ?? 0} chờ duyệt · ${stats?.activeLoans ?? 0} active`}
          icon={<CircleDollarSign size={16} />} color="linear-gradient(135deg,#C82020,#E84A20)" />
        <Metric label="Tổng funded" value={formatMoney(stats?.totalFundedVolume)}
          sub={`+${formatMoney(stats?.todayLoanVolume)} hôm nay`}
          icon={<BarChart3 size={16} />} color="linear-gradient(135deg,#27AE60,#1E8449)" />
      </div>

      {/* Chart */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        {/* Header + Tabs */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-gray-400" />
            <h3 className="font-bold text-gray-800">Biểu đồ hoạt động</h3>
          </div>
          <div className="flex rounded-xl overflow-hidden border border-gray-200 text-sm">
            {PERIODS.map(p => (
              <button key={p.key}
                onClick={() => handlePeriod(p.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 transition-colors"
                style={period === p.key
                  ? { background: '#C82020', color: '#fff' }
                  : { background: '#fff', color: '#6b7280' }}>
                {p.icon}{p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chart body */}
        {chartLoading ? (
          <div className="flex items-center justify-center h-48 text-gray-400">
            <RefreshCw size={16} className="animate-spin mr-2" style={{ color: '#C82020' }} /> Đang tải...
          </div>
        ) : chart.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">Chưa có dữ liệu</p>
        ) : (
          <div className="space-y-2">
            {chart.map((point) => {
              const volPct  = Math.max(2, (Number(point.loanVolume || 0) / maxVol) * 100);
              const userPct = Math.max(2, (Number(point.newUsers || 0) / maxUsers) * 100);
              return (
                <div key={`${point.date}-${point.label}`} className="group">
                  <div className="flex items-center gap-2 text-xs mb-0.5">
                    <span className="w-20 shrink-0 text-gray-400 text-right font-medium">
                      {point.label || point.date}
                    </span>
                    <div className="flex-1 space-y-1">
                      {/* Volume bar */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-red-50 rounded-full h-4 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-300"
                            style={{ width: `${volPct}%`, background: 'linear-gradient(90deg,#C82020,#E84A20)' }} />
                        </div>
                        <span className="w-24 shrink-0 text-gray-700 font-medium text-right">
                          {formatMoneyShort(Number(point.loanVolume || 0))}
                        </span>
                      </div>
                      {/* Users bar */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-blue-50 rounded-full h-2 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-300"
                            style={{ width: `${userPct}%`, background: 'linear-gradient(90deg,#3B82F6,#1D4ED8)' }} />
                        </div>
                        <span className="w-24 shrink-0 text-gray-400 text-right">
                          {point.newUsers} KH · {point.newLoans} vay
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100 text-xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full inline-block" style={{ background: 'linear-gradient(90deg,#C82020,#E84A20)' }} />
            Giá trị khoản vay
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full inline-block" style={{ background: 'linear-gradient(90deg,#3B82F6,#1D4ED8)' }} />
            Khách hàng mới · Khoản vay mới
          </span>
        </div>
      </div>
    </div>
  );
}
