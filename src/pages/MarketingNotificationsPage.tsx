import { useEffect, useState } from 'react';
import {
  fetchMarketingCampaigns,
  createMarketingCampaign,
  cancelMarketingCampaign,
  type MarketingCampaignItem,
  type MarketingCampaignPayload,
  type MarketingCampaignType,
  type MarketingSendMode,
  type MarketingSegmentKycStatus,
} from '../api/client';
import { formatVietnamDateTime, formatVietnamDate } from '../utils/dateTime';
import { AlertCircle, Loader2, Send } from 'lucide-react';

const TYPE_LABELS: Record<MarketingCampaignType, string> = {
  SYSTEM: 'Hệ thống',
  PROMOTION: 'Khuyến mại',
};

const SEGMENT_LABELS: Record<string, string> = {
  '': 'Tất cả người dùng',
  APPROVED: 'Đã xác thực KYC',
  PENDING: 'Đang chờ KYC',
  NONE: 'Chưa nộp KYC',
  REJECTED: 'KYC bị từ chối',
};

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Đang chờ gửi',
  COMPLETED: 'Đã hoàn tất',
  CANCELLED: 'Đã hủy',
  FAILED: 'Lỗi',
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  SCHEDULED: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  COMPLETED: 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  CANCELLED: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  FAILED: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400',
};

function emptyForm(): MarketingCampaignPayload {
  return {
    title: '',
    body: '',
    campaignType: 'SYSTEM',
    segmentKycStatus: '',
    sendMode: 'NOW',
    scheduledTime: '',
    startDate: '',
    endDate: '',
  };
}

