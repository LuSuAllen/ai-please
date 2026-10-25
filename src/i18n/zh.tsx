/**
 * 双语注释层的对外入口，组件统一从这里取术语与副注节点。
 * 术语数据在 ./terms.ts（纯数据、无 JSX，可被 node --test 直接导入）；
 * 副注节点在 ./ZhInline.tsx（带 JSX，故与数据分离，测试不能导入它）。
 */
export {
  METRIC_ZH,
  MOVE_ZH,
  RULE_ZH,
  STAMP_ZH,
  TIER_ZH,
  UI_ZH,
  VERDICT_ZH,
  WRONG_KIND_ZH,
} from './terms';
export { Zh } from './ZhInline';
