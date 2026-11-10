import jwt from "jsonwebtoken";

// Same cookie for password login and Google login
export const COOKIE_OPTIONS = {
    httpOnly: true,                       // JS in the browser can't read it
    sameSite: "lax",
    secure: process.env.VERCEL === "1",   // HTTPS-only on Vercel
    maxAge: 8 * 60 * 60 * 1000,           // 8 hours
};

export function setAuthCookie(res, user) {
    const token = jwt.sign(
        { user_id: user.id, username: user.first_name, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "8h" }
    );
    res.cookie("TokenCookie", token, COOKIE_OPTIONS);
}