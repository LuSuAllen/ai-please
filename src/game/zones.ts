import type { GameEvent } from '../types/game';
import { REGIONS } from '../data/regions.ts';

/** 事件对"第 index 位及之后"的访客生效（广播在该位访客进入前推送并需确认）。 */

export function openRegionsAt(events: readonly GameEvent[], index: number): string[] {
  const open = new Set(REGIONS.filter((r) => r.baseOpen).map((r) => r.code));
  for (const e of events) {
    if (e.kind !== 'zoneChange' || e.index > index) continue;
    for (const c of e.closes) open.delete(c);
    for (const c of e.opens) open.add(c);
  }
  return REGIONS.map((r) => r.code).filter((c) => open.has(c));
}

export function isRegionOpen(events: readonly GameEvent[], code: string, index: number): boolean {
  return openRegionsAt(events, index).includes(code);
}

export function ruleActiveAt(events: readonly GameEvent[], code: string, index: number): boolean {
  if (code === 'R06' || code === 'R07') {
    return events.some((e) => e.kind === 'ruleIntro' && e.code === code && e.index <= index);
  }
  return true;
}

export function amnestyActiveAt(events: readonly GameEvent[], index: number): boolean {
  return events.some((e) => e.kind === 'amnesty' && index >= e.index && index < e.index + e.length);
}
