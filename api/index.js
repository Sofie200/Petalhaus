import express from "express";
import cors from "cors";
import loginRouter from "./_routes/login-routes.js";
import productRouter from "./_routes/product-routes.js";
import cartRouter from "./_routes/cart-routes.js";
import checkoutRouter from "./_routes/checkout-routes.js";
import userRouter from "./_routes/user-routes.js";
import orderRouter from "./_routes/order-routes.js";
import currencyRouter from "./_routes/currency-routes.js";
import importRouter from "./_routes/import-routes.js";
import adminRouter from "./_routes/admin-routes.js";
import searchRouter from "./_routes/search-routes.js";

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
    origin: "http://localhost:5173",
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/login", loginRouter);
app.use("/api/products", productRouter);
app.use("/api/cart", cartRouter);
app.use("/api/checkout", checkoutRouter);
app.use("/api/user", userRouter);
app.use("/api/orders", orderRouter);
app.use("/api/currency", currencyRouter);
app.use("/api/import", importRouter);
app.use('/api/admin', adminRouter);
app.use('/api/search', searchRouter);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: "Route not found" });
});

// GLOBAL error handler
app.use((err, req, res, next) => {
    console.error("GLOBAL ERROR:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
});

if (!process.env.VERCEL) {
    app.listen(port, () => {
        console.log(`Backend running on port ${port}`);
    });
}

export default app;