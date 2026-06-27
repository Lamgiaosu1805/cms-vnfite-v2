import axios, { type InternalAxiosRequestConfig, type AxiosResponse, type AxiosError } from 'axios';

// Dùng relative URL để Vite proxy forward /cms → http://42.113.122.119:7080 (tránh CORS khi dev)
// Khi build production, deploy cùng domain hoặc set VITE_API_BASE qua env
const BASE_URL = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/cms';
const SESSION_NOTICE_KEY = 'cms_session_notice';
const SESSION_EXPIRED_NOTICE = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.';

const axiosClient = axios.create({ baseURL: BASE_URL });

axiosClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // Chỉ set token nếu chưa có (TOTP endpoints tự set pendingToken)
  if (!config.headers.Authorization) {
    const token = localStorage.getItem('cms_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosClient.interceptors.response.use(
  (res: AxiosResponse) => res,
  (err: AxiosError<{ message?: string; error?: string; detail?: string; details?: string[] }>) => {
    const status = err.response?.status ?? 0;
    const url = err.config?.url ?? '';
    // Auth endpoints: 401/403 là lỗi nghiệp vụ (sai mật khẩu, sai OTP) — KHÔNG redirect.
    // Các endpoint khác: chỉ 401 mới là hết phiên. 403 là thiếu quyền theo role
    // (ví dụ OPS/Vận hành không được vào một số chức năng), không được xóa session.
    const isAuthEndpoint = url.includes('/auth/');
    if (status === 401 && !isAuthEndpoint) {
      const hadSession = !!localStorage.getItem('cms_token');
      localStorage.removeItem('cms_token');
      localStorage.removeItem('cms_admin');
      if (hadSession) {
        localStorage.setItem(SESSION_NOTICE_KEY, SESSION_EXPIRED_NOTICE);
        window.location.reload();
        return new Promise(() => {});
      }
    }
    const body = err.response?.data;
    const details = Array.isArray(body?.details) ? body.details.filter(Boolean).join('; ') : '';
    const raw = details || body?.message || body?.error || body?.detail || `Lỗi ${status}`;
    const isTechnical = /https?:\/\/|I\/O error|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|ECONNREFUSED|Connection refused/i.test(raw);
    const message = isTechnical ? 'Không thể kết nối với máy chủ. Vui lòng thử lại.' : raw;
    return Promise.reject(new Error(message));
  },
);

export function getStoredAdmin(): AdminInfo | null {
  const raw = localStorage.getItem('cms_admin');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function saveSession(token: string, admin: AdminInfo) {
  localStorage.setItem('cms_token', token);
  localStorage.setItem('cms_admin', JSON.stringify(admin));
}

export function clearSession() {
  localStorage.removeItem('cms_token');
  localStorage.removeItem('cms_admin');
}

export function consumeSessionNotice(): string {
  const notice = localStorage.getItem(SESSION_NOTICE_KEY) ?? '';
  if (notice) localStorage.removeItem(SESSION_NOTICE_KEY);
  return notice;
}

export interface AdminInfo {
  username: string;
  fullName: string;
  email: string;
  role: string;
}

async function request<T>(
  path: string,
  options: { method?: string; data?: unknown; authToken?: string } = {},
): Promise<T> {
  const res = await axiosClient.request<T>({
    url: path,
    method: options.method ?? 'GET',
    data: options.data,
    headers: options.authToken ? { Authorization: `Bearer ${options.authToken}` } : {},
  });
  return res.data;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface LoginResult {
  admin: AdminInfo;
  mustChangePassword: boolean;
}

/** Kết quả sau bước nhập mật khẩu — cần tiếp tục với TOTP */
export interface LoginInitResult {
  pendingToken: string;
  totpEnabled: boolean;
  /** Chỉ có khi APP_TOTP_REQUIRED=false — bỏ qua TOTP, đăng nhập thẳng */
  accessToken?: string;
  admin?: AdminInfo;
  mustChangePassword?: boolean;
}

export interface TotpSetupData {
  secret: string;
  otpAuthUrl: string;
}

export async function checkSetupRequired(): Promise<boolean> {
  const data = await request<{ setupRequired: boolean }>('/auth/setup/status');
  return data.setupRequired;
}

export async function setupSuperAdmin(payload: {
  username: string; email: string; fullName: string; password: string;
}): Promise<void> {
  return request('/auth/setup', { method: 'POST', data: payload });
}

/** Bước 1: xác thực mật khẩu → nhận pendingToken (hoặc accessToken trực tiếp khi TOTP tắt) */
export async function login(username: string, password: string): Promise<LoginInitResult> {
  const data = await request<LoginInitResult>('/auth/login', {
    method: 'POST',
    data: { username, password },
  });
  if (data.accessToken && data.admin) {
    saveSession(data.accessToken, data.admin);
  }
  return data;
}

/** Bước 2a: lấy QR code để thiết lập TOTP lần đầu */
export async function initTotpSetup(pendingToken: string): Promise<TotpSetupData> {
  return request<TotpSetupData>('/auth/totp/setup-init', { authToken: pendingToken });
}

/** Bước 2b: xác nhận mã OTP → kích hoạt 2FA + nhận session đầy đủ */
export async function confirmTotpSetup(
  pendingToken: string, secret: string, code: string,
): Promise<LoginResult> {
  const data = await request<{ accessToken: string; admin: AdminInfo; mustChangePassword: boolean }>(
    '/auth/totp/setup-confirm',
    { method: 'POST', data: { secret, code }, authToken: pendingToken },
  );
  saveSession(data.accessToken, data.admin);
  return { admin: data.admin, mustChangePassword: data.mustChangePassword };
}

/** Bước 2c: nhập mã OTP khi đăng nhập (đã thiết lập 2FA trước đó) */
export async function verifyTotp(pendingToken: string, code: string): Promise<LoginResult> {
  const data = await request<{ accessToken: string; admin: AdminInfo; mustChangePassword: boolean }>(
    '/auth/totp/verify',
    { method: 'POST', data: { code }, authToken: pendingToken },
  );
  saveSession(data.accessToken, data.admin);
  return { admin: data.admin, mustChangePassword: data.mustChangePassword };
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return request('/auth/change-password', {
    method: 'POST',
    data: { currentPassword, newPassword },
  });
}

// Ghi nhớ username để pre-fill khi phiên hết hạn
export function saveLastUsername(username: string) {
  localStorage.setItem('cms_last_username', username);
}
export function getLastUsername(): string {
  return localStorage.getItem('cms_last_username') ?? '';
}

// ─── Admin Management (SUPER_ADMIN only) ──────────────────────────────────────

export interface AdminItem {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: string;
  active: boolean;
  mustChangePassword: boolean;
  totpEnabled: boolean;
  createdAt: string;
}

export interface CreateAdminResult {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: string;
  generatedPassword: string;
}

export interface ResetAdminPasswordResult {
  id: string;
  username: string;
  fullName: string;
  generatedPassword: string;
}

export async function listAdmins(): Promise<AdminItem[]> {
  return request('/admins');
}

export async function createAdmin(payload: {
  fullName: string; email: string; role: string;
}): Promise<CreateAdminResult> {
  return request('/admins', { method: 'POST', data: payload });
}

export async function toggleAdminActive(id: string): Promise<void> {
  return request(`/admins/${id}/toggle-active`, { method: 'PUT' });
}

export async function updateAdminRole(id: string, role: 'ADMIN' | 'OPS'): Promise<AdminItem> {
  return request(`/admins/${id}/role`, { method: 'PUT', data: { role } });
}

export async function resetAdminPassword(id: string): Promise<ResetAdminPasswordResult> {
  return request(`/admins/${id}/reset-password`, { method: 'POST' });
}

export async function resetAdminTotp(id: string): Promise<void> {
  return request(`/admins/${id}/reset-totp`, { method: 'POST' });
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  pendingKycCount: number;
  activeFundingVolume: number;
  todayNewUsers: number;
  totalLoans: number;
  pendingLoans: number;
  activeLoans: number;
  fundedLoans: number;
  totalFundedVolume: number;
  todayNewLoans: number;
  todayLoanVolume: number;
  debtAsOfDate: string | null;
  dueWithinDays: number;
  dueSoonInstallments: number;
  dueSoonCustomers: number;
  overdueInstallments: number;
  overdueCustomers: number;
  outstandingPrincipal: number;
  outstandingInterest: number;
  outstandingLateFee: number;
  totalOutstanding: number;
  repaymentAttentionItems: RepaymentAttentionItem[];
}

export interface RepaymentAttentionItem {
  loanId: string;
  loanCode: string | null;
  borrowerId: string;
  borrowerName: string | null;
  borrowerPhone: string | null;
  periodNumber: number | null;
  dueDate: string;
  dpd: number;
  status: 'OVERDUE' | 'DUE_SOON';
  principalOutstanding: number;
  interestOutstanding: number;
  lateFeeOutstanding: number;
  totalOutstanding: number;
}

export interface ChartPoint {
  date: string;
  label: string;
  newUsers: number;
  newLoans: number;
  loanVolume: number;
  future: boolean;
}

export type ChartPeriod = 'week' | 'month' | 'year';

export async function fetchStats(): Promise<DashboardStats> {
  return request('/dashboard/stats');
}

export async function fetchChart(period: ChartPeriod = 'week'): Promise<{ points: ChartPoint[] }> {
  return request(`/dashboard/chart?period=${period}`);
}

// ─── Users ────────────────────────────────────────────────────────────────────

export interface CmsUser {
  userId: string;
  phone: string;
  email: string | null;
  fullName: string | null;
  cccdNumber: string | null;
  role: string;
  kycStatus: string;
  accountStatus: string;
  createdAt: string;
  dateOfBirth: string | null;
  gender: string | null;
  permanentAddress: string | null;
  hometown: string | null;
  issueDate: string | null;
  issuingAuthority: string | null;
  expiryDate: string | null;
  frontImageId: string | null;
  backImageId: string | null;
  portraitImageId: string | null;
}

export interface CmsWallet {
  walletId: string;
  vnfAccountNo: string;
  totalBalance: number;
  lockedBalance: number;
  availableBalance: number;
  createdAt: string;
}

export interface CmsWalletTransaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  description: string | null;
  balanceAfter: number | null;
  createdAt: string;
}

export interface CustomerDetail {
  profile: CmsUser;
  wallet: CmsWallet | null;
  transactions: PagedResponse<CmsWalletTransaction>;
  loans: PagedResponse<CmsLoan>;
  investments: CustomerInvestmentCashflow;
}

export interface CustomerInvestmentCashflow {
  summary: {
    totalInvested: number;
    totalReturnsExpected: number;
    totalReturnsPaid: number;
    nextPaymentDate: string | null;
    nextPaymentAmount: number | null;
  };
  upcomingPayments: CustomerUpcomingPayment[];
  investmentHistory: CustomerInvestmentItem[];
  investmentHistoryPage: PagedResponse<CustomerInvestmentItem>;
  monthlyChart: Array<{
    month: string;
    expected: number;
    actual: number;
  }>;
}

export interface CustomerUpcomingPayment {
  loanId: string;
  loanCode: string | null;
  dueDate: string;
  periodNumber: number;
  investorShare: number;
  status: string;
  dpd: number;
}

export interface CustomerInvestmentItem {
  offerId: string;
  loanId: string;
  loanCode: string | null;
  borrowerId: string | null;
  borrowerName: string | null;
  borrowerPhone: string | null;
  amount: number;
  loanStatus: string;
  interestRate: number | null;
  termMonths: number | null;
  investedAt: string | null;
}

export interface CmsLoanOffer {
  offerId: string;
  investorId: string | null;
  investorName: string | null;
  investorPhone: string | null;
  amount: number | null;
  status: string | null;
  createdAt: string | null;
}

export interface PagedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  page: number;
  number?: number;
  size: number;
  last?: boolean;
}

export async function fetchUsers(params: {
  search?: string;
  kycStatus?: string;
  accountStatus?: string;
  page?: number;
  size?: number;
}): Promise<PagedResponse<CmsUser>> {
  const q = new URLSearchParams();
  if (params.search) q.set('search', params.search);
  if (params.kycStatus) q.set('kycStatus', params.kycStatus);
  if (params.accountStatus) q.set('accountStatus', params.accountStatus);
  q.set('page', String(params.page ?? 0));
  q.set('size', String(params.size ?? 20));
  return request(`/users?${q}`);
}

export async function fetchCustomerDetail(userId: string): Promise<CustomerDetail> {
  return fetchCustomerDetailWithParams(userId, {});
}

export async function fetchCustomerDetailWithParams(
  userId: string,
  params: { investmentPage?: number; investmentSize?: number; investmentStatus?: string },
): Promise<CustomerDetail> {
  const q = new URLSearchParams();
  q.set('transactionSize', '30');
  q.set('loanSize', '30');
  q.set('investmentPage', String(params.investmentPage ?? 0));
  q.set('investmentSize', String(params.investmentSize ?? 10));
  if (params.investmentStatus) q.set('investmentStatus', params.investmentStatus);
  return request(`/users/${userId}/detail?${q}`);
}

export interface ResetCustomerPasswordResult {
  userId: string;
  phone: string;
  generatedPassword: string;
}

export async function resetCustomerPassword(userId: string): Promise<ResetCustomerPasswordResult> {
  return request(`/users/${userId}/reset-password`, { method: 'POST' });
}

export async function resetCustomerDevice(userId: string): Promise<void> {
  return request(`/users/${userId}/reset-device`, { method: 'POST' });
}

// ─── System money transactions ─────────────────────────────────────────────

export interface CmsSystemTransaction {
  id: string;
  userId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  walletId: string;
  vnfAccountNo: string | null;
  type: 'DEPOSIT' | 'WITHDRAW';
  amount: number;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  description: string | null;
  referenceId: string | null;
  externalRef: string | null;
  balanceAfter: number | null;
  createdAt: string;
}

export async function fetchSystemTransactions(params: {
  search?: string;
  type?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}): Promise<PagedResponse<CmsSystemTransaction>> {
  const q = new URLSearchParams();
  if (params.search) q.set('search', params.search);
  if (params.type) q.set('type', params.type);
  if (params.status) q.set('status', params.status);
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  q.set('page', String(params.page ?? 0));
  q.set('size', String(params.size ?? 20));
  return request(`/transactions?${q}`);
}

export async function decideKyc(userId: string, decision: 'APPROVED' | 'REJECTED', reason?: string): Promise<void> {
  return request(`/users/${userId}/kyc-decision`, {
    method: 'POST',
    data: { decision, reason },
  });
}

export async function updateUserStatus(userId: string, status: string): Promise<void> {
  return request(`/users/${userId}/status`, {
    method: 'PUT',
    data: { status },
  });
}

// ─── Loans ────────────────────────────────────────────────────────────────────

export interface CmsLoan {
  loanId: string;
  loanCode: string | null;
  borrowerId: string;
  borrowerName: string | null;
  borrowerPhone: string | null;
  borrowerEmail: string | null;
  borrowerCccdNumber: string | null;
  borrowerKycStatus: string | null;
  borrowerAccountStatus: string | null;
  borrowerDateOfBirth: string | null;
  borrowerGender: string | null;
  borrowerPermanentAddress: string | null;
  borrowerHometown: string | null;
  borrowerIssueDate: string | null;
  borrowerIssuingAuthority: string | null;
  borrowerExpiryDate: string | null;
  borrowerFrontImageId: string | null;
  borrowerBackImageId: string | null;
  borrowerPortraitImageId: string | null;
  productName: string | null;
  amount: number;
  /** Null khi mới tạo — set khi ban lãnh đạo phê duyệt */
  interestRate: number | null;
  /** Đề xuất của thẩm định viên (cấp 1) trình ban lãnh đạo */
  proposedAmount: number | null;
  proposedInterestRate: number | null;
  appraisalFeeRate: number | null;
  proposedBy: string | null;
  proposedAt: string | null;
  appraisalNote: string | null;
  termMonths: number;
  repaymentDay: number | null;
  purpose: string | null;
  ref1FullName: string | null;
  ref1Relationship: string | null;
  ref1Phone: string | null;
  ref1Address: string | null;
  ref2FullName: string | null;
  ref2Relationship: string | null;
  ref2Phone: string | null;
  ref2Address: string | null;
  occupation: string | null;
  workplace: string | null;
  monthlyIncome: number | null;
  currentAddress: string | null;
  commune: string | null;
  province: string | null;
  status: string;
  rejectionReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  disbursedAt: string | null;
  disbursedBy: string | null;
  appraisalFee: number | null;
  vatAmount: number | null;
  totalFee: number | null;
  netDisbursement: number | null;
  createdAt: string;
  offers?: CmsLoanOffer[];
}

export async function fetchLoans(params: {
  status?: string;
  province?: string;
  search?: string;
  page?: number;
  size?: number;
}): Promise<PagedResponse<CmsLoan>> {
  const q = new URLSearchParams();
  if (params.status)   q.set('status',   params.status);
  if (params.province) q.set('province', params.province);
  if (params.search)   q.set('search',   params.search);
  q.set('page', String(params.page ?? 0));
  q.set('size', String(params.size ?? 20));
  return request(`/loans?${q}`);
}

/** Cấp 1 — thẩm định viên đề xuất số tiền + lãi suất + % phí trình ban lãnh đạo. */
export async function proposeLoan(
  loanId: string,
  payload: { proposedAmount: number; proposedInterestRate: number; appraisalFeeRate?: number; note?: string },
): Promise<void> {
  return request(`/loans/${loanId}/propose`, { method: 'PUT', data: payload });
}

/** Cấp 2 — ban lãnh đạo duyệt (interestRate có thể đã được lãnh đạo sửa). */
export async function approveLoan(loanId: string, interestRate: number, notes?: string): Promise<void> {
  return request(`/loans/${loanId}/approve`, {
    method: 'PUT',
    data: { interestRate, reason: notes },
  });
}

export async function rejectLoan(loanId: string, reason: string): Promise<void> {
  return request(`/loans/${loanId}/reject`, {
    method: 'PUT',
    data: { reason },
  });
}

// ─── Lịch trả nợ ────────────────────────────────────────────────────────────

export interface RepaymentScheduleItem {
  periodNumber: number;
  dueDate: string;        // 'YYYY-MM-DD'
  principalDue: number;
  interestDue: number;
  totalDue: number;
  paidAmount: number;
  lateFee?: number | null;
  lateFeeOutstanding?: number | null;
  totalOutstanding?: number | null;
  status: 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE';
  dpd: number;
  paidAt?: string | null;
}

export async function fetchRepaymentSchedule(loanId: string): Promise<RepaymentScheduleItem[]> {
  return request(`/loans/${loanId}/repayments`);
}

// ─── Hợp đồng & giải ngân ───────────────────────────────────────────────────

export interface LoanContract {
  id: string;
  loanId: string;
  loanCode: string | null;
  contractType: 'INVESTMENT' | 'LOAN_AGREEMENT';
  partyId: string;
  offerId: string | null;
  contractNo: string | null;
  amount: number | null;
  interestRate: number | null;
  termMonths: number | null;
  provider: string;
  documentUrl: string | null;
  signedDocumentUrl: string | null;
  status: 'PENDING_SIGNATURE' | 'SIGNED' | 'VOIDED';
  issuedAt: string | null;
  signedAt: string | null;
  signedVia: string | null;
  createdAt: string;
}

export async function fetchLoanContracts(loanId: string): Promise<LoanContract[]> {
  return request(`/loans/${loanId}/contracts`);
}

// ─── Chứng từ & điểm tín dụng ────────────────────────────────────────────────

export interface LoanDocument {
  id: string;
  docType: string;
  fileId: string;
  fileName: string | null;
  createdAt: string | null;
}

export interface CreditScoreDetail {
  criteriaCode: string;
  criteriaName: string;
  component: 'DEMOGRAPHIC' | 'INCOME' | 'CREDIT_HISTORY' | 'PLATFORM' | 'LOAN' | string;
  rawValue: string | null;
  points: number;
  maxPoints: number;
}

export interface ProfileSignal {
  code: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | string;
  source: 'RULE' | 'AI' | string;
  message: string;
}

export interface ProfileAdvisory {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | string;
  summary: string | null;
  signals: ProfileSignal[] | null;
  questionsForAppraiser: string[] | null;
  aiIncluded: boolean;
}

export interface CreditScoreResult {
  id: string;
  userId: string;
  loanRequestId: string | null;
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'E' | string;
  gradePolicy: string | null;
  rawPoints: number;
  maxPoints: number;
  modelVersion: string;
  status: string;
  missingData: string[] | null;
  details: CreditScoreDetail[];
  aiSummary: string | null;
  aiRiskFlags: string[] | null;
  aiRecommendation: string | null;
  profileAdvisory: ProfileAdvisory | null;
  /** Kết quả AI phân tích từng chứng từ — credit-service tự chạy khi chấm điểm */
  documentAnalyses: DocumentAnalysisResult[] | null;
  /** Diễn giải nguyên nhân điểm số — luôn có kể cả khi AI tắt */
  explanation: ScoreExplanation | null;
  /** Cổng loại trừ (chỉ tư vấn): AUTO | MANUAL_REVIEW | HARD_REJECT */
  reviewDirective: 'AUTO' | 'MANUAL_REVIEW' | 'HARD_REJECT' | string | null;
  reviewReasons: string[] | null;
  expiresAt: string | null;
  createdAt: string | null;
}

export interface ScoreDriver {
  criteriaName: string;
  component: string | null;
  points: number;
  maxPoints: number;
  reason: string;
}

export interface MissingDataItem {
  criteriaName: string;
  potentialPoints: number;
  howToObtain: string;
}

export interface DocumentInsight {
  aiEnabled: boolean;
  total: number;
  consistent: number;
  suspicious: number;
  highRisk: number;
  unreadable: number;
  errored: number;
  alerts: string[] | null;
  summary: string | null;
}

export interface ScoreExplanation {
  headline: string;
  suggestedAction: string;
  criteriaWithData: number;
  criteriaTotal: number;
  pointsLostToMissingData: number;
  pointsLostToWeakSignals: number;
  maxPotentialScoreUplift: number;
  negativeDrivers: ScoreDriver[] | null;
  positiveDrivers: ScoreDriver[] | null;
  missingData: MissingDataItem[] | null;
  documents: DocumentInsight | null;
}

export interface DocumentAnalysisResult {
  id: string;
  userId: string;
  loanRequestId: string | null;
  docType: string;
  fileName: string | null;
  fileId: string | null;
  verdict: 'CONSISTENT' | 'SUSPICIOUS' | 'HIGH_RISK' | 'UNREADABLE' | string;
  trustScore: number | null;
  extractedData: string | Record<string, unknown> | null;
  summary: string | null;
  createdAt: string | null;
}

export async function fetchLoanDocuments(loanId: string): Promise<LoanDocument[]> {
  return request(`/loans/${loanId}/documents`);
}

export async function evaluateLoanCreditScore(loanId: string): Promise<CreditScoreResult> {
  return request(`/loans/${loanId}/credit-score`, { method: 'POST' });
}

export async function fetchLatestLoanCreditScore(loanId: string): Promise<CreditScoreResult | null> {
  return request(`/loans/${loanId}/credit-score`);
}

// ─── CIC nhập tay (chờ API CIC sandbox NĐ94) ────────────────────────────────

export interface CicLookup {
  id: string;
  loanId: string;
  debtGroup: number;
  maxDpd: number | null;
  activeLenders: number | null;
  totalOutstanding: number | null;
  inquiriesRecent: number | null;
  checkedAt: string;            // 'YYYY-MM-DD'
  attachmentFileId: string | null;
  note: string | null;
  consentConfirmed: boolean;
  enteredBy: string | null;
  createdAt: string | null;
}

export interface CicLookupInput {
  debtGroup: number;
  maxDpd?: number | null;
  activeLenders?: number | null;
  totalOutstanding?: number | null;
  inquiriesRecent?: number | null;
  checkedAt: string;
  note?: string | null;
  consentConfirmed: boolean;
}

/** Kết quả tra CIC mới nhất của khoản — null nếu chưa nhập. */
export async function fetchCicLookup(loanId: string): Promise<CicLookup | null> {
  return request(`/loans/${loanId}/cic`);
}

/** Thẩm định viên nhập kết quả tra CIC ngoài. */
export async function saveCicLookup(loanId: string, data: CicLookupInput): Promise<CicLookup> {
  return request(`/loans/${loanId}/cic`, { method: 'POST', data });
}

export async function analyzeLoanDocument(loanId: string, documentId: string): Promise<DocumentAnalysisResult> {
  return request(`/loans/${loanId}/documents/${documentId}/analyze`, { method: 'POST' });
}

/** OPS giải ngân vốn cho người gọi vốn: AWAITING_DISBURSEMENT → DISBURSED. */
export async function disburseLoan(loanId: string): Promise<CmsLoan> {
  return request(`/loans/${loanId}/disburse`, { method: 'POST' });
}

/** Kết quả chạy job hết hạn gọi vốn / ký khế ước. */
export interface FundingExpiryResult {
  activeExpired: number;
  activeFailed: number;
  fundedStuck: number;
  fundedFailed: number;
}

/**
 * Chạy ngay job hết hạn (thay vì chờ cron 01:30): khoản ACTIVE quá hạn gọi vốn và FUNDED quá hạn
 * ký khế ước sẽ bị hủy và hoàn tiền cho nhà đầu tư. Chỉ ADMIN/SUPER_ADMIN.
 */
export async function runFundingExpirySweep(): Promise<FundingExpiryResult> {
  return request(`/loans/expire-sweep`, { method: 'POST' });
}

/** Kết quả chạy job thu nợ tự động từ ví người gọi vốn. */
export interface AutoDebitSweepResult {
  auditId: string;
  triggerSource: string;
  triggeredBy?: string;
  startedAt: string;
  finishedAt: string;
  scannedLoans: number;
  dueLoans: number;
  settledFull: number;
  settledPartial: number;
  noBalance: number;
  balanceError: number;
  noDue: number;
  failed: number;
  amountCollected: number | string;
  errorSummary?: string;
}

/** Chạy ngay job thu nợ tự động từ ví người gọi vốn. Chỉ ADMIN/SUPER_ADMIN. */
export async function runAutoDebitSweep(): Promise<AutoDebitSweepResult> {
  return request(`/loans/repayments/auto-debit-sweep`, { method: 'POST' });
}

// ─── Hỗ trợ thẩm định (appraisal suggestion) ────────────────────────────────────
// Engine QĐ-LSGV không còn tự đánh giá tín nhiệm — Credit Score 360 là chuẩn duy nhất.
// Service này chỉ còn: định giá lãi suất/hạn mức (theo hạng Credit 360), năng lực trả nợ,
// lịch trả nợ, checklist thẩm định thủ công.

export interface AppraisalChecklistItem {
  code: string;
  category: string;
  title: string;
  instruction: string;
  required: boolean;
}

export interface FraudCheck {
  code: string;
  severity: 'HIGH' | 'MEDIUM' | 'INFO' | string;
  title: string;
  detail: string;
}

export interface AppraisalSuggestion {
  loanId: string;
  loanCode: string | null;
  status: string;
  requestedAmount: number;
  termMonths: number;
  productGroup: number | null;
  productName: string | null;
  affordability: {
    incomeProvided: boolean;
    monthlyIncome: number | null;
    ptiCap: number;
    requestedInstallment: number | null;
    requestedPti: number | null;
    maxInstallmentByIncome: number | null;
    maxPrincipalByIncome: number | null;
  };
  recommendation: {
    suggestedAmount: number;
    amountCapReason: string;
    suggestedInterestRate: number | null;
    suggestedRateMin: number | null;
    suggestedRateMax: number | null;
    feePercent: number | null;
    connectionFee: number | null;
    serviceAvailable: boolean;
    rateNote: string;
  };
  schedulePreview: {
    method: string;
    periods: number;
    firstInstallment: number;
    totalPrincipal: number;
    totalInterest: number;
    totalPayable: number;
  } | null;
  manualChecklist: AppraisalChecklistItem[];
  autoWarnings: string[];
  /** Cảnh báo gian lận tự động (velocity & trùng chéo đa đầu mối) — chỉ tư vấn. */
  fraudChecks: FraudCheck[] | null;
  disclaimer: string;
}

export async function fetchAppraisalSuggestion(
  loanId: string,
  discouraged = false,
  creditGrade?: string | null,
): Promise<AppraisalSuggestion> {
  const q = new URLSearchParams({ discouraged: String(discouraged) });
  if (creditGrade) q.set('creditGrade', creditGrade);
  return request(`/loans/${loanId}/appraisal-suggestion?${q}`);
}

// ─── Audit Log ───────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  loanId: string;
  loanCode: string | null;
  borrowerId: string | null;
  // Snapshot khoản vay
  requestedAmount: number | null;
  proposedAmount: number | null;
  proposedInterestRate: number | null;
  appraisalFeeRate: number | null;
  proposedBy: string | null;
  finalAmount: number | null;
  finalInterestRate: number | null;
  termMonths: number | null;
  purpose: string | null;
  occupation: string | null;
  monthlyIncome: number | null;
  // Engine thẩm định
  creditScore: number | null;
  creditBand: string | null;
  /** Chỉ có khi gọi fetchAuditLogById — null trong danh sách */
  appraisalSnapshot: AppraisalSuggestion | null;
  // Quyết định
  decision: 'APPROVED' | 'REJECTED';
  rejectionReason: string | null;
  decidedBy: string;
  decidedAt: string;
  deciderRole: string | null;
  appraiserUsername: string | null;
  createdAt: string | null;
}

