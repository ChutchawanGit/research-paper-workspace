import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Code
} from 'lucide-react';

interface TipTapEditorProps {
  content: string;
  onChange: (markdownOrHtml: string) => void;
  placeholder?: string;
  editable?: boolean;
}

export const TipTapEditor: React.FC<TipTapEditorProps> = ({
  content,
  onChange,
  placeholder = 'Write research notes, analysis, and key takeaways...',
  editable = true,
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) return null;

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Editor Formatting Toolbar */}
      {editable && (
        <div className="flex items-center gap-1 p-2 border-b border-slate-100 bg-slate-50 flex-wrap">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors ${
              editor.isActive('bold') ? 'bg-slate-200 font-bold' : ''
            }`}
            title="Bold"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors ${
              editor.isActive('italic') ? 'bg-slate-200 italic' : ''
            }`}
            title="Italic"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-slate-200 mx-1" />
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors ${
              editor.isActive('heading', { level: 1 }) ? 'bg-slate-200 font-bold' : ''
            }`}
            title="Heading 1"
          >
            <Heading1 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors ${
              editor.isActive('heading', { level: 2 }) ? 'bg-slate-200 font-bold' : ''
            }`}
            title="Heading 2"
          >
            <Heading2 className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-slate-200 mx-1" />
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors ${
              editor.isActive('bulletList') ? 'bg-slate-200' : ''
            }`}
            title="Bullet List"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors ${
              editor.isActive('orderedList') ? 'bg-slate-200' : ''
            }`}
            title="Numbered List"
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors ${
              editor.isActive('blockquote') ? 'bg-slate-200' : ''
            }`}
            title="Blockquote"
          >
            <Quote className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={`p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors ${
              editor.isActive('codeBlock') ? 'bg-slate-200' : ''
            }`}
            title="Code Block"
          >
            <Code className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Editor Content Area */}
      <div className="flex-1 p-4 overflow-y-auto prose prose-sm max-w-none focus:outline-none">
        <EditorContent editor={editor} className="min-h-[160px] focus:outline-none text-slate-800" />
      </div>
    </div>
  );
};
