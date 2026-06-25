export type TradeResult = "win" | "loss" | "breakeven" | "no_trade";

/** A single logged trade. `amount` is always a positive dollar magnitude;
 *  signed P&L is derived from `result` (see calc.ts → pnlOf). */
export interface Trade {
  id: string;
  created_at: string; // ISO timestamp
  setup_met: boolean; // did the trade meet documented setup criteria?
  entry_reason: string;
  result: TradeResult;
  amount: number; // positive magnitude in dollars
  instrument: string; // ES, NQ, MES, MNQ, or custom
}

/** User-configurable risk rules. Stored per user. */
export interface Rules {
  daily_stop_loss: number; // dollars; lockout when today's net P&L <= -this
  max_trades_per_day: number; // lockout when today's trade count >= this
  starting_balance: number; // account starting balance in dollars
  max_drawdown_floor: number; // lowest account balance allowed before blown
}

export const DEFAULT_RULES: Rules = {
  daily_stop_loss: 500,
  max_trades_per_day: 2,
  starting_balance: 50000,
  max_drawdown_floor: 48000,
};

export const INSTRUMENTS = ["ES", "NQ", "MES", "MNQ"] as const;

/** New-trade payload before an id/timestamp is assigned. */
export type NewTrade = Omit<Trade, "id" | "created_at"> & {
  created_at?: string;
};

/** A trading account for the multi-account copy tab. The "lead" account is the
 *  one you trade; followers mirror it, scaled by `multiplier` and capped at
 *  `max_contracts` (prop accounts have hard position limits). */
export interface CopyAccount {
  id: string;
  created_at: string;
  firm: string; // e.g. "Lucid", "Alpha Futures"
  label: string; // nickname / account number
  size: number; // account size in dollars (reference for scaling)
  multiplier: number; // contracts per 1 lead contract (lead is effectively 1)
  max_contracts: number; // hard cap; 0 = no cap
  is_lead: boolean;
  active: boolean; // include in the copy plan
}

export type NewCopyAccount = Omit<CopyAccount, "id" | "created_at"> & {
  created_at?: string;
};

export const DEFAULT_ACCOUNT: Omit<CopyAccount, "id" | "created_at"> = {
  firm: "",
  label: "",
  size: 50000,
  multiplier: 1,
  max_contracts: 0,
  is_lead: false,
  active: true,
};
