import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Clock, Play, RefreshCw, Search, X } from 'lucide-react';
import {
  runReconciliation,
  fetchReconciliationSessions,
  fetchReconciliationItems,
  resolveReconciliationItem,
  markReconciliationItemInvestigating,
  type ReconciliationSession,
  type ReconciliationItem,
} from '../api/client';
import { formatVietnamDateTime } from '../utils/dateTime';

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return formatVietnamDateTime(iso, '');
}

function fmtMoney(amount: number | null): string {
  if (amount == null) return '—';
  return amount.toLocaleString('vi-VN') + ' ₫';
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── type label maps ──────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  STALE_DEPOSIT: 'Nạp tiền kẹt PENDING',
  STALE_WITHDRAWAL: 'Rút tiền kẹt đang xử lý',
  WITHDRAWAL_MB_MISMATCH: 'Lệch trạng thái vs MB',
  FAILED_WITHDRAWAL_MB_SUCCESS: 'FAILED nhưng MB thực hiện',
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Chưa xử lý',
  INVESTIGATING: 'Đang điều tra',
  RESOLVED: 'Đã xử lý',
};

// ─── sub-components ───────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: string }) {
  const cls =
    severity === 'HIGH'
      ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
      : severity === 'MEDIUM'
      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300'
      : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {severity}
    </span>
  );
}

