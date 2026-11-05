import { EItemsStatus } from '../enums.js';
import { ValidationError } from '../errors.js';
import {
  isCorrectStatus,
  isNotEmpty,
  isPlainObject,
  isPositiveInt,
  isString,
} from '../utils.js';

const FIELDS = [
  'name',
  'properties',
  'status',
  'location_id',
  'current_location_id',
  'category_id',
];

export default class ItemEntity {
  constructor(payload, { partial = false } = {}) {
    if (!isPlainObject(payload)) {
      throw new ValidationError('Тело запроса должно быть JSON-объектом');
    }

    const data = {};
    const errors = [];

    for (const field of FIELDS) {
      const hasField = Object.prototype.hasOwnProperty.call(payload, field);
      if (partial && !hasField) continue;

      const value = payload[field];

      switch (field) {
        case 'name':
          if (!isString(value) || !isNotEmpty(value)) {
            errors.push('name: требуется непустая строка');
          } else {
            data.name = value.trim();
          }
          break;

        case 'properties':
          if (value === undefined && !partial) {
            data.properties = {};
          } else if (!isPlainObject(value)) {
            errors.push('properties: требуется JSON-объект');
          } else {
            data.properties = value;
          }
          break;

        case 'status':
          if (!isCorrectStatus(EItemsStatus, value)) {
            errors.push(
              `status: допустимые значения — ${Object.values(EItemsStatus).join(', ')}`
            );
          } else {
            data.status = value;
          }
          break;

        case 'location_id':
        case 'current_location_id':
        case 'category_id':
          if (!isPositiveInt(value)) {
            errors.push(`${field}: требуется положительное целое число`);
          } else {
            data[field] = value;
          }
          break;
      }
    }

    if (errors.length > 0) {
      throw new ValidationError('Переданы неверные данные', errors);
    }

    if (partial && Object.keys(data).length === 0) {
      throw new ValidationError('Нет полей для обновления');
    }

    this.data = data;
  }

  get object() {
    return this.data;
  }
}
