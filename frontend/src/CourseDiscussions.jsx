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

export default function CourseDiscussions({ courseId, token }) {
  const [posts, setPosts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [action, setAction] = useState(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function refreshPosts() {
    const result = await request(
      token,
      "/api/courses/" + courseId + "/discussion-posts"
    );
    setPosts(result.posts);
    setLoaded(true);
  }

  function showError(err) {
    setError(
      err.name === "TimeoutError"
        ? "Request timed out. Reload posts before trying again."
        : err.message || "Request failed."
    );
  }

  async function loadPosts() {
    if (busy || !courseId) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await refreshPosts();
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  }

  async function createDiscussion(event) {
    event.preventDefault();
    if (busy || !title.trim() || !body.trim()) return;

    setBusy(true);
    setError("");
    setMessage("");

    try {
      await request(
        token,
        "/api/courses/" + courseId + "/discussions",
        { title: title.trim(), body: body.trim() }
      );
      setTitle("");
      setBody("");
      setMessage("Discussion created.");
      await refreshPosts();
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  }

  function openAction(type, post) {
    setAction({
      type,
      postId: post.id,
      threadId: post.thread_id,
    });
    setText("");
    setError("");
    setMessage("");
  }

  async function submitAction(event) {
    event.preventDefault();
    if (busy || !action || !text.trim()) return;

    setBusy(true);
    setError("");
    setMessage("");

    try {
      if (action.type === "report") {
        await request(
          token,
          "/api/discussions/posts/" + action.postId + "/report",
          { reason: text.trim() }
        );
        setPosts((current) =>
          current.map((post) =>
            post.id === action.postId
              ? { ...post, already_reported: true }
              : post
          )
        );
        setMessage("Report submitted for admin review.");
        setAction(null);
        setText("");
      } else {
        await request(
          token,
          "/api/discussions/threads/" + action.threadId + "/replies",
          { body: text.trim() }
        );
        setMessage("Reply posted.");
        setAction(null);
        setText("");
        await refreshPosts();
      }
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h3>Course discussions</h3>

      <h4>Start a discussion</h4>
      <form onSubmit={createDiscussion}>
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
          Create discussion
        </button>
      </form>

      <button
        type="button"
        onClick={loadPosts}
        disabled={busy || !courseId}
      >
        {busy ? "Please wait..." : "Load discussion posts"}
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

          <button
            type="button"
            disabled={busy || !post.thread_id}
            onClick={() => openAction("reply", post)}
          >
            Reply to discussion
          </button>

          {post.already_reported ? (
            <p>You have already reported this post.</p>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => openAction("report", post)}
            >
              Report post
            </button>
          )}

          {action?.postId === post.id && (
            <form onSubmit={submitAction}>
              <label>
                {action.type === "report" ? "Report reason" : "Your reply"}
                <textarea
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  maxLength={action.type === "report" ? 1000 : 10000}
                  rows={3}
                  required
                  disabled={busy}
                />
              </label>

              <button type="submit" disabled={busy || !text.trim()}>
                {action.type === "report" ? "Submit report" : "Post reply"}
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setAction(null);
                  setText("");
                }}
              >
                Cancel
              </button>
            </form>
          )}
        </article>
      ))}
    </section>
  );
}