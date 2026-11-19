import express from "express";
import { pool } from "../_db/pool.js";
import { verifyToken } from "../_middleware/verifyToken.js";

const userRouter = express.Router();


/* --- GET /api/user/me → who is logged in --- */
userRouter.get("/me", verifyToken, async (req, res, next) => {
    try {
        const { rows: [user] } = await pool.query(
            `SELECT id, first_name, role,
                    google_sub IS NOT NULL AS has_google,
                    pw_hash IS NOT NULL         AS has_password,
                    github_id IS NOT NULL       AS has_github
             FROM user_ WHERE id = $1`,
            [req.user.user_id]
        );

        // Valid token but the user no longer exists → treat as logged out
        if (!user) return res.status(401).json({ error: "Not logged in" });

        res.json({
            user_id: user.id,
            username: user.first_name,
            role: user.role,
            hasGoogle: user.has_google,
            hasPassword: user.has_password,
            hasGithub: user.has_github,
        });
    } catch (err) {
        next(err);
    }
});

/* --- GET /api/user/me/orders → the logged-in customer's own orders --- */
userRouter.get("/me/orders", verifyToken, async (req, res, next) => {
    try {
        const { rows } = await pool.query(
            `SELECT o.id, o.date, o.status, o.grand_total,
                    o.shipping_method, o.shipping_cost, o.service_point_name,
                    COALESCE((
                        SELECT json_agg(i)
                        FROM (
                            SELECT p.name, oi.price, oi.discount, COUNT(*)::int AS quantity
                            FROM order_item oi
                            JOIN product p ON p.id = oi.product_id
                            WHERE oi.order_id = o.id
                            GROUP BY p.name, oi.price, oi.discount
                        ) i
                    ), '[]') AS items
             FROM order_ o
             WHERE o.user_id = $1
               AND o.stripe_status NOT IN ('pending', 'cancelled')
             ORDER BY o.id DESC`,
            [req.user.user_id]
        );

        res.json(rows);
    } catch (err) {
        next(err);
    }
});

/* --- GET USER BY ID --- */
userRouter.get("/:id", verifyToken, async (req, res, next) => {
    try {

        if (Number(user_id) !== req.user.user_id && req.user.role !== "admin") {
            return res.status(403).json({ error: "Forbidden" });
        }
        
        const user_id = req.params.id;

        const result = await pool.query(
            `SELECT first_name, last_name, email, phone, street, postal_code, city FROM user_
            WHERE id = $1`,
            [user_id]
        );

        return res.json(result.rows);

    } catch (err) {
        next(err);
    }
});

export default userRouter;