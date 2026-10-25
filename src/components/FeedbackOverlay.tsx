import { useRef } from 'react';
import { useModalA11y } from '../hooks/useModalA11y';
import type { ReviewRecord, Visitor } from '../types/game';
import { FUNDS_TABLE, SCORE_TABLE } from '../game/engine';
import { METRIC_ZH, MOVE_ZH, STAMP_ZH, VERDICT_ZH, WRONG_KIND_ZH } from '../i18n/zh';

interface Props {
  record: ReviewRecord;
  visitor: Visitor;
  isLast: boolean;
  /** 0 基访客序号：计分表只在前两位出现，避免每单都重复教学 */
  index: number;
  /** 判定后的账户现值：用于「账户 1240 → 1090」对账，只读不改 */
  score: number;
  funds: number;
  onNext: () => void;
}

/** 正数带 +，负数用 U+2212（与既有 .delta 写法统一） */
function fmt(n: number): string {
  if (n === 0) return '0';
  return `${n > 0 ? '+' : '−'}${Math.abs(n)}`;
}

export function FeedbackOverlay({ record, visitor, isLast, index, score, funds, onNext }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y(dialogRef);
  const ok = record.isCorrect;
  const moveLabel =
    record.move === 'APPROVE' ? 'APPROVED' : record.move === 'DENY' ? 'DENIED' : 'INSPECTED';
  // 进到反馈层的判定只有 APPROVE / DENY（INSPECT 由 useGame 分流），错型据此派生
  const wrongKind = record.move === 'APPROVE' ? 'approve' : 'deny';
  const inspectCost = record.inspected ? Math.abs(FUNDS_TABLE.inspect) : 0;
  const netFunds = record.fundDelta - inspectCost;
  const scoreBefore = score - record.scoreDelta;
  const fundsBefore = funds - record.fundDelta + inspectCost;

  return (
    <div
      className="overlay"
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`判定结果：${ok ? '判定正确' : `判定错误，${WRONG_KIND_ZH[wrongKind]}`}`}
      tabIndex={-1}
    >
      <div className="sheet">
        <div className="sheet-head">
          <span>
            <span className="cn">{ok ? VERDICT_ZH.correct : VERDICT_ZH.wrong}</span>
            <span className="bi-en">{ok ? 'VERDICT ACCEPTED' : 'VERDICT REJECTED BY AUDIT'}</span>
          </span>
          <span className={`tag ${ok ? 'green' : 'red'}`}>{record.code}</span>
        </div>

        <div className="sheet-body">
          <div className="feedback">
            <div className={`stamp ${ok ? 'ok' : 'bad'}`} data-verdict={ok ? 'correct' : 'wrong'}>
              <span className="cn">{ok ? STAMP_ZH.correct : STAMP_ZH.wrong}</span>
              <span className="bi-en">{ok ? 'CORRECT' : 'WRONG'}</span>
            </div>
            <div className="stamp-sub">
              YOU: {moveLabel} · REQUIRED: {visitor.correct}
              <span className="bi-line">
                你的判定：{MOVE_ZH[record.move]} · 应为：{MOVE_ZH[visitor.correct]}
              </span>
              {ok ? null : <span className="bi-line">{WRONG_KIND_ZH[wrongKind]}</span>}
            </div>

            <div className="delta-row">
              <span
                className={`delta ${record.scoreDelta >= 0 ? 'up' : 'down'}`}
                data-kind="score"
                data-delta={record.scoreDelta}
              >
                {METRIC_ZH.score} {fmt(record.scoreDelta)}
              </span>
              <span
                className={`delta ${record.fundDelta >= 0 ? 'up' : 'down'}`}
                data-kind="funds"
                data-delta={record.fundDelta}
              >
                {METRIC_ZH.funds} {fmt(record.fundDelta)}
              </span>
              {record.inspected ? (
                <span className="delta flat" data-kind="inspect" data-delta={-inspectCost}>
                  {METRIC_ZH.inspect} −¥{inspectCost}
                </span>
              ) : null}
            </div>

            <div className="delta-row" style={{ marginTop: 6 }}>
              <span className="delta flat" data-kind="net">
                {METRIC_ZH.net} {METRIC_ZH.score} {fmt(record.scoreDelta)} · {METRIC_ZH.funds}{' '}
                {fmt(netFunds)}
              </span>
            </div>

            <div className="stamp-sub" style={{ marginTop: 6 }}>
              <span className="bi-line" style={{ marginTop: 0 }}>
                {METRIC_ZH.account} {scoreBefore} → {score} 分 · ¥{fundsBefore} → ¥{funds}
                {record.inspected ? '（开档只扣预算，不扣分数）' : ''}
              </span>
            </div>

            <div className="verdict-box">
              <span className="vb-label">判定依据</span>
              <div className="vb-text">{visitor.explanation}</div>
              <div className="rule-refs">
                {visitor.ruleRefs.map((r) => (
                  <span key={r} className="tag cyan">
                    {r}
                  </span>
                ))}
              </div>
            </div>

            {index < 2 ? (
              <div className="verdict-box">
                <span className="vb-label">
                  <span className="cn">计分表</span>
                  <span className="bi-en">SCORING TABLE</span>
                </span>
                <div className="vb-text" style={{ fontSize: 10.5, color: 'var(--ink-dim)' }}>
                  答对 +{SCORE_TABLE.correct} · 误放行 {SCORE_TABLE.wrongApprove} · 误拒绝{' '}
                  {SCORE_TABLE.wrongDeny}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="sheet-foot">
          <button type="button" className="btn btn-wide" onClick={onNext}>
            <span className="btn-main">
              {isLast ? '查看结算' : '下一位'}
              <span className="bi-en">{isLast ? 'PROCEED TO DEBRIEF ▸' : 'NEXT VISITOR ▸'}</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
