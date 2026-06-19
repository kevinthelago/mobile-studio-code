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

export function GithubIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 20 20" fill="none">
      <Path d="M10 2a8 8 0 00-2.53 15.59c.4.07.55-.17.55-.38v-1.48c-2.23.48-2.7-1.07-2.7-1.07-.36-.93-.89-1.18-.89-1.18-.73-.5.05-.49.05-.49.8.06 1.23.83 1.23.83.71 1.22 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 014 0c1.53-1.03 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.19c0 .21.14.46.55.38A8 8 0 0010 2z"
        fill={color} />
    </Svg>
  );
}
