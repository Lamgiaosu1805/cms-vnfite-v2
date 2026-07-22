import { useState, type FormEvent } from 'react';
import { ArrowLeft, RefreshCw, ShieldCheck } from 'lucide-react';
import { verifyTotp, getLastUsername, type LoginResult } from '../api/client';

interface Props {
  pendingToken: string;
  onLoggedIn: (result: LoginResult) => void;
  onBack: () => void;
}

export function TotpVerifyPage({ pendingToken, onLoggedIn, onBack }: Props) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const username = getLastUsername();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await verifyTotp(pendingToken, code);
      onLoggedIn(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Mã OTP không đúng');
      setCode('');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FFF8F7] p-6">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onBack} className="p-2 rounded-xl hover:bg-red-50 transition">
            <ArrowLeft size={18} style={{ color: '#C82020' }} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-white shadow flex items-center justify-center">
              <img src="/logo.png" alt="VNFITE" className="w-6 h-6 object-contain" />
            </div>
            <span className="font-bold text-gray-800 dark:text-gray-200">VNFITE Core</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-red-50 p-8">
          {/* Icon + title */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
              style={{ background: 'linear-gradient(135deg, #C82020, #8B0A0A)' }}>
              <ShieldCheck size={28} className="text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-800">Xác thực 2 lớp</h2>
            {username && (
              <p className="text-sm text-gray-400 mt-1">
                Đăng nhập với <span className="font-medium text-gray-600">{username}</span>
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 text-center">
                Nhập mã từ ứng dụng xác thực
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full px-4 py-4 border border-gray-200 rounded-xl text-center text-3xl font-mono tracking-[0.5em] focus:outline-none transition"
                onFocus={e => e.target.style.boxShadow = '0 0 0 2px rgba(200,32,32,0.25)'}
                onBlur={e => e.target.style.boxShadow = ''}
                autoFocus
                required
              />
              <p className="text-xs text-gray-400 text-center mt-2">
                Mã có hiệu lực trong 30 giây
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2.5 rounded-xl border border-red-100 text-center">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full flex items-center justify-center gap-2 text-white font-semibold py-3 rounded-xl transition-opacity disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #C82020, #8B0A0A)' }}
            >
              {loading ? <RefreshCw size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
              Xác nhận
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          © 2025 VNFITE. All rights reserved.
        </p>
      </div>
    </div>
  );
}
