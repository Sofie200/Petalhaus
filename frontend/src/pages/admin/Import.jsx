import useImport from "../../hooks/useImport";
import "./Import.css";

const EanList = ({ title, eans }) => (
    <section className="import-table-wrapper">
        <h3>{title} ({eans.length})</h3>
        {eans.length === 0 ? ( "" ) : (
        <table className="import-table">
            <thead>
                <tr><th>EAN</th></tr>
            </thead>
            <tbody>
                   { eans.map((ean) => (
                        <tr key={ean}><td>{ean}</td></tr>
                   ))}
            </tbody>
        </table>)}
    </section>
);

const Import = () => {
    const { runImport, result, loading, error } = useImport();

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
                        {result.counts.inserted} nya · {result.counts.updated} uppdaterade ·{" "}
                        {result.counts.skipped} överhoppade
                    </p>

                    <EanList title="Nya" eans={result.inserted} />
                    <EanList title="Uppdaterade" eans={result.updated} />

                    <section className="import-table-wrapper">
                        <h3>Överhoppade ({result.skipped.length})</h3>
                        {result.skipped.length === 0 ? <p>Inga</p> : (
                            <table className="import-table">
                                <thead>
                                    <tr><th>Rad</th><th>EAN</th><th>Anledning</th></tr>
                                </thead>
                                <tbody>
                                    {result.skipped.map((s, i) => (
                                        <tr key={`${s.ean}-${i}`}>
                                            <td>{s.row ?? "–"}</td>
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