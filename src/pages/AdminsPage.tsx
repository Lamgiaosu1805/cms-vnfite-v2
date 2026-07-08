import { useEffect, useState } from 'react';
import { Check, Copy, KeyRound, RefreshCw, ShieldOff, SlidersHorizontal, UserPlus } from 'lucide-react';
import {
  createAdmin,
  listAdmins,
  resetAdminPassword,
  resetAdminTotp,
  toggleAdminActive,
  updateAdminRoles,
  updateAdminPermissions,
  CMS_ASSIGNABLE_ROLES,
  CMS_ROLE_LABELS,
  CMS_ROLE_DESCRIPTIONS,
  CMS_ASSIGNABLE_PERMISSIONS,
  CMS_PERMISSION_LABELS,
  CMS_PERMISSION_DESCRIPTIONS,
  type AdminItem,
  type CreateAdminResult,
  type ResetAdminPasswordResult,
} from '../api/client';
import { Badge } from '../components/Badge';
import { formatVietnamDateTime } from '../utils/dateTime';

/** Vai trò của một dòng admin — fallback về [role] nếu backend cũ chưa trả roles. */
function itemRoles(admin: AdminItem): string[] {
  return admin.roles && admin.roles.length > 0 ? admin.roles : (admin.role ? [admin.role] : []);
}

/** Quyền lẻ của một dòng admin. */
function itemPermissions(admin: AdminItem): string[] {
  return admin.permissions ?? [];
}

