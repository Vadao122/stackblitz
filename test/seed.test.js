import test from 'node:test';
import assert from 'node:assert/strict';
import SqliteLinker from '../db/sqlite.js';
import { createDB } from '../db/migrations/23-09-2026-create-db.js';
import { seed } from '../db/seed.js';

async function setup(t) {
  const linker = new SqliteLinker(':memory:');
  await linker.connect();
  await createDB(linker);
  t.after(async () => {
    await linker.close();
  });
  return linker;
}

test('seed creates a complete demo hierarchy', async (t) => {
  const linker = await setup(t);
  const ids = await seed(linker);

  for (const [key, value] of Object.entries(ids)) {
    assert.ok(
      Number.isInteger(value) && value > 0,
      `${key} должен быть положительным id`
    );
  }

  const structure = await linker.get('select * from structure where id = ?', [
    ids.structureId,
  ]);
  assert.equal(structure.name, 'Демо-здание');
  assert.equal(structure.address, 'ул. Демо, 1');

  const floor = await linker.get('select * from floor where id = ?', [
    ids.floorId,
  ]);
  assert.equal(floor.structure_id, ids.structureId);

  const room = await linker.get('select * from room where id = ?', [ids.roomId]);
  assert.equal(room.floor_id, ids.floorId);

  const place = await linker.get('select * from place where id = ?', [
    ids.placeId,
  ]);
  assert.equal(place.room_id, ids.roomId);

  const location = await linker.get('select * from location where id = ?', [
    ids.locationId,
  ]);
  assert.equal(location.place_id, ids.placeId);

  const category = await linker.get('select * from category where id = ?', [
    ids.categoryId,
  ]);
  assert.equal(category.name, 'Демо-категория');
  assert.equal(category.parent_id, null);
});

test('seed is idempotent and items can reference seeded rows', async (t) => {
  const linker = await setup(t);
  const first = await seed(linker);
  const second = await seed(linker);

  assert.deepEqual(second, first);

  for (const table of [
    'structure',
    'floor',
    'room',
    'place',
    'location',
    'category',
  ]) {
    const { count } = await linker.get(
      `select count(*) as count from ${table}`
    );
    assert.equal(count, 1, `${table} должен содержать ровно одну строку`);
  }

  const item = await linker.run(
    `
    insert into item
      (name, status, location_id, current_location_id, category_id)
    values (?, ?, ?, ?, ?)
    `,
    [
      'Seed item',
      'on_place',
      first.locationId,
      first.locationId,
      first.categoryId,
    ]
  );

  assert.ok(item.lastId > 0);
});
