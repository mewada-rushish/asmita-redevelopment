import mysql from 'mysql2/promise';

export async function getDbConnection() {
  return await mysql.createConnection({
    host: 'asmitagrandmaison.com',
    user: 'air_admin', // Update with your DB user
    password: '{0.z9]RUKEgI',     // Update with your DB password
    database: 'air_property_tracker'
  });
}