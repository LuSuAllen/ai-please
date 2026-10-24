import type { ReviewRecord } from '../types/game';

interface Props {
  day: string;
  index: number;
  total: number;
  funds: number;
  score: number;
  records: ReviewRecord[];
  clock: string;
}

export function StatusBar({ day, index, total, funds, score, records, clock }: Props) {
  return (
    <header className="statusbar">
      <div className="statusbar-top">
        <div className="brand">
          <span className="brand-mark">
            AI<b>,</b> PLEASE
          </span>
          <span className="brand-day">{day}</span>
        </div>
        <span className="status-clock">{clock}</span>
      </div>

      <div className="statusbar-bottom">
        <div className="stat">
          <span className="stat-label">VISITOR</span>
          <span className="stat-value mono-num">
            {String(index + 1).padStart(2, '0')}
            <span className="dim" style={{ color: 'var(--ink-faint)' }}>
              /{String(total).padStart(2, '0')}
            </span>
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">FUNDS</span>
          <span className={`stat-value mono-num ${funds < 400 ? 'warn' : ''}`}>¥{funds}</span>
        </div>
        <div className="stat">
          <span className="stat-label">SCORE</span>
          <span
            className={`stat-value mono-num ${score > 0 ? 'pos' : score < 0 ? 'warn' : ''}`}
          >
            {score}
          </span>
        </div>
      </div>

      <div
        className="stat-progress"
        role="progressbar"
        aria-label="访客判定进度"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={records.length}
        aria-valuetext={`已判 ${records.length} 位 · 共 ${total} 位`}
      >
        <div className="pip-track" aria-hidden="true">
          {Array.from({ length: total }).map((_, i) => {
            const rec = records[i];
            let cls = 'pip queued';
            if (rec) cls = `pip ${rec.isCorrect ? 'done-good' : 'done-bad'}`;
            else if (i === index) cls = 'pip current';
            return <span key={i} className={cls} />;
          })}
        </div>
      </div>
    </header>
  );
}
