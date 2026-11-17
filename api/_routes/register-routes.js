import express from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "../_db/pool.js";
import { setAuthCookie } from "../_lib/authCookie.js";

const registerRouter = express.Router();

const NewUser = z.object({
    first_name: z.string().trim().min(1, "Ange ditt förnamn").max(50),
    last_name: z.string().trim().min(1, "Ange ditt efternamn").max(50),
    email: z.string().trim().toLowerCase().pipe(z.email("Ange en giltig e-postadress")),
    // bcrypt only uses the first 72 bytes – reject longer instead of silently cutting
    password: z
        .string()
        .min(8, "Lösenordet måste vara minst 8 tecken")
        .max(72, "Lösenordet får vara högst 72 tecken"),
});

/* --- POST /api/register { first_name, last_name, email, password } --- */
registerRouter.post("/", async (req, res, next) => {
    const parsed = NewUser.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Ogiltiga uppgifter" });
    }
    const { first_name, last_name, email, password } = parsed.data;

    try {
        // Email is unique – tell the customer how to log in instead
        const { rows: [existing] } = await pool.query(
            "SELECT google_sub IS NOT NULL AS has_google FROM user_ WHERE lower(email) = lower($1)",
            [email]
        );
        if (existing) {
            return res.status(409).json({
                error: existing.has_google
                    ? "Det finns redan ett konto med den här e-postadressen. Logga in med Google."
                    : "Det finns redan ett konto med den här e-postadressen. Logga in i stället.",
            });
        }

        const hash = await bcrypt.hash(password, 12);

        const { rows: [user] } = await pool.query(
            `INSERT INTO user_ (first_name, last_name, email, pw_hash, role)
             VALUES ($1, $2, $3, $4, 'user')
             RETURNING id, first_name, role`,
            [first_name, last_name, email, hash]
        );

        // Logged in straight away – same cookie as the other login methods
        setAuthCookie(res, user);

        return res.status(201).json({
            success: true,
            user_id: user.id,
            username: user.first_name,
            role: user.role,
        });
    } catch (err) {
        if (err.code === "23505") {
            // Two sign-ups with the same email at the same moment
            return res.status(409).json({ error: "Det finns redan ett konto med den här e-postadressen." });
        }
        next(err);
    }
});

export default registerRouter;
