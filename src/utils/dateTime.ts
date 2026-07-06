export const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
const EXPLICIT_TIME_ZONE_PATTERN = /(Z|[+-]\d{2}:?\d{2})$/i;
const pad2 = (value: string | number): string => String(value).padStart(2, '0');

/** Backend LocalDateTime không có offset được hiểu thống nhất là giờ Việt Nam. */
export function parseVietnamDateTime(value: string): Date {
  const input = value.trim();
  const dateOnly = DATE_ONLY_PATTERN.exec(input);
  if (dateOnly) {
    return new Date(`${dateOnly[1]}-${pad2(dateOnly[2])}-${pad2(dateOnly[3])}T00:00:00+07:00`);
  }

  const normalized = input
    .replace(' ', 'T')
    .replace(/(\.\d{3})\d+/, '$1');
  return new Date(EXPLICIT_TIME_ZONE_PATTERN.test(normalized) ? normalized : `${normalized}+07:00`);
}

export function formatVietnamDate(value: string | null | undefined, fallback = '—'): string {
  if (!value) return fallback;
  const dateOnly = DATE_ONLY_PATTERN.exec(value.trim());
  if (dateOnly) return `${pad2(dateOnly[3])}/${pad2(dateOnly[2])}/${dateOnly[1]}`;

  const date = parseVietnamDateTime(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: VIETNAM_TIME_ZONE,
  });
}

export function formatVietnamDateTime(value: string | null | undefined, fallback = '—'): string {
  if (!value) return fallback;
  const date = parseVietnamDateTime(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour12: false,
    timeZone: VIETNAM_TIME_ZONE,
  });
}

export function todayVietnamDateString(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: VIETNAM_TIME_ZONE,
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

/**
 * Đổi giá trị datetime (ISO có offset, hoặc LocalDateTime backend hiểu là giờ VN)
 * sang chuỗi cho input `datetime-local`, luôn theo giờ Việt Nam — không phụ
 * thuộc múi giờ hệ điều hành/trình duyệt admin.
 */
export function toVietnamLocalInputValue(value: string | null | undefined): string {
  if (!value) return '';
  const date = parseVietnamDateTime(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: VIETNAM_TIME_ZONE,
  }).formatToParts(date);
  const v = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${v.year}-${v.month}-${v.day}T${v.hour}:${v.minute}`;
}

/**
 * Đổi ngược giá trị input `datetime-local` (đã là giờ VN theo
 * toVietnamLocalInputValue) sang chuỗi LocalDateTime gửi backend — không cộng/trừ
 * offset vì giá trị nhập vào đã đúng là giờ Việt Nam.
 */
export function fromVietnamLocalInputValue(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.length === 16 ? `${value}:00` : value;
}
