import mysql from 'mysql2/promise';

export async function getDbConnection() {
  return await mysql.createConnection({
    host: process.env.DBHOST,  
    user: process.env.DBUSER, 
    password: process.env.DBPASS,
    database: process.env.DBNAME
  });
}