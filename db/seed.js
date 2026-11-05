import { pathToFileURL } from 'node:url';
import SqliteLinker from './sqlite.js';

export const DEMO_DATA = {
  structure: { name: 'Демо-здание', address: 'ул. Демо, 1' },
  floor: { name: '1 этаж' },
  room: { name: 'Кабинет 101' },
  place: { name: 'Стеллаж A' },
  location: { name: 'Полка 1' },
  category: { name: 'Демо-категория' },
};

async function ensureStructure(linker, { name, address }) {
  const existing = await linker.get(
    `
    select id from structure
    where name = ? and address = ?
    order by id
    limit 1
    `,
    [name, address]
  );

  if (existing) return existing.id;

  const { lastId } = await linker.run(
    'insert into structure (name, address) values (?, ?)',
    [name, address]
  );

  return lastId;
}

async function ensureChild(linker, { table, parentColumn, parentId, name }) {
  const existing = await linker.get(
    `
    select id from ${table}
    where name = ? and ${parentColumn} = ?
    order by id
    limit 1
    `,
    [name, parentId]
  );

  if (existing) return existing.id;

  const { lastId } = await linker.run(
    `insert into ${table} (name, ${parentColumn}) values (?, ?)`,
    [name, parentId]
  );

  return lastId;
}

async function ensureCategory(linker, name) {
  const existing = await linker.get(
    `
    select id from category
    where name = ? and parent_id is null
    order by id
    limit 1
    `,
    [name]
  );

  if (existing) return existing.id;

  const { lastId } = await linker.run(
    'insert into category (name, parent_id) values (?, null)',
    [name]
  );

  return lastId;
}

export async function seed(linker, data = DEMO_DATA) {
  if (!linker) {
    throw new Error('SqliteLinker is required');
  }

  return linker.transaction(async () => {
    const structureId = await ensureStructure(linker, data.structure);

    const floorId = await ensureChild(linker, {
      table: 'floor',
      parentColumn: 'structure_id',
      parentId: structureId,
      name: data.floor.name,
    });

    const roomId = await ensureChild(linker, {
      table: 'room',
      parentColumn: 'floor_id',
      parentId: floorId,
      name: data.room.name,
    });

    const placeId = await ensureChild(linker, {
      table: 'place',
      parentColumn: 'room_id',
      parentId: roomId,
      name: data.place.name,
    });

    const locationId = await ensureChild(linker, {
      table: 'location',
      parentColumn: 'place_id',
      parentId: placeId,
      name: data.location.name,
    });

    const categoryId = await ensureCategory(linker, data.category.name);

    return {
      structureId,
      floorId,
      roomId,
      placeId,
      locationId,
      categoryId,
    };
  });
}

async function main() {
  const dbPath = process.env.DB_PATH ?? './database.db';
  const linker = new SqliteLinker(dbPath);

  try {
    await linker.connect();
    const ids = await seed(linker);

    console.log(`Демо-данные готовы в ${dbPath}`);
    console.log('');
    console.log(`structure_id: ${ids.structureId}`);
    console.log(`floor_id:     ${ids.floorId}`);
    console.log(`room_id:      ${ids.roomId}`);
    console.log(`place_id:     ${ids.placeId}`);
    console.log(`location_id:  ${ids.locationId}`);
    console.log(`category_id:  ${ids.categoryId}`);
    console.log('');
    console.log('Пример создания предмета:');
    console.log(
      `curl -s -X POST http://localhost:3000/items -H 'content-type: application/json' -d '{"name":"Ноутбук","properties":{"serial":"ABC-123"},"status":"on_place","location_id":${ids.locationId},"current_location_id":${ids.locationId},"category_id":${ids.categoryId}}'`
    );
  } catch (err) {
    console.error('Seed failed:', err.message);
    if (/no such table/i.test(err.message)) {
      console.error('Сначала примените миграцию: npm run db:migrate');
    }
    process.exitCode = 1;
  } finally {
    await linker.close().catch((closeErr) => {
      console.error('Failed to close database:', closeErr);
    });
  }
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  await main();
}