export async function fetchAuditLogs(params: {
  loanId?: string;
  decision?: string;
  decidedBy?: string;
  page?: number;
  size?: number;
}): Promise<PagedResponse<AuditLogEntry>> {
  const q = new URLSearchParams();
  if (params.loanId)    q.set('loanId',    params.loanId);
  if (params.decision)  q.set('decision',  params.decision);
  if (params.decidedBy) q.set('decidedBy', params.decidedBy);
  q.set('page', String(params.page ?? 0));
  q.set('size', String(params.size ?? 20));
  return request(`/audit/loans?${q}`);
}

export async function fetchAuditLogById(id: string): Promise<AuditLogEntry> {
  return request(`/audit/loans/${id}`);
}

// ─── File proxy ──────────────────────────────────────────────────────────────

/** Fetch ảnh KYC qua CMS backend proxy (có JWT). Trả về blob URL để dùng trong <img src>. */
export async function fetchFileBlob(fileId: string): Promise<string> {
  const res = await axiosClient.get<Blob>(`/files/${encodeURIComponent(fileId)}`, {
    responseType: 'blob',
  });
  return URL.createObjectURL(res.data);
}

// ─── Loan Products ───────────────────────────────────────────────────────────

export interface LoanProduct {
  id: string;
  code: string;
  name: string;
  category: 'INDIVIDUAL' | 'BUSINESS' | string;
  productGroup: number;
  professionBound: boolean;
  description: string | null;
  minAmount: number;
  maxAmount: number;
  availableTerms: number[];
  imageUrl: string | null;
  maxInterestRate: number | null;
  lateFeeRate: number | null;
  sortOrder: number;
}