export default function MarketingNotificationsPage() {
  const [campaigns, setCampaigns] = useState<MarketingCampaignItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [form, setForm] = useState<MarketingCampaignPayload>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [cancellingId, setCancellingId] = useState<string | null>(null);

  async function loadCampaigns() {
    setLoading(true);
    setListError(null);
    try {
      const result = await fetchMarketingCampaigns(0, 50);
      setCampaigns(result.content);
    } catch (err: unknown) {
      setListError(err instanceof Error ? err.message : 'Không thể kết nối với máy chủ. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCampaigns();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!form.title.trim() || !form.body.trim()) {
      setFormError('Vui lòng nhập đủ tiêu đề và nội dung.');
      return;
    }
    if (form.sendMode === 'SCHEDULED') {
      if (!form.scheduledTime || !form.startDate || !form.endDate) {
        setFormError('Đặt lịch cần đủ giờ gửi, ngày bắt đầu và ngày kết thúc.');
        return;
      }
      if (form.endDate < form.startDate) {
        setFormError('Ngày kết thúc phải từ ngày bắt đầu trở đi.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload: MarketingCampaignPayload = {
        ...form,
        segmentKycStatus: form.segmentKycStatus || null,
        scheduledTime: form.sendMode === 'SCHEDULED' ? form.scheduledTime : null,
        startDate: form.sendMode === 'SCHEDULED' ? form.startDate : null,
        endDate: form.sendMode === 'SCHEDULED' ? form.endDate : null,
      };
      await createMarketingCampaign(payload);
      setForm(emptyForm());
      await loadCampaigns();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Không thể kết nối với máy chủ. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(campaign: MarketingCampaignItem) {
    if (!window.confirm(`Hủy campaign "${campaign.title}"? Sẽ không còn tự động gửi nữa.`)) return;
    setCancellingId(campaign.id);
    try {
      await cancelMarketingCampaign(campaign.id);
      await loadCampaigns();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Không thể kết nối với máy chủ. Vui lòng thử lại.');
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Thông báo marketing</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Bắn thông báo hệ thống hoặc khuyến mại tới người dùng — gửi ngay hoặc đặt lịch lặp lại hằng ngày trong một khoảng ngày.
        </p>
      </div>

      {/* Form tạo campaign */}
      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-4"
      >
        {formError && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {formError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Loại thông báo</label>
            <select
              value={form.campaignType}
              onChange={e => setForm(f => ({ ...f, campaignType: e.target.value as MarketingCampaignType }))}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
            >
              <option value="SYSTEM">Hệ thống</option>
              <option value="PROMOTION">Khuyến mại</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Đối tượng nhận</label>
            <select
              value={form.segmentKycStatus ?? ''}
              onChange={e => setForm(f => ({ ...f, segmentKycStatus: e.target.value as MarketingSegmentKycStatus }))}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
            >
              <option value="">Tất cả người dùng</option>
              <option value="APPROVED">Đã xác thực KYC</option>
              <option value="PENDING">Đang chờ KYC</option>
              <option value="NONE">Chưa nộp KYC</option>
              <option value="REJECTED">KYC bị từ chối</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tiêu đề</label>
          <input
            type="text"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            maxLength={255}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
            placeholder="Ví dụ: Ưu đãi đầu tư tháng 7"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nội dung</label>
          <textarea
            value={form.body}
            onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
            maxLength={1000}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
            placeholder="Nội dung thông báo gửi tới người dùng"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Chế độ gửi</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                checked={form.sendMode === 'NOW'}
                onChange={() => setForm(f => ({ ...f, sendMode: 'NOW' as MarketingSendMode }))}
              />
              Gửi ngay
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                checked={form.sendMode === 'SCHEDULED'}
                onChange={() => setForm(f => ({ ...f, sendMode: 'SCHEDULED' as MarketingSendMode }))}
              />
              Đặt lịch
            </label>
          </div>
        </div>

        {form.sendMode === 'SCHEDULED' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Giờ gửi</label>
              <input
                type="time"
                value={form.scheduledTime ?? ''}
                onChange={e => setForm(f => ({ ...f, scheduledTime: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Từ ngày</label>
              <input
                type="date"
                value={form.startDate ?? ''}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Đến ngày</label>
              <input
                type="date"
                value={form.endDate ?? ''}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
              />
            </div>
            <p className="sm:col-span-3 text-xs text-gray-500 dark:text-gray-400">
              Sẽ tự động gửi lặp lại mỗi ngày trong khoảng đã chọn, đúng vào giờ đã đặt.
            </p>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-[#C82020] to-[#8B0A0A] text-white text-sm font-medium disabled:opacity-60"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {form.sendMode === 'NOW' ? 'Gửi ngay' : 'Đặt lịch'}
          </button>
        </div>
      </form>

      {/* Danh sách campaign */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {listError && (
          <div className="flex items-center gap-2 px-4 py-3 text-red-700 dark:text-red-400 text-sm border-b border-gray-100 dark:border-gray-800">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {listError}
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400 dark:text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-500 dark:text-gray-400">
            Chưa có campaign nào.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-left text-gray-500 dark:text-gray-400">
                  <th className="px-4 py-3 font-medium">Tiêu đề</th>
                  <th className="px-4 py-3 font-medium">Loại</th>
                  <th className="px-4 py-3 font-medium">Đối tượng</th>
                  <th className="px-4 py-3 font-medium">Lịch gửi</th>
                  <th className="px-4 py-3 font-medium">Trạng thái</th>
                  <th className="px-4 py-3 font-medium">Đã gửi</th>
                  <th className="px-4 py-3 font-medium">Ngày tạo</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map(c => (
                  <tr key={c.id} className="border-b border-gray-50 dark:border-gray-800/60 text-gray-800 dark:text-gray-200">
                    <td className="px-4 py-3 max-w-xs">
                      <div className="font-medium truncate">{c.title}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{c.body}</div>
                    </td>
                    <td className="px-4 py-3">{TYPE_LABELS[c.campaignType] ?? c.campaignType}</td>
                    <td className="px-4 py-3">{SEGMENT_LABELS[c.segmentKycStatus ?? ''] ?? c.segmentKycStatus}</td>
                    <td className="px-4 py-3 text-xs">
                      {c.sendMode === 'NOW' ? (
                        'Gửi ngay'
                      ) : (
                        <>
                          {c.scheduledTime?.slice(0, 5)} · {formatVietnamDate(c.startDate)} → {formatVietnamDate(c.endDate)}
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE_CLASSES[c.status] ?? ''}`}>
                        {STATUS_LABELS[c.status] ?? c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{c.totalSentCount}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {formatVietnamDateTime(c.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.status === 'SCHEDULED' && (
                        <button
                          onClick={() => handleCancel(c)}
                          disabled={cancellingId === c.id}
                          className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline disabled:opacity-60"
                        >
                          Hủy
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
