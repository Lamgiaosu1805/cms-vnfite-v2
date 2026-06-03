interface BadgeProps {
  value: string | null | undefined;
  type?: 'status' | 'kyc' | 'loan';
}

const colorMap: Record<string, string> = {
  // KYC
  none: 'bg-gray-100 text-gray-500',
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  // Account status
  active: 'bg-green-100 text-green-700',
  suspended: 'bg-orange-100 text-orange-700',
  locked: 'bg-red-100 text-red-700',
  // Loan status
  pending_review: 'bg-gray-100 text-gray-600',
  awaiting_borrower_approval: 'bg-blue-100 text-blue-700',
  funded: 'bg-indigo-100 text-indigo-700',
  repaying: 'bg-teal-100 text-teal-700',
  completed: 'bg-green-100 text-green-700',
  defaulted: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-200 text-gray-500',
};

const labelMap: Record<string, string> = {
  none: 'Chưa KYC',
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
  active: 'Hoạt động',
  suspended: 'Tạm khoá',
  locked: 'Khoá',
  pending_review: 'Chờ thẩm định',
  awaiting_borrower_approval: 'Chờ người vay xác nhận',
  funded: 'Đã fund',
  repaying: 'Đang trả',
  completed: 'Hoàn thành',
  defaulted: 'Mất khả năng trả',
  cancelled: 'Đã huỷ',
};

export function Badge({ value }: BadgeProps) {
  const key = String(value || '').toLowerCase();
  const color = colorMap[key] || 'bg-gray-100 text-gray-500';
  const label = labelMap[key] || value || '-';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}
