import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useMirrorDomain } from '../../src/lib/mirror/MirrorContext';
import { ModalHeader } from '../../src/components/shell/ModalHeader';
import { SecuritySections } from '../../src/components/security/SecuritySections';

/**
 * Security page (#223, rewired #237) — the read-only least-privilege mirror:
 * agent profiles (the permission model), per-pane role/profile assignments, and
 * recent audit activity, exactly as the desktop records them. Reads the
 * `security` mirror domain, which the desktop has published since
 * base-studio-code#2530. Display-only by product rule — nothing here is
 * editable from the phone.
 */
export default function SecurityScreen() {
  const { data, synced } = useMirrorDomain('security');
  return (
    <View style={styles.root}>
      <ModalHeader title="Security" subtitle="Profiles, assignments & audit · read-only" />
      <SecuritySections data={data} synced={synced} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
