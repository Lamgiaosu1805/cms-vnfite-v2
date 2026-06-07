import { useState, type FormEvent } from 'react';
import { BarChart3, CircleDollarSign, Lock, RefreshCw, Users } from 'lucide-react';
import { login, saveLastUsername, getLastUsername } from '../api/client';

interface LoginPageProps {
  onPasswordVerified: (pendingToken: string, totpEnabled: boolean) => void;
  notice?: string;
  onNoticeDismiss?: () => void;
}

export function LoginPage({ onPasswordVerified, notice, onNoticeDismiss }: LoginPageProps) {
  const [username, setUsername] = useState(getLastUsername);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      saveLastUsername(username);
      const { pendingToken, totpEnabled } = await login(username, password);
      onPasswordVerified(pendingToken, totpEnabled);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — brand */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #8B0A0A 0%, #C82020 60%, #E84A20 100%)' }}
      >
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #ffffff, transparent)', transform: 'translate(30%, -30%)' }} />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #E8A030, transparent)', transform: 'translate(-30%, 30%)' }} />

        <div className="w-28 h-28 rounded-3xl bg-white flex items-center justify-center mb-8 shadow-2xl">
          <img src="/logo.png" alt="VNFITE" className="w-20 h-20 object-contain" />
        </div>
        <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">VNFITE CMS</h1>
        <p className="text-red-200 text-lg text-center max-w-xs">
          Cổng quản trị nền tảng cho vay ngang hàng
        </p>

        <div className="mt-12 grid grid-cols-3 gap-4 w-full max-w-xs">
          {[
            { label: 'Khách hàng', icon: <Users size={22} className="text-white" /> },
            { label: 'Khoản vay', icon: <CircleDollarSign size={22} className="text-white" /> },
            { label: 'Thống kê', icon: <BarChart3 size={22} className="text-white" /> },
          ].map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-2 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.12)' }}>
              {item.icon}
              <span className="text-white text-xs font-medium">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[#FFF8F7] dark:bg-gray-900">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex lg:hidden flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-white dark:bg-gray-800 shadow-md border border-red-100 dark:border-gray-700 flex items-center justify-center mb-3">
              <img src="/logo.png" alt="VNFITE" className="w-12 h-12 object-contain" />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: '#C82020' }}>VNFITE CMS</h1>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-red-50 dark:border-gray-700 p-8">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-1">Đăng nhập</h2>
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-6">Nhập thông tin tài khoản quản trị</p>

            {notice && (
              <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                <div className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500" />
                <div className="flex-1 leading-5">{notice}</div>
                {onNoticeDismiss && (
                  <button
                    type="button"
                    onClick={onNoticeDismiss}
                    className="text-amber-700 transition hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
                    aria-label="Đóng thông báo"
                  >
                    ×
                  </button>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Tên đăng nhập
                </label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="off"
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:outline-none transition dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
                  onFocus={e => e.target.style.boxShadow = '0 0 0 2px rgba(200,32,32,0.25)'}
                  onBlur={e => e.target.style.boxShadow = ''}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Mật khẩu
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:outline-none transition dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
                  onFocus={e => e.target.style.boxShadow = '0 0 0 2px rgba(200,32,32,0.25)'}
                  onBlur={e => e.target.style.boxShadow = ''}
                  required
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2.5 rounded-xl border border-red-100 dark:border-red-900/40">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 text-white font-semibold py-3 rounded-xl transition-opacity disabled:opacity-60 mt-2"
                style={{ background: 'linear-gradient(135deg, #C82020, #8B0A0A)' }}
              >
                {loading ? <RefreshCw size={18} className="animate-spin" /> : <Lock size={18} />}
                Tiếp theo
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-6">
            © 2025 VNFITE. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
