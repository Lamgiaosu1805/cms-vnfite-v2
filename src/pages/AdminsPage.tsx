import { useEffect, useState } from 'react';
import { Check, Copy, KeyRound, RefreshCw, ShieldOff, UserPlus } from 'lucide-react';
import {
  createAdmin,
  listAdmins,
  resetAdminPassword,
  resetAdminTotp,
  toggleAdminActive,
  updateAdminRole,
  type AdminItem,
  type CreateAdminResult,
  type ResetAdminPasswordResult,
} from '../api/client';
import { Badge } from '../components/Badge';
import { formatVietnamDate } from '../utils/dateTime';

interface CreateModalProps {
  onCreated: (result: CreateAdminResult) => void;
  onCancel: () => void;
}

function CreateModal({ onCreated, onCancel }: CreateModalProps) {
  const [form, setForm] = useState({ fullName: '', email: '', role: 'ADMIN' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function set(field: string, value: string) { setForm(f => ({ ...f, [field]: value })); }

  async function handleSubmit() {
    if (!form.fullName || !form.email) { setError('Vui lòng điền đầy đủ thông tin'); return; }
    setLoading(true); setError('');
    try {
      const result = await createAdmin(form);
      onCreated(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm">
        <h3 className="font-bold text-gray-800 dark:text-gray-100 text-lg mb-4">Tạo tài khoản Admin</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Họ và tên</label>
            <input value={form.fullName} onChange={e => set('fullName', e.target.value)}
              placeholder="Nghiêm Khắc Lâm"
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
              style={{ ['--tw-ring-color' as string]: '#C82020' }} />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Username sẽ tự sinh — vd: lamnk</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
              placeholder="lamnk@vnfite.com"
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
            <select value={form.role} onChange={e => set('role', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none dark:bg-gray-700 dark:text-gray-100">
              <option value="ADMIN">ADMIN — Toàn quyền</option>
              <option value="OPS">OPS — Vận hành</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
        </div>
        <div className="flex gap-3 mt-5 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300">Huỷ</button>
          <button onClick={handleSubmit} disabled={loading}
            className="px-4 py-2 text-sm rounded-lg text-white font-medium flex items-center gap-2 disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #C82020, #8B0A0A)' }}>
            {loading ? <RefreshCw size={15} className="animate-spin" /> : <UserPlus size={15} />}
            Tạo tài khoản
          </button>
        </div>
      </div>
    </div>
  );
}

interface CreatedResultProps {
  result: CreateAdminResult | ResetAdminPasswordResult;
  onClose: () => void;
  mode?: 'created' | 'reset';
}

function CreatedResultModal({ result, onClose, mode = 'created' }: CreatedResultProps) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(
      `Username: ${result.username}\nPassword: ${result.generatedPassword}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <Check size={20} className="text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 dark:text-gray-100">
              {mode === 'reset' ? 'Reset mật khẩu thành công' : 'Tạo tài khoản thành công'}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Gửi thông tin này cho {result.fullName}</p>
          </div>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-2 mb-4">
          <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">⚠️ Mật khẩu chỉ hiển thị 1 lần duy nhất</p>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Họ tên</span>
              <strong className="dark:text-gray-100">{result.fullName}</strong>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Username</span>
              <strong className="font-mono dark:text-gray-100">{result.username}</strong>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Password</span>
              <strong className="font-mono text-red-700 dark:text-red-400">{result.generatedPassword}</strong>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Role</span>
              <strong className="dark:text-gray-100">{'role' in result ? result.role : '-'}</strong>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={copy}
            className="flex-1 flex items-center justify-center gap-2 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300">
            {copied ? <Check size={15} className="text-green-600 dark:text-green-400" /> : <Copy size={15} />}
            {copied ? 'Đã copy' : 'Copy thông tin'}
          </button>
          <button onClick={onClose}
            className="flex-1 py-2 text-sm rounded-lg text-white font-medium"
            style={{ background: 'linear-gradient(135deg, #C82020, #8B0A0A)' }}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminsPage() {
  const [admins, setAdmins] = useState<AdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createdResult, setCreatedResult] = useState<CreateAdminResult | null>(null);
  const [resetPasswordResult, setResetPasswordResult] = useState<ResetAdminPasswordResult | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    listAdmins()
      .then(setAdmins)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  async function handleToggle(id: string) {
    try { await toggleAdminActive(id); load(); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : 'Lỗi'); }
  }

  async function handleResetPassword(admin: AdminItem) {
    if (!window.confirm(`Reset mật khẩu cho tài khoản ${admin.username}? Mật khẩu mới sẽ chỉ hiển thị một lần.`)) return;
    setActionLoadingId(admin.id);
    try {
      const result = await resetAdminPassword(admin.id);
      setResetPasswordResult(result);
      load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Lỗi reset mật khẩu');
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleResetTotp(admin: AdminItem) {
    if (!window.confirm(`Reset TOTP cho tài khoản ${admin.username}? Lần đăng nhập tiếp theo tài khoản này sẽ phải quét QR thiết lập lại.`)) return;
    setActionLoadingId(admin.id);
    try {
      await resetAdminTotp(admin.id);
      load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Lỗi reset TOTP');
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleRoleChange(admin: AdminItem, nextRole: 'ADMIN' | 'OPS') {
    if (nextRole === admin.role) return;
    if (!window.confirm(`Đổi quyền tài khoản ${admin.username} từ ${admin.role} sang ${nextRole}?`)) {
      setAdmins((current) => [...current]);
      return;
    }
    setActionLoadingId(admin.id);
    try {
      await updateAdminRole(admin.id, nextRole);
      load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Lỗi đổi quyền');
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">Quản lý tài khoản admin hệ thống</p>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm text-white font-medium rounded-xl"
          style={{ background: 'linear-gradient(135deg, #C82020, #8B0A0A)' }}>
          <UserPlus size={16} />
          Thêm Admin
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {error && <p className="text-red-600 text-sm px-6 py-4 bg-red-50 dark:bg-red-900/20">{error}</p>}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <th className="text-left px-5 py-3.5 font-medium text-gray-600 dark:text-gray-400">Admin</th>
              <th className="text-left px-4 py-3.5 font-medium text-gray-600 dark:text-gray-400">Username</th>
              <th className="text-left px-4 py-3.5 font-medium text-gray-600 dark:text-gray-400">Role</th>
              <th className="text-left px-4 py-3.5 font-medium text-gray-600 dark:text-gray-400">Trạng thái</th>
              <th className="text-left px-4 py-3.5 font-medium text-gray-600 dark:text-gray-400">TOTP</th>
              <th className="text-left px-4 py-3.5 font-medium text-gray-600 dark:text-gray-400">Ngày tạo</th>
              <th className="px-4 py-3.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {loading && (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400 dark:text-gray-500">
                <RefreshCw size={18} className="animate-spin inline mr-2" />Đang tải...
              </td></tr>
            )}
            {admins.map(admin => (
              <tr key={admin.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                <td className="px-5 py-3.5">
                  <p className="font-medium text-gray-900 dark:text-gray-50">{admin.fullName}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{admin.email}</p>
                </td>
                <td className="px-4 py-3.5 font-mono text-gray-700 dark:text-gray-300">{admin.username}</td>
                <td className="px-4 py-3.5">
                  {admin.role === 'SUPER_ADMIN' ? (
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
                      style={{ background: 'linear-gradient(135deg,#C82020,#8B0A0A)' }}
                    >
                      SUPER_ADMIN
                    </span>
                  ) : (
                    <select
                      value={admin.role}
                      disabled={actionLoadingId === admin.id}
                      onChange={(event) => void handleRoleChange(admin, event.target.value as 'ADMIN' | 'OPS')}
                      className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 outline-none transition hover:bg-gray-50 focus:ring-2 focus:ring-red-500 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
                    >
                      <option value="ADMIN">ADMIN</option>
                      <option value="OPS">OPS</option>
                    </select>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex flex-col gap-1">
                    <Badge value={admin.active ? 'active' : 'suspended'} />
                    {admin.mustChangePassword && (
                      <span className="text-xs text-amber-600 dark:text-amber-400">⚠️ Chưa đổi MK</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    admin.totpEnabled
                      ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                      : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                  }`}>
                    {admin.totpEnabled ? 'Đã bật' : 'Chưa bật'}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-gray-400 dark:text-gray-500">{formatVietnamDate(admin.createdAt, '-')}</td>
                <td className="px-4 py-3.5">
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      onClick={() => handleResetPassword(admin)}
                      disabled={actionLoadingId === admin.id}
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-700 dark:text-amber-300 disabled:opacity-60">
                      <KeyRound size={13} />
                      Reset MK
                    </button>
                    <button
                      onClick={() => handleResetTotp(admin)}
                      disabled={actionLoadingId === admin.id || !admin.totpEnabled}
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-lg border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-300 disabled:opacity-50">
                      <ShieldOff size={13} />
                      Reset TOTP
                    </button>
                    {admin.role !== 'SUPER_ADMIN' && (
                      <button onClick={() => handleToggle(admin.id)}
                        disabled={actionLoadingId === admin.id}
                        className="text-xs px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-300 disabled:opacity-60">
                        {admin.active ? 'Khoá' : 'Mở khoá'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && admins.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400 dark:text-gray-500">Chưa có admin nào</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateModal
          onCreated={result => { setShowCreate(false); setCreatedResult(result); load(); }}
          onCancel={() => setShowCreate(false)}
        />
      )}
      {createdResult && (
        <CreatedResultModal result={createdResult} onClose={() => setCreatedResult(null)} />
      )}
      {resetPasswordResult && (
        <CreatedResultModal
          result={resetPasswordResult}
          mode="reset"
          onClose={() => setResetPasswordResult(null)}
        />
      )}
    </div>
  );
}
