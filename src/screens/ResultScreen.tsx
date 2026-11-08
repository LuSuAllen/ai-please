import type { GameState } from '../types/game';
import { endingOf } from '../game/ending';
import { gradeOf } from '../game/engine';
import type { MyRank } from '../game/leaderboard';
import { useLeaderboardRank, type RankView } from '../hooks/useLeaderboardRank';

interface Props {
  state: GameState;
  bestScore: number;
  onRestart: () => void;
  onHome: () => void;
}

/** 因豁免条款而通过的申请：维护豁免 / 特赦 / 紧急令覆盖 */
const EXEMPT_TEMPLATES = new Set(['S-MAINT-UND', 'S-AMNESTY', 'C-OVERRIDE']);

/** 平台口径：前 500 名有序，前 100 名才带昵称 */
function rankLabel(my: MyRank): string {
  if (my.status === 'EXACT') return my.rank === null ? '—' : `#${my.rank}`;
  if (my.status === 'OVER_LIMIT') return '500+';
  if (my.status === 'NO_SCORE') return '未上榜';
  return '未参与';
}

function footLabel(view: Extract<RankView, { kind: 'ready' }>): string {
  if (view.nickname) return `「${view.nickname}」 · 昵称由小红书提供`;
  if (view.my.status === 'OVER_LIMIT') return '名次进了前 500 才会显示';
  if (view.my.status === 'NO_SCORE') return '本周还没有你的成绩';
  if (view.my.status === 'NOT_PARTICIPATING') return '本局成绩未计入排行榜';
  return '前 100 名才显示昵称';
}

/** 榜单卡片：全部复用 .panel / .result-cell，不新增 CSS，也不放动画 */
export function LeaderboardPanel({ view, retry }: { view: RankView; retry: () => void }) {
  if (view.kind === 'hidden') return null;
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">
          <span className="cn">本周排行榜</span>
          <span className="bi-en">WEEKLY RANK</span>
        </span>
        <span className="tag amber">
          <span className="cn">内测</span>
        </span>
      </div>
      <div className="panel-body">
        {view.kind === 'loading' ? (
          <p className="vb-text" style={{ marginBottom: 0 }}>
            正在同步本周成绩…
          </p>
        ) : null}
        {view.kind === 'error' ? (
          <p className="vb-text" style={{ marginBottom: 0 }}>
            排行榜暂不可用。
            <button
              type="button"
              onClick={retry}
              style={{
                background: 'transparent',
                border: 0,
                padding: '0 0 0 4px',
                color: 'inherit',
                font: 'inherit',
                textDecoration: 'underline',
                cursor: 'pointer',
              }}
            >
              重试
            </button>
          </p>
        ) : null}
        {view.kind === 'ready' ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <div className="result-cell">
                <span className="k">本周成绩</span>
                <span
                  className={`v ${
                    (view.my.score ?? 0) > 0 ? 'pos' : (view.my.score ?? 0) < 0 ? 'neg' : ''
                  }`}
                >
                  {view.my.score ?? '—'}
                </span>
              </div>
              <div className="result-cell">
                <span className="k">本周名次</span>
                <span className="v">{rankLabel(view.my)}</span>
              </div>
            </div>
            <div className="home-sub2" style={{ marginTop: 6 }}>
              {footLabel(view)}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function ResultScreen({ state, bestScore, onRestart, onHome }: Props) {
  const run = state.run;
  const { view: rankView, retry: retryRank } = useLeaderboardRank({
    day: run?.day ?? null,
    score: state.score,
    seed: run?.seed ?? null,
  });
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
          <div className="home-kicker">
            {run?.day ?? 'DAY'} · <span className="cn">班次报告</span>
            <span className="bi-en">SHIFT REPORT</span>
          </div>
          <div className={`result-grade ${grade.tone}`}>{grade.grade}</div>
          <div className="home-sub2" style={{ marginTop: 4 }}>
            最高分 {Math.max(bestScore, state.score)}
          </div>
        </div>

        <div className="result-grid">
          <div className="result-cell">
            <span className="k">判定正确</span>
            <span className="v pos">
              {correct}/{total}
            </span>
          </div>
          <div className="result-cell">
            <span className="k">判定错误</span>
            <span className={`v ${wrong > 0 ? 'neg' : ''}`}>{wrong}</span>
          </div>
          <div className="result-cell">
            <span className="k">开档次数</span>
            <span className="v">{state.inspectedCount}</span>
          </div>
          <div className="result-cell">
            <span className="k">误放行</span>
            <span className={`v ${wrongApprove > 0 ? 'neg' : ''}`}>{wrongApprove}</span>
          </div>
          <div className="result-cell">
            <span className="k">误拒绝</span>
            <span className={`v ${wrongDeny > 0 ? 'neg' : ''}`}>{wrongDeny}</span>
          </div>
          <div className="result-cell conclusion">
            <span className="k">总分</span>
            <span className={`v ${state.score > 0 ? 'pos' : state.score < 0 ? 'neg' : ''}`}>
              {state.score}
            </span>
          </div>
          <div className="result-cell conclusion">
            <span className="k">预算结余</span>
            <span className="v">¥{state.funds}</span>
            {state.inspectedCount > 0 ? (
              <span className="bi-line">开档支出 −¥{state.inspectedCount * 25}</span>
            ) : null}
          </div>
        </div>

        <LeaderboardPanel view={rankView} retry={retryRank} />

        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">
              <span className="cn">最终裁定</span>
              <span className="bi-en">FINAL VERDICT</span>
            </span>
            <span className="tag cyan">
              <span className="cn">归档</span>
            </span>
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
            <span className="panel-title">
              <span className="cn">审核流水</span>
              <span className="bi-en">AUDIT LOG</span>
            </span>
          </div>
          <div className="panel-body">
            <div className="log">
              {state.records.map((r) => {
                return (
                  <div className={`log-row${r.isCorrect ? '' : ' bad'}`} key={r.visitorId}>
                    <span className="mv">{r.code}</span>
                    <span className={r.isCorrect ? 'ok' : 'no'}>
                      {r.move} → {r.correct}
                      {r.inspected ? ' · INSP' : ''}
                    </span>
                    <span className={r.scoreDelta >= 0 ? 'ok' : 'no'}>
                      {r.scoreDelta > 0 ? '+' : ''}
                      {r.scoreDelta}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="home-buttons">
          <button type="button" className="btn btn-wide btn-approve" onClick={onRestart}>
            <span className="btn-main">
              再玩一次<span className="bi-en">PLAY AGAIN</span>
            </span>
          </button>
          <button type="button" className="btn btn-wide btn-ghost" onClick={onHome}>
            <span className="btn-main">
              返回主菜单<span className="bi-en">BACK TO MENU</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
