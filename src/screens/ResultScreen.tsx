import type { GameState } from '../types/game';
import { endingOf } from '../game/ending';
import { gradeOf } from '../game/engine';

interface Props {
  state: GameState;
  bestScore: number;
  onRestart: () => void;
  onHome: () => void;
}

/** 因豁免条款而通过的申请：维护豁免 / 特赦 / 紧急令覆盖 */
const EXEMPT_TEMPLATES = new Set(['S-MAINT-UND', 'S-AMNESTY', 'C-OVERRIDE']);

export function ResultScreen({ state, bestScore, onRestart, onHome }: Props) {
  const run = state.run;
  const visitors = run?.visitors ?? [];
  const total = run?.total ?? 0;
  const correct = state.records.filter((r) => r.isCorrect).length;
  const wrong = state.records.length - correct;
  const wrongApprove = state.records.filter((r) => !r.isCorrect && r.move === 'APPROVE').length;
  const wrongDeny = state.records.filter((r) => !r.isCorrect && r.move === 'DENY').length;
  const grade = gradeOf(state.score, total);
  const exemptApproved = state.records.filter((r) => {
    const visitor = visitors.find((v) => v.id === r.visitorId);
    return r.isCorrect && r.move === 'APPROVE' && visitor !== undefined && EXEMPT_TEMPLATES.has(visitor.templateId);
  }).length;
  const ending = state.mode
    ? endingOf(state.mode, { total, correct, wrong, inspectedCount: state.inspectedCount, exemptApproved })
    : null;

  return (
    <div className="stage">
      <div className="stage-bleed" />
      <div className="result">
        <div className="result-head">
          <div className="home-kicker">{run?.day ?? 'DAY'} · SHIFT REPORT</div>
          <div className={`result-grade ${grade.tone}`}>{grade.grade}</div>
          <div className="home-sub2" style={{ marginTop: 4 }}>
            最高分 {Math.max(bestScore, state.score)}
          </div>
        </div>

        <div className="result-grid">
          <div className="result-cell">
            <span className="k">CORRECT · 判定正确</span>
            <span className="v pos">
              {correct}/{total}
            </span>
          </div>
          <div className="result-cell">
            <span className="k">WRONG · 判定错误</span>
            <span className={`v ${wrong > 0 ? 'neg' : ''}`}>{wrong}</span>
          </div>
          <div className="result-cell">
            <span className="k">INSPECT · 开档次数</span>
            <span className="v">{state.inspectedCount}</span>
          </div>
          <div className="result-cell">
            <span className="k">MISJUDGED · 误判</span>
            <span className={`v ${wrong > 0 ? 'neg' : ''}`}>
              {wrongApprove} / {wrongDeny}
            </span>
          </div>
          <div className="result-cell conclusion">
            <span className="k">FINAL SCORE · 总分</span>
            <span className={`v ${state.score > 0 ? 'pos' : state.score < 0 ? 'neg' : ''}`}>
              {state.score}
            </span>
          </div>
          <div className="result-cell conclusion">
            <span className="k">FINAL FUNDS · 预算结余</span>
            <span className="v">¥{state.funds}</span>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">FINAL VERDICT · {state.mode ?? 'NONE'}</span>
            <span className="tag cyan">ARCHIVE</span>
          </div>
          <div className="panel-body">
            <div className="vb-text" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em' }}>
              {ending ? ending.title : 'ENDING · UNRESOLVED'}
            </div>
            <p className="vb-text" style={{ marginBottom: 0 }}>
              {ending ? ending.body : '记录未归档。'}
            </p>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">AUDIT LOG · 审核流水</span>
          </div>
          <div className="panel-body">
            <div className="log">
              {state.records.map((r) => {
                const v = visitors.find((x) => x.id === r.visitorId);
                return (
                  <div className="log-row" key={r.visitorId}>
                    <span className="mv">{r.code}</span>
                    <span className={r.isCorrect ? 'ok' : 'no'}>
                      {r.move} → {r.correct}
                      {r.inspected ? ' · INSP' : ''}
                    </span>
                    <span className={r.scoreDelta >= 0 ? 'ok' : 'no'}>
                      {r.scoreDelta > 0 ? '+' : ''}
                      {r.scoreDelta}
                    </span>
                    <span style={{ display: 'none' }}>{v?.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="home-buttons">
          <button type="button" className="btn btn-wide btn-approve" onClick={onRestart}>
            PLAY AGAIN
          </button>
          <button type="button" className="btn btn-wide btn-ghost" onClick={onHome}>
            BACK TO MENU
          </button>
        </div>
      </div>
    </div>
  );
}
