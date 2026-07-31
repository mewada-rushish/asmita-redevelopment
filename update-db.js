const fs = require('fs');
const envFile = fs.readFileSync('.env', 'utf8');
envFile.split(/\r?\n/).forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let key = match[1].trim();
    let val = match[2].trim();
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    process.env[key] = val;
    console.log(`Parsed: ${key} = ${val.substring(0, 3)}...`);
  }
});
const mysql = require('mysql2/promise');

async function updateDb() {
  let connection;
  try {
    console.log("DBUSER:", process.env.DBUSER);
    connection = await mysql.createConnection({
      host: process.env.DBHOST,
      user: process.env.DBUSER,
      password: process.env.DBPASS,
      database: process.env.DBNAME,
    });

    console.log("Connected to database. Altering table...");

    // Using IF NOT EXISTS logically by catching duplicate column error, or we just try adding it.
    try {
      await connection.query(`ALTER TABLE properties ADD COLUMN type ENUM('MBMC', 'BMC') DEFAULT 'MBMC'`);
      console.log("Added 'type' column successfully.");
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') console.log("'type' column already exists.");
      else throw e;
    }

    try {
      await connection.query(`ALTER TABLE properties ADD COLUMN category ENUM('Direct', 'Tender') DEFAULT 'Direct'`);
      console.log("Added 'category' column successfully.");
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') console.log("'category' column already exists.");
      else throw e;
    }

    console.log("Database update complete.");
  } catch (error) {
    console.error("Database update failed:", error);
  } finally {
    if (connection) await connection.end();
  }
}

updateDb();
