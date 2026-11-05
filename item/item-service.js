import { ValidationError } from '../errors.js';

const ALLOWED_UPDATE_FIELDS = [
  'name',
  'properties',
  'status',
  'location_id',
  'current_location_id',
  'category_id',
];

function parseProperties(value) {
  try {
    return JSON.parse(value ?? '{}');
  } catch {
    return {};
  }
}

function mapItem(row) {
  if (!row) return null;

  return {
    ...row,
    is_deleted: Boolean(row.is_deleted),
    properties: parseProperties(row.properties),
  };
}

export default class ItemService {
  constructor(linker) {
    if (!linker) {
      throw new Error('SqliteLinker is required');
    }
    this.link = linker;
  }

  async getAll({
    ids,
    status,
    categoryId,
    locationId,
    includeDeleted = false,
    page = 1,
    limit = 50,
  } = {}) {
    const where = [];
    const params = [];

    if (!includeDeleted) {
      where.push('is_deleted = 0');
    }

    if (ids !== undefined) {
      if (!Array.isArray(ids) || ids.length === 0) {
        return { rows: [], total: 0 };
      }
      where.push(`id in (${this.link.createPlaceholders(ids)})`);
      params.push(...ids);
    }

    if (status !== undefined) {
      where.push('status = ?');
      params.push(status);
    }

    if (categoryId !== undefined) {
      where.push('category_id = ?');
      params.push(categoryId);
    }

    if (locationId !== undefined) {
      where.push('(location_id = ? or current_location_id = ?)');
      params.push(locationId, locationId);
    }

    const whereSql = where.length > 0 ? `where ${where.join(' and ')}` : '';

    const countRow = await this.link.get(
      `select count(*) as total from item ${whereSql}`,
      params
    );

    const rows = await this.link.all(
      `select * from item ${whereSql} order by id limit ? offset ?`,
      [...params, limit, (page - 1) * limit]
    );

    return {
      rows: rows.map(mapItem),
      total: countRow?.total ?? 0,
    };
  }

  async getOne(id) {
    const row = await this.link.get(
      'select * from item where id = ? and is_deleted = 0',
      [id]
    );
    return mapItem(row);
  }

  async softDelete(id) {
    const { changes } = await this.link.run(
      `
      update item
      set is_deleted = 1, updated_at = datetime('now')
      where id = ? and is_deleted = 0
      `,
      [id]
    );

    return changes;
  }

  async update(id, data) {
    const payload = { ...data };

    if (payload.properties !== undefined) {
      payload.properties = JSON.stringify(payload.properties);
    }

    const { block, values } = this.link.createSetBlock(
      payload,
      ALLOWED_UPDATE_FIELDS
    );

    if (!block) {
      throw new ValidationError('Нет полей для обновления');
    }

    const { changes } = await this.link.run(
      `
      update item
      set ${block}, updated_at = datetime('now')
      where id = ? and is_deleted = 0
      `,
      [...values, id]
    );

    if (changes === 0) return null;
    return this.getOne(id);
  }

  async create(data) {
    const values = [
      data.name,
      JSON.stringify(data.properties ?? {}),
      data.status,
      data.location_id,
      data.current_location_id,
      data.category_id,
    ];

    const { lastId } = await this.link.run(
      `
      insert into item
        (name, properties, status, location_id, current_location_id, category_id)
      values (?, ?, ?, ?, ?, ?)
      `,
      values
    );

    return this.getOne(lastId);
  }
}
