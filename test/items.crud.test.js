import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext } from './helpers/test-context.js';
import { assertItemShape } from './helpers/assertions.js';
import { makeItemPayload } from './fixtures/items.js';

describe('Items CRUD API', () => {
  let ctx;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  afterEach(async () => {
    await ctx.close();
  });

  it('should create an item and persist it when the payload is valid', async () => {
    const payload = makeItemPayload(ctx.ids);
    const response = await ctx.request('POST', '/items', { json: payload });

    assert.equal(response.status, 201);
    assert.match(response.headers.get('content-type'), /application\/json/);
    assert.deepEqual(Object.keys(response.body), ['data']);
    assertItemShape(response.body.data);

    assert.equal(response.body.data.name, payload.name);
    assert.deepEqual(response.body.data.properties, payload.properties);
    assert.equal(response.body.data.status, payload.status);
    assert.equal(response.body.data.location_id, payload.location_id);
    assert.equal(
      response.body.data.current_location_id,
      payload.current_location_id
    );
    assert.equal(response.body.data.category_id, payload.category_id);

    const row = await ctx.linker.get('select * from item where id = ?', [
      response.body.data.id,
    ]);

    assert.ok(row, 'запись должна существовать в БД');
    assert.equal(row.name, payload.name);
    assert.equal(row.status, payload.status);
    assert.equal(row.location_id, payload.location_id);
    assert.equal(row.current_location_id, payload.current_location_id);
    assert.equal(row.category_id, payload.category_id);
    assert.equal(row.is_deleted, 0);
    assert.deepEqual(JSON.parse(row.properties), payload.properties);
  });

  it('should trim the name when it contains surrounding spaces', async () => {
    const response = await ctx.request('POST', '/items', {
      json: makeItemPayload(ctx.ids, { name: '  Ноутбук  ' }),
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.data.name, 'Ноутбук');

    const row = await ctx.linker.get('select name from item where id = ?', [
      response.body.data.id,
    ]);
    assert.equal(row.name, 'Ноутбук');
  });

  it('should default properties to an empty object when properties is omitted', async () => {
    const payload = makeItemPayload(ctx.ids);
    delete payload.properties;

    const response = await ctx.request('POST', '/items', { json: payload });

    assert.equal(response.status, 201);
    assert.deepEqual(response.body.data.properties, {});

    const row = await ctx.linker.get('select properties from item where id = ?', [
      response.body.data.id,
    ]);
    assert.equal(row.properties, '{}');
  });

  it('should return the created item by id when it exists', async () => {
    const created = await ctx.request('POST', '/items', {
      json: makeItemPayload(ctx.ids, { name: 'Найденный предмет' }),
    });

    const response = await ctx.request(
      'GET',
      `/items/${created.body.data.id}`
    );

    assert.equal(response.status, 200);
    assert.deepEqual(Object.keys(response.body), ['data']);
    assertItemShape(response.body.data);
    assert.equal(response.body.data.id, created.body.data.id);
    assert.equal(response.body.data.name, 'Найденный предмет');
  });

  it('should return a list with metadata when items exist', async () => {
    const created = [];

    for (const name of ['Предмет A', 'Предмет B', 'Предмет C']) {
      const response = await ctx.request('POST', '/items', {
        json: makeItemPayload(ctx.ids, { name }),
      });
      assert.equal(response.status, 201);
      created.push(response.body.data);
    }

    const response = await ctx.request('GET', '/items');

    assert.equal(response.status, 200);
    assert.ok(Array.isArray(response.body.data));
    assert.equal(response.body.data.length, 3);
    assert.deepEqual(response.body.meta, { page: 1, limit: 50, total: 3 });

    const returnedIds = response.body.data.map((item) => item.id);
    assert.deepEqual(
      returnedIds,
      [...returnedIds].sort((a, b) => a - b)
    );

    for (const item of response.body.data) {
      assertItemShape(item);
    }

    const { count } = await ctx.linker.get(
      'select count(*) as count from item'
    );
    assert.equal(count, created.length);
  });

  it('should update all supported fields when PATCH receives a full payload', async () => {
    const created = await ctx.request('POST', '/items', {
      json: makeItemPayload(ctx.ids),
    });
    const id = created.body.data.id;

    const update = {
      name: 'Обновлённый предмет',
      properties: { serial: 'XYZ-999', nested: { flag: true } },
      status: 'broken',
      location_id: ctx.ids.locationId2,
      current_location_id: ctx.ids.locationId2,
      category_id: ctx.ids.categoryId2,
    };

    const response = await ctx.request('PATCH', `/items/${id}`, {
      json: update,
    });

    assert.equal(response.status, 200);
    assert.deepEqual(Object.keys(response.body), ['data']);
    assertItemShape(response.body.data);
    assert.equal(response.body.data.id, id);
    assert.equal(response.body.data.name, update.name);
    assert.deepEqual(response.body.data.properties, update.properties);
    assert.equal(response.body.data.status, update.status);
    assert.equal(response.body.data.location_id, update.location_id);
    assert.equal(
      response.body.data.current_location_id,
      update.current_location_id
    );
    assert.equal(response.body.data.category_id, update.category_id);

    const row = await ctx.linker.get('select * from item where id = ?', [id]);
    assert.equal(row.name, update.name);
    assert.equal(row.status, update.status);
    assert.equal(row.location_id, update.location_id);
    assert.equal(row.current_location_id, update.current_location_id);
    assert.equal(row.category_id, update.category_id);
    assert.deepEqual(JSON.parse(row.properties), update.properties);
    assert.equal(row.is_deleted, 0);
  });

  it('should update only provided fields when PATCH receives a partial payload', async () => {
    const created = await ctx.request('POST', '/items', {
      json: makeItemPayload(ctx.ids, { name: 'Исходное имя' }),
    });
    const original = created.body.data;

    const response = await ctx.request('PATCH', `/items/${original.id}`, {
      json: { status: 'unlocked' },
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.status, 'unlocked');
    assert.equal(response.body.data.name, original.name);
    assert.deepEqual(response.body.data.properties, original.properties);
    assert.equal(response.body.data.location_id, original.location_id);
    assert.equal(
      response.body.data.current_location_id,
      original.current_location_id
    );
    assert.equal(response.body.data.category_id, original.category_id);

    const row = await ctx.linker.get('select * from item where id = ?', [
      original.id,
    ]);
    assert.equal(row.status, 'unlocked');
    assert.equal(row.name, original.name);
  });

  it('should soft delete an item when DELETE is called', async () => {
    const created = await ctx.request('POST', '/items', {
      json: makeItemPayload(ctx.ids),
    });
    const id = created.body.data.id;

    const response = await ctx.request('DELETE', `/items/${id}`);

    assert.equal(response.status, 204);
    assert.equal(response.text, '');
    assert.equal(response.body, null);

    const row = await ctx.linker.get('select * from item where id = ?', [id]);
    assert.ok(row, 'строка должна остаться в БД при мягком удалении');
    assert.equal(row.is_deleted, 1);

    const getResponse = await ctx.request('GET', `/items/${id}`);
    assert.equal(getResponse.status, 404);
  });

  it('should exclude deleted items from the list when includeDeleted is absent', async () => {
    const first = await ctx.request('POST', '/items', {
      json: makeItemPayload(ctx.ids, { name: 'Удаляемый' }),
    });
    const second = await ctx.request('POST', '/items', {
      json: makeItemPayload(ctx.ids, { name: 'Остающийся' }),
    });

    await ctx.request('DELETE', `/items/${first.body.data.id}`);

    const response = await ctx.request('GET', '/items');

    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 1);
    assert.equal(response.body.data[0].id, second.body.data.id);
    assert.deepEqual(response.body.meta, { page: 1, limit: 50, total: 1 });
  });

  it('should return deleted items when includeDeleted=true', async () => {
    const created = await ctx.request('POST', '/items', {
      json: makeItemPayload(ctx.ids, { name: 'Удалённый предмет' }),
    });
    const id = created.body.data.id;

    await ctx.request('DELETE', `/items/${id}`);

    const response = await ctx.request('GET', '/items?includeDeleted=true');

    assert.equal(response.status, 200);
    assert.equal(response.body.meta.total, 1);
    assert.equal(response.body.data.length, 1);
    assert.equal(response.body.data[0].id, id);
    assertItemShape(response.body.data[0], { deleted: true });
  });

  it('should ignore an invalid Authorization header when the API is public', async () => {
    const response = await ctx.request('POST', '/items', {
      json: makeItemPayload(ctx.ids),
      headers: { authorization: 'Bearer invalid-token' },
    });

    assert.equal(response.status, 201);
    assertItemShape(response.body.data);
  });
});
