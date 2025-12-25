import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const loadEnv = () => dotenv.config({ path: path.join(__dirname, '.env') });

loadEnv();

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
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function getConnection() {
  return pool.getConnection();
}

export default pool;
