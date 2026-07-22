import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Building2, RefreshCw, UserRoundPlus } from 'lucide-react';

import {
  createCounterBranch,
  createCounterStaff,
  fetchCounterBranches,
  fetchCounterStaff,
  type CounterBranch,
  type CounterRole,
  type CounterStaff,
} from '../api/client';

const roleLabels: Record<CounterRole, string> = {
  TELLER: 'Giao dịch viên',
  SUPERVISOR: 'Kiểm soát viên',
};

export function CounterManagementPage() {
  const [branches, setBranches] = useState<CounterBranch[]>([]);
  const [staff, setStaff] = useState<CounterStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [branchForm, setBranchForm] = useState({ branchCode: '', branchName: '', address: '' });
  const [staffForm, setStaffForm] = useState({
    username: '', temporaryPassword: '', employeeCode: '', fullName: '',
    role: 'TELLER' as CounterRole, branchId: '',
  });

  const branchNames = useMemo(
    () => new Map(branches.map(branch => [branch.id, `${branch.branchCode} - ${branch.branchName}`])),
    [branches],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [branchData, staffData] = await Promise.all([fetchCounterBranches(), fetchCounterStaff()]);
      setBranches(branchData);
      setStaff(staffData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải dữ liệu điểm giao dịch.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const submitBranch = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true); setError(''); setNotice('');
    try {
      await createCounterBranch({ ...branchForm, branchCode: branchForm.branchCode.trim().toUpperCase() });
      setBranchForm({ branchCode: '', branchName: '', address: '' });
      setNotice('Đã tạo điểm giao dịch.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tạo điểm giao dịch.');
    } finally { setSaving(false); }
  };

  const submitStaff = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true); setError(''); setNotice('');
    try {
      await createCounterStaff({
        ...staffForm,
        username: staffForm.username.trim().toLowerCase(),
        employeeCode: staffForm.employeeCode.trim().toUpperCase(),
      });
      setStaffForm({ username: '', temporaryPassword: '', employeeCode: '', fullName: '', role: 'TELLER', branchId: '' });
      setNotice('Đã cấp tài khoản nhân viên quầy. Nhân viên phải đổi mật khẩu khi đăng nhập lần đầu.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể cấp tài khoản nhân viên quầy.');
    } finally { setSaving(false); }
  };

  const inputClass = 'mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#C82020] focus:ring-2 focus:ring-red-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-red-950';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Điểm giao dịch</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Cấp chi nhánh và tài khoản tác nghiệp độc lập cho nhân viên tại quầy.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Tải lại
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</div>}
      {notice && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">{notice}</div>}

      <div className="grid gap-6 xl:grid-cols-2">
        <form onSubmit={submitBranch} className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4 flex items-center gap-2"><Building2 size={20} className="text-[#C82020]" /><h3 className="font-semibold text-gray-900 dark:text-gray-100">Tạo điểm giao dịch</h3></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Mã điểm<input className={inputClass} value={branchForm.branchCode} onChange={e => setBranchForm({ ...branchForm, branchCode: e.target.value })} maxLength={30} required /></label>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tên điểm<input className={inputClass} value={branchForm.branchName} onChange={e => setBranchForm({ ...branchForm, branchName: e.target.value })} maxLength={200} required /></label>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 sm:col-span-2">Địa chỉ<input className={inputClass} value={branchForm.address} onChange={e => setBranchForm({ ...branchForm, address: e.target.value })} maxLength={500} required /></label>
          </div>
          <button disabled={saving} className="mt-5 rounded-lg bg-[#C82020] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#A81717] disabled:opacity-50">Tạo điểm giao dịch</button>
        </form>

        <form onSubmit={submitStaff} className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4 flex items-center gap-2"><UserRoundPlus size={20} className="text-[#C82020]" /><h3 className="font-semibold text-gray-900 dark:text-gray-100">Cấp tài khoản nhân viên quầy</h3></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Họ tên<input className={inputClass} value={staffForm.fullName} onChange={e => setStaffForm({ ...staffForm, fullName: e.target.value })} maxLength={200} required /></label>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Mã nhân viên<input className={inputClass} value={staffForm.employeeCode} onChange={e => setStaffForm({ ...staffForm, employeeCode: e.target.value })} maxLength={50} required /></label>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tên đăng nhập<input className={inputClass} value={staffForm.username} onChange={e => setStaffForm({ ...staffForm, username: e.target.value })} pattern="[a-zA-Z0-9._-]+" maxLength={80} required /></label>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Mật khẩu tạm<input type="password" className={inputClass} value={staffForm.temporaryPassword} onChange={e => setStaffForm({ ...staffForm, temporaryPassword: e.target.value })} minLength={12} maxLength={200} required /></label>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Vai trò<select className={inputClass} value={staffForm.role} onChange={e => setStaffForm({ ...staffForm, role: e.target.value as CounterRole })}><option value="TELLER">Giao dịch viên</option><option value="SUPERVISOR">Kiểm soát viên</option></select></label>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Điểm giao dịch<select className={inputClass} value={staffForm.branchId} onChange={e => setStaffForm({ ...staffForm, branchId: e.target.value })} required><option value="">Chọn điểm giao dịch</option>{branches.filter(branch => branch.active).map(branch => <option key={branch.id} value={branch.id}>{branch.branchCode} - {branch.branchName}</option>)}</select></label>
          </div>
          <button disabled={saving || branches.length === 0} className="mt-5 rounded-lg bg-[#C82020] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#A81717] disabled:opacity-50">Cấp tài khoản</button>
        </form>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800"><h3 className="font-semibold text-gray-900 dark:text-gray-100">Tài khoản nhân viên quầy ({staff.length})</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-950 dark:text-gray-400"><tr><th className="px-5 py-3">Nhân viên</th><th className="px-5 py-3">Tài khoản</th><th className="px-5 py-3">Vai trò</th><th className="px-5 py-3">Điểm giao dịch</th><th className="px-5 py-3">Trạng thái</th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {staff.map(item => <tr key={item.id} className="text-gray-700 dark:text-gray-300"><td className="px-5 py-3"><div className="font-medium text-gray-900 dark:text-gray-100">{item.fullName}</div><div className="text-xs text-gray-500">{item.employeeCode}</div></td><td className="px-5 py-3 font-mono">{item.username}</td><td className="px-5 py-3">{roleLabels[item.role]}</td><td className="px-5 py-3">{branchNames.get(item.branchId) ?? item.branchId}</td><td className="px-5 py-3"><span className={`rounded-full px-2 py-1 text-xs font-medium ${item.active ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>{item.active ? (item.mustChangePassword ? 'Chờ đổi mật khẩu' : 'Hoạt động') : 'Đã khóa'}</span></td></tr>)}
              {!loading && staff.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-500 dark:text-gray-400">Chưa có tài khoản nhân viên quầy.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
