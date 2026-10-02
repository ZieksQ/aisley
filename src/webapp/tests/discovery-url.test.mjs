import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseSearchParameters, parseShopParameters, parseShopDirectoryParameters, searchHref, shopProductsHref } from '../src/lib/marketplace/discovery-url.ts';

test('search URLs default to Products and preserve the selected mode without silently truncating', () => {
  assert.deepEqual(parseSearchParameters({ q: ' Canvas ' }), { query: 'Canvas', mode: 'products', page: 1, error: null });
  assert.equal(parseSearchParameters({ q: 'Canvas', type: 'shops', page: '10000' }).error, null);
  assert.equal(parseSearchParameters({ q: '😀'.repeat(100), type: 'shops' }).error, null);
  const oversized = parseSearchParameters({ q: 'x'.repeat(101) });
  assert.equal(oversized.query.length, 101);
  assert.ok(oversized.error);
  for (const input of [{ q: ['a', 'b'] }, { type: ['shops', 'shops'] }, { type: 'other' }, { page: ['1', '2'] }, { page: '0' }, { page: '1.5' }, { page: '10001' }, { sort: 'recent' }]) {
    assert.ok(parseSearchParameters(input).error, JSON.stringify(input));
  }
  assert.equal(searchHref('100%_! & canvas', 'shops', 2), '/search?type=shops&q=100%25_%21+%26+canvas&page=2');
  assert.equal(searchHref('Canvas', 'shops'), '/search?type=shops&q=Canvas');
});

test('Shop URLs combine keyword/category, omit page one and reject malformed scalar filters', () => {
  assert.deepEqual(parseShopParameters({ q: ' shirt ', category: 'clothing', page: '2' }), { query: 'shirt', category: 'clothing', page: 2, error: null });
  assert.equal(parseShopParameters({ q: '  ' }).query, '');
  for (const input of [{ q: ['a', 'b'] }, { category: ['a', 'b'] }, { category: '' }, { page: '01' }, { limit: '20' }, { q: 'x'.repeat(101) }]) {
    assert.ok(parseShopParameters(input).error, JSON.stringify(input));
  }
  assert.equal(shopProductsHref('canvas', 'shirt', 'clothing', 2), '/shops/canvas?q=shirt&category=clothing&page=2');
  assert.equal(shopProductsHref('canvas', '', 'clothing'), '/shops/canvas?category=clothing');
  assert.equal(shopProductsHref('canvas', 'shirt', null), '/shops/canvas?q=shirt');
  assert.equal(shopProductsHref('canvas', '', null), '/shops/canvas');
});

test('directory URL parsing does not silently drop repeated categories or normalize malformed pages', () => {
  assert.deepEqual(parseShopDirectoryParameters({ shop_category: 'clothing', page: '2' }), { category: 'clothing', page: 2, error: null });
  for (const input of [{ shop_category: ['clothing', 'other'] }, { page: ['1', '2'] }, { page: '1.0' }, { q: 'shirt' }]) {
    assert.ok(parseShopDirectoryParameters(input).error, JSON.stringify(input));
  }
});
