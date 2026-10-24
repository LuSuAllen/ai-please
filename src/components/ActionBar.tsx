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
          INSPECT
          <small>{inspected ? 'FILE OPEN' : `−¥${Math.abs(FUNDS_TABLE.inspect)}`}</small>
        </button>
        <button type="button" className="btn btn-deny" onClick={() => onMove('DENY')} disabled={disabled}>
          DENY
          <small>REFUSE ENTRY</small>
        </button>
        <button
          type="button"
          className="btn btn-approve"
          onClick={() => onMove('APPROVE')}
          disabled={disabled}
        >
          APPROVE
          <small>GRANT ACCESS</small>
        </button>
      </div>
    </footer>
  );
}
