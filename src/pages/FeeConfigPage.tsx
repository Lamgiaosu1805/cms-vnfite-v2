import { useEffect, useState } from 'react';
import { getFeeConfigs, updateFeeConfig, type FeeConfig } from '../api/client';
import { formatVietnamDateTime } from '../utils/dateTime';

function fmtVnd(v: number) {
  return new Intl.NumberFormat('vi-VN').format(v) + ' VNĐ';
}

function fmtPct(v: number) {
  return (v * 100).toFixed(1) + '%';
}

export function FeeConfigPage() {
  const [configs, setConfigs] = useState<FeeConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Edit state cho từng config
  const [editValues, setEditValues] = useState<Record<string, {
    feeAmount: string;
    calcType: 'FIXED' | 'PERCENTAGE';
    vatRate: string;
    isActive: boolean;
  }>>({});

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getFeeConfigs();
      setConfigs(data);
      const init: typeof editValues = {};
      for (const c of data) {
        init[c.feeType] = {
          feeAmount: String(c.feeAmount),
          calcType: c.calcType,
          vatRate: String(Math.round(c.vatRate * 100)),
          isActive: c.isActive,
        };
      }
      setEditValues(init);
    } catch (e: any) {
      setError(e?.message ?? 'Không tải được cấu hình phí.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(cfg: FeeConfig) {
    const ev = editValues[cfg.feeType];
    if (!ev) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await updateFeeConfig({
        feeType: cfg.feeType,
        feeName: cfg.feeName,
        feeAmount: parseFloat(ev.feeAmount) || 0,
        calcType: ev.calcType,
        vatRate: parseFloat(ev.vatRate) / 100,
        isActive: ev.isActive,
      });
      setConfigs(prev => prev.map(c => c.feeType === updated.feeType ? updated : c));
      setSuccess('Đã lưu cấu hình phí thành công.');
    } catch (e: any) {
      setError(e?.message ?? 'Lưu thất bại.');
    } finally {
      setSaving(false);
    }
  }

  const FEE_TYPE_LABEL: Record<string, string> = {
    APPRAISAL: 'Phí thẩm định hồ sơ',
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Cấu hình phí</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Cấu hình các loại phí áp dụng khi giải ngân khoản gọi vốn. VAT được tính trên tổng phí.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          {success}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1].map(i => (
            <div key={i} className="h-48 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      ) : configs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 py-12 text-center text-sm text-gray-400 dark:text-gray-500">
          Chưa có cấu hình phí.
        </div>
      ) : (
        <div className="space-y-4">
          {configs.map(cfg => {
            const ev = editValues[cfg.feeType];
            if (!ev) return null;
            const previewFee = ev.calcType === 'FIXED'
              ? parseFloat(ev.feeAmount) || 0
              : null;
            const previewVat = previewFee !== null
              ? previewFee * (parseFloat(ev.vatRate) / 100 || 0)
              : null;
            const previewTotal = previewFee !== null && previewVat !== null
              ? previewFee + previewVat
              : null;

            return (
              <div key={cfg.feeType}
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden shadow-sm">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {FEE_TYPE_LABEL[cfg.feeType] ?? cfg.feeName}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      Cập nhật lần cuối: {formatVietnamDateTime(cfg.updatedAt)} {cfg.updatedBy ? `bởi ${cfg.updatedBy}` : ''}
                    </p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Kích hoạt</span>
                    <div className="relative">
                      <input type="checkbox" className="sr-only"
                        checked={ev.isActive}
                        onChange={e => setEditValues(prev => ({
                          ...prev,
                          [cfg.feeType]: { ...prev[cfg.feeType], isActive: e.target.checked },
                        }))} />
                      <div className={`w-10 h-5 rounded-full transition-colors ${ev.isActive ? 'bg-red-600' : 'bg-gray-300 dark:bg-gray-600'}`} />
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${ev.isActive ? 'translate-x-5' : ''}`} />
                    </div>
                  </label>
                </div>

                {/* Body */}
                <div className="px-5 py-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Loại tính phí */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                        Cách tính phí
                      </label>
                      <select
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                        value={ev.calcType}
                        onChange={e => setEditValues(prev => ({
                          ...prev,
                          [cfg.feeType]: { ...prev[cfg.feeType], calcType: e.target.value as 'FIXED' | 'PERCENTAGE' },
                        }))}>
                        <option value="FIXED">Số tiền cố định (VNĐ)</option>
                        <option value="PERCENTAGE">% số tiền gọi vốn</option>
                      </select>
                    </div>

                    {/* Giá trị phí */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                        {ev.calcType === 'FIXED' ? 'Số tiền phí (VNĐ)' : 'Tỷ lệ phí (%)'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step={ev.calcType === 'FIXED' ? '10000' : '0.1'}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                        value={ev.feeAmount}
                        onChange={e => setEditValues(prev => ({
                          ...prev,
                          [cfg.feeType]: { ...prev[cfg.feeType], feeAmount: e.target.value },
                        }))}
                      />
                    </div>
                  </div>

                  {/* VAT */}
                  <div className="max-w-xs">
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                      Thuế VAT (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                      value={ev.vatRate}
                      onChange={e => setEditValues(prev => ({
                        ...prev,
                        [cfg.feeType]: { ...prev[cfg.feeType], vatRate: e.target.value },
                      }))}
                    />
                  </div>

                  {/* Preview */}
                  {ev.calcType === 'FIXED' && previewFee !== null && previewFee > 0 && (
                    <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700 px-4 py-3 space-y-1.5 text-sm">
                      <p className="font-medium text-gray-700 dark:text-gray-300 text-xs uppercase tracking-wide mb-2">
                        Xem trước tính phí
                      </p>
                      <div className="flex justify-between text-gray-600 dark:text-gray-400">
                        <span>Phí thẩm định</span>
                        <span className="font-medium text-gray-900 dark:text-white">{fmtVnd(previewFee)}</span>
                      </div>
                      <div className="flex justify-between text-gray-600 dark:text-gray-400">
                        <span>VAT ({ev.vatRate}%)</span>
                        <span className="font-medium text-gray-900 dark:text-white">{fmtVnd(previewVat ?? 0)}</span>
                      </div>
                      <div className="border-t border-gray-200 dark:border-gray-600 pt-1.5 flex justify-between font-semibold text-gray-900 dark:text-white">
                        <span>Tổng khấu trừ</span>
                        <span className="text-red-600 dark:text-red-400">{fmtVnd(previewTotal ?? 0)}</span>
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Khách hàng nhận = Số tiền gọi vốn − {fmtVnd(previewTotal ?? 0)}
                      </p>
                    </div>
                  )}

                  {ev.calcType === 'PERCENTAGE' && parseFloat(ev.feeAmount) > 0 && (
                    <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700 px-4 py-3 text-sm">
                      <p className="font-medium text-gray-700 dark:text-gray-300 text-xs uppercase tracking-wide mb-1">
                        Xem trước tính phí (ví dụ khoản 100 triệu)
                      </p>
                      {(() => {
                        const sample = 100_000_000;
                        const fee = sample * parseFloat(ev.feeAmount) / 100;
                        const vat = fee * (parseFloat(ev.vatRate) / 100 || 0);
                        const total = fee + vat;
                        return (
                          <div className="space-y-1 mt-2">
                            <div className="flex justify-between text-gray-600 dark:text-gray-400">
                              <span>Phí thẩm định ({ev.feeAmount}%)</span>
                              <span className="font-medium text-gray-900 dark:text-white">{fmtVnd(fee)}</span>
                            </div>
                            <div className="flex justify-between text-gray-600 dark:text-gray-400">
                              <span>VAT ({ev.vatRate}%)</span>
                              <span className="font-medium text-gray-900 dark:text-white">{fmtVnd(vat)}</span>
                            </div>
                            <div className="border-t border-gray-200 dark:border-gray-600 pt-1 flex justify-between font-semibold text-gray-900 dark:text-white">
                              <span>Tổng khấu trừ</span>
                              <span className="text-red-600 dark:text-red-400">{fmtVnd(total)}</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 flex justify-between items-center">
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Hiện tại: {cfg.calcType === 'FIXED'
                      ? fmtVnd(cfg.feeAmount)
                      : `${cfg.feeAmount}%`} · VAT {fmtPct(cfg.vatRate)}
                    {!cfg.isActive && <span className="ml-2 text-orange-500">(Tắt)</span>}
                  </p>
                  <button
                    onClick={() => handleSave(cfg)}
                    disabled={saving}
                    className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50 transition-colors">
                    {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info box */}
      <div className="rounded-lg border border-blue-100 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
        <p className="font-semibold mb-1">Lưu ý</p>
        <ul className="space-y-0.5 list-disc list-inside text-blue-600 dark:text-blue-400">
          <li>Phí được áp dụng tại thời điểm Admin bấm <strong>Giải ngân</strong>.</li>
          <li>Số tiền người gọi vốn nhận = Số tiền được duyệt − Tổng phí (phí + VAT).</li>
          <li>Thay đổi cấu hình chỉ ảnh hưởng đến các khoản chưa giải ngân.</li>
        </ul>
      </div>
    </div>
  );
}
