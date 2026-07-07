import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../src/theme';
import { SessionChat } from '../../src/components/sessions/SessionChat';

/**
 * Chat route (#219): `/(sessions)/chat?paneId=…`. The pane id travels as a
 * query param because desktop session-identity ids contain `:` (fleet
 * `<project>:<stream>`, manual `man:<tabId>:p0`), which a path segment would
 * mangle. Always pushed via openSessionChat (src/lib/sessions/nav.ts).
 */
export default function SessionChatRoute() {
  const t = useTheme();
  const { paneId } = useLocalSearchParams<{ paneId?: string }>();

  if (!paneId) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: t.fgDim, fontSize: 14 }}>No session selected.</Text>
      </View>
    );
  }
  return <SessionChat paneId={paneId} />;
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
