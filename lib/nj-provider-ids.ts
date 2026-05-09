/**
 * Normalize NJ/US provider identifiers for storage (human / admin review — not IRS validation).
 */

const DL_MAX = 32;

/** Strip to alphanumerics; cap length (states vary). */
export function normalizeDriversLicenseForStorage(raw: string): string | null {
  const s = raw.replace(/[\s-]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!s) return null;
  return s.length > DL_MAX ? s.slice(0, DL_MAX) : s;
}

/** EIN: nine digits, often shown as XX-XXXXXXX — store as 9-digit string. */
export function normalizeEinForStorage(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 9) return null;
  return digits;
}

export function formatEinDisplay(stored: string | null | undefined): string {
  if (!stored || stored.length !== 9) return "";
  return `${stored.slice(0, 2)}-${stored.slice(2)}`;
}
