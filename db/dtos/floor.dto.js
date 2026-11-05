import { ValidationError } from '../../errors.js';
import { isNotEmpty, isPositiveInt, isString } from '../../utils.js';

export default class FloorDto {
  constructor({ name, structure_id } = {}) {
    this.name = name;
    this.structure_id = structure_id;
  }

  #checkObject() {
    return (
      isString(this.name) &&
      isNotEmpty(this.name) &&
      isPositiveInt(this.structure_id)
    );
  }

  get object() {
    if (!this.#checkObject()) {
      throw new ValidationError('Переданы неверные данные для этажа');
    }

    return {
      name: this.name,
      structure_id: this.structure_id,
    };
  }
}
