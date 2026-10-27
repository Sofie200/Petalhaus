// OUR shipping prices – shop rules, not PostNord's. Used by the shipping routes AND by checkout,
// so the price the customer sees is the same price Stripe charges.

export const FREE_SHIPPING_THRESHOLD = 500; // kr

export const SHIPPING_METHODS = {
    service_point: { label: "Ombud", price: 49, service: "servicePoint" },
    home: { label: "Hemleverans", price: 79, service: "home" },
};

/**
 * The shipping cost for a method and a cart total (both calculated on the server).
 * @param {keyof typeof SHIPPING_METHODS} method
 * @param {number} subtotal  the cart's total in kr, with discounts
 * @returns {number} kr
 */
export function shippingCost(method, subtotal) {
    const option = SHIPPING_METHODS[method];
    if (!option) throw new Error(`Unknown shipping method: ${method}`);

    return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : option.price;
}
