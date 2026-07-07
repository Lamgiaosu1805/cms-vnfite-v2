import { useEffect, useState, useCallback } from 'react';
import {
  fetchAuditLogs, fetchAuditLogById,
  type AuditLogEntry, type AppraisalSuggestion,
} from '../api/client';
import { ChevronDown, ChevronUp, Search, X, CheckCircle2, XCircle, Loader2, WalletCards, Ban } from 'lucide-react';
import { formatVietnamDateTime } from '../utils/dateTime';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat('vi-VN');
const fmtMoney = (v: number | null | undefined) =>
  v == null ? '—' : `${fmt.format(v)} ₫`;
const fmtRate = (v: number | null | undefined) =>
  v == null ? '—' : `${v}%/năm`;
const fmtDt = formatVietnamDateTime;

function bandTone(band: string | null): string {
  if (!band) return 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400';
  const b = band.charAt(0);
  if (b === 'A') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
  if (b === 'B') return 'bg-amber-100  text-amber-800  dark:bg-amber-900/40  dark:text-amber-300';
  return           'bg-red-100    text-red-800    dark:bg-red-900/40    dark:text-red-300';
}

function decisionBadge(decision: string) {
  switch (decision) {
    case 'APPROVED':
      return {
        label: 'Duyệt',
        icon: CheckCircle2,
        className: 'text-emerald-700 dark:text-emerald-400',
      };
    case 'REJECTED':
      return {
        label: 'Từ chối',
        icon: XCircle,
        className: 'text-red-600 dark:text-red-400',
      };
    case 'DISBURSED':
      return {
        label: 'Đã giải ngân',
        icon: WalletCards,
        className: 'text-blue-700 dark:text-blue-400',
      };
    case 'CANCELLED':
      return {
        label: 'Đã hủy',
        icon: Ban,
        className: 'text-gray-600 dark:text-gray-400',
      };
    case 'REPAYMENT_RECORDED':
      return {
        label: 'Ghi nhận thanh toán',
        icon: CheckCircle2,
        className: 'text-sky-700 dark:text-sky-400',
      };
    default:
      return {
        label: decision || 'Không rõ',
        icon: CheckCircle2,
        className: 'text-gray-600 dark:text-gray-400',
      };
  }
}

// ─── Score Factor mini-row ────────────────────────────────────────────────────

