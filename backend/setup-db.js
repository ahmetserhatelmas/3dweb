import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create data directory if not exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Create uploads directory if not exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'mchain.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  -- Users table
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
    company_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Projects table
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    part_number TEXT NOT NULL,
    assigned_to INTEGER NOT NULL,
    created_by INTEGER NOT NULL,
    deadline DATE,
    step_file_path TEXT,
    step_file_name TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'reviewing', 'completed')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assigned_to) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  -- Checklist items table
  CREATE TABLE IF NOT EXISTS checklist_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    is_checked INTEGER DEFAULT 0,
    checked_at DATETIME,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  -- Uploaded documents (by supplier)
  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    checklist_item_id INTEGER,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    uploaded_by INTEGER NOT NULL,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (checklist_item_id) REFERENCES checklist_items(id),
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
  );
`);

// Seed initial users
const adminPassword = bcrypt.hashSync('admin123', 10);
const userPassword = bcrypt.hashSync('user123', 10);

const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (username, password, role, company_name) 
  VALUES (?, ?, ?, ?)
`);

insertUser.run('admin', adminPassword, 'admin', 'TUSAŞ Mühendislik');
insertUser.run('tedarikci', userPassword, 'user', 'ABC Makina Ltd.');
insertUser.run('tedarikci2', userPassword, 'user', 'XYZ Parça A.Ş.');

console.log('✅ Database setup complete!');
console.log('📁 Database location:', dbPath);
console.log('');
console.log('🔑 Default Users:');
console.log('   Admin: admin / admin123');
console.log('   User:  tedarikci / user123');
console.log('   User:  tedarikci2 / user123');

db.close();






