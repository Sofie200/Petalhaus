import express from "express";
import { pool } from "../_db/pool.js";
import { COOKIE_OPTIONS, setAuthCookie } from "../_lib/authCookie.js";

const loginRouter = express.Router();

loginRouter.post("/", async (req, res, next) => {
    const { username, password } = req.body;

    try {

        const { rows: [user] } = await pool.query(
                    "SELECT * FROM user_ WHERE lower(email) = lower($1)",
                    [username]
                );

        if (!user) {
            return res.status(401).json({ error: "Fel e-postadress eller lösenord" });
        }

        if (user.pw === null) {
            return res.status(401).json({
                error: "Det här kontot använder Google-inloggning. Logga in med Google.",
            });
        }

        if (user.pw !== password) {
            return res.status(401).json({ error: "Fel e-postadress eller lösenord" });
        }

        setAuthCookie(res, user);

        return res.json({
            success: true,
            user_id: user.id,
            username: user.first_name,
            role: user.role,
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