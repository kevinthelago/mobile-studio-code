import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import {
  getLLMSettings,
  saveLLMSettings,
  clearLLMSettings,
  DEFAULT_LLM_SETTINGS,
  LLMSettings,
  LLMProvider,
} from '../lib/storage';
import { PROVIDERS, getProviderInfo } from '../lib/llm';
import { useTheme } from '../ThemeContext';

// ── Small components ──────────────────────────────────────────────────────────

function SectionLabel({ label, t }: { label: string; t: ReturnType<typeof useTheme> }) {
  return (
    <Text style={[styles.sectionLabel, { color: t.fgMuted, fontFamily: t.fontUI }]}>
      {label}
    </Text>
  );
}

function SegmentControl({
  options,
  value,
  onChange,
  t,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  t: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={[styles.segment, { borderColor: t.borderColor, borderRadius: t.radius / 2 }]}>
      {options.map((opt, i) => {
        const active = opt.id === value;
        return (
          <Pressable
            key={opt.id}
            onPress={() => onChange(opt.id)}
            style={[
              styles.segmentItem,
              i < options.length - 1 && { borderRightWidth: 1, borderRightColor: t.borderColor },
              active && { backgroundColor: t.accent },
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                { color: active ? t.bg : t.fg, fontFamily: t.fontUI },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ModelPill({
  model,
  active,
  onPress,
  t,
}: {
  model: string;
  active: boolean;
  onPress: () => void;
  t: ReturnType<typeof useTheme>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.pill,
        {
          borderColor: active ? t.accent : t.borderColor,
          backgroundColor: active ? t.accent + '22' : t.surface,
          borderRadius: t.radius / 2,
        },
      ]}
    >
      <Text style={[styles.pillText, { color: active ? t.accent : t.fg, fontFamily: t.fontMono }]}>
        {model}
      </Text>
    </Pressable>
  );
}

function StyledInput({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  autoCapitalize,
  t,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences';
  t: ReturnType<typeof useTheme>;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={t.fgDim}
      secureTextEntry={secureTextEntry}
      autoCapitalize={autoCapitalize ?? 'none'}
      autoCorrect={false}
      autoComplete="off"
      style={[
        styles.input,
        {
          backgroundColor: t.surface,
          borderColor: t.borderColor,
          color: t.fg,
          borderRadius: t.radius / 2,
          fontFamily: t.fontMono,
        },
      ]}
    />
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const t = useTheme();

  const [settings, setSettings] = useState<LLMSettings>(DEFAULT_LLM_SETTINGS);
  const [customModel, setCustomModel] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    getLLMSettings().then((s) => {
      setSettings(s);
      const info = getProviderInfo(s.provider);
      if (!info.models.includes(s.model)) {
        setCustomModel(s.model);
      }
    });
  }, []);

  const update = useCallback(<K extends keyof LLMSettings>(key: K, val: LLMSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: val }));
    setDirty(true);
  }, []);

  function handleProviderChange(id: string) {
    const provider = id as LLMProvider;
    const info = getProviderInfo(provider);
    const defaultModel = info.models[0] ?? '';
    setSettings((prev) => ({
      ...prev,
      provider,
      model: defaultModel,
      baseUrl: prev.baseUrl || info.defaultBaseUrl,
    }));
    setCustomModel('');
    setDirty(true);
  }

  function handlePresetModel(model: string) {
    update('model', model);
    setCustomModel('');
  }

  function handleCustomModelChange(text: string) {
    setCustomModel(text);
    update('model', text);
  }

  async function handleSave() {
    const finalModel = customModel.trim() || settings.model;
    const finalSettings = { ...settings, model: finalModel };

    if (!finalSettings.apiKey && finalSettings.provider !== 'openai-compatible') {
      Alert.alert('Missing API Key', 'Please enter an API key before saving.');
      return;
    }
    if (!finalSettings.model) {
      Alert.alert('Missing Model', 'Please select or enter a model name.');
      return;
    }

    await saveLLMSettings(finalSettings);
    setSettings(finalSettings);
    setDirty(false);
    Alert.alert('Saved', 'LLM settings stored securely.');
  }

  async function handleClear() {
    Alert.alert(
      'Clear all LLM settings?',
      'This removes the API key and resets provider/model to defaults.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearLLMSettings();
            setSettings(DEFAULT_LLM_SETTINGS);
            setCustomModel('');
            setDirty(false);
          },
        },
      ],
    );
  }

  const providerInfo = getProviderInfo(settings.provider);
  const presetModels = providerInfo.models;
  const isCustom = !!customModel || (settings.model && !presetModels.includes(settings.model));

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: t.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <Text style={[styles.heading, { color: t.fg, fontFamily: t.fontUI }]}>
          AI Settings
        </Text>
        <Text style={[styles.sub, { color: t.fgMuted, fontFamily: t.fontUI }]}>
          Keys are stored in iOS Keychain via expo-secure-store and sent only to the API you configure.
        </Text>

        {/* ── Provider ── */}
        <SectionLabel label="PROVIDER" t={t} />
        <SegmentControl
          options={PROVIDERS.map((p) => ({ id: p.id, label: p.label }))}
          value={settings.provider}
          onChange={handleProviderChange}
          t={t}
        />

        {/* ── API Key ── */}
        <SectionLabel label="API KEY" t={t} />
        <StyledInput
          value={settings.apiKey}
          onChangeText={(v) => update('apiKey', v)}
          placeholder={providerInfo.keyHint ?? 'API key'}
          secureTextEntry
          t={t}
        />

        {/* ── Base URL (OpenAI-compatible only) ── */}
        {settings.provider === 'openai-compatible' && (
          <>
            <SectionLabel label="BASE URL" t={t} />
            <StyledInput
              value={settings.baseUrl}
              onChangeText={(v) => update('baseUrl', v)}
              placeholder={providerInfo.defaultBaseUrl}
              t={t}
            />
            <Text style={[styles.hint, { color: t.fgMuted }]}>
              e.g. http://localhost:11434/v1 (Ollama), https://api.groq.com/openai/v1, etc.
            </Text>
          </>
        )}

        {/* ── Model picker ── */}
        <SectionLabel label="MODEL" t={t} />

        {presetModels.length > 0 && (
          <View style={styles.pillRow}>
            {presetModels.map((m) => (
              <ModelPill
                key={m}
                model={m}
                active={settings.model === m && !customModel}
                onPress={() => handlePresetModel(m)}
                t={t}
              />
            ))}
          </View>
        )}

        <Text style={[styles.orLabel, { color: t.fgDim }]}>
          {presetModels.length > 0 ? 'or enter a custom model ID' : 'Enter model name'}
        </Text>
        <StyledInput
          value={customModel}
          onChangeText={handleCustomModelChange}
          placeholder={
            presetModels.length > 0
              ? 'Custom model ID…'
              : 'e.g. llama3, mistral, phi3'
          }
          t={t}
        />
        {isCustom && customModel ? (
          <Text style={[styles.hint, { color: t.accent }]}>
            ✓ Using custom model: {customModel}
          </Text>
        ) : (
          settings.model ? (
            <Text style={[styles.hint, { color: t.fgMuted }]}>
              Active model: {settings.model}
            </Text>
          ) : null
        )}

        {/* ── Actions ── */}
        <View style={styles.actions}>
          <Pressable
            style={[
              styles.btnPrimary,
              { backgroundColor: t.accent, borderRadius: t.radius / 2 },
              !dirty && styles.btnDisabled,
            ]}
            onPress={handleSave}
            disabled={!dirty}
          >
            <Text style={[styles.btnPrimaryText, { color: t.bg, fontFamily: t.fontUI }]}>
              Save
            </Text>
          </Pressable>
          <Pressable
            style={[styles.btnDanger, { borderColor: '#c33', borderRadius: t.radius / 2 }]}
            onPress={handleClear}
          >
            <Text style={[styles.btnDangerText, { fontFamily: t.fontUI }]}>Clear All</Text>
          </Pressable>
        </View>

        {/* ── Links ── */}
        {settings.provider === 'anthropic' && (
          <Text style={[styles.note, { color: t.fgMuted }]}>
            Get a key at console.anthropic.com → Settings → API Keys
          </Text>
        )}
        {settings.provider === 'openai' && (
          <Text style={[styles.note, { color: t.fgMuted }]}>
            Get a key at platform.openai.com → API Keys
          </Text>
        )}
        {settings.provider === 'openai-compatible' && (
          <Text style={[styles.note, { color: t.fgMuted }]}>
            Works with Ollama, Groq, OpenRouter, LM Studio, and any OpenAI-compatible endpoint.
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 48 },

  heading: { fontSize: 22, fontWeight: '700', marginBottom: 6 },
  sub: { fontSize: 13, lineHeight: 18, marginBottom: 24 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 8,
  },

  segment: {
    flexDirection: 'row',
    borderWidth: 1,
    overflow: 'hidden',
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  segmentText: { fontSize: 13, fontWeight: '600' },

  input: {
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
  },

  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  pill: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  pillText: { fontSize: 13 },

  orLabel: { fontSize: 12, marginTop: 10, marginBottom: 6 },
  hint: { fontSize: 12, marginTop: 5, lineHeight: 17 },

  actions: { flexDirection: 'row', gap: 10, marginTop: 28 },
  btnPrimary: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnPrimaryText: { fontSize: 16, fontWeight: '700' },
  btnDisabled: { opacity: 0.4 },
  btnDanger: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnDangerText: { color: '#c33', fontWeight: '600', fontSize: 16 },

  note: { fontSize: 12, marginTop: 20, lineHeight: 18 },
});
