interface Props {
  onClose: () => void;
}

const STEPS: { n: string; t: string; d: string }[] = [
  { n: '01', t: '你是审核员', d: '你在 AI 服务边境检查站的 04 号窗口值班。每位访客都递交了一份申请。' },
  { n: '02', t: '读申请', d: 'IP 地区、时区、语言、账号地区、申请服务、访问理由、设备号。七项信息。' },
  { n: '03', t: '对规则', d: '点开 RULES OF THE DAY，核对 R01–R07。地区注册表给出每个区的标准时区与语言。' },
  { n: '04', t: 'INSPECT', d: '表面正常的申请，先花 ¥25 开档。隐藏线索只会在这里出现。' },
  { n: '05', t: '下判断', d: 'APPROVE 或 DENY。判对 +100，误放行 −150，误拒绝 −100。' },
  { n: '06', t: '承担结果', d: '十位访客后进入复盘，并选择你的执行立场：STRICT 或 HUMAN。' },
];

export function TutorialSheet({ onClose }: Props) {
  return (
    <div className="overlay">
      <div className="sheet">
        <div className="sheet-head">
          <span>HOW TO PLAY · 新手说明</span>
          <span className="tag cyan">DAY 01</span>
        </div>
        <div className="sheet-body">
          <div className="rule-list">
            {STEPS.map((s) => (
              <div className="rule-item" key={s.n}>
                <div>
                  <span className="rule-code">{s.n}</span>
                  <span className="rule-name">{s.t}</span>
                </div>
                <div className="rule-body">{s.d}</div>
              </div>
            ))}
          </div>
          <p className="home-foot" style={{ marginTop: 10, textAlign: 'left' }}>
            全部地区、服务与规则均为虚构世界观设定。
          </p>
        </div>
        <div className="sheet-foot">
          <button type="button" className="btn btn-wide" onClick={onClose}>
            REPORT TO WINDOW 04 ▸
          </button>
        </div>
      </div>
    </div>
  );
}
