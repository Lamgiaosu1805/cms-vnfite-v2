interface BadgeProps {
  value: string | null | undefined;
}

const colorMap: Record<string, string> = {
  none: 'bg-gray-100 text-gray-500',
  pending: 'bg-amber-50 text-amber-700 border border-amber-200',
  approved: 'bg-green-50 text-green-700 border border-green-200',
  rejected: 'bg-red-50 text-red-700 border border-red-200',
  active: 'bg-green-50 text-green-700 border border-green-200',
  suspended: 'bg-orange-50 text-orange-700 border border-orange-200',
  locked: 'bg-red-50 text-red-700 border border-red-200',
  pending_review: 'bg-gray-100 text-gray-600',
  pending_approval: 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800',
  awaiting_borrower_approval: 'bg-blue-50 text-blue-700 border border-blue-200',
  funded: 'bg-purple-50 text-purple-700 border border-purple-200',
  repaying: 'bg-teal-50 text-teal-700 border border-teal-200',
  completed: 'bg-green-50 text-green-700 border border-green-200',
  defaulted: 'bg-red-50 text-red-700 border border-red-200',
  cancelled: 'bg-gray-100 text-gray-500',
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
  pending_approval: 'Chờ lãnh đạo duyệt',
  awaiting_borrower_approval: 'Chờ xác nhận',
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
