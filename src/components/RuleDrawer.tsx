import { useRef } from 'react';
import { useModalA11y } from '../hooks/useModalA11y';
import { REGIONS } from '../data/regions';
import { rulesForEvents } from '../data/rules';
import { isRegionOpen } from '../game/zones';
import type { GeneratedRun } from '../types/game';
import { RULE_ZH, Zh } from '../i18n/zh';

interface ToggleProps {
  ruleCount: number;
  onOpen: () => void;
}

/** 主滚动区里的规则入口 */
export function RuleToggle({ ruleCount, onOpen }: ToggleProps) {
  return (
    <button className="rule-toggle" onClick={onOpen} type="button">
      <span>
        <strong>{ruleCount} 条规则</strong> · RULES OF THE DAY
      </span>
      <span>
        <span className="cn">展开</span> ▸
      </span>
    </button>
  );
}

interface DrawerProps {
  run: GeneratedRun;
  index: number;
  onClose: () => void;
}

/** 全屏抽屉，挂在 stage 层级 */
export function RuleDrawer({ run, index, onClose }: DrawerProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y(dialogRef, { dismissible: true, onDismiss: onClose });
  const rules = rulesForEvents(run.events);
  // NEW 标记只看本局真实下发过的规则广播，不靠写死的索引
  const latestIntro = run.events
    .filter((e): e is Extract<GeneratedRun['events'][number], { kind: 'ruleIntro' }> => e.kind === 'ruleIntro')
    .filter((e) => e.index <= index)
    .sort((a, b) => a.index - b.index)
    .pop();
  const freshCode = latestIntro ? latestIntro.code : null;

  const zoneAt = run.events.filter(
    (e): e is Extract<GeneratedRun['events'][number], { kind: 'zoneChange' }> => e.kind === 'zoneChange' && e.index === index,
  );

  return (
    <div className="drawer" ref={dialogRef} role="dialog" aria-modal="true" aria-label="今日审核规则" tabIndex={-1}>
      <div className="drawer-panel">
        <div className="sheet-head">
          <span>
            {run.day} · RULES OF THE DAY<Zh>今日规则</Zh>
          </span>
          <button type="button" className="tag dim" onClick={onClose}>
            <span className="cn">关闭</span> ✕
          </button>
        </div>

        <div className="sheet-body">
          <div className="rule-list">
            {rules.map((r) => (
              <div key={r.code} className={`rule-item ${r.code === freshCode ? 'fresh' : ''}`}>
                <div>
                  <span className="rule-code">{r.code}</span>
                  <span className="rule-name">
                    {r.title}
                    {RULE_ZH[r.code] ? <Zh lg>{RULE_ZH[r.code]}</Zh> : null}
                  </span>
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
                  <th>代码</th>
                  <th>地区</th>
                  <th>时区</th>
                  <th>语言</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {REGIONS.map((r) => {
                  const zoneOpen = isRegionOpen(run.events, r.code, index);
                  const justOpened = zoneAt.some((e) => e.opens.includes(r.code));
                  const justClosed = zoneAt.some((e) => e.closes.includes(r.code));
                  return (
                    <tr key={r.code} className={zoneOpen ? 'opened' : 'closed'}>
                      <td>{r.code}</td>
                      <td>{r.name}</td>
                      <td>{r.timezone}</td>
                      <td>{r.language}</td>
                      <td style={{ color: zoneOpen ? 'var(--green)' : 'var(--red)' }}>
                        {zoneOpen ? '开放' : '关闭'}
                        {justClosed ? ' ↓' : ''}
                        {justOpened ? ' ↑' : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="home-foot" style={{ marginTop: 6, textAlign: 'left' }}>
              表头：CODE 地区码 / REGION 地区名 / TZ 标准时区 / LANG 注册语言 / ZONE 开放状态（OPEN 开放、
              CLOSED 关闭）。名单随 {run.day} 进度变更，规则广播会提示。时区与语言以本表为准。
            </p>
          </div>
        </div>

        <div className="sheet-foot">
          <button type="button" className="btn btn-wide" onClick={onClose}>
            <span className="btn-main">
              返回窗口<span className="bi-en">RETURN TO WINDOW</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
