import { useCallback, useEffect, useState } from 'react';
import {
  fetchBusinessProfiles, fetchBusinessProfile, decideBusinessProfile, analyzeBusinessLicense,
  fetchUser, fetchFileBlob, getStoredAdmin, adminHasAnyRole,
  type BusinessProfile, type BusinessProfileStatus, type CmsUser,
} from '../api/client';
import { formatVietnamDate, formatVietnamDateTime } from '../utils/dateTime';
import {
  ArrowLeft, Building2, Check, ChevronLeft, ChevronRight, Loader2, RefreshCw,
  ShieldAlert, ShieldCheck, Sparkles, X,
} from 'lucide-react';

const STATUS_TABS: { value: BusinessProfileStatus | ''; label: string }[] = [
  { value: 'PENDING', label: 'Chờ duyệt' },
  { value: 'APPROVED', label: 'Đã duyệt' },
  { value: 'REJECTED', label: 'Từ chối' },
  { value: '', label: 'Tất cả' },
];

const BUSINESS_TYPE_LABEL: Record<string, string> = {
  HOUSEHOLD: 'Hộ kinh doanh',
  COMPANY: 'Công ty',
};

const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  PENDING:  { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', label: 'Chờ duyệt' },
  APPROVED: { cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', label: 'Đã duyệt' },
  REJECTED: { cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', label: 'Từ chối' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_BADGE[status] ?? { cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', label: status };
  return <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.cls}`}>{cfg.label}</span>;
}

function DetailRow({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-gray-100 dark:border-gray-700/70 last:border-b-0">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</span>
      <span className={`text-sm text-right ${highlight ? 'font-semibold text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-100'}`}>
        {value || '—'}
      </span>
    </div>
  );
}

function LicenseImageCard({ title, fileId }: { title: string; fileId: string | null | undefined }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!fileId) { setBlobUrl(null); setFailed(false); return; }
    let revoked = false;
    setFailed(false);
    setBlobUrl(null);
    fetchFileBlob(fileId)
      .then(url => { if (!revoked) setBlobUrl(url); })
      .catch(() => { if (!revoked) setFailed(true); });
    return () => {
      revoked = true;
      setBlobUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
    };
  }, [fileId]);

  if (!fileId) return null;
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/70">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</p>
        <span className="max-w-[180px] truncate font-mono text-[11px] text-gray-400 dark:text-gray-500" title={fileId}>{fileId}</span>
      </div>
      {blobUrl ? (
        <a href={blobUrl} target="_blank" rel="noreferrer" className="block">
          <img src={blobUrl} alt={title}
            className="w-full rounded-lg border border-gray-100 bg-white object-contain shadow-sm dark:border-gray-700 dark:bg-gray-900 aspect-[3/4] max-h-[420px]" />
        </a>
      ) : (
        <div className="flex w-full items-center justify-center rounded-lg border border-dashed border-gray-200 bg-white px-4 text-center text-sm text-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-500 aspect-[3/4] max-h-[420px]">
          {failed ? 'Không tải được ảnh' : 'Đang tải...'}
        </div>
      )}
    </div>
  );
}

// ─── Detail view ─────────────────────────────────────────────────────────────

function BusinessProfileDetail({ userId, onBack, onDecided }: {
  userId: string;
  onBack: () => void;
  onDecided: () => void;
}) {
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [owner, setOwner] = useState<CmsUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [analyzing, setAnalyzing] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiExtracted, setAiExtracted] = useState<Record<string, unknown> | null>(null);

  const [confirmApprove, setConfirmApprove] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [deciding, setDeciding] = useState(false);

  const isLeader = adminHasAnyRole(getStoredAdmin(), 'SUPER_ADMIN', 'ADMIN', 'CUSTOMER_SUPPORT');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const p = await fetchBusinessProfile(userId);
      setProfile(p);
      try { setOwner(await fetchUser(userId)); } catch { setOwner(null); }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được hồ sơ doanh nghiệp');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const runAnalyze = async () => {
    setAnalyzing(true);
    setAiError('');
    try {
      const result = await analyzeBusinessLicense(userId);
      let extracted: Record<string, unknown> | null = null;
      try { extracted = result.extractedData ? JSON.parse(result.extractedData) : null; } catch { extracted = null; }
      setAiExtracted(extracted);
      setProfile(prev => prev ? { ...prev, aiVerdict: result.verdict, aiSummary: result.summary } : prev);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Phân tích AI thất bại');
    } finally {
      setAnalyzing(false);
    }
  };

  const decide = async (approved: boolean, reason?: string) => {
    setDeciding(true);
    try {
      await decideBusinessProfile(userId, approved, reason);
      onDecided();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không gửi được quyết định');
    } finally {
      setDeciding(false);
      setConfirmApprove(false);
      setShowReject(false);
      setRejectReason('');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500 dark:text-gray-400">
        <Loader2 size={24} className="animate-spin mr-2" />Đang tải hồ sơ…
      </div>
    );
  }
  if (error || !profile) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
          <ArrowLeft size={16} />Quay lại danh sách
        </button>
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm">
          {error || 'Không tìm thấy hồ sơ'}
        </div>
      </div>
    );
  }

  const ekycName = owner?.fullName ?? null;
  const ekycCccd = owner?.cccdNumber ?? null;
  const nameMismatch = !!ekycName && ekycName.trim().toLowerCase() !== profile.representativeName.trim().toLowerCase();
  const cccdMismatch = profile.representativeMismatch === true
    || (!!ekycCccd && ekycCccd !== profile.representativeCccd);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
          <ArrowLeft size={16} />Quay lại danh sách
        </button>
        {profile.status === 'PENDING' && isLeader && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setConfirmApprove(true)}
              disabled={deciding}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-colors">
              <Check size={16} />Duyệt hồ sơ
            </button>
            <button
              onClick={() => setShowReject(true)}
              disabled={deciding}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors">
              <X size={16} />Từ chối
            </button>
          </div>
        )}
      </div>

      {/* Title card */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
            <Building2 size={22} className="text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 dark:text-gray-100">{profile.businessName}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {BUSINESS_TYPE_LABEL[profile.businessType] ?? profile.businessType} · Nộp {formatVietnamDateTime(profile.createdAt)}
            </p>
          </div>
        </div>
        <StatusBadge status={profile.status} />
      </div>

      {profile.status === 'REJECTED' && profile.rejectReason && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
          <span className="font-semibold">Lý do từ chối:</span> {profile.rejectReason}
          {profile.reviewedBy && <span className="text-xs block mt-1 opacity-80">Bởi {profile.reviewedBy} · {profile.reviewedAt ? formatVietnamDateTime(profile.reviewedAt) : ''}</span>}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Thông tin doanh nghiệp */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-3">Thông tin đăng ký kinh doanh</h3>
          <DetailRow label="Loại hình" value={BUSINESS_TYPE_LABEL[profile.businessType] ?? profile.businessType} />
          <DetailRow label="Tên doanh nghiệp/hộ KD" value={profile.businessName} />
          <DetailRow label="Số GCN đăng ký" value={<span className="font-mono">{profile.registrationNumber}</span>} />
          <DetailRow label="Mã số thuế" value={profile.taxCode ? <span className="font-mono">{profile.taxCode}</span> : null} />
          <DetailRow label="Ngày cấp" value={profile.issueDate ? formatVietnamDate(profile.issueDate) : null} />
          <DetailRow label="Nơi cấp" value={profile.issuedBy} />
          <DetailRow label="Địa chỉ trụ sở" value={profile.headOfficeAddress} />
          <DetailRow label="Ngành nghề chính" value={profile.businessSector} />
        </div>

        {/* Panel đối chiếu người đại diện */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
            {(nameMismatch || cccdMismatch)
              ? <ShieldAlert size={16} className="text-red-500" />
              : <ShieldCheck size={16} className="text-green-500" />}
            Đối chiếu người đại diện với eKYC
          </h3>
          <DetailRow label="Người đại diện (hồ sơ)" value={profile.representativeName} highlight={nameMismatch} />
          <DetailRow label="Họ tên eKYC (chủ TK)" value={ekycName} highlight={nameMismatch} />
          <DetailRow label="CCCD người đại diện (hồ sơ)" value={<span className="font-mono">{profile.representativeCccd}</span>} highlight={cccdMismatch} />
          <DetailRow label="CCCD eKYC (chủ TK)" value={ekycCccd ? <span className="font-mono">{ekycCccd}</span> : null} highlight={cccdMismatch} />
          <DetailRow label="SĐT chủ tài khoản" value={owner?.phone} />
          {(nameMismatch || cccdMismatch) ? (
            <p className="mt-3 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
              ⚠️ Người đại diện trên hồ sơ KHÔNG khớp với eKYC của chủ tài khoản — kiểm tra kỹ trước khi duyệt.
            </p>
          ) : (
            <p className="mt-3 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2">
              ✓ Người đại diện khớp với eKYC của chủ tài khoản.
            </p>
          )}
        </div>
      </div>

      {/* AI phân tích GPKD */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <Sparkles size={16} className="text-amber-500" />
            AI đọc giấy chứng nhận ĐKKD <span className="font-normal text-xs text-gray-400 dark:text-gray-500">(chỉ tham khảo — không thay thế thẩm định)</span>
          </h3>
          <button
            onClick={runAnalyze}
            disabled={analyzing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-50 transition-colors">
            {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {analyzing ? 'Đang phân tích…' : 'Phân tích AI'}
          </button>
        </div>
        {aiError && <p className="text-sm text-red-600 dark:text-red-400 mb-2">{aiError}</p>}
        {profile.aiVerdict ? (
          <div className="space-y-2">
            <DetailRow label="Kết luận AI" value={
              <span className={`font-semibold ${profile.aiVerdict === 'CONSISTENT' ? 'text-green-600 dark:text-green-400' : profile.aiVerdict === 'UNREADABLE' ? 'text-gray-500 dark:text-gray-400' : 'text-red-600 dark:text-red-400'}`}>
                {profile.aiVerdict}
              </span>
            } />
            {profile.aiSummary && (
              <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/70 rounded-lg px-3 py-2">{profile.aiSummary}</p>
            )}
            {aiExtracted && Array.isArray(aiExtracted.consistencyIssues) && (aiExtracted.consistencyIssues as unknown[]).length > 0 && (
              <div className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
                <p className="font-semibold mb-1">Điểm không khớp:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {(aiExtracted.consistencyIssues as string[]).map((issue, i) => <li key={i}>{issue}</li>)}
                </ul>
              </div>
            )}
            {aiExtracted && Array.isArray(aiExtracted.findings) && (aiExtracted.findings as unknown[]).length > 0 && (
              <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/70 rounded-lg px-3 py-2">
                <p className="font-semibold mb-1">Thông tin trích xuất:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {(aiExtracted.findings as string[]).map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-500">Chưa phân tích. Bấm "Phân tích AI" để trích xuất và đối chiếu thông tin trên GPKD.</p>
        )}
      </div>

      {/* Ảnh GPKD */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-3">Ảnh giấy chứng nhận đăng ký kinh doanh</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <LicenseImageCard title="GPKD trang chính" fileId={profile.licenseImageId} />
          <LicenseImageCard title="Ảnh bổ sung 1" fileId={profile.licenseExtra1ImageId} />
          <LicenseImageCard title="Ảnh bổ sung 2" fileId={profile.licenseExtra2ImageId} />
        </div>
      </div>

      {/* Modals */}
      {confirmApprove && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-sm w-full">
            <p className="text-gray-800 dark:text-gray-100 mb-2 font-semibold">Duyệt hồ sơ doanh nghiệp?</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
              Tài khoản sẽ được nâng lên {profile.businessType === 'HOUSEHOLD' ? 'Hộ kinh doanh (BUSINESS)' : 'Doanh nghiệp (ENTERPRISE)'} và mở khóa nhóm sản phẩm gọi vốn tương ứng.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmApprove(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300">Huỷ</button>
              <button onClick={() => decide(true)} disabled={deciding} className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
                {deciding ? 'Đang gửi…' : 'Duyệt'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showReject && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">Từ chối hồ sơ doanh nghiệp</h3>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Nhập lý do từ chối (hiển thị cho người dùng)..."
              rows={3}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none mb-4 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowReject(false); setRejectReason(''); }} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300">Huỷ</button>
              <button
                onClick={() => rejectReason.trim() && decide(false, rejectReason.trim())}
                disabled={deciding || !rejectReason.trim()}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                {deciding ? 'Đang gửi…' : 'Từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── List page ───────────────────────────────────────────────────────────────

export function BusinessProfilesPage() {
  const [status, setStatus] = useState<BusinessProfileStatus | ''>('PENDING');
  const [profiles, setProfiles] = useState<BusinessProfile[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchBusinessProfiles(status, page, 20)
      .then(data => {
        if (cancelled) return;
        setProfiles(data.content ?? []);
        setTotalElements(data.totalElements ?? 0);
        setTotalPages(data.totalPages ?? 0);
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Không tải được danh sách'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [status, page, refresh]);

  if (selectedUserId) {
    return (
      <BusinessProfileDetail
        userId={selectedUserId}
        onBack={() => setSelectedUserId(null)}
        onDecided={() => setRefresh(v => v + 1)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Hồ sơ doanh nghiệp</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {totalElements > 0 ? `${totalElements} hồ sơ` : 'Duyệt hồ sơ đăng ký tư cách doanh nghiệp của người gọi vốn'}
          </p>
        </div>
        <button
          onClick={() => setRefresh(v => v + 1)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          <RefreshCw size={14} />Tải lại
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.value || 'all'}
            onClick={() => { setStatus(tab.value); setPage(0); }}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
              status === tab.value
                ? 'bg-red-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm">{error}</div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-48 text-gray-500 dark:text-gray-400">
          <Loader2 size={24} className="animate-spin mr-2" />Đang tải…
        </div>
      )}

      {!loading && !error && profiles.length === 0 && (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400 dark:text-gray-500 space-y-2">
          <Building2 size={40} className="opacity-30" />
          <p className="text-sm">Không có hồ sơ nào{status ? ` ở trạng thái "${STATUS_TABS.find(t => t.value === status)?.label}"` : ''}</p>
        </div>
      )}

      {!loading && profiles.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Doanh nghiệp</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Loại hình</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Số GCN</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Người đại diện</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ngày nộp</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Trạng thái</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">AI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {profiles.map(p => (
                  <tr key={p.id}
                    onClick={() => setSelectedUserId(p.userId)}
                    className="cursor-pointer hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{p.businessName}</p>
                      {p.representativeMismatch && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400 mt-0.5">
                          <ShieldAlert size={11} />Người đại diện khác eKYC
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{BUSINESS_TYPE_LABEL[p.businessType] ?? p.businessType}</td>
                    <td className="px-4 py-3 font-mono text-gray-700 dark:text-gray-300">{p.registrationNumber}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{p.representativeName}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatVietnamDate(p.createdAt)}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3">
                      {p.aiVerdict ? (
                        <span className={`text-xs font-semibold ${p.aiVerdict === 'CONSISTENT' ? 'text-green-600 dark:text-green-400' : p.aiVerdict === 'UNREADABLE' ? 'text-gray-400' : 'text-red-600 dark:text-red-400'}`}>
                          {p.aiVerdict}
                        </span>
                      ) : <span className="text-xs text-gray-300 dark:text-gray-600">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">Trang {page + 1} / {totalPages}</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft size={16} />Trước
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Sau<ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
