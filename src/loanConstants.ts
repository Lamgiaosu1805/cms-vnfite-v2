export const LOAN_STATUS_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: 'PENDING_REVIEW', label: 'Chờ thẩm định' },
  { value: 'PENDING_APPROVAL', label: 'Chờ lãnh đạo duyệt' },
  { value: 'AWAITING_BORROWER_APPROVAL', label: 'Chờ xác nhận' },
  { value: 'ACTIVE', label: 'Đang gọi vốn' },
  { value: 'FUNDED', label: 'Đã đủ vốn — chờ ký HĐ' },
  { value: 'AWAITING_DISBURSEMENT', label: 'Chờ giải ngân' },
  { value: 'DISBURSED', label: 'Đã giải ngân' },
  { value: 'REPAYING', label: 'Đang thanh toán' },
  { value: 'COMPLETED', label: 'Hoàn thành' },
  { value: 'DEFAULTED', label: 'Quá hạn' },
  { value: 'REJECTED', label: 'Từ chối' },
  { value: 'CANCELLED', label: 'Đã huỷ' },
] as const;

export type LoanStatusFilter = (typeof LOAN_STATUS_OPTIONS)[number]['value'];

export function loanStatusLabel(status: string) {
  return LOAN_STATUS_OPTIONS.find(item => item.value === status)?.label ?? 'Tất cả';
}

/** Nhãn hiển thị cho loại + trạng thái hợp đồng. */
export const CONTRACT_TYPE_LABEL: Record<string, string> = {
  INVESTMENT: 'Hợp đồng đầu tư',
  LOAN_AGREEMENT: 'Hợp đồng vay',
};

export const CONTRACT_STATUS_LABEL: Record<string, string> = {
  PENDING_SIGNATURE: 'Chờ ký',
  SIGNED: 'Đã ký',
  VOIDED: 'Đã huỷ',
};
