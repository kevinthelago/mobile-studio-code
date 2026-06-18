import React, { useState } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useTheme } from '../../theme';
import { Surface } from '../ui/Surface';
import { IconBtn } from '../ui/IconBtn';
import { PrimaryButton } from '../ui/PrimaryButton';
import { PLAN_COLORS } from '../../lib/planner/colors';
import {
  SECTION_DEFS, mkSection, uid,
  type Blueprint, type BlueprintSection,
} from '../../lib/planner/core';

// ── Local helpers ─────────────────────────────────────────────────────────────

function moveSection(sections: BlueprintSection[], sectionUid: string, dir: -1 | 1): BlueprintSection[] {
  const idx = sections.findIndex((s) => s.uid === sectionUid);
  if (idx < 0) return sections;
  const next = [...sections];
  const swap = idx + dir;
  if (swap < 0 || swap >= next.length) return next;
  [next[idx], next[swap]] = [next[swap], next[idx]];
  return next;
}

// ── Section row ──────────────────────────────────────────────────────────────

function SectionRow({
  section, index, total, expanded,
  onToggle, onMoveUp, onMoveDown, onDelete, onExpand, onChangePrompt, onChangeName,
}: {
  section: BlueprintSection;
  index: number;
  total: number;
  expanded: boolean;
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onExpand: () => void;
  onChangePrompt: (v: string) => void;
  onChangeName: (v: string) => void;
}) {
  const t = useTheme();
  return (
    <Surface style={[styles.sRow, !section.enabled && { opacity: 0.55 }]} radius={12}>
      <View style={styles.sRowHead}>
        <Text style={[styles.sGlyph, { color: section.enabled ? PLAN_COLORS.plan : t.fgDim }]}>{section.glyph}</Text>
        <Pressable style={styles.sNameWrap} onPress={onExpand}>
          <Text style={[styles.sName, { color: t.fg }]} numberOfLines={1}>{section.name}</Text>
          <Text style={[styles.sGate, { color: t.fgDim }]} numberOfLines={1}>{section.gate}</Text>
        </Pressable>
        <View style={styles.sActions}>
          <Pressable onPress={onMoveUp} disabled={index === 0} style={[styles.arrowBtn, { opacity: index === 0 ? 0.3 : 1 }]}>
            <Svg width={12} height={12} viewBox="0 0 12 12" fill="none">
              <Path d="M6 9V3M3 6l3-3 3 3" stroke={t.fgMuted} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
          <Pressable onPress={onMoveDown} disabled={index === total - 1} style={[styles.arrowBtn, { opacity: index === total - 1 ? 0.3 : 1 }]}>
            <Svg width={12} height={12} viewBox="0 0 12 12" fill="none">
              <Path d="M6 3v6M9 6l-3 3-3-3" stroke={t.fgMuted} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
          <Pressable
            onPress={onToggle}
            style={[styles.toggleBtn, { backgroundColor: section.enabled ? t.accent : t.borderColor }]}
          >
            <View style={[styles.toggleThumb, { transform: [{ translateX: section.enabled ? 14 : 0 }] }]} />
          </Pressable>
          <IconBtn onPress={onDelete} size={28}>
            <Svg width={13} height={13} viewBox="0 0 13 13" fill="none">
              <Path d="M3 4.5h7M5 4.5V3.5h3v1M4.5 4.5l.5 6h3l.5-6" stroke={t.fgMuted} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </IconBtn>
        </View>
      </View>

      {expanded && (
        <View style={[styles.sExpanded, { borderTopColor: t.borderColor }]}>
          <Text style={[styles.fieldLabel, { color: t.fgDim }]}>DISPLAY NAME</Text>
          <TextInput
            value={section.name}
            onChangeText={onChangeName}
            style={[styles.fieldInput, { color: t.fg, borderColor: t.borderColor, backgroundColor: t.glass ? 'rgba(255,255,255,0.04)' : t.surface }]}
            placeholderTextColor={t.fgDim}
            placeholder="Section name"
          />
          <Text style={[styles.fieldLabel, { color: t.fgDim }]}>SYSTEM PROMPT</Text>
          <TextInput
            value={section.prompt}
            onChangeText={onChangePrompt}
            style={[styles.fieldInput, styles.promptInput, { color: t.fg, borderColor: t.borderColor, backgroundColor: t.glass ? 'rgba(255,255,255,0.04)' : t.surface }]}
            placeholderTextColor={t.fgDim}
            placeholder="Instructions for Claude at this stage…"
            multiline
            textAlignVertical="top"
          />
        </View>
      )}
    </Surface>
  );
}

