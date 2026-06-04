import { useState, type FormEvent } from 'react';
import { KeyRound, RefreshCw } from 'lucide-react';
import { changePassword, type AdminInfo } from '../api/client';

interface ChangePasswordPageProps {
  admin: AdminInfo;
  onDone: () => void;
}

export function ChangePasswordPage({ admin, onDone }: ChangePasswordPageProps) {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (form.next !== form.confirm) { setError('Mật khẩu xác nhận không khớp'); return; }
    if (form.next.length < 8) { setError('Mật khẩu mới tối thiểu 8 ký tự'); return; }
    if (form.next === form.current) { setError('Mật khẩu mới phải khác mật khẩu hiện tại'); return; }
    setError(''); setLoading(true);
    try {
      await changePassword(form.current, form.next);
      onDone();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FFF8F7] p-6">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #E8A030, #C47820)' }}>
            <KeyRound size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Đổi mật khẩu</h1>
          <p className="text-gray-500 mt-2 text-sm">
            Xin chào <strong>{admin.fullName}</strong>, bạn cần đổi mật khẩu trước khi tiếp tục
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-amber-100 p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Mật khẩu hiện tại</label>
              <input type="password" value={form.current} onChange={e => set('current', e.target.value)}
                required placeholder="Mật khẩu được cấp khi tạo tài khoản"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none"
                onFocus={e => e.target.style.boxShadow = '0 0 0 2px rgba(232,160,48,0.3)'}
                onBlur={e => e.target.style.boxShadow = ''} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Mật khẩu mới</label>
              <input type="password" value={form.next} onChange={e => set('next', e.target.value)}
                required minLength={8} placeholder="Tối thiểu 8 ký tự"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none"
                onFocus={e => e.target.style.boxShadow = '0 0 0 2px rgba(232,160,48,0.3)'}
                onBlur={e => e.target.style.boxShadow = ''} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Xác nhận mật khẩu mới</label>
              <input type="password" value={form.confirm} onChange={e => set('confirm', e.target.value)}
                required placeholder="Nhập lại mật khẩu mới"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none"
                onFocus={e => e.target.style.boxShadow = '0 0 0 2px rgba(232,160,48,0.3)'}
                onBlur={e => e.target.style.boxShadow = ''} />
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2.5 rounded-xl border border-red-100">{error}</p>}

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 text-white font-semibold py-3 rounded-xl disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #E8A030, #C47820)' }}>
              {loading ? <RefreshCw size={18} className="animate-spin" /> : <KeyRound size={18} />}
              Xác nhận đổi mật khẩu
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
