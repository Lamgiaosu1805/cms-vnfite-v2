import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Briefcase, Download, Edit3, Eye, ImagePlus, Loader2, MapPin,
  Plus, Save, Search, Trash2, Users, X,
} from 'lucide-react';
import { RichTextEditor, useArticleEditor } from '../components/editor/RichTextEditor';
import {
  createJobPosting,
  deleteJobApplication,
  deleteJobImage,
  deleteJobPosting,
  downloadJobApplicationCv,
  fetchJobApplications,
  fetchJobPosting,
  fetchJobPostings,
  updateJobPosting,
  uploadJobImage,
  type JobApplicationItem,
  type JobPostingItem,
  type JobPostingPayload,
  type JobPostingStatus,
} from '../api/client';
import { formatVietnamDateTime, fromVietnamLocalInputValue, toVietnamLocalInputValue } from '../utils/dateTime';

const LOCATIONS = ['Hà Nội', 'TP.HCM', 'Đà Nẵng'] as const;
const INDUSTRY_TYPES = [
  { value: 'IT', label: 'IT' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'HR', label: 'HR' },
  { value: 'BUSINESS', label: 'Business' },
] as const;

const STATUS_LABEL: Record<JobPostingStatus, string> = {
  ACTIVE: 'Đang tuyển',
  INACTIVE: 'Ngừng tuyển',
};

const EMPTY_FORM: JobPostingPayload = {
  title: '',
  position: '',
  salary: '',
  locations: '',
  industryType: '',
  workingForm: '',
  experience: '',
  workModel: '',
  degree: '',
  description: '',
  imageUrl: '',
  status: 'ACTIVE',
  publishedAt: '',
};

export function RecruitmentManagementPage() {
  const [subTab, setSubTab] = useState<'postings' | 'applications'>('postings');

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-800 dark:bg-gray-950">
        <SubTabButton active={subTab === 'postings'} onClick={() => setSubTab('postings')} icon={<Briefcase size={15} />}>
          Tin tuyển dụng
        </SubTabButton>
        <SubTabButton active={subTab === 'applications'} onClick={() => setSubTab('applications')} icon={<Users size={15} />}>
          Hồ sơ ứng tuyển
        </SubTabButton>
      </div>

      {subTab === 'postings' ? <JobPostingsTab /> : <JobApplicationsTab />}
    </div>
  );
}

function SubTabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
        active
          ? 'bg-red-600 text-white'
          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-900'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

// ─── Tab 1: Tin tuyển dụng ─────────────────────────────────────────────────────

