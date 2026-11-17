import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { sendEmail } from '../_integrations/emailAdapter.js'
import { orderConfirmation } from '../_lib/orderConfirmation.js'

const router = Router()

// TEST ONLY – ta bort innan du deployar
router.post('/test-email', async (req, res) => {
    const { name, email } = req.body
    const order = {
        id: randomUUID().slice(0, 8),
        name,
        email,
        items: [
            { title: 'Hoodie, black, M', quantity: 1, price: 499 },
            { title: 'Cap', quantity: 2, price: 149 },
        ],
    }

    try {
        const { subject, html, text } = orderConfirmation(order)
        const id = await sendEmail({ to: order.email, subject, html, text })
        console.log('[EMAIL] Sent', subject, 'to', order.email, '– Resend id:', id)
        res.status(201).json({ orderId: order.id, emailSent: true })
    } catch (err) {
        console.error('[EMAIL] Failed:', err)
        res.status(201).json({ orderId: order.id, emailSent: false })
    }
})

export default router