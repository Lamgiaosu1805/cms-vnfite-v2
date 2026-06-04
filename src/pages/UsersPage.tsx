import { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, RefreshCw, Search, X } from 'lucide-react';
import { decideKyc, fetchUsers, updateUserStatus, type CmsUser } from '../api/client';
import { Badge } from '../components/Badge';

function formatDate(s: string | null | undefined) {
  if (!s) return '-';
  return new Date(s).toLocaleDateString('vi-VN');
}

interface ConfirmModalProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({ message, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
        <p className="text-gray-800 mb-5">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">Huỷ</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Xác nhận</button>
        </div>
      </div>
    </div>
  );
}

interface RejectModalProps {
  title: string;
  placeholder?: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

function ReasonModal({ title, placeholder, onConfirm, onCancel }: RejectModalProps) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
        <h3 className="font-semibold text-gray-800 mb-3">{title}</h3>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={placeholder || 'Nhập lý do...'}
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none mb-4"
        />
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">Huỷ</button>
          <button onClick={() => onConfirm(reason)} className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700">Xác nhận</button>
        </div>
      </div>
    </div>
  );
}

export function UsersPage() {
  const [data, setData] = useState<{ content: CmsUser[]; totalElements: number; totalPages: number } | null>(null);
  const [search, setSearch] = useState('');
  const [kycFilter, setKycFilter] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  // Modals
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [rejectModal, setRejectModal] = useState<{ title: string; onConfirm: (r: string) => void } | null>(null);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLoading(true);
    setError('');
    fetchUsers({ search, kycStatus: kycFilter || undefined, page, size: 20 })
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [search, kycFilter, page, refresh]);

  function handleSearchChange(value: string) {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setSearch(value);
      setPage(0);
    }, 400);
  }

  async function doAction(promise: Promise<void>) {
    try {
      await promise;
      setRefresh((r) => r + 1);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Lỗi thực hiện');
    }
  }

  function askApproveKyc(user: CmsUser) {
    setConfirmModal({
      message: `Duyệt KYC cho "${user.fullName || user.phone}"?`,
      onConfirm: () => {
        setConfirmModal(null);
        doAction(decideKyc(user.userId, 'APPROVED'));
      },
    });
  }

  function askRejectKyc(user: CmsUser) {
    setRejectModal({
      title: `Từ chối KYC "${user.fullName || user.phone}"`,
      onConfirm: (reason) => {
        setRejectModal(null);
        doAction(decideKyc(user.userId, 'REJECTED', reason));
      },
    });
  }

  function askToggleStatus(user: CmsUser) {
    const next = user.accountStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    setConfirmModal({
      message: `${next === 'SUSPENDED' ? 'Khoá' : 'Mở khoá'} tài khoản "${user.fullName || user.phone}"?`,
      onConfirm: () => {
        setConfirmModal(null);
        doAction(updateUserStatus(user.userId, next));
      },
    });
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 flex-1 min-w-48 border border-gray-300 rounded-lg px-3 py-2">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input
            defaultValue={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Tìm theo tên, SĐT, email..."
            className="flex-1 text-sm outline-none"
          />
        </div>
        <select
          value={kycFilter}
          onChange={(e) => { setKycFilter(e.target.value); setPage(0); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Tất cả KYC</option>
          <option value="NONE">Chưa KYC</option>
          <option value="PENDING">Chờ duyệt</option>
          <option value="APPROVED">Đã duyệt</option>
          <option value="REJECTED">Từ chối</option>
        </select>
        <button onClick={() => setRefresh((r) => r + 1)} className="p-2 text-gray-400 hover:text-gray-600">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {error && <p className="text-red-600 text-sm px-6 py-4 bg-red-50">{error}</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="text-left px-5 py-3.5">Tên khách hàng</th>
                <th className="text-center px-4 py-3.5">SĐT</th>
                <th className="text-center px-4 py-3.5">Số CCCD</th>
                <th className="text-center px-4 py-3.5">KYC</th>
                <th className="text-center px-4 py-3.5">Trạng thái</th>
                <th className="text-center px-4 py-3.5">Ngày tạo</th>
                <th className="text-center px-4 py-3.5">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && !data && (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400">
                  <RefreshCw size={18} className="animate-spin inline mr-2" /> Đang tải...
                </td></tr>
              )}
              {data?.content.map((user) => (
                <tr key={user.userId} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-gray-900">{user.fullName || <span className="text-gray-400 italic text-xs">Chưa cập nhật</span>}</p>
                    {user.email && <p className="text-xs text-gray-400 mt-0.5">{user.email}</p>}
                  </td>
                  <td className="px-4 py-3.5 text-center text-gray-700">{user.phone || '-'}</td>
                  <td className="px-4 py-3.5 text-center text-gray-600 font-mono text-xs tracking-wide">
                    {user.cccdNumber || <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-center"><Badge value={user.kycStatus} /></td>
                  <td className="px-4 py-3.5 text-center"><Badge value={user.accountStatus} /></td>
                  <td className="px-4 py-3.5 text-center text-gray-400 text-xs">{formatDate(user.createdAt)}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-center gap-1.5">
                      {user.kycStatus === 'PENDING' && (
                        <>
                          <button
                            onClick={() => askApproveKyc(user)}
                            title="Duyệt KYC"
                            className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-colors"
                          >
                            <Check size={15} />
                          </button>
                          <button
                            onClick={() => askRejectKyc(user)}
                            title="Từ chối KYC"
                            className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <X size={15} />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => askToggleStatus(user)}
                        className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${
                          user.accountStatus === 'ACTIVE'
                            ? 'text-orange-600 hover:bg-orange-50'
                            : 'text-green-600 hover:bg-green-50'
                        }`}
                      >
                        {user.accountStatus === 'ACTIVE' ? 'Khoá' : 'Mở khoá'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {data?.content.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400">Không có dữ liệu</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="px-5 py-3.5 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
            <span>Tổng {data.totalElements} khách hàng</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="px-2">Trang {page + 1} / {data.totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(data.totalPages - 1, p + 1))}
                disabled={page >= data.totalPages - 1}
                className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {confirmModal && (
        <ConfirmModal
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}
      {rejectModal && (
        <ReasonModal
          title={rejectModal.title}
          onConfirm={rejectModal.onConfirm}
          onCancel={() => setRejectModal(null)}
        />
      )}
    </div>
  );
}
