import { useRef } from 'react';
import { useModalA11y } from '../hooks/useModalA11y';
import { REGIONS, isOpen } from '../data/regions';
import { activeRules } from '../data/rules';

interface ToggleProps {
  index: number;
  onOpen: () => void;
}

/** 主滚动区里的规则入口 */
export function RuleToggle({ index, onOpen }: ToggleProps) {
  const rules = activeRules(index);
  return (
    <button className="rule-toggle" onClick={onOpen} type="button">
      <span>
        RULES OF THE DAY · <strong>{rules.length} ACTIVE</strong>
      </span>
      <span>OPEN ▸</span>
    </button>
  );
}

interface DrawerProps {
  index: number;
  onClose: () => void;
}

/** 全屏抽屉，挂在 stage 层级 */
export function RuleDrawer({ index, onClose }: DrawerProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y(dialogRef, { dismissible: true, onDismiss: onClose });
  const rules = activeRules(index);
  const freshCode = index >= 8 ? 'R07' : index >= 3 ? 'R06' : null;

  return (
    <div className="drawer" ref={dialogRef} role="dialog" aria-modal="true" aria-label="今日审核规则" tabIndex={-1}>
      <div className="drawer-panel">
        <div className="sheet-head">
          <span>DAY 01 · RULES OF THE DAY</span>
          <button type="button" className="tag dim" onClick={onClose}>
            CLOSE ✕
          </button>
        </div>

        <div className="sheet-body">
          <div className="rule-list">
            {rules.map((r) => (
              <div key={r.code} className={`rule-item ${r.code === freshCode ? 'fresh' : ''}`}>
                <div>
                  <span className="rule-code">{r.code}</span>
                  <span className="rule-name">{r.title}</span>
                  {r.code === freshCode ? (
                    <span className="tag cyan" style={{ marginLeft: 6 }}>
                      NEW
                    </span>
                  ) : null}
                </div>
                <div className="rule-body">{r.body}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="panel-title" style={{ marginBottom: 5 }}>
              REGION REGISTRY · 开放区注册表
            </div>
            <table className="region-table">
              <thead>
                <tr>
                  <th>CODE</th>
                  <th>REGION</th>
                  <th>TZ</th>
                  <th>LANG</th>
                  <th>ZONE</th>
                </tr>
              </thead>
              <tbody>
                {REGIONS.map((r) => {
                  const zoneOpen = isOpen(r.code, index);
                  const justOpened = r.openFrom > 0 && r.openFrom === index;
                  const justClosed = r.openUntil !== null && r.openUntil === index;
                  return (
                    <tr key={r.code} className={zoneOpen ? 'opened' : 'closed'}>
                      <td>{r.code}</td>
                      <td>{r.name}</td>
                      <td>{r.timezone}</td>
                      <td>{r.language}</td>
                      <td style={{ color: zoneOpen ? 'var(--green)' : 'var(--red)' }}>
                        {zoneOpen ? 'OPEN' : 'CLOSED'}
                        {justClosed ? ' ↓' : ''}
                        {justOpened ? ' ↑' : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="home-foot" style={{ marginTop: 6, textAlign: 'left' }}>
              名单随 DAY 01 进度变更，规则广播会提示。时区与语言以本表为准。
            </p>
          </div>
        </div>

        <div className="sheet-foot">
          <button type="button" className="btn btn-wide" onClick={onClose}>
            RETURN TO WINDOW
          </button>
        </div>
      </div>
    </div>
  );
}
