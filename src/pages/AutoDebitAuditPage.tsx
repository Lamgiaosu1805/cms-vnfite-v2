import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CalendarClock, CheckCircle2, Eye, RefreshCw, X, XCircle } from 'lucide-react';
import { fetchAutoDebitAuditList, runAutoDebitSweep, type AutoDebitSweepResult } from '../api/client';
import { formatVietnamDateTime } from '../utils/dateTime';

function formatVND(value: number | string | undefined): string {
  if (value === undefined || value === null) return '—';
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(n)) return '—';
  return n.toLocaleString('vi-VN') + ' đ';
}

function durationSeconds(start: string, end: string): string {
  try {
    const s = new Date(start.includes('+') || start.endsWith('Z') ? start : start + '+07:00').getTime();
    const e = new Date(end.includes('+') || end.endsWith('Z') ? end : end + '+07:00').getTime();
    const diff = Math.round((e - s) / 1000);
    if (diff < 60) return `${diff}s`;
    return `${Math.floor(diff / 60)}m ${diff % 60}s`;
  } catch {
    return '—';
  }
}

function triggerLabel(source: string): string {
  if (source === 'CRON' || source === 'SCHEDULER') return 'Cron tự động';
  return 'Thủ công (CMS)';
}

function resultTone(record: AutoDebitSweepResult): string {
  if (record.failed > 0 || record.balanceError > 0) return 'text-red-600 dark:text-red-400';
  if (record.settledFull > 0 || record.settledPartial > 0) return 'text-green-600 dark:text-green-400';
  return 'text-gray-500 dark:text-gray-400';
}

function DetailItem({
  label,
  value,
  tone = 'text-gray-900 dark:text-gray-100',
}: {
  label: string;
  value: React.ReactNode;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <div className={`mt-1 text-sm font-semibold ${tone}`}>{value}</div>
    </div>
  );
}

