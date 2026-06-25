export type TradeResult = 'win' | 'loss' | 'scratch';

/** A single logged trade. */
export interface Trade {
  id: string;
  user_id?: string;
  /** Whether the trader's written setup criteria were met. The crux of this app. */
  setup_criteria_met: boolean;
  /** Short free-text reason for entering. */
  entry_reason: string;
  result: TradeResult;
  /** Dollar magnitude the user entered (always >= 0). */
  amount: number;
  /** Signed P&L: win => +amount, loss => -amount, scratch => 0. The canonical money value. */
  pnl: number;
  /** Instrument symbol, e.g. ES, NQ, MES, MNQ, or a custom ticker. */
  instrument: string;
  /** ISO timestamp of when the trade was taken. */
  traded_at: string;
  /** ISO timestamp of when the row was created. */
  created_at?: string;
}

/** Fields supplied when creating a trade (server/store fills the rest). */
export type NewTrade = Omit<Trade, 'id' | 'user_id' | 'created_at'>;

/** User-configurable risk rules. One row per user. */
export interface Rules {
  id?: string;
  user_id?: string;
  /** Positive dollar amount. Day locks when today's P&L <= -daily_stop_loss. */
  daily_stop_loss: number;
  /** Day locks once this many trades are logged today. */
  max_trades_per_day: number;
  /** Account starting balance, e.g. 50000. */
  starting_balance: number;
  /** The balance the account must not fall below (blows the account if breached). */
  max_drawdown_floor: number;
  updated_at?: string;
}

export const INSTRUMENTS = ['ES', 'NQ', 'MES', 'MNQ'] as const;
