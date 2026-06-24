/**
 * Wallet top-up and service deposit payments (optional).
 * Phase 2 rides not ported — wallet is opt-in via WALLET_ENABLED only.
 */
export function isWalletEnabled(): boolean {
  return String(process.env.WALLET_ENABLED ?? "").trim().toLowerCase() === "true";
}
