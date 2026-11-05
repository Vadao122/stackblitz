import { up } from '../migration.js';

export async function createDB(linker) {
  await up(
    linker,
    `
    create table if not exists structure (
      id integer primary key autoincrement,
      name text not null,
      address text not null,
      created_at text not null default (datetime('now')),
      updated_at text not null default (datetime('now'))
    );
  `
  );

  await up(
    linker,
    `
    create table if not exists floor (
      id integer primary key autoincrement,
      name text not null,
      structure_id integer not null,
      created_at text not null default (datetime('now')),
      updated_at text not null default (datetime('now')),
      foreign key (structure_id) references structure(id)
        on delete cascade
    );
  `
  );

  await up(
    linker,
    `
    create table if not exists room (
      id integer primary key autoincrement,
      name text not null,
      floor_id integer not null,
      created_at text not null default (datetime('now')),
      updated_at text not null default (datetime('now')),
      foreign key (floor_id) references floor(id)
        on delete cascade
    );
  `
  );

  await up(
    linker,
    `
    create table if not exists place (
      id integer primary key autoincrement,
      name text not null,
      room_id integer not null,
      created_at text not null default (datetime('now')),
      updated_at text not null default (datetime('now')),
      foreign key (room_id) references room(id)
        on delete cascade
    );
  `
  );

  await up(
    linker,
    `
    create table if not exists location (
      id integer primary key autoincrement,
      name text not null,
      place_id integer not null,
      created_at text not null default (datetime('now')),
      updated_at text not null default (datetime('now')),
      foreign key (place_id) references place(id)
        on delete cascade
    );
  `
  );

  await up(
    linker,
    `
    create table if not exists category (
      id integer primary key autoincrement,
      name text not null,
      parent_id integer,
      created_at text not null default (datetime('now')),
      updated_at text not null default (datetime('now')),
      foreign key (parent_id) references category(id)
        on delete set null
    );
  `
  );

  await up(
    linker,
    `
    create table if not exists item (
      id integer primary key autoincrement,
      is_deleted integer not null default 0 check (is_deleted in (0, 1)),
      name text not null,
      properties text not null default '{}',
      status text not null check (status in ('on_place', 'broken', 'unlocked')),
      location_id integer not null,
      current_location_id integer not null,
      category_id integer not null,
      created_at text not null default (datetime('now')),
      updated_at text not null default (datetime('now')),
      foreign key (location_id) references location(id),
      foreign key (current_location_id) references location(id),
      foreign key (category_id) references category(id)
    );
  `
  );

  await up(linker, `create index if not exists idx_floor_structure on floor(structure_id);`);
  await up(linker, `create index if not exists idx_room_floor on room(floor_id);`);
  await up(linker, `create index if not exists idx_place_room on place(room_id);`);
  await up(linker, `create index if not exists idx_location_place on location(place_id);`);
  await up(linker, `create index if not exists idx_item_location on item(location_id);`);
  await up(linker, `create index if not exists idx_item_current_location on item(current_location_id);`);
  await up(linker, `create index if not exists idx_item_category on item(category_id);`);
  await up(linker, `create index if not exists idx_item_deleted on item(is_deleted);`);
}
