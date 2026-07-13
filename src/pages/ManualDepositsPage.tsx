import { useEffect, useState } from 'react';
import { Check, Eye, RefreshCw, X } from 'lucide-react';
import {
  approveManualDeposit,
  fetchFileBlob,
  fetchManualDeposits,
  rejectManualDeposit,
  type CmsManualDepositRequest,
  type PagedResponse,
} from '../api/client';

const money = (value: number) => `${new Intl.NumberFormat('vi-VN').format(value)} đ`;
const dateTime = (value: string | null) => value ? new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric',
}).format(new Date(value)) : '—';

const STATUS: Record<CmsManualDepositRequest['status'], { label: string; classes: string }> = {
  PENDING: { label: 'Chờ duyệt', classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  APPROVED: { label: 'Đã duyệt', classes: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  REJECTED: { label: 'Từ chối', classes: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
};

export function ManualDepositsPage({ onActionDone }: { onActionDone?: () => void }) {
  const [data, setData] = useState<PagedResponse<CmsManualDepositRequest> | null>(null);
  const [status, setStatus] = useState('PENDING');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [billPreview, setBillPreview] = useState<{ item: CmsManualDepositRequest; url: string | null } | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    fetchManualDeposits(status, page)
      .then(result => { if (active) setData(result); })
      .catch((err: Error) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [status, page, reload]);

  async function viewBill(item: CmsManualDepositRequest) {
    setBillPreview({ item, url: null });
    try {
      const url = await fetchFileBlob(item.billFileId);
      setBillPreview(current => current?.item.id === item.id ? { item, url } : current);
    } catch (err) {
      setBillPreview(null);
      setError(err instanceof Error ? err.message : 'Không thể mở bill.');
    }
  }

  function closeBillPreview() {
    setBillPreview(current => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return null;
    });
  }

  useEffect(() => {
    if (!billPreview) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeBillPreview();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [billPreview]);

  async function approve(item: CmsManualDepositRequest) {
    if (!window.confirm(`Duyệt bill nạp ${money(item.amount)}? Tiền sẽ được cộng ngay vào ví VNFITE của khách.`)) return;
    setActingId(item.id);
    setError('');
    try { await approveManualDeposit(item.id); setReload(value => value + 1); onActionDone?.(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Không thể duyệt bill.'); }
    finally { setActingId(null); }
  }

  async function reject(item: CmsManualDepositRequest) {
    const reason = window.prompt('Lý do từ chối bill:', '');
    if (reason === null) return;
    if (!reason.trim()) { setError('Vui lòng nhập lý do từ chối.'); return; }
    setActingId(item.id);
    setError('');
    try { await rejectManualDeposit(item.id, reason.trim()); setReload(value => value + 1); onActionDone?.(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Không thể từ chối bill.'); }
    finally { setActingId(null); }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Duyệt bill nạp tiền</h2>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Bill chuyển khoản trực tiếp vào tài khoản công ty. Chỉ duyệt khi đã đối chiếu tiền nhận thực tế.</p>
        </div>
        <button onClick={() => setReload(value => value + 1)} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Tải lại
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {[['PENDING', 'Chờ duyệt'], ['APPROVED', 'Đã duyệt'], ['REJECTED', 'Từ chối'], ['', 'Tất cả']].map(([value, label]) => (
          <button key={value || 'all'} onClick={() => { setStatus(value); setPage(0); }} className={`rounded-full px-3 py-1.5 text-sm font-medium ${status === value ? 'bg-red-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'}`}>{label}</button>
        ))}
      </div>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="min-w-[1050px] w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800/70 dark:text-gray-400"><tr>
              <th className="px-4 py-3 text-left">Thời gian</th><th className="px-4 py-3 text-left">Khách hàng</th><th className="px-4 py-3 text-left">Tư cách ví</th><th className="px-4 py-3 text-right">Số tiền</th><th className="px-4 py-3 text-left">Bill</th><th className="px-4 py-3 text-center">Trạng thái</th><th className="px-4 py-3 text-left">Xử lý</th><th className="px-4 py-3 text-right">Thao tác</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {data?.content.map(item => {
                const current = STATUS[item.status];
                return <tr key={item.id} className="text-gray-700 dark:text-gray-200">
                  <td className="whitespace-nowrap px-4 py-3 text-gray-500 dark:text-gray-400">{dateTime(item.createdAt)}</td>
                  <td className="px-4 py-3"><p className="font-medium text-gray-900 dark:text-gray-100">{item.customerName || 'Chưa có tên'}</p><p className="text-xs text-gray-400 dark:text-gray-500">{item.customerPhone || item.userId}</p></td>
                  <td className="px-4 py-3">{item.ownerType === 'BUSINESS' ? 'Doanh nghiệp' : 'Cá nhân'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-gray-900 dark:text-gray-100">{money(item.amount)}</td>
                  <td className="px-4 py-3"><button onClick={() => viewBill(item)} className="inline-flex items-center gap-1 text-red-600 hover:underline dark:text-red-400"><Eye size={15} /><span>Xem bill</span></button></td>
                  <td className="px-4 py-3 text-center"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${current.classes}`}>{current.label}</span></td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                    {item.rejectionReason && <p className="text-red-600 dark:text-red-400">{item.rejectionReason}</p>}
                    {item.reviewedBy
                      ? <p className={item.rejectionReason ? 'mt-1' : ''}>{item.reviewedBy} · {dateTime(item.reviewedAt)}</p>
                      : item.rejectionReason ? <p className="mt-1 text-gray-400 dark:text-gray-500">Chưa có thông tin người xử lý</p> : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">{item.status === 'PENDING' && <div className="inline-flex gap-2"><button disabled={actingId === item.id} onClick={() => reject(item)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/60 dark:text-red-400"><X size={14} /> Từ chối</button><button disabled={actingId === item.id} onClick={() => approve(item)} className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"><Check size={14} /> Duyệt</button></div>}</td>
                </tr>;
              })}
              {!loading && !data?.content.length && <tr><td colSpan={8} className="px-4 py-14 text-center text-gray-400 dark:text-gray-500">Không có bill nạp tiền phù hợp.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm dark:border-gray-800"><span className="text-gray-500 dark:text-gray-400">Trang {(data?.page ?? page) + 1}/{Math.max(data?.totalPages ?? 1, 1)}</span><div className="flex gap-2"><button disabled={page === 0 || loading} onClick={() => setPage(value => value - 1)} className="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-40 dark:border-gray-700">Trước</button><button disabled={!data || page >= data.totalPages - 1 || loading} onClick={() => setPage(value => value + 1)} className="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-40 dark:border-gray-700">Sau</button></div></div>
      </div>

      {billPreview && (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          onMouseDown={event => { if (event.target === event.currentTarget) closeBillPreview(); }}
          role="dialog"
        >
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-950">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
              <div className="min-w-0">
                <h3 className="truncate text-base font-bold text-gray-900 dark:text-gray-50">Bill chuyển khoản</h3>
                <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{billPreview.item.billFileName || 'Ảnh bill nạp tiền'}</p>
              </div>
              <button aria-label="Đóng modal bill" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800" onClick={closeBillPreview} type="button"><X size={18} /></button>
            </div>
            <div className="min-h-56 overflow-auto bg-gray-50 p-4 dark:bg-gray-900">
              {billPreview.url ? (
                <img alt="Bill chuyển khoản" className="mx-auto max-h-[70vh] max-w-full rounded-md object-contain shadow-sm" src={billPreview.url} />
              ) : (
                <div className="flex min-h-56 items-center justify-center text-sm text-gray-500 dark:text-gray-400"><RefreshCw className="mr-2 animate-spin" size={16} /> Đang tải bill...</div>
              )}
            </div>
            <div className="flex justify-end border-t border-gray-200 px-5 py-3 dark:border-gray-800">
              <button className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800" onClick={closeBillPreview} type="button">Đóng (Esc)</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
