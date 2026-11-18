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

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function orderConfirmation(order) {
  const total = order.items.reduce((sum, item) => sum + item.quantity * item.price, 0)

  const subject = `Tack för din beställning! Order: ${order.id}`

  // In your shop:
  // 1. Show order.items in a <table>: product, quantity, price – and the total
  // 2. Escape ALL data that comes from the user (name, e-mail, …) before it goes into the HTML

  const rows = order.items.map((item) => `
    <tr>
      <td>${escapeHtml(item.title)}</td>
      <td>${item.quantity}</td>
      <td>${item.price} kr</td>
    </tr>`).join('');

  const html = `
    <h1>Tack för din beställning!</h1>
    <p>Order: ${escapeHtml(order.id)}<br>Namn: ${escapeHtml(order.name)}<br>E-mail: ${escapeHtml(order.email)}</p>
    <table>
      <tr>
        <th>
          Produkt
        </th>
        <th>
          Antal
        </th>
        <th>Pris/st.</th>
      </tr>
      ${rows}
      <tr>
        <td colSpan="3" align="right">Total: ${total} kr</td>
      </tr>
    </table>`

  // The same content without HTML – for e-mail programs that don't show HTML, and for spam filters
  const textRows = order.items
    .map((item) => `${item.quantity} × ${item.title} – ${item.price} kr/st.`)
    .join('\n')

  const text = `Tack för din beställning!

    Order: ${order.id}
    Namn: ${order.name}
    E-mail: ${order.email}

    ${textRows}

    Total: ${total} kr`;

  return { subject, html, text }
}