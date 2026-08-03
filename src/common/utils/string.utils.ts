export function normalizeComparableText(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

export function trimToNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed ? trimmed : null;
}