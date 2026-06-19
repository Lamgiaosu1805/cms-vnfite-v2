import { useEffect, useRef, useState } from 'react';
import {
  BarChart3, Bell, CircleDollarSign, RefreshCw, Send, ShieldCheck, Smartphone, TrendingUp, Users,
} from 'lucide-react';
import {
  fetchChart, fetchStats, getFcmDeviceCount, sendTestPush,
  type ChartPeriod, type ChartPoint, type DashboardStats,
} from '../api/client';

// ─── Dark-mode observer ───────────────────────────────────────────────────────

function useDarkMode() {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark'),
  );
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsDark(document.documentElement.classList.contains('dark')),
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMoney(value: number | string | undefined) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })
    .format(Number(value || 0));
}

function shortMoney(v: number) {
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1) + 'B';
  if (v >= 1_000_000)     return (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000)         return (v / 1_000).toFixed(0) + 'K';
  return v > 0 ? v.toString() : '';
}

// ─── Metric card ──────────────────────────────────────────────────────────────

function Metric({ label, value, icon, color, sub }: {
  label: string; value: string | number; icon: React.ReactNode; color: string; sub?: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{label}</span>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ background: color }}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Period tabs ──────────────────────────────────────────────────────────────

const PERIODS: { key: ChartPeriod; label: string }[] = [
  { key: 'week',  label: 'Tuần' },
  { key: 'month', label: 'Tháng' },
  { key: 'year',  label: 'Năm' },
];

// ─── Bar chart ────────────────────────────────────────────────────────────────

type ChartMetricKey = 'loanVolume' | 'newUsers';

