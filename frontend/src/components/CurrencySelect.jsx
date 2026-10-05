import { useCurrency } from '../contexts/CurrencyContext'

export default function CurrencySelect() {
    const { currency, setCurrency, currencies } = useCurrency()

    return (
        <select className='currency-select' value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
    )
}