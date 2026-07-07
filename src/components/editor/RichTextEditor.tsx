import type { ReactNode } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TiptapImage from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import {
  AlignCenter, AlignLeft, AlignRight, Bold, ImagePlus, Italic, Link as LinkIcon,
  List, ListOrdered, Loader2, Minus, Quote, Redo2, Strikethrough,
  Underline as UnderlineIcon, Undo2,
} from 'lucide-react';

/** Hook tạo editor Tiptap dùng chung cho mọi màn soạn nội dung dạng bài báo (News, Tuyển dụng...). */
export function useArticleEditor({ placeholder, onUpdate }: {
  placeholder?: string;
  onUpdate: (html: string) => void;
}): Editor | null {
  return useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: placeholder ?? 'Soạn nội dung như một bài báo…' }),
      TiptapImage.configure({ inline: false, allowBase64: false }),
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose-article min-h-96 outline-none px-6 py-5',
      },
    },
    onUpdate: ({ editor }) => onUpdate(editor.getHTML()),
  });
}

/** Toolbar + vùng soạn nội dung — dùng chung cho News và Tuyển dụng. */
export function RichTextEditor({ editor, onInsertImage, uploading, children }: {
  editor: Editor | null;
  onInsertImage: () => void;
  uploading: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-900">
      <EditorToolbar editor={editor} onInsertImage={onInsertImage} uploading={uploading}>
        {children}
      </EditorToolbar>
      <EditorContent editor={editor} />
    </div>
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
  editor: Editor | null;
  onInsertImage: () => void;
  uploading: boolean;
  children?: ReactNode;
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
