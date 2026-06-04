import axios, { type InternalAxiosRequestConfig, type AxiosResponse, type AxiosError } from 'axios';

// Dùng relative URL để Vite proxy forward /cms → http://42.113.122.119:7080 (tránh CORS khi dev)
// Khi build production, deploy cùng domain hoặc set VITE_API_BASE qua env
const BASE_URL = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/cms';

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
  (err: AxiosError<{ message?: string; error?: string; detail?: string }>) => {
    const status = err.response?.status ?? 0;
    const url = err.config?.url ?? '';
    // Auth endpoints: 401/403 là lỗi nghiệp vụ (sai mật khẩu, sai OTP) — KHÔNG redirect
    // Các endpoint khác: 401/403 nghĩa là session hết hạn → xóa session + reload về login
    const isAuthEndpoint = url.includes('/auth/');
    if ((status === 401 || status === 403) && !isAuthEndpoint) {
      const hadSession = !!localStorage.getItem('cms_token');
      localStorage.removeItem('cms_token');
      localStorage.removeItem('cms_admin');
      if (hadSession) {
        window.location.reload();
        return new Promise(() => {});
      }
    }
    const body = err.response?.data;
    const message = body?.message || body?.error || body?.detail || `Lỗi ${status}`;
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

/** Bước 1: xác thực mật khẩu → nhận pendingToken */
export async function login(username: string, password: string): Promise<LoginInitResult> {
  return request<LoginInitResult>('/auth/login', {
    method: 'POST',
    data: { username, password },
  });
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

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  pendingKycCount: number;
  todayNewUsers: number;
  totalLoans: number;
  pendingLoans: number;
  activeLoans: number;
  fundedLoans: number;
  totalFundedVolume: number;
  todayNewLoans: number;
  todayLoanVolume: number;
}

export interface ChartPoint {
  date: string;
  label: string;
  newUsers: number;
  newLoans: number;
  loanVolume: number;
}

export type ChartPeriod = 'day' | 'week' | 'month';

export async function fetchStats(): Promise<DashboardStats> {
  return request('/dashboard/stats');
}

export async function fetchChart(period: ChartPeriod = 'day'): Promise<{ points: ChartPoint[] }> {
  return request(`/dashboard/chart?period=${period}`);
}

// ─── Users ────────────────────────────────────────────────────────────────────

export interface CmsUser {
  userId: string;
  phone: string;
  email: string | null;
  fullName: string | null;
  role: string;
  kycStatus: string;
  accountStatus: string;
  createdAt: string;
}

export interface PagedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
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
  amount: number;
  /** Null khi mới tạo — CMS admin set khi approve */
  interestRate: number | null;
  termMonths: number;
  purpose: string | null;
  occupation: string | null;
  monthlyIncome: number | null;
  currentAddress: string | null;
  status: string;
  rejectionReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export async function fetchLoans(params: {
  status?: string;
  page?: number;
  size?: number;
}): Promise<PagedResponse<CmsLoan>> {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  q.set('page', String(params.page ?? 0));
  q.set('size', String(params.size ?? 20));
  return request(`/loans?${q}`);
}

export async function approveLoan(loanId: string, proposedInterestRate: number, notes?: string): Promise<void> {
  return request(`/loans/${loanId}/approve`, {
    method: 'POST',
    data: { proposedInterestRate, notes },
  });
}

export async function rejectLoan(loanId: string, reason: string): Promise<void> {
  return request(`/loans/${loanId}/reject`, {
    method: 'POST',
    data: { reason },
  });
}
