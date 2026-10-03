import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createHomepageRequestGuard, discoveryOwner, publicHomepageData } from '../src/lib/marketplace/homepage-session.ts';
import { discoveryStorageKey, discoverySignature, readDiscovery, saveDiscovery, pruneDiscoveryStorage } from '../src/lib/marketplace/discovery-storage.ts';

const card = { id: 'product-1', title: 'Canvas', price: 120, thumbnailUrl: null, averageRating: null, reviewCount: 0, soldCount: 0, shop: { id: 'shop-1', name: 'Shop' }, badges: [] };
const feed = { items: [card], nextCursor: 'cursor-1', pageSize: 20 };
const owner = 'customer:customer-a';
const saved = { owner, cursor: null, items: [card], feedSignature: discoverySignature(feed), pageSize: 20, maxItems: 120, scrollY: 420 };

function storage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test('Customer ID scopes personalization; unresolved authentication has no owner', () => {
  assert.equal(discoveryOwner({ status: 'loading' }), null);
  assert.equal(discoveryOwner({ status: 'guest' }), 'guest');
  assert.notEqual(discoveryOwner({ status: 'authenticated', customer: { id: 'a' } }), discoveryOwner({ status: 'authenticated', customer: { id: 'b' } }));
});

test('the public fallback strips private identity/history and never reuses personalized recommendations', () => {
  const initial = { viewer: { isAuthenticated: true, email: 'private@example.test', displayName: 'Private', deliveryLocation: { id: 'address' } }, recentlyViewed: [card], recommendations: feed, categories: ['public'] };
  const result = publicHomepageData(initial);
  assert.deepEqual(result.viewer, { isAuthenticated: false, displayName: null, email: null, deliveryLocation: null, cartItemCount: 0 });
  assert.deepEqual(result.recentlyViewed, []);
  assert.deepEqual(result.recommendations, { items: [], nextCursor: null, pageSize: 20 });
  assert.deepEqual(result.categories, ['public']);
  assert.equal(publicHomepageData({ ...initial, viewer: { isAuthenticated: false } }).recommendations, feed);
  assert.equal(initial.viewer.isAuthenticated, true, 'Fallback must not mutate SSR props');
});

test('session changes reject old successful/error/finally work before effect cleanup, including A to B to A', () => {
  let revision = 1;
  const guard = createHomepageRequestGuard(revision, () => revision);
  const ticket = guard.start();
  assert.equal(ticket.isCurrent(), true);
  revision = 2;
  assert.equal(ticket.isCurrent(), false);
  assert.equal(guard.start(), null, 'An obsolete callback must not issue or cancel a new-session request');
  const newGuard = createHomepageRequestGuard(revision, () => revision);
  const newTicket = newGuard.start();
  ticket.finish();
  assert.equal(newTicket.isCurrent(), true);
  assert.equal(newGuard.pending(), true);
  revision = 3;
  assert.equal(ticket.isCurrent(), false, 'Returning to the same account must not revive the old session');
  assert.equal(newTicket.isCurrent(), false);
});

test('overlapping Homepage refreshes apply only the latest request and old completion cannot release its successor', () => {
  const guard = createHomepageRequestGuard(1, () => 1);
  const first = guard.start();
  const second = guard.start();
  assert.equal(first.signal.aborted, true);
  assert.equal(first.isCurrent(), false);
  first.finish();
  assert.equal(guard.pending(), true);
  assert.equal(second.isCurrent(), true);
  second.finish();
  assert.equal(guard.pending(), false);
});

test('cancel/unmount invalidates load-more reads even if a transport ignores abort, and supports Strict Mode restart', () => {
  const guard = createHomepageRequestGuard(1, () => 1);
  const first = guard.start();
  guard.cancel();
  assert.equal(first.isCurrent(), false);
  assert.equal(first.signal.aborted, true);
  assert.equal(guard.pending(), false);
  assert.equal(guard.start().isCurrent(), true);
});

test('discovery restoration is account-keyed and keeps null exhausted cursors', () => {
  globalThis.window = { sessionStorage: storage() };
  try {
    saveDiscovery(saved);
    assert.notEqual(discoveryStorageKey(owner), discoveryStorageKey('customer:customer-b'));
    assert.equal(readDiscovery('customer:customer-b', saved.feedSignature, 20, 120), null);
    assert.deepEqual(readDiscovery(owner, saved.feedSignature, 20, 120), saved);
    assert.equal(readDiscovery(owner, 'other-feed', 20, 120), null);
    assert.equal(window.sessionStorage.getItem(discoveryStorageKey(owner)), null);
  } finally { delete globalThis.window; }
});

test('identity changes remove old-account and legacy discovery data without touching unrelated browser state', () => {
  globalThis.window = { sessionStorage: storage() };
  try {
    saveDiscovery(saved);
    saveDiscovery({ ...saved, owner: 'customer:customer-b' });
    window.sessionStorage.setItem('aisley:homepage-discovery:v2', 'old unscoped feed');
    window.sessionStorage.setItem('unrelated', 'keep');
    pruneDiscoveryStorage('customer:customer-b');
    assert.equal(window.sessionStorage.getItem(discoveryStorageKey(owner)), null);
    assert.notEqual(window.sessionStorage.getItem(discoveryStorageKey('customer:customer-b')), null);
    assert.equal(window.sessionStorage.getItem('aisley:homepage-discovery:v2'), null);
    pruneDiscoveryStorage('guest');
    assert.equal(window.sessionStorage.getItem(discoveryStorageKey('customer:customer-b')), null);
    assert.equal(window.sessionStorage.getItem('unrelated'), 'keep');
  } finally { delete globalThis.window; }
});

test('wrong-owner, corrupt and out-of-bounds restoration is ignored safely', () => {
  globalThis.window = { sessionStorage: storage() };
  try {
    for (const value of [null, { ...saved, owner: 'customer:customer-b' }, { ...saved, items: [null] }, { ...saved, items: Array(121).fill(card) }, { ...saved, scrollY: -1 }, { ...saved, cursor: 'x'.repeat(2049) }, { ...saved, pageSize: 50 }]) {
      window.sessionStorage.setItem(discoveryStorageKey(owner), JSON.stringify(value));
      assert.equal(readDiscovery(owner, saved.feedSignature, 20, 120), null);
    }
    window.sessionStorage.setItem(discoveryStorageKey(owner), '{invalid');
    assert.equal(readDiscovery(owner, saved.feedSignature, 20, 120), null);
  } finally { delete globalThis.window; }
});

test('blocked storage never breaks reading, saving or cleanup', () => {
  globalThis.window = { get sessionStorage() { throw new Error('Storage blocked'); } };
  try {
    assert.equal(readDiscovery(owner, saved.feedSignature, 20, 120), null);
    assert.doesNotThrow(() => saveDiscovery(saved));
    assert.doesNotThrow(() => pruneDiscoveryStorage(null));
  } finally { delete globalThis.window; }
});
