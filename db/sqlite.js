import sqlite3 from 'sqlite3';

export default class SqliteLinker {
  constructor(filename = process.env.DB_PATH ?? './database.db') {
    this.filename = filename;
    this.db = null;
  }

  async connect() {
    if (this.db) return this.db;

    await new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.filename, (err) => {
        if (err) {
          this.db = null;
          reject(err);
          return;
        }
        resolve();
      });
    });

    await this.run('PRAGMA foreign_keys = ON');
    await this.run('PRAGMA busy_timeout = 5000');

    return this.db;
  }

  async run(sql, params = []) {
    if (!this.db) throw new Error('Database is not connected');

    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) {
          reject(err);
          return;
        }
        resolve({
          lastId: this.lastID,
          changes: this.changes,
        });
      });
    });
  }

  async get(sql, params = []) {
    if (!this.db) throw new Error('Database is not connected');

    return new Promise((resolve, reject) => {
      this.db.get(sql, params, function (err, row) {
        if (err) {
          reject(err);
          return;
        }
        resolve(row);
      });
    });
  }

  async all(sql, params = []) {
    if (!this.db) throw new Error('Database is not connected');

    return new Promise((resolve, reject) => {
      this.db.all(sql, params, function (err, rows) {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  async transaction(work) {
    await this.run('BEGIN IMMEDIATE');
    try {
      const result = await work();
      await this.run('COMMIT');
      return result;
    } catch (err) {
      try {
        await this.run('ROLLBACK');
      } catch (rollbackErr) {
        console.error('Rollback failed:', rollbackErr);
      }
      throw err;
    }
  }

  async close() {
    if (!this.db) return;

    await new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        this.db = null;
        resolve();
      });
    });
  }

  createPlaceholders(arr) {
    if (!Array.isArray(arr)) {
      throw new TypeError('createPlaceholders expects an array');
    }
    return arr.map(() => '?').join(',');
  }

  createSetBlock(properties, allowedColumns) {
    if (!Array.isArray(allowedColumns)) {
      throw new TypeError('allowedColumns must be an array');
    }

    const values = [];
    const block = Object.entries(properties)
      .filter(([key, value]) => allowedColumns.includes(key) && value !== undefined)
      .map(([key, value]) => {
        values.push(value);
        return `${key} = ?`;
      })
      .join(', ');

    return { block, values };
  }
}
