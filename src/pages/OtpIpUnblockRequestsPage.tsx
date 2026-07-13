import { useEffect, useState } from 'react';
import { Check, RefreshCw, X } from 'lucide-react';
import { decideOtpIpUnblockRequest, fetchOtpIpUnblockRequests, type OtpIpUnblockRequest } from '../api/client';

const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value)) : '—';

export function OtpIpUnblockRequestsPage() {
  const [items, setItems] = useState<OtpIpUnblockRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try { setItems((await fetchOtpIpUnblockRequests()).content); }
    catch (err) { setError(err instanceof Error ? err.message : 'Không thể tải yêu cầu.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const decide = async (item: OtpIpUnblockRequest, approved: boolean) => {
    const reason = approved ? '' : window.prompt('Lý do từ chối', '') ?? '';
    if (!approved && !reason.trim()) return;
    try { await decideOtpIpUnblockRequest(item.id, approved, reason); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Không thể xử lý yêu cầu.'); }
  };
  return <div className="space-y-4">
    <div className="flex items-center justify-between"><div><h2 className="text-xl font-bold text-gray-900 dark:text-white">Mở chặn OTP theo yêu cầu</h2><p className="text-sm text-gray-500 dark:text-gray-400">Khách gửi số điện thoại, hệ thống tự xác định mạng bị chặn.</p></div><button onClick={() => void load()} className="rounded-lg border border-gray-200 bg-white p-2 text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"><RefreshCw size={16}/></button></div>
    {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</div>}
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"><table className="w-full text-sm"><thead className="bg-gray-50 text-left text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400"><tr><th className="p-3">Thời gian</th><th className="p-3">Số điện thoại</th><th className="p-3">IP</th><th className="p-3">Ghi chú</th><th className="p-3">Thao tác</th></tr></thead><tbody>{loading ? <tr><td colSpan={5} className="p-6 text-center text-gray-500">Đang tải...</td></tr> : items.length === 0 ? <tr><td colSpan={5} className="p-6 text-center text-gray-500">Không có yêu cầu chờ xử lý.</td></tr> : items.map(item => <tr key={item.id} className="border-t border-gray-100 dark:border-gray-800"><td className="p-3 text-gray-600 dark:text-gray-300">{formatDate(item.createdAt)}</td><td className="p-3 font-medium text-gray-900 dark:text-white">{item.phone}</td><td className="p-3 font-mono text-xs text-gray-600 dark:text-gray-300">{item.ipAddress}</td><td className="p-3 text-gray-600 dark:text-gray-300">{item.requesterNote || '—'}</td><td className="p-3"><div className="flex gap-2"><button onClick={() => void decide(item, true)} className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2 py-1 text-white"><Check size={14}/> Mở lại</button><button onClick={() => void decide(item, false)} className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-1 text-white"><X size={14}/> Từ chối</button></div></td></tr>)}</tbody></table></div>
  </div>;
}
