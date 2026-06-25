export type TradeResult = "win" | "loss" | "scratch";

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
