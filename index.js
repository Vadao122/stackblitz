import { createApp } from './app.js';
import SqliteLinker from './db/sqlite.js';

const dbPath = process.env.DB_PATH ?? './database.db';
const linker = new SqliteLinker(dbPath);

try {
  await linker.connect();
} catch (err) {
  console.error('Failed to connect to database:', err);
  process.exit(1);
}

const app = createApp(linker);
const port = Number(process.env.PORT ?? 3000);
const server = app.listen(port, () => {
  console.log(`Server started: http://localhost:${port}`);
});

server.on('error', (err) => {
  console.error('Server error:', err);
});

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`Received ${signal}, shutting down...`);

  await new Promise((resolve) => {
    server.close(resolve);
    server.closeIdleConnections?.();
  });
  await linker.close().catch((err) => {
    console.error('Failed to close database:', err);
  });

  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
