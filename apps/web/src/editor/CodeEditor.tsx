import Editor from '@monaco-editor/react';
import type { Language } from '@devpromax/shared';
import { MONACO_LANGUAGE } from './monaco.js';

/**
 * The code editor (ROADMAP P4-1).
 *
 * A thin wrapper on purpose: the skeleton needs an editor that holds text in the
 * right language and reports changes. Editor preferences, keyboard shortcuts,
 * compile-error markers and reset-to-starter belong to the screens that own
 * them (P4-6, P4-7) rather than to this.
 */

export interface CodeEditorProps {
  value: string;
  language: Language;
  onChange: (value: string) => void;
  height?: string;
}

export default function CodeEditor({
  value,
  language,
  onChange,
  height = '100%',
}: CodeEditorProps) {
  return (
    <Editor
      value={value}
      language={MONACO_LANGUAGE[language]}
      height={height}
      // Follows the app's theme rather than Monaco's default light. A proper
      // token-matched theme is P4-6's; this keeps the editor from being a white
      // rectangle in a dark app in the meantime.
      theme="vs-dark"
      onChange={(next) => {
        onChange(next ?? '');
      }}
      options={{
        fontFamily: "'JetBrains Mono Variable', ui-monospace, monospace",
        fontSize: 13,
        tabSize: 4,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        renderWhitespace: 'selection',
      }}
      loading={<div className="text-fg-muted p-4 text-sm">Loading the editor…</div>}
    />
  );
}
