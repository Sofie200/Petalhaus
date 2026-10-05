import express from "express";
import cors from "cors";
import loginRouter from "./routes/login-routes.js";
import productRouter from "./routes/product-routes.js";
import cartRouter from "./routes/cart-routes.js";
import checkoutRouter from "./routes/checkout-routes.js";
import userRouter from "./routes/user-routes.js";
import orderRouter from "./routes/order-routes.js";
import currencyRouter from "./routes/currency-routes.js";

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

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: "Route not found" });
});

// GLOBAL error handler
app.use((err, req, res, next) => {
    console.error("GLOBAL ERROR:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
});

app.listen(port, () => {
    console.log(`Backend running on port ${port}`);
});