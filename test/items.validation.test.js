import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext } from './helpers/test-context.js';
import {
  assertItemShape,
  assertValidationError,
  assertErrorShape,
} from './helpers/assertions.js';
import {
  makeItemPayload,
  withoutField,
  REQUIRED_FIELDS,
  VALID_STATUSES,
} from './fixtures/items.js';

const INVALID_CREATE_CASES = [
  { field: 'name', value: 42, label: 'a number' },
  { field: 'name', value: '', label: 'an empty string' },
  { field: 'name', value: '   ', label: 'a whitespace-only string' },
  { field: 'name', value: null, label: 'null' },
  { field: 'properties', value: [], label: 'an array' },
  { field: 'properties', value: 'not-an-object', label: 'a string' },
  { field: 'properties', value: null, label: 'null' },
  { field: 'properties', value: 42, label: 'a number' },
  { field: 'status', value: 'unknown', label: 'an unknown status' },
  { field: 'status', value: 'ON_PLACE', label: 'an uppercase status' },
  { field: 'status', value: 42, label: 'a number' },
  { field: 'status', value: null, label: 'null' },
  { field: 'location_id', value: '1', label: 'a string' },
  { field: 'location_id', value: 1.5, label: 'a float' },
  { field: 'location_id', value: 0, label: 'zero' },
  { field: 'location_id', value: -1, label: 'a negative number' },
  { field: 'location_id', value: null, label: 'null' },
  { field: 'current_location_id', value: '1', label: 'a string' },
  { field: 'current_location_id', value: 0, label: 'zero' },
  { field: 'current_location_id', value: -1, label: 'a negative number' },
  { field: 'category_id', value: '1', label: 'a string' },
  { field: 'category_id', value: 0, label: 'zero' },
  { field: 'category_id', value: 1.5, label: 'a float' },
];

const INVALID_PATCH_CASES = [
  { field: 'name', value: '', label: 'an empty string' },
  { field: 'name', value: 42, label: 'a number' },
  { field: 'properties', value: [], label: 'an array' },
  { field: 'properties', value: null, label: 'null' },
  { field: 'status', value: 'unknown', label: 'an unknown status' },
  { field: 'location_id', value: 0, label: 'zero' },
  { field: 'current_location_id', value: -1, label: 'a negative number' },
  { field: 'category_id', value: '1', label: 'a string' },
];

