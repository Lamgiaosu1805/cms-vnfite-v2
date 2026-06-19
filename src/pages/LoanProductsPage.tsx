import { useEffect, useState } from 'react';
import { fetchLoanProducts, type LoanProduct } from '../api/client';
import { AlertCircle, Loader2 } from 'lucide-react';

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

export function LoanProductsPage() {
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  );
}
