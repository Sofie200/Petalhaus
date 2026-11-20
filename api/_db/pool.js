import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10_000, // give up connecting after 10 s instead of hanging
});

// An idle client lost its connection (e.g. the database restarted or timed out).
// Without this handler the error is uncaught and the whole function crashes.
pool.on("error", (err) => {
    console.error("[DB] Idle client error:", err.message);
});
