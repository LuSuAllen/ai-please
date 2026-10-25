import { useEffect, useRef, useState } from 'react';
import type { GameState, Mode, Move, Verdict, Visitor } from '../types/game';
import { STAMP_MS } from '../game/engine';
import { Zh } from '../i18n/zh';
import { StatusBar } from '../components/StatusBar';
import { PassportDoc } from '../components/PassportDoc';
import { PassportZoom } from '../components/PassportZoom';
import { RuleDrawer, RuleToggle } from '../components/RuleDrawer';
import { rulesForEvents } from '../data/rules';
import { ActionBar } from '../components/ActionBar';
import { FeedbackOverlay } from '../components/FeedbackOverlay';
import { UpdateToast } from '../components/UpdateToast';
import { TutorialSheet } from '../components/TutorialSheet';
import { ModeChoice } from '../components/ModeChoice';

interface Props {
  state: GameState;
  visitor: Visitor;
  total: number;
  isLast: boolean;
  showVerdict: boolean;
  onMove: (m: Move) => void;
  onInspect: () => void;
  onNext: () => void;
  onOpenRules: () => void;
  onCloseRules: () => void;
  onAckUpdate: () => void;
  onCloseTutorial: () => void;
  onChooseMode: (m: Mode) => void;
}

function clockOf(visitor: Visitor): string {
  const parts = visitor.submittedAt.split('·');
  return parts.length > 1 ? parts[1].trim() : '09:00';
}

export function GameScreen(props: Props) {
  const { state, visitor, total, isLast } = props;
  const [passportOpen, setPassportOpen] = useState(false);
  const [stamp, setStamp] = useState<Verdict | null>(null);
  const timerRef = useRef<number | null>(null);

  // 换访客时复位护照层与印章，避免上一位的章串到下一位
  useEffect(() => {
    setPassportOpen(false);
    setStamp(null);
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [visitor.id]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  // 盖章：立刻派发判定（分数与状态由 engine 单一来源计算），章落定后再移交反馈层。
  // reduced-motion 下动画被压到 0.01ms，等待必须同步归零；默认 340ms 对齐 stamp-in 320ms。
  // STAMP_MS 只作为上限兜底，不再作为固定等待时长。
  function handleStamp(move: Verdict) {
    if (stamp !== null || state.phase !== 'playing' || state.pendingUpdate !== null) return;
    setStamp(move);
    props.onMove(move);
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const wait = Math.min(reduced ? 0 : 340, STAMP_MS);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setStamp(null);
      setPassportOpen(false);
    }, wait);
  }

  const lockActions = state.phase !== 'playing' || state.pendingUpdate !== null;
  const ruleCount = state.run ? rulesForEvents(state.run.events).length : 0;

  return (
    <div className="stage">
      <div className="stage-bleed" />

      <StatusBar
        day={state.run?.day ?? 'DAY'}
        index={state.index}
        total={total}
        funds={state.funds}
        score={state.score}
        records={state.records}
        clock={clockOf(visitor)}
      />

      <main className="main">
        <PassportDoc
          visitor={visitor}
          inspected={state.inspected}
          onOpen={() => setPassportOpen(true)}
        />

        {visitor.signals.length > 0 ? (
          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">
                异常扫描
              </span>
              <span className="tag amber">
                {visitor.signals.length} FLAG<Zh>条标记</Zh>
              </span>
            </div>
            <div className="panel-body">
              <div className="signal-stack">
                {visitor.signals.map((s) => (
                  <div key={s.code} className={`signal ${s.level}`}>
                    <span className="sig-level">{s.level.toUpperCase()}</span>
                    <span className="sig-code">{s.code}</span>
                    <span>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <div className={`panel deep-panel${state.inspected ? '' : ' capped'}`}>
          <div className="panel-head">
            <span className="panel-title">
              DEEP FILE<Zh>深档</Zh>
            </span>
            <span className={`tag ${state.inspected ? 'green' : 'dim'}`}>
              {state.inspected ? 'OPEN' : 'SEALED'}
              <Zh>{state.inspected ? '已开档' : '未开档'}</Zh>
            </span>
          </div>
          <div className="panel-body">
            {state.inspected ? (
              <div>
                <div className="deep-rows">
                  <div className="info-row">
                    <span className="info-key">
                      DEVICE<Zh>设备</Zh>
                    </span>
                    <span className="info-val mono-num">{visitor.device}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-key">
                      SUBMITTED<Zh>提交时间</Zh>
                    </span>
                    <span className="info-val mono-num">{visitor.submittedAt}</span>
                  </div>
                </div>
                {visitor.hiddenClues.map((c) => (
                  <div className="clue" key={c}>
                    <span>{c}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="locked">
                <span className="locked-line" />
                <span>
                  开档解锁 · ¥25
                </span>
                <span className="locked-line" />
              </div>
            )}
          </div>
        </div>

      </main>

      <RuleToggle ruleCount={ruleCount} onOpen={props.onOpenRules} />

      <ActionBar
        onMove={props.onMove}
        onInspect={props.onInspect}
        inspected={state.inspected}
        disabled={lockActions}
      />

      {state.pendingUpdate ? (
        <UpdateToast update={state.pendingUpdate} onAck={props.onAckUpdate} />
      ) : null}

      {passportOpen ? (
        <PassportZoom
          visitor={visitor}
          inspected={state.inspected}
          stamp={stamp}
          onStamp={handleStamp}
          onClose={() => setPassportOpen(false)}
        />
      ) : null}

      {state.ruleDrawerOpen && state.run ? (
        <RuleDrawer run={state.run} index={state.index} onClose={props.onCloseRules} />
      ) : null}

      {state.tutorialOpen ? <TutorialSheet onClose={props.onCloseTutorial} /> : null}

      {props.showVerdict ? (
        <ModeChoice
          day={state.run?.day ?? 'DAY'}
          conflictCode={state.run?.visitors.find((v) => v.templateId.startsWith('C-'))?.code}
          onChoose={props.onChooseMode}
        />
      ) : null}

      {state.phase === 'feedback' && state.lastRecord && stamp === null ? (
        <FeedbackOverlay
          record={state.lastRecord}
          visitor={visitor}
          isLast={isLast}
          index={state.records.length - 1}
          score={state.score}
          funds={state.funds}
          onNext={props.onNext}
        />
      ) : null}

      {/* 屏幕阅读器播报：只播判定结果，不泄露解释与答案 */}
      <div className="sr-only" role="status" aria-live="polite">
        {state.lastRecord
          ? `第 ${state.records.length} 位：判定 ${state.lastRecord.move}，${state.lastRecord.isCorrect ? '正确' : '错误'}`
          : ''}
      </div>
    </div>
  );
}
