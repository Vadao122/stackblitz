import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext } from './helpers/test-context.js';
import {
  assertErrorShape,
  assertItemShape,
  assertValidationError,
} from './helpers/assertions.js';
import { makeItemPayload } from './fixtures/items.js';

describe('Items API list, filters and pagination', () => {
  let ctx;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  afterEach(async () => {
    await ctx.close();
  });

  async function createItem(overrides = {}) {
    const response = await ctx.request('POST', '/items', {
      json: makeItemPayload(ctx.ids, overrides),
    });
    assert.equal(response.status, 201);
    return response.body.data;
  }

  it('should filter items by a single id when ids is provided', async () => {
    const first = await createItem({ name: 'Первый' });
    await createItem({ name: 'Второй' });

    const response = await ctx.request('GET', `/items?ids=${first.id}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 1);
    assert.equal(response.body.data[0].id, first.id);
    assert.equal(response.body.meta.total, 1);
  });

  it('should filter items by comma-separated ids when ids has multiple values', async () => {
    const first = await createItem({ name: 'Первый' });
    await createItem({ name: 'Второй' });
    const third = await createItem({ name: 'Третий' });

    const response = await ctx.request(
      'GET',
      `/items?ids=${first.id},${third.id}`
    );

    assert.equal(response.status, 200);
    assert.deepEqual(
      response.body.data.map((item) => item.id),
      [first.id, third.id]
    );
    assert.equal(response.body.meta.total, 2);
  });

  it('should filter items by repeated ids parameters', async () => {
    const first = await createItem({ name: 'Первый' });
    const second = await createItem({ name: 'Второй' });
    await createItem({ name: 'Третий' });

    const response = await ctx.request(
      'GET',
      `/items?ids=${first.id}&ids=${second.id}`
    );

    assert.equal(response.status, 200);
    assert.deepEqual(
      response.body.data.map((item) => item.id),
      [first.id, second.id]
    );
    assert.equal(response.body.meta.total, 2);
  });

  it('should deduplicate repeated ids when the same id is passed twice', async () => {
    const item = await createItem();

    const response = await ctx.request(
      'GET',
      `/items?ids=${item.id}&ids=${item.id}`
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 1);
    assert.equal(response.body.meta.total, 1);
  });

  it('should return an empty list when ids contains only unknown values', async () => {
    await createItem();

    const response = await ctx.request('GET', '/items?ids=999999');

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data, []);
    assert.equal(response.body.meta.total, 0);
  });

  it('should return 400 when ids contains a non-numeric value', async () => {
    const response = await ctx.request('GET', '/items?ids=abc');

    assert.equal(response.status, 400);
    assertValidationError(response.body);
    assert.match(response.body.error.message, /id/);
  });

  it('should return 400 when ids is empty', async () => {
    const response = await ctx.request('GET', '/items?ids=');

    assert.equal(response.status, 400);
    assertValidationError(response.body);
  });

  it('should filter items by status when status is provided', async () => {
    const onPlace = await createItem({ name: 'На месте', status: 'on_place' });
    const broken = await createItem({ name: 'Сломан', status: 'broken' });
    await createItem({ name: 'Открыт', status: 'unlocked' });

    const response = await ctx.request('GET', '/items?status=broken');

    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 1);
    assert.equal(response.body.data[0].id, broken.id);
    assert.notEqual(response.body.data[0].id, onPlace.id);
    assert.equal(response.body.meta.total, 1);
  });

  it('should filter items by category when categoryId is provided', async () => {
    const first = await createItem({
      name: 'Категория 1',
      category_id: ctx.ids.categoryId,
    });
    await createItem({
      name: 'Категория 2',
      category_id: ctx.ids.categoryId2,
    });

    const response = await ctx.request(
      'GET',
      `/items?categoryId=${ctx.ids.categoryId}`
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 1);
    assert.equal(response.body.data[0].id, first.id);
    assert.equal(response.body.meta.total, 1);
  });

  it('should match either location_id or current_location_id when locationId is provided', async () => {
    const item = await createItem({
      name: 'Перемещённый',
      location_id: ctx.ids.locationId,
      current_location_id: ctx.ids.locationId2,
    });

    const byCurrent = await ctx.request(
      'GET',
      `/items?locationId=${ctx.ids.locationId2}`
    );
    const byOriginal = await ctx.request(
      'GET',
      `/items?locationId=${ctx.ids.locationId}`
    );

    assert.equal(byCurrent.status, 200);
    assert.equal(byCurrent.body.data.length, 1);
    assert.equal(byCurrent.body.data[0].id, item.id);

    assert.equal(byOriginal.status, 200);
    assert.equal(byOriginal.body.data.length, 1);
    assert.equal(byOriginal.body.data[0].id, item.id);
  });

  it('should paginate items when page and limit are provided', async () => {
    const created = [];

    for (let index = 1; index <= 5; index += 1) {
      created.push(await createItem({ name: `Предмет ${index}` }));
    }

    const firstPage = await ctx.request('GET', '/items?page=1&limit=2');
    const secondPage = await ctx.request('GET', '/items?page=2&limit=2');
    const thirdPage = await ctx.request('GET', '/items?page=3&limit=2');

    assert.equal(firstPage.status, 200);
    assert.deepEqual(
      firstPage.body.data.map((item) => item.id),
      [created[0].id, created[1].id]
    );
    assert.deepEqual(firstPage.body.meta, { page: 1, limit: 2, total: 5 });

    assert.deepEqual(
      secondPage.body.data.map((item) => item.id),
      [created[2].id, created[3].id]
    );

    assert.deepEqual(
      thirdPage.body.data.map((item) => item.id),
      [created[4].id]
    );
    assert.deepEqual(thirdPage.body.meta, { page: 3, limit: 2, total: 5 });
  });

  it('should return an empty page when page exceeds the number of items', async () => {
    await createItem();
    await createItem();

    const response = await ctx.request('GET', '/items?page=5&limit=10');

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data, []);
    assert.deepEqual(response.body.meta, { page: 5, limit: 10, total: 2 });
  });

  it('should accept limit=200 when it is the maximum allowed value', async () => {
    const item = await createItem();

    const response = await ctx.request('GET', '/items?limit=200');

    assert.equal(response.status, 200);
    assert.equal(response.body.meta.limit, 200);
    assert.equal(response.body.data.length, 1);
    assert.equal(response.body.data[0].id, item.id);
  });

  it('should return 400 when limit exceeds 200', async () => {
    const response = await ctx.request('GET', '/items?limit=201');

    assert.equal(response.status, 400);
    assertValidationError(response.body);
    assert.match(response.body.error.message, /limit/);
  });

  it('should return 400 when page is zero', async () => {
    const response = await ctx.request('GET', '/items?page=0');

    assert.equal(response.status, 400);
    assertValidationError(response.body);
    assert.match(response.body.error.message, /page/);
  });

  it('should return 400 when limit is zero', async () => {
    const response = await ctx.request('GET', '/items?limit=0');

    assert.equal(response.status, 400);
    assertValidationError(response.body);
    assert.match(response.body.error.message, /limit/);
  });

  it('should return 400 when page is not an integer', async () => {
    const response = await ctx.request('GET', '/items?page=abc');

    assert.equal(response.status, 400);
    assertValidationError(response.body);
    assert.match(response.body.error.message, /page/);
  });

  it('should return 400 when status is unknown', async () => {
    const response = await ctx.request('GET', '/items?status=unknown');

    assert.equal(response.status, 400);
    assertValidationError(response.body);
    assert.match(response.body.error.message, /status/);
  });

  it('should return 400 when categoryId is invalid', async () => {
    const response = await ctx.request('GET', '/items?categoryId=abc');

    assert.equal(response.status, 400);
    assertValidationError(response.body);
    assert.match(response.body.error.message, /categoryId/);
  });

  it('should return 400 when locationId is invalid', async () => {
    const response = await ctx.request('GET', '/items?locationId=0');

    assert.equal(response.status, 400);
    assertValidationError(response.body);
    assert.match(response.body.error.message, /locationId/);
  });

  it('should ignore unknown query parameters when listing', async () => {
    const item = await createItem();

    const response = await ctx.request('GET', '/items?foo=bar');

    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 1);
    assert.equal(response.body.data[0].id, item.id);
  });

  it('should include deleted items when includeDeleted=1', async () => {
    const item = await createItem();
    await ctx.request('DELETE', `/items/${item.id}`);

    const response = await ctx.request('GET', '/items?includeDeleted=1');

    assert.equal(response.status, 200);
    assert.equal(response.body.meta.total, 1);
    assert.equal(response.body.data.length, 1);
    assert.equal(response.body.data[0].id, item.id);
    assertItemShape(response.body.data[0], { deleted: true });
  });

  it('should exclude deleted items when includeDeleted=false', async () => {
    const item = await createItem();
    await ctx.request('DELETE', `/items/${item.id}`);

    const response = await ctx.request('GET', '/items?includeDeleted=false');

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data, []);
    assert.equal(response.body.meta.total, 0);
  });

  it('should sort items by id ascending when returning the list', async () => {
    const first = await createItem({ name: 'Первый' });
    const second = await createItem({ name: 'Второй' });
    const third = await createItem({ name: 'Третий' });

    const response = await ctx.request('GET', '/items');

    assert.equal(response.status, 200);
    assert.deepEqual(
      response.body.data.map((item) => item.id),
      [first.id, second.id, third.id]
    );
  });

  it('should return an error envelope when a query parameter is invalid', async () => {
    const response = await ctx.request('GET', '/items?status=bad');

    assert.equal(response.status, 400);
    assertErrorShape(response.body, 'VALIDATION_ERROR');
    assert.equal(response.body.error.details, undefined);
  });
});
