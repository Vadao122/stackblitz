export async function exec(linker, sql) {
  if (!linker || typeof linker.run !== 'function') {
    throw new Error('A connected SqliteLinker is required');
  }

  if (typeof sql !== 'string' || sql.trim().length === 0) {
    throw new Error('This migration failed the validation!');
  }

  return linker.run(sql);
}

export async function up(linker, sql) {
  return exec(linker, sql);
}

export async function down(linker, sql) {
  return exec(linker, sql);
}