export async function fetchLoanProducts(): Promise<LoanProduct[]> {
  return request('/loans/products');
}

export interface LoanProductUpdatePayload {
  name: string;
  description: string | null;
  minAmount: number;
  maxAmount: number;
  availableTerms: number[];
  maxInterestRate: number | null;
  lateFeeRate: number | null;
  sortOrder: number;
  active: boolean;
}

export async function updateLoanProduct(id: string, payload: LoanProductUpdatePayload): Promise<LoanProduct> {
  return request(`/loans/products/${id}`, { method: 'PUT', data: payload });
}

// ─── Push Notification ───────────────────────────────────────────────────────

export async function getFcmDeviceCount(): Promise<{ count: number }> {
  return request('/notifications/fcm-devices');
}

export async function sendTestPush(title: string, body: string): Promise<{ sentTo: number; pushResponse?: string; message?: string }> {
  return request('/notifications/test-push', {
    method: 'POST',
    data: { title, body },
  });
}

// ─── Withdrawal Monitoring ───────────────────────────────────────────────────

export type WithdrawalMonitorStatus =
  | 'INITIATED' | 'OTP_PENDING' | 'FUNDS_LOCKED'
  | 'TRANSFER_INITIATED' | 'PROCESSING' | 'COMPLETED'
  | 'TRANSFER_FAILED' | 'FUNDS_RELEASED' | 'FAILED' | 'CANCELLED';

