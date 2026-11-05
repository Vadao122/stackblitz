import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext } from './helpers/test-context.js';
import {
  assertErrorShape,
  assertValidationError,
} from './helpers/assertions.js';
import { makeItemPayload } from './fixtures/items.js';

describe('Items API error handling', () => {
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

  it('should return 404 when getting an item that does not exist', async () => {
    const response = await ctx.request('GET', '/items/999999');

    assert.equal(response.status, 404);
    assertErrorShape(response.body, 'NOT_FOUND');
    assert.equal(response.body.error.message, 'Предмет не найден');
  });

  it('should return 404 when updating an item that does not exist', async () => {
    const response = await ctx.request('PATCH', '/items/999999', {
      json: { name: 'Несуществующий' },
    });

    assert.equal(response.status, 404);
    assertErrorShape(response.body, 'NOT_FOUND');
    assert.equal(response.body.error.message, 'Предмет не найден');

    const { count } = await ctx.linker.get(
      'select count(*) as count from item'
    );
    assert.equal(count, 0);
  });

  it('should return 404 when deleting an item that does not exist', async () => {
    const response = await ctx.request('DELETE', '/items/999999');

    assert.equal(response.status, 404);
    assertErrorShape(response.body, 'NOT_FOUND');
    assert.equal(response.body.error.message, 'Предмет не найден');
  });

  it('should return 404 when deleting an item twice', async () => {
    const item = await createItem();

    const first = await ctx.request('DELETE', `/items/${item.id}`);
    const second = await ctx.request('DELETE', `/items/${item.id}`);

    assert.equal(first.status, 204);
    assert.equal(second.status, 404);
    assertErrorShape(second.body, 'NOT_FOUND');

    const row = await ctx.linker.get('select * from item where id = ?', [
      item.id,
    ]);
    assert.ok(row);
    assert.equal(row.is_deleted, 1);
  });

  it('should return 404 when getting an item that was soft-deleted', async () => {
    const item = await createItem();
    await ctx.request('DELETE', `/items/${item.id}`);

    const response = await ctx.request('GET', `/items/${item.id}`);

    assert.equal(response.status, 404);
    assertErrorShape(response.body, 'NOT_FOUND');
  });

  for (const method of ['GET', 'PATCH', 'DELETE']) {
    it(`should return 400 when ${method} receives a non-numeric id`, async () => {
      const response = await ctx.request(
        method,
        '/items/not-a-number',
        method === 'PATCH' ? { json: { name: 'Новое имя' } } : {}
      );

      assert.equal(response.status, 400);
      assertValidationError(response.body);
      assert.equal(
        response.body.error.message,
        'id должен быть положительным целым числом'
      );
    });
  }

  it('should return 400 when id is zero', async () => {
    const response = await ctx.request('GET', '/items/0');

    assert.equal(response.status, 400);
    assertValidationError(response.body);
    assert.match(response.body.error.message, /id/);
  });

  it('should return 400 when id is negative', async () => {
    const response = await ctx.request('DELETE', '/items/-1');

    assert.equal(response.status, 400);
    assertValidationError(response.body);
    assert.match(response.body.error.message, /id/);
  });

  it('should return 405 when PUT is used because the API supports PATCH only', async () => {
    const item = await createItem();

    const response = await ctx.request('PUT', `/items/${item.id}`, {
      json: { name: 'Через PUT' },
    });

    assert.equal(response.status, 405);

    const allow = response.headers.get('allow');
    assert.ok(allow, 'ответ 405 должен содержать заголовок Allow');
    assert.match(allow, /GET/);
    assert.match(allow, /PATCH/);
    assert.match(allow, /DELETE/);
    assert.doesNotMatch(allow, /PUT/);
  });

  it('should return 404 when the route is unknown', async () => {
    const response = await ctx.request('GET', '/unknown-route');

    assert.equal(response.status, 404);
    assertErrorShape(response.body, 'NOT_FOUND');
    assert.equal(response.body.error.message, 'Маршрут не найден');
  });

  it('should return 400 and keep the row unchanged when PATCH JSON is malformed', async () => {
    const item = await createItem();
    const rowBefore = await ctx.linker.get('select * from item where id = ?', [
      item.id,
    ]);

    const response = await ctx.request('PATCH', `/items/${item.id}`, {
      rawBody: '{"name":',
      headers: { 'content-type': 'application/json' },
    });

    assert.equal(response.status, 400);
    assertErrorShape(response.body, 'BAD_REQUEST');

    const rowAfter = await ctx.linker.get('select * from item where id = ?', [
      item.id,
    ]);
    assert.deepEqual(rowAfter, rowBefore);
  });

  it('should return a consistent error envelope when validation fails', async () => {
    const response = await ctx.request('POST', '/items', {
      json: { name: '' },
    });

    assert.equal(response.status, 400);
    assertErrorShape(response.body, 'VALIDATION_ERROR');
    assert.ok(Array.isArray(response.body.error.details));
    assert.equal('data' in response.body, false);
  });

  // Известное ограничение текущей реализации: нарушение FK возвращает 500.
  it.todo(
    'should return 400 when location_id references a missing location (currently returns 500)'
  );
});
