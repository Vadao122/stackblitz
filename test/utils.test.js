import test from 'node:test';
import assert from 'node:assert/strict';
import { EItemsStatus } from '../enums.js';
import {
  isCorrectStatus,
  isEmpty,
  isNotEmpty,
  isNumber,
  isPositiveInt,
} from '../utils.js';

test('isEmpty treats empty values as empty', () => {
  assert.equal(isEmpty(null), true);
  assert.equal(isEmpty(undefined), true);
  assert.equal(isEmpty(''), true);
  assert.equal(isEmpty('   '), true);
  assert.equal(isEmpty([]), true);
  assert.equal(isEmpty({}), true);
  assert.equal(isEmpty(0), false);
  assert.equal(isEmpty(false), false);
  assert.equal(isEmpty('x'), false);
  assert.equal(isEmpty([1]), false);
  assert.equal(isEmpty({ a: 1 }), false);
});

test('isNotEmpty is the inverse of isEmpty', () => {
  assert.equal(isNotEmpty('x'), true);
  assert.equal(isNotEmpty(''), false);
  assert.equal(isNotEmpty(null), false);
  assert.equal(isNotEmpty({}), false);
  assert.equal(isNotEmpty({ a: 1 }), true);
});

test('isNumber rejects NaN and Infinity', () => {
  assert.equal(isNumber(1), true);
  assert.equal(isNumber(0), true);
  assert.equal(isNumber(NaN), false);
  assert.equal(isNumber(Infinity), false);
  assert.equal(isNumber('1'), false);
});

test('isPositiveInt accepts only positive integers', () => {
  assert.equal(isPositiveInt(1), true);
  assert.equal(isPositiveInt(0), false);
  assert.equal(isPositiveInt(-1), false);
  assert.equal(isPositiveInt(1.5), false);
  assert.equal(isPositiveInt('1'), false);
});

test('isCorrectStatus checks enum values', () => {
  assert.equal(isCorrectStatus(EItemsStatus, 'on_place'), true);
  assert.equal(isCorrectStatus(EItemsStatus, 'broken'), true);
  assert.equal(isCorrectStatus(EItemsStatus, 'unknown'), false);
});
