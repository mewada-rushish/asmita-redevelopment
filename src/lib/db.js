import mysql from 'mysql2/promise';

export async function getDbConnection() {
  if (!globalThis.__mysqlPool) {
    try {
      globalThis.__mysqlPool = mysql.createPool({
        host: process.env.DBHOST,
        user: process.env.DBUSER,
        password: process.env.DBPASS,
        database: process.env.DBNAME,
        connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
        waitForConnections: true,
        idleTimeout: 60000,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
        timezone: '+00:00',
        multipleStatements: false,
      });

      globalThis.__mysqlPool.pool.on('error', (err) => {
        console.error('[DB] Unexpected MySQL Pool Error:', err);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
          console.error('[DB] Database connection was closed.');
        }
      });

    } catch (error) {
      console.error('[DB] CRITICAL: Failed to initialize MySQL connection pool:', error);
      throw error;
    }
  }

  return globalThis.__mysqlPool;
}