// ── Add-section picker ───────────────────────────────────────────────────────

function AddSectionPicker({
  existing, onAdd, onClose,
}: {
  existing: Set<string>;
  onAdd: (key: string) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const available = Object.entries(SECTION_DEFS).filter(([k]) => !existing.has(k));
  return (
    <View style={[StyleSheet.absoluteFill, styles.pickerOverlay]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.pickerSheet, { backgroundColor: t.bg, borderTopColor: t.borderColor }]}>
        <Text style={[styles.pickerTitle, { color: t.fg }]}>Add a section</Text>
        <ScrollView showsVerticalScrollIndicator={false}>
          {available.length === 0 ? (
            <Text style={[styles.pickerEmpty, { color: t.fgMuted }]}>All built-in sections are already included.</Text>
          ) : available.map(([key, def]) => (
            <Pressable key={key} onPress={() => { onAdd(key); onClose(); }}>
              <View style={[styles.pickerRow, { borderBottomColor: t.borderColor }]}>
                <Text style={[styles.pickerGlyph, { color: PLAN_COLORS.plan }]}>{def.glyph}</Text>
                <View style={styles.pickerText}>
                  <Text style={[styles.pickerName, { color: t.fg }]}>{def.name}</Text>
                  <Text style={[styles.pickerBlurb, { color: t.fgMuted }]} numberOfLines={1}>{def.blurb}</Text>
                </View>
                <Svg width={11} height={11} viewBox="0 0 11 11" fill="none">
                  <Path d="M3.5 2l4 3.5-4 3.5" stroke={t.fgMuted} strokeWidth={1.5} strokeLinecap="round" />
                </Svg>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

// ── Main editor ──────────────────────────────────────────────────────────────

export interface BlueprintEditorProps {
  /** If provided, pre-populate from an existing blueprint. Otherwise start blank. */
  initialBlueprint?: Blueprint;
  onSave: (bp: Blueprint) => void;
  onCancel: () => void;
}

export function BlueprintEditor({ initialBlueprint, onSave, onCancel }: BlueprintEditorProps) {
  const t = useTheme();
  const [name, setName] = useState(initialBlueprint?.name ?? '');
  const [desc, setDesc] = useState(initialBlueprint?.desc ?? '');
  const [sections, setSections] = useState<BlueprintSection[]>(
    initialBlueprint?.sections ?? [mkSection('context')],
  );
  const [expandedUid, setExpandedUid] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const existingKeys = new Set(sections.map((s) => s.key));

  function patchSection(sUid: string, patch: Partial<BlueprintSection>) {
    setSections((ss) => ss.map((s) => s.uid === sUid ? { ...s, ...patch } : s));
  }

  function addSection(key: string) {
    setSections((ss) => [...ss, mkSection(key)]);
  }

  function deleteSection(sUid: string) {
    setSections((ss) => ss.filter((s) => s.uid !== sUid));
  }

  function handleSave() {
    const n = name.trim();
    const d = desc.trim();
    if (!n) return;
    const bp: Blueprint = {
      id: initialBlueprint?.id ?? `custom-${uid('bp')}`,
      name: n,
      desc: d || n,
      sections,
    };
    onSave(bp);
  }

  const canSave = name.trim().length > 0 && sections.length > 0;

  return (
    <View style={styles.root}>
      {/* header */}
      <View style={[styles.header, { borderBottomColor: t.borderColor }]}>
        <IconBtn onPress={onCancel}>
          <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
            <Path d="M9 3L5 7l4 4" stroke={t.fg} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </IconBtn>
        <Text style={[styles.title, { color: t.fg }]}>
          {initialBlueprint ? 'Edit blueprint' : 'New blueprint'}
        </Text>
        <Pressable
          onPress={handleSave}
          disabled={!canSave}
          style={[styles.saveChip, {
            backgroundColor: canSave ? t.accent : t.borderColor,
          }]}
        >
          <Text style={[styles.saveText, { color: canSave ? '#fff' : t.fgDim }]}>Save</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyInner}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* name + desc */}
        <Surface style={styles.metaCard} radius={14}>
          <TextInput
            value={name}
            onChangeText={setName}
            style={[styles.nameInput, { color: t.fg }]}
            placeholderTextColor={t.fgDim}
            placeholder="Blueprint name"
          />
          <View style={[styles.metaDivider, { backgroundColor: t.borderColor }]} />
          <TextInput
            value={desc}
            onChangeText={setDesc}
            style={[styles.descInput, { color: t.fgMuted }]}
            placeholderTextColor={t.fgDim}
            placeholder="Short description"
          />
        </Surface>

        {/* sections */}
        <Text style={[styles.sectionHeading, { color: t.fgDim }]}>SECTIONS</Text>
        {sections.map((s, i) => (
          <SectionRow
            key={s.uid}
            section={s}
            index={i}
            total={sections.length}
            expanded={expandedUid === s.uid}
            onToggle={() => patchSection(s.uid, { enabled: !s.enabled })}
            onMoveUp={() => setSections((ss) => moveSection(ss, s.uid, -1))}
            onMoveDown={() => setSections((ss) => moveSection(ss, s.uid, 1))}
            onDelete={() => deleteSection(s.uid)}
            onExpand={() => setExpandedUid((cur) => cur === s.uid ? null : s.uid)}
            onChangeName={(v) => patchSection(s.uid, { name: v })}
            onChangePrompt={(v) => patchSection(s.uid, { prompt: v })}
          />
        ))}

        {/* add section */}
        <Pressable onPress={() => setShowPicker(true)}>
          <Surface style={[styles.addRow, { borderColor: t.borderColor }]} radius={12}>
            <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
              <Rect x={1} y={1} width={12} height={12} rx={3} stroke={t.fgMuted} strokeWidth={1.4} strokeDasharray="3 2" />
              <Path d="M7 4.5v5M4.5 7h5" stroke={t.fgMuted} strokeWidth={1.5} strokeLinecap="round" />
            </Svg>
            <Text style={[styles.addText, { color: t.fgMuted }]}>Add section</Text>
          </Surface>
        </Pressable>

        {/* use blueprint CTA */}
        <PrimaryButton onPress={handleSave} disabled={!canSave} style={styles.useCta}>
          <Text style={styles.useCtaText}>
            {initialBlueprint ? 'Save changes' : 'Save blueprint'}
          </Text>
        </PrimaryButton>
      </ScrollView>

      {showPicker && (
        <AddSectionPicker
          existing={existingKeys}
          onAdd={addSection}
          onClose={() => setShowPicker(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { flex: 1, fontSize: 16, fontWeight: '700' },
  saveChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14 },
  saveText: { fontSize: 13.5, fontWeight: '600' },

  body: { flex: 1 },
  bodyInner: { padding: 14, gap: 10, paddingBottom: 40 },

  metaCard: { padding: 14, gap: 0 },
  nameInput: { fontSize: 17, fontWeight: '700', paddingVertical: 4 },
  metaDivider: { height: StyleSheet.hairlineWidth, marginVertical: 10 },
  descInput: { fontSize: 14, paddingVertical: 2 },

  sectionHeading: { fontSize: 10.5, letterSpacing: 1.2, fontWeight: '700', marginTop: 4 },

  sRow: { padding: 12, gap: 0 },
  sRowHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sGlyph: { fontSize: 16, width: 22, textAlign: 'center' },
  sNameWrap: { flex: 1, minWidth: 0 },
  sName: { fontSize: 14, fontWeight: '600' },
  sGate: { fontSize: 11.5, marginTop: 1 },
  sActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  arrowBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  toggleBtn: { width: 34, height: 18, borderRadius: 9, justifyContent: 'center', paddingHorizontal: 2, marginHorizontal: 4 },
  toggleThumb: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#fff' },

  sExpanded: { marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, gap: 6 },
  fieldLabel: { fontSize: 10, letterSpacing: 1.1, fontWeight: '700' },
  fieldInput: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13.5 },
  promptInput: { minHeight: 120, paddingTop: 10 },

  addRow: {
    flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12,
    borderWidth: StyleSheet.hairlineWidth, borderStyle: 'dashed',
  },
  addText: { fontSize: 14, fontWeight: '500' },

  useCta: { marginTop: 4 },
  useCtaText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  pickerOverlay: { backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerSheet: { borderTopWidth: StyleSheet.hairlineWidth, padding: 16, maxHeight: '60%', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  pickerTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  pickerEmpty: { fontSize: 13, paddingVertical: 16, textAlign: 'center' },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  pickerGlyph: { fontSize: 18, width: 24, textAlign: 'center' },
  pickerText: { flex: 1, minWidth: 0 },
  pickerName: { fontSize: 14, fontWeight: '600' },
  pickerBlurb: { fontSize: 12, marginTop: 2 },
});
