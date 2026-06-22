import { useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, RefreshCw, Search } from 'lucide-react';
import {
  fetchSystemTransactions,
  type CmsSystemTransaction,
  type PagedResponse,
} from '../api/client';

const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

type Filters = {
  search: string;
  type: string;
  status: string;
  from: string;
  to: string;
};

const EMPTY_FILTERS: Filters = { search: '', type: '', status: '', from: '', to: '' };

function parseApiDateTime(value: string): Date {
  const normalized = value.trim().replace(' ', 'T').replace(/(\.\d{3})\d+/, '$1');
  return new Date(/(Z|[+-]\d{2}:?\d{2})$/i.test(normalized) ? normalized : `${normalized}+07:00`);
}

function formatDateTime(value: string): string {
  const date = parseApiDateTime(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('vi-VN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour12: false, timeZone: VIETNAM_TIME_ZONE,
  });
}

function formatMoney(value: number | null | undefined): string {
  if (value == null) return '—';
  return `${new Intl.NumberFormat('vi-VN').format(value)} đ`;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Đang xử lý',
  SUCCESS: 'Thành công',
  FAILED: 'Thất bại',
};

const STATUS_CLASS: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/25 dark:text-amber-300 dark:border-amber-800',
  SUCCESS: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-300 dark:border-emerald-800',
  FAILED: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/25 dark:text-red-300 dark:border-red-800',
};

export function TransactionsPage() {
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState<PagedResponse<CmsSystemTransaction> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetchSystemTransactions({ ...filters, page, size: 20 })
      .then(result => {
        if (!active) return;
        setData(result);
        setError('');
      })
      .catch(err => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Không thể tải danh sách giao dịch');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filters, page, reloadKey]);

  const pageDepositTotal = useMemo(() =>
    (data?.content ?? [])
      .filter(item => item.type === 'DEPOSIT' && item.status === 'SUCCESS')
      .reduce((sum, item) => sum + item.amount, 0),
  [data]);

  const pageWithdrawTotal = useMemo(() =>
    (data?.content ?? [])
      .filter(item => item.type === 'WITHDRAW' && item.status === 'SUCCESS')
      .reduce((sum, item) => sum + item.amount, 0),
  [data]);

  function updateDraft(key: keyof Filters, value: string) {
    setDraft(current => ({ ...current, [key]: value }));
  }

  function applyFilters() {
    setLoading(true);
    setPage(0);
    setFilters({ ...draft, search: draft.search.trim() });
  }

  function resetFilters() {
    setDraft(EMPTY_FILTERS);
    setLoading(true);
    setPage(0);
    setFilters(EMPTY_FILTERS);
  }

  function changePage(next: number) {
    setLoading(true);
    setPage(next);
  }

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Summary label="Tổng giao dịch theo bộ lọc" value={new Intl.NumberFormat('vi-VN').format(data?.totalElements ?? 0)} />
        <Summary label="Tiền nạp thành công trên trang" value={formatMoney(pageDepositTotal)} tone="in" />
        <Summary label="Tiền rút thành công trên trang" value={formatMoney(pageWithdrawTotal)} tone="out" />
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <form
          className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(260px,1fr)_180px_180px_160px_160px_auto]"
          onSubmit={event => { event.preventDefault(); applyFilters(); }}
        >
          <label className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
            <input
              value={draft.search}
              onChange={event => updateDraft('search', event.target.value)}
              placeholder="Mã GD, tài khoản VNF, nội dung..."
              className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-3 text-sm text-gray-800 outline-none focus:border-red-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
            />
          </label>
          <select value={draft.type} onChange={event => updateDraft('type', event.target.value)} className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
            <option value="">Tất cả loại</option>
            <option value="DEPOSIT">Nạp tiền</option>
            <option value="WITHDRAW">Rút tiền</option>
          </select>
          <select value={draft.status} onChange={event => updateDraft('status', event.target.value)} className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
            <option value="">Tất cả trạng thái</option>
            <option value="SUCCESS">Thành công</option>
            <option value="PENDING">Đang xử lý</option>
            <option value="FAILED">Thất bại</option>
          </select>
          <input type="date" aria-label="Từ ngày" value={draft.from} onChange={event => updateDraft('from', event.target.value)} className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200" />
          <input type="date" aria-label="Đến ngày" value={draft.to} onChange={event => updateDraft('to', event.target.value)} className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200" />
          <div className="flex gap-2">
            <button type="submit" className="h-10 rounded-lg bg-[#C82020] px-4 text-sm font-medium text-white transition hover:bg-[#A91515]">Lọc</button>
            <button type="button" onClick={resetFilters} className="h-10 rounded-lg border border-gray-200 px-3 text-sm text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">Xóa</button>
            <button type="button" title="Tải lại" onClick={() => { setLoading(true); setReloadKey(value => value + 1); }} className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </form>
      </section>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">{error}</div>}

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="min-w-[1180px] w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800/70 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3 text-left">Thời gian</th>
                <th className="px-4 py-3 text-left">Khách hàng</th>
                <th className="px-4 py-3 text-left">Tài khoản VNF</th>
                <th className="px-4 py-3 text-left">Loại</th>
                <th className="px-4 py-3 text-right">Số tiền</th>
                <th className="px-4 py-3 text-left">Nội dung</th>
                <th className="px-4 py-3 text-left">Mã tham chiếu</th>
                <th className="px-4 py-3 text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading && !data ? (
                <tr><td colSpan={8} className="px-4 py-14 text-center text-gray-400">Đang tải giao dịch...</td></tr>
              ) : data?.content.length ? data.content.map(transaction => (
                <TransactionRow key={transaction.id} transaction={transaction} />
              )) : (
                <tr><td colSpan={8} className="px-4 py-14 text-center text-gray-400 dark:text-gray-500">Không có giao dịch phù hợp</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm dark:border-gray-800">
          <span className="text-gray-500 dark:text-gray-400">Trang {(data?.page ?? data?.number ?? page) + 1}/{Math.max(data?.totalPages ?? 1, 1)}</span>
          <div className="flex gap-2">
            <button disabled={page <= 0 || loading} onClick={() => changePage(page - 1)} className="flex h-9 items-center gap-1 rounded-lg border border-gray-200 px-3 text-gray-600 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300"><ChevronLeft size={15} /> Trước</button>
            <button disabled={!data || page >= data.totalPages - 1 || loading} onClick={() => changePage(page + 1)} className="flex h-9 items-center gap-1 rounded-lg border border-gray-200 px-3 text-gray-600 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300">Sau <ChevronRight size={15} /></button>
          </div>
        </div>
      </section>
    </div>
  );
}

