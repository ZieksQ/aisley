// Installed before real portal code runs; no requests reach a live API.
export function installFixture(role) {
  const nativeFetch = window.fetch;
  const profile = { first_name: 'Mara', last_name: 'Santos', middle_name: null, contact_number: '09171234567', sex: 'female', birth_date: '1995-05-14', profile_photo_url: null };
  const actor = { id: `${role}-fixture`, email: 'mara@example.test', role, status: 'active', profile, permissions: ['finance.view', 'notifications.view'], roles: [], setup_required: false,
    shop: { id: 'shop-fixture', name: 'Everyday supplies', slug: 'everyday', status: 'active', description: '', contact_email: '', contact_number: '', website: '', cover_url: null, is_on_vacation: false, vacation_message: '' } };
  window.settingsFixture = { navigation: crypto.randomUUID(), actor, required: false, accepted: false, accountError: false, calls: [] };
  const fixture = window.settingsFixture;
  const policies = () => ['terms_of_service', 'privacy_policy'].map(type => ({ type, label: type === 'terms_of_service' ? 'Terms of Service' : 'Privacy Policy', required: true, accepted: !fixture.required || fixture.accepted, accepted_at: fixture.accepted ? '2026-11-06T00:00:00Z' : null,
    current_version: { id: type, version: 1, title: type === 'terms_of_service' ? 'Terms of Service' : 'Privacy Policy', published_at: '2026-11-06T00:00:00Z', requires_reconsent: true }, accepted_version: null }));
  const status = () => ({ policies: policies(), all_required_accepted: !fixture.required || fixture.accepted });
  window.fetch = async (url, options = {}) => {
    const path = new URL(url, location.origin).pathname;
    if (!path.startsWith('/api/') && !path.startsWith('/sanctum/')) return nativeFetch(url, options);
    fixture.calls.push({ path, method: options.method ?? 'GET' });
    let payload = { data: [], meta: { unread_count: 0, total: 0 } };
    let code = 200;
    if (path.endsWith('/auth/me')) payload = { [role]: fixture.actor };
    else if (path.endsWith('/auth/logout')) payload = {};
    else if (path.endsWith('/policy-consent/status')) payload = { data: status() };
    else if (path.endsWith('/policy-consent/accept')) { fixture.accepted = true; payload = { data: { acceptances: [], status: status() } }; }
    else if (path.includes('/platform/policies/')) {
      const type = path.split('/').at(-1);
      payload = { data: { type, label: policies().find(p => p.type === type)?.label, version: { id: type, version: 1, title: policies().find(p => p.type === type)?.label, content: 'Read these policies before continuing.\n\nYour account and personal information are protected.', status: 'published', published_at: '2026-11-06T00:00:00Z' } } };
    } else if (path.endsWith('/account')) {
      if (fixture.accountError) { code = 503; payload = { message: 'Account unavailable. Try again.' }; }
      else payload = { account: fixture.actor };
    } else if (path.endsWith('/unread-count')) payload = { unread_count: 0 };
    return new Response(JSON.stringify(payload), { status: code, headers: { 'Content-Type': 'application/json' } });
  };
}
