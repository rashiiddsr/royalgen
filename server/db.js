import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'rgi_nexaproc',
  waitForConnections: true,
  connectionLimit: 10,
});

export async function query(sql, params) {
  // Use `query` instead of `execute` so identifier placeholders (??) work
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function getConnection() {
  return pool.getConnection();
}

export default pool;
