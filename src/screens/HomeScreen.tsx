import { useState } from 'react';
import { TutorialSheet } from '../components/TutorialSheet';

interface Props {
  onStart: () => void;
  onResume: () => void;
  hasSave: boolean;
  bestScore: number;
  savedIndex: number;
  total: number;
}

export function HomeScreen({ onStart, onResume, hasSave, bestScore, savedIndex, total }: Props) {
  const [howTo, setHowTo] = useState(false);

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

        <div className="home-sub">边境审核模拟器 · DAY 01</div>
        <div className="home-rule" />

        <div className="home-desc">
          你是 04 号窗口的审核员。十位访客，七条规则，一次名单变更，一份自相矛盾的紧急命令。
          <br />
          核对信息，找出异常，然后承担你的判定。
        </div>

        <div className="home-buttons">
          {hasSave ? (
            <button type="button" className="btn btn-wide" onClick={onResume}>
              RESUME · 第 {String(savedIndex + 1).padStart(2, '0')} / {total} 位
            </button>
          ) : null}
          <button type="button" className="btn btn-wide btn-approve" onClick={onStart}>
            {hasSave ? 'START NEW SHIFT' : 'START GAME'}
          </button>
          <button type="button" className="btn btn-wide btn-ghost" onClick={() => setHowTo(true)}>
            VIEW HOW TO PLAY
          </button>
        </div>

        <div className="home-foot">
          BEST SCORE {bestScore} · 本作为虚构世界观 · 无后端 / 无 API / 可离线
        </div>
      </div>

      {howTo ? <TutorialSheet onClose={() => setHowTo(false)} context="home" /> : null}
    </div>
  );
}