function FactorRow({ label, impact, points, detail }: {
  label: string; impact: string; points: number; detail: string;
}) {
  const pos = impact === 'POSITIVE';
  const neg = impact === 'NEGATIVE';
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <span className={`mt-0.5 text-xs font-bold w-9 shrink-0 text-right ${pos ? 'text-emerald-600 dark:text-emerald-400' : neg ? 'text-red-500 dark:text-red-400' : 'text-gray-400'}`}>
        {pos && points > 0 ? `+${points}` : points}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{detail}</p>
      </div>
    </div>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({ entry }: { entry: AuditLogEntry }) {
  const [detail, setDetail] = useState<AuditLogEntry | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchAuditLogById(entry.id)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [entry.id]);

  // Audit là log tuần thủ: bản ghi CŨ (trước khi bỏ engine QĐ-LSGV) còn lưu risk/decision —
  // vẫn cho xem nguyên trạng. Bản ghi MỚI dựa trên Credit 360 nên không còn các field này.
  type LegacyAppraisalSnapshot = AppraisalSuggestion & {
    risk?: {
      score?: number;
      band?: string;
      factors?: Array<{ code: string; label: string; impact: string; points: number; detail: string }>;
    };
    recommendation: AppraisalSuggestion['recommendation'] & { decision?: string };
  };
  const snap = detail?.appraisalSnapshot as LegacyAppraisalSnapshot | null | undefined;

  if (loading) {
    return (
      <div className="py-8 flex justify-center">
        <Loader2 className="animate-spin text-gray-400" size={22} />
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 space-y-5">

      {/* ── Tóm tắt quyết định ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Cell label="Số tiền YC" value={fmtMoney(entry.requestedAmount)} />
        <Cell label="Đề xuất (cấp 1)" value={fmtMoney(entry.proposedAmount)} sub={entry.proposedBy ?? undefined} />
        <Cell label="Số tiền cuối" value={fmtMoney(entry.finalAmount)} />
        <Cell label="Lãi suất cuối" value={fmtRate(entry.finalInterestRate)} />
        {entry.occupation && <Cell label="Nghề nghiệp" value={entry.occupation} />}
        {entry.monthlyIncome && <Cell label="Thu nhập/tháng" value={fmtMoney(entry.monthlyIncome)} />}
        {entry.termMonths   && <Cell label="Kỳ hạn" value={`${entry.termMonths} tháng`} />}
      </div>

      {snap && (
        <>
          {/* ── Hạng tín nhiệm engine — chỉ bản ghi CŨ (engine QĐ-LSGV đã bỏ, Credit 360 là chuẩn) ── */}
          {snap.risk && (
            <Section title="Hạng tín nhiệm engine (bản ghi cũ)">
              <div className="flex items-center gap-4 mb-3">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${bandTone(entry.creditBand)}`}>
                  {entry.creditBand ?? '—'}
                </span>
                <span className="text-2xl font-black text-gray-800 dark:text-gray-100">
                  {entry.creditScore ?? '—'}
                  <span className="text-sm font-normal text-gray-400 ml-1">/ 100</span>
                </span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {snap.risk.factors?.map(f => (
                  <FactorRow key={f.code} label={f.label} impact={f.impact}
                    points={f.points} detail={f.detail} />
                ))}
              </div>
            </Section>
          )}

          {/* ── Năng lực tài chính ── */}
          {snap.affordability && (
            <Section title="Năng lực tài chính">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs text-gray-600 dark:text-gray-400">
                <ARow k="Thu nhập/tháng" v={snap.affordability.incomeProvided
                  ? fmtMoney(snap.affordability.monthlyIncome) : 'Chưa cung cấp'} />
                <ARow k="PTI cap" v={`${((snap.affordability.ptiCap ?? 0) * 100).toFixed(0)}%`} />
                <ARow k="Trả nợ hàng tháng YC" v={fmtMoney(snap.affordability.requestedInstallment)} />
                <ARow k="PTI YC" v={snap.affordability.requestedPti != null
                  ? `${(snap.affordability.requestedPti * 100).toFixed(1)}%` : '—'} />
                <ARow k="Vay tối đa theo thu nhập" v={fmtMoney(snap.affordability.maxPrincipalByIncome)} />
              </div>
            </Section>
          )}

          {/* ── Đề xuất engine ── */}
          {snap.recommendation && (
            <Section title="Đề xuất engine tại thời điểm duyệt">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs text-gray-600 dark:text-gray-400">
                <ARow k="Số tiền đề xuất" v={fmtMoney(snap.recommendation.suggestedAmount)} />
                <ARow k="Lãi suất đề xuất" v={fmtRate(snap.recommendation.suggestedInterestRate)} />
                <ARow k="Phí kết nối" v={snap.recommendation.feePercent != null
                  ? `${snap.recommendation.feePercent}%` : '—'} />
                {snap.recommendation.decision && <ARow k="Quyết định engine (bản ghi cũ)" v={snap.recommendation.decision} />}
              </div>
              {snap.recommendation.rateNote && (
                <p className="mt-2 text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 p-2 rounded">
                  {snap.recommendation.rateNote}
                </p>
              )}
            </Section>
          )}

          {/* ── Cảnh báo tự động ── */}
          {snap.autoWarnings?.length > 0 && (
            <Section title="Cảnh báo tự động">
              <ul className="space-y-1">
                {snap.autoWarnings.map((w, i) => (
                  <li key={i} className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 px-3 py-1.5 rounded">
                    ⚠ {w}
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </>
      )}

      {!snap && !loading && (
        <p className="text-xs text-gray-400 italic">Không có dữ liệu engine thẩm định (snapshot trống).</p>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">{title}</p>
      {children}
    </div>
  );
}
function Cell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
      <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
      <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm mt-0.5">{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}
function ARow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-gray-400 dark:text-gray-500">{k}</span>
      <span className="font-medium text-gray-700 dark:text-gray-300 text-right">{v}</span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function AuditLogPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Filters
  const [decision, setDecision]   = useState('');
  const [decidedBy, setDecidedBy] = useState('');
  const [searchDraft, setSearchDraft] = useState('');

  const SIZE = 20;

  const load = useCallback(async (p = 0) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAuditLogs({
        decision: decision || undefined,
        decidedBy: decidedBy || undefined,
        page: p,
        size: SIZE,
      });
      setEntries(res.content);
      setTotal(res.totalElements);
      setPage(p);
      setExpanded(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Lỗi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, [decision, decidedBy]);

  useEffect(() => { load(0); }, [load]);

  function applySearch() {
    setDecidedBy(searchDraft.trim());
    setPage(0);
  }

  const totalPages = Math.ceil(total / SIZE);

  return (
    <div className="space-y-5">

      {/* ── Tiêu đề ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Nhật ký quyết định tín dụng</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Lịch sử phê duyệt / từ chối khoản gọi vốn — snapshot tại thời điểm ra quyết định.
          </p>
        </div>
        <div className="text-sm text-gray-400 dark:text-gray-500 shrink-0">{total} bản ghi</div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3 items-end">
        {/* Decision filter */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Quyết định</label>
          <select
            value={decision}
            onChange={e => { setDecision(e.target.value); setPage(0); }}
            className="text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-red-300 dark:focus:ring-red-800"
          >
            <option value="">Tất cả</option>
            <option value="APPROVED">Phê duyệt</option>
            <option value="REJECTED">Từ chối</option>
            <option value="DISBURSED">Đã giải ngân</option>
            <option value="CANCELLED">Đã hủy</option>
            <option value="REPAYMENT_RECORDED">Ghi nhận thanh toán</option>
          </select>
        </div>

        {/* Người duyệt search */}
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Người duyệt</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchDraft}
              onChange={e => setSearchDraft(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applySearch()}
              placeholder="Username ban lãnh đạo..."
              className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-300 dark:focus:ring-red-800"
            />
            <button onClick={applySearch}
              className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition">
              <Search size={16} />
            </button>
            {decidedBy && (
              <button onClick={() => { setSearchDraft(''); setDecidedBy(''); }}
                className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition">
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* ── Table ── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="animate-spin text-gray-400" size={28} />
          </div>
        ) : entries.length === 0 ? (
          <div className="py-16 text-center text-gray-400 dark:text-gray-500 text-sm">
            Chưa có bản ghi quyết định nào.
          </div>
        ) : (
          <div>
            {/* Header */}
            <div className="grid grid-cols-[1fr_120px_130px_130px_90px_90px_130px_40px] gap-3 px-4 py-2.5
                            text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide
                            border-b border-gray-100 dark:border-gray-700">
              <span>Khoản</span>
              <span>Số tiền YC</span>
              <span>Đề xuất</span>
              <span>Cuối cùng</span>
              <span>Hạng</span>
              <span>Quyết định</span>
              <span>Người duyệt / Thời gian</span>
              <span />
            </div>

            {entries.map(e => {
              const badge = decisionBadge(e.decision);
              const DecisionIcon = badge.icon;
              return (
              <div key={e.id} className="border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                {/* Row */}
                <button
                  type="button"
                  onClick={() => setExpanded(prev => prev === e.id ? null : e.id)}
                  className="w-full grid grid-cols-[1fr_120px_130px_130px_90px_90px_130px_40px] gap-3 px-4 py-3
                             text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 transition text-sm"
                >
                  {/* Khoản */}
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 dark:text-gray-100 truncate">
                      {e.loanCode ?? e.loanId.substring(0, 8) + '…'}
                    </p>
                    {e.purpose && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{e.purpose}</p>
                    )}
                  </div>

                  {/* Số tiền YC */}
                  <span className="text-gray-600 dark:text-gray-400 text-xs self-center">
                    {fmtMoney(e.requestedAmount)}
                  </span>

                  {/* Đề xuất */}
                  <div className="self-center">
                    <p className="text-xs text-gray-700 dark:text-gray-300">{fmtMoney(e.proposedAmount)}</p>
                    {e.proposedBy && <p className="text-xs text-gray-400 dark:text-gray-500">{e.proposedBy}</p>}
                  </div>

                  {/* Cuối cùng */}
                  <div className="self-center">
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">{fmtMoney(e.finalAmount)}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{fmtRate(e.finalInterestRate)}</p>
                  </div>

                  {/* Hạng */}
                  <div className="self-center">
                    {e.creditBand ? (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${bandTone(e.creditBand)}`}>
                        {e.creditBand}
                        {e.creditScore != null && <span className="opacity-70">· {e.creditScore}</span>}
                      </span>
                    ) : <span className="text-xs text-gray-400">—</span>}
                  </div>

                  {/* Quyết định */}
                  <div className="self-center">
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${badge.className}`}>
                      <DecisionIcon size={13} />{badge.label}
                    </span>
                  </div>

                  {/* Người duyệt */}
                  <div className="self-center">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{e.decidedBy}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{fmtDt(e.decidedAt)}</p>
                  </div>

                  {/* Expand toggle */}
                  <div className="self-center text-gray-400 dark:text-gray-500">
                    {expanded === e.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>

                {/* Rejection reason inline */}
                {e.rejectionReason && expanded !== e.id && (
                  <div className="px-4 pb-2 text-xs text-red-500 dark:text-red-400">
                    Lý do từ chối: {e.rejectionReason}
                  </div>
                )}

                {/* Detail panel */}
                {expanded === e.id && <DetailPanel entry={e} />}
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">
            Trang {page + 1} / {totalPages} · {total} bản ghi
          </span>
          <div className="flex gap-2">
            <button disabled={page === 0} onClick={() => load(page - 1)}
              className="px-4 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600
                         text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700
                         disabled:opacity-40 transition">
              ← Trước
            </button>
            <button disabled={page + 1 >= totalPages} onClick={() => load(page + 1)}
              className="px-4 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600
                         text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700
                         disabled:opacity-40 transition">
              Tiếp →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
