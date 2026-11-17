import { pool } from "../_db/pool.js";

/* --- GET ORDER WITH ITEMS --- */
export async function getOrderWithItems(orderId) {

    const result = await pool.query(
        `SELECT o.id, o.shipping_cost,
                concat_ws(' ', u.first_name, u.last_name) AS name, u.email
         FROM order_ o
         JOIN user_ u ON u.id = o.user_id
         WHERE o.id = $1`,
        [orderId]
    );

    const orderRow = result.rows[0];

    if (!orderRow) {
        throw new Error("Ordern hittas inte");
    }

    const itemsResult = await pool.query(
        `SELECT p.name AS title,
                oi.price - COALESCE(oi.discount, 0) AS price,
                COUNT(*)::int AS quantity
         FROM order_item oi
         JOIN product p ON p.id = oi.product_id
         WHERE oi.order_id = $1
         GROUP BY p.name, oi.price, oi.discount`,
        [orderId]
    );

    const items = itemsResult.rows.map((item) => ({
        ...item,
        price: Number(item.price),
    }));

    const shippingCost = Number(orderRow.shipping_cost ?? 0);
    if (shippingCost > 0) {
        items.push({ title: "Frakt", quantity: 1, price: shippingCost });
    }

    return {
        id: orderRow.id,
        name: orderRow.name || orderRow.email,
        email: orderRow.email,
        items,
    };
};