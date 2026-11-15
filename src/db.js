// src/db.js — uses Node 22+ built-in node:sqlite (no native addon needed)
'use strict';
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'saathi.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);

// Pragmas via exec (node:sqlite has no .pragma() method)
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

// Shim: add .pragma() so existing code using db.pragma() doesn't break
db.pragma = function(str) {
  const key = str.split('=')[0].trim().replace('PRAGMA ', '').replace('pragma ', '');
  try {
    const rows = db.prepare(`PRAGMA ${str}`).all();
    return rows;
  } catch (e) {
    db.exec(`PRAGMA ${str}`);
    return [];
  }
};

// Apply schema
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

module.exports = db;
