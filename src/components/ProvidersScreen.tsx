import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme';
import { Surface } from './ui/Surface';
import {
  PROVIDERS, LLMProviderId, defaultModelFor,
  getProviderKey, setProviderKey,
  getSelectedProvider, setSelectedProvider,
  getSelectedModel, setSelectedModel,
  getLocalEndpoint, setLocalEndpoint,
} from '../lib/providers';

const TAB_BAR_HEIGHT = 60;

type Props = {
  onBack: () => void;
  /** Called after a provider/model is activated, so the host can dismiss. */
  onConnected?: () => void;
};

/**
 * "Connect a model" — standalone provider/model picker reached from the Run
 * tab's pairing screen. Lists providers from the registry, lets the user enter
 * a key (or local endpoint), pick a model, and persists the selection via the
 * providers storage layer. Making the agent actually use a non-Anthropic
 * selection is the standalone-mode wiring (#60).
 */
export function ProvidersScreen({ onBack, onConnected }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<LLMProviderId | null>('anthropic');
  const [connected, setConnected] = useState<Record<string, boolean>>({});
  const [activeProvider, setActiveProvider] = useState<LLMProviderId>('anthropic');
  const [activeModel, setActiveModel] = useState<string>('');
  const [modelByProvider, setModelByProvider] = useState<Record<string, string>>({});
  const [keyDrafts, setKeyDrafts] = useState<Record<string, string>>({});
  const [endpoint, setEndpoint] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [keyFlags, selProvider, selModel, localEp] = await Promise.all([
        Promise.all(PROVIDERS.map((p) => getProviderKey(p.id).then((k) => [p.id, !!k] as const))),
        getSelectedProvider(),
        getSelectedModel(),
        getLocalEndpoint(),
      ]);
      if (cancelled) return;
      const conn: Record<string, boolean> = {};
      for (const [id, has] of keyFlags) conn[id] = has;
      conn.local = !!localEp;
      const models: Record<string, string> = {};
      for (const p of PROVIDERS) {
        models[p.id] = p.id === selProvider ? selModel : defaultModelFor(p.id);
      }
      setConnected(conn);
      setActiveProvider(selProvider);
      setActiveModel(selModel);
      setModelByProvider(models);
      setEndpoint(localEp ?? '');
      setOpenId(selProvider);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  async function activate(id: LLMProviderId) {
    const provider = PROVIDERS.find((p) => p.id === id);
    if (!provider) return;
    const model = modelByProvider[id] ?? defaultModelFor(id);
    setBusyId(id);
    try {
      if (provider.auth === 'local') {
        await setLocalEndpoint(endpoint.trim());
      } else {
        const draft = (keyDrafts[id] ?? '').trim();
        if (draft) await setProviderKey(id, draft);
        else if (!connected[id]) { setBusyId(null); return; }
      }
      await setSelectedProvider(id);
      await setSelectedModel(model);
      setConnected((c) => ({ ...c, [id]: true }));
      setActiveProvider(id);
      setActiveModel(model);
      setKeyDrafts((d) => ({ ...d, [id]: '' }));
      onConnected?.();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: t.borderColor }]}>
        <Pressable onPress={onBack} hitSlop={10} style={[styles.backBtn, { backgroundColor: t.glass ? 'rgba(255,255,255,0.10)' : t.surface }]}>
          <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
            <Path d="M9 3L5 7l4 4" stroke={t.fg} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, { color: t.fg }]}>Connect a model</Text>
          <Text style={[styles.headerSub, { color: t.fgMuted }]}>Cloud or local · runs without a desktop</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={t.accent} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 20 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {PROVIDERS.map((p) => {
            const open = p.id === openId;
            const isConnected = !!connected[p.id];
            const isActive = activeProvider === p.id;
            return (
              <Surface key={p.id} style={styles.card} radius={16}>
                <Pressable
                  onPress={() => setOpenId(open ? null : p.id)}
                  style={styles.cardHead}
                >
                  <View style={[styles.brand, { backgroundColor: p.accent }]}>
                    <Text style={styles.brandLetter}>{p.name[0]}</Text>
                  </View>
                  <View style={styles.cardHeadText}>
                    <Text style={[styles.providerName, { color: t.fg }]}>{p.name}</Text>
                    <Text style={[styles.modelCount, { color: t.fgDim, fontFamily: t.fontMono }]}>
                      {p.models.length} model{p.models.length === 1 ? '' : 's'}
                    </Text>
                  </View>
                  {isActive && (
                    <View style={[styles.activeBadge, { backgroundColor: t.glass ? 'rgba(255,174,207,0.16)' : 'rgba(217,119,87,0.12)' }]}>
                      <Text style={[styles.activeBadgeText, { color: t.accent }]}>Active</Text>
                    </View>
                  )}
                  <StatusPill auth={p.auth} connected={isConnected} />
                  <Svg width={11} height={11} viewBox="0 0 11 11" fill="none" style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
                    <Path d="M3.5 2l4 3.5-4 3.5" stroke={t.fgMuted} strokeWidth={1.6} strokeLinecap="round" />
                  </Svg>
                </Pressable>

                {open && (
                  <View style={[styles.cardBody, { borderTopColor: t.borderColor }]}>
                    {p.models.map((m) => {
                      const sel = (modelByProvider[p.id] ?? defaultModelFor(p.id)) === m.id;
                      return (
                        <Pressable
                          key={m.id}
                          onPress={() => setModelByProvider((mm) => ({ ...mm, [p.id]: m.id }))}
                          style={styles.modelRow}
                        >
                          <View style={[styles.radio, { borderColor: sel ? t.accent : t.borderColor }]}>
                            {sel && <View style={[styles.radioDot, { backgroundColor: t.accent }]} />}
                          </View>
                          <View style={styles.modelText}>
                            <View style={styles.modelNameRow}>
                              <Text style={[styles.modelName, { color: t.fg, fontWeight: sel ? '600' : '500' }]}>
                                {m.name}
                              </Text>
                              {m.recommended && (
                                <View style={[styles.recTag, { backgroundColor: t.glass ? 'rgba(255,174,207,0.16)' : 'rgba(217,119,87,0.12)' }]}>
                                  <Text style={[styles.recTagText, { color: t.accent }]}>Recommended</Text>
                                </View>
                              )}
                            </View>
                            <Text style={[styles.modelId, { color: t.fgDim, fontFamily: t.fontMono }]}>{m.id}</Text>
                          </View>
                          <Text style={[styles.ctx, { color: t.fgDim, fontFamily: t.fontMono }]}>{m.contextLabel}</Text>
                        </Pressable>
                      );
                    })}

                    {/* Footer: key/endpoint entry + activate */}
                    <View style={styles.footer}>
                      {p.auth === 'local' ? (
                        <TextInput
                          value={endpoint}
                          onChangeText={setEndpoint}
                          placeholder="http://192.168.1.20:11434"
                          placeholderTextColor={t.fgDim}
                          autoCapitalize="none"
                          autoCorrect={false}
                          keyboardType="url"
                          style={[styles.input, { color: t.fg, fontFamily: t.fontMono, borderColor: t.borderColor, backgroundColor: t.glass ? 'rgba(0,0,0,0.22)' : t.bg }]}
                        />
                      ) : !isConnected ? (
                        <TextInput
                          value={keyDrafts[p.id] ?? ''}
                          onChangeText={(v) => setKeyDrafts((d) => ({ ...d, [p.id]: v }))}
                          placeholder={p.id === 'anthropic' ? 'sk-ant-…' : 'Paste API key'}
                          placeholderTextColor={t.fgDim}
                          secureTextEntry
                          autoCapitalize="none"
                          autoCorrect={false}
                          style={[styles.input, { color: t.fg, fontFamily: t.fontMono, borderColor: t.borderColor, backgroundColor: t.glass ? 'rgba(0,0,0,0.22)' : t.bg }]}
                        />
                      ) : null}

                      <Pressable
                        onPress={() => activate(p.id)}
                        disabled={busyId === p.id || (p.auth === 'key' && !isConnected && !(keyDrafts[p.id] ?? '').trim())}
                        style={[
                          styles.connectBtn,
                          { backgroundColor: t.accent },
                          (busyId === p.id || (p.auth === 'key' && !isConnected && !(keyDrafts[p.id] ?? '').trim())) && styles.disabled,
                        ]}
                      >
                        {busyId === p.id ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text style={styles.connectBtnText}>
                            {isActive ? 'Use this model' : isConnected ? 'Use this model' : 'Connect'}
                          </Text>
                        )}
                      </Pressable>

                      {p.auth === 'key' && isConnected && (
                        <Pressable
                          onPress={() => setConnected((c) => ({ ...c, [p.id]: false }))}
                          hitSlop={8}
                          style={styles.replaceBtn}
                        >
                          <Text style={[styles.replaceText, { color: t.fgMuted }]}>Replace key</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                )}
              </Surface>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

function StatusPill({ auth, connected }: { auth: 'key' | 'local'; connected: boolean }) {
  const t = useTheme();
  if (connected) {
    return (
      <View style={styles.pill}>
        <View style={[styles.pillDot, { backgroundColor: t.code.ty }]} />
        <Text style={[styles.pillText, { color: t.code.ty }]}>Connected</Text>
      </View>
    );
  }
  if (auth === 'local') {
    return <Text style={[styles.pillText, { color: '#67d3ff' }]}>On device</Text>;
  }
  return <Text style={[styles.pillText, { color: t.fgDim }]}>Add key</Text>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  headerSub: { fontSize: 11.5, marginTop: 1 },

  list: { padding: 12, gap: 10 },
  card: { overflow: 'hidden' },
  cardHead: {
    flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12,
  },
  brand: {
    width: 30, height: 30, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  brandLetter: { color: '#fff', fontSize: 14, fontWeight: '700' },
  cardHeadText: { flex: 1, minWidth: 0 },
  providerName: { fontSize: 14, fontWeight: '600' },
  modelCount: { fontSize: 10.5, marginTop: 1 },
  activeBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  activeBadgeText: { fontSize: 10, fontWeight: '700' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 11, fontWeight: '600' },

  cardBody: { borderTopWidth: StyleSheet.hairlineWidth },
  modelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  radio: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  radioDot: { width: 8, height: 8, borderRadius: 4 },
  modelText: { flex: 1, minWidth: 0 },
  modelNameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  modelName: { fontSize: 13 },
  recTag: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  recTagText: { fontSize: 9.5, fontWeight: '700' },
  modelId: { fontSize: 10.5, marginTop: 1 },
  ctx: { fontSize: 10.5 },

  footer: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 12, gap: 8 },
  input: {
    height: 42, borderRadius: 11, borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12, fontSize: 13,
  },
  connectBtn: {
    height: 42, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  connectBtnText: { color: '#fff', fontSize: 13.5, fontWeight: '600' },
  disabled: { opacity: 0.4 },
  replaceBtn: { alignItems: 'center', paddingVertical: 2 },
  replaceText: { fontSize: 12 },
});
