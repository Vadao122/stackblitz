import SqliteLinker from '../sqlite.js';
import { createDB } from './23-09-2026-create-db.js';

const version = '23-09-2026-create-db';
const dbPath = process.env.DB_PATH ?? './database.db';
const linker = new SqliteLinker(dbPath);

try {
  await linker.connect();

  await linker.run(`
    create table if not exists schema_migrations (
      version text primary key,
      applied_at text not null default (datetime('now'))
    );
  `);

  const applied = await linker.get('select version from schema_migrations where version = ?', [version]);

  if (applied) {
    console.log(`Migration ${version} already applied to ${dbPath}`);
  } else {
    await linker.transaction(async () => {
      await createDB(linker);
      await linker.run('insert into schema_migrations (version) values (?)', [version]);
    });
    console.log(`Migration ${version} applied to ${dbPath}`);
  }
} catch (err) {
  console.error('Migration failed:', err);
  process.exitCode = 1;
} finally {
  await linker.close().catch((err) => {
    console.error('Failed to close database:', err);
  });
}
