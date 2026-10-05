import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";

const ShoppingCart = createContext(null);

// Calculate total cost per product
function addSumToItems(items) {
    return items.map(item => ({
        ...item,
        sum: (item.price - item.discount) * item.quantity
    }));
}

// Provider
export function ShoppingCartProvider({ children }) {

    const API = import.meta.env.VITE_API_URL;
    const [cart, setCart] = useState([]);
    const { user } = useAuth();

    useEffect(() => {
        async function loadCart() {

            const token = localStorage.getItem("token");

            // Fetch guest cart
            const guest = JSON.parse(localStorage.getItem("cart_guest") || "[]");

            // If there is no logged in user. Return grouped guest cart.
            if (!user) {
                setCart(addSumToItems(guest));
                return;
            }

            // If there's a logged in user. Save guest items to backend
            for (const item of guest) {
                await fetch(`${API}/cart`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        user_id: user.user_id,
                        product_id: item.id,
                        quantity: item.quantity
                    })
                });
            }

            // Then fetch all cart items from backend.
            const res = await fetch(`${API}/cart/${user.user_id}`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                }
            });

            const backendItems = await res.json();

            const normalized = backendItems.map(item => ({
                id: item.product_id,
                name: item.name,
                image: item.image,
                price: item.price,
                discount: item.discount,
                quantity: item.quantity
            }));

            setCart(addSumToItems(normalized));

            // Remove guest cart
            localStorage.removeItem("cart_guest");

        }

        loadCart();

    }, [API, user]);


    async function addToCart(product) {

        const token = localStorage.getItem("token");

        if (!user) {
            const guest = JSON.parse(localStorage.getItem("cart_guest") || "[]");

            const existing = guest.find(p => p.id === product.id);

            if (existing) {
                existing.quantity = Number(existing.quantity ?? 0) + 1;
            } else {
                guest.push({
                    ...product,
                    quantity: 1
                });
            }

            localStorage.setItem("cart_guest", JSON.stringify(guest));
        }


        // If logged in, send to DB
        if (user) {
            try {
                const res = await fetch(`${API}/cart`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                    body: JSON.stringify({
                        user_id: user.user_id,
                        product_id: product.id,
                        quantity: 1
                    })
                });

                if (!res.ok) {
                    const errorData = await res.json().catch(() => null);
                    console.error("Backend error:", errorData);
                    throw new Error("Kunde inte lägga till varan i varukorgen.");
                }

            } catch (err) {
                console.log(err.message);
            }
        }

        // Update local cart (works for both guest + logged in)
        setCart(prev => {

            // Check if product already exists
            const existing = prev.find(item => item.id === product.id);

            if (existing) {
                // Increase quantity
                const updated = prev.map(item =>
                    item.id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );

                return addSumToItems(updated);
            }

            // Add new product with quantity = 1
            const newItem = { ...product, quantity: 1 };
            return addSumToItems([...prev, newItem]);
        });
    }


    // Remove from cart
    async function removeFromCart(product) {

        const token = localStorage.getItem("token");

        // If logged in, remove to DB
        if (user) {

            try {
                const res = await fetch(`${API}/cart`, {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                    body: JSON.stringify({
                        user_id: user.user_id,
                        product_id: product.id,
                        quantity: 1
                    })
                });

                if (!res.ok) {
                    const errorData = await res.json().catch(() => null);
                    console.error("Backend error:", errorData);
                    throw new Error("Kunde inte ta bort varan från varukorgen.");
                }

                setCart(prev => prev.filter(p => p.id !== product.id));

            } catch (err) {
                console.log(err.message);
            }
        } else {
            setCart(prev => prev.filter(p => p.id !== product.id));
        }
    }

    async function clearCart() {

        const token = localStorage.getItem("token");

        // Empty backend cart
        if (user) {
            try {
                const res = await fetch(`${API}/cart/clear/${user.user_id}`, {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
                });

                if (!res.ok) {
                    const errorData = await res.json().catch(() => null);
                    console.error("Backend error:", errorData);
                    throw new Error("Kunde inte tömma varukorgen.");
                }

            } catch (err) {
                console.log(err.message);
            }
        }

        // Empty localStorage
        localStorage.removeItem("cart_guest");

        // Empty state
        setCart([]);
    }

    // Get cart quantity of specified product
    function getItemQuantity(id) {
        const item = cart.find(p => p.id === id);
        return item ? item.quantity : 0;
    }

    // Get no of items in cart
    function getCartCount() {
        return cart.reduce((total, item) => total + item.quantity, 0);
    }

    async function updateItemQuantity(id, quantity) {
        const token = localStorage.getItem("token");

        // Update backend if user is logged in
        if (user) {
            try {
                await fetch(`${API}/cart`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        user_id: user.user_id,
                        product_id: id,
                        quantity
                    })
                });
            } catch (err) {
                console.error(err);
            }
        } else {
            // ⭐ GUEST MODE: update localStorage
            const guest = JSON.parse(localStorage.getItem("cart_guest") || "[]");

            const updatedGuest = guest.map(item =>
                item.id === id
                    ? { ...item, quantity }
                    : item
            );

            localStorage.setItem("cart_guest", JSON.stringify(updatedGuest));
        }

        // Update frontend state
        setCart(prev =>
            prev.map(item =>
                item.id === id
                    ? { ...item, quantity, sum: (item.price - item.discount) * quantity }
                    : item
            )
        );
    }

    return (
        <ShoppingCart.Provider value={{ cart, addToCart, removeFromCart, clearCart, user, getItemQuantity, updateItemQuantity, getCartCount }}>
            {children}
        </ShoppingCart.Provider>
    );
}

export function useShoppingCart() {
    return useContext(ShoppingCart);
}