import fs from 'fs';
import mysql from 'mysql2/promise';

function loadEnv() {
  const content = fs.readFileSync('.env', 'utf-8');
  content.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let key = match[1];
      let value = match[2] ? match[2].trim() : '';
      if (value.startsWith("'") && value.endsWith("'")) {
        value = value.substring(1, value.length - 1);
      }
      process.env[key] = value;
    }
  });
}

loadEnv();

async function main() {
  const db = await mysql.createPool({
    host: process.env.DBHOST,
    user: process.env.DBUSER,
    password: process.env.DBPASS,
    database: process.env.DBNAME
  });
  
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS property_groups (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255),
        territory JSON,
        status VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('Table property_groups created successfully');
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

main();
