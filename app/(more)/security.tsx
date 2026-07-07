import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useMirrorDomain } from '../../src/lib/mirror/MirrorContext';
import { ModalHeader } from '../../src/components/shell/ModalHeader';
import { SecuritySections } from '../../src/components/security/SecuritySections';

/**
 * Security page (#223) — the read-only audit/activity mirror: audit activity,
 * agent profiles, and profile assignments, exactly as the desktop records
 * them. Reads the `security` mirror domain; the desktop projector does not
 * publish that domain yet, so until it does the page shows its feed-ready
 * structure behind a "not yet published" notice. Display-only by product
 * rule — nothing here is editable from the phone.
 */
export default function SecurityScreen() {
  const { data, synced } = useMirrorDomain('security');
  return (
    <View style={styles.root}>
      <ModalHeader title="Security" subtitle="Audit & activity · read-only" />
      <SecuritySections data={data} synced={synced} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
