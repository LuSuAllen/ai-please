/**
 * 行内中文副注：渲染成 ` · 中文`，接在英文主词后面。
 * `lg` 用于有空间的大字号容器（规则名、反馈层）。
 *
 * 术语表在 ./terms.ts（纯数据，可被 node --test 直接导入做回归）。
 */
export function Zh({ children, lg }: { children: string; lg?: boolean }) {
  return <span className={lg ? 'bi-zh lg' : 'bi-zh'}>{children}</span>;
}
