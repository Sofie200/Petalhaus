import express from "express";
import { pool } from "../_db/pool.js";
import jwt from "jsonwebtoken";

const COOKIE_OPTIONS = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.VERCEL === '1',
    maxAge: (8 * 60 * 60 * 1000)
}

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
            { expiresIn: "8h" }
        );

        res.cookie('TokenCookie', token, COOKIE_OPTIONS);

        return res.json({
            success: true,
            user_id: user.id,
            username: user.first_name,
            role: user.role
        });

    } catch (err) {
        next(err);
    }
});

loginRouter.post("/logout", (req, res) => {

    res.clearCookie('TokenCookie', COOKIE_OPTIONS);
    return res.json({ success: true });

});

export default loginRouter;