// The customer picks how the order is delivered: postal code → ombud or home delivery → (ombud) which one.
// Prices and delivery times come from OUR API – it calculates them on the server, from OUR prices.
import { useEffect, useState } from "react";
import Loading from "./Loading";

const API = import.meta.env.VITE_API_URL;
const POSTAL_CODE = /^\d{3}\s?\d{2}$/;
const TIMEOUT_MS = 15_000;

const formatPrice = (kr) =>
    new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 0 }).format(kr);

function formatEstimate(estimate) {
    if (estimate?.deliveryDate) {
        const date = new Date(estimate.deliveryDate).toLocaleDateString("sv-SE", {
            weekday: "long",
            day: "numeric",
            month: "long",
        });
        return `Beräknad leverans ${date}`;
    }
    if (estimate?.transitDays != null) {
        return `Beräknad leveranstid ${estimate.transitDays} ${estimate.transitDays === 1 ? "dag" : "dagar"}`;
    }
    return null; // PostNord didn't answer – show the price without a delivery time
}

export default function ShippingPicker({ cart, onChange }) {
    const [postalCode, setPostalCode] = useState("");
    const [quote, setQuote] = useState(null);
    const [servicePoints, setServicePoints] = useState([]);
    const [method, setMethod] = useState("service_point");
    const [servicePointId, setServicePointId] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const cleanPostalCode = postalCode.replace(/\s/g, "");
    const isValidPostalCode = POSTAL_CODE.test(postalCode.trim());
    const cartKey = cart.map((i) => `${i.id}:${i.quantity}`).join(",");

    // 1. A valid postal code → fetch prices/delivery times and the nearest service points, in parallel
    useEffect(() => {
        setError(null);
        if (!isValidPostalCode) {
            setQuote(null);
            setServicePoints([]);
            setServicePointId("");
            return;
        }

        const controller = new AbortController();
        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(TIMEOUT_MS)]);
        setLoading(true);

        (async () => {
            try {
                const [quoteRes, spRes] = await Promise.all([
                    fetch(`${API}/shipping/quote`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            postalCode: cleanPostalCode,
                            items: cart.map(({ id, quantity }) => ({ id, quantity })),
                        }),
                        signal,
                    }),
                    fetch(`${API}/shipping/service-points?postalCode=${cleanPostalCode}`, { signal }),
                ]);

                const quoteData = await quoteRes.json().catch(() => null);
                if (!quoteRes.ok) throw new Error(quoteData?.error ?? "Kunde inte räkna ut frakten.");
                setQuote(quoteData);

                // No service points? Home delivery still works – say so, but don't block the checkout
                const spData = await spRes.json().catch(() => null);
                if (spRes.ok && spData?.data?.length) {
                    setServicePoints(spData.data);
                    setServicePointId(spData.data[0].id); // nearest one pre-selected
                } else {
                    setServicePoints([]);
                    setServicePointId("");
                    setMethod("home");
                    setError(spData?.error ?? "Inga ombud hittades för postnumret. Välj hemleverans.");
                }
            } catch (err) {
                if (err.name === "AbortError") return; // the customer typed a new postal code
                setQuote(null);
                setError(
                    err.name === "TimeoutError"
                        ? "Det tog för lång tid att hämta fraktalternativen. Försök igen."
                        : err.name === "TypeError"
                            ? "Kunde inte nå servern. Kontrollera din anslutning."
                            : err.message
                );
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        })();

        return () => controller.abort();
        // cart is represented by cartKey, so the effect doesn't run on every render
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cleanPostalCode, isValidPostalCode, cartKey]);

    // 2. Tell the checkout what is chosen – or null while the choice isn't complete
    useEffect(() => {
        if (!quote) return onChange(null);

        if (method === "service_point") {
            const sp = servicePoints.find((s) => s.id === servicePointId);
            if (!sp) return onChange(null);
            onChange({ method, postalCode: cleanPostalCode, servicePointId: sp.id, servicePointName: sp.name });
        } else {
            onChange({ method, postalCode: cleanPostalCode });
        }
    }, [quote, method, servicePointId, servicePoints, cleanPostalCode, onChange]);

    return (
        <div className="shipping-picker">

            <label htmlFor="postal-code">Postnummer
                <div className="fineprint">Fyll i postnummer och välj leveranssätt för att gå vidare till betalning.</div>
            </label>
            <input
                id="postal-code"
                inputMode="numeric"
                autoComplete="postal-code"
                placeholder="t.ex. 211 19"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                maxLength={6}
            />

            <br /><br />

            {loading && <Loading /> }
            {error && <span role="alert">{error}<br /><br /></span>}

            {quote && !loading && (
                <>
                    {quote.remainingForFreeShipping > 0 ? (
                        <div className="fineprint">
                            Handla för {formatPrice(quote.remainingForFreeShipping)} till så får du fri frakt.<br />
                        </div>
                    ) : (
                            <div className="fineprint">Du har fri frakt!<br /></div>
                    )}

                    <fieldset>
                        <legend>Leveranssätt</legend>
                        {quote.options.map((option) => {
                            const disabled = option.method === "service_point" && servicePoints.length === 0;
                            const estimate = formatEstimate(option.estimate);
                            return (
                                <label key={option.method} className="shipping-option">
                                    <input
                                        type="radio"
                                        name="shipping-method"
                                        value={option.method}
                                        checked={method === option.method}
                                        onChange={() => setMethod(option.method)}
                                        disabled={disabled}
                                    />
                                    <span>
                                        <strong>{option.label}</strong>{" "}
                                        {option.free ? (
                                            <>
                                                <s>{formatPrice(option.originalPrice)}</s> Gratis
                                            </>
                                        ) : (
                                            formatPrice(option.price)
                                        )}
                                        {estimate && <><div className="fineprint">{estimate}</div></>}
                                    </span>
                                </label>
                            );
                        })}
                    </fieldset>

                    {method === "service_point" && servicePoints.length > 0 && (
                        <fieldset>
                            <legend>Välj ombud</legend>
                            {servicePoints.map((sp) => (
                                <label key={sp.id} className="shipping-option">
                                    <input
                                        type="radio"
                                        name="service-point"
                                        value={sp.id}
                                        checked={servicePointId === sp.id}
                                        onChange={() => setServicePointId(sp.id)}
                                    />
                                    <span>
                                        <strong>{sp.name}</strong>
                                        <br />
                                        <span className="fineprint">
                                            {sp.address}, {sp.postalCode} {sp.city}
                                            {sp.distanceMeters != null && ` · ${(sp.distanceMeters / 1000).toFixed(1)} km`}
                                        </span>
                                    </span>
                                </label>
                            ))}
                        </fieldset>
                    )}
                </>
            )}
        </div>
    );
}
