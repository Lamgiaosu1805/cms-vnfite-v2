import { useEffect, useState } from 'react';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Eye, RefreshCw,
  Sparkles, AlertTriangle, ClipboardList, Gauge, Wallet, CircleDollarSign,
  Send, Check, X, ShieldCheck, Search, FileText, Download, Brain, ExternalLink,
  TrendingDown, TrendingUp, Lightbulb, PlusCircle, FileSearch,
} from 'lucide-react';
import {
  fetchLoans, fetchAppraisalSuggestion, fetchRepaymentSchedule,
  proposeLoan, approveLoan, rejectLoan, getStoredAdmin,
  fetchLoanContracts, disburseLoan, fetchLoanDocuments, evaluateLoanCreditScore,
  type CmsLoan, type AppraisalSuggestion, type RecommendedDecision,
  type FactorImpact, type RepaymentScheduleItem, type LoanContract,
  type LoanDocument, type CreditScoreResult, type DocumentAnalysisResult,
  type ScoreExplanation,
} from '../api/client';
import { Badge } from '../components/Badge';
import {
  loanStatusLabel, type LoanStatusFilter,
  CONTRACT_TYPE_LABEL, CONTRACT_STATUS_LABEL,
} from '../loanConstants';

function formatMoney(value: number | string | undefined | null) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDate(s: string | null | undefined) {
  if (!s) return '-';
  return new Date(s).toLocaleDateString('vi-VN');
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

// ─── Appraisal support panel ────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<string, string> = {
  IDENTITY: 'Định danh', INCOME: 'Thu nhập', EMPLOYMENT: 'Nghề nghiệp',
  REFERENCE: 'Tham chiếu', PURPOSE: 'Mục đích', DOCUMENT: 'Chứng từ', FRAUD: 'Gian lận',
};

const METHOD_LABEL: Record<string, string> = {
  EMI_MONTHLY: 'Gốc + lãi đều hàng tháng',
  INTEREST_MONTHLY_PRINCIPAL_QUARTERLY: 'Lãi tháng · gốc theo quý',
};

function bandTone(band: string): string {
  const c = (band || '')[0];
  if (c === 'A') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
  if (c === 'B') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
}

