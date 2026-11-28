import { useState } from "react";

async function request(token, path, body) {
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: "Bearer " + token,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });

  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error("Unexpected server response. Check the backend.");
  }

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Request failed.");
  }

  return result;
}

export default function CourseAnnouncements({
  courseId,
  token,
  canPublish = false,
}) {
  const [announcements, setAnnouncements] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function refreshAnnouncements() {
    const result = await request(
      token,
      "/api/courses/" + courseId + "/announcements"
    );

    setAnnouncements(result.announcements);
    setLoaded(true);
  }

  function showError(err) {
    setError(
      err.name === "TimeoutError"
        ? "Request timed out. Load announcements before trying again."
        : err.message
    );
  }

  async function loadAnnouncements() {
    if (busy || !courseId) return;

    setBusy(true);
    setError("");
    setMessage("");

    try {
      await refreshAnnouncements();
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  }

  async function publishAnnouncement(event) {
    event.preventDefault();

    if (busy || !courseId || !title.trim() || !body.trim()) return;

    setBusy(true);
    setError("");
    setMessage("");

    try {
      await request(
        token,
        "/api/instructor/courses/" + courseId + "/announcements",
        { title: title.trim(), body: body.trim() }
      );

      setTitle("");
      setBody("");
      setMessage("Announcement published.");
      await refreshAnnouncements();
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Course announcements">
      <h3>Course announcements</h3>

      {canPublish && (
        <form onSubmit={publishAnnouncement}>
          <h4>Publish an announcement</h4>

          <label>
            Title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              required
              disabled={busy}
            />
          </label>

          <label>
            Message
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={10000}
              rows={4}
              required
              disabled={busy}
            />
          </label>

          <button
            type="submit"
            disabled={busy || !courseId || !title.trim() || !body.trim()}
          >
            {busy ? "Please wait..." : "Publish announcement"}
          </button>
        </form>
      )}

      <button
        type="button"
        onClick={loadAnnouncements}
        disabled={busy || !courseId}
      >
        {busy ? "Please wait..." : "Load announcements"}
      </button>

      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}

      {loaded && announcements.length === 0 && (
        <p>No announcements yet.</p>
      )}

      {announcements.map((announcement) => (
        <article key={announcement.id}>
          <h4>{announcement.title}</h4>
          <p>Author: {announcement.author_name}</p>
          <p style={{ whiteSpace: "pre-wrap" }}>{announcement.body}</p>
          <p>
            <time dateTime={announcement.created_at}>
              {new Date(announcement.created_at).toLocaleString()}
            </time>
          </p>
        </article>
      ))}
    </section>
  );
}