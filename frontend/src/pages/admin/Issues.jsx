import { useCallback, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { faArrowUpRightFromSquare, faRotateRight, faCircleCheck } from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "../../hooks/useAuth";
import Loading from "../../components/Loading";
import "./Issues.css";

const API = import.meta.env.VITE_API_URL;

const TITLE_MAX = 200;
const DESCRIPTION_MAX = 5000;
const EMPTY_FORM = { title: "", description: "" };

// The server answers { error } when something goes wrong – use it, or a fallback
async function errorFrom(res, fallback) {
    if (res.status === 401) return "Du är inte inloggad längre. Logga in med GitHub igen.";
    if (res.status === 403) return "Du har inte behörighet att se den här sidan.";
    const data = await res.json().catch(() => null);
    return data?.error ?? fallback;
}

const Issues = () => {
    const { user } = useAuth();

    // The list of open issues
    const [issues, setIssues] = useState(null); // null = not loaded yet
    const [listError, setListError] = useState("");
    const [refreshing, setRefreshing] = useState(false);

    // The "report a problem" form
    const [form, setForm] = useState(EMPTY_FORM);
    const [sending, setSending] = useState(false);
    const [formError, setFormError] = useState("");
    const [created, setCreated] = useState(null); // the issue we just created

    const loadIssues = useCallback(async () => {
        setRefreshing(true);
        setListError("");
        try {
            const res = await fetch(`${API}/admin/issues`, { credentials: "include" });
            if (!res.ok) throw new Error(await errorFrom(res, "Kunde inte hämta issues från GitHub."));
            setIssues(await res.json());
        } catch (err) {
            setListError(err.message || "Kunde inte hämta issues från GitHub.");
        } finally {
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadIssues();
    }, [loadIssues]);

    const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

    async function handleSubmit(e) {
        e.preventDefault();
        setFormError("");
        setCreated(null);
        setSending(true);

        try {
            const res = await fetch(`${API}/admin/issues`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(form),
            });
            if (!res.ok) throw new Error(await errorFrom(res, "GitHub skapade inte issuen. Försök igen."));

            setCreated(await res.json());
            setForm(EMPTY_FORM);
            loadIssues(); // the new issue shows up in the list
        } catch (err) {
            setFormError(err.message || "Något gick fel. Försök igen.");
        } finally {
            setSending(false);
        }
    }

    const canSend = form.title.trim() && form.description.trim() && !sending;

    return (
        <div className="issues-page">
            <header className="issues-header">
                <div className="issues-header-icon" aria-hidden="true">
                    <FontAwesomeIcon icon={faGithub} />
                </div>
                <div>
                    <p className="issues-eyebrow">Admin</p>
                    <h2>GitHub Issues</h2>
                    <p className="issues-lead">
                        Rapportera fel i butiken. De hamnar som issues i shoppens repo på GitHub.
                    </p>
                </div>
            </header>

            <div className="issues-layout">
                {/* --- Report a problem --- */}
                <section className="issues-card issues-card--inverted" aria-labelledby="new-issue-title">
                    <h3 id="new-issue-title">Rapportera ett problem</h3>

                    <form onSubmit={handleSubmit}>
                        <label htmlFor="issue-title">Rubrik</label>
                        <input
                            id="issue-title"
                            type="text"
                            value={form.title}
                            onChange={update("title")}
                            maxLength={TITLE_MAX}
                            placeholder="T.ex. Produktbilden laddar inte"
                            required
                        />

                        <label htmlFor="issue-description">Beskrivning</label>
                        <textarea
                            id="issue-description"
                            value={form.description}
                            onChange={update("description")}
                            maxLength={DESCRIPTION_MAX}
                            placeholder="Vad hände? Var i butiken? Hur kan man återskapa felet?"
                            rows={6}
                            required
                        />
                        <span className="issues-counter" aria-live="polite">
                            {form.description.length} / {DESCRIPTION_MAX}
                        </span>

                        {user?.username && (
                            <p className="issues-reporter">
                                <FontAwesomeIcon icon={faGithub} /> Rapporteras som <strong>@{user.username}</strong>
                            </p>
                        )}

                        {formError && <p className="issues-error" role="alert">{formError}</p>}

                        {created && (
                            <p className="issues-success" role="status">
                                <FontAwesomeIcon icon={faCircleCheck} />
                                <span>
                                    Issue <strong>#{created.number}</strong> skapades.{" "}
                                    <a href={created.url} target="_blank" rel="noreferrer">
                                        Visa på GitHub
                                    </a>
                                </span>
                            </p>
                        )}

                        <div className="buttons">
                            <button type="submit" disabled={!canSend}>
                                {sending ? "Skickar…" : "Skapa issue"}
                            </button>
                        </div>
                    </form>
                </section>

                {/* --- Open issues --- */}
                <section className="issues-card" aria-labelledby="open-issues-title">
                    <div className="issues-list-head">
                        <h3 id="open-issues-title">
                            Öppna issues
                            {issues?.length > 0 && <span className="issues-count">{issues.length}</span>}
                        </h3>
                        <button
                            type="button"
                            className="issues-refresh"
                            onClick={loadIssues}
                            disabled={refreshing}
                            aria-label="Uppdatera listan"
                            title="Uppdatera listan"
                        >
                            <FontAwesomeIcon icon={faRotateRight} spin={refreshing} />
                        </button>
                    </div>

                    {listError && <p className="issues-error" role="alert">{listError}</p>}

                    {!listError && issues === null && <Loading />}

                    {issues?.length === 0 && (
                        <p className="issues-empty">Inga öppna issues – allt ser bra ut! 🌿</p>
                    )}

                    {issues?.length > 0 && (
                        <ul className="issues-list">
                            {issues.map((issue) => (
                                <li key={issue.number}>
                                    <a
                                        className="issue-row"
                                        href={issue.url}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        <span className="issue-number">#{issue.number}</span>
                                        <span className="issue-main">
                                            <span className="issue-title">{issue.title}</span>
                                            <span className="issue-author">av {issue.author}</span>
                                        </span>
                                        <FontAwesomeIcon
                                            icon={faArrowUpRightFromSquare}
                                            className="issue-open"
                                            aria-label="Öppnas på GitHub"
                                        />
                                    </a>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </div>
    );
};

export default Issues;
