import type { DailyScore } from '../../lib/news/types';

function labelClass(label: DailyScore['label']): string {
  if (label === 'Very Bullish' || label === 'Bullish') return 'pos';
  if (label === 'Very Bearish' || label === 'Bearish') return 'neg';
  return 'dim';
}

export function DailyScoreView({ score }: { score: DailyScore }) {
  return (
    <div className="stack">
      <div className={`stat accent-${score.score >= 60 ? 'pos' : score.score <= 40 ? 'neg' : 'warn'}`}>
        <div className="label">Daily News Score</div>
        <div className="value">{score.score}/100</div>
        <div className={`meta ${labelClass(score.label)}`}>{score.label}</div>
      </div>
      <div className="card">
        <div className="card-title">Factors</div>
        <div className="stack">
          {score.factors.map((f) => (
            <div className="kv" key={f.label}>
              <div className="k">{f.label}</div>
              <div className="v">{f.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
