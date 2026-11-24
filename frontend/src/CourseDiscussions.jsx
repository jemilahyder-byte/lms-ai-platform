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
    throw new Error("API unavailable. Check the backend.");
  }

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Request failed.");
  }

  return result;
}

export default function CourseDiscussions({ courseId, token }) {
  const [posts, setPosts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reportingId, setReportingId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const busy = loading || saving;

  async function loadPosts() {
    if (busy || !courseId) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const result = await request(
        token,
        "/api/courses/" + courseId + "/discussion-posts"
      );

      setPosts(result.posts);
      setLoaded(true);
      setReportingId("");
      setReason("");
    } catch (err) {
      setError(err.message || "Could not load posts.");
    } finally {
      setLoading(false);
    }
  }

  async function submitReport(event) {
    event.preventDefault();

    if (busy || !reportingId || !reason.trim()) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const result = await request(
        token,
        "/api/discussions/posts/" + reportingId + "/report",
        { reason: reason.trim() }
      );

      setPosts((current) =>
        current.map((post) =>
          post.id === reportingId
            ? { ...post, already_reported: true }
            : post
        )
      );

      setReportingId("");
      setReason("");
      setMessage(result.message || "Report submitted.");
    } catch (err) {
      setError(err.message || "Could not submit report.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h3>Course discussion posts</h3>

      <button
        type="button"
        onClick={loadPosts}
        disabled={busy || !courseId}
      >
        {loading ? "Loading..." : "Load discussion posts"}
      </button>

      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}

      {loaded && posts.length === 0 && (
        <p>No visible discussion posts.</p>
      )}

      {loaded && posts.length > 0 && (
        <p>Showing up to 100 latest visible posts.</p>
      )}

      {posts.map((post) => (
        <article key={post.id}>
          <h4>{post.thread_title}</h4>
          <p>Author: {post.author_name}</p>
          <p style={{ whiteSpace: "pre-wrap" }}>{post.body}</p>

          {post.already_reported ? (
            <p>You have already reported this post.</p>
          ) : reportingId === post.id ? (
            <form onSubmit={submitReport}>
              <label>
                Reason for reporting
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  required
                  maxLength={1000}
                  disabled={busy}
                  rows={3}
                />
              </label>

              <button
                type="submit"
                disabled={busy || !reason.trim()}
              >
                {saving ? "Submitting..." : "Submit report"}
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setReportingId("");
                  setReason("");
                }}
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setReportingId(post.id);
                setReason("");
                setError("");
                setMessage("");
              }}
            >
              Report post
            </button>
          )}
        </article>
      ))}
    </section>
  );
}