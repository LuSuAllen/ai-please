import { useRef, useState } from 'react';
import { useModalA11y } from '../hooks/useModalA11y';

interface Props {
  onClose: () => void;
  context?: 'home' | 'game';
}

const STEPS: { n: string; t: string; d: string }[] = [
  { n: '01', t: '读申请', d: '核对 IP 地区、时区、语言、账号地区、申请服务、访问理由与设备号，找出彼此矛盾的线索。' },
  { n: '02', t: '对规则再检查', d: '打开 RULES OF THE DAY 对照 R01–R07；需要更多证据时，先花 ¥25 使用 INSPECT。' },
  { n: '03', t: '下判断并承担结果', d: '选择 APPROVE 或 DENY。判对 +100，误放行 −150，误拒绝 −100；十位访客后进入复盘。' },
];

export function TutorialSheet({ onClose, context = 'game' }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y(dialogRef, { dismissible: true, onDismiss: onClose });
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="overlay" ref={dialogRef} role="dialog" aria-modal="true" aria-label="三步上手" tabIndex={-1}>
      <div className="sheet">
        <div className="sheet-head">
          <span>HOW TO PLAY · 三步上手</span>
          <span className="tag cyan">{current.n} / 03</span>
        </div>
        <div className="sheet-body">
          <div className="rule-list">
            <div className="rule-item" key={current.n}>
              <div>
                <span className="rule-code">{current.n}</span>
                <span className="rule-name">{current.t}</span>
              </div>
              <div className="rule-body">{current.d}</div>
            </div>
          </div>
          <p className="home-foot" style={{ marginTop: 10, textAlign: 'left' }}>
            全部地区、服务与规则均为虚构世界观设定。
          </p>
        </div>
        <div className="sheet-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            跳过说明
          </button>
          {step > 0 ? (
            <button type="button" className="btn btn-ghost" onClick={() => setStep((value) => value - 1)}>
              上一步
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-wide"
            onClick={() => (isLast ? onClose() : setStep((value) => value + 1))}
          >
            {isLast ? (context === 'home' ? '返回首页 ▸' : '返回审核 ▸') : '下一步 ▸'}
          </button>
        </div>
      </div>
    </div>
  );
}
