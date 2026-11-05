import { ValidationError } from '../../errors.js';
import { isNotEmpty, isString } from '../../utils.js';

export default class StructureDto {
  constructor({ name, address } = {}) {
    this.name = name;
    this.address = address;
  }

  #checkObject() {
    return (
      isString(this.name) &&
      isNotEmpty(this.name) &&
      isString(this.address) &&
      isNotEmpty(this.address)
    );
  }

  get object() {
    if (!this.#checkObject()) {
      throw new ValidationError('Переданы неверные данные для структуры');
    }

    return {
      name: this.name,
      address: this.address,
    };
  }
}
