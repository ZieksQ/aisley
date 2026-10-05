import { useCallback, useSyncExternalStore } from "react";

export type ChatAttempt = { key: string; body: string; context?: string | null };

const drafts = new Map<string, string>();
const attempts = new Map<string, ChatAttempt>();
const listeners = new Map<string, Set<() => void>>();

function notify(key: string) {
  listeners.get(key)?.forEach((listener) => listener());
}

function subscribe(key: string, listener: () => void) {
  const bucket = listeners.get(key) ?? new Set<() => void>();
  bucket.add(listener);
  listeners.set(key, bucket);
  return () => {
    bucket.delete(listener);
    if (!bucket.size) listeners.delete(key);
  };
}

export function readChatDraft(key: string) {
  return drafts.get(key) ?? "";
}

export function writeChatDraft(key: string, value: string) {
  if (value) drafts.set(key, value);
  else drafts.delete(key);
  notify(key);
}

export function readChatAttempt(key: string) {
  return attempts.get(key) ?? null;
}

export function writeChatAttempt(key: string, value: ChatAttempt | null) {
  if (value) attempts.set(key, value);
  else attempts.delete(key);
  notify(key);
}

export function clearChatPrivateState() {
  const keys = new Set([...drafts.keys(), ...attempts.keys()]);
  drafts.clear();
  attempts.clear();
  keys.forEach(notify);
}

export function useChatDraft(key: string): [string, (value: string) => void] {
  const value = useSyncExternalStore(
    (listener) => subscribe(key, listener),
    () => drafts.get(key) ?? "",
    () => "",
  );
  const update = useCallback((next: string) => writeChatDraft(key, next), [key]);
  return [value, update];
}

export function useChatAttempt(key: string): [ChatAttempt | null, (value: ChatAttempt | null) => void] {
  const value = useSyncExternalStore(
    (listener) => subscribe(key, listener),
    () => attempts.get(key) ?? null,
    () => null,
  );
  const update = useCallback((next: ChatAttempt | null) => writeChatAttempt(key, next), [key]);
  return [value, update];
}