function RoleCheckboxGrid({ selected, onChange }: { selected: string[]; onChange: (roles: string[]) => void }) {
  const toggle = (r: string) =>
    onChange(selected.includes(r) ? selected.filter(x => x !== r) : [...selected, r]);
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {CMS_ASSIGNABLE_ROLES.map(r => {
        const on = selected.includes(r);
        return (
          <label
            key={r}
            className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm transition ${
              on
                ? 'border-red-400 bg-red-50 dark:border-red-700 dark:bg-red-900/20'
                : 'border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700/50'
            }`}
          >
            <input type="checkbox" checked={on} onChange={() => toggle(r)} className="mt-0.5 accent-red-600" />
            <span>
              <span className="block text-gray-800 dark:text-gray-200">{CMS_ROLE_LABELS[r] ?? r}</span>
              {CMS_ROLE_DESCRIPTIONS[r] && (
                <span className="mt-0.5 block text-[11px] leading-snug text-gray-400 dark:text-gray-500">
                  {CMS_ROLE_DESCRIPTIONS[r]}
                </span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}

function RoleChips({ roles }: { roles: string[] }) {
  if (roles.length === 0) return <span className="text-xs text-gray-400 dark:text-gray-500">—</span>;
  return (
    <div className="flex max-w-[240px] flex-wrap gap-1">
      {roles.map(r => (
        <span
          key={r}
          className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200"
        >
          {CMS_ROLE_LABELS[r] ?? r}
        </span>
      ))}
    </div>
  );
}

function PermissionCheckboxGrid({ selected, onChange }: { selected: string[]; onChange: (permissions: string[]) => void }) {
  const toggle = (p: string) =>
    onChange(selected.includes(p) ? selected.filter(x => x !== p) : [...selected, p]);
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {CMS_ASSIGNABLE_PERMISSIONS.map(p => {
        const on = selected.includes(p);
        return (
          <label
            key={p}
            className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm transition ${
              on
                ? 'border-amber-400 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20'
                : 'border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700/50'
            }`}
          >
            <input type="checkbox" checked={on} onChange={() => toggle(p)} className="mt-0.5 accent-amber-600" />
            <span>
              <span className="block text-gray-800 dark:text-gray-200">{CMS_PERMISSION_LABELS[p] ?? p}</span>
              {CMS_PERMISSION_DESCRIPTIONS[p] && (
                <span className="mt-0.5 block text-[11px] leading-snug text-gray-400 dark:text-gray-500">
                  {CMS_PERMISSION_DESCRIPTIONS[p]}
                </span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}

function PermissionChips({ permissions }: { permissions: string[] }) {
  if (permissions.length === 0) return null;
  return (
    <div className="mt-1 flex max-w-[240px] flex-wrap gap-1">
      {permissions.map(p => (
        <span
          key={p}
          className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
        >
          + {CMS_PERMISSION_LABELS[p] ?? p}
        </span>
      ))}
    </div>
  );
}

interface CreateModalProps {
  onCreated: (result: CreateAdminResult) => void;
  onCancel: () => void;
}

function CreateModal({ onCreated, onCancel }: CreateModalProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>(['CUSTOMER_SUPPORT']);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!fullName || !email) { setError('Vui lòng điền đầy đủ họ tên và email'); return; }
    if (roles.length === 0) { setError('Chọn ít nhất một vai trò'); return; }
    setLoading(true); setError('');
    try {
      const result = await createAdmin({ fullName, email, roles, permissions });
      onCreated(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
        <h3 className="mb-4 text-lg font-bold text-gray-800 dark:text-gray-100">Tạo tài khoản Admin</h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Họ và tên</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)}
              placeholder="Nghiêm Khắc Lâm"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
              style={{ ['--tw-ring-color' as string]: '#C82020' }} />
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Username sẽ tự sinh — vd: lamnk</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="lamnk@vnfite.com"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Vai trò (chọn nhiều được)</label>
            <RoleCheckboxGrid selected={roles} onChange={setRoles} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Cấp thêm quyền <span className="font-normal text-gray-400 dark:text-gray-500">(tuỳ chọn — cấp 1 tính năng lẻ của phòng ban khác)</span>
            </label>
            <PermissionCheckboxGrid selected={permissions} onChange={setPermissions} />
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20">{error}</p>}
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onCancel} className="rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700/50">Huỷ</button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #C82020, #8B0A0A)' }}>
            {loading ? <RefreshCw size={15} className="animate-spin" /> : <UserPlus size={15} />}
            Tạo tài khoản
          </button>
        </div>
      </div>
    </div>
  );
}

function EditAccessModal({ admin, onSaved, onCancel }: {
  admin: AdminItem;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [roles, setRoles] = useState<string[]>(itemRoles(admin));
  const [permissions, setPermissions] = useState<string[]>(itemPermissions(admin));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (roles.length === 0) { setError('Chọn ít nhất một vai trò'); return; }
    setSaving(true); setError('');
    try {
      await updateAdminRoles(admin.id, roles);
      await updateAdminPermissions(admin.id, permissions);
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Lỗi đổi quyền');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Phân quyền cho {admin.fullName}</h3>
        <p className="mb-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
          Một tài khoản có thể mang nhiều vai trò phòng ban. Quyền là hợp của tất cả vai trò được chọn.
        </p>
        <RoleCheckboxGrid selected={roles} onChange={setRoles} />

        <p className="mb-1.5 mt-5 text-sm font-medium text-gray-700 dark:text-gray-300">
          Cấp thêm quyền <span className="font-normal text-gray-400 dark:text-gray-500">(1 tính năng lẻ của phòng ban khác)</span>
        </p>
        <PermissionCheckboxGrid selected={permissions} onChange={setPermissions} />

        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20">{error}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onCancel} className="rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700/50">Huỷ</button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #C82020, #8B0A0A)' }}>
            {saving ? <RefreshCw size={15} className="animate-spin" /> : <Check size={15} />}
            Lưu phân quyền
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

  const roleText = 'roles' in result && result.roles && result.roles.length > 0
    ? result.roles.map(r => CMS_ROLE_LABELS[r] ?? r).join(', ')
    : ('role' in result ? (CMS_ROLE_LABELS[result.role] ?? result.role) : '-');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <Check size={20} className="text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 dark:text-gray-100">
              {mode === 'reset' ? 'Reset mật khẩu thành công' : 'Tạo tài khoản thành công'}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Gửi thông tin này cho {result.fullName}</p>
          </div>
        </div>

        <div className="mb-4 space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-300">⚠️ Mật khẩu chỉ hiển thị 1 lần duy nhất</p>
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
            <div className="flex justify-between gap-3 text-sm">
              <span className="shrink-0 text-gray-500 dark:text-gray-400">Vai trò</span>
              <strong className="text-right dark:text-gray-100">{roleText}</strong>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={copy}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 py-2 text-sm hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700/50">
            {copied ? <Check size={15} className="text-green-600 dark:text-green-400" /> : <Copy size={15} />}
            {copied ? 'Đã copy' : 'Copy thông tin'}
          </button>
          <button onClick={onClose}
            className="flex-1 rounded-lg py-2 text-sm font-medium text-white"
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
  const [editAccessFor, setEditAccessFor] = useState<AdminItem | null>(null);
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">Quản lý tài khoản admin & phân quyền theo phòng ban</p>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white"
          style={{ background: 'linear-gradient(135deg, #C82020, #8B0A0A)' }}>
          <UserPlus size={16} />
          Thêm Admin
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        {error && <p className="bg-red-50 px-6 py-4 text-sm text-red-600 dark:bg-red-900/20">{error}</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
                <th className="px-5 py-3.5 text-left font-medium text-gray-600 dark:text-gray-400">Admin</th>
                <th className="px-4 py-3.5 text-left font-medium text-gray-600 dark:text-gray-400">Username</th>
                <th className="px-4 py-3.5 text-left font-medium text-gray-600 dark:text-gray-400">Vai trò</th>
                <th className="px-4 py-3.5 text-left font-medium text-gray-600 dark:text-gray-400">Trạng thái</th>
                <th className="px-4 py-3.5 text-left font-medium text-gray-600 dark:text-gray-400">TOTP</th>
                <th className="px-4 py-3.5 text-left font-medium text-gray-600 dark:text-gray-400">Ngày tạo</th>
                <th className="px-4 py-3.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {loading && (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400 dark:text-gray-500">
                  <RefreshCw size={18} className="mr-2 inline animate-spin" />Đang tải...
                </td></tr>
              )}
              {admins.map(admin => {
                const isSuper = admin.role === 'SUPER_ADMIN' || itemRoles(admin).includes('SUPER_ADMIN');
                return (
                  <tr key={admin.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-gray-900 dark:text-gray-50">{admin.fullName}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{admin.email}</p>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-gray-700 dark:text-gray-300">{admin.username}</td>
                    <td className="px-4 py-3.5">
                      {isSuper ? (
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
                          style={{ background: 'linear-gradient(135deg,#C82020,#8B0A0A)' }}
                        >
                          {CMS_ROLE_LABELS.SUPER_ADMIN}
                        </span>
                      ) : (
                        <div className="flex items-start gap-2">
                          <div>
                            <RoleChips roles={itemRoles(admin)} />
                            <PermissionChips permissions={itemPermissions(admin)} />
                          </div>
                          <button
                            onClick={() => setEditAccessFor(admin)}
                            disabled={actionLoadingId === admin.id}
                            title="Sửa phân quyền"
                            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700/50"
                          >
                            <SlidersHorizontal size={12} /> Sửa
                          </button>
                        </div>
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
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        admin.totpEnabled
                          ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
                      }`}>
                        {admin.totpEnabled ? 'Đã bật' : 'Chưa bật'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-gray-400 dark:text-gray-500">{formatVietnamDateTime(admin.createdAt, '-')}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          onClick={() => handleResetPassword(admin)}
                          disabled={actionLoadingId === admin.id}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-700 hover:bg-amber-100 disabled:opacity-60 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/30">
                          <KeyRound size={13} />
                          Reset MK
                        </button>
                        <button
                          onClick={() => handleResetTotp(admin)}
                          disabled={actionLoadingId === admin.id || !admin.totpEnabled}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-700 hover:bg-blue-100 disabled:opacity-50 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30">
                          <ShieldOff size={13} />
                          Reset TOTP
                        </button>
                        {!isSuper && (
                          <button onClick={() => handleToggle(admin.id)}
                            disabled={actionLoadingId === admin.id}
                            className="rounded-lg border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700/50">
                            {admin.active ? 'Khoá' : 'Mở khoá'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && admins.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400 dark:text-gray-500">Chưa có admin nào</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <CreateModal
          onCreated={result => { setShowCreate(false); setCreatedResult(result); load(); }}
          onCancel={() => setShowCreate(false)}
        />
      )}
      {editAccessFor && (
        <EditAccessModal
          admin={editAccessFor}
          onSaved={() => { setEditAccessFor(null); load(); }}
          onCancel={() => setEditAccessFor(null)}
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
