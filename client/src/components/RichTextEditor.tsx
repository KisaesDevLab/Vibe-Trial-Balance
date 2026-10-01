// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

// Lightweight WYSIWYG editor for accountant's report letters (ported from
// Vibe MyBooks).
//
// The app ships no rich-text library, and a report letter is just paragraphs
// and a signature block, so this is a small contenteditable surface with a
// fixed toolbar (bold / italic / underline, bullet + numbered lists, left /
// center / right align) plus an "Insert variable" menu that drops a {{token}}
// at the caret. Emits HTML via onChange; no external dependency.
//
// What it emits is NOT trusted as-is: the server sanitizes every letter body
// (sanitizeFsLetterHtml) before it is stored or rendered.

import { useEffect, useRef, useState, type ChangeEvent } from 'react';

// Images are inlined into the letter body as data URIs (self-contained, no
// external fetch when the letter is rendered to PDF). Cap the source file so
// the stored HTML / generated PDF stays reasonable — logos and signatures,
// not full-page scans.
const MAX_IMAGE_BYTES = 1_000_000;

export interface EditorVariable {
  key: string;
  label: string;
}

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  variables: EditorVariable[];
  ariaLabel?: string;
}

function exec(command: string, arg?: string) {
  // execCommand is deprecated but remains the simplest cross-browser way to
  // drive a contenteditable toolbar; adequate for a paragraph-and-signature
  // letter editor.
  document.execCommand(command, false, arg);
}

const TOOLS: Array<{ command: string; label: string; glyph: string; className?: string } | null> = [
  { command: 'bold', label: 'Bold', glyph: 'B', className: 'font-bold' },
  { command: 'italic', label: 'Italic', glyph: 'I', className: 'italic font-serif' },
  { command: 'underline', label: 'Underline', glyph: 'U', className: 'underline' },
  null,
  { command: 'insertUnorderedList', label: 'Bullet list', glyph: '• List' },
  { command: 'insertOrderedList', label: 'Numbered list', glyph: '1. List' },
  null,
  { command: 'justifyLeft', label: 'Align left', glyph: 'Left' },
  { command: 'justifyCenter', label: 'Align center', glyph: 'Center' },
  { command: 'justifyRight', label: 'Align right', glyph: 'Right' },
];

export function RichTextEditor({ value, onChange, variables, ariaLabel }: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [imgError, setImgError] = useState('');

  // Sync external value into the DOM only when it diverges and the editor is
  // not focused, so typing (which already updates the DOM) never resets the caret.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement !== el && el.innerHTML !== value) el.innerHTML = value;
  }, [value]);

  const emit = () => {
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const run = (command: string, arg?: string) => {
    ref.current?.focus();
    exec(command, arg);
    emit();
  };

  const insertVariable = (key: string) => {
    ref.current?.focus();
    exec('insertText', `{{${key}}}`);
    setMenuOpen(false);
    emit();
  };

  const handleImageFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) { setImgError('Choose a PNG or JPEG image.'); return; }
    if (file.size > MAX_IMAGE_BYTES) { setImgError('Image is too large (max 1 MB). Resize it and try again.'); return; }
    setImgError('');
    const reader = new FileReader();
    reader.onload = () => {
      ref.current?.focus();
      exec('insertHTML', `<img src="${String(reader.result)}" style="max-width:100%;height:auto;" alt="" />`);
      emit();
    };
    reader.onerror = () => setImgError('Could not read the image file.');
    reader.readAsDataURL(file);
  };

  const btn = 'px-2 py-1 rounded text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600';
  const sep = <span className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1" />;

  return (
    <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-visible">
      <div className="flex items-center gap-1 flex-wrap border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-2 py-1.5">
        {TOOLS.map((t, i) => (t === null
          ? <span key={i} className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1" />
          : <button key={t.command} type="button" className={`${btn} ${t.className ?? ''}`} onClick={() => run(t.command)} aria-label={t.label} title={t.label}>{t.glyph}</button>))}
        {sep}
        <button type="button" className={btn} onClick={() => fileRef.current?.click()} aria-label="Insert image" title="Insert image">Image</button>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleImageFile} />
        {sep}
        <div className="relative">
          <button
            type="button"
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-500 hover:bg-gray-100 dark:hover:bg-gray-600"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Insert variable"
            aria-expanded={menuOpen}
          >
            Insert variable ▾
          </button>
          {menuOpen && (
            <div className="absolute z-20 mt-1 w-64 max-h-72 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg py-1">
              {variables.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex flex-col"
                  // mousedown, not click: a click would first blur the editor and lose the caret.
                  onMouseDown={(e) => { e.preventDefault(); insertVariable(v.key); }}
                >
                  <span>{v.label}</span>
                  <span className="text-xs text-gray-400 font-mono">{`{{${v.key}}}`}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* The page it prints on is white whatever the app's theme, so the editing surface is too. */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel ?? 'Letter body'}
        onInput={emit}
        onBlur={emit}
        className="min-h-[220px] px-4 py-3 text-sm bg-white text-gray-900 rounded-b-lg focus:outline-none leading-relaxed [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_img]:max-w-full [&_img]:h-auto"
      />
      {imgError && <p className="px-4 pb-2 text-xs text-red-600">{imgError}</p>}
    </div>
  );
}
