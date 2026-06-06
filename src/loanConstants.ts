export const LOAN_STATUS_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: 'PENDING_REVIEW', label: 'Chờ thẩm định' },
  { value: 'PENDING_APPROVAL', label: 'Chờ lãnh đạo duyệt' },
  { value: 'AWAITING_BORROWER_APPROVAL', label: 'Chờ xác nhận' },
  { value: 'ACTIVE', label: 'Đang gọi vốn' },
  { value: 'FUNDED', label: 'Đã fund' },
  { value: 'REPAYING', label: 'Đang trả' },
  { value: 'COMPLETED', label: 'Hoàn thành' },
  { value: 'REJECTED', label: 'Từ chối' },
  { value: 'CANCELLED', label: 'Đã huỷ' },
] as const;

export type LoanStatusFilter = (typeof LOAN_STATUS_OPTIONS)[number]['value'];

export function loanStatusLabel(status: string) {
  return LOAN_STATUS_OPTIONS.find(item => item.value === status)?.label ?? 'Tất cả';
}
