import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { healthResponseSchema, type HealthResponse } from '@devpromax/shared';

/**
 * Which port the app lives on (ROADMAP P10-3).
 *
 * The same one every time, as far as that is possible: the theme, the welcome
 * flag and the pane sizes are in `localStorage`, which belongs to an origin, and
 * `http://127.0.0.1:5175` is a different origin from `:5174`. A port that
 * wandered would greet the user as a stranger every time something else
 * happened to hold 5174 at start-up. So the port chosen is remembered in
 * `data/launcher.json` and tried first next time.
 */

export const DEFAULT_PORT = 5174;
/** How far past the preferred port to look before giving up. */
const SEARCH_SPAN = 20;

/** What is on a port: our own server, nothing, or somebody else. */
export type PortState =
  { kind: 'ours'; health: HealthResponse } | { kind: 'free' } | { kind: 'taken' };

export type PortChoice =
  { port: number; running: true; health: HealthResponse } | { port: number; running: false };

/**
 * The port to use: the first from `preferred` on that is our own server
 * (which is then only opened) or free (where one is then started).
 */
export async function choosePort(
  preferred: number,
  probe: (port: number) => Promise<PortState>,
): Promise<PortChoice> {
  const last = Math.min(preferred + SEARCH_SPAN, 65535);
  for (let port = preferred; port <= last; port += 1) {
    const state = await probe(port);
    if (state.kind === 'ours') return { port, running: true, health: state.health };
    if (state.kind === 'free') return { port, running: false };
  }
  throw new Error(
    `Ports ${String(preferred)} to ${String(last)} are all in use by other programs. Close one of them and start DevProMax again.`,
  );
}

/** Asks `/health` on the port, and failing an answer, whether it can be bound. */
export async function probePort(port: number): Promise<PortState> {
  const health = await askHealth(port);
  if (health !== null) return { kind: 'ours', health };
  return (await canListen(port)) ? { kind: 'free' } : { kind: 'taken' };
}

export async function askHealth(port: number, timeoutMs = 1500): Promise<HealthResponse | null> {
  try {
    const response = await fetch(`http://127.0.0.1:${String(port)}/health`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return null;
    const parsed = healthResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch {
    // Refused, not HTTP, or too slow: not ours, whatever it is.
    return null;
  }
}

function canListen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => {
      resolve(false);
    });
    server.listen({ port, host: '127.0.0.1', exclusive: true }, () => {
      server.close(() => {
        resolve(true);
      });
    });
  });
}

/** `data/launcher.json`: what the launcher remembers between runs. */
export function launcherStateFile(dataDir: string): string {
  return path.join(dataDir, 'launcher.json');
}

/** The remembered port, or null when there is none worth trusting. */
export function readRememberedPort(dataDir: string): number | null {
  try {
    const state = JSON.parse(fs.readFileSync(launcherStateFile(dataDir), 'utf8')) as {
      port?: unknown;
    };
    const port = state.port;
    return typeof port === 'number' && Number.isInteger(port) && port >= 1 && port <= 65535
      ? port
      : null;
  } catch {
    return null;
  }
}

export function rememberPort(dataDir: string, port: number): void {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(launcherStateFile(dataDir), `${JSON.stringify({ port }, null, 2)}\n`, 'utf8');
}
