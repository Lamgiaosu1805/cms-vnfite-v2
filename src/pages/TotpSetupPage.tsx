import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, CheckCircle, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react';
import QRCode from 'qrcode';
import { initTotpSetup, confirmTotpSetup, type LoginResult, type TotpSetupData } from '../api/client';

interface Props {
  pendingToken: string;
  onLoggedIn: (result: LoginResult) => void;
  onBack: () => void;
}

export function TotpSetupPage({ pendingToken, onLoggedIn, onBack }: Props) {
  const [step, setStep] = useState<'loading' | 'scan' | 'confirm' | 'error'>('loading');
  const [setupData, setSetupData] = useState<TotpSetupData | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    initTotpSetup(pendingToken)
      .then(async (data) => {
        setSetupData(data);
        const url = await QRCode.toDataURL(data.otpAuthUrl, { width: 200, margin: 1 });
        setQrDataUrl(url);
        setStep('scan');
      })
      .catch(() => setStep('error'));
  }, [pendingToken]);

  async function handleConfirm(e: FormEvent) {
    e.preventDefault();
    if (!setupData) return;
    setError('');
    setSubmitting(true);
    try {
      const result = await confirmTotpSetup(pendingToken, setupData.secret, code);
      onLoggedIn(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Xác thực thất bại');
      setSubmitting(false);
    }
  }

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFF8F7]">
        <RefreshCw size={28} className="animate-spin" style={{ color: '#C82020' }} />
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFF8F7] p-6">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <p className="text-red-600 mb-4">Không thể tải thông tin thiết lập. Phiên có thể đã hết hạn.</p>
          <button onClick={onBack} className="text-sm font-medium" style={{ color: '#C82020' }}>
            ← Quay lại đăng nhập
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FFF8F7] p-6">
      <div className="w-full max-w-md">
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
            <h2 className="text-xl font-bold text-gray-800">Thiết lập xác thực 2 lớp</h2>
            <p className="text-sm text-gray-400 text-center mt-1">
              Bắt buộc cho mọi tài khoản quản trị VNFITE Core
            </p>
          </div>

          {step === 'scan' && (
            <>
              {/* Steps */}
              <div className="space-y-4 mb-6">
                <div className="flex gap-3">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5"
                    style={{ background: '#C82020' }}>1</span>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Cài ứng dụng xác thực</p>
                    <p className="text-xs text-gray-400">Google Authenticator, Microsoft Authenticator, Authy...</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5"
                    style={{ background: '#C82020' }}>2</span>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Quét mã QR bên dưới</p>
                  </div>
                </div>
              </div>

              {/* QR Code */}
              {qrDataUrl && (
                <div className="flex flex-col items-center mb-5">
                  <div className="p-3 rounded-xl border-2 border-red-100 bg-white inline-block">
                    <img src={qrDataUrl} alt="QR Code TOTP" className="w-44 h-44" />
                  </div>
                  <button
                    onClick={() => setShowSecret(!showSecret)}
                    className="mt-3 text-xs flex items-center gap-1.5"
                    style={{ color: '#C82020' }}
                  >
                    <Smartphone size={13} />
                    {showSecret ? 'Ẩn' : 'Không quét được? Nhập thủ công'}
                  </button>
                  {showSecret && setupData && (
                    <div className="mt-2 px-4 py-2 rounded-lg bg-gray-50 border border-gray-200 text-center">
                      <p className="text-xs text-gray-400 mb-1">Secret key</p>
                      <p className="font-mono text-sm text-gray-700 break-all select-all">{setupData.secret}</p>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={() => setStep('confirm')}
                className="w-full py-3 rounded-xl text-white font-semibold"
                style={{ background: 'linear-gradient(135deg, #C82020, #8B0A0A)' }}
              >
                Đã quét xong →
              </button>
            </>
          )}

          {step === 'confirm' && (
            <form onSubmit={handleConfirm} className="space-y-4">
              <div className="flex gap-3 p-3 rounded-xl mb-2" style={{ background: 'rgba(200,32,32,0.06)' }}>
                <CheckCircle size={18} style={{ color: '#C82020' }} className="shrink-0 mt-0.5" />
                <p className="text-sm text-gray-600">
                  Mở ứng dụng xác thực, nhập mã 6 chữ số hiển thị cho tài khoản <strong>VNFITE Core</strong>.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Mã xác thực (6 chữ số)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-center text-2xl font-mono tracking-widest focus:outline-none transition"
                  onFocus={e => e.target.style.boxShadow = '0 0 0 2px rgba(200,32,32,0.25)'}
                  onBlur={e => e.target.style.boxShadow = ''}
                  autoFocus
                  required
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2.5 rounded-xl border border-red-100">
                  {error}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setStep('scan'); setCode(''); setError(''); }}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium"
                >
                  ← Quét lại
                </button>
                <button
                  type="submit"
                  disabled={submitting || code.length !== 6}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #C82020, #8B0A0A)' }}
                >
                  {submitting ? <RefreshCw size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                  Kích hoạt
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
