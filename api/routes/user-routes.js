import express from "express";
import { pool } from "../db/pool.js";
import { verifyToken } from "../middleware/verifyToken.js";

const userRouter = express.Router();

/* --- GET USER BY ID --- */
userRouter.get("/:id", verifyToken, async (req, res, next) => {
    try {
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