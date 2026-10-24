import { useRef, useState } from 'react';
import { useModalA11y } from '../hooks/useModalA11y';
import type { CSSProperties, MouseEvent } from 'react';
import type { Verdict, Visitor } from '../types/game';
import { REGION_MAP, SERVICE_MAP } from '../data/regions';
import { derivePassport } from '../data/passport';
import { STAMP_MS } from '../game/engine';
import { PixelAvatar } from './PixelAvatar';

const ZOOM = 1.6;

interface Props {
  visitor: Visitor;
  inspected: boolean;
  stamp: Verdict | null;
  onStamp: (m: Verdict) => void;
  onClose: () => void;
}

function zoneName(code: string): string {
  const r = REGION_MAP[code];
  return r ? r.name : '';
}

/**
 * 护照放大查看层。
 * 放大不重排：外层 box 按 --z 撑开，内层 doc 反向缩回再 scale，滚动量天然正确。
 */
export function PassportZoom({ visitor, inspected, stamp, onStamp, onClose }: Props) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [z, setZ] = useState(1);
  const [origin, setOrigin] = useState('0px 0px');

  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y(dialogRef, { dismissible: true, onDismiss: onClose });

  function reset(nz: number) {
    setZ(nz);
    setOrigin('0px 0px');
    const el = bodyRef.current;
    if (el) {
      el.scrollLeft = 0;
      el.scrollTop = 0;
    }
  }

  function toggleAt(e: MouseEvent<HTMLDivElement>) {
    const el = bodyRef.current;
    if (!el) return;
    if ((e.target as HTMLElement).closest('[data-no-zoom]') !== null) return;
    if (z !== 1) {
      reset(1);
      return;
    }
    const rect = el.getBoundingClientRect();
    const ox = el.scrollLeft + (e.clientX - rect.left);
    const oy = el.scrollTop + (e.clientY - rect.top);
    setOrigin(`${ox}px ${oy}px`);
    setZ(ZOOM);
    window.requestAnimationFrame(() => {
      el.scrollLeft = Math.max(0, ox * ZOOM - el.clientWidth / 2);
      el.scrollTop = Math.max(0, oy * ZOOM - el.clientHeight / 2);
    });
  }

  const service = SERVICE_MAP[visitor.serviceId];
  const passport = derivePassport(visitor);
  const rows: { k: string; v: string; dim?: string }[] = [
    { k: 'IP REGION', v: visitor.ipRegion, dim: zoneName(visitor.ipRegion) },
    { k: 'TIMEZONE', v: visitor.timezone },
    { k: 'ACCOUNT REGION', v: visitor.accountRegion, dim: zoneName(visitor.accountRegion) },
    { k: 'LANGUAGE', v: visitor.language },
    { k: 'SERVICE', v: service?.name ?? visitor.serviceId, dim: service?.intent },
    { k: 'DEVICE', v: inspected ? visitor.device : 'WITHHELD · 需 INSPECT' },
    { k: 'SUBMITTED', v: visitor.submittedAt },
  ];

  return (
    <div className="pp-overlay" ref={dialogRef} role="dialog" aria-modal="true" aria-label={`护照详情 · ${visitor.name}`} tabIndex={-1}>
      <div className="pp-sheet ppz-sheet">
        <div className="ppz-head" data-no-zoom>
          <span className="ppz-title">PASSPORT · {visitor.code}</span>
          <span className="ppz-actions">
            <button
              type="button"
              className="tag cyan"
              onClick={() => reset(z === 1 ? ZOOM : 1)}
            >
              {z === 1 ? 'ZOOM 1.6×' : 'FIT'}
            </button>
            <button type="button" className="tag dim" onClick={onClose}>
              CLOSE
            </button>
          </span>
        </div>

        <div
          className={`ppz-body ${z !== 1 ? 'is-zoom' : ''}`}
          ref={bodyRef}
          onClick={toggleAt}
        >
          <div className="ppz-box" style={{ '--z': z } as CSSProperties}>
            <div className="ppz-doc" style={{ transformOrigin: origin } as CSSProperties}>
              <div className="ppz-sealmark">AI SERVICE BORDER · PERSONAL DOCUMENT</div>

              <div className="ppz-id">
                <div className="ppz-face">
                  <PixelAvatar seed={visitor.avatarSeed} size={64} />
                </div>
                <div className="ppz-id-meta">
                  <div className="ppz-line">
                    <span className="pp-k">SURNAME / NAME</span>
                    <span className="ppz-name">{visitor.name}</span>
                  </div>
                  <div className="ppz-line">
                    <span className="pp-k">ROMANIZED</span>
                    <span className="ppz-val">{visitor.alias}</span>
                  </div>
                  <div className="ppz-line">
                    <span className="pp-k">PASSPORT NO</span>
                    <span className="ppz-val mono-num">{passport.no}</span>
                  </div>
                </div>
              </div>

              <div className="ppz-table">
                {rows.map((r) => (
                  <div className="ppz-row" key={r.k}>
                    <span className="pp-k">{r.k}</span>
                    <span className="ppz-val">
                      {r.v}
                      {r.dim ? <span className="ppz-dim"> · {r.dim}</span> : null}
                    </span>
                  </div>
                ))}
                <div className="ppz-row">
                  <span className="pp-k">REASON</span>
                  <span className="ppz-val">{visitor.reason}</span>
                </div>
                <div className="ppz-row">
                  <span className="pp-k">ISSUED BY</span>
                  <span className="ppz-val">{passport.issuedBy}</span>
                </div>
                <div className="ppz-row">
                  <span className="pp-k">VALID</span>
                  <span className="ppz-val mono-num">
                    {passport.validFrom} → {passport.validTo}
                  </span>
                </div>
              </div>

              <div className="ppz-archive">
                <span className="pp-k">ARCHIVE · 非本局记录</span>
                <div className="ppz-archive-row">
                  {passport.archiveStamps.length === 0 ? (
                    <span className="ppz-mini empty">NO ENTRY</span>
                  ) : (
                    passport.archiveStamps.map((port, i) => (
                      <span className="ppz-mini" key={`${port}-${i}`}>
                        {port}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="ppz-mrz">
                P&lt;{visitor.ipRegion}
                {visitor.alias.replace(/[^A-Z]/g, '').padEnd(6, '<')}&lt;&lt;
                {passport.no.replace('-', '')}
              </div>

              {stamp ? (
                <div className={`ppz-stamp ${stamp === 'APPROVE' ? 'ok' : 'no'}`}>
                  <span>{stamp === 'APPROVE' ? 'APPROVED' : 'REFUSED'}</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="ppz-foot" data-no-zoom>
          <span className={`ppz-hint ${stamp ? 'on' : ''}`}>
            {stamp ? 'STAMP APPLIED · 归档中…' : '按下印章即生效，无法撤回'}
          </span>
          <div className="ppz-stamp-row">
            <button
              type="button"
              className="btn btn-approve"
              disabled={stamp !== null}
              onClick={() => onStamp('APPROVE')}
            >
              STAMP · APPROVE
              <small>GRANT ACCESS</small>
            </button>
            <button
              type="button"
              className="btn btn-deny"
              disabled={stamp !== null}
              onClick={() => onStamp('DENY')}
            >
              STAMP · DENY
              <small>REFUSE ENTRY</small>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const PASSPORT_STAMP_MS = STAMP_MS;
