import express from "express";
import { pool } from "../db/pool.js";
import jwt from "jsonwebtoken";

const loginRouter = express.Router();

loginRouter.post("/", async (req, res, next) => {
    const { username, password } = req.body;

    try {
        const result = await pool.query(
            "SELECT * FROM user_ WHERE first_name = $1",
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: "Fel användarnamn eller lösenord" });
        }

        const user = result.rows[0];

        if (user.pw !== password) {
            return res.status(401).json({ error: "Fel användarnamn eller lösenord" });
        }

        const token = jwt.sign(
            {
                user_id: user.id,
                username: user.first_name,
                role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: "2h" }
        );

        return res.json({
            success: true,
            user_id: user.id,
            username: user.first_name,
            role: user.role,
            token: token
        });

    } catch (err) {
        next(err);
    }
});

export default loginRouter;