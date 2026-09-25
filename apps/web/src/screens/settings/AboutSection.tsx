import type { AboutResponse } from '@devpromax/shared';
import { Row, Section } from './fields.js';

/**
 * Which DevProMax this is, and where it keeps what it writes (ROADMAP P10-2).
 *
 * The version is what a bug report needs first. The data folder is what
 * someone backing up or moving machines needs, and an installed copy's is not
 * in a project folder they can see - it is under their local app data.
 */

function Path({ value }: { value: string }) {
  return <code className="text-fg-muted font-mono text-2xs break-all">{value}</code>;
}

export function AboutSection({
  about,
  error,
}: {
  about: AboutResponse | undefined;
  error: Error | null;
}) {
  return (
    <Section title="About" description="This copy of DevProMax, and where it keeps what it writes.">
      {error !== null ? (
        <p className="text-danger-fg text-sm" role="alert">
          {error.message}
        </p>
      ) : about === undefined ? (
        <p className="text-fg-muted text-sm">Loading…</p>
      ) : (
        <>
          <Row label="Version">
            <span className="tnum text-sm">{about.version}</span>
          </Row>
          <Row
            label="Data folder"
            hint={
              about.bundled
                ? 'Your practice history, notes, settings and API key. Uninstalling asks before it deletes this.'
                : 'Your practice history, notes, settings and API key.'
            }
          >
            <Path value={about.dataDir} />
          </Row>
          {about.logFile !== null && (
            <Row label="Log file" hint="Attach it to a bug report.">
              <Path value={about.logFile} />
            </Row>
          )}
        </>
      )}
    </Section>
  );
}
