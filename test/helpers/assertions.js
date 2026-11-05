import assert from 'node:assert/strict';
import { VALID_STATUSES } from '../fixtures/items.js';

export function assertItemShape(item, { deleted = false } = {}) {
  assert.ok(item && typeof item === 'object', 'item должен быть объектом');
  assert.ok(
    Number.isInteger(item.id) && item.id > 0,
    'id должен быть положительным целым'
  );
  assert.equal(typeof item.name, 'string');
  assert.ok(item.name.length > 0, 'name не должен быть пустым');
  assert.ok(item.properties && typeof item.properties === 'object');
  assert.ok(!Array.isArray(item.properties), 'properties должен быть объектом');
  assert.ok(
    VALID_STATUSES.includes(item.status),
    `status должен быть одним из: ${VALID_STATUSES.join(', ')}`
  );

  for (const field of ['location_id', 'current_location_id', 'category_id']) {
    assert.ok(
      Number.isInteger(item[field]) && item[field] > 0,
      `${field} должен быть положительным целым`
    );
  }

  assert.equal(item.is_deleted, deleted);
  assert.equal(typeof item.created_at, 'string');
  assert.equal(typeof item.updated_at, 'string');
}

export function assertErrorShape(body, expectedCode) {
  assert.ok(body && typeof body === 'object', 'тело ошибки должно быть объектом');
  assert.deepEqual(Object.keys(body), ['error']);
  assert.ok(body.error && typeof body.error === 'object');
  assert.equal(body.error.code, expectedCode);
  assert.equal(typeof body.error.message, 'string');
  assert.ok(body.error.message.length > 0);
}

export function assertValidationError(body) {
  assertErrorShape(body, 'VALIDATION_ERROR');

  if (body.error.details !== undefined) {
    assert.ok(Array.isArray(body.error.details));
    assert.ok(body.error.details.length > 0);
  }
}
