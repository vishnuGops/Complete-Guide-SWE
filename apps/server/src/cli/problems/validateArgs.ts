/**
 * The arguments `npm run problems:validate -- [--static] [--changed <ref>] [slug]`
 * takes, apart from the CLI so they can be tested without running it. Without
 * the `--`, npm turns `--changed <ref>` into `npm_config_changed=true` and hands
 * the ref over as a positional argument, where it reads as a slug.
 */
export interface ValidateArgs {
  staticOnly: boolean;
  slug?: string;
  /** Base ref for `--changed`. */
  changedFrom?: string;
}

export function parseValidateArgs(
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>> = process.env,
): ValidateArgs {
  // `npm run problems:validate --static` makes npm swallow the flag into its own
  // config rather than passing it through, so honour both that and the
  // `-- --static` form.
  const staticOnly = argv.includes('--static') || env['npm_config_static'] === 'true';

  const changedAt = argv.indexOf('--changed');
  const changedFrom =
    changedAt !== -1 ? argv[changedAt + 1] : (env['npm_config_changed'] ?? undefined);

  // The ref after `--changed` is not a slug. Only when there is a `--changed`:
  // without one, `changedAt + 1` is 0, and the old filter threw away the first
  // argument - which is exactly where a lone slug sits, so `problems:validate
  // <slug>` quietly validated the whole catalogue instead (2026-09-24).
  const refAt = changedAt === -1 ? -1 : changedAt + 1;
  const positional = argv.filter((arg, index) => !arg.startsWith('-') && index !== refAt);
  const slug = positional[0];

  return {
    staticOnly,
    ...(slug ? { slug } : {}),
    ...(changedFrom && changedFrom !== 'true' ? { changedFrom } : {}),
  };
}
