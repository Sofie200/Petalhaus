const BASE_URL = 'https://api.frankfurter.dev/v1'

// https://api.frankfurter.dev/v1/latest?base=SEK&symbols=SEK,USD,EUR

export async function getRates(base = 'SEK', symbols = ['SEK', 'DKK', 'NOK', 'EUR'])  {
    const url = new URL(`${BASE_URL}/latest`)
    url.searchParams.set('base', base)
    url.searchParams.set('symbols', symbols.join(','))
    
    try {
        const response = await fetch(url)
        // console.log(response);
        const data = await response.json()
        
        return {
          base: data.base,
          date: data.date,
          rates: data.rates
        }
    } catch(err) {
        throw new Error('Something when wrong')
    }
}