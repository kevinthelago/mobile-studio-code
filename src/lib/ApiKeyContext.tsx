import React, {
  createContext, useCallback, useContext, useRef, useState,
} from 'react';
import { useSession } from './session';
import { ApiKeyModal } from '../components/ui/ApiKeyModal';

type ApiKeyPromptValue = {
  /**
   * Opens the just-in-time key prompt and resolves with the verified key once
   * the user saves it, or null if they cancel. Persists the key via the
   * session before resolving, so callers can proceed immediately.
   */
  requestApiKey: () => Promise<string | null>;
};

const ApiKeyPromptContext = createContext<ApiKeyPromptValue | null>(null);

export function useApiKeyPrompt(): ApiKeyPromptValue {
  const ctx = useContext(ApiKeyPromptContext);
  if (!ctx) throw new Error('useApiKeyPrompt outside ApiKeyPromptProvider');
  return ctx;
}

// Hosts the shared key-prompt modal and exposes requestApiKey() to the tree.
// Must render inside SessionProvider — it persists the key via useSession.
export function ApiKeyPromptProvider({ children }: { children: React.ReactNode }) {
  const { saveApiKey } = useSession();
  const [visible, setVisible] = useState(false);
  const resolverRef = useRef<((key: string | null) => void) | null>(null);

  const settle = useCallback((key: string | null) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setVisible(false);
    resolve?.(key);
  }, []);

  const requestApiKey = useCallback((): Promise<string | null> => {
    return new Promise((resolve) => {
      // If a prompt is somehow already open, abandon the prior waiter (resolve
      // it null) so its promise never hangs.
      if (resolverRef.current) resolverRef.current(null);
      resolverRef.current = resolve;
      setVisible(true);
    });
  }, []);

  const onSaved = useCallback(async (key: string) => {
    await saveApiKey(key);
    settle(key);
  }, [saveApiKey, settle]);

  return (
    <ApiKeyPromptContext.Provider value={{ requestApiKey }}>
      {children}
      <ApiKeyModal
        visible={visible}
        onCancel={() => settle(null)}
        onSaved={onSaved}
      />
    </ApiKeyPromptContext.Provider>
  );
}
