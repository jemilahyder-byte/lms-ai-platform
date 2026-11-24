import { useState } from "react";

async function request(token, path = "", action) {
  const response = await fetch(
    "/api/admin/discussion-reports" + path,
    {
      method: action ? "PATCH" : "GET",
      headers: {
        Authorization: "Bearer " + token,
        ...(action ? { "Content-Type": "application/json" } : {}),
      },
      ...(action ? { body: JSON.stringify({ action }) } : {}),
      signal: AbortSignal.timeout(15000),
    }
  );

  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error("Unexpected response. Check the backend server.");
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Request failed.");
  }

  return data;
}

export default function AdminModeration({ token }) {
  const [reports, setReports] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pendingId, setPendingId] = useState("");
  const [filter, setFilter] = useState("pending");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const busy = loading || Boolean(pendingId);

  const visibleReports = reports.filter(
    (report) => filter === "all" || report.status === filter
  );

  async function loadReports() {
    if (busy) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const data = await request(token);
      setReports(data.reports);
      setLoaded(true);
    } catch (err) {
      setError(err.message || "Could not load reports.");
    } finally {
      setLoading(false);
    }
  }

  async function moderate(report, action) {
    if (busy) return;

    setPendingId(report.id);
    setError("");
    setMessage("");

    try {
      const data = await request(token, "/" + report.id, action);

      // Update all displayed reports referring to the same post.
      setReports((previous) =>
        previous.map((item) => {
          if (action === "dismiss") {
            return item.id === report.id
              ? { ...item, status: "dismissed" }
              : item;
          }

          if (item.post_id !== report.post_id) return item;

          return {
            ...item,
            is_hidden: action === "hide",
            status:
              action === "hide" && item.status === "pending"
                ? "resolved"
                : action === "restore" && item.id === report.id
                  ? "dismissed"
                  : item.status,
          };
        })
      );

      setMessage(data.message);
    } catch (err) {
      setError(err.message || "Could not update report.");
    } finally {
      setPendingId("");
    }
  }

  return (
    <section>
      <h3>Reported posts moderation</h3>

      <button type="button" onClick={loadReports} disabled={busy}>
        {loading ? "Loading..." : "Load reports"}
      </button>

      <label>
        Show reports
        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          disabled={busy}
        >
          <option value="pending">Pending</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
          <option value="all">All</option>
        </select>
      </label>

      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}

      {loaded && <p>Showing the latest 200 reports.</p>}

      {loaded && visibleReports.length === 0 && (
        <p>No {filter === "all" ? "" : filter + " "}reports.</p>
      )}

      {visibleReports.map((report) => (
        <article
          key={report.id}
          style={{
            background: "white",
            padding: 16,
            marginTop: 16,
            borderRadius: 10,
          }}
        >
          <h4>{report.course_title}</h4>
          <p>Discussion: {report.thread_title}</p>
          <p>Author: {report.author_name}</p>

          <blockquote style={{ whiteSpace: "pre-wrap" }}>
            {report.body}
          </blockquote>

          <p>Reported by: {report.reporter_name}</p>
          <p style={{ whiteSpace: "pre-wrap" }}>
            Reason: {report.reason}
          </p>

          <p>
            Report: {report.status} | Post:{" "}
            {report.is_hidden ? "Hidden" : "Visible"}
          </p>

          <p>
            Reported: {new Date(report.created_at).toLocaleString()}
          </p>

          <fieldset disabled={busy}>
            <legend>Moderation actions</legend>

            {report.is_hidden ? (
              <button
                type="button"
                onClick={() => moderate(report, "restore")}
              >
                Restore post
              </button>
            ) : (
              <button
                type="button"
                onClick={() => moderate(report, "hide")}
              >
                Hide post
              </button>
            )}

            {report.status === "pending" && (
              <button
                type="button"
                onClick={() => moderate(report, "dismiss")}
              >
                Dismiss report
              </button>
            )}
          </fieldset>

          {pendingId === report.id && (
            <p role="status">Updating...</p>
          )}
        </article>
      ))}
    </section>
  );
}