function JobPostingsTab() {
  const [items, setItems] = useState<JobPostingItem[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [status, setStatus] = useState<JobPostingStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editorState, setEditorState] = useState<{ mode: 'create' | 'edit'; id?: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<JobPostingItem | null>(null);
  const [detailPreview, setDetailPreview] = useState<JobPostingItem | null>(null);

  const load = async (nextPage = page) => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchJobPostings({ page: nextPage, size: 20, status });
      setItems(data.content ?? []);
      setPage(data.page ?? nextPage);
      setTotalPages(data.totalPages ?? 0);
      setTotalElements(data.totalElements ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách tin tuyển dụng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(0); }, [status]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteJobPosting(deleteTarget.id);
      setDeleteTarget(null);
      load(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không xóa được tin tuyển dụng');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-50">Tin tuyển dụng</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{totalElements} tin đăng trên website VNFITE</p>
        </div>
        <button
          type="button"
          onClick={() => setEditorState({ mode: 'create' })}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
        >
          <Plus size={16} /> Tạo tin tuyển dụng
        </button>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
          <Search size={16} /> Bộ lọc
        </div>
        <select
          value={status}
          onChange={e => setStatus(e.target.value as JobPostingStatus | '')}
          className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-red-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="ACTIVE">Đang tuyển</option>
          <option value="INACTIVE">Ngừng tuyển</option>
        </select>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Tin tuyển dụng</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Địa điểm</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Trạng thái</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Ngày đăng</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                  <Loader2 className="mx-auto mb-2 animate-spin" size={22} /> Đang tải tin tuyển dụng...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">Chưa có tin tuyển dụng.</td>
              </tr>
            ) : items.map(item => (
              <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/70">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-16 w-24 overflow-hidden rounded-lg border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-gray-900">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-gray-400 dark:text-gray-600">
                          <Briefcase size={20} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm font-semibold text-gray-900 dark:text-gray-50">{item.title}</p>
                      {item.position && <p className="mt-1 line-clamp-1 text-xs text-gray-500 dark:text-gray-400">{item.position}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
                    <MapPin size={13} /> {item.locations.join(', ') || '—'}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={(item.status as JobPostingStatus) || 'ACTIVE'} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                  {formatVietnamDateTime(item.publishedAt, '-')}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <IconButton title="Xem trước" onClick={() => setDetailPreview(item)}><Eye size={15} /></IconButton>
                    <IconButton title="Sửa" onClick={() => setEditorState({ mode: 'edit', id: item.id })}><Edit3 size={15} /></IconButton>
                    <IconButton title="Xóa" danger onClick={() => setDeleteTarget(item)}><Trash2 size={15} /></IconButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
        <button
          type="button"
          disabled={page <= 0}
          onClick={() => load(page - 1)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
        >
          Trang trước
        </button>
        <span>Trang {totalPages === 0 ? 0 : page + 1}/{totalPages}</span>
        <button
          type="button"
          disabled={totalPages === 0 || page >= totalPages - 1}
          onClick={() => load(page + 1)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
        >
          Trang sau
        </button>
      </div>

      {editorState && (
        <JobPostingEditorModal
          state={editorState}
          onClose={() => setEditorState(null)}
          onSaved={() => {
            setEditorState(null);
            load(page);
          }}
        />
      )}
      {deleteTarget && (
        <ConfirmModal
          title="Xóa tin tuyển dụng"
          message={`Xóa tin "${deleteTarget.title}" khỏi danh sách tuyển dụng?`}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
      {detailPreview && (
        <JobPostingPreviewModal item={detailPreview} onClose={() => setDetailPreview(null)} />
      )}
    </div>
  );
}

function JobPostingEditorModal({ state, onClose, onSaved }: {
  state: { mode: 'create' | 'edit'; id?: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<JobPostingPayload>(EMPTY_FORM);
  const [loading, setLoading] = useState(state.mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const coverInputRef = useRef<HTMLInputElement>(null);
  const inlineInputRef = useRef<HTMLInputElement>(null);
  const uploadedThisSessionRef = useRef<Set<string>>(new Set());
  const editor = useArticleEditor({
    placeholder: 'Soạn mô tả công việc, yêu cầu, quyền lợi…',
    onUpdate: html => setForm(prev => ({ ...prev, description: html })),
  });

  useEffect(() => {
    let cancelled = false;
    if (state.mode === 'create') {
      setForm({ ...EMPTY_FORM, publishedAt: toVietnamLocalInputValue(new Date().toISOString()) });
      editor?.commands.setContent('');
      return;
    }
    if (!state.id) return;
    setLoading(true);
    fetchJobPosting(state.id)
      .then(item => {
        if (cancelled) return;
        const nextForm: JobPostingPayload = {
          title: item.title ?? '',
          position: item.position ?? '',
          salary: item.salary ?? '',
          locations: (item.locations ?? []).join(','),
          industryType: item.industryType ?? '',
          workingForm: item.workingForm ?? '',
          experience: item.experience ?? '',
          workModel: item.workModel ?? '',
          degree: item.degree ?? '',
          description: item.description ?? '',
          imageUrl: item.imageUrl ?? '',
          status: (item.status as JobPostingStatus) || 'ACTIVE',
          publishedAt: toVietnamLocalInputValue(item.publishedAt),
        };
        setForm(nextForm);
        editor?.commands.setContent(nextForm.description ?? '');
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Không tải được tin tuyển dụng'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [state.id, state.mode, editor]);

  const previewHtml = useMemo(() => form.description || '<p></p>', [form.description]);
  const selectedLocations = useMemo(
    () => (form.locations ?? '').split(',').map(v => v.trim()).filter(Boolean),
    [form.locations],
  );

  const toggleLocation = (location: string) => {
    const next = selectedLocations.includes(location)
      ? selectedLocations.filter(v => v !== location)
      : [...selectedLocations, location];
    setForm(prev => ({ ...prev, locations: next.join(',') }));
  };

  const uploadImage = async (file: File, mode: 'cover' | 'inline') => {
    setUploading(true);
    setError('');
    try {
      const { url } = await uploadJobImage(file);
      uploadedThisSessionRef.current.add(url);
      if (mode === 'cover') {
        setForm(prev => ({ ...prev, imageUrl: url }));
      } else {
        editor?.chain().focus().setImage({ src: url }).run();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không upload được ảnh');
    } finally {
      setUploading(false);
    }
  };

  /** Xóa (best-effort) các ảnh đã upload trong phiên này nhưng không nằm trong nội dung/ảnh bìa cuối cùng được giữ lại. */
  const cleanupOrphanedUploads = (keepUrls: Set<string>) => {
    const orphans = [...uploadedThisSessionRef.current].filter(url => !keepUrls.has(url));
    uploadedThisSessionRef.current.clear();
    orphans.forEach(url => { deleteJobImage(url).catch(() => undefined); });
  };

  const extractContentImageUrls = (html: string): string[] => {
    const urls: string[] = [];
    const regex = /<img[^>]+src="([^"]+)"/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(html))) urls.push(match[1]);
    return urls;
  };

  const handleClose = () => {
    cleanupOrphanedUploads(new Set());
    onClose();
  };

  const submit = async () => {
    if (!form.title.trim()) {
      setError('Vui lòng nhập tiêu đề');
      return;
    }
    setSaving(true);
    setError('');
    const payload: JobPostingPayload = {
      ...form,
      title: form.title.trim(),
      position: form.position?.trim() || null,
      salary: form.salary?.trim() || null,
      locations: form.locations?.trim() || null,
      industryType: form.industryType || null,
      workingForm: form.workingForm?.trim() || null,
      experience: form.experience?.trim() || null,
      workModel: form.workModel?.trim() || null,
      degree: form.degree?.trim() || null,
      imageUrl: form.imageUrl?.trim() || null,
      description: form.description || '',
      publishedAt: fromVietnamLocalInputValue(form.publishedAt),
    };
    try {
      if (state.mode === 'edit' && state.id) {
        await updateJobPosting(state.id, payload);
      } else {
        await createJobPosting(payload);
      }
      const keepUrls = new Set<string>(extractContentImageUrls(payload.description ?? ''));
      if (payload.imageUrl) keepUrls.add(payload.imageUrl);
      cleanupOrphanedUploads(keepUrls);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được tin tuyển dụng');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-950">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-50">{state.mode === 'edit' ? 'Sửa tin tuyển dụng' : 'Tạo tin tuyển dụng'}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Hiển thị trên trang Tuyển dụng của website VNFITE</p>
          </div>
          <button type="button" onClick={handleClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-900">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex h-96 items-center justify-center text-gray-500 dark:text-gray-400">
            <Loader2 className="mr-2 animate-spin" size={20} /> Đang tải...
          </div>
        ) : (
          <div className="grid flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-4 p-5">
              {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">{error}</div>}

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Tiêu đề" required>
                  <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                    className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-red-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
                </Field>
                <Field label="Vị trí">
                  <input value={form.position ?? ''} onChange={e => setForm({ ...form, position: e.target.value })}
                    className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-red-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Mức lương">
                  <input value={form.salary ?? ''} onChange={e => setForm({ ...form, salary: e.target.value })}
                    placeholder="Thỏa thuận / 15-20 triệu"
                    className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-red-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
                </Field>
                <Field label="Ngành nghề">
                  <select value={form.industryType ?? ''} onChange={e => setForm({ ...form, industryType: e.target.value })}
                    className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-red-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
                    <option value="">— Chọn ngành nghề —</option>
                    {INDUSTRY_TYPES.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="Địa điểm làm việc">
                <div className="flex flex-wrap gap-2">
                  {LOCATIONS.map(location => {
                    const selected = selectedLocations.includes(location);
                    return (
                      <button
                        key={location}
                        type="button"
                        onClick={() => toggleLocation(location)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                          selected
                            ? 'border-red-600 bg-red-600 text-white'
                            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800'
                        }`}
                      >
                        <MapPin size={12} /> {location}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Hình thức làm việc">
                  <input value={form.workingForm ?? ''} onChange={e => setForm({ ...form, workingForm: e.target.value })}
                    placeholder="Toàn thời gian"
                    className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-red-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
                </Field>
                <Field label="Kinh nghiệm">
                  <input value={form.experience ?? ''} onChange={e => setForm({ ...form, experience: e.target.value })}
                    placeholder="1-2 năm"
                    className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-red-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
                </Field>
                <Field label="Mô hình làm việc">
                  <input value={form.workModel ?? ''} onChange={e => setForm({ ...form, workModel: e.target.value })}
                    placeholder="Tại văn phòng"
                    className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-red-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Bằng cấp">
                  <input value={form.degree ?? ''} onChange={e => setForm({ ...form, degree: e.target.value })}
                    placeholder="Đại học"
                    className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-red-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
                </Field>
                <Field label="Trạng thái">
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as JobPostingStatus })}
                    className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-red-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
                    <option value="ACTIVE">Đang tuyển</option>
                    <option value="INACTIVE">Ngừng tuyển</option>
                  </select>
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                <Field label="Ảnh bìa">
                  <div className="flex gap-2">
                    <input value={form.imageUrl ?? ''} onChange={e => setForm({ ...form, imageUrl: e.target.value })}
                      className="h-10 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-red-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
                    <button type="button" onClick={() => coverInputRef.current?.click()}
                      className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800">
                      {uploading ? <Loader2 className="animate-spin" size={15} /> : <ImagePlus size={15} />} Upload
                    </button>
                    <input ref={coverInputRef} type="file" accept="image/*" className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (file) uploadImage(file, 'cover');
                      }} />
                  </div>
                </Field>
                <Field label="Ngày đăng">
                  <input type="datetime-local" value={form.publishedAt ?? ''} onChange={e => setForm({ ...form, publishedAt: e.target.value })}
                    className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-red-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
                </Field>
              </div>

              <Field label="Mô tả công việc">
                <RichTextEditor editor={editor} onInsertImage={() => inlineInputRef.current?.click()} uploading={uploading}>
                  <input ref={inlineInputRef} type="file" accept="image/*" className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) uploadImage(file, 'inline');
                    }} />
                </RichTextEditor>
              </Field>
            </div>

            <div className="border-t border-gray-200 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-900/60 lg:border-l lg:border-t-0">
              <p className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-50">Preview</p>
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
                {form.imageUrl && <img src={form.imageUrl} alt="Ảnh bìa" className="h-40 w-full object-cover" />}
                <div className="space-y-3 p-4">
                  <StatusBadge status={form.status} />
                  <h4 className="text-lg font-bold text-gray-900 dark:text-gray-50">{form.title || 'Tiêu đề tin tuyển dụng'}</h4>
                  {form.position && <p className="text-sm text-gray-500 dark:text-gray-400">{form.position}</p>}
                  <div className="prose-article prose-article-sm" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-4 dark:border-gray-800">
          <button type="button" onClick={handleClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800">
            Hủy
          </button>
          <button type="button" onClick={submit} disabled={saving || loading}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Lưu tin tuyển dụng
          </button>
        </div>
      </div>
    </div>
  );
}

function JobPostingPreviewModal({ item, onClose }: { item: JobPostingItem; onClose: () => void }) {
  const [detail, setDetail] = useState<JobPostingItem>(item);
  useEffect(() => {
    fetchJobPosting(item.id).then(setDetail).catch(() => undefined);
  }, [item.id]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-950">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-50">Xem trước tin tuyển dụng</h3>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-900"><X size={18} /></button>
        </div>
        {detail.imageUrl && <img src={detail.imageUrl} alt={detail.title} className="h-72 w-full object-cover" />}
        <div className="space-y-4 p-6">
          <StatusBadge status={(detail.status as JobPostingStatus) || 'ACTIVE'} />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">{detail.title}</h2>
          {detail.position && <p className="text-gray-600 dark:text-gray-300">{detail.position}</p>}
          <div className="flex flex-wrap gap-3 text-sm text-gray-500 dark:text-gray-400">
            {detail.salary && <span>💰 {detail.salary}</span>}
            {detail.locations.length > 0 && <span><MapPin className="inline" size={14} /> {detail.locations.join(', ')}</span>}
            {detail.experience && <span>Kinh nghiệm: {detail.experience}</span>}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">{formatVietnamDateTime(detail.publishedAt, '-')}</div>
          <div className="prose-article" dangerouslySetInnerHTML={{ __html: detail.description || '' }} />
        </div>
      </div>
    </div>
  );
}

// ─── Tab 2: Hồ sơ ứng tuyển ─────────────────────────────────────────────────────

function JobApplicationsTab() {
  const [items, setItems] = useState<JobApplicationItem[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<JobApplicationItem | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = async (nextPage = page) => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchJobApplications({ page: nextPage, size: 20 });
      setItems(data.content ?? []);
      setPage(data.page ?? nextPage);
      setTotalPages(data.totalPages ?? 0);
      setTotalElements(data.totalElements ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách hồ sơ ứng tuyển');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(0); }, []);

  const handleDownload = async (item: JobApplicationItem) => {
    setDownloadingId(item.id);
    try {
      await downloadJobApplicationCv(item.id, item.cvFileName ?? undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được CV');
    } finally {
      setDownloadingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteJobApplication(deleteTarget.id);
      setDeleteTarget(null);
      load(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không xóa được hồ sơ ứng tuyển');
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-50">Hồ sơ ứng tuyển</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">{totalElements} hồ sơ ứng viên đã nộp qua website</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Ứng viên</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Liên hệ</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Ứng tuyển vị trí</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Ngày nộp</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                  <Loader2 className="mx-auto mb-2 animate-spin" size={22} /> Đang tải hồ sơ ứng tuyển...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">Chưa có hồ sơ ứng tuyển nào.</td>
              </tr>
            ) : items.map(item => (
              <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/70">
                <td className="px-4 py-3">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">{item.fullName}</p>
                  {item.location && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{item.location}</p>}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                  <p>{item.phoneNumber}</p>
                  {item.email && <p className="text-xs text-gray-500 dark:text-gray-400">{item.email}</p>}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{item.jobPostingTitle ?? '—'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                  {formatVietnamDateTime(item.createdAt, '-')}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <IconButton title="Tải CV" onClick={() => handleDownload(item)}>
                      {downloadingId === item.id ? <Loader2 className="animate-spin" size={15} /> : <Download size={15} />}
                    </IconButton>
                    <IconButton title="Xóa" danger onClick={() => setDeleteTarget(item)}><Trash2 size={15} /></IconButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
        <button
          type="button"
          disabled={page <= 0}
          onClick={() => load(page - 1)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
        >
          Trang trước
        </button>
        <span>Trang {totalPages === 0 ? 0 : page + 1}/{totalPages}</span>
        <button
          type="button"
          disabled={totalPages === 0 || page >= totalPages - 1}
          onClick={() => load(page + 1)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
        >
          Trang sau
        </button>
      </div>

      {deleteTarget && (
        <ConfirmModal
          title="Xóa hồ sơ ứng tuyển"
          message={`Xóa hồ sơ của "${deleteTarget.fullName}"?`}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}

// ─── Shared UI ─────────────────────────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gray-300">
        {label}{required && <span className="text-red-600 dark:text-red-400"> *</span>}
      </span>
      {children}
    </label>
  );
}

function StatusBadge({ status }: { status: JobPostingStatus }) {
  const active = status === 'ACTIVE';
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
      active
        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
    }`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function IconButton({ title, onClick, children, danger }: {
  title: string;
  onClick: () => void;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border text-sm ${
        danger
          ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950'
          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'
      }`}
    >
      {children}
    </button>
  );
}

function ConfirmModal({ title, message, onCancel, onConfirm }: {
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-5 shadow-2xl dark:border-gray-800 dark:bg-gray-950">
        <h3 className="text-base font-bold text-gray-900 dark:text-gray-50">{title}</h3>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">Hủy</button>
          <button onClick={onConfirm} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">Xóa</button>
        </div>
      </div>
    </div>
  );
}
