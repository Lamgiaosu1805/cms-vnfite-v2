import { useEffect, useState } from 'react';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Eye, RefreshCw,
  Sparkles, AlertTriangle, ClipboardList, Gauge, Wallet, CircleDollarSign,
} from 'lucide-react';
import {
  fetchLoans, fetchAppraisalSuggestion,
  type CmsLoan, type AppraisalSuggestion, type RecommendedDecision, type FactorImpact,
} from '../api/client';
import { Badge } from '../components/Badge';

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

function AppraisalPanel({ loanId }: { loanId: string }) {
  const [data, setData] = useState<AppraisalSuggestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [discouraged, setDiscouraged] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError('');
    fetchAppraisalSuggestion(loanId, discouraged)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [loanId, discouraged, tick]);

  const rec = data?.recommendation;
  const dm = rec ? decisionMeta(rec.decision) : null;
  const sp = data?.schedulePreview ?? null;
  const af = data?.affordability ?? null;

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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Hạng tín nhiệm</p>
              <div className="flex items-center gap-2">
                <span className={`text-lg font-bold px-2.5 py-0.5 rounded-lg ${bandTone(data.risk.band)}`}>{data.risk.band}</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">{data.risk.score}/100 điểm</span>
              </div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">Nhóm sản phẩm {data.productGroup ?? '—'}</p>
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
          {data.autoWarnings.length > 0 && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/40 p-3 space-y-1.5">
              {data.autoWarnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-700 dark:text-amber-300 flex gap-1.5">
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />{w}
                </p>
              ))}
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
    </div>
  );
}

function LoanDetailPage({ loan, onBack }: { loan: CmsLoan; onBack: () => void }) {
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
        <Badge value={loan.status} />
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
          {loan.purpose && <DetailRow label="Mục đích" value={loan.purpose} />}
        </Section>

        {/* Thông tin bổ sung */}
        {(loan.occupation || loan.workplace || loan.monthlyIncome != null || loan.currentAddress) && (
          <Section title="Thông tin bổ sung">
            {loan.occupation && <DetailRow label="Nghề nghiệp" value={loan.occupation} />}
            <DetailRow label="Nơi làm việc" value={loan.workplace ?? 'Không có'} />
            {loan.monthlyIncome != null && (
              <DetailRow label="Thu nhập/tháng" value={formatMoney(loan.monthlyIncome)} />
            )}
            {loan.currentAddress && <DetailRow label="Địa chỉ hiện tại" value={loan.currentAddress} />}
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

      {/* Hỗ trợ thẩm định */}
      <AppraisalPanel loanId={loan.loanId} />
    </div>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LOAN_STATUSES = [
  { value: '', label: 'Tất cả' },
  { value: 'PENDING_REVIEW', label: 'Chờ thẩm định' },
  { value: 'AWAITING_BORROWER_APPROVAL', label: 'Chờ xác nhận' },
  { value: 'ACTIVE', label: 'Đang gọi vốn' },
  { value: 'FUNDED', label: 'Đã fund' },
  { value: 'REPAYING', label: 'Đang trả' },
  { value: 'COMPLETED', label: 'Hoàn thành' },
  { value: 'REJECTED', label: 'Từ chối' },
  { value: 'CANCELLED', label: 'Đã huỷ' },
];

// ─── List Page ────────────────────────────────────────────────────────────────

export function LoansPage() {
  const [data, setData] = useState<{ content: CmsLoan[]; totalElements: number; totalPages: number } | null>(null);
  const [status, setStatus] = useState('PENDING_REVIEW');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [selectedLoan, setSelectedLoan] = useState<CmsLoan | null>(null);

  useEffect(() => {
    setLoading(true);
    setError('');
    fetchLoans({ status: status || undefined, page, size: 20 })
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [status, page, refresh]);

  if (selectedLoan) {
    return <LoanDetailPage loan={selectedLoan} onBack={() => setSelectedLoan(null)} />;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 flex flex-wrap gap-3 items-center">
        <select
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(0); }}
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-red-500"
        >
          {LOAN_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <button onClick={() => setRefresh(r => r + 1)} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
        {data && (
          <span className="text-sm text-gray-400 dark:text-gray-500 ml-auto">
            Tổng {data.totalElements} khoản
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
                    <p className="font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap text-xs">
                      {loan.borrowerName ?? shortId(loan.borrowerId)}
                    </p>
                  </td>
                  <td className="px-4 py-3.5 text-center align-middle">
                    <p className="mx-auto max-w-[180px] truncate text-gray-600 dark:text-gray-400 text-xs">
                      {loan.productName ?? loan.purpose ?? '—'}
                    </p>
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
                    <Badge value={loan.status} />
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
