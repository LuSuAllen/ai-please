import { useMemo } from 'react';

const PALETTES = [
  { skin: '#f2c9a0', hair: '#2b2036', eye: '#101018', shirt: '#2a6f97' },
  { skin: '#e0a878', hair: '#3b2a1e', eye: '#0d0d12', shirt: '#4a3f8f' },
  { skin: '#c98f61', hair: '#141420', eye: '#0a0a10', shirt: '#1f7a4d' },
  { skin: '#f7d9bd', hair: '#5a3d2b', eye: '#12121a', shirt: '#8a2b3c' },
  { skin: '#a9744f', hair: '#0d0d14', eye: '#08080c', shirt: '#8a6a1f' },
  { skin: '#ffd9b0', hair: '#6b3fa0', eye: '#101018', shirt: '#2b4a6f' },
  { skin: '#d8a882', hair: '#8c8c96', eye: '#0c0c12', shirt: '#3a3a52' },
];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rect = { x: number; y: number; w: number; h: number; c: string };

/** 确定性像素人像：同一 seed 永远生成同一张脸 */
export function PixelAvatar({ seed, size = 60 }: { seed: number; size?: number }) {
  const rects = useMemo<Rect[]>(() => {
    const rnd = mulberry32(seed * 7919 + 13);
    const pal = PALETTES[Math.floor(rnd() * PALETTES.length)];
    const out: Rect[] = [];
    const px = (x: number, y: number, c: string, w = 1, h = 1) => out.push({ x, y, w, h, c });

    // 背景扫描线
    for (let y = 0; y < 14; y += 2) {
      px(0, y, '#0c1526', 12, 1);
    }

    // 肩部
    px(1, 12, pal.shirt, 10, 2);
    px(2, 11, pal.shirt, 8, 1);

    // 头部
    px(3, 4, pal.skin, 6, 7);
    px(2, 5, pal.skin, 1, 5);
    px(9, 5, pal.skin, 1, 5);

    // 头发：3 种发型
    const style = Math.floor(rnd() * 3);
    px(2, 2, pal.hair, 8, 2);
    px(3, 1, pal.hair, 6, 1);
    if (style === 0) {
      px(2, 4, pal.hair, 1, 2);
      px(9, 4, pal.hair, 1, 2);
      px(4, 4, pal.hair, 4, 1);
    } else if (style === 1) {
      px(2, 4, pal.hair, 8, 1);
      px(2, 5, pal.hair, 1, 3);
      px(9, 5, pal.hair, 1, 3);
    } else {
      px(3, 3, pal.hair, 6, 1);
      px(1, 5, pal.hair, 1, 1);
      px(10, 5, pal.hair, 1, 1);
    }

    // 天线（部分访客）
    if (rnd() > 0.62) {
      px(5, 0, '#4fd1ff', 1, 1);
      px(5, 0, '#4fd1ff', 1, 1);
      px(6, 0, '#1d3f55', 1, 1);
    }

    // 眼睛
    const eyeY = 7;
    px(4, eyeY, pal.eye, 1, 1);
    px(7, eyeY, pal.eye, 1, 1);

    // 嘴
    px(5, 9, '#8a4a4a', 2, 1);

    // 随机颗粒噪点
    for (let i = 0; i < 6; i += 1) {
      const x = Math.floor(rnd() * 12);
      const y = Math.floor(rnd() * 14);
      px(x, y, 'rgba(79,209,255,0.14)');
    }

    return out;
  }, [seed]);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 14"
      shapeRendering="crispEdges"
      aria-hidden="true"
      style={{ display: 'block', imageRendering: 'pixelated' }}
    >
      <rect x="0" y="0" width="12" height="14" fill="#060b14" />
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.c} />
      ))}
    </svg>
  );
}
