// SVG chart primitives for the GitHub Pulse dashboard.
// All components are theme-aware via useTheme() and sized for phone screens.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, {
  Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText,
} from 'react-native-svg';
import { useTheme, type Theme } from '../../theme';

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildLinePath(
  data: number[],
  maxVal: number,
  w: number,
  h: number,
  padX: number,
  padY: number,
): string {
  const n = data.length;
  if (n < 2) return '';
  return data
    .map((v, i) => {
      const x = padX + (i / (n - 1)) * (w - 2 * padX);
      const y = h - padY - ((v / maxVal) * (h - 2 * padY));
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function buildAreaPath(
  data: number[],
  maxVal: number,
  w: number,
  h: number,
  padX: number,
  padY: number,
): string {
  const n = data.length;
  if (n < 2) return '';
  const line = buildLinePath(data, maxVal, w, h, padX, padY);
  const x0 = padX.toFixed(1);
  const xN = (padX + (w - 2 * padX)).toFixed(1);
  const yB = (h - padY).toFixed(1);
  return `${line} L${xN},${yB} L${x0},${yB} Z`;
}

function arcPath(
  cx: number, cy: number, r: number,
  startDeg: number, endDeg: number,
): string {
  const rad = (d: number) => (d * Math.PI) / 180;
  const s = { x: cx + r * Math.cos(rad(startDeg)), y: cy + r * Math.sin(rad(startDeg)) };
  const e = { x: cx + r * Math.cos(rad(endDeg)), y: cy + r * Math.sin(rad(endDeg)) };
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M${s.x.toFixed(2)},${s.y.toFixed(2)} A${r},${r} 0 ${large} 1 ${e.x.toFixed(2)},${e.y.toFixed(2)}`;
}

// ── StatGrid ──────────────────────────────────────────────────────────────────

export interface Stat {
  key: string;
  value: string;
  sub?: string;
  tone?: 'accent' | 'success' | 'warn' | 'danger';
}

function statColor(t: Theme, tone?: Stat['tone']): string {
  if (tone === 'accent') return t.accent;
  if (tone === 'success') return t.code.ty;
  if (tone === 'warn') return t.code.nm;
  if (tone === 'danger') return '#ff6b6b';
  return t.fg;
}

export function StatGrid({ stats }: { stats: Stat[] }) {
  const t = useTheme();
  return (
    <View style={styles.statGrid}>
      {stats.map((s) => (
        <View key={s.key} style={styles.statCell}>
          <Text style={[styles.statVal, { color: statColor(t, s.tone), fontFamily: t.fontMono }]}>
            {s.value}
          </Text>
          <Text style={[styles.statKey, { color: t.fgDim, fontFamily: t.fontMono }]}>
            {s.key}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ── LineAreaChart ─────────────────────────────────────────────────────────────

export interface LineSeries {
  data: number[];
  color: string;
  area?: boolean;
  dash?: boolean;
  gradientId?: string;
}

interface LineAreaChartProps {
  labels: string[];
  series: LineSeries[];
  height?: number;
  width: number;
}

export function LineAreaChart({ labels, series, height = 110, width }: LineAreaChartProps) {
  const t = useTheme();
  const padX = 4;
  const padY = 8;
  const labelH = 16;
  const chartH = height - labelH;

  const allValues = series.flatMap((s) => s.data);
  const maxVal = Math.max(...allValues, 1);

  const n = labels.length;
  const xFor = (i: number) =>
    padX + (i / (n - 1)) * (width - 2 * padX);

  return (
    <Svg width={width} height={height}>
      <Defs>
        {series
          .filter((s) => s.area && s.gradientId)
          .map((s) => (
            <LinearGradient key={s.gradientId} id={s.gradientId!} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={s.color} stopOpacity="0.30" />
              <Stop offset="1" stopColor={s.color} stopOpacity="0.00" />
            </LinearGradient>
          ))}
      </Defs>

      {/* Subtle grid lines */}
      {[0, 0.5, 1].map((frac) => {
        const y = padY + (1 - frac) * (chartH - 2 * padY);
        return (
          <Line key={frac} x1={padX} y1={y} x2={width - padX} y2={y}
            stroke={t.borderColor} strokeWidth={0.5} />
        );
      })}

      {/* Area fills */}
      {series
        .filter((s) => s.area)
        .map((s, si) => {
          const aPath = buildAreaPath(s.data, maxVal, width, chartH, padX, padY);
          return (
            <Path key={`area-${si}`} d={aPath}
              fill={s.gradientId ? `url(#${s.gradientId})` : s.color}
              fillOpacity={s.gradientId ? 1 : 0.15} />
          );
        })}

      {/* Lines */}
      {series.map((s, si) => {
        const lPath = buildLinePath(s.data, maxVal, width, chartH, padX, padY);
        return (
          <Path key={`line-${si}`} d={lPath}
            fill="none"
            stroke={s.color}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={s.dash ? '4,3' : undefined} />
        );
      })}

      {/* X-axis labels (show first, middle, last) */}
      {[0, Math.floor((n - 1) / 2), n - 1].map((i) => (
        <SvgText key={i} x={xFor(i)} y={height - 2} textAnchor="middle"
          fontSize={9} fill={t.fgDim} fontFamily={t.fontMono}>
          {labels[i]}
        </SvgText>
      ))}
    </Svg>
  );
}