export interface WithdrawalSummary {
  id: string;
  userId: string;
  customerPhone: string | null;
  customerName: string | null;
  amount: number;
  bankName: string | null;
  bankAccountNo: string | null;
  status: WithdrawalMonitorStatus;
  statusLabel: string;
  transferRef: string | null;
  providerTransferRef: string | null;
  mbFtNumber: string | null;
  failureReason: string | null;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
  updatedAt: string;
}

export async function fetchWithdrawalsForMonitoring(params: {
  statuses?: WithdrawalMonitorStatus[];
  page?: number;
  size?: number;
}): Promise<PagedResponse<WithdrawalSummary>> {
  const q = new URLSearchParams();
  (params.statuses ?? []).forEach(s => q.append('statuses', s));
  q.set('page', String(params.page ?? 0));
  q.set('size', String(params.size ?? 20));
  return request(`/withdrawals/monitoring?${q}`);
}

export async function retryWithdrawal(withdrawalId: string): Promise<{ message: string }> {
  return request(`/withdrawals/${withdrawalId}/retry`, { method: 'POST' });
}

export interface ResolveWithdrawalPayload {
  wasSent: boolean;
  ftNumber?: string;
  note?: string;
}

export async function resolveWithdrawal(
  withdrawalId: string,
  payload: ResolveWithdrawalPayload,
): Promise<{ message: string }> {
  return request(`/withdrawals/${withdrawalId}/resolve`, { method: 'POST', data: payload });
}

