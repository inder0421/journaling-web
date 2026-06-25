import { CopyAccount } from "./types";

/** Unclamped contract count for an account at a given lead size. */
export function rawContracts(acct: CopyAccount, leadQty: number): number {
  if (acct.is_lead) return Math.max(0, Math.round(leadQty));
  return Math.max(0, Math.round(leadQty * (acct.multiplier || 0)));
}

/** Contracts to actually place: scaled by multiplier, then capped at the
 *  account's max-contracts limit (prop accounts have hard position caps). */
export function scaledContracts(acct: CopyAccount, leadQty: number): number {
  const raw = rawContracts(acct, leadQty);
  return acct.max_contracts > 0 ? Math.min(raw, acct.max_contracts) : raw;
}

/** True when the max-contracts cap clipped the scaled size. */
export function isCapped(acct: CopyAccount, leadQty: number): boolean {
  return acct.max_contracts > 0 && rawContracts(acct, leadQty) > acct.max_contracts;
}

/** Total contracts fired across all active accounts at a given lead size. */
export function totalContracts(accounts: CopyAccount[], leadQty: number): number {
  return accounts
    .filter((a) => a.active)
    .reduce((sum, a) => sum + scaledContracts(a, leadQty), 0);
}

export function leadOf(accounts: CopyAccount[]): CopyAccount | undefined {
  return accounts.find((a) => a.is_lead);
}

/** Suggested multiplier for a follower so its risk roughly matches the lead,
 *  proportional to account size. Rounded to 2 decimals. */
export function suggestMultiplier(follower: CopyAccount, lead: CopyAccount): number {
  if (!lead || lead.size <= 0) return 1;
  return Math.round((follower.size / lead.size) * 100) / 100;
}