describe('Items API validation', () => {
  let ctx;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  afterEach(async () => {
    await ctx.close();
  });

  for (const field of REQUIRED_FIELDS) {
    it(`should return 400 when ${field} is missing`, async () => {
      const payload = withoutField(makeItemPayload(ctx.ids), field);

      const response = await ctx.request('POST', '/items', { json: payload });

      assert.equal(response.status, 400);
      assertValidationError(response.body);
      assert.ok(
        response.body.error.details.some((detail) =>
          detail.startsWith(`${field}:`)
        ),
        `ожидалась ошибка для поля ${field}`
      );

      const { count } = await ctx.linker.get(
        'select count(*) as count from item'
      );
      assert.equal(count, 0);
    });
  }

  it('should return 400 with all field errors when the body is empty', async () => {
    const response = await ctx.request('POST', '/items', { json: {} });

    assert.equal(response.status, 400);
    assertValidationError(response.body);
    assert.equal(response.body.error.details.length, REQUIRED_FIELDS.length);

    for (const field of REQUIRED_FIELDS) {
      assert.ok(
        response.body.error.details.some((detail) =>
          detail.startsWith(`${field}:`)
        )
      );
    }
  });

  it('should return 400 when the request body is absent', async () => {
    const response = await ctx.request('POST', '/items', {
      headers: { 'content-type': 'application/json' },
    });

    assert.equal(response.status, 400);
    assertValidationError(response.body);
  });

  it('should return 400 when the body is a JSON array', async () => {
    const response = await ctx.request('POST', '/items', { json: [] });

    assert.equal(response.status, 400);
    assertErrorShape(response.body, 'VALIDATION_ERROR');
    assert.equal(
      response.body.error.message,
      'Тело запроса должно быть JSON-объектом'
    );
  });

  it('should return 400 when the body is JSON null', async () => {
    const response = await ctx.request('POST', '/items', {
      rawBody: 'null',
      headers: { 'content-type': 'application/json' },
    });

    assert.equal(response.status, 400);
    assertErrorShape(response.body, 'BAD_REQUEST');
  });

  it('should return 400 when the body is a JSON string', async () => {
    const response = await ctx.request('POST', '/items', {
      rawBody: '"text"',
      headers: { 'content-type': 'application/json' },
    });

    assert.equal(response.status, 400);
    assertErrorShape(response.body, 'BAD_REQUEST');
  });

  it('should return 400 when the JSON is malformed', async () => {
    const response = await ctx.request('POST', '/items', {
      rawBody: '{"name":',
      headers: { 'content-type': 'application/json' },
    });

    assert.equal(response.status, 400);
    assertErrorShape(response.body, 'BAD_REQUEST');

    const { count } = await ctx.linker.get(
      'select count(*) as count from item'
    );
    assert.equal(count, 0);
  });

  for (const { field, value, label } of INVALID_CREATE_CASES) {
    it(`should return 400 when ${field} is ${label} on create`, async () => {
      const payload = makeItemPayload(ctx.ids, { [field]: value });

      const response = await ctx.request('POST', '/items', { json: payload });

      assert.equal(response.status, 400);
      assertValidationError(response.body);
      assert.ok(
        response.body.error.details.some((detail) =>
          detail.startsWith(`${field}:`)
        ),
        `ожидалась ошибка для поля ${field}`
      );

      const { count } = await ctx.linker.get(
        'select count(*) as count from item'
      );
      assert.equal(count, 0);
    });
  }

  it('should return 400 and keep the row unchanged when PATCH body is empty', async () => {
    const created = await ctx.request('POST', '/items', {
      json: makeItemPayload(ctx.ids),
    });
    const rowBefore = await ctx.linker.get('select * from item where id = ?', [
      created.body.data.id,
    ]);

    const response = await ctx.request(
      'PATCH',
      `/items/${created.body.data.id}`,
      { json: {} }
    );

    assert.equal(response.status, 400);
    assertErrorShape(response.body, 'VALIDATION_ERROR');
    assert.equal(response.body.error.message, 'Нет полей для обновления');

    const rowAfter = await ctx.linker.get('select * from item where id = ?', [
      created.body.data.id,
    ]);
    assert.deepEqual(rowAfter, rowBefore);
  });

  it('should return 400 and keep the row unchanged when PATCH has only unknown fields', async () => {
    const created = await ctx.request('POST', '/items', {
      json: makeItemPayload(ctx.ids),
    });
    const rowBefore = await ctx.linker.get('select * from item where id = ?', [
      created.body.data.id,
    ]);

    const response = await ctx.request(
      'PATCH',
      `/items/${created.body.data.id}`,
      { json: { unknown: 'value' } }
    );

    assert.equal(response.status, 400);
    assertErrorShape(response.body, 'VALIDATION_ERROR');
    assert.equal(response.body.error.message, 'Нет полей для обновления');

    const rowAfter = await ctx.linker.get('select * from item where id = ?', [
      created.body.data.id,
    ]);
    assert.deepEqual(rowAfter, rowBefore);
  });

  for (const { field, value, label } of INVALID_PATCH_CASES) {
    it(`should return 400 when ${field} is ${label} on update`, async () => {
      const created = await ctx.request('POST', '/items', {
        json: makeItemPayload(ctx.ids),
      });
      const rowBefore = await ctx.linker.get(
        'select * from item where id = ?',
        [created.body.data.id]
      );

      const response = await ctx.request(
        'PATCH',
        `/items/${created.body.data.id}`,
        { json: { [field]: value } }
      );

      assert.equal(response.status, 400);
      assertValidationError(response.body);
      assert.ok(
        response.body.error.details.some((detail) =>
          detail.startsWith(`${field}:`)
        )
      );

      const rowAfter = await ctx.linker.get(
        'select * from item where id = ?',
        [created.body.data.id]
      );
      assert.deepEqual(rowAfter, rowBefore);
    });
  }

  it('should return 400 when PATCH body is a JSON array', async () => {
    const created = await ctx.request('POST', '/items', {
      json: makeItemPayload(ctx.ids),
    });

    const response = await ctx.request(
      'PATCH',
      `/items/${created.body.data.id}`,
      { json: [] }
    );

    assert.equal(response.status, 400);
    assertErrorShape(response.body, 'VALIDATION_ERROR');
    assert.equal(
      response.body.error.message,
      'Тело запроса должно быть JSON-объектом'
    );
  });

  it('should return 400 when PATCH JSON is malformed', async () => {
    const created = await ctx.request('POST', '/items', {
      json: makeItemPayload(ctx.ids),
    });

    const response = await ctx.request(
      'PATCH',
      `/items/${created.body.data.id}`,
      {
        rawBody: '{bad',
        headers: { 'content-type': 'application/json' },
      }
    );

    assert.equal(response.status, 400);
    assertErrorShape(response.body, 'BAD_REQUEST');
  });

  it('should allow duplicate names when the schema has no unique constraint', async () => {
    const payload = makeItemPayload(ctx.ids, { name: 'Дубликат' });

    const first = await ctx.request('POST', '/items', { json: payload });
    const second = await ctx.request('POST', '/items', { json: payload });

    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.notEqual(first.body.data.id, second.body.data.id);

    const { count } = await ctx.linker.get(
      'select count(*) as count from item where name = ?',
      ['Дубликат']
    );
    assert.equal(count, 2);
  });

  it('should ignore unknown fields and client-provided id when creating', async () => {
    const response = await ctx.request('POST', '/items', {
      json: makeItemPayload(ctx.ids, {
        id: 9999,
        unknown: 'ignored',
      }),
    });

    assert.equal(response.status, 201);
    assert.notEqual(response.body.data.id, 9999);
    assert.equal('unknown' in response.body.data, false);
    assertItemShape(response.body.data);

    const row = await ctx.linker.get('select * from item where id = ?', [
      response.body.data.id,
    ]);
    assert.ok(row);
  });

  it('should preserve nested properties when creating an item', async () => {
    const properties = {
      serial: 'ABC-123',
      nested: { list: [1, 2], flag: true, empty: null },
    };

    const response = await ctx.request('POST', '/items', {
      json: makeItemPayload(ctx.ids, { properties }),
    });

    assert.equal(response.status, 201);
    assert.deepEqual(response.body.data.properties, properties);

    const row = await ctx.linker.get('select properties from item where id = ?', [
      response.body.data.id,
    ]);
    assert.deepEqual(JSON.parse(row.properties), properties);
  });

  for (const status of VALID_STATUSES) {
    it(`should accept the valid status "${status}" when creating`, async () => {
      const response = await ctx.request('POST', '/items', {
        json: makeItemPayload(ctx.ids, { status }),
      });

      assert.equal(response.status, 201);
      assert.equal(response.body.data.status, status);
    });
  }
});
