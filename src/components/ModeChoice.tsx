import { useRef } from 'react';
import { useModalA11y } from '../hooks/useModalA11y';
import type { Mode } from '../types/game';

interface Props {
  day: string;
  /** 本局真正遇到冲突条款的访客编号；没有冲突时用通用措辞 */
  conflictCode?: string;
  onChoose: (mode: Mode) => void;
}

export function ModeChoice({ day, conflictCode, onChoose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y(dialogRef);
  return (
    <div className="overlay" ref={dialogRef} role="dialog" aria-modal="true" aria-label="立场确认" tabIndex={-1}>
      <div className="sheet">
        <div className="sheet-head">
          <span>{day} COMPLETE · 立场确认</span>
          <span className="tag red">{conflictCode ? 'R07 vs R01' : 'ARCHIVE MODE'}</span>
        </div>
        <div className="sheet-body">
          <p className="vb-text" style={{ fontSize: 12, lineHeight: 1.6, marginTop: 0 }}>
            {conflictCode ? (
              <>
                你在 {conflictCode} 身上遇到了一份互相矛盾的命令：
                <br />
                R01 说该区不在开放区，必须拒绝。
                <br />
                R07 说边境中立区一律豁免，且优先级高于 R01。
                <br />
                <br />
                现在，系统要求你说明你的执行立场。
              </>
            ) : (
              <>
                这一班没有遇到互相矛盾的命令，但你仍然要为自己的执行立场归档：
                <br />
                是把每一次判断都交回条文，还是把条文当作需要解释的东西？
              </>
            )}
          </p>

          <div className="mode-grid" style={{ marginTop: 14 }}>
            <button type="button" className="mode-card strict" onClick={() => onChoose('STRICT')}>
              <div className="mc-title">
                <span className="cn">条文模式</span>
                <span className="bi-en">STRICT MODE</span>
              </div>
              <div className="mc-desc">
                条文即秩序。名单之外一律不放，可审计，也可能挡掉本该通过的人。
              </div>
            </button>
            <button type="button" className="mode-card human" onClick={() => onChoose('HUMAN')}>
              <div className="mc-title">
                <span className="cn">人情模式</span>
                <span className="bi-en">HUMAN MODE</span>
              </div>
              <div className="mc-desc">
                先读人，再读条文。承认规则会出错，并为判断负责。
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