// ─── Reconciliation ──────────────────────────────────────────────────────────

export interface ReconciliationSession {
  id: string;
  reconDate: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  totalItems: number;
  openItems: number;
  runBy: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReconciliationItem {
  id: string;
  sessionId: string;
  itemType: 'STALE_DEPOSIT' | 'STALE_WITHDRAWAL' | 'WITHDRAWAL_MB_MISMATCH' | 'FAILED_WITHDRAWAL_MB_SUCCESS';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  walletId: string | null;
  transactionId: string | null;
  referenceId: string | null;
  externalRef: string | null;
  vnfiteStatus: string | null;
  mbStatus: string | null;
  amount: number | null;
  description: string | null;
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED';
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  createdAt: string;
}

export async function runReconciliation(date: string): Promise<ReconciliationSession> {
  return request(`/reconciliation/run?date=${date}`, { method: 'POST' });
}

export async function fetchReconciliationSessions(page = 0, size = 20): Promise<PagedResponse<ReconciliationSession>> {
  return request(`/reconciliation/sessions?page=${page}&size=${size}`);
}

export async function fetchReconciliationItems(
  sessionId: string,
  status?: string,
  page = 0,
  size = 50,
): Promise<PagedResponse<ReconciliationItem>> {
  const q = new URLSearchParams({ page: String(page), size: String(size) });
  if (status) q.set('status', status);
  return request(`/reconciliation/sessions/${sessionId}/items?${q}`);
}

export async function resolveReconciliationItem(itemId: string, notes: string): Promise<void> {
  return request(`/reconciliation/items/${itemId}/resolve`, { method: 'PUT', data: { notes } });
}

export async function markReconciliationItemInvestigating(itemId: string): Promise<void> {
  return request(`/reconciliation/items/${itemId}/investigate`, { method: 'PUT' });
}
