/**
 * One laid page as SVG (units = mm). Text uses metric-compatible system fonts and
 * `textLength` pins every run to the width the layout engine measured, so the
 * preview matches the exported PDF line for line.
 */
import { memo } from 'react';
import type { FontFamily, LaidPage, Prim } from './flow';
import { ICON_STROKE, iconPathData, vectorIcon } from './icons';

export const FONT_STACKS: Record<FontFamily, string> = {
  helvetica: 'Helvetica, Arial, "Liberation Sans", "Nimbus Sans", sans-serif',
  times: '"Times New Roman", Times, "Liberation Serif", "Nimbus Roman", serif',
  courier: '"Courier New", Courier, "Liberation Mono", "Nimbus Mono PS", monospace',
};

const PT_MM = 25.4 / 72;

function PrimEl({ p, imageUrl, links = true }: { p: Prim; imageUrl: (src: string) => string | undefined; links?: boolean }) {
  switch (p.k) {
    case 'text': {
      if (p.invisible) return null;
      const el = (
        <text
          x={p.x}
          y={p.y}
          fontFamily={FONT_STACKS[p.font]}
          fontSize={p.size * PT_MM}
          fontWeight={p.bold ? 700 : 400}
          fontStyle={p.italic ? 'italic' : 'normal'}
          fill={p.color}
          textLength={p.w > 0.5 ? p.w : undefined}
          lengthAdjust="spacingAndGlyphs"
          letterSpacing={p.tracking ? p.tracking : undefined}
          textDecoration={p.underline ? 'underline' : undefined}
          xmlSpace="preserve"
        >
          {p.text}
        </text>
      );
      return p.link && links ? (
        <a href={p.link} target="_blank" rel="noopener noreferrer">
          {el}
        </a>
      ) : (
        el
      );
    }
    case 'rect':
      return <rect x={p.x} y={p.y} width={Math.max(0, p.w)} height={Math.max(0, p.h)} rx={p.r} fill={p.fill ?? 'none'} stroke={p.stroke} strokeWidth={p.stroke ? p.lw ?? 0.25 : undefined} />;
    case 'line':
      return <line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.color} strokeWidth={p.lw} strokeDasharray={p.dash?.join(' ')} strokeLinecap={p.dash ? 'round' : undefined} />;
    case 'circle':
      return <circle cx={p.cx} cy={p.cy} r={p.r} fill={p.fill ?? 'none'} stroke={p.stroke} strokeWidth={p.stroke ? p.lw ?? 0.25 : undefined} />;
    case 'image': {
      const url = imageUrl(p.src);
      if (!url) return <rect x={p.x} y={p.y} width={p.w} height={p.h} fill="#e5e7eb" />;
      return <image href={url} x={p.x} y={p.y} width={p.w} height={p.h} preserveAspectRatio="none" />;
    }
    case 'poly':
      return <polygon points={p.points.map(([x, y]) => `${x},${y}`).join(' ')} fill={p.fill} />;
    case 'icon': {
      const filled = vectorIcon(p.name).filled;
      const inner = p.bg ? p.size * 0.58 : p.size;
      const glyph = (
        <path
          d={iconPathData(p.name)}
          transform={`translate(${p.x + (p.size - inner) / 2} ${p.y + (p.size - inner) / 2}) scale(${inner / 24})`}
          fill={filled ? p.color : 'none'}
          stroke={filled ? undefined : p.color}
          strokeWidth={filled ? undefined : ICON_STROKE}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
      return p.bg ? (
        <g>
          <circle cx={p.x + p.size / 2} cy={p.y + p.size / 2} r={p.size / 2} fill={p.bg} />
          {glyph}
        </g>
      ) : (
        glyph
      );
    }
    default:
      return null;
  }
}

export interface PageSvgProps {
  page: LaidPage;
  width: number;
  height: number;
  background?: string;
  imageUrl: (src: string) => string | undefined;
  className?: string;
  /** Rendered pixel width. */
  pixelWidth: number;
  title?: string;
  /** Render document links as anchors. Off for thumbnails that sit inside their own link. */
  links?: boolean;
}

export const PageSvg = memo(function PageSvg({ page, width, height, background, imageUrl, className, pixelWidth, title, links = true }: PageSvgProps) {
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={pixelWidth}
      height={(pixelWidth * height) / width}
      className={className}
      role="img"
      aria-label={title ?? `Page ${page.index + 1}`}
      style={{ display: 'block', textRendering: 'geometricPrecision' }}
    >
      <rect x={0} y={0} width={width} height={height} fill={background ?? '#ffffff'} />
      {page.prims.map((p, i) => (p.k === 'link' ? null : <PrimEl key={i} p={p} imageUrl={imageUrl} links={links} />))}
    </svg>
  );
});
