import { memo } from 'react';
import { MONO_FONT, measureText } from './measure';
import type { CanvasNode, LaidOut } from './types';

interface Props {
  laid: LaidOut;
  selected?: boolean;
  onSelect?: (id: string) => void;
  onToggle?: (id: string) => void;
}

// A vertex of either tree: a rounded rect, or a circle when the label is a
// single character. Leaves carry a double border; zero-probability vertices
// are greyed, never hidden. The canvas is read-only: clicking selects, the
// chevron expands or collapses, and every edit happens in the inspectors.
export const Vertex = memo(function Vertex({ laid, selected, onSelect, onToggle }: Props) {
  const n: CanvasNode = laid.node;
  const { x, y, w, h } = laid;

  const circle = n.label.length === 1 && !n.badge && !n.sub;
  const r = Math.max(w, h) / 2;

  const tint = n.tints?.[0];
  const stroke = selected || n.accented
    ? 'var(--color-selection)'
    : tint
      ? tint
      : n.zero
        ? 'var(--color-dropped)'
        : 'var(--color-hairline)';
  const strokeWidth = selected ? 2 : n.accented || tint ? 1.5 : 1;
  const fill = n.zero
    ? 'var(--color-sunk)'
    : n.accented
      ? '#2B5CE60A'
      : 'var(--color-paper)';
  const ink = n.zero ? 'var(--color-dropped)' : 'var(--color-ink)';

  const labelY = n.badge ? y - h / 2 + 15 : n.pill ? y - h / 2 + 14 : y;
  const pillY = labelY + 14;
  const badgeY = y + h / 2 - 8;
  const chevronX = n.badge || !circle ? x + w / 2 : x + r;

  return (
    <g
      opacity={n.dimmed ? 0.22 : 1}
      style={{ transition: 'opacity 200ms cubic-bezier(0.33,1,0.68,1)', cursor: 'pointer' }}
      role="treeitem"
      aria-selected={!!selected}
      aria-label={n.aria ?? n.label}
      // The whole vertex selects; clicking the badge must not fall through to
      // the canvas and clear the selection.
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(n.id);
      }}
    >
      {n.title ? <title>{n.title}</title> : null}

      {/* a double border marks a leaf */}
      {n.isLeaf && n.badge ? (
        circle ? (
          <circle cx={x} cy={y} r={r + 3} fill="none" stroke={stroke} strokeWidth={0.75} />
        ) : (
          <rect
            x={x - w / 2 - 3}
            y={y - h / 2 - 3}
            width={w + 6}
            height={h + 6}
            rx={7}
            fill="none"
            stroke={stroke}
            strokeWidth={0.75}
          />
        )
      ) : null}

      {circle ? (
        <circle cx={x} cy={y} r={r} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
      ) : (
        <rect
          x={x - w / 2}
          y={y - h / 2}
          width={w}
          height={h}
          rx={5}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      )}

      <text
        x={x}
        y={labelY}
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily={n.badge ? 'var(--font-mono)' : 'var(--font-sans)'}
        fontSize={13}
        fontWeight={600}
        fill={ink}
      >
        {n.label}
        {n.sub ? (
          <tspan fontSize={10} fill="var(--color-dropped)" dy={3}>{` (${n.sub})`}</tspan>
        ) : null}
      </text>

      {/* probability pill; edit PD(v) in the node inspector */}
      {n.pill ? (
        <g>
          <title>PD(v): the conditional existence probability, given that the parent exists</title>
          <rect
            x={x - measureText(n.pill, MONO_FONT) / 2 - 6}
            y={pillY - 7}
            width={measureText(n.pill, MONO_FONT) + 12}
            height={14}
            rx={7}
            fill="var(--color-sunk)"
            stroke="var(--color-hairline)"
            strokeWidth={0.75}
          />
          <text
            x={x}
            y={pillY + 0.5}
            textAnchor="middle"
            dominantBaseline="middle"
            fontFamily="var(--font-mono)"
            fontSize={11}
            fill="var(--color-muted)"
          >
            {n.pill}
          </text>
        </g>
      ) : null}

      {/* reach badge: numeral plus a bar proportional to the value */}
      {n.badge ? (
        <g>
          <title>{n.badge.caption ?? n.badge.text}</title>
          <rect
            x={x - w / 2 + 6}
            y={badgeY - 1.5}
            width={w - 12}
            height={3}
            rx={1.5}
            fill="var(--color-hairline)"
          />
          <rect
            x={x - w / 2 + 6}
            y={badgeY - 1.5}
            width={Math.max(0, (w - 12) * Math.min(1, Math.max(0, n.badge.value)))}
            height={3}
            rx={1.5}
            fill={n.zero ? 'var(--color-dropped)' : 'var(--color-ink)'}
            opacity={n.zero ? 0.35 : 0.55}
          />
          <text
            x={x}
            y={badgeY - 8}
            textAnchor="middle"
            dominantBaseline="middle"
            fontFamily="var(--font-mono)"
            fontSize={10}
            fill="var(--color-muted)"
            className="numeral-changed"
            key={n.badge.text}
          >
            {n.badge.text}
          </text>
        </g>
      ) : null}

      {/* the node's distributional type, at the fan-out point */}
      {n.fanChip ? (
        <g>
          <title>the distributional block governing this node's children</title>
          <rect
            x={x - 13}
            y={y + h / 2 + 4}
            width={26}
            height={13}
            rx={3}
            fill="var(--color-paper)"
            stroke={n.fanChipInvalid ? 'var(--color-error)' : 'var(--color-hairline)'}
            strokeWidth={0.75}
          />
          <text
            x={x}
            y={y + h / 2 + 11}
            textAnchor="middle"
            dominantBaseline="middle"
            fontFamily="var(--font-mono)"
            fontSize={9.5}
            fill={n.fanChipInvalid ? 'var(--color-error)' : 'var(--color-dropped)'}
          >
            {n.fanChip}
          </text>
        </g>
      ) : null}

      {/* expand / collapse chevron; a collapsed vertex shows ⊕ with its child count */}
      {n.expanded !== undefined && onToggle && !n.tooWide ? (
        <g
          style={{ cursor: 'pointer' }}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(n.id);
          }}
        >
          <title>{n.expanded ? 'collapse' : `expand ${n.hiddenChildren ?? ''} children`}</title>
          <circle
            cx={chevronX + 9}
            cy={y}
            r={7}
            fill="var(--color-paper)"
            stroke="var(--color-hairline)"
            strokeWidth={0.75}
          />
          <text
            x={chevronX + 9}
            y={y + 0.5}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={9}
            fill="var(--color-muted)"
          >
            {n.expanded ? '−' : '+'}
          </text>
          {!n.expanded && n.hiddenChildren ? (
            <text
              x={chevronX + 20}
              y={y + 0.5}
              dominantBaseline="middle"
              fontFamily="var(--font-mono)"
              fontSize={10}
              fill="var(--color-dropped)"
            >
              ⊕ {n.hiddenChildren}
            </text>
          ) : null}
        </g>
      ) : null}

      {/* a swatch and the expression's name for every expression whose
          support contains this vertex, so identity never rests on colour */}
      {n.tints && n.tints.length > 0 ? (
        <g pointerEvents="none">
          {n.tints.map((c, i) => (
            <circle key={c + i} cx={x - w / 2 + 5 + i * 9} cy={y - h / 2 - 5} r={3} fill={c} />
          ))}
          {n.tags && n.tags.length > 0 ? (
            <text
              x={x - w / 2 + 5 + n.tints.length * 9}
              y={y - h / 2 - 4.5}
              dominantBaseline="middle"
              fontFamily="var(--font-mono)"
              fontSize={9.5}
              fill="var(--color-muted)"
            >
              {n.tags.join(' ')}
            </text>
          ) : null}
        </g>
      ) : null}

      {/* excluded for having an empty configuration */}
      {n.emptyMarker ? (
        <text
          x={x + w / 2 + 5}
          y={y}
          dominantBaseline="middle"
          fontFamily="var(--font-mono)"
          fontSize={11}
          fill="var(--color-dropped)"
          pointerEvents="none"
        >
          ∅
        </text>
      ) : null}

      {n.tooWide ? (
        <text
          x={x + w / 2 + 14}
          y={y}
          dominantBaseline="middle"
          fontFamily="var(--font-mono)"
          fontSize={10}
          fill="var(--color-error)"
        >
          {n.hiddenChildren} configurations, too many to draw
        </text>
      ) : null}
    </g>
  );
});