function Summary({ label, value, tone }: { label: string; value: string; tone?: 'in' | 'out' }) {
  const valueClass = tone === 'in' ? 'text-emerald-600 dark:text-emerald-400' : tone === 'out' ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-50';
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-1 text-xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}

function TransactionRow({ transaction }: { transaction: CmsSystemTransaction }) {
  const incoming = transaction.type === 'DEPOSIT';
  const reference = transaction.referenceId || transaction.externalRef || transaction.id;
  return (
    <tr className="text-gray-700 transition hover:bg-gray-50/80 dark:text-gray-200 dark:hover:bg-gray-800/40">
      <td className="whitespace-nowrap px-4 py-3 text-gray-500 dark:text-gray-400">{formatDateTime(transaction.createdAt)}</td>
      <td className="px-4 py-3">
        <p className="max-w-48 truncate font-medium text-gray-900 dark:text-gray-100" title={transaction.customerName || transaction.userId || ''}>{transaction.customerName || 'Chưa có tên'}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">{transaction.customerPhone || transaction.userId || '—'}</p>
      </td>
      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-300">{transaction.vnfAccountNo || '—'}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1.5 font-medium ${incoming ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
          {incoming ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
          {incoming ? 'Nạp tiền' : 'Rút tiền'}
        </span>
      </td>
      <td className={`whitespace-nowrap px-4 py-3 text-right font-bold ${incoming ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
        {incoming ? '+' : '-'}{formatMoney(transaction.amount)}
      </td>
      <td className="px-4 py-3"><p className="max-w-64 truncate text-gray-600 dark:text-gray-300" title={transaction.description || ''}>{transaction.description || '—'}</p></td>
      <td className="px-4 py-3"><p className="max-w-48 truncate font-mono text-xs text-gray-500 dark:text-gray-400" title={reference}>{reference}</p></td>
      <td className="px-4 py-3 text-center">
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[transaction.status] ?? 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}>
          {STATUS_LABEL[transaction.status] ?? transaction.status}
        </span>
      </td>
    </tr>
  );
}
