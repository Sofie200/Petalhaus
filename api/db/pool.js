import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

pool.query('SELECT NOW()', (err, res) => {
    if (err) throw err;
    console.log(res.rows[0]);
});