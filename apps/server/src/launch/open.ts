import { spawn } from 'node:child_process';

/**
 * Opens the app in the default browser (ROADMAP P10-3), without a shell.
 *
 * `cmd /c start <url>` is the usual answer on Windows and the wrong one here:
 * it parses the URL, and `&` in a query string starts a second command.
 * `rundll32 url.dll,FileProtocolHandler` hands the URL to the protocol
 * handler as one argument, which is what the shell does for a double-clicked
 * link.
 */
export function openerCommand(
  url: string,
  platform: NodeJS.Platform = process.platform,
): { command: string; args: string[] } {
  if (platform === 'win32') {
    return { command: 'rundll32', args: ['url.dll,FileProtocolHandler', url] };
  }
  if (platform === 'darwin') return { command: 'open', args: [url] };
  return { command: 'xdg-open', args: [url] };
}

/**
 * Detached and unwaited: the browser outlives the launcher, and a machine with
 * no opener is told the address instead of failing to start.
 */
export function openBrowser(url: string): Promise<boolean> {
  const { command, args } = openerCommand(url);
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      shell: false,
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.once('error', () => {
      resolve(false);
    });
    child.once('spawn', () => {
      child.unref();
      resolve(true);
    });
  });
}
