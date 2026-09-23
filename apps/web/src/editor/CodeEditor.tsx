import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { CompileError, EditorPrefs, Language } from '@devpromax/shared';
import { MONACO_LANGUAGE } from './monaco.js';

/**
 * The code editor (ROADMAP P4-1, extended by P4-6 and P4-7).
 *
 * Still a thin wrapper: it holds text in the right language, applies the user's
 * editor preferences, and can be told where to put the caret. What it
 * deliberately does not do is decide anything - the workspace owns the code, the
 * language, the draft and the shortcuts, because those all outlive the editor
 * being unmounted and remounted.
 *
 * Two things here are not thin, and both are Monaco-shaped:
 *
 *   - **Markers.** A compile error is only useful next to the line it is about,
 *     and Monaco's marker API is the only way to draw one. The owner string
 *     scopes them, so setting an empty list clears ours without touching
 *     anything else's.
 *   - **`detectIndentation: false`.** Monaco otherwise infers the indent from
 *     the file and silently ignores `tabSize`, which makes the setting look
 *     broken on every starter that already has an indented body.
 *   - **Vim mode.** Imported only when the preference is on, because it is a
 *     second keymap engine and the people who do not use it should not download
 *     it. It brings its own status line, which is not decoration: without the
 *     `-- INSERT --` indicator, "why is my typing being eaten" has no answer on
 *     screen.
 */

export interface CodeEditorHandle {
  /** Used by the results panel to jump to a compile error (P4-7). */
  revealPosition: (line: number, column?: number) => void;
  focus: () => void;
  /**
   * Replaces the whole text as one undoable edit (ROADMAP P9-5).
   *
   * For the formatter's answer. Setting `value` would work too, and would wipe
   * the undo history with it - so Ctrl+Z after a format would not undo the
   * format, it would do nothing. Returns false when there is no editor yet.
   */
  replaceAll: (text: string) => boolean;
}

export interface CodeEditorProps {
  value: string;
  language: Language;
  /**
   * A model identity, one per problem and language (ROADMAP P4-11/P4-12).
   *
   * Monaco keeps one model per path, and `@monaco-editor/react` swaps models
   * rather than rewriting one when this changes. Without it, switching language
   * re-languages a single shared model and the change event that follows
   * reports the *old* content back through `onChange` - which, intermittently,
   * overwrote the draft the workspace had just loaded with the one it had just
   * left. Found by the P4-11 end-to-end test, which failed about one run in
   * three.
   *
   * It also gives each language its own undo history, which is what a user
   * flipping between two solutions expects anyway.
   */
  path: string;
  onChange: (value: string) => void;
  prefs: EditorPrefs;
  /** Resolved, never `system`: Monaco needs an actual theme name. */
  theme: 'light' | 'dark';
  /** Compile diagnostics from the last run, drawn in the gutter. */
  markers?: readonly CompileError[];
  /**
   * Offered as Monaco's own "Format Document" - Shift+Alt+F, the context menu
   * and F1 - when present (ROADMAP P9-5). Absent when this language has no
   * formatter on the machine, and then the action is hidden, not broken.
   */
  onFormat?: (() => void) | undefined;
  ref?: Ref<CodeEditorHandle>;
}

type MonacoApi = Parameters<OnMount>[1];
type MonacoEditor = Parameters<OnMount>[0];

const MARKER_OWNER = 'devpromax-judge';

/** What `monaco-vim` hands back; only `dispose` matters to us. */
interface VimMode {
  dispose: () => void;
}