function ItemStatusBadge({ status }: { status: string }) {
  const cls =
    status === 'OPEN'
      ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
      : status === 'INVESTIGATING'
      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
      : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function SessionStatusBadge({ status }: { status: string }) {
  if (status === 'COMPLETED')
    return <CheckCircle size={14} className="text-green-500 shrink-0" />;
  if (status === 'FAILED')
    return <X size={14} className="text-red-500 shrink-0" />;
  return <Clock size={14} className="text-yellow-500 shrink-0 animate-spin" />;
}

// ─── Guide section ───────────────────────────────────────────────────────────

const GUIDE_ITEMS = [
  {
    type: 'STALE_DEPOSIT',
    severity: 'MEDIUM',
    title: 'Nạp tiền kẹt PENDING',
    when: 'Giao dịch nạp tiền có trạng thái PENDING quá 4 giờ.',
    cause: 'MB đã nhận tiền vào VA nhưng callback TIKLUY → VNFITE bị thất bại hoặc VNFITE xử lý lỗi mà không cập nhật trạng thái.',
    steps: [
      'Kiểm tra log payment-service: tìm referenceId trong log để xem callback có về không.',
      'Kiểm tra tài khoản VA của khách trên TIKLUY: số dư có tăng chưa.',
      'Nếu MB đã ghi nhận nạp thành công: cập nhật thủ công trạng thái wallet_transactions thành SUCCESS và cộng số dư ví.',
      'Nếu MB chưa ghi nhận: liên hệ MB tra cứu theo referenceId. Thông báo khách chờ thêm.',
      'Đánh dấu Đã xử lý với ghi chú kết quả.',
    ],
  },
  {
    type: 'STALE_WITHDRAWAL',
    severity: 'HIGH',
    title: 'Rút tiền kẹt đang xử lý',
    when: 'Lệnh rút ở trạng thái FUNDS_LOCKED, TRANSFER_INITIATED hoặc PROCESSING quá 2 giờ không tiến thêm.',
    cause: 'Lệnh chuyển tiền gửi sang TIKLUY/MB nhưng không nhận được phản hồi (timeout, mất kết nối, lỗi scheduler).',
    steps: [
      'Vào màn Giám sát rút tiền → tìm lệnh rút theo walletId/transactionId.',
      'Nếu có providerTransferRef (mã YFCH): kiểm tra trạng thái thực tế tại MB qua TIKLUY.',
      'Nếu MB đã chuyển thành công: bấm Resolve withdrawal trên màn giám sát (wasSent=true, nhập FT number).',
      'Nếu MB chưa xử lý hoặc thất bại: bấm Retry hoặc Resolve với wasSent=false để hoàn tiền về ví.',
      'Đánh dấu Đã xử lý với ghi chú hành động đã thực hiện.',
    ],
  },
  {
    type: 'WITHDRAWAL_MB_MISMATCH',
    severity: 'HIGH',
    title: 'Lệch trạng thái vs MB',
    when: 'Trạng thái lệnh rút trong VNFITE không khớp với kết quả thực tế truy vấn từ MB qua TIKLUY.',
    cause: 'Callback từ MB về VNFITE bị delay, mất, hoặc xử lý lỗi dẫn đến VNFITE ghi sai trạng thái.',
    steps: [
      'Xác nhận trạng thái MB bằng cách kiểm tra lại trên TIKLUY (mã providerTransferRef/YFCH).',
      'Nếu MB SUCCESS nhưng VNFITE PENDING: vào màn Giám sát → Resolve (wasSent=true) để ghi nhận hoàn tất và trừ số dư VA.',
      'Nếu MB FAILED nhưng VNFITE COMPLETED: kiểm tra số dư thực của VA trên TIKLUY; nếu tiền chưa rời: cần điều chỉnh số dư và rollback.',
      'Ghi chú đầy đủ FT number, thời điểm xử lý và người thực hiện.',
    ],
  },
  {
    type: 'FAILED_WITHDRAWAL_MB_SUCCESS',
    severity: 'HIGH',
    title: 'FAILED trong VNFITE nhưng MB đã chuyển tiền',
    when: 'VNFITE ghi lệnh rút là FAILED/FUNDS_RELEASED nhưng khi truy vấn TIKLUY, MB đã thực sự chuyển tiền ra ngoài.',
    cause: 'VNFITE nhận timeout hoặc lỗi khi gọi TIKLUY, ghi FAILED và mở khóa tiền về ví; nhưng thực tế MB đã xử lý lệnh chuyển.',
    steps: [
      'Xác minh FT number từ kết quả tra soát — đây là bằng chứng MB đã chuyển.',
      'Kiểm tra số dư VA trên TIKLUY: nếu đã bị trừ → tiền đã ra khỏi tài khoản công ty.',
      'Kiểm tra ví khách trong VNFITE: tiền có bị trả về ví không (do FUNDS_RELEASED).',
      'Nếu tiền đã ra và ví khách đã được hoàn: khách nhận được tiền hai lần (ví + chuyển khoản) — cần thu hồi qua kênh hỗ trợ.',
      'Nếu tiền đã ra và ví chưa hoàn: trạng thái nhất quán — cập nhật lệnh rút thành COMPLETED, không hoàn ví.',
      'Đây là trường hợp nghiêm trọng — ghi biên bản đầy đủ và escalate lên quản lý nếu cần.',
    ],
  },
];

function GuideSection() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left"
      >
        <div className="flex items-center gap-2.5">
          <AlertTriangle size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="text-sm font-semibold text-blue-900 dark:text-blue-200">
            Hướng dẫn tra soát &amp; xử lý sự cố
          </span>
        </div>
        {open
          ? <ChevronUp size={16} className="text-blue-500 dark:text-blue-400 shrink-0" />
          : <ChevronDown size={16} className="text-blue-500 dark:text-blue-400 shrink-0" />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-blue-200 dark:border-blue-800 pt-4">
          <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
            Tra soát so sánh dữ liệu nội bộ VNFITE với trạng thái thực tế tại MB Bank qua TIKLUY.
            Phiên tra soát nên được chạy mỗi ngày vào buổi sáng cho ngày hôm trước.
            Mọi vấn đề cần được xử lý và đánh dấu Đã xử lý trước khi kết thúc ngày làm việc.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {GUIDE_ITEMS.map(g => (
              <div
                key={g.type}
                className="rounded-xl bg-white dark:bg-gray-900 border border-blue-100 dark:border-gray-700 p-4 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                    g.severity === 'HIGH'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                      : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300'
                  }`}>
                    {g.severity}
                  </span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{g.title}</span>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-medium text-gray-700 dark:text-gray-300">Khi nào xuất hiện: </span>
                    {g.when}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-medium text-gray-700 dark:text-gray-300">Nguyên nhân: </span>
                    {g.cause}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Cách xử lý:</p>
                  <ol className="space-y-1">
                    {g.steps.map((step, i) => (
                      <li key={i} className="flex gap-2 text-xs text-gray-600 dark:text-gray-400">
                        <span className="shrink-0 w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center font-semibold text-[10px]">
                          {i + 1}
                        </span>
                        <span className="leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-xs text-yellow-800 dark:text-yellow-300 leading-relaxed">
            <span className="font-semibold">Lưu ý quan trọng:</span> Mọi điều chỉnh số dư ví hoặc trạng thái giao dịch phải được thực hiện
            bởi Ops hoặc Admin có thẩm quyền và ghi chú đầy đủ. Không tự ý điều chỉnh database trực tiếp khi chưa xác minh
            trạng thái tại MB Bank. Trường hợp tiền thật đã ra/vào mà hệ thống chưa ghi nhận — escalate ngay lên quản lý.
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Resolve modal ────────────────────────────────────────────────────────────

function ResolveModal({
  item,
  onClose,
  onResolved,
}: {
  item: ReconciliationItem;
  onClose: () => void;
  onResolved: () => void;
}) {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function handleResolve() {
    setLoading(true);
    setErr('');
    try {
      await resolveReconciliationItem(item.id, notes);
      onResolved();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Lỗi không xác định');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Xử lý vấn đề tra soát</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
            <X size={18} />
          </button>
        </div>
        <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 text-sm space-y-1">
          <div className="font-medium text-gray-900 dark:text-white">{TYPE_LABELS[item.itemType] ?? item.itemType}</div>
          {item.description && (
            <div className="text-gray-600 dark:text-gray-400 text-xs leading-relaxed">{item.description}</div>
          )}
          {item.amount != null && (
            <div className="text-gray-800 dark:text-gray-200 font-medium">{fmtMoney(item.amount)}</div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Ghi chú xử lý <span className="text-red-500">*</span>
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Mô tả cách xử lý, kết quả kiểm tra..."
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
        {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Huỷ
          </button>
          <button
            onClick={handleResolve}
            disabled={loading || !notes.trim()}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Đang lưu...' : 'Đánh dấu đã xử lý'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReconciliationPage() {
  const [sessions, setSessions] = useState<ReconciliationSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsErr, setSessionsErr] = useState('');

  const [selectedSession, setSelectedSession] = useState<ReconciliationSession | null>(null);
  const [items, setItems] = useState<ReconciliationItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsErr, setItemsErr] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [runDate, setRunDate] = useState(todayStr());
  const [running, setRunning] = useState(false);
  const [runErr, setRunErr] = useState('');

  const [resolveItem, setResolveItem] = useState<ReconciliationItem | null>(null);

  // Load sessions
  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    setSessionsErr('');
    try {
      const res = await fetchReconciliationSessions(0, 30);
      setSessions(res.content);
    } catch (e: unknown) {
      setSessionsErr(e instanceof Error ? e.message : 'Không thể tải danh sách tra soát');
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // Load items for selected session
  const loadItems = useCallback(async (session: ReconciliationSession, status: string) => {
    setItemsLoading(true);
    setItemsErr('');
    setItems([]);
    try {
      const res = await fetchReconciliationItems(session.id, status || undefined, 0, 100);
      setItems(res.content);
    } catch (e: unknown) {
      setItemsErr(e instanceof Error ? e.message : 'Không thể tải danh sách vấn đề');
    } finally {
      setItemsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedSession) {
      loadItems(selectedSession, statusFilter);
    }
  }, [selectedSession, statusFilter, loadItems]);

  async function handleRun() {
    setRunning(true);
    setRunErr('');
    try {
      const session = await runReconciliation(runDate);
      await loadSessions();
      setSelectedSession(session);
    } catch (e: unknown) {
      setRunErr(e instanceof Error ? e.message : 'Không thể chạy tra soát');
    } finally {
      setRunning(false);
    }
  }

  async function handleInvestigate(item: ReconciliationItem) {
    try {
      await markReconciliationItemInvestigating(item.id);
      if (selectedSession) loadItems(selectedSession, statusFilter);
    } catch {
      // silently fail; item list will not refresh
    }
  }

  function handleResolved() {
    setResolveItem(null);
    if (selectedSession) {
      // Refresh both session list (open count) and items
      loadSessions();
      loadItems(selectedSession, statusFilter);
    }
  }

  const openCount = items.filter(i => i.status === 'OPEN').length;
  const highCount = items.filter(i => i.severity === 'HIGH' && i.status !== 'RESOLVED').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header + Run control */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Tra soát giao dịch</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            So sánh giao dịch nội bộ vs MB Bank qua TIKLUY, phát hiện lệch số dư và giao dịch kẹt.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <input
            type="date"
            value={runDate}
            onChange={e => setRunDate(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <button
            onClick={handleRun}
            disabled={running}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            <Play size={15} />
            {running ? 'Đang chạy...' : 'Chạy tra soát'}
          </button>
        </div>
      </div>

      {runErr && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm flex items-center gap-2">
          <AlertTriangle size={15} />
          {runErr}
        </div>
      )}

      <GuideSection />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Session list */}
        <div className="lg:col-span-1 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Lịch sử tra soát</h2>
            <button
              onClick={loadSessions}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
            >
              <RefreshCw size={14} className={sessionsLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          {sessionsLoading ? (
            <div className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">Đang tải...</div>
          ) : sessionsErr ? (
            <div className="text-sm text-red-600 dark:text-red-400">{sessionsErr}</div>
          ) : sessions.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
              Chưa có phiên tra soát nào. Chọn ngày và bấm Chạy tra soát.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
              {sessions.map(s => (
                <button
                  key={s.id}
                  onClick={() => { setSelectedSession(s); setStatusFilter(''); }}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    selectedSession?.id === s.id
                      ? 'border-red-400 bg-red-50 dark:bg-red-900/20 dark:border-red-700'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <SessionStatusBadge status={s.status} />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {s.reconDate}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <span>{s.totalItems} vấn đề</span>
                    {s.openItems > 0 && (
                      <span className="text-red-600 dark:text-red-400 font-medium">
                        {s.openItems} chưa xử lý
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {fmtDate(s.createdAt)} · {s.runBy}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Items panel */}
        <div className="lg:col-span-2 space-y-4">
          {!selectedSession ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-600">
              <Search size={40} className="mb-3" />
              <p className="text-sm">Chọn một phiên tra soát để xem chi tiết</p>
            </div>
          ) : (
            <>
              {/* Session summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-center">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{selectedSession.totalItems}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Tổng vấn đề</div>
                </div>
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-center">
                  <div className="text-2xl font-bold text-red-700 dark:text-red-300">{openCount}</div>
                  <div className="text-xs text-red-600 dark:text-red-400 mt-0.5">Chưa xử lý</div>
                </div>
                <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 text-center">
                  <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">{highCount}</div>
                  <div className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">Mức độ CAO</div>
                </div>
              </div>

              {/* Filter + refresh */}
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  {(['', 'OPEN', 'INVESTIGATING', 'RESOLVED'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        statusFilter === s
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {s === '' ? 'Tất cả' : STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => loadItems(selectedSession, statusFilter)}
                  className="ml-auto p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
                >
                  <RefreshCw size={14} className={itemsLoading ? 'animate-spin' : ''} />
                </button>
              </div>

              {/* Items table */}
              {itemsLoading ? (
                <div className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">Đang tải...</div>
              ) : itemsErr ? (
                <div className="text-sm text-red-600 dark:text-red-400">{itemsErr}</div>
              ) : items.length === 0 ? (
                <div className="text-sm text-gray-500 dark:text-gray-400 py-12 text-center">
                  {statusFilter ? 'Không có vấn đề nào ở trạng thái này.' : 'Không phát hiện vấn đề nào trong phiên tra soát này.'}
                </div>
              ) : (
                <div className="space-y-2 max-h-[calc(100vh-380px)] overflow-y-auto pr-1">
                  {items.map(item => (
                    <div
                      key={item.id}
                      className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 space-y-2"
                    >
                      <div className="flex items-start gap-3 flex-wrap">
                        <SeverityBadge severity={item.severity} />
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          {TYPE_LABELS[item.itemType] ?? item.itemType}
                        </span>
                        <ItemStatusBadge status={item.status} />
                        {item.amount != null && (
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-auto">
                            {fmtMoney(item.amount)}
                          </span>
                        )}
                      </div>

                      {item.description && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{item.description}</p>
                      )}

                      <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-500">
                        {item.vnfiteStatus && (
                          <span>VNFITE: <span className="font-medium text-gray-700 dark:text-gray-300">{item.vnfiteStatus}</span></span>
                        )}
                        {item.mbStatus && (
                          <span>MB: <span className="font-medium text-gray-700 dark:text-gray-300">{item.mbStatus}</span></span>
                        )}
                        {item.referenceId && (
                          <span className="font-mono">{item.referenceId}</span>
                        )}
                        {item.externalRef && (
                          <span className="font-mono">{item.externalRef}</span>
                        )}
                      </div>

                      {item.status === 'RESOLVED' && item.resolutionNotes && (
                        <div className="px-3 py-2 rounded-lg bg-green-50 dark:bg-green-900/20 text-xs text-green-700 dark:text-green-300">
                          <span className="font-medium">Đã xử lý bởi {item.resolvedBy}:</span> {item.resolutionNotes}
                        </div>
                      )}

                      {item.status !== 'RESOLVED' && (
                        <div className="flex gap-2 pt-1">
                          {item.status === 'OPEN' && (
                            <button
                              onClick={() => handleInvestigate(item)}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                            >
                              Đang điều tra
                            </button>
                          )}
                          <button
                            onClick={() => setResolveItem(item)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                          >
                            Đánh dấu đã xử lý
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {resolveItem && (
        <ResolveModal
          item={resolveItem}
          onClose={() => setResolveItem(null)}
          onResolved={handleResolved}
        />
      )}
    </div>
  );
}
