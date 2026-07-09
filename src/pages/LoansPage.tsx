import { useEffect, useState } from 'react';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Eye, RefreshCw,
  Sparkles, AlertTriangle, ClipboardList, Gauge, Wallet, CircleDollarSign,
  Send, Check, X, ShieldCheck, Search, FileText, Download, Brain, ExternalLink,
  TrendingDown, TrendingUp, Lightbulb, PlusCircle, FileSearch, Ban, ShieldAlert, Landmark, Hourglass, HandCoins,
  Calculator, Building2,
} from 'lucide-react';
import {
  fetchLoans, fetchLoanById, fetchAppraisalSuggestion, fetchRepaymentSchedule, recordRepayment,
  proposeLoan, approveLoan, rejectLoan, cancelLoan, getStoredAdmin, adminHasAnyRole, adminHasPermission,
  fetchLoanContracts, disburseLoan, fetchLoanDocuments, evaluateLoanCreditScore, fetchLatestLoanCreditScore,
  fetchCicLookup, saveCicLookup, analyzeLoanDocument, runFundingExpirySweep, runAutoDebitSweep,
  fetchFileBlob, fetchEarlySettlementQuote,
  fetchBusinessAppraisalChecklist, saveBusinessAppraisalChecklist,
  type CmsLoan, type AppraisalSuggestion, type FraudCheck,
  type RepaymentScheduleItem, type LoanContract,
  type LoanDocument, type CreditScoreResult, type DocumentAnalysisResult,
  type ScoreExplanation, type CicLookup, type CicLookupInput,
  type EarlySettlementQuote, type AppraisalChecklistItem,
  type BusinessAppraisalChecklistRecord, type BusinessAppraisalStatus,
} from '../api/client';
import { Badge } from '../components/Badge';
import {
  LOAN_STATUS_OPTIONS, loanStatusLabel, type LoanStatusFilter,
  CONTRACT_TYPE_LABEL, CONTRACT_STATUS_LABEL,
} from '../loanConstants';
import {
  formatVietnamDate,
  formatVietnamDateTime,
  parseVietnamDateTime,
  todayVietnamDateString,
} from '../utils/dateTime';

function formatMoney(value: number | string | undefined | null) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function shortId(id: string | null | undefined) {
  if (!id) return '-';
  return id.length > 8 ? id.slice(0, 8) + '…' : id;
}

function TruncatedText({
  value,
  className = '',
}: {
  value: string | null | undefined;
  className?: string;
}) {
  const text = value && value.trim() ? value : '—';
  return (
    <span title={text} className={`block truncate ${className}`}>
      {text}
    </span>
  );
}

// ─── Detail Page ──────────────────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex justify-between items-start gap-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <span className="text-sm text-gray-400 dark:text-gray-500 shrink-0 w-44">{label}</span>
      <span className="text-sm text-gray-800 dark:text-gray-200 text-right font-medium">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-red-500 mb-3">{title}</p>
      {children}
    </div>
  );
}

function KycImageCard({
  title,
  fileId,
  portrait = false,
}: {
  title: string;
  fileId: string | null | undefined;
  portrait?: boolean;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!fileId) {
      setBlobUrl(null);
      setFailed(false);
      return;
    }
    let cancelled = false;
    setBlobUrl(null);
    setFailed(false);
    fetchFileBlob(fileId)
      .then(url => {
        if (!cancelled) setBlobUrl(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      setBlobUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [fileId]);

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/70">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</p>
      {blobUrl ? (
        <a href={blobUrl} target="_blank" rel="noreferrer" className="block">
          <img
            src={blobUrl}
            alt={title}
            className={`w-full rounded-lg border border-gray-100 bg-white object-cover shadow-sm dark:border-gray-700 dark:bg-gray-900 ${
              portrait ? 'aspect-[3/4] max-h-[340px]' : 'aspect-[16/10] max-h-[260px]'
            }`}
          />
        </a>
      ) : (
        <div className={`flex w-full items-center justify-center rounded-lg border border-dashed border-gray-200 bg-white px-4 text-center text-sm text-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-500 ${
          portrait ? 'aspect-[3/4] max-h-[340px]' : 'aspect-[16/10] max-h-[260px]'
        }`}>
          {failed ? 'Không tải được ảnh' : fileId ? 'Đang tải ảnh...' : 'Chưa có ảnh'}
        </div>
      )}
    </div>
  );
}

// ─── Appraisal support panel ────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<string, string> = {
  IDENTITY: 'Định danh', INCOME: 'Thu nhập', EMPLOYMENT: 'Nghề nghiệp',
  REFERENCE: 'Tham chiếu', PURPOSE: 'Mục đích', DOCUMENT: 'Chứng từ', FRAUD: 'Gian lận',
  BUSINESS_PROFILE: 'Hồ sơ pháp nhân',
  BUSINESS_CASHFLOW: 'Dòng tiền kinh doanh',
  BUSINESS_PURPOSE: 'Phương án vốn',
  BUSINESS_SITE: 'Hoạt động thực tế',
  CREDIT_HISTORY: 'Lịch sử tín dụng',
};

const METHOD_LABEL: Record<string, string> = {
  EMI_MONTHLY: 'Gốc + lãi đều hàng tháng',
  INTEREST_MONTHLY_PRINCIPAL_QUARTERLY: 'Lãi tháng · gốc theo quý',
};

const PRODUCT_CATEGORY_LABEL: Record<string, string> = {
  INDIVIDUAL: 'Cá nhân',
  BUSINESS: 'Hộ kinh doanh',
  ENTERPRISE: 'Doanh nghiệp',
};

function ratioPct(x: number | null | undefined): string {
  return x == null ? '—' : `${Math.round(x * 100)}%`;
}

function rateText(x: number | null | undefined): string {
  return x == null ? '—' : `${x}%/năm`;
}

const inputCls =
  'mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 ' +
  'text-gray-800 dark:text-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500';
const btnPrimary =
  'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white ' +
  'text-sm font-medium disabled:opacity-50';
const btnDanger =
  'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-300 dark:border-red-700 ' +
  'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 text-sm font-medium disabled:opacity-50';

function SubSection({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
        {icon}{title}
      </p>
      {children}
    </div>
  );
}

function MiniRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-3 py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{label}</span>
      <span className="text-xs text-gray-800 dark:text-gray-200 text-right font-medium">{value}</span>
    </div>
  );
}

function DocFileActions({ fileId, fileName }: { fileId: string; fileName?: string | null }) {
  const [busy, setBusy] = useState(false);

  const getBlob = async () => {
    setBusy(true);
    try { return await fetchFileBlob(fileId); }
    finally { setBusy(false); }
  };

  const handleView = async () => { const url = await getBlob(); window.open(url, '_blank'); };

  const handleDownload = async () => {
    const url = await getBlob();
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName ?? fileId;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const btnCls = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed';
  return (
    <>
      <button onClick={handleView} disabled={busy} className={btnCls}><ExternalLink size={13} />Xem</button>
      <button onClick={handleDownload} disabled={busy} className={btnCls}><Download size={13} />Tải</button>
    </>
  );
}

const DOC_TYPE_LABEL: Record<string, string> = {
  SALARY_STATEMENT: 'Sao kê lương',
  PAYSLIP: 'Bảng lương / phiếu lương',
  BANK_STATEMENT: 'Sao kê ngân hàng',
  LABOR_CONTRACT: 'Hợp đồng lao động',
  EMPLOYMENT_CONTRACT: 'Hợp đồng lao động',
  BUSINESS_LICENSE: 'Đăng ký kinh doanh',
  SALES_LEDGER: 'Sổ bán hàng / ghi chép doanh thu',
  INVOICE: 'Hóa đơn / chứng từ bán hàng',
  POS_STATEMENT: 'Sao kê POS / ví điện tử',
  PLATFORM_SALES_REPORT: 'Báo cáo doanh thu nền tảng',
  TAX_DOCUMENT: 'Chứng từ thuế',
  SHOP_PHOTO: 'Ảnh cửa hàng / hàng hóa',
  OTHER_INCOME_PROOF: 'Chứng từ chứng minh thu nhập khác',
  OTHER: 'Chứng từ khác',
};

const CREDIT_COMPONENT_LABEL: Record<string, string> = {
  // Khung Credit Score 360 (nhóm A–H)
  A_KYC: 'A · KYC & Định danh',
  B_CREDIT_HISTORY: 'B · Lịch sử tín dụng nội bộ',
  C_AFFORDABILITY: 'C · Khả năng trả nợ',
  D_CASHFLOW: 'D · Dòng tiền',
  E_OCCUPATION: 'E · Nghề nghiệp & thu nhập',
  F_LOAN: 'F · Đặc điểm khoản vay',
  G_DEVICE: 'G · Thiết bị & hành vi số',
  H_FRAUD: 'H · Gian lận & bất thường',
  // Nhóm cũ (điểm đã chấm trước khi tái cấu trúc) — giữ để hiển thị lịch sử
  DEMOGRAPHIC: 'Nhân khẩu học',
  INCOME: 'Thu nhập',
  CREDIT_HISTORY: 'Lịch sử tín dụng',
  PLATFORM: 'Nền tảng VNFITE',
  LOAN: 'Khoản gọi vốn',
};

function creditGradeTone(grade: string): string {
  if (grade === 'A+' || grade === 'A') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
  if (grade === 'B') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
  if (grade === 'C') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  if (grade === 'D') return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
  return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
}

function creditBarColor(grade: string): string {
  if (grade === 'A+' || grade === 'A') return 'bg-green-500';
  if (grade === 'B') return 'bg-emerald-500';
  if (grade === 'C') return 'bg-amber-500';
  if (grade === 'D') return 'bg-orange-500';
  return 'bg-red-500';
}

function verdictTone(verdict: string): string {
  if (verdict === 'CONSISTENT') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
  if (verdict === 'SUSPICIOUS') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  if (verdict === 'HIGH_RISK') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
  return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
}

function verdictLabel(verdict: string): string {
  if (verdict === 'CONSISTENT') return 'Nhất quán';
  if (verdict === 'SUSPICIOUS') return 'Cần kiểm tra';
  if (verdict === 'HIGH_RISK') return 'Rủi ro cao';
  if (verdict === 'UNREADABLE') return 'Không đọc được';
  if (verdict === 'ERROR') return 'Lỗi phân tích';
  return verdict || 'Chưa rõ';
}

interface ParsedDocData {
  detectedType: string | null;
  ownerName: string | null;
  organizationName: string | null;
  extractedIncome: string | null;
  findings: string[];
  consistencyIssues: string[];
}

function parseDocData(data: DocumentAnalysisResult['extractedData']): ParsedDocData {
  const empty: ParsedDocData = {
    detectedType: null, ownerName: null, organizationName: null,
    extractedIncome: null, findings: [], consistencyIssues: [],
  };
  if (!data) return empty;
  let parsed: unknown = data;
  if (typeof data === 'string') {
    try { parsed = JSON.parse(data); } catch { return empty; }
  }
  if (!parsed || typeof parsed !== 'object') return empty;
  const o = parsed as Record<string, unknown>;
  const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String).map(s => s.trim()).filter(s => s && s.toLowerCase() !== 'null') : []);
  const str = (v: unknown): string | null => {
    if (typeof v === 'number') return String(v);
    if (typeof v === 'string' && v.trim() && v.toLowerCase() !== 'null') return v.trim();
    return null;
  };
  return {
    detectedType: str(o.docTypeDetected),
    ownerName: str(o.ownerName),
    organizationName: str(o.organizationName),
    extractedIncome: str(o.extractedMonthlyIncome),
    findings: arr(o.findings ?? o.riskFlags ?? o.risk_flags),
    consistencyIssues: arr(o.consistencyIssues ?? o.consistency_issues),
  };
}

function formatIncomeText(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.length >= 4) return formatMoney(Number(digits));
  return raw;
}

// ─── Khối giải thích nguyên nhân điểm (deterministic, luôn có) ──────────────────

function ExplanationStat({ label, value, tone }: { label: string; value: string; tone?: 'amber' | 'green' | 'red' }) {
  const toneCls =
    tone === 'amber' ? 'text-amber-600 dark:text-amber-400'
    : tone === 'green' ? 'text-green-600 dark:text-green-400'
    : tone === 'red' ? 'text-red-600 dark:text-red-400'
    : 'text-gray-800 dark:text-gray-100';
  return (
    <div className="rounded-lg border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 p-2.5">
      <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</p>
      <p className={`text-sm font-semibold ${toneCls}`}>{value}</p>
    </div>
  );
}

