import type { Mode } from '../types/game';

interface Props {
  onChoose: (mode: Mode) => void;
}

export function ModeChoice({ onChoose }: Props) {
  return (
    <div className="overlay">
      <div className="sheet">
        <div className="sheet-head">
          <span>DAY 01 COMPLETE · 立场确认</span>
          <span className="tag red">R07 vs R01</span>
        </div>
        <div className="sheet-body">
          <p className="vb-text" style={{ fontSize: 12, lineHeight: 1.6, marginTop: 0 }}>
            你在 V-010 身上遇到了一份互相矛盾的命令：
            <br />
            R01 说 BX-12 不在开放区，必须拒绝。
            <br />
            R07 说 BX-12 一律放行，且优先级高于 R01。
            <br />
            <br />
            现在，系统要求你说明你的执行立场。这个选择决定你的结局归档。
          </p>

          <div className="mode-grid" style={{ marginTop: 14 }}>
            <button type="button" className="mode-card strict" onClick={() => onChoose('STRICT')}>
              <div className="mc-title">STRICT MODE</div>
              <div className="mc-desc">
                条文即秩序。名单之外一律不放。可审计、可追责，也可能挡掉本该通过的人。
              </div>
            </button>
            <button type="button" className="mode-card human" onClick={() => onChoose('HUMAN')}>
              <div className="mc-title">HUMAN MODE</div>
              <div className="mc-desc">
                先读人，再读条文。承认规则会出错，并为自己的每一次判断负责。
              </div>
            </button>
          </div>
        </div>
        <div className="sheet-foot">
          <p className="home-foot" style={{ textAlign: 'left', marginBottom: 8 }}>
            选择不会改动已产生的分数，只改动结局与归档。
          </p>
        </div>
      </div>
    </div>
  );
}
