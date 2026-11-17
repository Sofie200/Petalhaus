// The order confirmation's content – the shop's own code, Resend doesn't know about orders.

/**
 * @typedef {Object} OrderItem
 * @property {string} title
 * @property {number} quantity
 * @property {number} price - price in SEK per item
 */

/**
 * @typedef {Object} Order
 * @property {string} id
 * @property {string} name
 * @property {string} email
 * @property {OrderItem[]} items
 */

/**
 * @param {Order} order
 * @returns {{ subject: string, html: string, text: string }}
 */
export function orderConfirmation(order) {
  const total = order.items.reduce((sum, item) => sum + item.quantity * item.price, 0)

  const subject = `Order confirmation ${order.id}`

  // In your shop:
  // 1. Show order.items in a <table>: product, quantity, price – and the total
  // 2. Escape ALL data that comes from the user (name, e-mail, …) before it goes into the HTML
  const html = `
    <h1>Thank you for your order!</h1>
    <p>Name: ${order.name}<br>E-mail: ${order.email}<br>Total: ${total} kr</p>`

  // The same content without HTML – for e-mail programs that don't show HTML, and for spam filters
  const text = `Thank you for your order!\n\nName: ${order.name}\nE-mail: ${order.email}\nTotal: ${total} kr`

  return { subject, html, text }
}