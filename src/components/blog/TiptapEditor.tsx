import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import BubbleMenuExtension from '@tiptap/extension-bubble-menu';
import FloatingMenuExtension from '@tiptap/extension-floating-menu';
import { 
  Bold, Italic, Underline as UnderlineIcon, Link as LinkIcon, 
  List, ListOrdered
} from 'lucide-react';
import React from 'react';

interface TiptapEditorProps {
  content: string;
  onChange: (html: string) => void;
  style?: React.CSSProperties;
}

const TiptapEditor = ({ content, onChange, style }: TiptapEditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
      }),
      Placeholder.configure({
        placeholder: 'Enter text widget content...',
      }),
      BubbleMenuExtension.configure({
        element: null, // Initialized by BubbleMenu component
      }),
      FloatingMenuExtension.configure({
        element: null,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert prose-slate max-w-none focus:outline-none min-h-[100px]',
      },
    },
  });

  if (!editor) return null;

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);

    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className="relative w-full" style={style}>
      {editor && (
        <BubbleMenu editor={editor} options={{ placement: 'top' }}>
          <div className="flex bg-slate-900 border border-white/10 rounded-xl p-1 shadow-2xl backdrop-blur-xl gap-1">
            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`p-1.5 rounded-lg transition-all ${editor.isActive('bold') ? 'bg-accent text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <Bold size={14} />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`p-1.5 rounded-lg transition-all ${editor.isActive('italic') ? 'bg-accent text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <Italic size={14} />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={`p-1.5 rounded-lg transition-all ${editor.isActive('underline') ? 'bg-accent text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <UnderlineIcon size={14} />
            </button>
            <div className="w-px h-4 bg-white/10 self-center mx-1" />
            <button
              onClick={setLink}
              className={`p-1.5 rounded-lg transition-all ${editor.isActive('link') ? 'bg-accent text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <LinkIcon size={14} />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`p-1.5 rounded-lg transition-all ${editor.isActive('bulletList') ? 'bg-accent text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <List size={14} />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={`p-1.5 rounded-lg transition-all ${editor.isActive('orderedList') ? 'bg-accent text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <ListOrdered size={14} />
            </button>
          </div>
        </BubbleMenu>
      )}
      <EditorContent editor={editor} />
    </div>
  );
};

export default TiptapEditor;
