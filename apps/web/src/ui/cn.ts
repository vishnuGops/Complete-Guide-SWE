/**
 * Joins class names, dropping anything falsy.
 *
 * Deliberately not `clsx` + `tailwind-merge`. Merging exists to resolve two
 * classes fighting over the same property, which happens when a component takes
 * `className` and then guesses whether the caller meant to override it. Ours put
 * `className` last and let the cascade decide, which is the same answer with no
 * dependency and no surprises.
 */
export type ClassValue = string | false | null | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}
