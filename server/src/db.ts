import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

let db: Database | null = null;

export async function getDb() {
  if (db) return db;

  const dbPath = path.join(__dirname, '../sisdrone.sqlite');

  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  await initDb(db);
  return db;
}

async function initDb(database: Database) {
  await database.exec(`
    CREATE TABLE IF NOT EXISTS poles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      external_id TEXT,
      lat REAL,
      lng REAL,
      utm_x REAL,
      utm_y REAL,
      height REAL,
      material TEXT,
      structure_type TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS labels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pole_id INTEGER,
      label TEXT,
      confidence REAL,
      source TEXT, -- 'ai' or 'user'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pole_id) REFERENCES poles(id)
    );

    CREATE TABLE IF NOT EXISTS images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pole_id INTEGER,
      file_path TEXT,
      captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pole_id) REFERENCES poles(id)
    );
  `);
}
