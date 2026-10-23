import useImport from "../../hooks/useImport";
import "./Import.css";

// Nya, uppdaterade och oförändrade: [{ sku, ean }]
const ProductList = ({ title, items = [] }) => (
    <section className="import-table-wrapper">
        <h3>{title} ({items.length})</h3>
        {items.length > 0 && (
            <table className="import-table">
                <thead>
                    <tr>
                        <th>Artikelnr</th>
                        <th>EAN</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, i) => (
                        <tr key={`${item.ean}-${i}`}>
                            <td>{item.sku ?? "–"}</td>
                            <td>{item.ean ?? "–"}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        )}
    </section>
);

const Import = () => {
    const { runImport, result, loading, error } = useImport();

    const inserted = result?.inserted ?? [];
    const updated = result?.updated ?? [];
    const unchanged = result?.unchanged ?? [];
    const skipped = result?.skipped ?? [];

    return (
        <div className="import-wrapper">
            <h1>Importera</h1>
            <div className="import-buttons">
                <button onClick={() => runImport("csv")} disabled={loading !== null}>
                    {loading === "csv" ? "Importerar…" : "Från CSV"}
                </button>
                <button onClick={() => runImport("xml")} disabled={loading !== null}>
                    {loading === "xml" ? "Importerar…" : "Från XML"}
                </button>
            </div>

            {error && <p role="alert" style={{ color: "crimson" }}>{error}</p>}

            {result && (
                <div>
                    <h2>Resultat ({result.format.toUpperCase()})</h2>
                    <p>
                        {inserted.length} nya · {updated.length} uppdaterade ·{" "}
                        {unchanged.length} oförändrade · {skipped.length} överhoppade
                    </p>

                    {/* Produkterna är sparade, men sökningen visar inte ändringarna */}
                    {result.indexError && (
                        <p role="alert" style={{ color: "crimson" }}>{result.indexError}</p>
                    )}

                    <ProductList title="Nya" items={inserted} />
                    <ProductList title="Uppdaterade" items={updated} />
                    <ProductList title="Oförändrade" items={unchanged} />

                    <section className="import-table-wrapper">
                        <h3>Överhoppade ({skipped.length})</h3>
                        {skipped.length > 0 && (
                            <table className="import-table">
                                <thead>
                                    <tr>
                                        <th>Rad</th>
                                        <th>Artikelnr</th>
                                        <th>EAN</th>
                                        <th>Anledning</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {skipped.map((s, i) => (
                                        <tr key={`${s.sku ?? s.ean}-${i}`}>
                                            <td>{s.row ?? "–"}</td>
                                            <td>{s.sku ?? "–"}</td>
                                            <td>{s.ean ?? "–"}</td>
                                            <td>{s.reason}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </section>
                </div>
            )}
        </div>
    );
};

export default Import;