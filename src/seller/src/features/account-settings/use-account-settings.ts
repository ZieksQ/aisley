import { accountImageError, useAccountLifetime } from "@aisley/ui/account-settings";
import type { ChangeEvent, FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { ApiError, apiRequest, uploadForm } from '../../lib/api';
import type { SellerAccount, SellerAccountMutationResponse, SellerAccountResponse } from '../../types/account';
type ProfileForm = {
  first_name: string;
  last_name: string;
  middle_name: string;
  contact_number: string;
  sex: string;
  birth_date: string;
};
type StorefrontForm = {
  name: string;
  description: string;
  contact_email: string;
  contact_number: string;
  website: string;
  is_on_vacation: boolean;
  vacation_message: string;
};
const emptyProfile: ProfileForm = { first_name: '', last_name: '', middle_name: '', contact_number: '', sex: '', birth_date: '' };
const emptyStorefront: StorefrontForm = { name: '', description: '', contact_email: '', contact_number: '', website: '', is_on_vacation: false, vacation_message: '' };
export function useAccountSettings() {
  const isCurrent = useAccountLifetime();
  const { updateSeller, passwordSession } = useAuth();
  const [account, setAccount] = useState<SellerAccount | null>(null);
  const [profile, setProfile] = useState<ProfileForm>(emptyProfile);
  const [storefront, setStorefront] = useState<StorefrontForm>(emptyStorefront);
  const [email, setEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [shopCover, setShopCover] = useState<File | null>(null);
  const [coverProgress, setCoverProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => { document.title = 'Account | Aisley Seller'; }, []);
  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError('');
    apiRequest<SellerAccountResponse>('/api/v1/seller/account', { signal: controller.signal })
      .then(({ account: next }) => {
        if (controller.signal.aborted || !isCurrent()) return;
        setAccount(next);
        setEmail(next.email);
        setProfile({
          first_name: next.profile.first_name ?? '',
          last_name: next.profile.last_name ?? '',
          middle_name: next.profile.middle_name ?? '',
          contact_number: next.profile.contact_number ?? '',
          sex: next.profile.sex ?? '',
          birth_date: next.profile.birth_date ?? '',
        });
        setStorefront({
          name: next.shop.name,
          description: next.shop.description ?? '',
          contact_email: next.shop.contact_email ?? '',
          contact_number: next.shop.contact_number ?? '',
          website: next.shop.website ?? '',
          is_on_vacation: next.shop.is_on_vacation,
          vacation_message: next.shop.vacation_message ?? '',
        });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : 'Unable to load account settings.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [reload, isCurrent]);
  function applyResponse(response: SellerAccountMutationResponse) {
    if (!isCurrent()) return;
    setAccount(response.account);
    updateSeller(response.seller);
    setMessage(response.message);
    setErrors({});
  }
  const [feedbackAction, setFeedbackAction] = useState('');
  function begin(action: string) {
    setFeedbackAction(action); setBusy(action);
    setMessage('');
    setErrors({});
  }
  function fail(error: unknown) {
    setErrors(error instanceof ApiError ? error.errors : { form: [error instanceof Error ? error.message : 'The request could not be completed.'] });
  }
  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    begin('profile');
    try {
      const response = await apiRequest<SellerAccountMutationResponse>('/api/v1/seller/account/profile', {
        method: 'PATCH',
        body: JSON.stringify({ ...profile, middle_name: profile.middle_name || null }),
      });
      if (!isCurrent()) return;
      applyResponse(response);
    } catch (error) { if (!isCurrent()) return; fail(error); } finally { setBusy(null); }
  }
  async function saveStorefront(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    begin('storefront');
    try {
      const response = await apiRequest<SellerAccountMutationResponse>('/api/v1/seller/account/storefront', {
        method: 'PATCH',
        body: JSON.stringify({
          ...storefront,
          description: storefront.description || null,
          contact_email: storefront.contact_email || null,
          contact_number: storefront.contact_number || null,
          website: storefront.website || null,
          vacation_message: storefront.vacation_message || null,
        }),
      });
      if (!isCurrent()) return;
      applyResponse(response);
    } catch (error) { if (!isCurrent()) return; fail(error); } finally { setBusy(null); }
  }
  async function saveEmail(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    begin('email');
    try {
      const response = await apiRequest<SellerAccountMutationResponse>('/api/v1/seller/account/email', {
        method: 'PATCH', body: JSON.stringify({ email, current_password: emailPassword }),
      });
      if (!isCurrent()) return;
      applyResponse(response);
      setEmailPassword('');
    } catch (error) { if (!isCurrent()) return; fail(error); } finally { setBusy(null); }
  }
  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    event.currentTarget.value = '';
    setErrors({});
    setMessage('');
    const selectionError = selected ? accountImageError(selected) : null;
    if (selectionError) { setErrors({ photo: [selectionError] }); setPhoto(null); return; }
    setPhoto(selected);
  }
  async function uploadPhoto(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!photo) return;
    begin('photo');
    const body = new FormData();
    body.append('photo', photo);
    try {
      const response = await apiRequest<SellerAccountMutationResponse>('/api/v1/seller/account/profile-photo', { method: 'POST', body });
      if (!isCurrent()) return;
      applyResponse(response);
      setPhoto(null);
    } catch (error) { if (!isCurrent()) return; fail(error); } finally { setBusy(null); }
  }
  async function removePhoto() {
    if (busy) return;
    begin('photo');
    try {
      const response = await apiRequest<SellerAccountMutationResponse>('/api/v1/seller/account/profile-photo', { method: 'DELETE' });
      if (!isCurrent()) return;
      applyResponse(response);
      setPhoto(null);
    } catch (error) { if (!isCurrent()) return; fail(error); } finally { setBusy(null); }
  }
  function chooseShopCover(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    event.currentTarget.value = '';
    setErrors({});
    setMessage('');
    const selectionError = selected ? accountImageError(selected) : null;
    if (selectionError) {
      setErrors({ photo: [selectionError] });
      setShopCover(null);
      return;
    }
    setShopCover(selected);
  }
  async function uploadShopCover(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!shopCover) return;
    begin('shop-cover');
    setCoverProgress(0);
    const body = new FormData();
    body.append('photo', shopCover);
    try {
      const response = await uploadForm<SellerAccountMutationResponse>('/api/v1/seller/account/shop-cover', body, setCoverProgress);
      if (!isCurrent()) return;
      applyResponse(response);
      setShopCover(null);
    } catch (error) { if (!isCurrent()) return; fail(error); } finally { setBusy(null); setCoverProgress(0); }
  }
  async function removeShopCover() {
    begin('shop-cover');
    try {
      const response = await apiRequest<SellerAccountMutationResponse>('/api/v1/seller/account/shop-cover', { method: 'DELETE' });
      if (!isCurrent()) return;
      applyResponse(response);
      setShopCover(null);
    } catch (error) { if (!isCurrent()) return; fail(error); } finally { setBusy(null); }
  }
  return {
    feedbackAction,
    updateSeller,
    passwordSession,
    account,
    setAccount,
    profile,
    setProfile,
    storefront,
    setStorefront,
    email,
    setEmail,
    emailPassword,
    setEmailPassword,
    photo,
    setPhoto,
    shopCover,
    setShopCover,
    coverProgress,
    setCoverProgress,
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
    saveProfile,
    saveStorefront,
    saveEmail,
    choosePhoto,
    uploadPhoto,
    removePhoto,
    chooseShopCover,
    uploadShopCover,
    removeShopCover,
  };
}
