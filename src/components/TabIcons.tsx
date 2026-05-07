import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

export function FilesIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 20 20" fill="none">
      <Path d="M3 5a2 2 0 012-2h3l2 2h5a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V5z"
        stroke={color} strokeWidth={1.6} />
    </Svg>
  );
}

export function FindIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 20 20" fill="none">
      <Circle cx={9} cy={9} r={5} stroke={color} strokeWidth={1.6} />
      <Path d="M13 13l3.5 3.5" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

export function EditIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 20 20" fill="none">
      <Path d="M4 14l1-4 8-8 3 3-8 8-4 1z"
        stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

export function RunIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 20 20" fill="none">
      <Path d="M4 6l3 3-3 3M9 13h6"
        stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function GitIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 20 20" fill="none">
      <Circle cx={6} cy={5} r={2} stroke={color} strokeWidth={1.6} />
      <Circle cx={6} cy={15} r={2} stroke={color} strokeWidth={1.6} />
      <Circle cx={14} cy={10} r={2} stroke={color} strokeWidth={1.6} />
      <Path d="M6 7v6M8 5h4a2 2 0 012 2v1" stroke={color} strokeWidth={1.6} />
    </Svg>
  );
}
