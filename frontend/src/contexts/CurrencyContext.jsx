import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'

const CurrencyContext = createContext(null)
const API_URL = import.meta.env.VITE_API_URL
const BASE = 'SEK'

export function CurrencyProvider({ children }) {
    const [rates, setRates] = useState({ [BASE]: 1 })
    const [currency, setCurrency] = useState(() => localStorage.getItem('currency') ?? BASE)

    useEffect(() => {
        fetch(`${API_URL}/currency/rates`)
            .then((res) => {
                if (!res.ok) throw new Error(`Kunde inte hämta kurser (${res.status})`)
                return res.json()
            })
            .then((data) => setRates({ [BASE]: 1, ...data.rates }))
            .catch((err) => console.error(err))
    }, [])

    useEffect(() => {
        localStorage.setItem('currency', currency)
    }, [currency])

    const formatPrice = useCallback((priceInSek) => {
        const rate = rates[currency]
        // Om kurserna inte laddats än (eller misslyckats) visas priset i SEK
        const [cur, amount] = rate ? [currency, priceInSek * rate] : [BASE, priceInSek]
        return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: cur }).format(amount)
    }, [rates, currency])

    const value = useMemo(() => ({
        currency,
        setCurrency,
        currencies: Object.keys(rates),
        formatPrice,
    }), [currency, rates, formatPrice])

    return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}

export function useCurrency() {
    const ctx = useContext(CurrencyContext)
    if (!ctx) throw new Error('useCurrency måste användas inom en CurrencyProvider')
    return ctx
}