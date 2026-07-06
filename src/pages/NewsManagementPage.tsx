import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import {
  AlignCenter, AlignLeft, AlignRight, Bold, Calendar, Edit3, Eye, ImagePlus,
  Italic, Link as LinkIcon, List, ListOrdered, Loader2, Minus, Newspaper,
  Plus, Quote, Redo2, Save, Search, Strikethrough, Trash2, Underline as UnderlineIcon,
  Undo2, X,
} from 'lucide-react';
import {
  createNews,
  deleteNews,
  deleteNewsImage,
  fetchNews,
  fetchNewsList,
  updateNews,
  uploadNewsImage,
  type NewsItem,
  type NewsPayload,
  type NewsType,
} from '../api/client';
import { formatVietnamDateTime, fromVietnamLocalInputValue, toVietnamLocalInputValue } from '../utils/dateTime';

const NEWS_TYPE_LABEL: Record<NewsType, string> = {
  NORMAL: 'Thường',
  FEATURED: 'Nổi bật',
};

const EMPTY_FORM: NewsPayload = {
  title: '',
  subtitle: '',
  imageUrl: '',
  content: '',
  newsType: 'NORMAL',
  publishedAt: '',
};

export function NewsManagementPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [type, setType] = useState<NewsType | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editorState, setEditorState] = useState<{ mode: 'create' | 'edit'; id?: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NewsItem | null>(null);
  const [detailPreview, setDetailPreview] = useState<NewsItem | null>(null);

  const load = async (nextPage = page) => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchNewsList({ page: nextPage, size: 20, type });
      setItems(data.content ?? []);
      setPage(data.page ?? nextPage);
      setTotalPages(data.totalPages ?? 0);
      setTotalElements(data.totalElements ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách tin tức');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(0); }, [type]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteNews(deleteTarget.id);
      setDeleteTarget(null);
      load(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không xóa được tin tức');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-50">Tin tức</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{totalElements} bài viết từ nguồn tin VNFITE mới</p>
        </div>
        <button
          type="button"
          onClick={() => setEditorState({ mode: 'create' })}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
        >
          <Plus size={16} /> Tạo bài viết
        </button>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
          <Search size={16} /> Bộ lọc
        </div>
        <select
          value={type}
          onChange={e => setType(e.target.value as NewsType | '')}
          className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-red-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        >
          <option value="">Tất cả loại tin</option>
          <option value="NORMAL">Tin thường</option>
          <option value="FEATURED">Tin nổi bật</option>
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
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Bài viết</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Loại</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Ngày đăng</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                  <Loader2 className="mx-auto mb-2 animate-spin" size={22} /> Đang tải tin tức...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">Chưa có bài viết.</td>
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
                          <Newspaper size={20} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm font-semibold text-gray-900 dark:text-gray-50">{item.title}</p>
                      {item.subtitle && <p className="mt-1 line-clamp-1 text-xs text-gray-500 dark:text-gray-400">{item.subtitle}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <NewsTypeBadge type={(item.newsType as NewsType) || 'NORMAL'} />
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
        <NewsEditorModal
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
          title="Xóa bài viết"
          message={`Xóa bài "${deleteTarget.title}" khỏi danh sách tin tức?`}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
      {detailPreview && (
        <PreviewModal item={detailPreview} onClose={() => setDetailPreview(null)} />
      )}
    </div>
  );
}

function NewsEditorModal({ state, onClose, onSaved }: {
  state: { mode: 'create' | 'edit'; id?: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<NewsPayload>(EMPTY_FORM);
  const [loading, setLoading] = useState(state.mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const coverInputRef = useRef<HTMLInputElement>(null);
  const inlineInputRef = useRef<HTMLInputElement>(null);
  const uploadedThisSessionRef = useRef<Set<string>>(new Set());
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Soạn nội dung bài viết như một bài báo…' }),
      Image.configure({ inline: false, allowBase64: false }),
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose-article min-h-96 outline-none px-6 py-5',
      },
    },
    onUpdate: ({ editor }) => {
      setForm(prev => ({ ...prev, content: editor.getHTML() }));
    },
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
    fetchNews(state.id)
      .then(item => {
        if (cancelled) return;
        const nextForm: NewsPayload = {
          title: item.title ?? '',
          subtitle: item.subtitle ?? '',
          imageUrl: item.imageUrl ?? '',
          content: item.content ?? '',
          newsType: ((item.newsType as NewsType) || 'NORMAL'),
          publishedAt: toVietnamLocalInputValue(item.publishedAt),
        };
        setForm(nextForm);
        editor?.commands.setContent(nextForm.content ?? '');
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Không tải được bài viết'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [state.id, state.mode, editor]);

  const previewHtml = useMemo(() => form.content || '<p></p>', [form.content]);

  const uploadImage = async (file: File, mode: 'cover' | 'inline') => {
    setUploading(true);
    setError('');
    try {
      const { url } = await uploadNewsImage(file);
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
    orphans.forEach(url => { deleteNewsImage(url).catch(() => undefined); });
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
    const payload: NewsPayload = {
      ...form,
      title: form.title.trim(),
      subtitle: form.subtitle?.trim() || null,
      imageUrl: form.imageUrl?.trim() || null,
      content: form.content || '',
      publishedAt: fromVietnamLocalInputValue(form.publishedAt),
    };
    try {
      if (state.mode === 'edit' && state.id) {
        await updateNews(state.id, payload);
      } else {
        await createNews(payload);
      }
      const keepUrls = new Set<string>(extractContentImageUrls(payload.content ?? ''));
      if (payload.imageUrl) keepUrls.add(payload.imageUrl);
      cleanupOrphanedUploads(keepUrls);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được bài viết');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-950">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-50">{state.mode === 'edit' ? 'Sửa bài viết' : 'Tạo bài viết'}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Soạn nội dung HTML dùng chung cho app và website</p>
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
                <Field label="Loại tin">
                  <select value={form.newsType} onChange={e => setForm({ ...form, newsType: e.target.value as NewsType })}
                    className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-red-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
                    <option value="NORMAL">Tin thường</option>
                    <option value="FEATURED">Tin nổi bật</option>
                  </select>
                </Field>
              </div>

              <Field label="Phụ đề">
                <textarea value={form.subtitle ?? ''} onChange={e => setForm({ ...form, subtitle: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-red-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
              </Field>

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
                  <div className="relative">
                    <Calendar className="pointer-events-none absolute left-3 top-2.5 text-gray-400 dark:text-gray-500" size={15} />
                    <input type="datetime-local" value={form.publishedAt ?? ''} onChange={e => setForm({ ...form, publishedAt: e.target.value })}
                      className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-red-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
                  </div>
                </Field>
              </div>

              <div className="overflow-hidden rounded-lg border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-900">
                <EditorToolbar editor={editor} onInsertImage={() => inlineInputRef.current?.click()} uploading={uploading}>
                  <input ref={inlineInputRef} type="file" accept="image/*" className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) uploadImage(file, 'inline');
                    }} />
                </EditorToolbar>
                <EditorContent editor={editor} />
              </div>
            </div>

            <div className="border-t border-gray-200 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-900/60 lg:border-l lg:border-t-0">
              <p className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-50">Preview</p>
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
                {form.imageUrl && <img src={form.imageUrl} alt="Ảnh bìa" className="h-40 w-full object-cover" />}
                <div className="space-y-3 p-4">
                  <NewsTypeBadge type={form.newsType} />
                  <h4 className="text-lg font-bold text-gray-900 dark:text-gray-50">{form.title || 'Tiêu đề bài viết'}</h4>
                  {form.subtitle && <p className="text-sm text-gray-500 dark:text-gray-400">{form.subtitle}</p>}
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
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Lưu bài viết
          </button>
        </div>
      </div>
    </div>
  );
}

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

function NewsTypeBadge({ type }: { type: NewsType }) {
  const featured = type === 'FEATURED';
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
      featured
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
    }`}>
      {NEWS_TYPE_LABEL[type] ?? type}
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

function ToolbarButton({ active, onClick, title, disabled, children }: {
  active?: boolean;
  onClick: () => void;
  title?: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm font-semibold disabled:opacity-40 ${
        active
          ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200'
          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
      }`}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="mx-1 h-6 w-px self-center bg-gray-200 dark:bg-gray-700" />;
}

const HEADING_OPTIONS = [
  { value: 'p', label: 'Đoạn văn' },
  { value: 'h1', label: 'Tiêu đề 1' },
  { value: 'h2', label: 'Tiêu đề 2' },
  { value: 'h3', label: 'Tiêu đề 3' },
] as const;

function EditorToolbar({ editor, onInsertImage, uploading, children }: {
  editor: Editor | undefined;
  onInsertImage: () => void;
  uploading: boolean;
  children: ReactNode;
}) {
  if (!editor) return null;

  const currentHeading = editor.isActive('heading', { level: 1 })
    ? 'h1'
    : editor.isActive('heading', { level: 2 })
    ? 'h2'
    : editor.isActive('heading', { level: 3 })
    ? 'h3'
    : 'p';

  const setHeading = (value: string) => {
    if (value === 'p') {
      editor.chain().focus().setParagraph().run();
    } else {
      const level = Number(value.replace('h', '')) as 1 | 2 | 3;
      editor.chain().focus().toggleHeading({ level }).run();
    }
  };

  const setLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Nhập URL liên kết:', previous ?? 'https://');
    if (url === null) return;
    if (url.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-gray-50/60 p-2 dark:border-gray-800 dark:bg-gray-950/40">
      <select
        value={currentHeading}
        onChange={e => setHeading(e.target.value)}
        title="Kiểu văn bản"
        className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs font-medium text-gray-700 outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
      >
        {HEADING_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      <ToolbarDivider />

      <ToolbarButton title="In đậm" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={14} /></ToolbarButton>
      <ToolbarButton title="In nghiêng" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={14} /></ToolbarButton>
      <ToolbarButton title="Gạch chân" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon size={14} /></ToolbarButton>
      <ToolbarButton title="Gạch ngang" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={14} /></ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton title="Danh sách gạch đầu dòng" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={14} /></ToolbarButton>
      <ToolbarButton title="Danh sách đánh số" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={14} /></ToolbarButton>
      <ToolbarButton title="Trích dẫn" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={14} /></ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton title="Căn trái" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft size={14} /></ToolbarButton>
      <ToolbarButton title="Căn giữa" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter size={14} /></ToolbarButton>
      <ToolbarButton title="Căn phải" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight size={14} /></ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton title="Chèn liên kết" active={editor.isActive('link')} onClick={setLink}><LinkIcon size={14} /></ToolbarButton>
      <ToolbarButton title="Chèn ảnh" onClick={onInsertImage} disabled={uploading}>
        {uploading ? <Loader2 className="animate-spin" size={14} /> : <ImagePlus size={14} />}
      </ToolbarButton>
      <ToolbarButton title="Đường kẻ ngang" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus size={14} /></ToolbarButton>
      {children}

      <ToolbarDivider />

      <ToolbarButton title="Hoàn tác" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}><Undo2 size={14} /></ToolbarButton>
      <ToolbarButton title="Làm lại" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}><Redo2 size={14} /></ToolbarButton>
    </div>
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

function PreviewModal({ item, onClose }: { item: NewsItem; onClose: () => void }) {
  const [detail, setDetail] = useState<NewsItem>(item);
  useEffect(() => {
    fetchNews(item.id).then(setDetail).catch(() => undefined);
  }, [item.id]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-950">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-50">Xem trước bài viết</h3>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-900"><X size={18} /></button>
        </div>
        {detail.imageUrl && <img src={detail.imageUrl} alt={detail.title} className="h-72 w-full object-cover" />}
        <div className="space-y-4 p-6">
          <NewsTypeBadge type={(detail.newsType as NewsType) || 'NORMAL'} />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">{detail.title}</h2>
          {detail.subtitle && <p className="text-gray-600 dark:text-gray-300">{detail.subtitle}</p>}
          <div className="text-sm text-gray-500 dark:text-gray-400">{formatVietnamDateTime(detail.publishedAt, '-')}</div>
          <div className="prose-article" dangerouslySetInnerHTML={{ __html: detail.content || '' }} />
        </div>
      </div>
    </div>
  );
}
