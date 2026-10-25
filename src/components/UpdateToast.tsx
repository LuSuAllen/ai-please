import type { RuleUpdate } from '../types/game';

interface Props {
  update: RuleUpdate;
  onAck: () => void;
}

export function UpdateToast({ update, onAck }: Props) {
  return (
    <div className="toast-wrap">
      <div className="toast" role="status">
        <div className="t-head">
          <span className="blink">◉</span> RULE BROADCAST · 规则广播
        </div>
        <div className="t-detail">
          <strong>{update.headline}</strong>
          <br />
          {update.detail}
        </div>
        <button type="button" className="t-action" onClick={onAck}>
          <span className="btn-main">
            确认变更<span className="bi-en">ACKNOWLEDGE</span>
          </span>
        </button>
      </div>
    </div>
  );
}