function SingleMetricBarChart({
  points,
  period,
  isDark,
  metric,
  title,
  subtitle,
  gradient,
  formatValue,
  formatTick,
}: {
  points: ChartPoint[];
  period: ChartPeriod;
  isDark: boolean;
  metric: ChartMetricKey;
  title: string;
  subtitle: string;
  gradient: string;
  formatValue: (value: number) => string;
  formatTick: (value: number) => string;
}) {
  const [tooltip, setTooltip] = useState<{ idx: number; x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const maxValue = Math.max(...points.map(p => Number(p[metric] || 0)), 1);
  const yTicks = [1, 0.75, 0.5, 0.25, 0].map(r => ({ pct: r, value: maxValue * r }));
  const gapX = period === 'month' ? 'gap-2' : 'gap-3';
  const active = tooltip ? points[tooltip.idx] : null;
  const dimColor = isDark ? '#374151' : '#E5E7EB';

  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/30 p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100">{title}</h4>
          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{subtitle}</p>
        </div>
        <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: gradient }} />
      </div>

      <div className="relative select-none" ref={containerRef}>
        {active && (
          <div
            className="absolute z-20 rounded-xl bg-gray-900 px-3 py-2 text-xs text-white shadow-lg pointer-events-none whitespace-nowrap dark:bg-gray-700"
            style={{ left: tooltip!.x, top: tooltip!.y - 8, transform: 'translate(-50%, -100%)' }}>
            <div className="mb-1 font-semibold">{active.label} {period === 'week' ? `(${active.date})` : ''}</div>
            <div className="flex flex-col gap-0.5">
              <span>{title}: {formatValue(Number(active[metric] || 0))}</span>
              {metric === 'loanVolume' && <span>Số khoản gọi vốn mới: {active.newLoans}</span>}
            </div>
            <div className="absolute left-1/2 bottom-[-5px] h-0 w-0 -translate-x-1/2"
              style={{ borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: `5px solid ${isDark ? '#374151' : '#111827'}` }} />
          </div>
        )}

        <div className="flex gap-4">
          <div className="flex shrink-0 flex-col justify-between pb-6 text-right text-xs text-gray-400 dark:text-gray-500" style={{ height: 170, width: 56 }}>
            {yTicks.map(t => (
              <span key={t.pct}>{formatTick(t.value)}</span>
            ))}
          </div>

          <div className="flex-1 overflow-x-auto">
            <div className={`flex ${gapX} items-end`} style={{ minWidth: 'max-content' }}>
              {points.map((p, i) => {
                const value = Number(p[metric] || 0);
                const barH = Math.max(3, (value / maxValue) * 145);
                const dim = p.future;
                const colW = period === 'month' ? 28 : period === 'year' ? 38 : 46;
                const barW = period === 'month' ? 18 : 24;

                return (
                  <div key={`${metric}-${p.date}-${i}`}
                    className="group flex shrink-0 cursor-pointer flex-col items-center"
                    style={{ width: colW }}
                    onMouseEnter={e => {
                      const rect = containerRef.current?.getBoundingClientRect();
                      const el = e.currentTarget.getBoundingClientRect();
                      if (rect) setTooltip({ idx: i, x: el.left + el.width / 2 - rect.left + 56, y: el.top - rect.top });
                    }}
                    onMouseLeave={() => setTooltip(null)}>
                    <div className="flex w-full items-end justify-center" style={{ height: 145 }}>
                      <div className="rounded-t-lg transition-all duration-200 group-hover:brightness-95"
                        style={{ height: barH, width: barW, background: dim ? dimColor : gradient }} />
                    </div>
                    <div className={`mt-1 w-full text-center font-medium ${dim ? 'text-gray-300 dark:text-gray-600' : 'text-gray-400 dark:text-gray-500'}`}
                      style={{ fontSize: period === 'month' ? 9 : 11 }}>
                      {p.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Test Push Panel ──────────────────────────────────────────────────────────

function TestPushPanel() {
  const [deviceCount, setDeviceCount]   = useState<number | null>(null);
  const [open, setOpen]                 = useState(false);
  const [title, setTitle]               = useState('Thông báo từ VNFITE');
  const [body, setBody]                 = useState('Đây là thông báo test từ hệ thống VNFITE.');
  const [sending, setSending]           = useState(false);
  const [result, setResult]             = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    getFcmDeviceCount()
      .then(r => setDeviceCount(r.count))
      .catch(() => setDeviceCount(null));
  }, []);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const res = await sendTestPush(title.trim(), body.trim());
      const msg = res.message
        ? res.message
        : `Đã gửi đến ${res.sentTo} thiết bị.`;
      setResult({ ok: true, msg });
      setDeviceCount(res.sentTo);
    } catch (e: unknown) {
      setResult({ ok: false, msg: e instanceof Error ? e.message : 'Gửi thất bại.' });
    } finally {
      setSending(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    setResult(null);
    // Refresh device count mỗi lần mở
    getFcmDeviceCount()
      .then(r => setDeviceCount(r.count))
      .catch(() => {});
  };

  return (
    <>
      {/* Trigger card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
              style={{ background: 'linear-gradient(135deg,#C82020,#8B0A0A)' }}>
              <Bell size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Gửi thông báo test</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 flex items-center gap-1">
                <Smartphone size={11} />
                {deviceCount === null
                  ? 'Đang tải...'
                  : deviceCount === 0
                    ? 'Chưa có thiết bị đăng ký'
                    : `${deviceCount} thiết bị đang đăng ký`}
              </p>
            </div>
          </div>
          <button
            onClick={handleOpen}
            disabled={deviceCount === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg,#C82020,#8B0A0A)' }}>
            <Send size={14} /> Gửi test
          </button>
        </div>
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={e => { if (e.target === e.currentTarget) { setOpen(false); setResult(null); } }}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell size={18} style={{ color: '#C82020' }} />
                <h3 className="font-bold text-gray-900 dark:text-gray-100">Gửi thông báo test</h3>
              </div>
              <button onClick={() => { setOpen(false); setResult(null); }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg leading-none">✕</button>
            </div>

            {/* Device count badge */}
            <div className="flex items-center gap-2 text-xs bg-gray-50 dark:bg-gray-700/50 rounded-xl px-3 py-2 text-gray-500 dark:text-gray-400">
              <Smartphone size={12} />
              {deviceCount === null ? 'Đang tải...' : deviceCount === 0
                ? 'Chưa có thiết bị nào đang đăng ký FCM token'
                : `Sẽ gửi đến ${deviceCount} thiết bị đang đăng ký`}
            </div>

            {/* Form */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Tiêu đề</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  maxLength={100}
                  placeholder="Tiêu đề thông báo..."
                  className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2"
                  style={{ '--tw-ring-color': '#C82020' } as React.CSSProperties} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Nội dung</label>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Nội dung thông báo..."
                  className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 resize-none"
                  style={{ '--tw-ring-color': '#C82020' } as React.CSSProperties} />
              </div>
            </div>

            {/* Result banner */}
            {result && (
              <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
                result.ok
                  ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-100 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800'
              }`}>
                {result.ok ? '✅ ' : '❌ '}{result.msg}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button onClick={() => { setOpen(false); setResult(null); }}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                Đóng
              </button>
              <button
                onClick={handleSend}
                disabled={sending || !title.trim() || !body.trim() || deviceCount === 0}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg,#C82020,#8B0A0A)' }}>
                {sending ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                {sending ? 'Đang gửi...' : 'Gửi ngay'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const isDark = useDarkMode();
  const [stats, setStats]               = useState<DashboardStats | null>(null);
  const [chart, setChart]               = useState<ChartPoint[]>([]);
  const [period, setPeriod]             = useState<ChartPeriod>('week');
  const [chartLoading, setChartLoading] = useState(false);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');

  const loadStats = () => {
    setLoading(true);
    setError('');
    fetchStats()
      .then(s => setStats(s))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  const loadChart = (p: ChartPeriod) => {
    setChartLoading(true);
    fetchChart(p)
      .then(c => setChart(c.points || []))
      .catch(() => setChart([]))
      .finally(() => setChartLoading(false));
  };

  useEffect(() => { loadStats(); loadChart('week'); }, []);

  const handlePeriod = (p: ChartPeriod) => {
    if (p === period) return;
    setPeriod(p);
    loadChart(p);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500">
      <RefreshCw size={20} className="animate-spin mr-2" style={{ color: '#C82020' }} /> Đang tải...
    </div>
  );

  if (error) return (
    <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl p-6 text-sm border border-red-100 dark:border-red-800">
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

      {/* Chart card */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-gray-400 dark:text-gray-500" />
            <h3 className="font-bold text-gray-800 dark:text-gray-100">Biểu đồ hoạt động</h3>
          </div>
          {/* Period tabs */}
          <div className="flex overflow-hidden rounded-xl border border-gray-200 text-sm dark:border-gray-600">
            {PERIODS.map(p => (
              <button key={p.key} onClick={() => handlePeriod(p.key)}
                className={`px-4 py-1.5 font-medium transition-colors ${
                  period === p.key
                    ? 'text-white'
                    : 'bg-white text-gray-500 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                }`}
                style={period === p.key ? { background: '#C82020' } : undefined}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Charts */}
        {chartLoading ? (
          <div className="flex h-44 items-center justify-center text-gray-400 dark:text-gray-500">
            <RefreshCw size={16} className="mr-2 animate-spin" style={{ color: '#C82020' }} /> Đang tải...
          </div>
        ) : chart.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">Chưa có dữ liệu</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <SingleMetricBarChart
              points={chart}
              period={period}
              isDark={isDark}
              metric="loanVolume"
              title="Giá trị khoản gọi vốn"
              subtitle="Tổng giá trị khoản phát sinh theo kỳ"
              gradient="linear-gradient(180deg,#E84A20,#C82020)"
              formatValue={formatMoney}
              formatTick={shortMoney}
            />
            <SingleMetricBarChart
              points={chart}
              period={period}
              isDark={isDark}
              metric="newUsers"
              title="Khách hàng mới"
              subtitle="Số tài khoản khách hàng tạo mới"
              gradient="linear-gradient(180deg,#60A5FA,#2563EB)"
              formatValue={value => `${Math.round(value)} khách hàng`}
              formatTick={value => (value > 0 ? Math.round(value).toString() : '')}
            />
          </div>
        )}
      </div>

      {/* Test push notification */}
      <TestPushPanel />
    </div>
  );
}