export default function AutoDebitAuditPage() {
  const [records, setRecords] = useState<AutoDebitSweepResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sweeping, setSweeping] = useState(false);
  const [sweepMsg, setSweepMsg] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<AutoDebitSweepResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAutoDebitAuditList(100);
      setRecords(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Không tải được dữ liệu');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSweep = async () => {
    if (!confirm('Chạy ngay job thu nợ tự động?')) return;
    setSweeping(true);
    setSweepMsg(null);
    try {
      const result = await runAutoDebitSweep();
      setSweepMsg(`✅ Hoàn tất: thu ${result.settledFull + result.settledPartial}/${result.dueLoans} khoản, tổng ${formatVND(result.amountCollected)}`);
      await load();
    } catch (e: unknown) {
      setSweepMsg('❌ ' + (e instanceof Error ? e.message : 'Lỗi không xác định'));
    } finally {
      setSweeping(false);
    }
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <CalendarClock size={22} className="text-red-700 dark:text-red-400" />
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Lịch sử thu nợ tự động</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Kết quả mỗi lần quét auto-debit (cron 01:30 hàng ngày hoặc chạy thủ công)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
          <button
            onClick={handleSweep}
            disabled={sweeping}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-colors"
            style={{ background: sweeping ? '#999' : 'linear-gradient(135deg, #C82020, #8B0A0A)' }}
          >
            <RefreshCw size={15} className={sweeping ? 'animate-spin' : ''} />
            {sweeping ? 'Đang quét...' : 'Chạy ngay'}
          </button>
        </div>
      </div>

      {sweepMsg && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-sm text-gray-800 dark:text-gray-200">
          {sweepMsg}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Thời gian bắt đầu</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Nguồn kích hoạt</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Quét</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Đến hạn</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider">Thu đủ</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-yellow-600 dark:text-yellow-400 uppercase tracking-wider">Thu một phần</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Thiếu số dư</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">Lỗi</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Tổng thu</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Thời gian chạy</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Chi tiết</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {loading && (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-gray-400 dark:text-gray-500">
                  <RefreshCw size={20} className="animate-spin mx-auto mb-2" />
                  Đang tải...
                </td>
              </tr>
            )}
            {!loading && records.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-gray-400 dark:text-gray-500">
                  Chưa có dữ liệu quét auto-debit
                </td>
              </tr>
            )}
            {records.map((r, idx) => {
              const hasError = r.failed > 0 || r.balanceError > 0;
              const allGood = r.settledFull === r.dueLoans && r.dueLoans > 0;
              return (
                <tr
                  key={r.auditId ?? idx}
                  onClick={() => setSelectedRecord(r)}
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                >
                  <td className="px-4 py-3 whitespace-nowrap text-gray-900 dark:text-gray-100">
                    {formatVietnamDateTime(r.startedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium w-fit
                        ${r.triggerSource === 'CRON' || r.triggerSource === 'SCHEDULER'
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'}`}>
                        {triggerLabel(r.triggerSource)}
                      </span>
                      {r.triggeredBy && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">{r.triggeredBy}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300 font-medium">{r.scannedLoans}</td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300 font-medium">{r.dueLoans}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-semibold ${r.settledFull > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>
                      {r.settledFull}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-semibold ${r.settledPartial > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-400 dark:text-gray-500'}`}>
                      {r.settledPartial}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{r.noBalance}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-semibold ${r.failed > 0 || r.balanceError > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'}`}>
                      {r.failed + r.balanceError}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100 font-medium whitespace-nowrap">
                    {formatVND(r.amountCollected)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="text-gray-600 dark:text-gray-400">
                        {durationSeconds(r.startedAt, r.finishedAt)}
                      </span>
                      {allGood && !hasError && <CheckCircle2 size={14} className="text-green-500 shrink-0" />}
                      {hasError && <XCircle size={14} className="text-red-500 shrink-0" />}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedRecord(r);
                      }}
                      title="Xem chi tiết"
                      className="inline-flex items-center justify-center rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-red-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-red-400"
                    >
                      <Eye size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Error detail panel */}
      {records.some(r => r.errorSummary) && (
        <div className="rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 p-4">
          <h3 className="font-semibold text-orange-800 dark:text-orange-300 mb-3 flex items-center gap-2">
            <AlertCircle size={16} />
            Lỗi gần nhất
          </h3>
          {records
            .filter(r => r.errorSummary)
            .slice(0, 3)
            .map((r, i) => (
              <div key={i} className="mb-2 last:mb-0">
                <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">{formatVietnamDateTime(r.startedAt)}</span>
                <p className="text-sm text-orange-800 dark:text-orange-200 font-mono mt-0.5 whitespace-pre-wrap">{r.errorSummary}</p>
              </div>
          ))}
        </div>
      )}

      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 dark:border-gray-700 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Chi tiết lần thu nợ tự động</h2>
                <p className="mt-1 font-mono text-xs text-gray-500 dark:text-gray-400">{selectedRecord.auditId}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
                title="Đóng"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto px-5 py-4 space-y-5">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <DetailItem label="Nguồn kích hoạt" value={triggerLabel(selectedRecord.triggerSource)} />
                <DetailItem label="Người kích hoạt" value={selectedRecord.triggeredBy || '—'} />
                <DetailItem
                  label="Kết quả"
                  value={
                    selectedRecord.failed > 0 || selectedRecord.balanceError > 0
                      ? 'Có lỗi'
                      : selectedRecord.amountCollected && Number(selectedRecord.amountCollected) > 0
                        ? 'Đã thu'
                        : 'Không phát sinh thu'
                  }
                  tone={resultTone(selectedRecord)}
                />
                <DetailItem label="Bắt đầu" value={formatVietnamDateTime(selectedRecord.startedAt)} />
                <DetailItem label="Kết thúc" value={formatVietnamDateTime(selectedRecord.finishedAt)} />
                <DetailItem label="Thời gian chạy" value={durationSeconds(selectedRecord.startedAt, selectedRecord.finishedAt)} />
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">Tổng quan khoản</h3>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <DetailItem label="Đã quét" value={selectedRecord.scannedLoans.toLocaleString('vi-VN')} />
                  <DetailItem label="Đến hạn" value={selectedRecord.dueLoans.toLocaleString('vi-VN')} />
                  <DetailItem label="Không đến hạn" value={selectedRecord.noDue.toLocaleString('vi-VN')} />
                  <DetailItem label="Tổng thu" value={formatVND(selectedRecord.amountCollected)} tone="text-red-700 dark:text-red-300" />
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">Phân loại kết quả</h3>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  <DetailItem label="Thu đủ" value={selectedRecord.settledFull.toLocaleString('vi-VN')} tone="text-green-600 dark:text-green-400" />
                  <DetailItem label="Thu một phần" value={selectedRecord.settledPartial.toLocaleString('vi-VN')} tone="text-yellow-600 dark:text-yellow-400" />
                  <DetailItem label="Thiếu số dư" value={selectedRecord.noBalance.toLocaleString('vi-VN')} />
                  <DetailItem label="Lỗi số dư" value={selectedRecord.balanceError.toLocaleString('vi-VN')} tone={selectedRecord.balanceError > 0 ? 'text-red-600 dark:text-red-400' : undefined} />
                  <DetailItem label="Thất bại" value={selectedRecord.failed.toLocaleString('vi-VN')} tone={selectedRecord.failed > 0 ? 'text-red-600 dark:text-red-400' : undefined} />
                  <DetailItem label="Tổng lỗi" value={(selectedRecord.failed + selectedRecord.balanceError).toLocaleString('vi-VN')} tone={selectedRecord.failed + selectedRecord.balanceError > 0 ? 'text-red-600 dark:text-red-400' : undefined} />
                </div>
              </div>

              {selectedRecord.errorSummary && (
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-900/20">
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-orange-800 dark:text-orange-300">
                    <AlertCircle size={16} />
                    Chi tiết lỗi
                  </h3>
                  <p className="whitespace-pre-wrap break-words font-mono text-sm text-orange-900 dark:text-orange-100">
                    {selectedRecord.errorSummary}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
