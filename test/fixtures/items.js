export const VALID_STATUSES = Object.freeze([
  'on_place',
  'broken',
  'unlocked',
]);

export const REQUIRED_FIELDS = Object.freeze([
  'name',
  'status',
  'location_id',
  'current_location_id',
  'category_id',
]);

/**
 * Фабрика валидного payload для POST /items.
 * Значения location/category берутся из тестовой иерархии.
 */
export function makeItemPayload(ids, overrides = {}) {
  return {
    name: 'Тестовый предмет',
    properties: { serial: 'ABC-123', color: 'red' },
    status: 'on_place',
    location_id: ids.locationId,
    current_location_id: ids.locationId,
    category_id: ids.categoryId,
    ...overrides,
  };
}

export function withoutField(payload, field) {
  const copy = { ...payload };
  delete copy[field];
  return copy;
}