// ── HBars ─────────────────────────────────────────────────────────────────────

export interface HBarItem {
  label: string;
  value: number;
  color: string;
  sub?: string;
}

interface HBarsProps {
  items: HBarItem[];
  width: number;
  maxValue?: number;
}

export function HBars({ items, width, maxValue }: HBarsProps) {
  const t = useTheme();
  const barTrackW = width * 0.45;
  const max = maxValue ?? Math.max(...items.map((i) => i.value), 1);

  return (
    <View style={styles.hBarsContainer}>
      {items.map((item, idx) => {
        const barW = (item.value / max) * barTrackW;
        return (
          <View key={idx} style={styles.hBarRow}>
            <Text
              style={[styles.hBarLabel, { color: t.fgMuted, fontFamily: t.fontMono }]}
              numberOfLines={1}
            >
              {item.label}
            </Text>
            <View style={[styles.hBarTrack, { width: barTrackW, backgroundColor: t.borderColor }]}>
              <View
                style={[
                  styles.hBarFill,
                  { width: Math.max(barW, 2), backgroundColor: item.color },
                ]}
              />
            </View>
            <Text style={[styles.hBarVal, { color: t.fgDim, fontFamily: t.fontMono }]}>
              {item.sub ?? String(item.value)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Ring ──────────────────────────────────────────────────────────────────────

interface RingProps {
  percent: number;
  color: string;
  size?: number;
  label?: string;
}

export function Ring({ percent, color, size = 72, label }: RingProps) {
  const t = useTheme();
  const cx = size / 2;
  const cy = size / 2;
  const sw = 8;
  const r = (size - sw * 2) / 2;
  const clampedPct = Math.min(Math.max(percent, 0), 100);
  const startDeg = -90;
  const endDeg = startDeg + (clampedPct / 100) * 360;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {/* Track */}
        <Path
          d={arcPath(cx, cy, r, -90, 269.9)}
          fill="none"
          stroke={t.borderColor}
          strokeWidth={sw}
          strokeLinecap="round"
        />
        {/* Fill */}
        {clampedPct > 0 && (
          <Path
            d={arcPath(cx, cy, r, startDeg, endDeg)}
            fill="none"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        )}
      </Svg>
      <Text style={[styles.ringPct, { color: t.fg, fontFamily: t.fontMono }]}>
        {`${clampedPct}%`}
      </Text>
      {label && (
        <Text style={[styles.ringLabel, { color: t.fgDim, fontFamily: t.fontMono }]}>
          {label}
        </Text>
      )}
    </View>
  );
}

// ── SectionHead ───────────────────────────────────────────────────────────────

export function SectionHead({ title, sub }: { title: string; sub?: string }) {
  const t = useTheme();
  return (
    <View style={styles.sectionHead}>
      <Text style={[styles.sectionTitle, { color: t.fg }]}>{title}</Text>
      {sub && <Text style={[styles.sectionSub, { color: t.fgDim, fontFamily: t.fontMono }]}>{sub}</Text>}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 1,
  },
  statCell: {
    width: '33.33%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'flex-start',
  },
  statVal: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 22,
  },
  statKey: {
    fontSize: 10,
    marginTop: 2,
    letterSpacing: 0.2,
  },

  hBarsContainer: { gap: 7 },
  hBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hBarLabel: { width: 72, fontSize: 11, textAlign: 'right' },
  hBarTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  hBarFill: { height: '100%', borderRadius: 3 },
  hBarVal: { fontSize: 10, width: 48 },

  ringPct: { fontSize: 15, fontWeight: '700' },
  ringLabel: { fontSize: 9, marginTop: 1, letterSpacing: 0.2 },

  sectionHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 10 },
  sectionTitle: { fontSize: 13, fontWeight: '600', letterSpacing: 0.1 },
  sectionSub: { fontSize: 10 },
});
