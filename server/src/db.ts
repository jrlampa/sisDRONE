import dotenv from 'dotenv';
dotenv.config();
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import * as seeds from './seeds';
import { hashPassword } from './services/authService';

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

    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      unit_price REAL NOT NULL,
      match_keys TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS poles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER DEFAULT 1,
      external_id TEXT,
      name TEXT,
      lat REAL,
      lng REAL,
      utm_x REAL,
      utm_y REAL,
      height REAL,
      material TEXT,
      structure_type TEXT,
      status TEXT DEFAULT 'pending',
      ahi_score INTEGER DEFAULT 100,
      installation_date DATETIME DEFAULT '2020-01-01',
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

    CREATE TABLE IF NOT EXISTS maintenance_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pole_id INTEGER,
      plan_text TEXT,
      status TEXT DEFAULT 'PENDING',
      estimated_cost REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pole_id) REFERENCES poles(id)
    );

    CREATE TABLE IF NOT EXISTS work_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT DEFAULT 'MED',
      status TEXT DEFAULT 'OPEN',
      assignee_id INTEGER,
      pole_id INTEGER,
      due_date DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assignee_id) REFERENCES users(id),
      FOREIGN KEY (pole_id) REFERENCES poles(id)
    );
  `);

  // Seed default tenants if empty
  const tenantRes = await database.get('SELECT COUNT(*) as count FROM tenants');
  if (tenantRes && tenantRes.count === 0) {
    for (const t of seeds.tenants) {
      await database.run('INSERT INTO tenants (name, primary_color, accent_color) VALUES (?, ?, ?)', [t.name, t.primary_color, t.accent_color]);
    }
  }

  // Seed mock users if empty
  const userRes = await database.get('SELECT COUNT(*) as count FROM users');
  if (userRes && userRes.count === 0) {
    const defaultPasswordHash = await hashPassword('sisdrone123');
    for (const u of seeds.users) {
      const role = (u as any).role || 'ENGINEER';
      await database.run(
        'INSERT INTO users (username, role, tenant_id, password_hash) VALUES (?, ?, ?, ?)',
        [u.username, role, u.tenant_id, defaultPasswordHash]
      );
    }
  }

  // Seed materials if empty
  const matRes = await database.get('SELECT COUNT(*) as count FROM materials');
  if (matRes && matRes.count === 0) {
    for (const m of seeds.materials) {
      await database.run('INSERT INTO materials (name, unit_price, match_keys) VALUES (?, ?, ?)', [m.name, m.unit_price, m.match_keys]);
    }
  }

  // Create Indexes
  await database.exec(`
    CREATE INDEX IF NOT EXISTS idx_poles_tenant ON poles(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_poles_status ON poles(status);
    CREATE INDEX IF NOT EXISTS idx_maintenance_pole ON maintenance_plans(pole_id);
    CREATE INDEX IF NOT EXISTS idx_wo_status ON work_orders(status);
    CREATE INDEX IF NOT EXISTS idx_wo_assignee ON work_orders(assignee_id);
  `);

  // Migration for AHI fields
  try {
    await database.exec(`ALTER TABLE poles ADD COLUMN ahi_score INTEGER DEFAULT 100`);
    await database.exec(`ALTER TABLE poles ADD COLUMN installation_date DATETIME DEFAULT '2020-01-01'`);
    console.log('Migrated poles table with AHI columns');
  } catch (e) {
    // Ignore error if columns already exist
  }

  // Migration for name column
  try {
    await database.exec(`ALTER TABLE poles ADD COLUMN name TEXT`);
    console.log('Migrated poles table with name column');
  } catch (e) {
    // Ignore error if column already exists
  }

  // Migration for password_hash column in users
  try {
    await database.exec(`ALTER TABLE users ADD COLUMN password_hash TEXT`);
    console.log('Migrated users table with password_hash column');
  } catch (e) {
    // Ignore error if column already exists
  }

  // Backfill password_hash for existing users who don't have one
  const usersWithoutHash = await database.all('SELECT id FROM users WHERE password_hash IS NULL');
  if (usersWithoutHash.length > 0) {
    const defaultHash = await hashPassword('sisdrone123');
    await database.run('UPDATE users SET password_hash = ? WHERE password_hash IS NULL', [defaultHash]);
    console.log(`Backfilled password_hash for ${usersWithoutHash.length} existing users`);
  }
}
