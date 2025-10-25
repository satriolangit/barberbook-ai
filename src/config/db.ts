import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const { Pool } = pg;

// Setup automatic conversion for numeric types
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (val) => {
  return val === null ? null : parseFloat(val);
});

pg.types.setTypeParser(pg.types.builtins.INT2, (val) => {
  return val === null ? null : parseInt(val, 10);
});

pg.types.setTypeParser(pg.types.builtins.INT4, (val) => {
  return val === null ? null : parseInt(val, 10);
});

pg.types.setTypeParser(pg.types.builtins.INT8, (val) => {
  return val === null ? null : parseInt(val, 10);
});

// Optional: Handle timestamps
pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, (val) => {
  return val === null ? null : new Date(val);
});

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "bukubon_db",
  password: process.env.DB_PASSWORD || "bukubon123",
  port: (process.env.DB_PORT as number | undefined) || 5432,
});

export default pool;
