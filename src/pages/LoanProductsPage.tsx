import { useEffect, useState } from 'react';
import { fetchLoanProducts, updateLoanProduct, type LoanProduct, type LoanProductUpdatePayload } from '../api/client';
import { AlertCircle, Loader2, Pencil, X } from 'lucide-react';

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tỷ`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} triệu`;
  return amount.toLocaleString('vi-VN');
}

function categoryLabel(category: string): string {
  if (category === 'INDIVIDUAL') return 'Cá nhân';
  if (category === 'BUSINESS') return 'Hộ kinh doanh';
  return category;
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

interface EditModalProps {
  product: LoanProduct;
  onClose: () => void;
  onSaved: (updated: LoanProduct) => void;
}

function EditModal({ product, onClose, onSaved }: EditModalProps) {
  const [form, setForm] = useState<LoanProductUpdatePayload>({
    name: product.name,
    description: product.description ?? '',
    minAmount: product.minAmount,
    maxAmount: product.maxAmount,
    availableTerms: product.availableTerms ?? [],
    maxInterestRate: product.maxInterestRate ?? null,
    lateFeeRate: product.lateFeeRate ?? null,
    interestPenaltyRate: product.interestPenaltyRate ?? null,
    earlySettlementFeeRate: product.earlySettlementFeeRate ?? null,
    earlySettlementFreeRatio: product.earlySettlementFreeRatio ?? null,
    earlySettlementMinFee: product.earlySettlementMinFee ?? null,
    sortOrder: product.sortOrder,
    active: true,
  });
  const [termsInput, setTermsInput] = useState((product.availableTerms ?? []).join(', '));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function parseTerms(raw: string): number[] {
    return raw.split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n) && n > 0);
  }

  function handleTermsChange(raw: string) {
    setTermsInput(raw);
    setForm(f => ({ ...f, availableTerms: parseTerms(raw) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.availableTerms.length === 0) {
      setError('Vui lòng nhập ít nhất một kỳ hạn hợp lệ');
      return;
    }
    if (form.minAmount >= form.maxAmount) {
      setError('Hạn mức tối thiểu phải nhỏ hơn tối đa');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateLoanProduct(product.id, {
        ...form,
        description: form.description || null,
      });
      onSaved(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể lưu thay đổi');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Chỉnh sửa sản phẩm</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{product.code}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form id="edit-product-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Tên sản phẩm <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 dark:focus:border-red-400 transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Mô tả
            </label>
            <textarea
              rows={3}
              value={form.description ?? ''}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 dark:focus:border-red-400 transition resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Hạn mức tối thiểu (đ) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min={100000}
                step={100000}
                value={form.minAmount}
                onChange={e => setForm(f => ({ ...f, minAmount: Number(e.target.value) }))}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 dark:focus:border-red-400 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Hạn mức tối đa (đ) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min={100000}
                step={100000}
                value={form.maxAmount}
                onChange={e => setForm(f => ({ ...f, maxAmount: Number(e.target.value) }))}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 dark:focus:border-red-400 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Kỳ hạn cho phép (tháng) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ví dụ: 1, 3, 6, 12"
              value={termsInput}
              onChange={e => handleTermsChange(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 dark:focus:border-red-400 transition"
            />
            {form.availableTerms.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {form.availableTerms.map(t => (
                  <span key={t} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                    {t} tháng
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Lãi suất tối đa (%/năm)
              </label>
              <input
                type="number"
                step={0.01}
                min={0}
                max={100}
                value={form.maxInterestRate ?? ''}
                onChange={e => setForm(f => ({ ...f, maxInterestRate: e.target.value === '' ? null : Number(e.target.value) }))}
                placeholder="Để trống = không giới hạn"
                className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 dark:focus:border-red-400 transition placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Phí phạt gốc quá hạn (%)
              </label>
              <input
                type="number"
                step={0.01}
                min={0}
                value={form.lateFeeRate ?? ''}
                onChange={e => setForm(f => ({ ...f, lateFeeRate: e.target.value === '' ? null : Number(e.target.value) }))}
                placeholder="Mặc định 150"
                className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 dark:focus:border-red-400 transition placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">× lãi suất/năm × gốc quá hạn</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Phí phạt lãi quá hạn (%/năm)
              </label>
              <input
                type="number"
                step={0.01}
                min={0}
                value={form.interestPenaltyRate ?? ''}
                onChange={e => setForm(f => ({ ...f, interestPenaltyRate: e.target.value === '' ? null : Number(e.target.value) }))}
                placeholder="Mặc định 10"
                className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 dark:focus:border-red-400 transition placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Trên phần lãi chưa trả</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Phí tất toán sớm (%)
              </label>
              <input
                type="number"
                step={0.01}
                min={0}
                value={form.earlySettlementFeeRate ?? ''}
                onChange={e => setForm(f => ({ ...f, earlySettlementFeeRate: e.target.value === '' ? null : Number(e.target.value) }))}
                placeholder="Mặc định 5"
                className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 dark:focus:border-red-400 transition placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">% trên gốc còn lại → VNFITE</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Ngưỡng miễn phí tất toán
              </label>
              <input
                type="number"
                step={0.0001}
                min={0}
                max={1}
                value={form.earlySettlementFreeRatio ?? ''}
                onChange={e => setForm(f => ({ ...f, earlySettlementFreeRatio: e.target.value === '' ? null : Number(e.target.value) }))}
                placeholder="Mặc định 0.6667"
                className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 dark:focus:border-red-400 transition placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Tỷ lệ kỳ hạn đã dùng → miễn phí. 0.6667 = 2/3</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Phí tất toán tối thiểu (đ)
              </label>
              <input
                type="number"
                step={1000}
                min={0}
                value={form.earlySettlementMinFee ?? ''}
                onChange={e => setForm(f => ({ ...f, earlySettlementMinFee: e.target.value === '' ? null : Number(e.target.value) }))}
                placeholder="Mặc định 500000"
                className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 dark:focus:border-red-400 transition placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Mức sàn khi phí áp dụng (&lt; ngưỡng)</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Thứ tự hiển thị
              </label>
              <input
                type="number"
                min={0}
                value={form.sortOrder}
                onChange={e => setForm(f => ({ ...f, sortOrder: Number(e.target.value) }))}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 dark:focus:border-red-400 transition"
              />
            </div>
            <div className="flex flex-col justify-end pb-0.5">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <div
                  onClick={() => setForm(f => ({ ...f, active: !f.active }))}
                  className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${form.active ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.active ? 'translate-x-5' : ''}`} />
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {form.active ? 'Đang hoạt động' : 'Tạm ngưng'}
                </span>
              </label>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 dark:border-gray-800 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Hủy
          </button>
          <button
            type="submit"
            form="edit-product-form"
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-red-700 hover:bg-red-800 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Lưu thay đổi
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function LoanProductsPage() {
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<LoanProduct | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchLoanProducts()
      .then(data => {
        setProducts(data);
        setError(null);
      })
      .catch(err => setError(err?.message ?? 'Không thể tải danh sách sản phẩm'))
      .finally(() => setLoading(false));
  }, []);

  function handleSaved(updated: LoanProduct) {
    setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
    setEditing(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        <Loader2 size={24} className="animate-spin mr-2" />
        Đang tải sản phẩm…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm">
        <AlertCircle size={18} />
        {error}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {products.length} sản phẩm
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Mã</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Tên sản phẩm</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Phân loại</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Hạn mức tối thiểu</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Hạn mức tối đa</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Kỳ hạn (tháng)</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Lãi suất tối đa</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {products.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {p.code}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                    {p.name}
                    {p.professionBound && (
                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700">
                        Đối tượng
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                      {categoryLabel(p.category)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {formatCurrency(p.minAmount)}đ
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {formatCurrency(p.maxAmount)}đ
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {p.availableTerms?.join(', ')}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {p.maxInterestRate != null ? `${p.maxInterestRate}%/năm` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setEditing(p)}
                      title="Chỉnh sửa sản phẩm"
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Pencil size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {products.length === 0 && (
            <div className="py-16 text-center text-gray-400 dark:text-gray-600 text-sm">
              Chưa có sản phẩm nào
            </div>
          )}
        </div>
      </div>

      {editing && (
        <EditModal
          product={editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
