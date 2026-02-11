import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: Database | null = null;

export async function getDb() {
  if (db) return db;

  try {
    const dbPath = path.join(__dirname, '../sisdrone.sqlite');
    console.log('Opening database at:', dbPath);

    db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    await initDb(db);
    return db;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

async function initDb(database: Database) {
  await database.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      primary_color TEXT DEFAULT '#3b82f6',
      accent_color TEXT DEFAULT '#10b981',
      logo_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS poles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER DEFAULT 1,
      external_id TEXT,
      lat REAL,
      lng REAL,
      utm_x REAL,
      utm_y REAL,
      height REAL,
      material TEXT,
      structure_type TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    );

    CREATE TABLE IF NOT EXISTS images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER DEFAULT 1,
      pole_id INTEGER,
      file_path TEXT,
      captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pole_id) REFERENCES poles(id),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    );

    CREATE TABLE IF NOT EXISTS labels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pole_id INTEGER,
      image_id INTEGER,
      label TEXT,
      confidence REAL,
      source TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pole_id) REFERENCES poles(id),
      FOREIGN KEY (image_id) REFERENCES images(id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      role TEXT NOT NULL,
      tenant_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    );
  `);

  // Seed default tenants if empty
  const tenantRes = await database.get('SELECT COUNT(*) as count FROM tenants');
  if (tenantRes && tenantRes.count === 0) {
    await database.run(`
      INSERT INTO tenants (name, primary_color, accent_color) VALUES 
      ('Equatorial Energia', '#00953a', '#ffcd00'),
      ('CEMIG', '#005596', '#ffffff')
    `);
  }

  // Seed mock users if empty
  const userRes = await database.get('SELECT COUNT(*) as count FROM users');
  if (userRes && userRes.count === 0) {
    await database.run(`
      INSERT INTO users (username, role, tenant_id) VALUES 
      ('admin_eq', 'ADMIN', 1),
      ('eng_eq', 'ENGINEER', 1),
      ('viewer_eq', 'VIEWER', 1),
      ('admin_cemig', 'ADMIN', 2),
      ('eng_cemig', 'ENGINEER', 2),
      ('viewer_cemig', 'VIEWER', 2)
    `);
  }
}
