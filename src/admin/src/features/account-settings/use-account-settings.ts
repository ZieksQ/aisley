import { accountImageError, useAccountLifetime } from "@aisley/ui/account-settings";
import type { ChangeEvent, FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { ApiError, apiRequest } from '../../lib/api';
import type { AdminAccount, AdminAccountMutationResponse, AdminAccountResponse } from '../../types/account';
type ProfileForm = {
  first_name: string;
  last_name: string;
  middle_name: string;
  contact_number: string;
  sex: string;
  birth_date: string;
};
const emptyProfile: ProfileForm = {
  first_name: '', last_name: '', middle_name: '', contact_number: '', sex: '', birth_date: '',
};
export function useAccountSettings() {
  const isCurrent = useAccountLifetime();
  const { updateAdmin } = useAuth();
  const [account, setAccount] = useState<AdminAccount | null>(null);
  const [profile, setProfile] = useState<ProfileForm>(emptyProfile);
  const [email, setEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [passwords, setPasswords] = useState({ current_password: '', password: '', password_confirmation: '' });
  const [photo, setPhoto] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => { document.title = 'Account | Aisley Admin'; }, []);
  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true); setLoadError('');
    apiRequest<AdminAccountResponse>('/api/v1/admin/account', { signal: controller.signal })
      .then(({ account: next }) => {
        if (controller.signal.aborted || !isCurrent()) return;
        setAccount(next); setEmail(next.email);
        setProfile({
          first_name: next.profile.first_name ?? '', last_name: next.profile.last_name ?? '',
          middle_name: next.profile.middle_name ?? '', contact_number: next.profile.contact_number ?? '',
          sex: next.profile.sex ?? '', birth_date: next.profile.birth_date ?? '',
        });
      })
      .catch((error: unknown) => { if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : 'Unable to load account settings.'); })
      .finally(() => { if (!controller.signal.aborted) setIsLoading(false); });
    return () => controller.abort();
  }, [reload, isCurrent]);
  function applyResponse(response: AdminAccountMutationResponse) {
    if (!isCurrent()) return;
    setAccount(response.account); updateAdmin(response.admin); setMessage(response.message); setErrors({});
  }
  const [feedbackAction, setFeedbackAction] = useState('');
  function begin(action: string) { setFeedbackAction(action); setBusy(action); setMessage(''); setErrors({}); }
  function fail(error: unknown) { setErrors(error instanceof ApiError ? error.errors : { form: [error instanceof Error ? error.message : 'The request could not be completed.'] }); }
  function finish() { setBusy(null); }
  async function saveProfile(event: FormEvent) {
    event.preventDefault(); if (busy) return; begin('profile');
    try {
      const response = await apiRequest<AdminAccountMutationResponse>('/api/v1/admin/account/profile', {
        method: 'PATCH', body: JSON.stringify({ ...profile, middle_name: profile.middle_name || null, contact_number: profile.contact_number || null, sex: profile.sex || null, birth_date: profile.birth_date || null }),
      });
      if (!isCurrent()) return;
      applyResponse(response);
    } catch (error) { if (!isCurrent()) return; fail(error); } finally { finish(); }
  }
  async function saveEmail(event: FormEvent) {
    event.preventDefault(); if (busy) return; begin('email');
    try {
      const response = await apiRequest<AdminAccountMutationResponse>('/api/v1/admin/account/email', { method: 'PATCH', body: JSON.stringify({ email, current_password: emailPassword }) });
      if (!isCurrent()) return;
      applyResponse(response); setEmailPassword('');
    } catch (error) { if (!isCurrent()) return; fail(error); } finally { finish(); }
  }
  async function savePassword(event: FormEvent) {
    event.preventDefault(); if (busy) return; begin('password');
    try {
      const response = await apiRequest<{ message: string; }>('/api/v1/admin/account/password', { method: 'PUT', body: JSON.stringify(passwords) });
      if (!isCurrent()) return;
      setMessage(response.message); setPasswords({ current_password: '', password: '', password_confirmation: '' });
    } catch (error) { if (!isCurrent()) return; fail(error); } finally { finish(); }
  }
  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    event.currentTarget.value = '';
    setErrors({}); setMessage('');
    const selectionError = selected ? accountImageError(selected) : null;
    if (selectionError) { setErrors({ photo: [selectionError] }); setPhoto(null); return; }
    setPhoto(selected);
  }
  async function uploadPhoto(event: FormEvent) {
    event.preventDefault(); if (!photo || busy) return;
    begin('photo');
    const body = new FormData(); body.append('photo', photo);
    try {
      const response = await apiRequest<AdminAccountMutationResponse>('/api/v1/admin/account/profile-photo', { method: 'POST', body });
      if (!isCurrent()) return;
      applyResponse(response); setPhoto(null);
    } catch (error) { if (!isCurrent()) return; fail(error); } finally { finish(); }
  }
  async function removePhoto() {
    if (busy) return;
    begin('photo');
    try {
      const response = await apiRequest<AdminAccountMutationResponse>('/api/v1/admin/account/profile-photo', { method: 'DELETE' });
      if (!isCurrent()) return;
      applyResponse(response); setPhoto(null);
    } catch (error) { if (!isCurrent()) return; fail(error); } finally { finish(); }
  }
  return {
    feedbackAction,
    updateAdmin,
    account,
    setAccount,
    profile,
    setProfile,
    email,
    setEmail,
    emailPassword,
    setEmailPassword,
    passwords,
    setPasswords,
    photo,
    setPhoto,
    isLoading,
    setIsLoading,
    busy,
    setBusy,
    errors,
    setErrors,
    message,
    setMessage,
    loadError,
    setLoadError,
    reload,
    setReload,
    applyResponse,
    begin,
    fail,
    finish,
    saveProfile,
    saveEmail,
    savePassword,
    choosePhoto,
    uploadPhoto,
    removePhoto,
  };
}
