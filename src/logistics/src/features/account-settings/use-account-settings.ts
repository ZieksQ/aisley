import { useAccountLifetime } from "@aisley/ui/account-settings";
import type { ChangeEvent, FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { type HubCoordinates } from '../../components/HubLocationPicker';
import { ApiError, request, uploadForm } from '../../lib/api';
import type { AccountResponse, LogisticsAccount } from '../../types/account';
type ProfileForm = {
  first_name: string;
  middle_name: string;
  last_name: string;
  contact_number: string;
  sex: string;
  birth_date: string;
};
type OrganizationForm = { business_name: string; hub_name: string; };
type Errors = Record<string, string[]>;
const emptyProfile: ProfileForm = { first_name: '', middle_name: '', last_name: '', contact_number: '', sex: '', birth_date: '' };
const emptyOrganization: OrganizationForm = { business_name: '', hub_name: '' };
function formError(caught: unknown, fallback: string): { message: string; errors: Errors; } {
  if (!(caught instanceof ApiError)) return { message: fallback, errors: {} };
  if (caught.status === 409) return { message: 'This account changed while you were editing. Reload the latest values and try again.', errors: caught.errors };
  if (caught.status === 422) return { message: Object.keys(caught.errors).length ? 'Please correct the highlighted fields.' : caught.message, errors: caught.errors };
  if (caught.status === 429) return { message: 'Too many attempts. Wait a moment before trying again.', errors: caught.errors };
  if (caught.status === 403) return { message: 'This account is not allowed to change these settings.', errors: caught.errors };
  return {
    message: caught.message || fallback,
    errors: caught.errors,
  };
}
export function useAccountSettings() {
  const isCurrent = useAccountLifetime();
  const { logout, refresh, passwordSession } = useAuth();
  const navigate = useNavigate();
  const [account, setAccount] = useState<LogisticsAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileForm>(emptyProfile);
  const [organization, setOrganization] = useState<OrganizationForm>(emptyOrganization);
  const [profileErrors, setProfileErrors] = useState<Errors>({});
  const [organizationErrors, setOrganizationErrors] = useState<Errors>({});
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [organizationMessage, setOrganizationMessage] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [organizationSaving, setOrganizationSaving] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoProgress, setPhotoProgress] = useState(0);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoMessage, setPhotoMessage] = useState<string | null>(null);
  const [hubLocation, setHubLocation] = useState<HubCoordinates | null>(null);
  const [hubLocationConfirmed, setHubLocationConfirmed] = useState(false);
  const [hubLocationReason, setHubLocationReason] = useState('');
  const [hubLocationError, setHubLocationError] = useState<string | null>(null);
  const [hubLocationMessage, setHubLocationMessage] = useState<string | null>(null);
  const [hubLocationSaving, setHubLocationSaving] = useState(false);
  const geoapifyApiKey = import.meta.env.GEOAPIFY_API_KEY ?? '';
  useEffect(() => { document.title = 'Account settings | Aisley'; }, []);
  function applyAccount(next: LogisticsAccount, reset: 'all' | 'profile' | 'organization' | 'hub' | 'none' = 'all') {
    if (!isCurrent()) return;
    setAccount(next);
    if (reset === 'all' || reset === 'profile') setProfile({
      first_name: next.profile.first_name ?? '',
      middle_name: next.profile.middle_name ?? '',
      last_name: next.profile.last_name ?? '',
      contact_number: next.profile.contact_number ?? '',
      sex: next.profile.sex ?? '',
      birth_date: next.profile.birth_date ?? '',
    });
    if (reset === 'all' || reset === 'organization') setOrganization({
      business_name: next.organization.business_name ?? '',
      hub_name: next.hub.name ?? '',
    });
    if (reset === 'all' || reset === 'hub') {
    const location = next.hub.location;
    if (location && location.latitude !== null && location.longitude !== null) {
      setHubLocation({ latitude: location.latitude, longitude: location.longitude });
      setHubLocationConfirmed(true);
    } else {
      setHubLocation(null);
      setHubLocationConfirmed(false);
    }
    setHubLocationReason('');
    }
  }
  async function load() {
    setLoading(true);
    setLoadingError(null);
    try {
      const data = await request<AccountResponse>('/api/v1/logistics/account');
      if (!isCurrent()) return;
      applyAccount(data.account);
    } catch (caught) {
      if (!isCurrent()) return;
      if (caught instanceof ApiError && caught.status === 401) {
        await logout().catch(() => undefined);
        navigate('/login', { replace: true });
        return;
      }
      if (caught instanceof ApiError && caught.status === 404) setLoadingError('The approved Logistics profile or sole hub is unavailable. Contact an administrator.');
      else if (caught instanceof ApiError && caught.status === 403) setLoadingError('This Logistics account is not allowed to use account settings.');
      else setLoadingError(caught instanceof ApiError ? caught.message : 'We could not reach the API. Check that it is running and try again.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);
  function updateProfileField(field: keyof ProfileForm, value: string) {
    setProfile((current) => ({ ...current, [field]: value }));
  }
  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    event.currentTarget.value = '';
    setPhotoError(null);
    setPhotoMessage(null);
    setPhotoProgress(0);
    if (!selected) return;
    const parts = selected.name.toLowerCase().split('.');
    const extension = parts.at(-1);
    if (parts.length > 2 || !extension || !['jpg', 'jpeg', 'png', 'webp'].includes(extension)) {
      setPhoto(null);
      setPhotoError('Choose a JPEG, PNG, or WebP image with one file extension.');
      return;
    }
    if (selected.size >= 10 * 1024 * 1024) {
      setPhoto(null);
      setPhotoError('The profile photo must be smaller than 10 MB.');
      return;
    }
    setPhoto(selected);
  }
  async function uploadPhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (photoBusy) return;
    if (!photo) return;
    setPhotoBusy(true);
    setPhotoError(null);
    setPhotoMessage(null);
    try {
      const body = new FormData();
      body.append('photo', photo);
      const data = await uploadForm<AccountResponse>('/api/v1/logistics/account/profile-photo', body, setPhotoProgress);
      if (!isCurrent()) return;
      applyAccount(data.account, 'none');
      await refresh().catch(() => undefined);
      setPhoto(null);
      setPhotoMessage(data.message ?? 'Profile photo updated successfully.');
    } catch (caught) {
      if (!isCurrent()) return;
      if (caught instanceof ApiError && caught.status === 401) { await logout().catch(() => undefined); navigate('/login', { replace: true }); return; }
      const result = formError(caught, 'We could not upload your profile photo. Try again.');
      setPhotoError(result.errors.photo?.[0] ?? result.message);
    } finally { setPhotoBusy(false); }
  }
  async function removePhoto() {
    if (!account?.profile.profile_photo_url || photoBusy) return;
    setPhotoBusy(true);
    setPhotoError(null);
    setPhotoMessage(null);
    try {
      const data = await request<AccountResponse>('/api/v1/logistics/account/profile-photo', { method: 'DELETE' });
      if (!isCurrent()) return;
      applyAccount(data.account, 'none');
      await refresh().catch(() => undefined);
      setPhotoMessage(data.message ?? 'Profile photo removed successfully.');
    } catch (caught) {
      if (!isCurrent()) return;
      if (caught instanceof ApiError && caught.status === 401) { await logout().catch(() => undefined); navigate('/login', { replace: true }); return; }
      const result = formError(caught, 'We could not remove your profile photo. Try again.');
      setPhotoError(result.message);
    } finally { setPhotoBusy(false); }
  }
  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (profileSaving) return;
    setProfileErrors({});
    setProfileMessage(null);
    setProfileSaving(true);
    try {
      const data = await request<AccountResponse>('/api/v1/logistics/account/profile', { method: 'PATCH', body: JSON.stringify(profile) });
      if (!isCurrent()) return;
      applyAccount(data.account, 'profile');
      await refresh().catch(() => undefined);
      setProfileMessage(data.message ?? 'Profile updated successfully.');
    } catch (caught) {
      if (!isCurrent()) return;
      if (caught instanceof ApiError && caught.status === 401) { await logout().catch(() => undefined); navigate('/login', { replace: true }); return; }
      const result = formError(caught, 'We could not save your profile. Try again.');
      setProfileErrors(result.errors);
      setProfileMessage(result.message);
    } finally { setProfileSaving(false); }
  }
  async function saveOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (organizationSaving) return;
    setOrganizationErrors({});
    setOrganizationMessage(null);
    setOrganizationSaving(true);
    try {
      const data = await request<AccountResponse>('/api/v1/logistics/account/organization', { method: 'PATCH', body: JSON.stringify(organization) });
      if (!isCurrent()) return;
      applyAccount(data.account, 'organization');
      await refresh().catch(() => undefined);
      setOrganizationMessage(data.message ?? 'Organization details updated successfully.');
    } catch (caught) {
      if (!isCurrent()) return;
      if (caught instanceof ApiError && caught.status === 401) { await logout().catch(() => undefined); navigate('/login', { replace: true }); return; }
      const result = formError(caught, 'We could not save organization details. Try again.');
      setOrganizationErrors(result.errors);
      setOrganizationMessage(result.message);
    } finally { setOrganizationSaving(false); }
  }
  async function saveHubLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (hubLocationSaving) return;
    setHubLocationError(null); setHubLocationMessage(null);
    if (!account) return;
    if (!hubLocation || !hubLocationConfirmed) { setHubLocationError('Choose the exact hub pin and confirm it before saving.'); return; }
    if (!account.hub.location?.expected_updated_at) { setHubLocationError('The hub location revision is unavailable. Reload the account and try again.'); return; }
    if (hubLocationReason.trim().length < 3) { setHubLocationError('Give a short reason for this same-premises pin correction.'); return; }
    setHubLocationSaving(true);
    try {
      const data = await request<AccountResponse>('/api/v1/logistics/account/hub-location', { method: 'PUT', body: JSON.stringify({ latitude: hubLocation.latitude, longitude: hubLocation.longitude, expected_updated_at: account.hub.location.expected_updated_at, reason: hubLocationReason.trim() }) });
      if (!isCurrent()) return;
      applyAccount(data.account, 'hub'); await refresh().catch(() => undefined); setHubLocationMessage(data.message ?? 'Hub location updated successfully.');
    } catch (caught) {
      if (!isCurrent()) return;
      if (caught instanceof ApiError && caught.status === 401) { await logout().catch(() => undefined); navigate('/login', { replace: true }); return; }
      if (caught instanceof ApiError && caught.status === 409) { setHubLocationError('This hub location changed in another session. Reloaded the latest pin; review it and try again.'); await load(); return; }
      const result = formError(caught, 'We could not save the hub location. Try again.');
      setHubLocationError(result.message);
    } finally { setHubLocationSaving(false); }
  }
  return {
    logout,
    refresh,
    passwordSession,
    navigate,
    account,
    setAccount,
    loading,
    setLoading,
    loadingError,
    setLoadingError,
    profile,
    setProfile,
    organization,
    setOrganization,
    profileErrors,
    setProfileErrors,
    organizationErrors,
    setOrganizationErrors,
    profileMessage,
    setProfileMessage,
    organizationMessage,
    setOrganizationMessage,
    profileSaving,
    setProfileSaving,
    organizationSaving,
    setOrganizationSaving,
    photo,
    setPhoto,
    photoProgress,
    setPhotoProgress,
    photoBusy,
    setPhotoBusy,
    photoError,
    setPhotoError,
    photoMessage,
    setPhotoMessage,
    hubLocation,
    setHubLocation,
    hubLocationConfirmed,
    setHubLocationConfirmed,
    hubLocationReason,
    setHubLocationReason,
    hubLocationError,
    setHubLocationError,
    hubLocationMessage,
    setHubLocationMessage,
    hubLocationSaving,
    setHubLocationSaving,
    geoapifyApiKey,
    applyAccount,
    load,
    updateProfileField,
    choosePhoto,
    uploadPhoto,
    removePhoto,
    saveProfile,
    saveOrganization,
    saveHubLocation,
  };
}
