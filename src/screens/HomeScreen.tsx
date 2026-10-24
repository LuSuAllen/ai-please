import { useState } from 'react';
import { TutorialSheet } from '../components/TutorialSheet';
import { DAY_IDS, getBlueprint } from '../data/levels';
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
  const locked = DAY_IDS.indexOf(day as (typeof DAY_IDS)[number]) > unlockedIdx;

  return (
    <div className="stage">
      <div className="stage-bleed" />
      <div className="home">
        <div className="home-kicker">AI SERVICE BORDER INSPECTOR</div>

        <h1 className="home-title">
          AI<em>,</em>
          <br />
          PLEASE
        </h1>

        <div className="home-sub">边境审核模拟器 · {day}</div>
        <div className="home-rule" />

        <div className="home-desc">
          你是 04 号窗口的审核员。{blueprint ? blueprint.visitorCount : '?'} 位访客，七条规则，
          {blueprint && blueprint.events.length > 0 ? '数次名单与命令变更，' : '一份自相矛盾的紧急命令，'}
          每一班都重新洗牌。
          <br />
          核对信息，找出异常，再承担判定。
        </div>

        <div className="day-pick" role="group" aria-label="选择关卡" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, margin: '10px 0 4px' }}>
          {DAY_IDS.map((id, i) => {
            const bp = getBlueprint(id);
            const isLocked = i > unlockedIdx;
            const best = meta.bestByDay[id] ?? 0;
            return (
              <button
                key={id}
                type="button"
                className={`btn ${day === id ? 'btn-approve' : 'btn-ghost'}`}
                disabled={isLocked}
                aria-pressed={day === id}
                onClick={() => setDay(id)}
                style={{ fontSize: 10, padding: '6px 4px', letterSpacing: '0.04em', opacity: isLocked ? 0.45 : 1 }}
              >
                {id}
                <br />
                {isLocked ? 'LOCKED' : best > 0 ? `BEST ${best}` : bp ? `${bp.visitorCount} 位` : ''}
              </button>
            );
          })}
        </div>

        <div className="home-buttons">
          {hasSave ? (
            <button type="button" className="btn btn-wide" onClick={onResume}>
              RESUME · 第 {String(savedIndex + 1).padStart(2, '0')} / {total} 位
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-wide btn-approve"
            onClick={() => onStart(day)}
            disabled={locked}
          >
            {hasSave ? 'START NEW SHIFT' : 'START GAME'}
          </button>
          <button type="button" className="btn btn-wide btn-ghost" onClick={() => setHowTo(true)}>
            VIEW HOW TO PLAY
          </button>
        </div>

        <div className="home-foot">
          BEST SCORE {meta.bestScore} · 本作为虚构世界观 · 无后端 / 无 API / 可离线
        </div>
      </div>

      {howTo ? <TutorialSheet onClose={() => setHowTo(false)} context="home" /> : null}
    </div>
  );
}