export default function CodeEditor({
  value,
  language,
  path,
  onChange,
  prefs,
  theme,
  markers,
  onFormat,
  ref,
}: CodeEditorProps) {
  const editorRef = useRef<MonacoEditor | null>(null);
  const monacoRef = useRef<MonacoApi | null>(null);
  const statusBarRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  /** Read by the Monaco action, which is registered once and outlives renders. */
  const formatRef = useRef(onFormat);
  const canFormatRef = useRef<{ set: (value: boolean) => void } | null>(null);
  useEffect(() => {
    formatRef.current = onFormat;
    canFormatRef.current?.set(onFormat !== undefined);
  }, [onFormat, mounted]);

  useImperativeHandle(ref, () => ({
    revealPosition(line, column = 1) {
      const editor = editorRef.current;
      if (!editor) return;
      editor.revealLineInCenter(line);
      editor.setPosition({ lineNumber: line, column });
      editor.focus();
    },
    focus() {
      editorRef.current?.focus();
    },
    replaceAll(text) {
      const editor = editorRef.current;
      const model = editor?.getModel();
      if (!editor || !model) return false;
      const position = editor.getPosition();
      editor.pushUndoStop();
      editor.executeEdits('devpromax-format', [{ range: model.getFullModelRange(), text }]);
      editor.pushUndoStop();
      // Roughly where it was. Formatting moves lines, so this is a guess, and
      // the start of the file - where the caret would otherwise land - is a
      // worse one.
      if (position) editor.setPosition(model.validatePosition(position));
      return true;
    },
  }));

  useEffect(() => {
    if (!prefs.vimKeybindings || !mounted) return;
    let mode: VimMode | null = null;
    let cancelled = false;

    void (async () => {
      try {
        const { initVimMode } = await import('monaco-vim');
        const editor = editorRef.current;
        if (cancelled || !editor) return;
        mode = initVimMode(editor, statusBarRef.current);
      } catch {
        // The editor keeps its normal keymap. Failing to load a keymap is not a
        // reason to fail to show the code.
      }
    })();

    return () => {
      cancelled = true;
      mode?.dispose();
    };
  }, [prefs.vimKeybindings, mounted]);

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor?.getModel();
    if (!monaco || !model) return;

    monaco.editor.setModelMarkers(
      model,
      MARKER_OWNER,
      (markers ?? []).map((error) => ({
        severity:
          error.severity === 'warning'
            ? monaco.MarkerSeverity.Warning
            : monaco.MarkerSeverity.Error,
        message: error.message,
        startLineNumber: error.line ?? 1,
        startColumn: error.column ?? 1,
        endLineNumber: error.line ?? 1,
        // To end of line: `javac` reports a point, and a one-character squiggle
        // is easy to miss in a wall of Java.
        endColumn: error.column === undefined ? 1000 : error.column + 1,
      })),
    );
  }, [markers, language]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        <Editor
          value={value}
          path={path}
          language={MONACO_LANGUAGE[language]}
          height="100%"
          theme={theme === 'dark' ? 'vs-dark' : 'vs'}
          onMount={(editor, monaco) => {
            editorRef.current = editor;
            monacoRef.current = monaco;
            // Monaco's own "Format Document" is shown only when a language has
            // a formatting provider, and ours is a server round trip rather
            // than a provider, so it is an action of its own with the same
            // keys, gated by a context key (P9-5).
            const canFormat = editor.createContextKey<boolean>('devpromaxCanFormat', false);
            canFormatRef.current = canFormat;
            editor.addAction({
              id: 'devpromax.formatDocument',
              label: 'Format Document',
              keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF],
              precondition: 'devpromaxCanFormat',
              contextMenuGroupId: '1_modification',
              run: () => {
                formatRef.current?.();
              },
            });
            // The vim effect needs an editor instance, and a ref assignment does not
            // re-run an effect. This is the one thing here that has to be state.
            setMounted(true);
          }}
          onChange={(next) => {
            onChange(next ?? '');
          }}
          options={{
            fontFamily: "'JetBrains Mono Variable', ui-monospace, monospace",
            fontSize: prefs.fontSize,
            tabSize: prefs.tabSize,
            detectIndentation: false,
            insertSpaces: true,
            wordWrap: prefs.wordWrap ? 'on' : 'off',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            renderWhitespace: 'selection',
            // The app owns Ctrl+Enter and friends; Monaco's own command palette
            // shortcut (F1) stays, because nothing here competes with it.
            padding: { top: 8, bottom: 8 },
          }}
          loading={<div className="text-fg-muted p-4 text-sm">Loading the editor…</div>}
        />
      </div>

      {prefs.vimKeybindings && (
        <div
          ref={statusBarRef}
          className="border-border text-fg-muted shrink-0 border-t px-2 py-0.5 font-mono text-2xs"
        />
      )}
    </div>
  );
}
