import { once } from 'node:events';
import { createApp } from '../../app.js';
import SqliteLinker from '../../db/sqlite.js';
import { createDB } from '../../db/migrations/23-09-2026-create-db.js';

async function insert(linker, sql, params) {
  const { lastId } = await linker.run(sql, params);
  return lastId;
}

async function createHierarchy(linker) {
  const structureId = await insert(
    linker,
    'insert into structure (name, address) values (?, ?)',
    ['Test structure', 'Test address']
  );

  const floorId = await insert(
    linker,
    'insert into floor (name, structure_id) values (?, ?)',
    ['Test floor', structureId]
  );

  const roomId = await insert(
    linker,
    'insert into room (name, floor_id) values (?, ?)',
    ['Test room', floorId]
  );

  const placeId = await insert(
    linker,
    'insert into place (name, room_id) values (?, ?)',
    ['Test place', roomId]
  );

  const locationId = await insert(
    linker,
    'insert into location (name, place_id) values (?, ?)',
    ['Test location', placeId]
  );

  const locationId2 = await insert(
    linker,
    'insert into location (name, place_id) values (?, ?)',
    ['Test location 2', placeId]
  );

  const categoryId = await insert(
    linker,
    'insert into category (name, parent_id) values (?, ?)',
    ['Test category', null]
  );

  const categoryId2 = await insert(
    linker,
    'insert into category (name, parent_id) values (?, ?)',
    ['Test category 2', null]
  );

  return {
    structureId,
    floorId,
    roomId,
    placeId,
    locationId,
    locationId2,
    categoryId,
    categoryId2,
  };
}

/**
 * Создаёт полностью изолированное тестовое окружение:
 * in-memory SQLite, схему, тестовую иерархию и HTTP-сервер на свободном порту.
 * Никакие данные проекта не используются и не изменяются.
 */
export async function createTestContext() {
  const linker = new SqliteLinker(':memory:');
  await linker.connect();
  await createDB(linker);

  const ids = await createHierarchy(linker);

  const app = createApp(linker);
  const server = app.listen(0);
  await once(server, 'listening');

  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  async function request(method, path, { json, rawBody, headers = {} } = {}) {
    const requestHeaders = { ...headers };
    let body;

    if (json !== undefined) {
      if (!requestHeaders['content-type']) {
        requestHeaders['content-type'] = 'application/json';
      }
      body = JSON.stringify(json);
    } else if (rawBody !== undefined) {
      body = rawBody;
    }

    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: requestHeaders,
      body,
    });

    const text = await response.text();
    let parsedBody = null;

    if (text.length > 0) {
      try {
        parsedBody = JSON.parse(text);
      } catch {
        parsedBody = text;
      }
    }

    return {
      status: response.status,
      headers: response.headers,
      body: parsedBody,
      text,
    };
  }

  async function close() {
    if (server.listening) {
      await new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections?.();
      });
    }

    await linker.close();
  }

  return {
    linker,
    ids,
    baseUrl,
    request,
    close,
  };
}