function decisionMeta(d: RecommendedDecision): { label: string; cls: string } {
  if (d === 'APPROVE') return { label: 'Nghiêng DUYỆT', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' };
  if (d === 'REVIEW') return { label: 'CẦN THẨM ĐỊNH KỸ', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' };
  return { label: 'Nghiêng TỪ CHỐI', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' };
}

function impactTone(impact: FactorImpact): string {
  if (impact === 'POSITIVE') return 'text-green-600 dark:text-green-400';
  if (impact === 'NEGATIVE') return 'text-red-600 dark:text-red-400';
  return 'text-gray-400 dark:text-gray-500';
}

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

const FILE_MANAGER_BASE = 'https://service.vnfite.com.vn/file-manager/v2/file';

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
  DEMOGRAPHIC: 'Nhân khẩu học',
  INCOME: 'Thu nhập',
  CREDIT_HISTORY: 'Lịch sử tín dụng',
  PLATFORM: 'Nền tảng VNFITE',
  LOAN: 'Khoản gọi vốn',
};

function creditGradeTone(grade: string): string {
  if (grade === 'A') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
  if (grade === 'B') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
  if (grade === 'C') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  if (grade === 'D') return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
  return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
}

function creditBarColor(grade: string): string {
  if (grade === 'A') return 'bg-green-500';
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

function CreditScoreSection({ loan, score, onScore }: {
  loan: CmsLoan;
  score: CreditScoreResult | null;
  onScore: (score: CreditScoreResult) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
        <button onClick={runEvaluate} disabled={loading} className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-medium disabled:opacity-50">
          {loading ? <RefreshCw size={13} className="animate-spin" /> : <Gauge size={13} />}
          Chấm điểm tín dụng
        </button>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
      {!score && !error && !loading && <p className="text-sm text-gray-500 dark:text-gray-400">Bấm chấm điểm để lấy score 300-850 từ credit-service — AI sẽ tự phân tích toàn bộ chứng từ đính kèm và gộp vào đánh giá. Kết quả chỉ hỗ trợ thẩm định, không tự động duyệt hoặc từ chối khoản gọi vốn.</p>}
      {loading && <p className="text-sm text-gray-500 dark:text-gray-400">Đang chấm điểm và AI phân tích chứng từ — có thể mất 1-2 phút nếu khoản có nhiều file...</p>}

      {score && (
        <div className="space-y-4">
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
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {score.explanation?.documents && !score.explanation.documents.aiEnabled
                  ? 'AI thẩm định chứng từ đang tắt trên máy chủ — vui lòng đối chiếu chứng từ thủ công ở khối "Chứng từ người gọi vốn".'
                  : (score.explanation?.documents?.summary ?? 'Chưa có kết quả AI thẩm định chứng từ. Nếu khối chứng từ bên dưới đã có file, hãy bấm chấm điểm lại hoặc kiểm tra log credit-service/file-manager.')}
              </p>
            )}
          </div>

          {grouped && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(grouped).map(([component, items]) => (
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

  const load = async () => {
    setLoading(true);
    setError('');
    try { setDocuments(await fetchLoanDocuments(loan.loanId)); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [loan.loanId]);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 space-y-4">
      <div className="flex items-center gap-2">
        <FileText size={16} className="text-red-500" />
        <p className="text-[10px] font-semibold uppercase tracking-widest text-red-500">Chứng từ người gọi vốn</p>
        <button onClick={load} className="ml-auto p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title="Tải lại"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
      {loading && !documents && <p className="text-sm text-gray-400 dark:text-gray-500">Đang tải chứng từ...</p>}
      {documents && documents.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">Người gọi vốn chưa bổ sung chứng từ tài chính/thu nhập.</p>}

      {documents && documents.length > 0 && (
        <div className="space-y-3">
          {documents.map(doc => {
            const fileUrl = FILE_MANAGER_BASE + '/' + doc.fileId;
            return (
              <div key={doc.id} className="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate" title={doc.fileName ?? doc.fileId}>{doc.fileName ?? doc.fileId}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{DOC_TYPE_LABEL[doc.docType] ?? doc.docType} · {doc.createdAt ? formatDate(doc.createdAt) : 'Chưa rõ ngày'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <a href={fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-900"><ExternalLink size={13} />Xem</a>
                    <a href={fileUrl} download className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-900"><Download size={13} />Tải</a>
                  </div>
                </div>
              </div>
            );
          })}
          <p className="text-[11px] text-gray-400 dark:text-gray-500 italic">AI thẩm định chứng từ chạy tự động khi bấm "Chấm điểm tín dụng" — kết quả hiển thị ở khối Điểm tín dụng tham khảo.</p>
        </div>
      )}
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

  // Phê duyệt 2 cấp
  const admin = getStoredAdmin();
  const isLeader = admin?.role === 'ADMIN' || admin?.role === 'SUPER_ADMIN';
  const [amountInput, setAmountInput] = useState('');
  const [rateInput, setRateInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [acting, setActing] = useState(false);
  const [actError, setActError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    fetchAppraisalSuggestion(loanId, discouraged)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [loanId, discouraged, tick]);

  // Prefill form: chờ thẩm định → gợi ý engine; chờ lãnh đạo → số đã đề xuất
  useEffect(() => {
    if (loan.status === 'PENDING_REVIEW' && data?.recommendation) {
      setAmountInput(String(data.recommendation.suggestedAmount ?? ''));
      setRateInput(data.recommendation.suggestedInterestRate != null
        ? String(data.recommendation.suggestedInterestRate) : '');
    } else if (loan.status === 'PENDING_APPROVAL') {
      setAmountInput(loan.proposedAmount != null ? String(loan.proposedAmount) : '');
      setRateInput(loan.proposedInterestRate != null ? String(loan.proposedInterestRate) : '');
    }
  }, [loan.status, loan.proposedAmount, loan.proposedInterestRate, data]);

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
    const amt = Number(amountInput);
    const rate = Number(rateInput);
    if (!(amt > 0)) { setActError('Số tiền đề xuất không hợp lệ.'); return; }
    if (!(rate > 0)) { setActError('Lãi suất đề xuất không hợp lệ.'); return; }
    runAction(() => proposeLoan(loanId, { proposedAmount: amt, proposedInterestRate: rate, note: noteInput.trim() || undefined }));
  };

  const handleApprove = () => {
    const rate = Number(rateInput);
    if (!(rate > 0)) { setActError('Lãi suất duyệt không hợp lệ.'); return; }
    runAction(() => approveLoan(loanId, rate, noteInput.trim() || undefined));
  };

  const handleReject = () => {
    if (noteInput.trim().length < 3) { setActError('Nhập lý do từ chối.'); return; }
    runAction(() => rejectLoan(loanId, noteInput.trim()));
  };

  const rec = data?.recommendation;
  const dm = rec ? decisionMeta(rec.decision) : null;
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

      {data && rec && (
        <>
          {/* Top metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Hạng tín nhiệm — engine</p>
              <div className="flex items-center gap-2">
                <span className={`text-lg font-bold px-2.5 py-0.5 rounded-lg ${bandTone(data.risk.band)}`}>{data.risk.band}</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">{data.risk.score}/100 điểm</span>
              </div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">Biểu QĐ-LSGV · nhóm sản phẩm {data.productGroup ?? '—'}</p>
            </div>

            <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Điểm tín dụng AI</p>
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
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Khuyến nghị</p>
              {dm && <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-lg ${dm.cls}`}>{dm.label}</span>}
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">Hỗ trợ — không tự quyết</p>
            </div>

            <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Đề xuất giải ngân</p>
              <p className="text-base font-bold text-gray-900 dark:text-white">{formatMoney(rec.suggestedAmount)}</p>
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

          {/* Score factors */}
          <SubSection title="Yếu tố chấm điểm" icon={<Gauge size={13} />}>
            <div className="space-y-0.5">
              {data.risk.factors.map(f => (
                <div key={f.code} className="flex items-start gap-2.5 py-1.5 text-sm">
                  <span className={`font-bold w-9 text-right shrink-0 ${impactTone(f.impact)}`}>
                    {f.points > 0 ? `+${f.points}` : f.points}
                  </span>
                  <div className="leading-snug">
                    <span className="text-gray-700 dark:text-gray-200 font-medium">{f.label}</span>
                    <span className="text-gray-400 dark:text-gray-500"> — {f.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </SubSection>

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
              <MiniRow label="Lãi suất đề xuất" value={loan.proposedInterestRate != null ? `${loan.proposedInterestRate}%/năm` : '—'} />
              <MiniRow label="Thẩm định viên" value={loan.proposedBy ?? '—'} />
              {loan.appraisalNote && <MiniRow label="Ghi chú" value={loan.appraisalNote} />}

              {/* Căn cứ hỗ trợ cho ban lãnh đạo — đối chiếu đề xuất với engine + AI */}
              <div className="mt-2 pt-2 border-t border-red-100/70 dark:border-red-900/30">
                <MiniRow
                  label="Engine (QĐ-LSGV)"
                  value={rec
                    ? `Hạng ${data?.risk.band} · ${dm?.label} · gợi ý ${formatMoney(rec.suggestedAmount)} @ ${rateText(rec.suggestedInterestRate)}`
                    : 'Đang tải...'}
                />
                <MiniRow
                  label="Điểm tín dụng AI"
                  value={aiScoreText ?? <span className="text-amber-600 dark:text-amber-400">Chưa chấm — bấm "Chấm điểm tín dụng" ở khối trên</span>}
                />
                {creditScore && <MiniRow label="AI thẩm định chứng từ" value={docSummary} />}
                {creditScore?.aiRecommendation && <MiniRow label="AI khuyến nghị" value={creditScore.aiRecommendation} />}
              </div>
            </div>
          )}

          {loan.status === 'PENDING_REVIEW' && (
            <>
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-red-500">
                <Send size={13} />Đề xuất trình ban lãnh đạo
              </p>

              {/* Căn cứ đề xuất — tổng hợp engine + AI để thẩm định viên đối chiếu trước khi trình */}
              <div className="rounded-lg bg-white/70 dark:bg-gray-900/40 border border-red-100/70 dark:border-red-900/30 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Căn cứ đề xuất</p>
                <MiniRow
                  label="Engine (QĐ-LSGV)"
                  value={rec
                    ? `Hạng ${data?.risk.band} · ${dm?.label} · gợi ý ${formatMoney(rec.suggestedAmount)} @ ${rateText(rec.suggestedInterestRate)}`
                    : 'Đang tải...'}
                />
                <MiniRow
                  label="Điểm tín dụng AI"
                  value={aiScoreText ?? <span className="text-amber-600 dark:text-amber-400">Chưa chấm điểm</span>}
                />
                <MiniRow label="AI thẩm định chứng từ" value={creditScore ? docSummary : '—'} />
                {creditScore?.aiRecommendation && <MiniRow label="AI khuyến nghị" value={creditScore.aiRecommendation} />}
              </div>
              {!creditScore && (
                <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2 flex gap-1.5">
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                  Chưa chấm điểm tín dụng — nên bấm "Chấm điểm tín dụng" ở khối trên để AI thẩm định chứng từ trước khi trình ban lãnh đạo.
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-xs text-gray-500 dark:text-gray-400">
                  Số tiền đề xuất (VND)
                  <input type="number" value={amountInput} onChange={e => setAmountInput(e.target.value)} className={inputCls} />
                </label>
                <label className="text-xs text-gray-500 dark:text-gray-400">
                  Lãi suất (%/năm)
                  <input type="number" step="0.1" value={rateInput} onChange={e => setRateInput(e.target.value)} className={inputCls} />
                </label>
              </div>
              <label className="block text-xs text-gray-500 dark:text-gray-400">
                Ghi chú thẩm định
                <textarea value={noteInput} onChange={e => setNoteInput(e.target.value)} rows={2} className={inputCls} />
              </label>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">Số liệu điền sẵn từ gợi ý engine — chỉnh nếu cần.</p>
              <button disabled={acting} onClick={handlePropose} className={btnPrimary}>
                <Send size={14} />Trình ban lãnh đạo
              </button>
            </>
          )}

          {loan.status === 'PENDING_APPROVAL' && (isLeader ? (
            <>
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-red-500 pt-1">
                <ShieldCheck size={13} />Ban lãnh đạo phê duyệt
              </p>
              <label className="block text-xs text-gray-500 dark:text-gray-400">
                Lãi suất duyệt (%/năm) — có thể sửa trước khi duyệt
                <input type="number" step="0.1" value={rateInput} onChange={e => setRateInput(e.target.value)} className={inputCls} />
              </label>
              <label className="block text-xs text-gray-500 dark:text-gray-400">
                Ghi chú / lý do (bắt buộc khi từ chối)
                <textarea value={noteInput} onChange={e => setNoteInput(e.target.value)} rows={2} className={inputCls} />
              </label>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                Phê duyệt xong, khoản chuyển sang "Chờ xác nhận" — người gọi vốn phải đồng ý số tiền và lãi suất được duyệt thì khoản mới lên sàn cho nhà đầu tư.
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

function RepaymentScheduleSection({ loanId }: { loanId: string }) {
  const [schedule, setSchedule] = useState<RepaymentScheduleItem[] | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [open, setOpen]         = useState(false);

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
                <th className="px-4 py-2 font-semibold text-right">Tổng</th>
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
                    {new Date(r.dueDate).toLocaleDateString('vi-VN')}
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
                    {c.signedAt ? formatDate(c.signedAt) : '—'}
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

// ─── Giải ngân (OPS) ────────────────────────────────────────────────────────────

function DisbursementPanel({ loan, onActionDone }: { loan: CmsLoan; onActionDone: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [acting, setActing]         = useState(false);
  const [error, setError]           = useState('');

  if (loan.status !== 'AWAITING_DISBURSEMENT') return null;

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

function LoanDetailPage({ loan, onBack, onActionDone }: { loan: CmsLoan; onBack: () => void; onActionDone: () => void }) {
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
          <DetailRow label="Họ tên" value={loan.borrowerName ?? '—'} />
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
        {(loan.occupation || loan.workplace || loan.monthlyIncome != null || loan.currentAddress || loan.commune || loan.province) && (
          <Section title="Thông tin bổ sung">
            {loan.occupation && <DetailRow label="Nghề nghiệp" value={loan.occupation} />}
            <DetailRow label="Nơi làm việc" value={loan.workplace ?? 'Không có'} />
            {loan.monthlyIncome != null && (
              <DetailRow label="Thu nhập/tháng" value={formatMoney(loan.monthlyIncome)} />
            )}
            {loan.currentAddress && <DetailRow label="Địa chỉ chi tiết" value={loan.currentAddress} />}
            {loan.commune && <DetailRow label="Xã/Phường" value={loan.commune} />}
            {loan.province && <DetailRow label="Tỉnh/Thành phố" value={loan.province} />}
          </Section>
        )}

        {/* Thẩm định */}
        {(loan.reviewedBy || loan.reviewedAt || loan.rejectionReason) && (
          <Section title="Thẩm định">
            {loan.reviewedBy && <DetailRow label="Người thẩm định" value={loan.reviewedBy} />}
            {loan.reviewedAt && <DetailRow label="Ngày thẩm định" value={formatDate(loan.reviewedAt)} />}
            {loan.rejectionReason && (
              <DetailRow
                label="Lý do từ chối"
                value={<span className="text-red-500">{loan.rejectionReason}</span>}
              />
            )}
          </Section>
        )}

        {/* Thời gian */}
        <Section title="Thời gian">
          <DetailRow label="Ngày tạo" value={formatDate(loan.createdAt)} />
        </Section>
      </div>

      {/* Chứng từ + điểm tín dụng + hỗ trợ thẩm định */}
      <LoanDocumentsSection loan={loan} />
      <CreditScoreSection loan={loan} score={creditScore} onScore={setCreditScore} />
      <AppraisalPanel loan={loan} creditScore={creditScore} onActionDone={onActionDone} />

      {/* Giải ngân — chỉ hiện khi khoản ở trạng thái chờ giải ngân */}
      <DisbursementPanel loan={loan} onActionDone={onActionDone} />

      {/* Hợp đồng điện tử (vay + đầu tư) */}
      <ContractsSection loanId={loan.loanId} />

      {/* Lịch thanh toán — hiển thị cho mọi trạng thái (tự ẩn nếu chưa có lịch) */}
      <RepaymentScheduleSection loanId={loan.loanId} />
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
  onActionDone?: () => void;
}

export function LoansPage({ status, onActionDone }: LoansPageProps) {
  const [data, setData] = useState<{ content: CmsLoan[]; totalElements: number; totalPages: number } | null>(null);
  const [province, setProvince] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage]       = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [refresh, setRefresh] = useState(0);
  const [selectedLoan, setSelectedLoan] = useState<CmsLoan | null>(null);

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
      status: status || undefined,
      province: province || undefined,
      search: debouncedSearch || undefined,
      page,
      size: 20,
    })
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [status, province, debouncedSearch, page, refresh]);

  if (selectedLoan) {
    return (
      <LoanDetailPage
        loan={selectedLoan}
        onBack={() => setSelectedLoan(null)}
        onActionDone={() => { setSelectedLoan(null); setRefresh(r => r + 1); onActionDone?.(); }}
      />
    );
  }

  return (
    <div className="space-y-4">
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

        {/* Tỉnh / Thành phố */}
        <select
          value={province}
          onChange={e => { setProvince(e.target.value); setPage(0); }}
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-red-500"
        >
          <option value="">Tất cả tỉnh/TP</option>
          {VN_PROVINCES_2025.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <button onClick={() => setRefresh(r => r + 1)} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
        {data && (
          <span className="text-sm text-gray-400 dark:text-gray-500 ml-auto">
            {loanStatusLabel(status)} · {data.totalElements} khoản
            {province ? ` tại ${province}` : ''}
            {debouncedSearch ? ` · "${debouncedSearch}"` : ''}
          </span>
        )}
      </div>

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
                  </td>
                  <td className="px-4 py-3.5 text-center align-middle">
                    <TruncatedText
                      value={loan.productName ?? loan.purpose}
                      className="mx-auto max-w-[180px] text-gray-600 dark:text-gray-400 text-xs"
                    />
                  </td>
                  <td className="px-4 py-3.5 text-center font-semibold text-gray-800 dark:text-gray-200 align-middle text-xs">
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
                    {formatDate(loan.createdAt)}
                  </td>
                  <td className="px-4 py-3.5 text-center align-middle">
                    <button
                      onClick={() => setSelectedLoan(loan)}
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
