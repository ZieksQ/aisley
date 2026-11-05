// Synthetic data for browser verification. No real accounts or external API calls.
import { useSyncExternalStore } from 'react';
import { createPasswordChangeSession } from '@aisley/ui/password-change';

export class ApiError extends Error {
  constructor(public status: number, public payload: any, public retryAfter?: string) {
    super(payload.message);
  }
  get errors() { return this.payload.errors ?? {}; }
  get body() { return this.payload; }
}
export const firstFieldError = (error: any, field: string) => error?.errors?.[field]?.[0];
const role = new URLSearchParams(location.search).get('role') ?? 'seller';
const profile = {
  first_name: 'Mara', last_name: 'Santos', middle_name: 'Reyes', contact_number: '09171234567',
  sex: 'female', birth_date: '1995-05-14', age: 31, profile_photo_url: null,
  firstName: 'Mara', lastName: 'Santos', middleName: 'Reyes', contactNumber: '09171234567',
  birthDate: '1995-05-14', profilePhotoUrl: null, idImageUrl: null,
};
let account: any = {
  id: role + '-fixture', email: 'mara.santos@example.test', role, status: 'active', profile,
  shop: {
    id: 'shop-fixture', name: 'Santos Everyday', slug: 'santos-everyday', status: 'active',
    description: 'Thoughtful essentials for everyday living.', contact_email: 'hello@santos.example.test',
    contact_number: '09171234567', website: 'https://santos.example.test', cover_url: null,
    is_on_vacation: false, vacation_message: '',
  },
  organization: { id: 'organization-fixture', business_name: 'Santos Express' },
  hub: {
    id: 'hub-fixture', name: 'Quezon City hub',
    address: {
      address_line_1: '18 Maginhawa Street', barangay: 'Teachers Village', city_municipality: 'Quezon City',
      province: 'Metro Manila', region: 'NCR', postal_code: '1101', country: 'Philippines',
    },
    location: { latitude: 14.64, longitude: 121.06, expected_updated_at: '2026-11-05T00:00:00Z' },
  },
  security: {
    email_editable: false, password_change_requires_current_password: true, organization_editable: true,
    hub_name_editable: true, hub_address_editable: false, hub_location_editable: true,
  },
};
const session = createPasswordChangeSession();
session.setIdentity(account.id);
const fixture: any = {
  navigation: crypto.randomUUID(), writes: [], authUpdates: [], mode: new URLSearchParams(location.search).get('mode') ?? 'normal',
};
(window as any).fixture = fixture;
let revision = 0;
const listeners = new Set<() => void>();
const update = (value: any) => fixture.authUpdates.push(value.id);
const auth = {
  admin: account, seller: account, logistics: account, auth: { status: 'authenticated', customer: account },
  passwordSession: session, updateAdmin: update, updateSeller: update, setAuthenticatedCustomer: update,
  refresh: async () => {}, logout: async () => {},
};
const subscribe = (callback: () => void) => { listeners.add(callback); return () => { listeners.delete(callback); }; };
export function useAuth() { useSyncExternalStore(subscribe, () => revision); return auth; }
fixture.switchIdentity = () => {
  account = { ...account, id: role + '-next', profile: { ...account.profile, first_name: 'Lia', firstName: 'Lia' } };
  Object.assign(auth, { admin: account, seller: account, logistics: account, auth: { status: 'authenticated', customer: account } });
  session.setIdentity(account.id);
  revision++;
  listeners.forEach((callback) => callback());
};
const response = (value = account) => ({ account: value, message: 'Changes saved.', admin: value, seller: value, customer: value });
export async function apiRequest(path: string, options: any = {}) {
  if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  if (fixture.mode === 'load-error' && !options.method) throw new ApiError(503, { message: 'Account settings could not be loaded.' });
  if (path.includes('pickup-addresses')) return { data: [] };
  if (!options.method) {
    if (path.includes('notification-preferences')) return { data: { promotional_in_app_opted_in: false, promotional_in_app_opted_in_at: null } };
    return response();
  }
  fixture.writes.push({ path, ...options });
  if (fixture.mode === 'validation') throw new ApiError(422, {
    message: 'Please correct the highlighted fields.',
    errors: { first_name: ['Enter your first name.'], current_password: ['Your password is incorrect.'], photo: ['This image was rejected.'], id_image: ['This image was rejected.'] },
  });
  if (fixture.mode === 'conflict' && path.endsWith('/hub-location')) throw new ApiError(409, { message: 'The hub location changed.' });
  const actor = account;
  if (fixture.mode === 'pending') await new Promise((done) => { fixture.resolve = done; });
  if (actor.id !== account.id) return response(actor);
  if (path.endsWith('/profile-photo')) {
    const photoUrl = options.method === 'DELETE' ? null : '/api/v1/' + role + '/account/profile-photo?v=' + fixture.writes.length;
    account = { ...account, profile: { ...account.profile, profile_photo_url: photoUrl, profilePhotoUrl: photoUrl } };
  }
  if (path.endsWith('/id-image')) {
    account = { ...account, profile: { ...account.profile, idImageUrl: options.method === 'DELETE' ? null : '/api/v1/customer/account/id-image?v=1' } };
  }
  if (path.endsWith('/profile')) {
    const payload = JSON.parse(options.body);
    account = { ...account, profile: { ...account.profile, ...payload, firstName: payload.first_name ?? profile.firstName } };
  }
  if (path.endsWith('/storefront')) account = { ...account, shop: { ...account.shop, ...JSON.parse(options.body) } };
  if (path.endsWith('/organization')) {
    const payload = JSON.parse(options.body);
    account = { ...account, organization: { ...account.organization, business_name: payload.business_name }, hub: { ...account.hub, name: payload.hub_name } };
  }
  if (path.endsWith('/notification-preferences')) return { data: JSON.parse(options.body) };
  return response();
}
export const request = apiRequest;
export const apiAssetUrl = (path: string) => path;
export const apiUrl = (path: string) => path;
export const initializeCsrf = async () => {};
export const csrf = initializeCsrf;
export const apiBlobRequest = async () => new Blob([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aY1sAAAAASUVORK5CYII='), (char) => char.charCodeAt(0))], { type: 'image/png' });
export const blob = apiBlobRequest;
export const uploadForm = async (path: string, body: any, progress: any) => { progress?.(50); return apiRequest(path, { method: 'POST', body }); };
export const requestPasswordCode = async () => {
  fixture.writes.push({ path: '/account/password/verification-code' });
  return { data: { challenge_id: 'fixture-challenge', masked_email: 'm***@example.test', expires_at: new Date(Date.now() + 600000).toISOString(), resend_available_at: new Date(Date.now() + 60000).toISOString() } };
};
export const updatePassword = async () => {
  fixture.writes.push({ path: '/account/password' });
  if (fixture.mode === 'password-uncertain') throw new ApiError(503, { message: 'The response could not be confirmed.' });
  return { message: 'Password updated.' };
};
export const fetchCustomerAccount = (signal: any) => apiRequest('/api/v1/customer/account', { signal });
export const updateCustomerProfile = (payload: any) => apiRequest('/api/v1/customer/account/profile', { method: 'PATCH', body: JSON.stringify(payload) });
export const requestCustomerPasswordCode = requestPasswordCode;
export const updateCustomerPassword = updatePassword;
export const uploadCustomerProfilePhoto = (file: any, progress: any) => uploadForm('/api/v1/customer/account/profile-photo', file, progress);
export const removeCustomerProfilePhoto = () => apiRequest('/api/v1/customer/account/profile-photo', { method: 'DELETE' });
export const uploadCustomerIdImage = (file: any, progress: any) => uploadForm('/api/v1/customer/account/id-image', file, progress);
export const removeCustomerIdImage = () => apiRequest('/api/v1/customer/account/id-image', { method: 'DELETE' });
