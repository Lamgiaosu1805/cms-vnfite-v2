import { useState, type FormEvent } from 'react';
import { Lock, RefreshCw, ShieldCheck } from 'lucide-react';
import { setupSuperAdmin } from '../api/client';

interface SetupPageProps {
  onDone: () => void;
}

export function SetupPage({ onDone }: SetupPageProps) {
  const [form, setForm] = useState({ username: '', email: '', fullName: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirm) { setError('Mật khẩu xác nhận không khớp'); return; }
    if (form.password.length < 8) { setError('Mật khẩu tối thiểu 8 ký tự'); return; }
    setError(''); setLoading(true);
    try {
      await setupSuperAdmin({ username: form.username, email: form.email, fullName: form.fullName, password: form.password });
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
            style={{ background: 'linear-gradient(135deg, #C82020, #8B0A0A)' }}>
            <ShieldCheck size={30} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Thiết lập VNFITE CMS</h1>
          <p className="text-gray-500 mt-2 text-sm">Tạo tài khoản Super Admin để bắt đầu sử dụng hệ thống</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-red-50 p-8 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Họ và tên</label>
              <input value={form.fullName} onChange={e => set('fullName', e.target.value)}
                placeholder="Nguyễn Văn A" required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none"
                onFocus={e => e.target.style.boxShadow = '0 0 0 2px rgba(200,32,32,0.2)'}
                onBlur={e => e.target.style.boxShadow = ''} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tên đăng nhập</label>
              <input value={form.username} onChange={e => set('username', e.target.value)}
                placeholder="superadmin" required minLength={3}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none"
                onFocus={e => e.target.style.boxShadow = '0 0 0 2px rgba(200,32,32,0.2)'}
                onBlur={e => e.target.style.boxShadow = ''} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                placeholder="admin@vnfite.com" required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none"
                onFocus={e => e.target.style.boxShadow = '0 0 0 2px rgba(200,32,32,0.2)'}
                onBlur={e => e.target.style.boxShadow = ''} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Mật khẩu</label>
              <input type="password" value={form.password} onChange={e => set('password', e.target.value)}
                placeholder="Tối thiểu 8 ký tự" required minLength={8}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none"
                onFocus={e => e.target.style.boxShadow = '0 0 0 2px rgba(200,32,32,0.2)'}
                onBlur={e => e.target.style.boxShadow = ''} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Xác nhận mật khẩu</label>
              <input type="password" value={form.confirm} onChange={e => set('confirm', e.target.value)}
                placeholder="Nhập lại mật khẩu" required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none"
                onFocus={e => e.target.style.boxShadow = '0 0 0 2px rgba(200,32,32,0.2)'}
                onBlur={e => e.target.style.boxShadow = ''} />
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2.5 rounded-xl border border-red-100">{error}</p>}

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 text-white font-semibold py-3 rounded-xl disabled:opacity-60 mt-2"
              style={{ background: 'linear-gradient(135deg, #C82020, #8B0A0A)' }}>
              {loading ? <RefreshCw size={18} className="animate-spin" /> : <Lock size={18} />}
              Tạo tài khoản Super Admin
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
