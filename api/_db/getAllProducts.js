import { pool } from "./pool.js";

export async function getAllProducts() {
    const { rows } = await pool.query(
        "SELECT id, ean, name, description, category, image, price, discount, updated FROM product ORDER BY id"
    );
    return rows;
}