function ScoreExplanationBlock({ ex }: { ex: ScoreExplanation }) {
  const neg = ex.negativeDrivers ?? [];
  const pos = ex.positiveDrivers ?? [];
  const missing = ex.missingData ?? [];
  const completeness = ex.criteriaTotal > 0 ? Math.round((ex.criteriaWithData / ex.criteriaTotal) * 100) : 0;

  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/50 p-4 space-y-3">
      <div className="flex items-center gap-1.5">
        <FileSearch size={14} className="text-red-500" />
        <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">Vì sao có mức điểm này</p>
      </div>

      <p className="text-sm text-gray-700 dark:text-gray-200 leading-snug">{ex.headline}</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <ExplanationStat label="Độ đầy đủ hồ sơ" value={`${ex.criteriaWithData}/${ex.criteriaTotal} (${completeness}%)`} />
        {ex.pointsLostToMissingData > 0 && (
          <ExplanationStat label="Mất do thiếu dữ liệu" value={`${ex.pointsLostToMissingData} điểm thô`} tone="amber" />
        )}
        {ex.maxPotentialScoreUplift > 0 && (
          <ExplanationStat label="Bổ sung có thể +" value={`~${ex.maxPotentialScoreUplift} điểm`} tone="green" />
        )}
        {ex.pointsLostToWeakSignals > 0 && (
          <ExplanationStat label="Mất do tín hiệu yếu" value={`${ex.pointsLostToWeakSignals} điểm thô`} tone="red" />
        )}
      </div>

      {neg.length > 0 && (
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-red-500 mb-1.5">
            <TrendingDown size={13} />Yếu tố kéo điểm xuống
          </p>
          <div className="space-y-1">
            {neg.map(d => (
              <div key={d.criteriaName} className="flex items-start gap-2 text-xs">
                <span className="font-semibold text-red-600 dark:text-red-400 w-12 text-right shrink-0">{d.points}/{d.maxPoints}</span>
                <div className="leading-snug">
                  <span className="text-gray-700 dark:text-gray-200 font-medium">{d.criteriaName}</span>
                  <span className="text-gray-500 dark:text-gray-400"> — {d.reason}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pos.length > 0 && (
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-green-600 dark:text-green-400 mb-1.5">
            <TrendingUp size={13} />Điểm mạnh
          </p>
          <div className="flex flex-wrap gap-1.5">
            {pos.map(d => (
              <span key={d.criteriaName} className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-[11px] font-medium">
                {d.criteriaName} {d.points}/{d.maxPoints}
              </span>
            ))}
          </div>
        </div>
      )}

      {missing.length > 0 && (
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 mb-1.5">
            <PlusCircle size={13} />Cần bổ sung để nâng điểm
          </p>
          <div className="space-y-1">
            {missing.map(m => (
              <div key={m.criteriaName} className="flex items-start gap-2 text-xs">
                <span className="font-semibold text-amber-600 dark:text-amber-400 w-10 text-right shrink-0">+{m.potentialPoints}</span>
                <div className="leading-snug">
                  <span className="text-gray-700 dark:text-gray-200 font-medium">{m.criteriaName}</span>
                  <span className="text-gray-500 dark:text-gray-400"> — {m.howToObtain}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {ex.suggestedAction && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 px-3 py-2 flex gap-1.5">
          <Lightbulb size={14} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-gray-700 dark:text-gray-200">{ex.suggestedAction}</p>
        </div>
      )}
    </div>
  );
}

const CIC_DEBT_GROUP_OPTIONS = [
  { value: 1, label: 'Nhóm 1 — Đủ tiêu chuẩn' },
  { value: 2, label: 'Nhóm 2 — Cần chú ý' },
  { value: 3, label: 'Nhóm 3 — Dưới tiêu chuẩn (nợ xấu)' },
  { value: 4, label: 'Nhóm 4 — Nghi ngờ mất vốn' },
  { value: 5, label: 'Nhóm 5 — Có khả năng mất vốn' },
];

const CIC_VALIDITY_DAYS = 30;

function cicIsStale(checkedAt: string): boolean {
  const d = parseVietnamDateTime(checkedAt);
  if (isNaN(d.getTime())) return false;
  return (Date.now() - d.getTime()) / 86400000 > CIC_VALIDITY_DAYS;
}

function todayLocalDateString(): string {
  return todayVietnamDateString();
}

/** Cổng loại trừ (docx §7) — chỉ tư vấn. Đỏ = HARD_REJECT, hổ phách = MANUAL_REVIEW. */
function ReviewDirectiveBanner({ directive, reasons }: {
  directive: string | null;
  reasons: string[] | null;
}) {
  if (!directive || directive === 'AUTO' || !reasons || reasons.length === 0) return null;
  const hard = directive === 'HARD_REJECT';
  const tone = hard
    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300'
    : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-900/50 text-amber-700 dark:text-amber-300';
  return (
    <div className={'rounded-xl border px-4 py-3 space-y-1.5 ' + tone}>
      <div className="flex items-center gap-2">
        {hard ? <Ban size={16} /> : <ShieldAlert size={16} />}
        <p className="text-sm font-bold">
          {hard ? 'Cảnh báo loại trừ — chính sách phải từ chối / rà soát đặc biệt' : 'Cần rà soát thủ công trước khi quyết định'}
        </p>
      </div>
      <ul className="text-xs space-y-0.5 pl-6 list-disc">
        {reasons.map((r, i) => <li key={i}>{r}</li>)}
      </ul>
      <p className="text-[11px] italic opacity-80 pl-6">Đây là cảnh báo tự động hỗ trợ thẩm định — quyết định cuối thuộc thẩm định viên/ban lãnh đạo.</p>
    </div>
  );
}

/**
 * Cảnh báo gian lận tự động — đối chiếu dữ liệu nội bộ (velocity & trùng chéo đa đầu mối).
 * Đỏ nếu có cờ HIGH, hổ phách nếu chỉ MEDIUM. Chỉ tư vấn — quyết định thuộc người thẩm định.
 */
function FraudAlertBlock({ checks }: { checks: FraudCheck[] | null | undefined }) {
  if (!checks || checks.length === 0) return null;
  const hasHigh = checks.some(c => c.severity === 'HIGH');
  const tone = hasHigh
    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/50'
    : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-900/50';
  const sevChip = (s: string) =>
    s === 'HIGH' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
    : s === 'MEDIUM' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
  const sevLabel = (s: string) => s === 'HIGH' ? 'Cao' : s === 'MEDIUM' ? 'Trung bình' : 'Tham khảo';
  return (
    <div className={'rounded-xl border p-4 space-y-2 ' + tone}>
      <div className="flex items-center gap-2 flex-wrap">
        <ShieldAlert size={16} className={hasHigh ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'} />
        <p className="text-sm font-bold text-gray-800 dark:text-gray-100">Cảnh báo gian lận tự động</p>
        <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-white/60 dark:bg-gray-900/40 text-gray-500 dark:text-gray-400">
          Đối chiếu nội bộ — chỉ tư vấn
        </span>
      </div>
      <div className="space-y-1.5">
        {checks.map((c, i) => (
          <div key={i} className="flex gap-2 items-start rounded-lg bg-white/60 dark:bg-gray-900/40 px-3 py-2">
            <span className={'shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ' + sevChip(c.severity)}>{sevLabel(c.severity)}</span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">{c.title}</p>
              <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-snug">{c.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Kết luận thẩm định thống nhất — Credit Score 360 là chuẩn đánh giá DUY NHẤT.
 * Ba ô trả lời ba câu hỏi khác nhau, không cạnh tranh:
 *  - Credit Score 360 → rủi ro của khách (có nên cho vay không) — quyết định lập trường
 *  - Biểu QĐ-LSGV     → nếu cho vay thì lãi suất & hạn mức bao nhiêu (định giá theo hạng Credit 360)
 *  - AI chứng từ       → hồ sơ có đáng tin không
 *  - Cổng loại trừ     → chốt chặn theo chính sách (rule-based)
 *  - Gian lận          → cờ HIGH tự nâng lập trường lên "cần thẩm định kỹ"
 */
function UnifiedVerdict({
  suggestedAmount, suggestedRate, serviceAvailable,
  creditScore, docSummary, docIssues, docTotal, fraudHigh = false,
}: {
  suggestedAmount: number | null;
  suggestedRate: number | null;
  serviceAvailable: boolean;
  creditScore: CreditScoreResult | null;
  docSummary: string | null;
  docIssues: number;
  docTotal: number;
  fraudHigh?: boolean;
}) {
  const directive = creditScore?.reviewDirective ?? null;
  const grade = creditScore?.grade ?? null;
  const creditGood = grade ? ['A+', 'A', 'B', 'C'].includes(grade) : false;

  // Lập trường tổng hợp — cổng loại trừ ưu tiên cao nhất, rồi tới hạng Credit 360
  type Stance = 'REJECT' | 'REVIEW' | 'OK' | 'PENDING';
  let stance: Stance;
  let title: string;
  if (!creditScore) { stance = 'PENDING'; title = 'Chưa đủ căn cứ — cần chấm điểm tín dụng'; }
  else if (directive === 'HARD_REJECT') { stance = 'REJECT'; title = 'Dừng lại — cổng loại trừ theo chính sách'; }
  else if (directive === 'MANUAL_REVIEW') { stance = 'REVIEW'; title = 'Cần thẩm định kỹ trước khi trình'; }
  else if (creditGood) { stance = 'OK'; title = 'Đủ điều kiện cân nhắc đề xuất'; }
  else { stance = 'REVIEW'; title = 'Cần cân nhắc thêm trước khi trình'; }

  // Cờ gian lận nghiêm trọng tự nâng lập trường (không hạ thấp HARD_REJECT)
  if (fraudHigh && stance !== 'REJECT') {
    stance = 'REVIEW';
    title = 'Cần thẩm định kỹ — có cảnh báo gian lận';
  }

  const toneMap: Record<Stance, { box: string; icon: React.ReactNode; chip: string }> = {
    REJECT: {
      box: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/50',
      icon: <Ban size={18} className="text-red-600 dark:text-red-400" />,
      chip: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    },
    REVIEW: {
      box: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-900/50',
      icon: <ShieldAlert size={18} className="text-amber-600 dark:text-amber-400" />,
      chip: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    },
    OK: {
      box: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900/50',
      icon: <ShieldCheck size={18} className="text-green-600 dark:text-green-400" />,
      chip: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    },
    PENDING: {
      box: 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700',
      icon: <Gauge size={18} className="text-gray-500 dark:text-gray-400" />,
      chip: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    },
  };
  const t = toneMap[stance];

  return (
    <div className={'rounded-xl border p-4 space-y-3 ' + t.box}>
      <div className="flex items-center gap-2 flex-wrap">
        {t.icon}
        <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{title}</p>
        <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-white/60 dark:bg-gray-900/40 text-gray-500 dark:text-gray-400">
          Tổng hợp hỗ trợ — không tự quyết
        </span>
      </div>

      {/* 3 nguồn · mỗi nguồn một câu hỏi khác nhau */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="rounded-lg bg-white/70 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700 p-2.5">
          <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">Rủi ro khách · Credit 360</p>
          {creditScore ? (
            <p className="text-sm font-bold text-gray-800 dark:text-gray-100">
              <span className={'px-1.5 py-0.5 rounded ' + creditGradeTone(grade!)}>{grade}</span>
              <span className="ml-1.5 font-semibold text-gray-600 dark:text-gray-300">{creditScore.score}/850</span>
            </p>
          ) : (
            <p className="text-xs text-amber-600 dark:text-amber-400">Chưa chấm — bấm "Chấm điểm tín dụng" ở khối trên</p>
          )}
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Có nên cho vay không</p>
        </div>

        <div className="rounded-lg bg-white/70 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700 p-2.5">
          <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">Giá & hạn mức · QĐ-LSGV</p>
          {!creditScore ? (
            <p className="text-xs text-gray-400 dark:text-gray-500">Chấm điểm để định giá</p>
          ) : serviceAvailable && suggestedAmount != null ? (
            <>
              <p className="text-sm font-bold text-gray-800 dark:text-gray-100 whitespace-nowrap">{formatMoney(suggestedAmount)}</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Lãi suất {rateText(suggestedRate)}</p>
            </>
          ) : (
            <p className="text-xs text-amber-600 dark:text-amber-400">Không cấp dịch vụ ở hạng này</p>
          )}
        </div>

        <div className="rounded-lg bg-white/70 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700 p-2.5">
          <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">Chứng từ · AI</p>
          {creditScore ? (
            <p className="text-sm font-bold text-gray-800 dark:text-gray-100">
              {docIssues > 0
                ? <span className="text-amber-600 dark:text-amber-400">{docIssues}/{docTotal} cần kiểm tra</span>
                : <span className="text-green-600 dark:text-green-400">{docTotal > 0 ? `${docTotal} đạt` : 'Chưa có CT'}</span>}
            </p>
          ) : (
            <p className="text-xs text-gray-400 dark:text-gray-500">{docSummary ?? 'Chưa chấm'}</p>
          )}
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Hồ sơ có đáng tin không</p>
        </div>
      </div>

      {/* Lý do cổng loại trừ */}
      {creditScore?.reviewReasons && creditScore.reviewReasons.length > 0 && directive !== 'AUTO' && (
        <ul className="text-xs space-y-0.5 pl-5 list-disc text-gray-600 dark:text-gray-300">
          {creditScore.reviewReasons.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      )}
    </div>
  );
}

/** Nhập tay kết quả tra cứu CIC (chờ API CIC sandbox NĐ94) → chấm nhóm B. */
function CicLookupCard({ loanId, onSaved, onCicChange }: {
  loanId: string;
  onSaved?: () => void;
  onCicChange?: (has: boolean) => void;
}) {
  const [cic, setCic] = useState<CicLookup | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const today = todayLocalDateString();
  const defaultForm = (): CicLookupInput => ({
    debtGroup: 1, maxDpd: 0, activeLenders: 0, totalOutstanding: null,
    checkedAt: todayLocalDateString(), note: '', consentConfirmed: false,
  });
  const [form, setForm] = useState<CicLookupInput>({
    debtGroup: 1, maxDpd: 0, activeLenders: 0, totalOutstanding: null,
    checkedAt: today, note: '', consentConfirmed: false,
  });

  useEffect(() => {
    let alive = true;
    fetchCicLookup(loanId)
      .then(r => {
        if (alive) {
          setCic(r);
          if (r) seedForm(r);
          else setForm(defaultForm());
          onCicChange?.(r != null);
        }
      })
      .catch(() => { if (alive) onCicChange?.(false); })
      .finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [loanId]);

  function seedForm(r: CicLookup) {
    setForm({
      debtGroup: r.debtGroup, maxDpd: r.maxDpd ?? 0, activeLenders: r.activeLenders ?? 0,
      totalOutstanding: r.totalOutstanding, checkedAt: r.checkedAt,
      note: r.note ?? '', consentConfirmed: r.consentConfirmed,
    });
  }

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const saved = await saveCicLookup(loanId, form);
      setCic(saved);
      setEditing(false);
      onCicChange?.(true);
      onSaved?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400';
  const labelCls = 'text-[11px] font-medium text-gray-500 dark:text-gray-400';

  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/50 p-4 space-y-3">
      <div className="flex items-center gap-1.5 flex-wrap">
        <Landmark size={14} className="text-red-500" />
        <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">Tra cứu CIC (nhập tay)</p>
        <span className="text-[11px] text-gray-400 dark:text-gray-500">· chờ API CIC sandbox NĐ94</span>
        {loaded && !editing && (
          <button onClick={() => { if (!cic) setForm(defaultForm()); setEditing(true); }} className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-300 text-xs font-medium hover:bg-red-50 dark:hover:bg-red-900/20">
            <PlusCircle size={12} />{cic ? 'Cập nhật' : 'Nhập kết quả CIC'}
          </button>
        )}
      </div>

      {!editing && loaded && !cic && (
        <p className="text-xs text-gray-500 dark:text-gray-400">Chưa có kết quả CIC. Tra cứu CIC bên ngoài rồi nhập vào đây để chấm nhóm B (lịch sử tín dụng) và kích hoạt cổng loại trừ nợ xấu.</p>
      )}

      {!editing && cic && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div><p className={labelCls}>Nhóm nợ</p><p className={'text-sm font-bold ' + (cic.debtGroup >= 3 ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-100')}>Nhóm {cic.debtGroup}</p></div>
            <div><p className={labelCls}>DPD cao nhất</p><p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{cic.maxDpd ?? '—'} ngày</p></div>
            <div><p className={labelCls}>Số TCTD đang vay</p><p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{cic.activeLenders ?? '—'}</p></div>
            <div><p className={labelCls}>Ngày tra</p><p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{cic.checkedAt}</p></div>
          </div>
          {cic.enteredBy && <p className="text-[11px] text-gray-400 dark:text-gray-500">Nhập bởi {cic.enteredBy}</p>}
          {cicIsStale(cic.checkedAt) && (
            <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-1.5 flex gap-1.5">
              <AlertTriangle size={13} className="shrink-0 mt-0.5" />Kết quả CIC đã quá {CIC_VALIDITY_DAYS} ngày — nên tra lại trước khi quyết định.
            </p>
          )}
        </div>
      )}

      {editing && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Nhóm nợ cao nhất *</label>
              <select value={form.debtGroup} onChange={e => setForm({ ...form, debtGroup: Number(e.target.value) })} className={inputCls}>
                {CIC_DEBT_GROUP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Ngày tra cứu *</label>
              <input type="date" max={today} value={form.checkedAt} onChange={e => setForm({ ...form, checkedAt: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>DPD cao nhất 12 tháng (ngày)</label>
              <input type="number" min={0} value={form.maxDpd ?? ''} onChange={e => setForm({ ...form, maxDpd: e.target.value === '' ? null : Number(e.target.value) })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Số TCTD đang có dư nợ</label>
              <input type="number" min={0} value={form.activeLenders ?? ''} onChange={e => setForm({ ...form, activeLenders: e.target.value === '' ? null : Number(e.target.value) })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Tổng dư nợ hiện tại (VND)</label>
              <input type="number" min={0} value={form.totalOutstanding ?? ''} onChange={e => setForm({ ...form, totalOutstanding: e.target.value === '' ? null : Number(e.target.value) })} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Ghi chú</label>
            <textarea rows={2} value={form.note ?? ''} onChange={e => setForm({ ...form, note: e.target.value })} className={inputCls} />
          </div>
          <label className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={form.consentConfirmed} onChange={e => setForm({ ...form, consentConfirmed: e.target.checked })} className="mt-0.5" />
            <span>Xác nhận đã có sự đồng ý của khách hàng cho việc tra cứu thông tin tín dụng (NĐ 13/2023).</span>
          </label>
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button onClick={save} disabled={saving || !form.consentConfirmed} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-medium disabled:opacity-50">
              {saving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}Lưu & chấm lại
            </button>
            <button onClick={() => { setEditing(false); setError(''); if (cic) seedForm(cic); }} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium">Hủy</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileAdvisoryBlock({ advisory }: { advisory: CreditScoreResult['profileAdvisory'] }) {
  if (!advisory) return null;

  const signals = advisory.signals ?? [];
  const tone = advisory.riskLevel === 'HIGH'
    ? 'border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/15'
    : advisory.riskLevel === 'MEDIUM'
      ? 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/15'
      : 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-900/15';
  const textTone = advisory.riskLevel === 'HIGH'
    ? 'text-red-700 dark:text-red-300'
    : advisory.riskLevel === 'MEDIUM'
      ? 'text-amber-700 dark:text-amber-300'
      : 'text-emerald-700 dark:text-emerald-300';

  return (
    <div className={'rounded-xl border p-4 space-y-3 ' + tone}>
      <div className="flex items-center gap-2 flex-wrap">
        <ShieldAlert size={15} className={textTone} />
        <p className={'text-xs font-semibold ' + textTone}>AI kiểm tra thông tin hồ sơ</p>
        <span className={'px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white/70 dark:bg-gray-950/40 ' + textTone}>
          {advisory.riskLevel}
        </span>
        {advisory.aiIncluded && (
          <span className="text-[11px] text-gray-500 dark:text-gray-400">AI + rule kiểm tra tính hợp lý</span>
        )}
      </div>
      <p className="text-sm text-gray-700 dark:text-gray-200">{advisory.summary}</p>

      {signals.length > 0 && (
        <div className="space-y-2">
          {signals.map((signal, idx) => (
            <div key={`${signal.code}-${idx}`} className="rounded-lg bg-white/80 dark:bg-gray-950/40 border border-white/70 dark:border-gray-700 px-3 py-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={'text-[11px] font-bold ' + (signal.severity === 'HIGH' ? 'text-red-600 dark:text-red-300' : signal.severity === 'MEDIUM' ? 'text-amber-600 dark:text-amber-300' : 'text-gray-500 dark:text-gray-400')}>
                  {signal.severity}
                </span>
                <span className="text-[11px] text-gray-400 dark:text-gray-500">{signal.source}</span>
              </div>
              <p className="text-xs text-gray-700 dark:text-gray-200 mt-1">{signal.message}</p>
            </div>
          ))}
        </div>
      )}

      {advisory.questionsForAppraiser && advisory.questionsForAppraiser.length > 0 && (
        <div className="rounded-lg bg-white/70 dark:bg-gray-950/30 border border-white/70 dark:border-gray-700 p-3">
          <p className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">Gợi ý xác minh</p>
          <ul className="list-disc pl-5 space-y-0.5 text-xs text-gray-600 dark:text-gray-300">
            {advisory.questionsForAppraiser.map(q => <li key={q}>{q}</li>)}
          </ul>
        </div>
      )}
      <p className="text-[11px] text-gray-400 dark:text-gray-500 italic">
        Kết quả chỉ hỗ trợ thẩm định viên xác minh thông tin, không tự động duyệt hoặc từ chối hồ sơ.
      </p>
    </div>
  );
}

function CreditScoreSection({ loan, score, onScore }: {
  loan: CmsLoan;
  score: CreditScoreResult | null;
  onScore: (score: CreditScoreResult) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [loadingSavedScore, setLoadingSavedScore] = useState(false);
  const [error, setError] = useState('');
  // null = đang tải CIC, true/false = đã biết có CIC hay chưa (quyết định mở Bước 2)
  const [hasCic, setHasCic] = useState<boolean | null>(null);

  const runEvaluate = async () => {
    setLoading(true);
    setError('');
    try {
      onScore(await evaluateLoanCreditScore(loan.loanId));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;
    if (score) return () => { alive = false; };
    setLoadingSavedScore(true);
    fetchLatestLoanCreditScore(loan.loanId)
      .then(saved => {
        if (alive && saved) onScore(saved);
      })
      .catch(() => {
        // Chưa từng chấm điểm thì giữ trạng thái rỗng; không cần hiện lỗi.
      })
      .finally(() => {
        if (alive) setLoadingSavedScore(false);
      });
    return () => { alive = false; };
  }, [loan.loanId, onScore, score]);

  const pct = score ? Math.max(0, Math.min(100, ((score.score - 300) / 550) * 100)) : 0;
  const grouped = score?.details.reduce<Record<string, typeof score.details>>((acc, item) => {
    const key = item.component || 'OTHER';
    acc[key] = acc[key] ?? [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Brain size={16} className="text-red-500" />
        <p className="text-[10px] font-semibold uppercase tracking-widest text-red-500">Điểm tín dụng tham khảo</p>
        {score && (
          <button onClick={runEvaluate} disabled={loading} className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-300 text-xs font-medium hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Chấm lại
          </button>
        )}
      </div>

      {/* Bước 1 — tra CIC trước, để nhóm lịch sử tín dụng được chấm đủ ngay lần đầu */}
      <div className="flex items-center gap-1.5">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[11px] font-bold">1</span>
        <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">Tra cứu CIC</p>
      </div>
      <CicLookupCard loanId={loan.loanId} onSaved={runEvaluate} onCicChange={setHasCic} />

      {/* Bước 2 — chấm điểm: chỉ mở sau khi có CIC để ra điểm đầy đủ một lần, tránh chấm lại */}
      {!score && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <span className={'inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold text-white ' + (hasCic === true ? 'bg-red-500' : 'bg-gray-300 dark:bg-gray-600')}>2</span>
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">Chấm điểm tín dụng</p>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">AI sẽ tự phân tích toàn bộ chứng từ đính kèm và gộp vào đánh giá. Kết quả chỉ hỗ trợ thẩm định, không tự động duyệt hoặc từ chối.</p>
          <button
            onClick={runEvaluate}
            disabled={loading || hasCic !== true}
            title={hasCic !== true ? 'Hoàn tất Bước 1: tra CIC trước' : undefined}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-medium disabled:opacity-50"
          >
            {loading ? <RefreshCw size={13} className="animate-spin" /> : <Gauge size={13} />}
            Chấm điểm tín dụng
          </button>
          {hasCic === false && (
            <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2 flex gap-1.5">
              <AlertTriangle size={13} className="shrink-0 mt-0.5" />
              Cần nhập kết quả CIC ở Bước 1 trước khi chấm điểm — để nhóm lịch sử tín dụng (nặng nhất) được chấm đầy đủ ngay lần đầu, tránh phải chấm lại.
            </p>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
      {loadingSavedScore && !score && <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải kết quả chấm điểm đã lưu...</p>}
      {loading && <p className="text-sm text-gray-500 dark:text-gray-400">Đang chấm điểm và AI phân tích chứng từ — có thể mất 1-2 phút nếu khoản có nhiều file...</p>}

      {score && (
        <div className="space-y-4">
          <ReviewDirectiveBanner directive={score.reviewDirective} reasons={score.reviewReasons} />
          <ProfileAdvisoryBlock advisory={score.profileAdvisory} />
          <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
            <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-3xl font-bold text-gray-900 dark:text-white">{score.score}</span>
                <span className={'px-2.5 py-1 rounded-lg text-sm font-bold ' + creditGradeTone(score.grade)}>Hạng {score.grade}</span>
              </div>
              <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div className={'h-full rounded-full ' + creditBarColor(score.grade)} style={{ width: pct + '%' }} />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{score.gradePolicy ?? 'Chưa có mô tả hạng.'}</p>
            </div>

            <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/50 p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">{score.aiSummary ? 'AI advisory' : 'Nhận xét tự động'}</p>
              <p className="text-sm text-gray-600 dark:text-gray-300">{score.aiSummary ?? score.explanation?.headline ?? 'Chưa có nhận xét cho lần chấm điểm này.'}</p>
              {score.aiRiskFlags && score.aiRiskFlags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {score.aiRiskFlags.map(flag => <span key={flag} className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-[11px] font-medium">{flag}</span>)}
                </div>
              )}
              {(score.aiRecommendation ?? score.explanation?.suggestedAction) && (
                <p className="text-xs text-gray-500 dark:text-gray-400">Khuyến nghị: {score.aiRecommendation ?? score.explanation?.suggestedAction}</p>
              )}
              {!score.aiSummary && <p className="text-[11px] text-gray-400 dark:text-gray-500 italic">Nhận xét sinh tự động từ breakdown điểm (AI tư vấn chưa bật hoặc không phản hồi).</p>}
            </div>
          </div>

          {/* Vì sao có mức điểm này — luôn hiển thị */}
          {score.explanation && <ScoreExplanationBlock ex={score.explanation} />}

          {/* AI thẩm định chứng từ — luôn có dòng trạng thái, kèm chi tiết từng file */}
          <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/50 p-4 space-y-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <FileSearch size={14} className="text-red-500" />
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">AI thẩm định chứng từ</p>
              {score.explanation?.documents?.summary && (
                <span className="text-xs text-gray-500 dark:text-gray-400">· {score.explanation.documents.summary}</span>
              )}
            </div>

            {score.explanation?.documents?.alerts && score.explanation.documents.alerts.length > 0 && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/40 p-3 space-y-1">
                {score.explanation.documents.alerts.map((a, i) => (
                  <p key={i} className="text-xs text-amber-700 dark:text-amber-300 flex gap-1.5"><AlertTriangle size={13} className="shrink-0 mt-0.5" />{a}</p>
                ))}
              </div>
            )}

            {score.documentAnalyses && score.documentAnalyses.length > 0 ? (
              score.documentAnalyses.map((analysis, idx) => {
                const d = parseDocData(analysis.extractedData);
                const extractedIncome = formatIncomeText(d.extractedIncome);
                return (
                  <div key={analysis.id ?? analysis.fileId ?? idx} className="rounded-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 p-3 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate" title={analysis.fileName ?? analysis.fileId ?? ''}>{analysis.fileName ?? analysis.fileId}</span>
                      <span className={'px-2 py-0.5 rounded-full text-[11px] font-semibold ' + verdictTone(analysis.verdict)}>{verdictLabel(analysis.verdict)}</span>
                      {analysis.trustScore != null && <span className="text-xs text-gray-500 dark:text-gray-400">Độ tin cậy {analysis.trustScore}/100</span>}
                    </div>

                    {(d.detectedType || d.ownerName || d.organizationName || extractedIncome) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5">
                        {d.detectedType && <MiniRow label="AI nhận diện" value={d.detectedType} />}
                        {d.ownerName && <MiniRow label="Chủ chứng từ" value={d.ownerName} />}
                        {d.organizationName && <MiniRow label="Đơn vị phát hành" value={d.organizationName} />}
                        {extractedIncome && <MiniRow label="Thu nhập trên chứng từ" value={extractedIncome} />}
                      </div>
                    )}

                    {analysis.summary && <p className="text-sm text-gray-600 dark:text-gray-300">{analysis.summary}</p>}

                    {d.consistencyIssues.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">Điểm chưa khớp khai báo:</p>
                        <ul className="list-disc pl-5 space-y-0.5 text-xs text-amber-700 dark:text-amber-300">{d.consistencyIssues.map(item => <li key={item}>{item}</li>)}</ul>
                      </div>
                    )}
                    {d.findings.length > 0 && (
                      <ul className="list-disc pl-5 space-y-0.5 text-xs text-gray-500 dark:text-gray-400">{d.findings.map(item => <li key={item}>{item}</li>)}</ul>
                    )}

                    {(analysis.verdict === 'SUSPICIOUS' || analysis.verdict === 'HIGH_RISK' || analysis.verdict === 'ERROR') && (
                      <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2 flex gap-1.5"><AlertTriangle size={13} className="shrink-0 mt-0.5" />Chứng từ cần kiểm tra thủ công trước khi ra quyết định.</p>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                <p>
                  {score.explanation?.documents && !score.explanation.documents.aiEnabled
                    ? 'AI thẩm định chứng từ đang tắt trên máy chủ — vui lòng đối chiếu chứng từ thủ công ở khối "Chứng từ người gọi vốn".'
                    : (score.explanation?.documents?.summary ?? 'Lần chấm điểm này chưa kèm kết quả phân tích chứng từ.')}
                </p>
                {/* AI tự chạy khi chấm điểm — trấn an thẩm định viên không phải thao tác riêng */}
                <p className="text-[11px] text-gray-400 dark:text-gray-500 italic">
                  AI tự phân tích toàn bộ chứng từ ngay khi bấm "Chấm điểm tín dụng" — không cần bấm "Phân tích AI tất cả" trước.
                  Nếu khoản đã có file mà vẫn trống, hãy chấm điểm lại (máy chủ có thể vừa được cập nhật).
                </p>
              </div>
            )}
          </div>

          {grouped && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([component, items]) => (
                <div key={component} className="rounded-lg border border-gray-100 dark:border-gray-700 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">{CREDIT_COMPONENT_LABEL[component] ?? component}</p>
                  <div className="space-y-1.5">
                    {items.map(item => (
                      <div key={item.criteriaCode} className="flex items-start justify-between gap-3 text-xs">
                        <span className="text-gray-600 dark:text-gray-300">{item.criteriaName}</span>
                        <span className="font-semibold text-gray-800 dark:text-gray-100 whitespace-nowrap">{item.points}/{item.maxPoints}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {score.missingData && score.missingData.length > 0 && <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">Thiếu dữ liệu: {score.missingData.join(', ')}</p>}
          <p className="text-[11px] text-gray-400 dark:text-gray-500 italic border-t border-gray-100 dark:border-gray-800 pt-3">Điểm tín dụng chỉ mang tính tham khảo — quyết định thuộc về thẩm định viên.</p>
        </div>
      )}
    </div>
  );
}

function LoanDocumentsSection({ loan }: { loan: CmsLoan }) {
  const [documents, setDocuments] = useState<LoanDocument[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // analyses: docId → kết quả AI phân tích
  const [analyses, setAnalyses] = useState<Record<string, DocumentAnalysisResult>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try { setDocuments(await fetchLoanDocuments(loan.loanId)); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [loan.loanId]);

  const analyzeAll = async () => {
    if (!documents || documents.length === 0) return;
    setAnalyzing(true);
    setAnalyzeError('');
    try {
      const results = await Promise.all(
        documents.map(doc => analyzeLoanDocument(loan.loanId, doc.id).then(r => ({ id: doc.id, r }))),
      );
      const map: Record<string, DocumentAnalysisResult> = {};
      results.forEach(({ id, r }) => { map[id] = r; });
      setAnalyses(map);
    } catch (e) {
      setAnalyzeError((e as Error).message);
    } finally {
      setAnalyzing(false);
    }
  };

  const allAnalyzed = documents != null && documents.length > 0 && documents.every(d => analyses[d.id]);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <FileText size={16} className="text-red-500" />
        <p className="text-[10px] font-semibold uppercase tracking-widest text-red-500">Chứng từ người gọi vốn</p>
        <div className="ml-auto flex items-center gap-2">
          {documents && documents.length > 0 && (
            <button
              onClick={analyzeAll}
              disabled={analyzing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-300 text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50"
            >
              <Brain size={13} className={analyzing ? 'animate-pulse' : ''} />
              {analyzing ? 'Đang phân tích...' : allAnalyzed ? 'Phân tích lại tất cả' : 'Phân tích AI tất cả'}
            </button>
          )}
          <button onClick={load} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title="Tải lại">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
      {analyzeError && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{analyzeError}</p>}
      {loading && !documents && <p className="text-sm text-gray-400 dark:text-gray-500">Đang tải chứng từ...</p>}
      {documents && documents.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">Người gọi vốn chưa bổ sung chứng từ tài chính/thu nhập.</p>}

      {documents && documents.length > 0 && (
        <div className="space-y-3">
          {documents.map(doc => {
            const analysis = analyses[doc.id] ?? null;
            const d = analysis ? parseDocData(analysis.extractedData) : null;
            return (
              <div key={doc.id} className="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40 p-4 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate" title={doc.fileName ?? doc.fileId}>{doc.fileName ?? doc.fileId}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{DOC_TYPE_LABEL[doc.docType] ?? doc.docType} · {doc.createdAt ? formatVietnamDateTime(doc.createdAt) : 'Chưa rõ ngày'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {analysis && (
                      <span className={'px-2 py-0.5 rounded-full text-[11px] font-semibold ' + verdictTone(analysis.verdict)}>
                        {verdictLabel(analysis.verdict)}
                      </span>
                    )}
                    <DocFileActions fileId={doc.fileId} fileName={doc.fileName} />
                  </div>
                </div>

                {analysis && d && (
                  <div className="pt-1 space-y-1.5">
                    {analysis.summary && <p className="text-xs text-gray-600 dark:text-gray-300">{analysis.summary}</p>}
                    {(d.detectedType || d.ownerName || d.extractedIncome) && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-0.5">
                        {d.detectedType && <MiniRow label="AI nhận diện" value={d.detectedType} />}
                        {d.ownerName && <MiniRow label="Chủ chứng từ" value={d.ownerName} />}
                        {d.extractedIncome && <MiniRow label="Thu nhập trên CT" value={formatIncomeText(d.extractedIncome) ?? d.extractedIncome} />}
                      </div>
                    )}
                    {d.consistencyIssues.length > 0 && (
                      <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
                        <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 mb-0.5">Điểm chưa khớp khai báo:</p>
                        <ul className="list-disc pl-4 space-y-0.5 text-xs text-amber-700 dark:text-amber-300">{d.consistencyIssues.map(item => <li key={item}>{item}</li>)}</ul>
                      </div>
                    )}
                    {d.findings.length > 0 && (
                      <ul className="list-disc pl-4 space-y-0.5 text-xs text-gray-500 dark:text-gray-400">{d.findings.map(item => <li key={item}>{item}</li>)}</ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {!allAnalyzed && (
            <p className="text-[11px] text-gray-400 dark:text-gray-500 italic">
              Bấm <span className="font-semibold text-gray-500 dark:text-gray-400">Phân tích AI tất cả</span> để AI đọc và đánh giá từng chứng từ ngay tại đây.
              Kết quả cũng chạy tự động khi bấm "Chấm điểm tín dụng" ở khối bên dưới.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function WorkflowStep({ done, loading: stepLoading, label, note }: {
  done: boolean;
  loading?: boolean;
  label: string;
  note?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold
        ${done ? 'bg-green-500 text-white' : stepLoading ? 'bg-gray-200 dark:bg-gray-700 text-gray-400' : 'border-2 border-gray-300 dark:border-gray-600'}`}>
        {done ? '✓' : stepLoading ? '…' : ''}
      </span>
      <div>
        <p className={`text-xs font-medium ${done ? 'text-gray-600 dark:text-gray-400 line-through' : 'text-gray-800 dark:text-gray-200'}`}>{label}</p>
        {note && <p className="text-[11px] text-amber-600 dark:text-amber-400">{note}</p>}
      </div>
    </div>
  );
}

function AppraisalPanel({ loan, creditScore, onActionDone }: {
  loan: CmsLoan;
  creditScore: CreditScoreResult | null;
  onActionDone: () => void;
}) {
  const loanId = loan.loanId;
  const [data, setData] = useState<AppraisalSuggestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [discouraged, setDiscouraged] = useState(false);
  const [tick, setTick] = useState(0);

  // Trạng thái CIC: null = đang load, true = đã nhập, false = chưa nhập
  const [hasCic, setHasCic] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    setHasCic(null);
    fetchCicLookup(loanId)
      .then(r => { if (alive) setHasCic(r !== null && r !== undefined); })
      .catch(() => { if (alive) setHasCic(false); });
    return () => { alive = false; };
  }, [loanId, tick]);

  // Phê duyệt 2 cấp
  const admin = getStoredAdmin();
  const isLeader = adminHasAnyRole(admin, 'SUPER_ADMIN', 'ADMIN', 'APPROVER') || adminHasPermission(admin, 'loan.approve');
  const canPropose = adminHasAnyRole(admin, 'SUPER_ADMIN', 'ADMIN', 'APPRAISER', 'APPROVER') || adminHasPermission(admin, 'loan.propose');
  const [amountInput, setAmountInput] = useState('');
  const [rateInput, setRateInput] = useState('');
  const [termInput, setTermInput] = useState('');
  const [feeRateInput, setFeeRateInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [acting, setActing] = useState(false);
  const [actError, setActError] = useState('');

  // Lãi suất/hạn mức định giá theo HẠNG Credit 360 — truyền grade xuống loan-service.
  // Khi chấm điểm xong (grade đổi) → tự fetch lại để hiện lãi suất.
  const creditGrade = creditScore?.grade ?? null;
  useEffect(() => {
    setLoading(true);
    setError('');
    fetchAppraisalSuggestion(loanId, discouraged, creditGrade)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [loanId, discouraged, tick, creditGrade]);

  // Prefill form: chờ thẩm định → gợi ý engine; chờ lãnh đạo → số đã đề xuất
  useEffect(() => {
    if (loan.status === 'PENDING_REVIEW' && data?.recommendation) {
      setAmountInput(String(data.recommendation.suggestedAmount ?? ''));
      setRateInput(data.recommendation.suggestedInterestRate != null
        ? String(data.recommendation.suggestedInterestRate) : '');
    } else if (loan.status === 'PENDING_APPROVAL') {
      setAmountInput(loan.proposedAmount != null ? String(loan.proposedAmount) : '');
      setRateInput(loan.proposedInterestRate != null ? String(loan.proposedInterestRate) : '');
      setTermInput(loan.termMonths != null ? String(loan.termMonths) : '');
    }
  }, [loan.status, loan.proposedAmount, loan.proposedInterestRate, loan.termMonths, data]);

  const runAction = async (fn: () => Promise<void>) => {
    setActing(true);
    setActError('');
    try {
      await fn();
      onActionDone();
    } catch (e) {
      setActError((e as Error).message);
      setActing(false);
    }
  };

  const handlePropose = () => {
    if (hasCic === false) { setActError('Cần nhập kết quả tra CIC trước khi trình ban lãnh đạo.'); return; }
    const amt = Number(amountInput);
    const rate = Number(rateInput);
    const feeRate = feeRateInput !== '' ? Number(feeRateInput) : 0;
    if (!(amt > 0)) { setActError('Số tiền đề xuất không hợp lệ.'); return; }
    if (!(rate > 0)) { setActError('Lãi suất đề xuất không hợp lệ.'); return; }
    if (feeRate < 0 || feeRate > 100) { setActError('Phí thẩm định phải từ 0–100%.'); return; }
    runAction(() => proposeLoan(loanId, { proposedAmount: amt, proposedInterestRate: rate, appraisalFeeRate: feeRate, note: noteInput.trim() || undefined }));
  };

  const handleApprove = () => {
    const amt = Number(amountInput);
    const rate = Number(rateInput);
    const term = Number(termInput);
    if (!(amt > 0)) { setActError('Số tiền duyệt không hợp lệ.'); return; }
    if (!(rate > 0)) { setActError('Lợi suất kỳ vọng duyệt không hợp lệ.'); return; }
    if (!Number.isInteger(term) || term <= 0) { setActError('Kỳ hạn duyệt không hợp lệ.'); return; }
    runAction(() => approveLoan(loanId, {
      approvedAmount: Math.round(amt),
      interestRate: rate,
      termMonths: term,
      notes: noteInput.trim() || undefined,
    }));
  };

  const handleReject = () => {
    if (noteInput.trim().length < 3) { setActError('Nhập lý do từ chối.'); return; }
    if (!window.confirm('Xác nhận từ chối hồ sơ gọi vốn này?')) return;
    runAction(() => rejectLoan(loanId, noteInput.trim()));
  };

  const rec = data?.recommendation;
  const sp = data?.schedulePreview ?? null;
  const af = data?.affordability ?? null;

  // Tổng hợp kết quả AI (điểm 300-850 + thẩm định chứng từ) để đối chiếu với engine
  const docInsight = creditScore?.explanation?.documents ?? null;
  const docAnalyses = creditScore?.documentAnalyses ?? [];
  const docTotal = docInsight?.total ?? docAnalyses.length;
  const docIssues = docInsight
    ? docInsight.suspicious + docInsight.highRisk + docInsight.errored
    : docAnalyses.filter(d => d.verdict !== 'CONSISTENT').length;
  const docSummary = !creditScore
    ? null
    : (docInsight?.summary ?? (docTotal === 0 ? 'Không có chứng từ đính kèm' : `${docTotal} chứng từ`));
  const aiScoreText = creditScore ? `${creditScore.score}/850 · Hạng ${creditScore.grade}` : null;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <Sparkles size={16} className="text-red-500" />
        <p className="text-[10px] font-semibold uppercase tracking-widest text-red-500">Hỗ trợ thẩm định</p>
        <label className="ml-auto flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={discouraged}
            onChange={e => setDiscouraged(e.target.checked)}
            className="accent-red-500"
          />
          Lĩnh vực không khuyến khích (+2%)
        </label>
        <button
          onClick={() => setTick(t => t + 1)}
          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          title="Tải lại"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading && !data && (
        <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">
          <RefreshCw size={16} className="animate-spin inline mr-2" />Đang phân tích...
        </p>
      )}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Kết luận thống nhất — Credit 360 là chuẩn; giá lấy theo hạng Credit 360 */}
      <UnifiedVerdict
        suggestedAmount={rec?.suggestedAmount ?? null}
        suggestedRate={rec?.suggestedInterestRate ?? null}
        serviceAvailable={rec?.serviceAvailable ?? false}
        creditScore={creditScore}
        docSummary={docSummary}
        docIssues={docIssues}
        docTotal={docTotal}
        fraudHigh={(data?.fraudChecks ?? []).some(c => c.severity === 'HIGH')}
      />

      {/* Cảnh báo gian lận tự động (velocity & trùng chéo) */}
      <FraudAlertBlock checks={data?.fraudChecks} />

      {data && rec && (
        <>
          {/* Top metrics — Credit 360 (chuẩn) + định giá theo hạng Credit 360 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Điểm tín dụng Credit 360</p>
              {creditScore ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className={`text-lg font-bold px-2.5 py-0.5 rounded-lg ${creditGradeTone(creditScore.grade)}`}>{creditScore.grade}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{creditScore.score}/850 điểm</span>
                  </div>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">Chứng từ: {docSummary}</p>
                </>
              ) : (
                <p className="text-xs text-gray-400 dark:text-gray-500">Chưa chấm — bấm "Chấm điểm tín dụng" ở khối trên để AI thẩm định chứng từ và cho điểm 300–850.</p>
              )}
            </div>

            <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Đề xuất giải ngân</p>
              <p className="text-base font-bold text-gray-900 dark:text-white whitespace-nowrap">{formatMoney(rec.suggestedAmount)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Lãi suất tối thiểu <span className="font-semibold text-gray-700 dark:text-gray-200">{rateText(rec.suggestedInterestRate)}</span>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Phí giải ngân {rec.feePercent != null ? `${rec.feePercent}%` : '—'}
                {rec.connectionFee != null && <span className="text-gray-400 dark:text-gray-500"> ({formatMoney(rec.connectionFee)})</span>}
              </p>
            </div>
          </div>

          {/* Service unavailable banner */}
          {!rec.serviceAvailable && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 px-3 py-2.5 text-sm text-red-700 dark:text-red-300 flex gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              {rec.rateNote}
            </div>
          )}
          {rec.serviceAvailable && (
            <p className="text-[11px] text-gray-400 dark:text-gray-500 -mt-2">{rec.rateNote} · Số tiền: {rec.amountCapReason}.</p>
          )}

          {/* Affordability + schedule */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {af && (
              <SubSection title="Năng lực trả nợ" icon={<Wallet size={13} />}>
                <MiniRow label="Thu nhập/tháng" value={af.incomeProvided ? formatMoney(af.monthlyIncome) : <span className="text-red-500">Chưa khai</span>} />
                <MiniRow label="Trần PTI" value={ratioPct(af.ptiCap)} />
                <MiniRow label="Khoản trả/tháng (số yêu cầu)" value={af.requestedInstallment != null ? formatMoney(af.requestedInstallment) : '—'} />
                <MiniRow label="PTI ở số yêu cầu" value={ratioPct(af.requestedPti)} />
                <MiniRow label="Trả tối đa/tháng (theo thu nhập)" value={af.maxInstallmentByIncome != null ? formatMoney(af.maxInstallmentByIncome) : '—'} />
                <MiniRow label="Gốc tối đa theo thu nhập" value={af.maxPrincipalByIncome != null ? formatMoney(af.maxPrincipalByIncome) : '—'} />
              </SubSection>
            )}

            {sp ? (
              <SubSection title="Lịch trả nợ xem trước (ở mức đề xuất)" icon={<CircleDollarSign size={13} />}>
                <MiniRow label="Phương thức" value={METHOD_LABEL[sp.method] ?? sp.method} />
                <MiniRow label="Số kỳ" value={`${sp.periods} kỳ`} />
                <MiniRow label="Trả kỳ đầu" value={formatMoney(sp.firstInstallment)} />
                <MiniRow label="Tổng gốc" value={formatMoney(sp.totalPrincipal)} />
                <MiniRow label="Tổng lãi" value={formatMoney(sp.totalInterest)} />
                <MiniRow label="Tổng phải trả" value={<span className="font-semibold">{formatMoney(sp.totalPayable)}</span>} />
              </SubSection>
            ) : (
              <SubSection title="Lịch trả nợ xem trước" icon={<CircleDollarSign size={13} />}>
                <p className="text-xs text-gray-400 dark:text-gray-500 italic">Không khả dụng (hạng không được cấp dịch vụ).</p>
              </SubSection>
            )}
          </div>

          {/* Auto warnings */}
          {(data.autoWarnings.length > 0 || docIssues > 0) && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/40 p-3 space-y-1.5">
              {data.autoWarnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-700 dark:text-amber-300 flex gap-1.5">
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />{w}
                </p>
              ))}
              {docIssues > 0 && (
                <p className="text-xs text-amber-700 dark:text-amber-300 flex gap-1.5">
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                  AI đánh dấu {docIssues}/{docTotal} chứng từ cần kiểm tra — xem chi tiết ở khối Điểm tín dụng tham khảo và xác minh thủ công trước khi trình.
                </p>
              )}
            </div>
          )}

          {/* Manual checklist */}
          <SubSection title="Checklist thẩm định thủ công" icon={<ClipboardList size={13} />}>
            <div>
              {data.manualChecklist.map(c => (
                <div key={c.code} className="py-2.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      {CATEGORY_LABEL[c.category] ?? c.category}
                    </span>
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{c.title}</span>
                    {c.required && <span className="text-[10px] text-red-500 font-medium">* bắt buộc</span>}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{c.instruction}</p>
                </div>
              ))}
            </div>
          </SubSection>

          <p className="text-[11px] text-gray-400 dark:text-gray-500 italic border-t border-gray-100 dark:border-gray-800 pt-3">
            {data.disclaimer}
          </p>
        </>
      )}

      {/* ── Hành động phê duyệt 2 cấp ── */}
      {(loan.status === 'PENDING_REVIEW' || loan.status === 'PENDING_APPROVAL') && (
        <div className="rounded-xl border border-red-100 dark:border-red-900/40 bg-red-50/40 dark:bg-red-900/10 p-4 space-y-3">
          {loan.status === 'PENDING_APPROVAL' && (
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                <Send size={13} />Đề xuất của thẩm định viên
              </p>
              <MiniRow label="Số tiền đề xuất" value={formatMoney(loan.proposedAmount)} />
              <MiniRow label="Lợi suất kỳ vọng đề xuất" value={loan.proposedInterestRate != null ? `${loan.proposedInterestRate}%/năm` : '—'} />
              <MiniRow label="Kỳ hạn hiện tại" value={loan.termMonths != null ? `${loan.termMonths} tháng` : '—'} />
              <MiniRow label="Phí thẩm định" value={loan.appraisalFeeRate != null && loan.appraisalFeeRate > 0 ? `${loan.appraisalFeeRate}%` : '0% (miễn phí)'} />
              {(loan.totalFee != null && loan.totalFee > 0) && (
                <div className="mt-1 mb-1 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700 px-3 py-2 space-y-1">
                  <MiniRow label={`Phí thẩm định (${loan.appraisalFeeRate}%)`} value={formatMoney(loan.appraisalFee)} />
                  <MiniRow label="VAT (10%)" value={formatMoney(loan.vatAmount)} />
                  <div className="flex justify-between items-start gap-3 py-1 border-t border-gray-200 dark:border-gray-600">
                    <span className="text-xs text-red-600 dark:text-red-400 font-semibold shrink-0">Tổng khấu trừ</span>
                    <span className="text-xs text-red-600 dark:text-red-400 text-right font-semibold">{formatMoney(loan.totalFee)}</span>
                  </div>
                  <div className="flex justify-between items-start gap-3 py-1">
                    <span className="text-xs text-green-700 dark:text-green-400 font-semibold shrink-0">Người gọi vốn nhận</span>
                    <span className="text-xs text-green-700 dark:text-green-400 text-right font-semibold">{formatMoney(loan.netDisbursement)}</span>
                  </div>
                </div>
              )}
              <MiniRow label="Thẩm định viên" value={loan.proposedBy ?? '—'} />
              {loan.appraisalNote && <MiniRow label="Ghi chú" value={loan.appraisalNote} />}

              {/* Căn cứ hỗ trợ cho ban lãnh đạo — Credit 360 (chuẩn) + định giá + AI chứng từ */}
              <div className="mt-2 pt-2 border-t border-red-100/70 dark:border-red-900/30">
                <MiniRow
                  label="Điểm tín dụng Credit 360"
                  value={aiScoreText ?? <span className="text-amber-600 dark:text-amber-400">Chưa chấm — bấm "Chấm điểm tín dụng" ở khối trên</span>}
                />
                <MiniRow
                  label="Đề xuất lợi suất kỳ vọng (QĐ-LSGV)"
                  value={rec
                    ? (rec.serviceAvailable
                        ? `${formatMoney(rec.suggestedAmount)} @ ${rateText(rec.suggestedInterestRate)}`
                        : (rec.rateNote || 'Không cấp dịch vụ'))
                    : 'Đang tải...'}
                />
                {creditScore && <MiniRow label="AI thẩm định chứng từ" value={docSummary} />}
                {creditScore?.aiRecommendation && <MiniRow label="AI khuyến nghị" value={creditScore.aiRecommendation} />}
                <p className="text-[11px] text-gray-400 dark:text-gray-500 italic mt-1.5">Kết luận tổng hợp & cổng loại trừ xem ở đầu khối "Hỗ trợ thẩm định".</p>
              </div>
            </div>
          )}

          {loan.status === 'PENDING_REVIEW' && (canPropose ? (
            <>
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-red-500">
                <Send size={13} />Đề xuất trình ban lãnh đạo
              </p>

              {/* Checklist quy trình — thẩm định viên biết còn thiếu bước nào */}
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 p-3 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Quy trình thẩm định</p>
                <WorkflowStep
                  done={true}
                  label="Xem & kiểm tra chứng từ"
                />
                <WorkflowStep
                  done={hasCic === true}
                  loading={hasCic === null}
                  label="Tra CIC & nhập kết quả"
                  note={hasCic === false ? 'Bắt buộc — kéo lên khối Điểm tín dụng để nhập' : undefined}
                />
                <WorkflowStep
                  done={creditScore !== null}
                  label="Chấm điểm tín dụng"
                  note={!creditScore ? 'Khuyến nghị — kéo lên bấm "Chấm điểm tín dụng"' : undefined}
                />
                <WorkflowStep
                  done={false}
                  label="Điền đề xuất và trình ban lãnh đạo"
                />
              </div>

              {/* Căn cứ đề xuất — Credit 360 (chuẩn) + định giá + AI chứng từ */}
              <div className="rounded-lg bg-white/70 dark:bg-gray-900/40 border border-red-100/70 dark:border-red-900/30 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Căn cứ đề xuất</p>
                <MiniRow
                  label="Điểm tín dụng Credit 360"
                  value={aiScoreText ?? <span className="text-amber-600 dark:text-amber-400">Chưa chấm điểm</span>}
                />
                <MiniRow
                  label="Đề xuất lợi suất kỳ vọng (QĐ-LSGV)"
                  value={rec
                    ? (rec.serviceAvailable
                        ? `${formatMoney(rec.suggestedAmount)} @ ${rateText(rec.suggestedInterestRate)}`
                        : (rec.rateNote || 'Không cấp dịch vụ'))
                    : 'Đang tải...'}
                />
                <MiniRow label="AI thẩm định chứng từ" value={creditScore ? docSummary : '—'} />
                {creditScore?.aiRecommendation && <MiniRow label="AI khuyến nghị" value={creditScore.aiRecommendation} />}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-xs text-gray-500 dark:text-gray-400">
                  Số tiền đề xuất (VND)
                  <input type="number" value={amountInput} onChange={e => setAmountInput(e.target.value)} className={inputCls} />
                </label>
                <label className="text-xs text-gray-500 dark:text-gray-400">
                  Lợi suất kỳ vọng (%/năm)
                  <input type="number" step="0.1" value={rateInput} onChange={e => setRateInput(e.target.value)} className={inputCls} />
                </label>
              </div>
              <label className="block text-xs text-gray-500 dark:text-gray-400">
                Phí thẩm định (%)
                <input type="number" step="0.1" min="0" max="100" value={feeRateInput}
                  onChange={e => setFeeRateInput(e.target.value)} placeholder="0" className={inputCls} />
              </label>
              {/* Preview phí cho thẩm định viên thấy trước khi trình */}
              {(() => {
                const amt = Number(amountInput);
                const fr = Number(feeRateInput);
                if (!(amt > 0) || !(fr > 0)) return null;
                const fee = Math.round(amt * fr / 100);
                const vat = Math.round(fee * 0.1);
                const total = fee + vat;
                const net = amt - total;
                const fmt = (v: number) => new Intl.NumberFormat('vi-VN').format(v) + ' VNĐ';
                return (
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700 px-3 py-2.5 space-y-1 text-xs">
                    <p className="font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Xem trước phí giải ngân</p>
                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span>Phí thẩm định ({fr}%)</span><span className="font-medium text-gray-900 dark:text-white">{fmt(fee)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span>VAT (10%)</span><span className="font-medium text-gray-900 dark:text-white">{fmt(vat)}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t border-gray-200 dark:border-gray-600 pt-1 text-gray-900 dark:text-white">
                      <span>Tổng khấu trừ</span><span className="text-red-600 dark:text-red-400">{fmt(total)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span>Người gọi vốn nhận</span><span className="font-semibold text-green-700 dark:text-green-400">{fmt(net)}</span>
                    </div>
                  </div>
                );
              })()}
              <label className="block text-xs text-gray-500 dark:text-gray-400">
                Ghi chú thẩm định / lý do từ chối
                <textarea value={noteInput} onChange={e => setNoteInput(e.target.value)} rows={2} className={inputCls} />
              </label>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">Số liệu điền sẵn từ gợi ý engine — chỉnh nếu cần.</p>
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={acting || hasCic === false}
                  onClick={handlePropose}
                  className={btnPrimary}
                  title={hasCic === false ? 'Cần nhập CIC trước' : undefined}
                >
                  <Send size={14} />Trình ban lãnh đạo
                </button>
                <button disabled={acting} onClick={handleReject} className={btnDanger}>
                  <X size={14} />Từ chối hồ sơ
                </button>
              </div>
              {hasCic === false && (
                <p className="text-xs text-red-600 dark:text-red-400 flex gap-1.5">
                  <Ban size={13} className="shrink-0 mt-0.5" />Cần nhập kết quả tra CIC trước khi trình ban lãnh đạo — kéo lên khối Điểm tín dụng.
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-indigo-500" />Đang chờ thẩm định viên đề xuất.
            </p>
          ))}

          {loan.status === 'PENDING_APPROVAL' && (isLeader ? (
            <>
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-red-500 pt-1">
                <ShieldCheck size={13} />Ban lãnh đạo phê duyệt
              </p>
              <label className="block text-xs text-gray-500 dark:text-gray-400">
                Số tiền duyệt lên sàn (VND)
                <input type="number" value={amountInput} onChange={e => setAmountInput(e.target.value)} className={inputCls} />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-xs text-gray-500 dark:text-gray-400">
                  Lợi suất kỳ vọng duyệt (%/năm)
                  <input type="number" step="0.1" value={rateInput} onChange={e => setRateInput(e.target.value)} className={inputCls} />
                </label>
                <label className="block text-xs text-gray-500 dark:text-gray-400">
                  Kỳ hạn duyệt (tháng)
                  <input type="number" step="1" min="1" value={termInput} onChange={e => setTermInput(e.target.value)} className={inputCls} />
                </label>
              </div>
              {(() => {
                const amt = Number(amountInput);
                const fr = Number(loan.appraisalFeeRate ?? 0);
                if (!(amt > 0) || fr < 0) return null;
                const fee = Math.round(amt * fr / 100);
                const vat = Math.round(fee * 0.1);
                const total = fee + vat;
                const net = amt - total;
                return (
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700 px-3 py-2 space-y-1">
                    <MiniRow label="Tổng khấu trừ theo số tiền duyệt" value={formatMoney(total)} />
                    <MiniRow label="Người gọi vốn nhận dự kiến" value={<span className="text-green-700 dark:text-green-400 font-semibold">{formatMoney(net)}</span>} />
                  </div>
                );
              })()}
              <label className="block text-xs text-gray-500 dark:text-gray-400">
                Ghi chú / lý do (bắt buộc khi từ chối)
                <textarea value={noteInput} onChange={e => setNoteInput(e.target.value)} rows={2} className={inputCls} />
              </label>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                Phê duyệt xong, khoản chuyển sang "Chờ xác nhận" — người gọi vốn phải đồng ý số tiền, lợi suất kỳ vọng và kỳ hạn được duyệt thì khoản mới lên sàn cho nhà đầu tư.
              </p>
              <div className="flex gap-2">
                <button disabled={acting} onClick={handleApprove} className={btnPrimary}>
                  <Check size={14} />Phê duyệt
                </button>
                <button disabled={acting} onClick={handleReject} className={btnDanger}>
                  <X size={14} />Từ chối
                </button>
              </div>
            </>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-indigo-500" />Đang chờ ban lãnh đạo phê duyệt.
            </p>
          ))}

          {actError && <p className="text-xs text-red-600 dark:text-red-400">{actError}</p>}
        </div>
      )}
    </div>
  );
}

// ─── Repayment schedule section ──────────────────────────────────────────────

const STATUS_ROW_CLS: Record<RepaymentScheduleItem['status'], string> = {
  PENDING: '',
  PARTIAL: 'bg-amber-50 dark:bg-amber-900/10',
  PAID:    'bg-green-50 dark:bg-green-900/10',
  OVERDUE: 'bg-red-50 dark:bg-red-900/10',
};
const STATUS_BADGE_CLS: Record<RepaymentScheduleItem['status'], string> = {
  PENDING: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  PARTIAL: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  PAID:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  OVERDUE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};
const STATUS_LABEL_SCH: Record<RepaymentScheduleItem['status'], string> = {
  PENDING: 'Chưa trả',
  PARTIAL: 'Một phần',
  PAID:    'Đã trả',
  OVERDUE: 'Quá hạn',
};

// Các trạng thái khoản đã lên sàn gọi vốn — tiến độ đầu tư mới có ý nghĩa hiển thị
const FUNDING_VISIBLE_STATUSES = ['ACTIVE', 'FUNDED', 'AWAITING_DISBURSEMENT', 'DISBURSED', 'REPAYING', 'COMPLETED', 'DEFAULTED'];

const OFFER_STATUS_CLS: Record<string, string> = {
  ACCEPTED:  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  PENDING:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  REJECTED:  'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
  CANCELLED: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
};
const OFFER_STATUS_LABEL: Record<string, string> = {
  ACCEPTED: 'Đã chốt', PENDING: 'Chờ ký', REJECTED: 'Từ chối', CANCELLED: 'Đã huỷ',
};

function FundingProgressSection({ loan, onViewCustomer }: { loan: CmsLoan; onViewCustomer?: (userId: string) => void }) {
  const target    = loan.amount || 0;
  const raised    = loan.fundedAmount ?? 0;
  const pct       = target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : 0;
  const remaining = Math.max(target - raised, 0);
  const offers    = loan.offers ?? [];
  const accepted  = offers.filter(o => o.status === 'ACCEPTED');

  return (
    <Section title="Tiến độ gọi vốn & Nhà đầu tư">
      {/* Thanh tiến độ */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-gray-500 dark:text-gray-400">Đã được đầu tư</span>
          <span className="font-semibold text-gray-800 dark:text-gray-100">
            {formatMoney(raised)} / {formatMoney(target)} ({pct}%)
          </span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
          <div className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #C82020, #E8A030)' }} />
        </div>
        <div className="flex items-center justify-between text-[11px] mt-1.5 text-gray-400 dark:text-gray-500">
          <span>{accepted.length} nhà đầu tư đã chốt</span>
          {remaining > 0
            ? <span>Còn lại {formatMoney(remaining)}</span>
            : <span className="text-green-600 dark:text-green-400 font-semibold">Đã đủ vốn</span>}
        </div>
      </div>

      {/* Danh sách nhà đầu tư */}
      {offers.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500">Chưa có nhà đầu tư nào đặt lệnh.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-left">
                <th className="px-3 py-2 font-semibold">Nhà đầu tư</th>
                <th className="px-3 py-2 font-semibold">Số điện thoại</th>
                <th className="px-3 py-2 font-semibold text-right">Số tiền</th>
                <th className="px-3 py-2 font-semibold text-center">Trạng thái</th>
                <th className="px-3 py-2 font-semibold">Thời điểm</th>
              </tr>
            </thead>
            <tbody>
              {offers.map(o => (
                <tr key={o.offerId} className="border-t border-gray-100 dark:border-gray-700">
                  <td className="px-3 py-2 text-gray-800 dark:text-gray-200">
                    {o.investorId && onViewCustomer ? (
                      <button
                        onClick={() => onViewCustomer(o.investorId!)}
                        title="Xem hồ sơ nhà đầu tư"
                        className="inline-flex items-center gap-1 font-semibold text-red-600 dark:text-red-400 hover:underline"
                      >
                        {o.investorName ?? o.investorPhone ?? 'Xem nhà đầu tư'}
                        <ExternalLink size={11} className="shrink-0" />
                      </button>
                    ) : (o.investorName ?? <span className="text-gray-400 italic">Chưa KYC</span>)}
                  </td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{o.investorPhone ?? '—'}</td>
                  <td className="px-3 py-2 text-right font-semibold text-gray-900 dark:text-gray-100">{formatMoney(o.amount ?? 0)}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${OFFER_STATUS_CLS[o.status ?? ''] ?? 'bg-gray-100 text-gray-500'}`}>
                      {OFFER_STATUS_LABEL[o.status ?? ''] ?? o.status ?? '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{o.createdAt ? formatVietnamDateTime(o.createdAt) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

const PAYABLE_LOAN_STATUSES = ['DISBURSED', 'REPAYING', 'DEFAULTED'];

function RepaymentScheduleSection({ loanId, loanStatus }: { loanId: string; loanStatus: string }) {
  const [schedule, setSchedule] = useState<RepaymentScheduleItem[] | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [open, setOpen]         = useState(false);

  // Ghi nhận trả nợ thủ công
  const [showRecord, setShowRecord]   = useState(false);
  const [recAmount, setRecAmount]     = useState('');
  const [recReason, setRecReason]     = useState('');
  const [recRef, setRecRef]           = useState('');
  const [recSubmitting, setRecSubmitting] = useState(false);
  const [recError, setRecError]       = useState('');

  const load = async () => {
    if (schedule !== null) { setOpen(v => !v); return; }
    setLoading(true);
    setError('');
    try {
      const data = await fetchRepaymentSchedule(loanId);
      setSchedule(data);
      setOpen(true);
    } catch {
      setError('Không tải được lịch trả nợ.');
    } finally {
      setLoading(false);
    }
  };

  const totalInterest = schedule?.reduce((s, r) => s + r.interestDue, 0) ?? 0;
  const paidCount     = schedule?.filter(r => r.status === 'PAID').length ?? 0;
  const overdueCount  = schedule?.filter(r => r.status === 'OVERDUE').length ?? 0;
  const canRecord     = PAYABLE_LOAN_STATUSES.includes(loanStatus);
  const totalOutstanding = schedule?.reduce(
    (s, r) => s + (r.totalOutstanding ?? Math.max((r.totalDue || 0) - (r.paidAmount || 0), 0)), 0) ?? 0;

  const submitRecord = async () => {
    const amt = Number(recAmount);
    if (!amt || amt <= 0) { setRecError('Số tiền phải lớn hơn 0.'); return; }
    if (!recReason.trim()) { setRecError('Vui lòng nhập lý do ghi nhận.'); return; }
    setRecSubmitting(true);
    setRecError('');
    try {
      const updated = await recordRepayment(loanId, {
        amount: amt,
        reason: recReason.trim(),
        externalRef: recRef.trim() || undefined,
      });
      setSchedule(updated);
      setShowRecord(false);
      setRecAmount(''); setRecReason(''); setRecRef('');
    } catch (e) {
      setRecError(e instanceof Error ? e.message : 'Ghi nhận trả nợ thất bại.');
    } finally {
      setRecSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={load}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-red-500">Lịch trả nợ</p>
          {schedule && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {paidCount}/{schedule.length} kỳ đã trả
              {overdueCount > 0 && (
                <span className="ml-1 text-red-500 font-semibold">· {overdueCount} quá hạn</span>
              )}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {loading && <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />}
          {!loading && (
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>
      </button>

      {error && (
        <p className="px-5 pb-4 text-xs text-red-500">{error}</p>
      )}

      {/* Thanh hành động ghi nhận trả nợ thủ công */}
      {open && schedule && schedule.length > 0 && canRecord && (
        <div className="px-5 pb-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            Khách trả tiền mặt / chuyển khoản ngoài ví? Ghi nhận tại đây — tiền áp vào kỳ sớm nhất chưa trả (gốc + lãi trước, dư trả phí phạt).
          </p>
          <button
            onClick={() => {
              setShowRecord(true);
              setRecError('');
              setRecAmount(totalOutstanding > 0 ? String(Math.round(totalOutstanding)) : '');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white shrink-0"
            style={{ background: 'linear-gradient(135deg, #C82020, #8B0A0A)' }}>
            <HandCoins size={14} />Ghi nhận trả nợ
          </button>
        </div>
      )}

      {/* Modal ghi nhận trả nợ */}
      {showRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !recSubmitting && setShowRecord(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <HandCoins size={20} className="text-red-600 dark:text-red-400" />
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Ghi nhận trả nợ thủ công</h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Tổng còn phải trả của khoản: <span className="font-semibold text-red-600 dark:text-red-400">{formatMoney(totalOutstanding)}</span>.
              Tiền sẽ được áp vào kỳ sớm nhất chưa trả.
            </p>

            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Số tiền nhận (VND) <span className="text-red-500">*</span></label>
              <input
                type="number" min={0} value={recAmount}
                onChange={e => setRecAmount(e.target.value)}
                placeholder="Nhập số tiền khách đã trả"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-300 dark:focus:ring-red-700" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Lý do / nguồn tiền <span className="text-red-500">*</span></label>
              <input
                type="text" value={recReason}
                onChange={e => setRecReason(e.target.value)}
                placeholder="VD: Khách chuyển khoản MB, thu tiền mặt tại quầy"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-300 dark:focus:ring-red-700" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Mã tham chiếu ngân hàng / biên lai <span className="text-gray-400 font-normal">(tuỳ chọn)</span></label>
              <input
                type="text" value={recRef}
                onChange={e => setRecRef(e.target.value)}
                placeholder="VD: FT24xxxx, số biên lai"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-300 dark:focus:ring-red-700" />
            </div>

            {recError && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{recError}</p>}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setShowRecord(false)} disabled={recSubmitting}
                className="px-4 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">
                Huỷ
              </button>
              <button
                onClick={submitRecord} disabled={recSubmitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #C82020, #8B0A0A)' }}>
                {recSubmitting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Xác nhận ghi nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {open && schedule && schedule.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-left">
                <th className="px-4 py-2 font-semibold w-10 text-center">Kỳ</th>
                <th className="px-4 py-2 font-semibold">Ngày đáo hạn</th>
                <th className="px-4 py-2 font-semibold text-right">Gốc</th>
                <th className="px-4 py-2 font-semibold text-right">Lãi</th>
                <th className="px-4 py-2 font-semibold text-right">Gốc + lãi</th>
                <th className="px-4 py-2 font-semibold text-right">Phí phạt</th>
                <th className="px-4 py-2 font-semibold text-right">Còn phải trả</th>
                <th className="px-4 py-2 font-semibold text-right">Đã trả</th>
                <th className="px-4 py-2 font-semibold text-center">Trạng thái</th>
                {schedule.some(r => r.dpd > 0) && (
                  <th className="px-4 py-2 font-semibold text-center">DPD</th>
                )}
              </tr>
            </thead>
            <tbody>
              {schedule.map(r => (
                <tr key={r.periodNumber}
                  className={`border-t border-gray-100 dark:border-gray-700 ${STATUS_ROW_CLS[r.status]}`}>
                  <td className="px-4 py-2.5 text-center font-bold text-gray-700 dark:text-gray-300">{r.periodNumber}</td>
                  <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {formatVietnamDate(r.dueDate)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">
                    {formatMoney(r.principalDue)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">
                    {formatMoney(r.interestDue)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-800 dark:text-gray-200">
                    {formatMoney(r.totalDue)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="space-y-0.5">
                      <p className={Number(r.lateFee || 0) > 0
                        ? 'font-semibold text-red-600 dark:text-red-300'
                        : 'text-gray-400 dark:text-gray-500'}>
                        {formatMoney(r.lateFee || 0)}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500">
                        Còn {formatMoney(r.lateFeeOutstanding || 0)}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-gray-900 dark:text-gray-100">
                    {formatMoney(r.totalOutstanding ?? Math.max((r.totalDue || 0) - (r.paidAmount || 0), 0))}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-500 dark:text-gray-400">
                    {r.paidAmount > 0 ? formatMoney(r.paidAmount) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_BADGE_CLS[r.status]}`}>
                      {STATUS_LABEL_SCH[r.status]}
                    </span>
                  </td>
                  {schedule.some(r2 => r2.dpd > 0) && (
                    <td className="px-4 py-2.5 text-center">
                      {r.dpd > 0
                        ? <span className="text-red-500 font-bold">{r.dpd}</span>
                        : <span className="text-gray-300 dark:text-gray-600">—</span>
                      }
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <td colSpan={2} className="px-4 py-2 text-xs text-gray-400 dark:text-gray-500 font-semibold">Tổng cộng</td>
                <td className="px-4 py-2 text-right text-xs font-semibold text-gray-700 dark:text-gray-300">
                  {formatMoney(schedule.reduce((s, r) => s + r.principalDue, 0))}
                </td>
                <td className="px-4 py-2 text-right text-xs font-semibold text-gray-700 dark:text-gray-300">
                  {formatMoney(totalInterest)}
                </td>
                <td className="px-4 py-2 text-right text-xs font-bold text-gray-800 dark:text-gray-200">
                  {formatMoney(schedule.reduce((s, r) => s + r.totalDue, 0))}
                </td>
                <td className="px-4 py-2 text-right text-xs font-bold text-red-600 dark:text-red-300">
                  {formatMoney(schedule.reduce((s, r) => s + Number(r.lateFee || 0), 0))}
                </td>
                <td className="px-4 py-2 text-right text-xs font-bold text-gray-900 dark:text-gray-100">
                  {formatMoney(schedule.reduce((s, r) =>
                    s + Number(r.totalOutstanding ?? Math.max((r.totalDue || 0) - (r.paidAmount || 0), 0)), 0))}
                </td>
                <td colSpan={2} className="px-4 py-2" />
                {schedule.some(r => r.dpd > 0) && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {open && schedule && schedule.length === 0 && (
        <p className="px-5 pb-4 text-xs text-gray-400 dark:text-gray-500">Lịch trả nợ chưa được tạo.</p>
      )}
    </div>
  );
}

// ─── Xem báo giá tất toán sớm (chỉ xem, không trừ tiền) ─────────────────────────

const EARLY_SETTLEMENT_ELIGIBLE_STATUSES = ['DISBURSED', 'REPAYING', 'DEFAULTED'];

function EarlySettlementQuoteSection({ loanId, loanStatus }: { loanId: string; loanStatus: string }) {
  const [quote, setQuote]   = useState<EarlySettlementQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [open, setOpen]       = useState(false);

  if (!EARLY_SETTLEMENT_ELIGIBLE_STATUSES.includes(loanStatus)) return null;

  const load = async () => {
    if (quote !== null) { setOpen(v => !v); return; }
    setLoading(true);
    setError('');
    try {
      const data = await fetchEarlySettlementQuote(loanId);
      setQuote(data);
      setOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được báo giá tất toán.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
      <button
        onClick={load}
        disabled={loading}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
          <Calculator size={16} className="text-amber-500" />
          Xem báo giá tất toán sớm
          <span className="text-xs font-normal text-gray-400 dark:text-gray-500">(chỉ xem, không trừ tiền)</span>
        </span>
        {loading
          ? <RefreshCw size={14} className="animate-spin text-gray-400" />
          : <ChevronRight size={16} className={`text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`} />}
      </button>

      {error && (
        <p className="px-5 pb-3 text-xs text-red-500">{error}</p>
      )}

      {open && quote && (
        <div className="px-5 pb-4 border-t border-gray-100 dark:border-gray-800 pt-3 space-y-2">
          <p className="text-xs text-gray-400 dark:text-gray-500">Báo giá theo dữ liệu ngày {formatVietnamDate(quote.asOfDate)}</p>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <span className="text-gray-500 dark:text-gray-400">Gốc còn lại</span>
            <span className="text-right font-medium text-gray-900 dark:text-gray-100">{formatMoney(quote.remainingPrincipal)}</span>

            <span className="text-gray-500 dark:text-gray-400">Lãi tới ngày tất toán</span>
            <span className="text-right font-medium text-gray-900 dark:text-gray-100">{formatMoney(quote.interestToDate)}</span>

            {quote.penaltyOutstanding > 0 && (
              <>
                <span className="text-gray-500 dark:text-gray-400">Phí phạt quá hạn</span>
                <span className="text-right font-medium text-orange-600 dark:text-orange-400">{formatMoney(quote.penaltyOutstanding)}</span>
              </>
            )}

            <span className="text-gray-500 dark:text-gray-400">
              Phí tất toán sớm{quote.settlementFee > 0 ? ` (${quote.settlementFeeRate}%)` : ''}
            </span>
            <span className={`text-right font-medium ${quote.settlementFee > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
              {quote.settlementFee > 0 ? formatMoney(quote.settlementFee) : 'Miễn phí (đã dùng ≥ 2/3 kỳ hạn)'}
            </span>
          </div>

          <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Tổng thanh toán tất toán</span>
            <span className="text-base font-bold text-red-600 dark:text-red-400">{formatMoney(quote.totalPayoff)}</span>
          </div>

          {quote.settled && (
            <p className="text-xs text-green-600 dark:text-green-400">Khoản này đã được tất toán trước hạn.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Hợp đồng điện tử ───────────────────────────────────────────────────────────

const CONTRACT_STATUS_CLS: Record<string, string> = {
  PENDING_SIGNATURE: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  SIGNED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  VOIDED: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
};

function ContractsSection({ loanId }: { loanId: string }) {
  const [contracts, setContracts] = useState<LoanContract[] | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [open, setOpen]           = useState(false);

  const load = async () => {
    if (contracts !== null) { setOpen(v => !v); return; }
    setLoading(true);
    setError('');
    try {
      const data = await fetchLoanContracts(loanId);
      setContracts(data);
      setOpen(true);
    } catch {
      setError('Không tải được danh sách hợp đồng.');
    } finally {
      setLoading(false);
    }
  };

  const signedCount = contracts?.filter(c => c.status === 'SIGNED').length ?? 0;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
      <button
        onClick={load}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-red-500">Hợp đồng điện tử</p>
          {contracts && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {signedCount}/{contracts.length} đã ký
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {loading && <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />}
          {!loading && (
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>
      </button>

      {error && <p className="px-5 pb-4 text-xs text-red-500">{error}</p>}

      {open && contracts && contracts.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-left">
                <th className="px-4 py-2 font-semibold">Số HĐ</th>
                <th className="px-4 py-2 font-semibold">Loại</th>
                <th className="px-4 py-2 font-semibold text-right">Số tiền</th>
                <th className="px-4 py-2 font-semibold text-center">Trạng thái</th>
                <th className="px-4 py-2 font-semibold">Ngày ký</th>
                <th className="px-4 py-2 font-semibold text-center">Bản HĐ</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map(c => (
                <tr key={c.id} className="border-t border-gray-100 dark:border-gray-700">
                  <td className="px-4 py-2.5 font-mono text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {c.contractNo ?? shortId(c.id)}
                  </td>
                  <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">
                    {CONTRACT_TYPE_LABEL[c.contractType] ?? c.contractType}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">
                    {c.amount != null ? formatMoney(c.amount) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${CONTRACT_STATUS_CLS[c.status] ?? ''}`}>
                      {CONTRACT_STATUS_LABEL[c.status] ?? c.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {c.signedAt ? formatVietnamDateTime(c.signedAt) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {(c.signedDocumentUrl || c.documentUrl) ? (
                      <a
                        href={c.signedDocumentUrl || c.documentUrl || '#'}
                        target="_blank" rel="noreferrer"
                        className="text-red-600 dark:text-red-400 hover:underline"
                      >
                        Xem
                      </a>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && contracts && contracts.length === 0 && (
        <p className="px-5 pb-4 text-xs text-gray-400 dark:text-gray-500">Chưa có hợp đồng nào.</p>
      )}
    </div>
  );
}

// ─── Giải ngân (ADMIN) ───────────────────────────────────────────────────────────

const CMS_CANCELLABLE_STATUSES = new Set([
  'PENDING_REVIEW',
  'PENDING_APPROVAL',
  'AWAITING_BORROWER_APPROVAL',
  'ACTIVE',
  'FUNDED',
  'AWAITING_DISBURSEMENT',
]);

function LoanCancelPanel({ loan, onActionDone }: { loan: CmsLoan; onActionDone: () => void }) {
  const admin = getStoredAdmin();
  const isLeader = adminHasAnyRole(admin, 'SUPER_ADMIN', 'ADMIN', 'APPROVER');
  const [reason, setReason] = useState('');
  const [acting, setActing] = useState(false);
  const [error, setError] = useState('');

  if (!isLeader || !CMS_CANCELLABLE_STATUSES.has(loan.status)) return null;

  const hasInvestorFunds = Number(loan.fundedAmount ?? 0) > 0 || loan.status === 'FUNDED' || loan.status === 'AWAITING_DISBURSEMENT';

  const handleCancel = async () => {
    const finalReason = reason.trim();
    if (finalReason.length < 3) {
      setError('Nhập lý do hủy khoản gọi vốn.');
      return;
    }
    const confirmMessage = hasInvestorFunds
      ? 'Khoản này đã có nhà đầu tư cam kết. Hệ thống sẽ hủy khoản, hoàn tiền và void hợp đồng liên quan. Xác nhận hủy?'
      : 'Xác nhận hủy khoản gọi vốn này?';
    if (!window.confirm(confirmMessage)) return;

    setActing(true);
    setError('');
    try {
      await cancelLoan(loan.loanId, finalReason);
      onActionDone();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không thể hủy khoản gọi vốn. Vui lòng thử lại.';
      setError(msg);
      setActing(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-red-200 dark:border-red-900/50 shadow-sm p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Ban size={16} className="text-red-500" />
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Hủy khoản gọi vốn</p>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Chỉ hủy được trước khi người gọi vốn nhận vốn. Nếu đã có nhà đầu tư cam kết, hệ thống sẽ hoàn tiền và void hợp đồng liên quan.
      </p>
      <label className="block text-xs text-gray-500 dark:text-gray-400">
        Lý do hủy
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-red-500"
        />
      </label>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
      )}
      <button
        onClick={handleCancel}
        disabled={acting}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium disabled:opacity-50"
      >
        <X size={15} />
        {acting ? 'Đang hủy...' : 'Hủy khoản gọi vốn'}
      </button>
    </div>
  );
}

function DisbursementPanel({ loan, onActionDone }: { loan: CmsLoan; onActionDone: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [acting, setActing]         = useState(false);
  const [error, setError]           = useState('');

  const admin = getStoredAdmin();
  const isLeader = adminHasAnyRole(admin, 'SUPER_ADMIN', 'ADMIN', 'APPROVER') || adminHasPermission(admin, 'loan.disburse');

  if (loan.status !== 'AWAITING_DISBURSEMENT') return null;
  if (!isLeader) return null;

  const handleDisburse = async () => {
    setActing(true);
    setError('');
    try {
      await disburseLoan(loan.loanId);
      onActionDone();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không thể giải ngân. Vui lòng thử lại.';
      setError(msg);
      setActing(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-orange-200 dark:border-orange-900/50 shadow-sm p-5 space-y-3">
      <div className="flex items-center gap-2">
        <CircleDollarSign size={16} className="text-orange-500" />
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Giải ngân vốn cho người gọi vốn</p>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Người gọi vốn đã ký hợp đồng vay. Bấm <span className="font-semibold">Giải ngân</span> để chuyển vốn
        và sinh lịch thanh toán tính từ ngày giải ngân. Thao tác này không thể hoàn tác.
      </p>

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
      )}

      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium"
        >
          <CircleDollarSign size={15} />
          Giải ngân
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={handleDisburse}
            disabled={acting}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {acting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            Xác nhận giải ngân
          </button>
          <button
            onClick={() => setConfirming(false)}
            disabled={acting}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-medium disabled:opacity-50"
          >
            Huỷ
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Business appraisal section ──────────────────────────────────────────────

const BUSINESS_APPRAISAL_CATEGORIES = new Set([
  'BUSINESS_PROFILE',
  'BUSINESS_CASHFLOW',
  'BUSINESS_PURPOSE',
  'BUSINESS_SITE',
  'CREDIT_HISTORY',
]);

const BUSINESS_APPRAISAL_STATUS: Array<{ value: BusinessAppraisalStatus; label: string; cls: string }> = [
  { value: 'PENDING', label: 'Chưa kiểm tra', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
  { value: 'PASS', label: 'Đạt', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  { value: 'FAIL', label: 'Không đạt', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  { value: 'NEEDS_INFO', label: 'Cần bổ sung', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  { value: 'NA', label: 'Không áp dụng', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
];

type BusinessAppraisalDraft = {
  status: BusinessAppraisalStatus;
  note: string;
  evidenceRefs: string;
};

function isBusinessChecklistItem(item: Pick<AppraisalChecklistItem, 'category'>): boolean {
  return BUSINESS_APPRAISAL_CATEGORIES.has(item.category);
}

function BusinessAppraisalSection({ loan }: { loan: CmsLoan }) {
  const loanId = loan.loanId;
  const [sourceItems, setSourceItems] = useState<AppraisalChecklistItem[]>([]);
  const [savedItems, setSavedItems] = useState<Record<string, BusinessAppraisalChecklistRecord>>({});
  const [drafts, setDrafts] = useState<Record<string, BusinessAppraisalDraft>>({});
  const [loading, setLoading] = useState(true);
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([
      fetchAppraisalSuggestion(loanId, false, null).catch(() => null),
      fetchBusinessAppraisalChecklist(loanId),
    ])
      .then(([suggestion, saved]) => {
        if (cancelled) return;
        const businessItems = (suggestion?.manualChecklist ?? []).filter(isBusinessChecklistItem);
        const savedMap = Object.fromEntries(saved.map(item => [item.checklistCode, item]));
        setSourceItems(businessItems);
        setSavedItems(savedMap);

        const nextDrafts: Record<string, BusinessAppraisalDraft> = {};
        const codes = new Set([
          ...businessItems.map(item => item.code),
          ...saved.map(item => item.checklistCode),
        ]);
        codes.forEach(code => {
          const record = savedMap[code];
          nextDrafts[code] = {
            status: record?.status ?? 'PENDING',
            note: record?.note ?? '',
            evidenceRefs: record?.evidenceRefs ?? '',
          };
        });
        setDrafts(nextDrafts);
      })
      .catch(e => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Không tải được checklist thẩm định HKD/DN');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [loanId, tick]);

  const mergedItems: AppraisalChecklistItem[] = (() => {
    const byCode = new Map<string, AppraisalChecklistItem>();
    sourceItems.forEach(item => byCode.set(item.code, item));
    Object.values(savedItems).forEach(item => {
      if (!byCode.has(item.checklistCode)) {
        byCode.set(item.checklistCode, {
          code: item.checklistCode,
          category: item.category,
          title: item.title,
          instruction: item.instruction ?? '',
          required: item.required,
        });
      }
    });
    return Array.from(byCode.values());
  })();

  if (!loading && !error && mergedItems.length === 0) {
    return null;
  }

  const summary = mergedItems.reduce<Record<BusinessAppraisalStatus, number>>((acc, item) => {
    const status = drafts[item.code]?.status ?? savedItems[item.code]?.status ?? 'PENDING';
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, { PENDING: 0, PASS: 0, FAIL: 0, NEEDS_INFO: 0, NA: 0 });

  const updateDraft = (code: string, patch: Partial<BusinessAppraisalDraft>) => {
    setDrafts(prev => ({
      ...prev,
      [code]: {
        status: prev[code]?.status ?? 'PENDING',
        note: prev[code]?.note ?? '',
        evidenceRefs: prev[code]?.evidenceRefs ?? '',
        ...patch,
      },
    }));
  };

  const saveItem = async (item: AppraisalChecklistItem) => {
    const draft = drafts[item.code] ?? { status: 'PENDING' as BusinessAppraisalStatus, note: '', evidenceRefs: '' };
    setSavingCode(item.code);
    setError('');
    try {
      const saved = await saveBusinessAppraisalChecklist(loanId, item.code, {
        category: item.category,
        title: item.title,
        instruction: item.instruction,
        required: item.required,
        status: draft.status,
        note: draft.note.trim() || null,
        evidenceRefs: draft.evidenceRefs.trim() || null,
      });
      setSavedItems(prev => ({ ...prev, [item.code]: saved }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không lưu được checklist thẩm định HKD/DN');
    } finally {
      setSavingCode(null);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-red-500">
            <Landmark size={15} />Thẩm định HKD/DN
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Checklist riêng cho hồ sơ gọi vốn hộ kinh doanh/doanh nghiệp: ghi kết quả kiểm tra, ghi chú và fileId/link ảnh thực địa hoặc tài liệu bổ sung.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setTick(v => v + 1)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />Tải lại
        </button>
      </div>

      {loading && (
        <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">
          <RefreshCw size={16} className="animate-spin inline mr-2" />Đang tải checklist HKD/DN...
        </p>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}

      {!loading && mergedItems.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2">
            {BUSINESS_APPRAISAL_STATUS.map(status => (
              <span key={status.value} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status.cls}`}>
                {status.label}: {summary[status.value] ?? 0}
              </span>
            ))}
          </div>

          <div className="space-y-3">
            {mergedItems.map(item => {
              const draft = drafts[item.code] ?? {
                status: savedItems[item.code]?.status ?? 'PENDING',
                note: savedItems[item.code]?.note ?? '',
                evidenceRefs: savedItems[item.code]?.evidenceRefs ?? '',
              };
              const saved = savedItems[item.code];
              return (
                <div key={item.code} className="rounded-xl border border-gray-100 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-gray-800/40">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                          {CATEGORY_LABEL[item.category] ?? item.category}
                        </span>
                        {item.required && <span className="text-[10px] font-medium text-red-500">* bắt buộc</span>}
                      </div>
                      <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{item.title}</p>
                      <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">{item.instruction}</p>
                    </div>
                    <select
                      value={draft.status}
                      onChange={e => updateDraft(item.code, { status: e.target.value as BusinessAppraisalStatus })}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-red-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                    >
                      {BUSINESS_APPRAISAL_STATUS.map(status => (
                        <option key={status.value} value={status.value}>{status.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <label className="block">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Ghi chú/kết quả kiểm tra</span>
                      <textarea
                        value={draft.note}
                        onChange={e => updateDraft(item.code, { note: e.target.value })}
                        rows={3}
                        placeholder="VD: Đã gọi xác minh, đối chiếu sao kê 3 tháng, cần bổ sung biên lai thuế..."
                        className="mt-1 w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-red-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Ảnh thực địa/file bổ sung</span>
                      <textarea
                        value={draft.evidenceRefs}
                        onChange={e => updateDraft(item.code, { evidenceRefs: e.target.value })}
                        rows={3}
                        placeholder="Dán fileId, link ảnh, link drive hoặc mã biên bản. Mỗi dòng một bằng chứng."
                        className="mt-1 w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-red-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
                      />
                    </label>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-[11px] text-gray-400 dark:text-gray-500">
                      {saved?.updatedBy
                        ? `Lưu bởi ${saved.updatedBy}${saved.updatedAt ? ` · ${formatVietnamDateTime(saved.updatedAt)}` : ''}`
                        : 'Chưa lưu kết quả thẩm định.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => saveItem(item)}
                      disabled={savingCode === item.code}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
                    >
                      {savingCode === item.code ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                      Lưu mục này
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function LoanDetailPage({ loan, onBack, onActionDone, onViewCustomer }: { loan: CmsLoan; onBack: () => void; onActionDone: () => void; onViewCustomer?: (userId: string) => void }) {
  // Kết quả chấm điểm AI dùng chung cho khối Điểm tín dụng và panel Hỗ trợ thẩm định
  const [creditScore, setCreditScore] = useState<CreditScoreResult | null>(null);
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
        >
          <ArrowLeft size={16} />
          Quay lại danh sách
        </button>
      </div>

      <div className="flex items-center gap-3">
        <span className="font-mono font-bold text-gray-900 dark:text-white text-xl">
          {loan.loanCode ?? shortId(loan.loanId)}
        </span>
        <Badge value={loan.status === 'ACTIVE' ? 'loan_active' : loan.status} />
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Người gọi vốn */}
        <Section title="Người gọi vốn">
          <DetailRow
            label="Họ tên"
            value={
              loan.borrowerId && onViewCustomer ? (
                <button
                  onClick={() => onViewCustomer(loan.borrowerId)}
                  title="Xem hồ sơ khách hàng"
                  className="inline-flex items-center gap-1 font-semibold text-red-600 dark:text-red-400 hover:underline"
                >
                  {loan.borrowerName ?? loan.borrowerPhone ?? shortId(loan.borrowerId)}
                  <ExternalLink size={12} className="shrink-0" />
                </button>
              ) : (loan.borrowerName ?? '—')
            }
          />
          <DetailRow label="Số điện thoại" value={loan.borrowerPhone ?? '—'} />
          <DetailRow label="Email" value={loan.borrowerEmail ?? '—'} />
          <DetailRow label="Số CCCD" value={loan.borrowerCccdNumber ?? '—'} />
          <DetailRow label="Trạng thái KYC" value={<Badge value={loan.borrowerKycStatus ?? 'NONE'} />} />
          <DetailRow label="Trạng thái tài khoản" value={loan.borrowerAccountStatus ?? '—'} />
          <DetailRow label="Ngày sinh" value={loan.borrowerDateOfBirth ? formatVietnamDate(loan.borrowerDateOfBirth) : '—'} />
          <DetailRow label="Giới tính" value={loan.borrowerGender ?? '—'} />
          <DetailRow label="Địa chỉ thường trú" value={loan.borrowerPermanentAddress ?? '—'} />
          <DetailRow label="Quê quán" value={loan.borrowerHometown ?? '—'} />
          <DetailRow label="Ngày cấp CCCD" value={loan.borrowerIssueDate ? formatVietnamDate(loan.borrowerIssueDate) : '—'} />
          <DetailRow label="Nơi cấp CCCD" value={loan.borrowerIssuingAuthority ?? '—'} />
          <DetailRow label="Ngày hết hạn CCCD" value={loan.borrowerExpiryDate ? formatVietnamDate(loan.borrowerExpiryDate) : '—'} />
          {loan.currentAddress && (
            <DetailRow
              label="Địa chỉ nơi ở hiện tại"
              value={[loan.currentAddress, loan.commune, loan.province].filter(Boolean).join(', ')}
            />
          )}
          <DetailRow
            label="Mã khách hàng"
            value={<span className="font-mono text-gray-400 dark:text-gray-500">{shortId(loan.borrowerId)}</span>}
          />
        </Section>

        {/* Khoản gọi vốn */}
        <Section title="Khoản gọi vốn">
          {loan.productName && <DetailRow label="Sản phẩm" value={loan.productName} />}
          <DetailRow label="Số tiền" value={formatMoney(loan.amount)} />
          <DetailRow
            label="Lãi suất đề nghị"
            value={
              loan.interestRate != null
                ? `${loan.interestRate}%/năm`
                : <span className="text-gray-300 dark:text-gray-600">Chưa thẩm định</span>
            }
          />
          <DetailRow label="Kỳ hạn" value={`${loan.termMonths} tháng`} />
          {loan.repaymentDay != null && (
            <DetailRow label="Ngày trả hàng tháng" value={`Ngày ${loan.repaymentDay} hàng tháng`} />
          )}
          {loan.purpose && <DetailRow label="Mục đích" value={loan.purpose} />}
        </Section>

        {/* Thông tin bổ sung */}
        {(loan.occupation || loan.workplace || loan.monthlyIncome != null || loan.ref1FullName || loan.ref2FullName) && (
          <Section title="Thông tin bổ sung">
            {loan.occupation && <DetailRow label="Nghề nghiệp" value={loan.occupation} />}
            {loan.workplace && <DetailRow label="Tên cơ sở/nơi làm việc" value={loan.workplace} />}
            <DetailRow label="Địa chỉ nơi làm việc" value={loan.workplaceAddress ?? 'Chưa có'} />
            {loan.monthlyIncome != null && (
              <DetailRow label="Thu nhập/tháng" value={formatMoney(loan.monthlyIncome)} />
            )}
            {(loan.ref1FullName || loan.ref1Phone || loan.ref1Relationship || loan.ref1Address) && (
              <div className="mt-4 rounded-lg bg-gray-50 p-3 dark:bg-gray-800/70">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Người tham chiếu 1</p>
                <DetailRow label="Họ tên" value={loan.ref1FullName ?? '—'} />
                <DetailRow label="Quan hệ" value={loan.ref1Relationship ?? '—'} />
                <DetailRow label="Số điện thoại" value={loan.ref1Phone ?? '—'} />
                <DetailRow label="Địa chỉ" value={loan.ref1Address ?? '—'} />
              </div>
            )}
            {(loan.ref2FullName || loan.ref2Phone || loan.ref2Relationship || loan.ref2Address) && (
              <div className="mt-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-800/70">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Người tham chiếu 2</p>
                <DetailRow label="Họ tên" value={loan.ref2FullName ?? '—'} />
                <DetailRow label="Quan hệ" value={loan.ref2Relationship ?? '—'} />
                <DetailRow label="Số điện thoại" value={loan.ref2Phone ?? '—'} />
                <DetailRow label="Địa chỉ" value={loan.ref2Address ?? '—'} />
              </div>
            )}
          </Section>
        )}

        {/* Tiến độ gọi vốn & Nhà đầu tư */}
        {FUNDING_VISIBLE_STATUSES.includes(loan.status) && (
          <div className="lg:col-span-2">
            <FundingProgressSection loan={loan} onViewCustomer={onViewCustomer} />
          </div>
        )}

        {/* Ảnh định danh */}
        <div className="lg:col-span-2">
          <Section title="Ảnh định danh eKYC">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <KycImageCard title="CCCD mặt trước" fileId={loan.borrowerFrontImageId} />
              <KycImageCard title="CCCD mặt sau" fileId={loan.borrowerBackImageId} />
              <KycImageCard title="Ảnh chân dung" fileId={loan.borrowerPortraitImageId} portrait />
            </div>
          </Section>
        </div>

        {/* Thẩm định */}
        {(loan.reviewedBy || loan.reviewedAt || loan.rejectionReason) && (
          <Section title="Thẩm định">
            {loan.reviewedBy && <DetailRow label={loan.rejectionReason ? 'Người từ chối' : 'Người thẩm định'} value={loan.reviewedBy} />}
            {loan.reviewedAt && <DetailRow label={loan.rejectionReason ? 'Thời gian từ chối' : 'Ngày thẩm định'} value={formatVietnamDateTime(loan.reviewedAt)} />}
            {loan.rejectionReason && (
              <DetailRow
                label="Lý do từ chối"
                value={<span className="text-red-500">{loan.rejectionReason}</span>}
              />
            )}
          </Section>
        )}

        {/* Phí giải ngân — chỉ hiện sau khi đã giải ngân */}
        {loan.totalFee != null && loan.totalFee > 0 && (
          <Section title="Phí giải ngân">
            {loan.appraisalFee != null && (
              <DetailRow
                label={loan.appraisalFeeRate != null && loan.appraisalFeeRate > 0 ? `Phí thẩm định hồ sơ (${loan.appraisalFeeRate}%)` : 'Phí thẩm định hồ sơ'}
                value={formatMoney(loan.appraisalFee)}
              />
            )}
            {loan.vatAmount != null && (
              <DetailRow label="VAT (10%)" value={formatMoney(loan.vatAmount)} />
            )}
            <DetailRow
              label="Tổng phí khấu trừ"
              value={<span className="text-red-600 dark:text-red-400 font-semibold">− {formatMoney(loan.totalFee)}</span>}
            />
            {loan.netDisbursement != null && (
              <DetailRow
                label="Số tiền thực nhận"
                value={<span className="text-green-600 dark:text-green-400 font-bold">{formatMoney(loan.netDisbursement)}</span>}
              />
            )}
          </Section>
        )}

        {/* Thời gian */}
        <Section title="Thời gian">
          <DetailRow label="Ngày tạo" value={formatVietnamDateTime(loan.createdAt)} />
          {loan.disbursedAt && (
            <DetailRow label="Ngày giải ngân" value={formatVietnamDateTime(loan.disbursedAt)} />
          )}
        </Section>
      </div>

      {/* Chứng từ + điểm tín dụng + hỗ trợ thẩm định */}
      <LoanDocumentsSection loan={loan} />
      <CreditScoreSection loan={loan} score={creditScore} onScore={setCreditScore} />
      <BusinessAppraisalSection loan={loan} />
      <AppraisalPanel loan={loan} creditScore={creditScore} onActionDone={onActionDone} />

      {/* Giải ngân — chỉ hiện khi khoản ở trạng thái chờ giải ngân */}
      <DisbursementPanel loan={loan} onActionDone={onActionDone} />

      {/* Hủy trước khi người gọi vốn nhận vốn */}
      <LoanCancelPanel loan={loan} onActionDone={onActionDone} />

      {/* Hợp đồng điện tử (vay + đầu tư) */}
      <ContractsSection loanId={loan.loanId} />

      {/* Lịch thanh toán — hiển thị cho mọi trạng thái (tự ẩn nếu chưa có lịch) */}
      <RepaymentScheduleSection loanId={loan.loanId} loanStatus={loan.status} />

      {/* Báo giá tất toán sớm — chỉ xem, tự ẩn nếu khoản chưa giải ngân/đã hoàn tất */}
      <EarlySettlementQuoteSection loanId={loan.loanId} loanStatus={loan.status} />
    </div>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

// 34 tỉnh/thành phố chính thức theo NQ 202/2025/QH15 — dùng cho filter CMS
const VN_PROVINCES_2025 = [
  'An Giang', 'Bắc Ninh', 'Cà Mau', 'Cao Bằng', 'Cần Thơ',
  'Đà Nẵng', 'Đắk Lắk', 'Điện Biên', 'Đồng Nai', 'Đồng Tháp',
  'Gia Lai', 'Hà Nội', 'Hà Tĩnh', 'Hải Phòng', 'Hồ Chí Minh',
  'Huế', 'Hưng Yên', 'Khánh Hòa', 'Lai Châu', 'Lạng Sơn',
  'Lào Cai', 'Lâm Đồng', 'Nghệ An', 'Ninh Bình', 'Phú Thọ',
  'Quảng Ngãi', 'Quảng Ninh', 'Quảng Trị', 'Sơn La', 'Tây Ninh',
  'Thái Nguyên', 'Thanh Hóa', 'Tuyên Quang', 'Vĩnh Long',
];

// ─── List Page ────────────────────────────────────────────────────────────────

interface LoansPageProps {
  status: LoanStatusFilter;
  /** ID khoản đang mở chi tiết (do App quản lý qua lịch sử điều hướng). null = xem danh sách. */
  selectedLoanId?: string | null;
  /** Lọc theo loại sản phẩm. Dùng cho màn quản lý gọi vốn HKD/DN. */
  productCategories?: string[];
  /** Hiện bộ lọc trạng thái ngay trong trang thay vì dùng submenu sidebar. */
  showStatusFilter?: boolean;
  title?: string;
  /** Mở/điều hướng tới 1 khoản (đẩy vào lịch sử). Dùng cho click bảng lẫn link chéo trong chi tiết. */
  onViewLoan?: (loanId: string) => void;
  /** Đóng chi tiết khoản — App dùng Back của lịch sử để về đúng nơi đã mở. */
  onCloseLoan?: () => void;
  /** Điều hướng tới chi tiết 1 khách hàng (người gọi vốn / nhà đầu tư). */
  onViewCustomer?: (userId: string) => void;
  onActionDone?: () => void;
}

export function LoansPage({
  status,
  selectedLoanId = null,
  productCategories,
  showStatusFilter = false,
  title,
  onViewLoan,
  onCloseLoan,
  onViewCustomer,
  onActionDone,
}: LoansPageProps) {
  const [data, setData] = useState<{ content: CmsLoan[]; totalElements: number; totalPages: number } | null>(null);
  const [localStatus, setLocalStatus] = useState<LoanStatusFilter>('');
  const [province, setProvince] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage]       = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [refresh, setRefresh] = useState(0);
  // Object khoản đang mở — resolve từ selectedLoanId (ưu tiên danh sách đã tải, else fetch riêng).
  const [loanCache, setLoanCache] = useState<CmsLoan | null>(null);
  const [resolveError, setResolveError] = useState('');

  const admin = getStoredAdmin();
  const isLeader = adminHasAnyRole(admin, 'SUPER_ADMIN', 'ADMIN', 'APPROVER');
  const [sweeping, setSweeping] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [sweepMsg, setSweepMsg] = useState('');
  const [sweepError, setSweepError] = useState(false);
  const effectiveStatus = showStatusFilter ? localStatus : status;

  const handleExpireSweep = async () => {
    if (!window.confirm(
      'Chạy job hết hạn ngay?\n\nCác khoản ACTIVE quá hạn gọi vốn và FUNDED quá hạn ký khế ước sẽ bị HỦY và HOÀN TIỀN cho nhà đầu tư.'
    )) return;
    setSweeping(true);
    setSweepMsg('');
    setSweepError(false);
    try {
      const r = await runFundingExpirySweep();
      const failed = r.activeFailed + r.fundedFailed;
      setSweepMsg(
        `Đã xử lý: ${r.activeExpired} khoản hết hạn gọi vốn, ${r.fundedStuck} khoản hết hạn ký khế ước.`
        + (failed > 0 ? ` (${failed} khoản lỗi — kiểm tra log loan-service)` : '')
      );
      setRefresh(x => x + 1);
      onActionDone?.();
    } catch (e) {
      setSweepError(true);
      setSweepMsg('Không chạy được job hết hạn: ' + (e as Error).message);
    } finally {
      setSweeping(false);
    }
  };

  const handleAutoDebitSweep = async () => {
    if (!window.confirm(
      'Chạy thu nợ tự động ngay?\n\nHệ thống sẽ kiểm tra các kỳ đến hạn/quá hạn và trừ ví người gọi vốn nếu có số dư khả dụng. Các kỳ đã thanh toán sẽ được bỏ qua.'
    )) return;
    setCollecting(true);
    setSweepMsg('');
    setSweepError(false);
    try {
      const r = await runAutoDebitSweep();
      setSweepMsg(
        `Thu nợ xong: quét ${r.scannedLoans} khoản, ${r.dueLoans} khoản đến hạn, `
        + `thu đủ ${r.settledFull}, thu một phần ${r.settledPartial}, `
        + `không đủ tiền ${r.noBalance}, lỗi ${r.failed + r.balanceError}. `
        + `Tổng thu ${formatMoney(r.amountCollected)}.`
      );
      setRefresh(x => x + 1);
      onActionDone?.();
    } catch (e) {
      setSweepError(true);
      setSweepMsg('Không chạy được thu nợ tự động: ' + (e as Error).message);
    } finally {
      setCollecting(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(0);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    setError('');
    fetchLoans({
      status: effectiveStatus || undefined,
      province: province || undefined,
      search: debouncedSearch || undefined,
      productCategories,
      page,
      size: 20,
    })
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [effectiveStatus, province, debouncedSearch, page, refresh, productCategories]);

  // Resolve object khoản đang mở: ưu tiên khoản đã có trong danh sách (click từ bảng),
  // nếu không có (điều hướng chéo từ màn khác) thì fetch riêng theo id.
  useEffect(() => {
    if (!selectedLoanId) { setResolveError(''); return; }
    if (loanCache?.loanId === selectedLoanId) return;
    const inList = data?.content.find(l => l.loanId === selectedLoanId);
    if (inList) { setLoanCache(inList); setResolveError(''); return; }
    let alive = true;
    setResolveError('');
    fetchLoanById(selectedLoanId)
      .then(loan => {
        if (!alive) return;
        if (loan) setLoanCache(loan);
        else setResolveError('Không tìm thấy khoản gọi vốn này.');
      })
      .catch((e: Error) => { if (alive) setResolveError(e.message); });
    return () => { alive = false; };
  }, [selectedLoanId, data, loanCache]);

  if (selectedLoanId) {
    if (loanCache && loanCache.loanId === selectedLoanId) {
      return (
        <LoanDetailPage
          loan={loanCache}
          onBack={() => onCloseLoan?.()}
          onActionDone={() => { onCloseLoan?.(); setRefresh(r => r + 1); onActionDone?.(); }}
          onViewCustomer={onViewCustomer}
        />
      );
    }
    return (
      <div className="space-y-4">
        <button
          onClick={() => onCloseLoan?.()}
          className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
        >
          <ArrowLeft size={16} />
          Quay lại
        </button>
        <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-8 text-center text-sm text-gray-500 dark:text-gray-400">
          {resolveError
            ? resolveError
            : <><RefreshCw size={18} className="mr-2 inline animate-spin" />Đang tải chi tiết khoản gọi vốn...</>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {title && (
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-gray-100">
              <Building2 size={19} className="text-red-500" />
              {title}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Quản lý riêng các khoản gọi vốn thuộc sản phẩm Hộ kinh doanh và Doanh nghiệp.
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 flex flex-wrap gap-3 items-center">
        <div className="relative min-w-[280px] flex-1 sm:flex-none">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm mã khoản, sản phẩm, mục đích..."
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 py-2 pl-9 pr-9 text-sm text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-red-500"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
              title="Xóa tìm kiếm"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {showStatusFilter && (
          <select
            value={localStatus}
            onChange={e => { setLocalStatus(e.target.value as LoanStatusFilter); setPage(0); }}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-red-500"
          >
            {LOAN_STATUS_OPTIONS.map(item => (
              <option key={item.value || 'all'} value={item.value}>{item.label}</option>
            ))}
          </select>
        )}

        {/* Tỉnh / Thành phố */}
        <select
          value={province}
          onChange={e => { setProvince(e.target.value); setPage(0); }}
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-red-500"
        >
          <option value="">Tất cả tỉnh/TP</option>
          {VN_PROVINCES_2025.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        {isLeader && (
          <button
            onClick={handleExpireSweep}
            disabled={sweeping}
            title="Hủy & hoàn tiền các khoản quá hạn gọi vốn / ký khế ước (thay vì chờ job tự động 01:30)"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 text-sm font-medium hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-50"
          >
            <Hourglass size={15} className={sweeping ? 'animate-spin' : ''} />
            {sweeping ? 'Đang chạy...' : 'Chạy hết hạn'}
          </button>
        )}

        {isLeader && (
          <button
            onClick={handleAutoDebitSweep}
            disabled={collecting}
            title="Quét các kỳ đến hạn/quá hạn và trừ ví người gọi vốn nếu có số dư khả dụng"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 text-sm font-medium hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-50"
          >
            <HandCoins size={15} className={collecting ? 'animate-pulse' : ''} />
            {collecting ? 'Đang thu...' : 'Thu nợ ngay'}
          </button>
        )}

        <button onClick={() => setRefresh(r => r + 1)} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
        {data && (
          <span className="text-sm text-gray-400 dark:text-gray-500 ml-auto">
            {loanStatusLabel(effectiveStatus)} · {data.totalElements} khoản{title ? ' doanh nghiệp' : ''}
            {province ? ` tại ${province}` : ''}
            {debouncedSearch ? ` · "${debouncedSearch}"` : ''}
          </span>
        )}
      </div>

      {/* Kết quả chạy job vận hành */}
      {sweepMsg && (
        <div className={`rounded-lg border px-4 py-2.5 text-sm flex items-center justify-between gap-3 ${
          sweepError
            ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
            : 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200'
        }`}>
          <span>{sweepMsg}</span>
          <button onClick={() => setSweepMsg('')} className="shrink-0 opacity-60 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {error && <p className="text-red-600 text-sm px-6 py-4 bg-red-50 dark:bg-red-900/20">{error}</p>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] table-fixed text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <th className="text-center px-5 py-3.5">Mã khoản</th>
                <th className="text-center px-4 py-3.5">Người gọi vốn</th>
                <th className="text-center px-4 py-3.5">Sản phẩm</th>
                <th className="text-center px-4 py-3.5">Số tiền</th>
                <th className="text-center px-4 py-3.5">Lãi suất</th>
                <th className="text-center px-4 py-3.5">Kỳ hạn</th>
                <th className="text-center px-4 py-3.5">Trạng thái</th>
                <th className="text-center px-4 py-3.5">Ngày tạo</th>
                <th className="text-center px-4 py-3.5">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {loading && !data && (
                <tr>
                  <td colSpan={9} className="px-5 py-8 text-center text-gray-400 dark:text-gray-500">
                    <RefreshCw size={18} className="animate-spin inline mr-2" />Đang tải...
                  </td>
                </tr>
              )}
              {data?.content.map(loan => (
                <tr key={loan.loanId} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-5 py-3.5 text-center align-middle">
                    <p className="font-semibold text-gray-900 dark:text-white text-xs font-mono tracking-wide">
                      {loan.loanCode ?? shortId(loan.loanId)}
                    </p>
                  </td>
                  <td className="px-4 py-3.5 text-center align-middle">
                    <TruncatedText
                      value={loan.borrowerName ?? shortId(loan.borrowerId)}
                      className="mx-auto max-w-[160px] font-medium text-gray-800 dark:text-gray-200 text-xs"
                    />
                    {loan.borrowerPhone && (
                      <TruncatedText
                        value={loan.borrowerPhone}
                        className="mx-auto mt-1 max-w-[160px] font-mono text-[11px] text-gray-400 dark:text-gray-500"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-center align-middle">
                    <TruncatedText
                      value={loan.productName ?? 'Chưa xác định'}
                      className="mx-auto max-w-[180px] text-gray-600 dark:text-gray-400 text-xs"
                    />
                    {loan.productCategory && loan.productCategory !== 'INDIVIDUAL' && (
                      <span className="mt-1 inline-flex rounded-full bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                        {PRODUCT_CATEGORY_LABEL[loan.productCategory] ?? loan.productCategory}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-center font-semibold text-gray-800 dark:text-gray-200 align-middle text-xs whitespace-nowrap">
                    {formatMoney(loan.amount)}
                  </td>
                  <td className="px-4 py-3.5 text-center text-gray-600 dark:text-gray-400 align-middle text-xs">
                    {loan.interestRate != null
                      ? <span className="font-medium">{loan.interestRate}%</span>
                      : <span className="text-gray-300 dark:text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-center text-gray-600 dark:text-gray-400 align-middle text-xs">
                    {loan.termMonths} tháng
                  </td>
                  <td className="px-4 py-3.5 text-center align-middle">
                    <Badge value={loan.status === 'ACTIVE' ? 'loan_active' : loan.status} />
                  </td>
                  <td className="px-4 py-3.5 text-center text-gray-400 dark:text-gray-500 text-xs align-middle">
                    {formatVietnamDateTime(loan.createdAt)}
                  </td>
                  <td className="px-4 py-3.5 text-center align-middle">
                    <button
                      onClick={() => onViewLoan?.(loan.loanId)}
                      title="Xem chi tiết"
                      className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                    >
                      <Eye size={15} />
                    </button>
                  </td>
                </tr>
              ))}
              {data?.content.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-8 text-center text-gray-400 dark:text-gray-500">
                    Không có khoản gọi vốn nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="px-5 py-3.5 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>Tổng {data.totalElements} khoản gọi vốn</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="px-2">Trang {page + 1} / {data.totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(data.totalPages - 1, p + 1))}
                disabled={page >= data.totalPages - 1}
                className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
