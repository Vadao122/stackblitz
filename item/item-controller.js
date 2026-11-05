import { EItemsStatus } from '../enums.js';
import { NotFoundError, ValidationError } from '../errors.js';
import { isCorrectStatus, isPositiveInt } from '../utils.js';
import ItemEntity from './item-entity.js';
import ItemService from './item-service.js';

export default class ItemController {
  constructor(linker) {
    this.service = new ItemService(linker);
  }

  #parseId(raw) {
    const id = Number(raw);
    if (!isPositiveInt(id)) {
      throw new ValidationError('id должен быть положительным целым числом');
    }
    return id;
  }

  #parseOptionalPositiveInt(raw, name) {
    if (raw === undefined) return undefined;

    const value = Number(raw);
    if (!isPositiveInt(value)) {
      throw new ValidationError(
        `${name} должен быть положительным целым числом`
      );
    }
    return value;
  }

  async getItem(ctx) {
    const id = this.#parseId(ctx.params.id);
    const item = await this.service.getOne(id);

    if (!item) {
      throw new NotFoundError('Предмет не найден');
    }

    ctx.body = { data: item };
  }

  async getItems(ctx) {
    const {
      ids,
      status,
      categoryId,
      locationId,
      includeDeleted,
      page,
      limit,
    } = ctx.query;

    let parsedIds;

    if (ids !== undefined) {
      const rawValues = Array.isArray(ids) ? ids : [ids];
      const values = rawValues.flatMap((value) => String(value).split(','));
      parsedIds = values.map((value) => this.#parseId(value));
    }

    if (status !== undefined && !isCorrectStatus(EItemsStatus, status)) {
      throw new ValidationError(
        `status: допустимые значения — ${Object.values(EItemsStatus).join(', ')}`
      );
    }

    const pageNumber =
      page === undefined ? 1 : this.#parseOptionalPositiveInt(page, 'page');
    const limitNumber =
      limit === undefined ? 50 : this.#parseOptionalPositiveInt(limit, 'limit');

    if (limitNumber > 200) {
      throw new ValidationError('limit не может быть больше 200');
    }

    const result = await this.service.getAll({
      ids: parsedIds,
      status,
      categoryId: this.#parseOptionalPositiveInt(categoryId, 'categoryId'),
      locationId: this.#parseOptionalPositiveInt(locationId, 'locationId'),
      includeDeleted: includeDeleted === 'true' || includeDeleted === '1',
      page: pageNumber,
      limit: limitNumber,
    });

    ctx.body = {
      data: result.rows,
      meta: {
        page: pageNumber,
        limit: limitNumber,
        total: result.total,
      },
    };
  }

  async createItem(ctx) {
    const entity = new ItemEntity(ctx.request.body);
    const item = await this.service.create(entity.object);

    ctx.status = 201;
    ctx.body = { data: item };
  }

  async updateItem(ctx) {
    const id = this.#parseId(ctx.params.id);
    const entity = new ItemEntity(ctx.request.body, { partial: true });
    const item = await this.service.update(id, entity.object);

    if (!item) {
      throw new NotFoundError('Предмет не найден');
    }

    ctx.body = { data: item };
  }

  async deleteItem(ctx) {
    const id = this.#parseId(ctx.params.id);
    const changes = await this.service.softDelete(id);

    if (changes === 0) {
      throw new NotFoundError('Предмет не найден');
    }

    ctx.status = 204;
    ctx.body = null;
  }
}
