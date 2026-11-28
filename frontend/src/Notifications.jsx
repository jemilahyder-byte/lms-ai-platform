import { useState } from "react";

async function request(token, path, body) {
  const response = await fetch(path, {
    method: body ? "PATCH" : "GET",
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

export default function Notifications({ token }) {
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function refresh() {
    const result = await request(token, "/api/notifications");
    setItems(result.notifications);
    setUnreadCount(result.unread_count);
    setLoaded(true);
  }

  function showError(err) {
    setError(
      err.name === "TimeoutError"
        ? "Request timed out. Reload notifications before trying again."
        : err.message
    );
  }

  async function loadNotifications() {
    if (busy) return;

    setBusy(true);
    setError("");
    setMessage("");

    try {
      await refresh();
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  }

  async function updateReadStatus(item) {
    if (busy) return;

    setBusy(true);
    setError("");
    setMessage("");

    const read = !item.read_at;

    try {
      await request(token, "/api/notifications/" + item.id, { read });
      setMessage(read ? "Marked as read." : "Marked as unread.");
      await refresh();
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Notifications">
      <h3>Notifications</h3>

      <button type="button" onClick={loadNotifications} disabled={busy}>
        {busy ? "Please wait..." : "Load notifications"}
      </button>

      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}

      {loaded && (
        <p role="status">
          Unread: {unreadCount}. Showing up to 100 latest notifications.
        </p>
      )}

      {loaded && items.length === 0 && <p>No notifications yet.</p>}

      {items.map((item) => (
        <article key={item.id}>
          <h4>{item.title}</h4>
          <p>Course: {item.course_title}</p>
          <p>Author: {item.author_name}</p>
          <p style={{ whiteSpace: "pre-wrap" }}>{item.body}</p>
          <p>
            <time dateTime={item.created_at}>
              {new Date(item.created_at).toLocaleString()}
            </time>
          </p>
          <p>Status: {item.read_at ? "Read" : "Unread"}</p>

          <button
            type="button"
            disabled={busy}
            onClick={() => updateReadStatus(item)}
          >
            {item.read_at ? "Mark as unread" : "Mark as read"}
          </button>
        </article>
      ))}
    </section>
  );
}