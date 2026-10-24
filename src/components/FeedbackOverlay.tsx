import type { ReviewRecord, Visitor } from '../types/game';
import { SCORE_TABLE } from '../game/engine';

interface Props {
  record: ReviewRecord;
  visitor: Visitor;
  isLast: boolean;
  onNext: () => void;
}

export function FeedbackOverlay({ record, visitor, isLast, onNext }: Props) {
  const ok = record.isCorrect;
  const moveLabel =
    record.move === 'APPROVE' ? 'APPROVED' : record.move === 'DENY' ? 'DENIED' : 'INSPECTED';

  return (
    <div className="overlay">
      <div className="sheet">
        <div className="sheet-head">
          <span>{ok ? 'VERDICT ACCEPTED' : 'VERDICT REJECTED BY AUDIT'}</span>
          <span className={`tag ${ok ? 'green' : 'red'}`}>{record.code}</span>
        </div>

        <div className="sheet-body">
          <div className="feedback">
            <div className={`stamp ${ok ? 'ok' : 'bad'}`}>{ok ? 'CORRECT' : 'WRONG'}</div>
            <div className="stamp-sub">
              YOU: {moveLabel} · REQUIRED: {visitor.correct}
            </div>

            <div className="delta-row">
              <span className={`delta ${record.scoreDelta >= 0 ? 'up' : 'down'}`}>
                SCORE {record.scoreDelta > 0 ? '+' : ''}
                {record.scoreDelta}
              </span>
              <span className={`delta ${record.fundDelta >= 0 ? 'up' : 'down'}`}>
                FUNDS {record.fundDelta > 0 ? '+' : ''}
                {record.fundDelta}
              </span>
              {record.inspected ? <span className="delta">INSPECT −25</span> : null}
            </div>

            <div className="verdict-box">
              <span className="vb-label">JUDGEMENT BASIS</span>
              <div className="vb-text">{visitor.explanation}</div>
              <div className="rule-refs">
                {visitor.ruleRefs.map((r) => (
                  <span key={r} className="tag cyan">
                    {r}
                  </span>
                ))}
              </div>
            </div>

            <div className="verdict-box">
              <span className="vb-label">SCORING TABLE</span>
              <div className="vb-text" style={{ fontSize: 10.5, color: 'var(--ink-dim)' }}>
                CORRECT +{SCORE_TABLE.correct} · 误放行 {SCORE_TABLE.wrongApprove} · 误拒绝{' '}
                {SCORE_TABLE.wrongDeny}
              </div>
            </div>
          </div>
        </div>

        <div className="sheet-foot">
          <button type="button" className="btn btn-wide" onClick={onNext}>
            {isLast ? 'PROCEED TO DEBRIEF ▸' : 'NEXT VISITOR ▸'}
          </button>
        </div>
      </div>
    </div>
  );
}
