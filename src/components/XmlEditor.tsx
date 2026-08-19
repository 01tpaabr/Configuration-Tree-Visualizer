import { useEffect, useMemo, useRef, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { xml as xmlLang } from '@codemirror/lang-xml';
import { linter, type Diagnostic } from '@codemirror/lint';
import { EditorView } from '@codemirror/view';
import { useStore } from '../store';
import { parsePDocument } from '../core/parse';
import type { ParseError } from '../core/types';

const DEBOUNCE_MS = 300;

// The XML pane is a full second way to author documents. Edits are parsed
// shortly after typing pauses; on success the store applies the new document,
// keeping node ids where shape and position match. On failure the last valid
// document is kept and the offending positions are marked inline.
export function XmlEditor() {
  const xmlText = useStore((s) => s.xmlText);
  const xmlOrigin = useStore((s) => s.xmlOrigin);
  const editXml = useStore((s) => s.editXml);
  const [text, setText] = useState(xmlText);
  const errorsRef = useRef<ParseError[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Only rewrite the pane when the change originated outside it.
  useEffect(() => {
    if (xmlOrigin === 'model' && xmlText !== text) setText(xmlText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xmlText, xmlOrigin]);

  const extensions = useMemo(
    () => [
      xmlLang(),
      EditorView.lineWrapping,
      linter(
        (view) => {
          const src = view.state.doc.toString();
          const parsed = parsePDocument(src);
          errorsRef.current = parsed.ok ? [] : parsed.errors;
          const max = view.state.doc.length;
          return errorsRef.current.map(
            (e): Diagnostic => ({
              from: Math.min(e.from ?? 0, max),
              to: Math.min(e.to ?? (e.from ?? 0) + 1, max),
              severity: 'error',
              message: e.message,
            }),
          );
        },
        { delay: DEBOUNCE_MS },
      ),
    ],
    [],
  );

  return (
    <CodeMirror
      value={text}
      height="100%"
      basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: false }}
      extensions={extensions}
      onChange={(next) => {
        setText(next);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => editXml(next), DEBOUNCE_MS);
      }}
    />
  );
}
