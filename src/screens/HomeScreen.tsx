import { useState } from 'react';
import { TutorialSheet } from '../components/TutorialSheet';
import { Zh } from '../i18n/zh';
import { DAY_IDS, getBlueprint } from '../data/levels';
import { rulesForEvents } from '../data/rules';
import type { Meta } from '../game/storage';

interface Props {
  onStart: (day?: string, seed?: number) => void;
  onResume: () => void;
  hasSave: boolean;
  meta: Meta;
  savedIndex: number;
  total: number;
}

export function HomeScreen({ onStart, onResume, hasSave, meta, savedIndex, total }: Props) {
  const [howTo, setHowTo] = useState(false);
  const unlockedIdx = Math.max(0, DAY_IDS.indexOf(meta.unlockedDay as (typeof DAY_IDS)[number]));
  const [day, setDay] = useState<string>(DAY_IDS[unlockedIdx]);
  const blueprint = getBlueprint(day);
  // 规则数由本关实际事件推导（D01=6、D03=7），不再写死「七条规则」
  const ruleCount = blueprint ? rulesForEvents(blueprint.events).length : 0;
  const locked = DAY_IDS.indexOf(day as (typeof DAY_IDS)[number]) > unlockedIdx;

  return (
    <div className="stage">
      <div className="stage-bleed" />
      <div className="home">
        <div className="home-kicker">
          AI SERVICE BORDER INSPECTOR<Zh>AI 边境审核员</Zh>
        </div>

        <h1 className="home-title">
          AI<em>,</em>
          <br />
          PLEASE
        </h1>

        <div className="home-sub">边境审核模拟器 · {day}</div>
        <div className="home-rule" />

        <div className="home-desc">
          你是 04 号窗口的审核员。{blueprint ? blueprint.visitorCount : '?'} 位访客，{ruleCount} 条规则，
          {blueprint && blueprint.events.length > 0 ? '数次名单与命令变更，' : '一份自相矛盾的紧急命令，'}
          每一班都重新洗牌。
          <br />
          核对信息，找出异常，再承担判定。
        </div>

        <div className="day-pick" role="group" aria-label="选择关卡">
          {DAY_IDS.map((id, i) => {
            const bp = getBlueprint(id);
            const isLocked = i > unlockedIdx;
            const best = meta.bestByDay[id] ?? 0;
            return (
              <button
                key={id}
                type="button"
                className={`btn day-chip ${day === id ? 'btn-approve' : 'btn-ghost'}${isLocked ? ' day-chip-locked' : ''}`}
                disabled={isLocked}
                aria-pressed={day === id}
                aria-label={`${id} ${isLocked ? '未解锁' : best > 0 ? `BEST ${best}` : bp ? `${bp.visitorCount} 位访客` : ''}`}
                onClick={() => setDay(id)}
              >
                {id}
                <br />
                {isLocked ? (
                  <span className="cn">未解锁</span>
                ) : best > 0 ? (
                  `BEST ${best}`
                ) : bp ? (
                  `${bp.visitorCount} 位`
                ) : (
                  ''
                )}
              </button>
            );
          })}
        </div>

        <div className="home-buttons">
          <button
            type="button"
            className="btn btn-wide btn-approve"
            onClick={() => onStart(day)}
            disabled={locked}
          >
            开始游戏
            <small>{hasSave ? 'NEW SHIFT · START GAME' : 'START GAME'}</small>
          </button>
          {hasSave ? (
            <button type="button" className="btn btn-wide" onClick={onResume}>
              <span className="btn-main">
                继续审核
                <span className="bi-en">
                  RESUME · 第 {String(savedIndex + 1).padStart(2, '0')} / {total} 位
                </span>
              </span>
            </button>
          ) : null}
          <button type="button" className="btn btn-wide btn-ghost" onClick={() => setHowTo(true)}>
            <span className="btn-main">
              玩法说明<span className="bi-en">VIEW HOW TO PLAY</span>
            </span>
          </button>
        </div>

        <div className="home-foot">
          最高分 BEST SCORE {meta.bestScore} · 本作为虚构世界观 · 无后端 / 无 API / 可离线
        </div>
      </div>

      {howTo ? <TutorialSheet onClose={() => setHowTo(false)} context="home" /> : null}
    </div>
  );
}
