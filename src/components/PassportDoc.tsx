import type { Visitor } from '../types/game';
import { REGION_MAP, SERVICE_MAP } from '../data/regions';
import { derivePassport } from '../data/passport';
import { PixelAvatar } from './PixelAvatar';
import { TIER_ZH, Zh } from '../i18n/zh';

interface Props {
  visitor: Visitor;
  inspected: boolean;
  onOpen: () => void;
}

const TIER_LABEL: Record<Visitor['tier'], string> = {
  normal: 'STANDARD',
  anomaly: 'FLAGGED',
  inspect: 'DEEP CHECK',
  special: 'PRIORITY',
  conflict: 'CONTESTED',
};

const TIER_TONE: Record<Visitor['tier'], string> = {
  normal: 'dim',
  anomaly: 'amber',
  inspect: 'cyan',
  special: 'cyan',
  conflict: 'red',
};

function zoneLabel(code: string): { code: string; name: string } {
  const r = REGION_MAP[code];
  return { code, name: r ? r.name : '' };
}

/**
 * 护照内页 —— 这一块同时承担「访客身份」与「申请字段」，
 * 替代了旧版 VisitorCard + APPLICATION DATA 两个面板，避免第三套重复信息。
 */
export function PassportDoc({ visitor, inspected, onOpen }: Props) {
  const service = SERVICE_MAP[visitor.serviceId];
  const passport = derivePassport(visitor);
  const ip = zoneLabel(visitor.ipRegion);
  const account = zoneLabel(visitor.accountRegion);

  return (
    <div className="panel pp-panel">
      <div className="panel-head">
        <span className="panel-title">CHECKPOINT · WINDOW 04</span>
        <span className="pp-head-tags">
          <span className={`tag pp-tier ${TIER_TONE[visitor.tier]}`}>
            {TIER_LABEL[visitor.tier]}
            <Zh>{TIER_ZH[visitor.tier]}</Zh>
          </span>
          <button type="button" className="tag cyan pp-open" onClick={onOpen}>
            <span className="cn">护照</span> PASSPORT ▸
          </button>
        </span>
      </div>

      <div className="panel-body pp-body">
        <div className="pp-id">
          <button
            type="button"
            className="visitor-portrait pp-portrait"
            onClick={onOpen}
            aria-label={`查看 ${visitor.name} 的护照`}
          >
            <PixelAvatar seed={visitor.avatarSeed} size={56} />
          </button>
          <div className="pp-id-meta">
            <div className="visitor-code">{visitor.code}</div>
            <h2 className="visitor-name">{visitor.name}</h2>
            <div className="visitor-alias">{visitor.alias}</div>
            <div className="pp-id-tags">
              <span className="tag cyan">{service?.name ?? visitor.serviceId}</span>
              <span className="tag dim">{passport.no}</span>
            </div>
          </div>
        </div>

        <div className="pp-grid">
          <div className="pp-cell">
            <span className="pp-k">
              IP REGION<Zh>地区</Zh>
            </span>
            <span className="pp-v">{ip.code}</span>
            <span className="pp-sub">{ip.name}</span>
          </div>
          <div className="pp-cell">
            <span className="pp-k">
              TIMEZONE<Zh>时区</Zh>
            </span>
            <span className="pp-v mono-num">{visitor.timezone}</span>
            <span className="pp-sub">per R02</span>
          </div>
          <div className="pp-cell">
            <span className="pp-k">
              ACCOUNT REGION<Zh>账号</Zh>
            </span>
            <span className="pp-v">{account.code}</span>
            <span className="pp-sub">{account.name}</span>
          </div>
          <div className="pp-cell">
            <span className="pp-k">
              LANGUAGE<Zh>语言</Zh>
            </span>
            <span className="pp-v mono-num">{visitor.language}</span>
            <span className="pp-sub">per R04</span>
          </div>
        </div>

        <div className="pp-reason">
          <span className="pp-k">
            DECLARED REASON<Zh>申报理由</Zh>
          </span>
          <span className="pp-reason-text">{visitor.reason}</span>
        </div>

        <button type="button" className="pp-slots" onClick={onOpen} aria-label="查看护照详情">
          <span className="pp-slot">
            <span className="pp-slot-word">APPROVE</span>
            <span className="pp-slot-state">未盖章</span>
          </span>
          <span className="pp-slot deny">
            <span className="pp-slot-word">DENY</span>
            <span className="pp-slot-state">未盖章</span>
          </span>
        </button>

        <div className="pp-mrz">
          {`P<${visitor.ipRegion}${visitor.alias.replace(/[^A-Z]/g, '')}<<${passport.no.replace('-', '')}`}
        </div>

        <div className="pp-footline">
          <span>
            {inspected ? 'DEEP FILE UNSEALED' : 'SURFACE LAYER'}
            <Zh>{inspected ? '深档已开封' : '点护照放大'}</Zh>
          </span>
        </div>
      </div>
    </div>
  );
}
