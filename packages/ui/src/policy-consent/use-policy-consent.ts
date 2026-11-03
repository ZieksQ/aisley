'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { policyTypes, type ConsentApi, type ConsentDocument, type ConsentPolicyType, type ConsentStatus } from './types';

type Documents = Partial<Record<ConsentPolicyType, ConsentDocument>>;
const messageFor = (error: unknown) => error instanceof Error ? error.message : 'We could not verify your consent. Please try again.';

export function usePolicyConsent(api: ConsentApi, onComplete?: () => void) {
  const [status, setStatus] = useState<ConsentStatus | null>(null);
  const [documents, setDocuments] = useState<Documents>({});
  const [checked, setChecked] = useState<Partial<Record<ConsentPolicyType, string>>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const coolingDown = cooldownUntil > Date.now();
  useEffect(() => {
    if (!cooldownUntil) return;
    const timer = window.setTimeout(() => setCooldownUntil(0), Math.max(0, cooldownUntil - Date.now()));
    return () => window.clearTimeout(timer);
  }, [cooldownUntil]);

  const rateLimit = useCallback((caught: unknown) => {
    if (caught && typeof caught === 'object' && 'status' in caught && caught.status === 429) {
      const seconds = 'retryAfter' in caught && typeof caught.retryAfter === 'number' && Number.isFinite(caught.retryAfter) ? Math.max(1, caught.retryAfter) : 1;
      setCooldownUntil(Date.now() + seconds * 1000);
      return true;
    }
    return false;
  }, []);
  const epoch = useRef(0);
  const mounted = useRef(true);
  const saving = useRef(false);
  const complete = useRef(onComplete);
  useEffect(() => { complete.current = onComplete; }, [onComplete]);

  const load = useCallback(async () => {
    const query = ++epoch.current;
    setLoading(true);
    setError('');
    try {
      const { data: next } = await api.status();
      const entries = await Promise.all(policyTypes.map(async (type) => {
        const item = next.policies.find((policy) => policy.type === type);
        if (!item?.current_version) return [type, undefined] as const;
        const { data } = await api.document(type);
        if (data.version.id !== item.current_version.id || data.version.version !== item.current_version.version) {
          throw new Error('A policy changed while loading. Refresh to review the current version.');
        }
        return [type, data.version] as const;
      }));
      if (query !== epoch.current) return;
      const nextDocuments = Object.fromEntries(entries) as Documents;
      setDocuments(nextDocuments);
      setStatus(next);
      setChecked((previous) => Object.fromEntries(Object.entries(previous).filter(([type, id]) => nextDocuments[type as ConsentPolicyType]?.id === id)));
    } catch (caught) {
      if (query === epoch.current) { rateLimit(caught); setError(messageFor(caught)); }
    } finally {
      if (query === epoch.current) setLoading(false);
    }
  }, [api, rateLimit]);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => { mounted.current = false; epoch.current++; };
  }, [load]);

  const pending = status?.policies.filter((policy) => policy.required) ?? [];
  const mayAccept = !loading && !busy && !coolingDown && pending.length > 0 && pending.every((policy) => {
    const document = documents[policy.type];
    return document && document.id === policy.current_version?.id && checked[policy.type] === document.id;
  });

  async function accept() {
    if (!mayAccept || saving.current) return;
    saving.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    const query = epoch.current;
    try {
      // Reconcile an earlier uncertain result and detect publications before replay.
      const { data: current } = await api.status();
      if (query !== epoch.current) return;
      if (current.all_required_accepted) {
        setStatus(current);
        setMessage('Your policy consent is up to date.');
        complete.current?.();
        return;
      }
      const selections = current.policies.filter((policy) => policy.required).map((policy) => {
        const document = documents[policy.type];
        if (!document || document.id !== policy.current_version?.id || checked[policy.type] !== document.id) {
          throw new Error('The required policies changed. Refresh and confirm the current versions.');
        }
        return { type: policy.type, version: document.version, confirmation: true as const };
      });
      const { data } = await api.accept(selections);
      if (query !== epoch.current) return;
      setStatus(data.status);
      setMessage('Your policy acceptance has been saved.');
      if (data.status.all_required_accepted) complete.current?.();
      else await load();
    } catch (caught) {
      if (query !== epoch.current) return;
      const originalError = messageFor(caught);
      if (rateLimit(caught)) { setError(originalError); return; }
      try {
        const { data: current } = await api.status();
        if (query !== epoch.current) return;
        setStatus(current);
        if (current.all_required_accepted) {
          setMessage('Your policy acceptance has been saved.');
          complete.current?.();
          return;
        }
        const changed = current.policies.some((policy) => policy.required && policy.current_version?.id !== documents[policy.type]?.id);
        if (changed) await load();
      } catch { /* Keep the reviewed versions for an explicit, reconciled retry. */ }
      if (mounted.current) setError(originalError);
    } finally {
      saving.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  function confirm(type: ConsentPolicyType, value: boolean) {
    setChecked((previous) => ({ ...previous, [type]: value ? documents[type]?.id : undefined }));
  }

  return { status, documents, checked, loading, busy, coolingDown, error, message, mayAccept, load, accept, confirm };
}
