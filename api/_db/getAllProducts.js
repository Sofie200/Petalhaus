import { pool } from "./pool.js";

export async function getAllProducts() {
    const { rows } = await pool.query(
        "SELECT id, ean, name, description, category, price, discount, updated FROM product ORDER BY id"
    );
    // pg returnerar NUMERIC som sträng ("599.00"), så gör om till tal
    return rows.map((r) => ({
        ...r,
        price: Number(r.price),
        discount: r.discount === null ? null : Number(r.discount),
    }));
}