import React from 'react';
import { Text, View } from 'react-native';
import { CodePalette } from '../theme';
import { Token } from '../data/sampleCode';

interface CodeLineProps {
  lineNumber: number;
  tokens: Token[];
  palette: CodePalette;
  dimColor: string;
  baseColor: string;
}

export default function CodeLine({ lineNumber, tokens, palette, dimColor, baseColor }: CodeLineProps) {
  return (
    <View style={{ flexDirection: 'row', paddingRight: 4 }}>
      <Text style={{
        width: 36,
        textAlign: 'right',
        paddingRight: 12,
        color: dimColor,
        fontFamily: 'Courier',
        fontSize: 12.5,
        lineHeight: 20,
      }}>
        {lineNumber}
      </Text>
      <Text style={{ fontFamily: 'Courier', fontSize: 12.5, lineHeight: 20, color: baseColor }}>
        {tokens.map((tk, i) => (
          <Text key={i} style={{ color: tk.t === 'sp' ? baseColor : (palette[tk.t as keyof CodePalette] || baseColor) }}>
            {tk.v}
          </Text>
        ))}
      </Text>
    </View>
  );
}
