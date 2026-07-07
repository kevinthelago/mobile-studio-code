// GraphCanvas (#220) — the read-only react-native-svg renderer for a GraphScene (the pure adapters
// build the scene; this component only draws it). Pinch-zoom + pan + tap-select + double-tap-to-fit.
// NO editing surface by design: no drag-move, no connect, no context menus, no auto-organize.
//
// Gesture stack: core RN PanResponder. react-native-gesture-handler is NOT in this repo's
// package.json (checked — reanimated is, but pinch/pan need gesture-handler to pair with it), and
// per the repo's Expo-managed, minimal-deps ethos we fall back to PanResponder rather than add a
// native dependency for a read-only viewer. The responder only claims the gesture on MOVEMENT (or a
// second finger), so plain taps fall through to the SVG elements' onPress.
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { PanResponder, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import type { GraphScene, SceneNode } from '../../lib/graph/scene';

export interface GraphSelection {
  kind: 'node' | 'edge';
  id: string;
}

export interface GraphCanvasHandle {
  /** Zoom + center so the whole world fits the viewport (also on double-tap of the backdrop). */
  fitToView(): void;
}

export interface GraphCanvasColors {
  card: string;
  cardStack: string;
  border: string;
  text: string;
  muted: string;
  selection: string;
}

const DEFAULT_COLORS: GraphCanvasColors = {
  card: '#161b26',
  cardStack: '#10141d',
  border: '#2a3245',
  text: '#e8ecf4',
  muted: '#8b94a7',
  selection: '#7aa2ff',
};

interface Props {
  scene: GraphScene;
  selected?: GraphSelection | null;
  /** Tap-select report; null = backdrop tap (clear selection). Display-only — no mutations. */
  onSelect?: (sel: GraphSelection | null) => void;
  colors?: Partial<GraphCanvasColors>;
  style?: StyleProp<ViewStyle>;
}

const MIN_SCALE = 0.15;
const MAX_SCALE = 4;
const DOUBLE_TAP_MS = 300;
/** Stacked-card shadow offset (desktop POOL_STACK_OFFSET is 11 for the outer card). */
const STACK_OFFSET = 5.5;

interface ViewTransform {
  scale: number;
  tx: number;
  ty: number;
}

const clampScale = (s: number): number => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

export const GraphCanvas = forwardRef<GraphCanvasHandle, Props>(function GraphCanvas(
  { scene, selected, onSelect, colors: colorOverrides, style },
  ref,
) {
  const colors = { ...DEFAULT_COLORS, ...colorOverrides };
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [view, setView] = useState<ViewTransform>({ scale: 1, tx: 0, ty: 0 });

  // Refs mirror state for the gesture math (PanResponder callbacks are created once).
  const viewRef = useRef(view);
  viewRef.current = view;
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const sceneRef = useRef(scene);
  sceneRef.current = scene;

  const containerRef = useRef<View>(null);
  /** The container's window origin, measured on gesture grant — pinch midpoints arrive in page
   *  coordinates and must be made view-relative to anchor the zoom under the fingers. */
  const originRef = useRef({ x: 0, y: 0 });

  const fitToView = useCallback((): void => {
    const sz = sizeRef.current;
    const sc = sceneRef.current;
    if (!sz || sc.worldW <= 0 || sc.worldH <= 0) return;
    const s = clampScale(Math.min(sz.w / sc.worldW, sz.h / sc.worldH) * 0.92);
    setView({ scale: s, tx: (sz.w - sc.worldW * s) / 2, ty: (sz.h - sc.worldH * s) / 2 });
  }, []);

  useImperativeHandle(ref, () => ({ fitToView }), [fitToView]);

  // Auto-fit whenever the scene (a drill / adapter switch) or the viewport size changes.
  useEffect(() => {
    fitToView();
  }, [scene, size, fitToView]);

  const gestureRef = useRef<{
    mode: 'none' | 'pan' | 'pinch';
    base: ViewTransform;
    dx0: number;
    dy0: number;
    d0: number;
    m0x: number;
    m0y: number;
  }>({ mode: 'none', base: view, dx0: 0, dy0: 0, d0: 1, m0x: 0, m0y: 0 });

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        // Claim only on real movement or a second finger — taps stay with the SVG elements.
        onMoveShouldSetPanResponder: (_evt, g) =>
          g.numberActiveTouches === 2 || Math.abs(g.dx) + Math.abs(g.dy) > 8,
        onPanResponderGrant: () => {
          gestureRef.current.mode = 'none';
          containerRef.current?.measureInWindow((x, y) => {
            originRef.current = { x, y };
          });
        },
        onPanResponderMove: (evt, g) => {
          const gest = gestureRef.current;
          const touches = evt.nativeEvent.touches;
          if (touches.length >= 2) {
            const [t1, t2] = touches;
            const d = Math.max(1, Math.hypot(t2.pageX - t1.pageX, t2.pageY - t1.pageY));
            const mx = (t1.pageX + t2.pageX) / 2 - originRef.current.x;
            const my = (t1.pageY + t2.pageY) / 2 - originRef.current.y;
            if (gest.mode !== 'pinch') {
              gest.mode = 'pinch';
              gest.base = { ...viewRef.current };
              gest.d0 = d;
              gest.m0x = mx;
              gest.m0y = my;
            }
            // Anchor the world point under the initial midpoint; midpoint drift pans.
            const scale = clampScale(gest.base.scale * (d / gest.d0));
            const k = scale / gest.base.scale;
            setView({
              scale,
              tx: mx - (gest.m0x - gest.base.tx) * k,
              ty: my - (gest.m0y - gest.base.ty) * k,
            });
          } else {
            if (gest.mode !== 'pan') {
              // Fresh pan (or a pinch that lost a finger) — rebase so nothing jumps.
              gest.mode = 'pan';
              gest.base = { ...viewRef.current };
              gest.dx0 = g.dx;
              gest.dy0 = g.dy;
            }
            setView({
              scale: gest.base.scale,
              tx: gest.base.tx + g.dx - gest.dx0,
              ty: gest.base.ty + g.dy - gest.dy0,
            });
          }
        },
        onPanResponderRelease: () => {
          gestureRef.current.mode = 'none';
        },
        onPanResponderTerminate: () => {
          gestureRef.current.mode = 'none';
        },
      }),
    [],
  );

  // Backdrop taps: single = clear selection, double = fit.
  const lastTapRef = useRef(0);
  const onBackdropPress = useCallback((): void => {
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_MS) {
      lastTapRef.current = 0;
      fitToView();
    } else {
      lastTapRef.current = now;
      onSelect?.(null);
    }
  }, [fitToView, onSelect]);

  const renderNode = (n: SceneNode): React.JSX.Element => {
    const isSelected = selected?.kind === 'node' && selected.id === n.id;
    const stroke = isSelected ? colors.selection : colors.border;
    const stacked = (n.stackCount ?? 0) >= 2;
    return (
      <G key={n.id} onPress={() => onSelect?.({ kind: 'node', id: n.id })}>
        {stacked && (
          <>
            <Rect
              x={n.x + STACK_OFFSET * 2}
              y={n.y + STACK_OFFSET * 2}
              width={n.w}
              height={n.h}
              rx={14}
              fill={colors.cardStack}
              stroke={colors.border}
              strokeWidth={1}
            />
            <Rect
              x={n.x + STACK_OFFSET}
              y={n.y + STACK_OFFSET}
              width={n.w}
              height={n.h}
              rx={14}
              fill={colors.cardStack}
              stroke={colors.border}
              strokeWidth={1}
            />
          </>
        )}
        <Rect
          x={n.x}
          y={n.y}
          width={n.w}
          height={n.h}
          rx={14}
          fill={colors.card}
          stroke={stroke}
          strokeWidth={isSelected ? 2 : 1}
        />
        {/* Left accent bar (role/archetype colour). */}
        <Rect x={n.x + 1} y={n.y + 10} width={3} height={n.h - 20} rx={1.5} fill={n.accentColor} />
        <SvgText x={n.x + 16} y={n.y + 27} fontSize={13} fontWeight="600" fill={colors.text}>
          {n.title}
        </SvgText>
        {n.subtitle ? (
          <SvgText x={n.x + 16} y={n.y + 45} fontSize={10.5} fill={colors.muted}>
            {n.subtitle}
          </SvgText>
        ) : null}
        {n.statusColor ? (
          <>
            {n.pulse ? (
              <Circle cx={n.x + n.w - 16} cy={n.y + 16} r={7} stroke={n.statusColor} strokeWidth={1.5} fill="none" opacity={0.45} />
            ) : null}
            <Circle cx={n.x + n.w - 16} cy={n.y + 16} r={4} fill={n.statusColor} />
          </>
        ) : null}
        {stacked ? (
          <>
            <Circle cx={n.x + n.w - 2} cy={n.y + 2} r={11} fill={n.accentColor} />
            <SvgText
              x={n.x + n.w - 2}
              y={n.y + 6}
              fontSize={11}
              fontWeight="700"
              fill="#0b0e14"
              textAnchor="middle"
            >
              {String(n.stackCount)}
            </SvgText>
          </>
        ) : null}
      </G>
    );
  };

  return (
    <View
      ref={containerRef}
      style={[{ flex: 1, overflow: 'hidden' }, style]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize({ w: width, h: height });
      }}
      {...responder.panHandlers}
    >
      {size ? (
        <Svg width={size.w} height={size.h}>
          {/* Backdrop — catches clear-selection taps + double-tap-to-fit. */}
          <Rect x={0} y={0} width={size.w} height={size.h} fill="rgba(0,0,0,0.01)" onPress={onBackdropPress} />
          <G transform={`translate(${view.tx}, ${view.ty}) scale(${view.scale})`}>
            {scene.edges.map((e) => {
              const isSelected = selected?.kind === 'edge' && selected.id === e.id;
              return (
                <G key={e.id} onPress={() => onSelect?.({ kind: 'edge', id: e.id })}>
                  {/* Fat invisible hit path so a 1.8px curve is tappable. */}
                  <Path d={e.d} stroke="rgba(0,0,0,0.01)" strokeWidth={18} fill="none" />
                  <Path
                    d={e.d}
                    stroke={isSelected ? colors.selection : e.color}
                    strokeWidth={isSelected ? e.width + 1 : e.width}
                    strokeDasharray={e.dash || undefined}
                    fill="none"
                    opacity={isSelected ? 1 : 0.85}
                  />
                  <Path d={e.arrow} fill={isSelected ? colors.selection : e.color} />
                  {e.arrowStart ? <Path d={e.arrowStart} fill={isSelected ? colors.selection : e.color} /> : null}
                  {isSelected && e.label && e.labelX !== undefined && e.labelY !== undefined ? (
                    <SvgText
                      x={e.labelX}
                      y={e.labelY - 6}
                      fontSize={10}
                      fill={colors.text}
                      textAnchor="middle"
                    >
                      {e.label}
                    </SvgText>
                  ) : null}
                </G>
              );
            })}
            {scene.nodes.map(renderNode)}
          </G>
        </Svg>
      ) : null}
    </View>
  );
});
