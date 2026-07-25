import { useRef, useEffect, useCallback } from 'react';
import { tokens, radius, fontSize } from '../theme/tokens';

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

type ToolbarAction = 'bold' | 'italic' | 'underline' | 'heading' | 'bullet' | 'ordered' | 'link';

const toolbarButtons: { key: ToolbarAction; label: string; title: string }[] = [
  { key: 'bold', label: 'B', title: 'Bold (Ctrl+B)' },
  { key: 'italic', label: 'I', title: 'Italic (Ctrl+I)' },
  { key: 'underline', label: 'U', title: 'Underline (Ctrl+U)' },
  { key: 'heading', label: 'H', title: 'Heading' },
  { key: 'bullet', label: '•', title: 'Bullet List' },
  { key: 'ordered', label: '1.', title: 'Ordered List' },
  { key: 'link', label: '🔗', title: 'Insert Link' },
];

export default function RichTextEditor({ value, onChange, placeholder, minHeight = 120 }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternal = useRef(false);

  const exec = useCallback((action: ToolbarAction) => {
    switch (action) {
      case 'bold': document.execCommand('bold'); break;
      case 'italic': document.execCommand('italic'); break;
      case 'underline': document.execCommand('underline'); break;
      case 'heading': document.execCommand('formatBlock', false, 'h3'); break;
      case 'bullet': document.execCommand('insertUnorderedList'); break;
      case 'ordered': document.execCommand('insertOrderedList'); break;
      case 'link': {
        const url = prompt('Enter URL:');
        if (url) document.execCommand('createLink', false, url);
        break;
      }
    }
    editorRef.current?.focus();
    emitChange();
  }, []);

  const emitChange = () => {
    if (editorRef.current && !isInternal.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  // Set initial content only once
  useEffect(() => {
    if (editorRef.current && !editorRef.current.innerHTML) {
      isInternal.current = true;
      editorRef.current.innerHTML = value || '';
      isInternal.current = false;
    }
  }, []);

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  const isEmpty = !value || value === '<br>' || !value.replace(/<[^>]*>/g, '').trim();

  return (
    <div style={{
      border: `1px solid ${tokens.borderDefault}`,
      borderRadius: radius.sm,
      overflow: 'hidden',
      background: tokens.surfaceInset,
    }}>
      <div style={{
        display: 'flex',
        gap: 2,
        padding: '4px 6px',
        borderBottom: `1px solid ${tokens.borderDefault}`,
        background: tokens.canvasBg,
        flexWrap: 'wrap',
      }}>
        {toolbarButtons.map(btn => (
          <button
            key={btn.key}
            type="button"
            onMouseDown={(e) => { e.preventDefault(); exec(btn.key); }}
            title={btn.title}
            style={{
              background: 'transparent',
              border: 'none',
              borderRadius: radius.sm,
              color: tokens.textSecondary,
              cursor: 'pointer',
              fontSize: btn.key === 'bold' ? 14 : 12,
              fontWeight: btn.key === 'bold' ? 700 : 400,
              padding: '3px 8px',
              minWidth: 28,
              textAlign: 'center',
              fontFamily: btn.key === 'italic' ? 'serif' : 'inherit',
              fontStyle: btn.key === 'italic' ? 'italic' : 'normal',
              textDecoration: btn.key === 'underline' ? 'underline' : 'none',
            }}
          >
            {btn.label}
          </button>
        ))}
      </div>

      <div style={{ position: 'relative' }}>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={emitChange}
          onPaste={handlePaste}
          style={{
            minHeight,
            padding: '10px 12px',
            fontSize: fontSize.base,
            color: tokens.textPrimary,
            lineHeight: 1.6,
            outline: 'none',
            overflowY: 'auto',
            cursor: 'text',
          }}
        />
        {isEmpty && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            padding: '10px 12px',
            color: tokens.textDim,
            fontSize: fontSize.base,
            pointerEvents: 'none',
            userSelect: 'none',
          }}>
            {placeholder || 'Write a description...'}
          </div>
        )}
      </div>
    </div>
  );
}
