import type { Mode } from '../types/game.ts';

/** 结算文案依赖本局数据，不再写死任何访客编号。 */
export interface EndingSummary {
  total: number;
  correct: number;
  wrong: number;
  inspectedCount: number;
  /** 因豁免条款而通过的申请数（R07 / 特赦 / 维护豁免） */
  exemptApproved: number;
}

export interface Ending {
  title: string;
  body: string;
}

export function endingOf(mode: Mode, summary: EndingSummary): Ending {
  const { total, correct, inspectedCount, exemptApproved } = summary;
  if (mode === 'STRICT') {
    return {
      title: 'ENDING · 严格模式 / THE WALL',
      body:
        `你把 ${total} 位访客逐一按最高优先级的条文处理，${correct} 次判定与规则完全一致，` +
        `其中 ${inspectedCount} 次选择开档查证，一次也没有越过名单。系统把你的记录归档为「规则宿主」——` +
        '指挥部很满意，因为墙需要一块不会思考的砖。下班时你想起那份"自相矛盾的紧急命令"，' +
        '最终还是把它压回了抽屉。',
    };
  }
  if (mode === 'HUMAN') {
    return {
      title: 'ENDING · 人文模式 / THE DOOR',
      body:
        `你在冲突处没有只问条文，而是问了「这个人现在需要什么」。这一班你开档 ${inspectedCount} 次，` +
        `让 ${exemptApproved} 份带豁免或事故说明的申请通过了窗口。系统把你的记录归档为「边境缝隙」——` +
        `不完美，但有些东西因此过了关。`,
    };
  }
  return { title: 'ENDING · UNRESOLVED', body: '记录未归档。' };
}
