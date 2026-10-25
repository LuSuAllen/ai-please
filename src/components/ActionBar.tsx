import type { Move } from '../types/game';
import { FUNDS_TABLE } from '../game/engine';

interface Props {
  onMove: (m: Move) => void;
  onInspect: () => void;
  inspected: boolean;
  disabled: boolean;
}

export function ActionBar({ onMove, onInspect, inspected, disabled }: Props) {
  return (
    <footer className="actionbar">
      <div className="action-grid">
        <button
          type="button"
          className="btn btn-inspect"
          onClick={onInspect}
          disabled={disabled || inspected}
        >
          <span className="btn-main">
            开档<span className="bi-en">INSPECT</span>
          </span>
          <small>{inspected ? 'FILE OPEN · 已开档' : `−¥${Math.abs(FUNDS_TABLE.inspect)}`}</small>
        </button>
        <button type="button" className="btn btn-deny" onClick={() => onMove('DENY')} disabled={disabled}>
          <span className="btn-main">
            拒绝<span className="bi-en">DENY</span>
          </span>
          <small>REFUSE ENTRY</small>
        </button>
        <button
          type="button"
          className="btn btn-approve"
          onClick={() => onMove('APPROVE')}
          disabled={disabled}
        >
          <span className="btn-main">
            放行<span className="bi-en">APPROVE</span>
          </span>
          <small>GRANT ACCESS</small>
        </button>
      </div>
    </footer>
  );
}
