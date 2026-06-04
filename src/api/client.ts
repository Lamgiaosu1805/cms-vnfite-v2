// Dùng relative URL để Vite proxy forward /cms → http://42.113.122.119:7080 (tránh CORS khi dev)
// Khi build production, deploy cùng domain hoặc set VITE_API_BASE qua env
const BASE_URL = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/cms';

function getToken(): string | null {
  return localStorage.getItem('cms_token');
}

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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    let message = `Lỗi ${res.status}`;
    try {
      const body = await res.json();
      message = body.message || body.error || message;
    } catch { /* ignore */ }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface LoginResult {
  admin: AdminInfo;
  mustChangePassword: boolean;
}

export async function checkSetupRequired(): Promise<boolean> {
  const data = await request<{ setupRequired: boolean }>('/auth/setup/status');
  return data.setupRequired;
}

export async function setupSuperAdmin(payload: {
  username: string; email: string; fullName: string; password: string;
}): Promise<void> {
  return request('/auth/setup', { method: 'POST', body: JSON.stringify(payload) });
}

export async function login(username: string, password: string): Promise<LoginResult> {
  const data = await request<{
    accessToken: string; admin: AdminInfo; mustChangePassword: boolean;
  }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  saveSession(data.accessToken, data.admin);
  return { admin: data.admin, mustChangePassword: data.mustChangePassword };
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return request('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
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
  return request('/admins', { method: 'POST', body: JSON.stringify(payload) });
}

export async function toggleAdminActive(id: string): Promise<void> {
  return request(`/admins/${id}/toggle-active`, { method: 'PUT' });
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalUsers: number;
  pendingKycCount: number;
  totalLoans: number;
  totalFundedVolume: number;
  activeLoans: number;
  newUsersToday: number;
}

export interface ChartPoint {
  date: string;
  newUsers: number;
  newLoans: number;
  loanVolume: number;
}

export async function fetchStats(): Promise<DashboardStats> {
  return request('/dashboard/stats');
}

export async function fetchChart(): Promise<{ points: ChartPoint[] }> {
  return request('/dashboard/chart');
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
    body: JSON.stringify({ decision, reason }),
  });
}

export async function updateUserStatus(userId: string, status: string): Promise<void> {
  return request(`/users/${userId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
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
    body: JSON.stringify({ proposedInterestRate, notes }),
  });
}

export async function rejectLoan(loanId: string, reason: string): Promise<void> {
  return request(`/loans/${loanId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}
