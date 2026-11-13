import { useEffect, useState } from "react";

async function bookmarkRequest(path, token, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
  });

  const text = await response.text();
  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Invalid server response. Check backend restart.");
  }

  if (!response.ok) {
    throw new Error(data.message || "Bookmark request failed.");
  }

  return data;
}

function formatTime(seconds) {
  return (
    Math.floor(seconds / 60) +
    ":" +
    String(seconds % 60).padStart(2, "0")
  );
}

export default function LessonBookmarks({ lessonId, token, videoRef }) {
  const [bookmarks, setBookmarks] = useState([]);
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const path = "/api/student/lessons/" + lessonId + "/bookmarks";

  useEffect(() => {
    const controller = new AbortController();

    bookmarkRequest(path, token, { signal: controller.signal })
      .then((data) => {
        setBookmarks(data.bookmarks);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [path, token]);

  async function addBookmark() {
    const video = videoRef.current;

    if (!video || !Number.isFinite(video.duration)) {
      setError("Wait for the video to load.");
      return;
    }

    setBusy(true);
    setMessage("");
    setError("");

    try {
      const data = await bookmarkRequest(path, token, {
        method: "POST",
        body: JSON.stringify({
          positionSeconds: Math.min(
            86400,
            Math.max(0, Math.floor(video.currentTime))
          ),
          label,
        }),
      });

      setBookmarks((previous) =>
        [
          ...previous.filter((item) => item.id !== data.bookmark.id),
          data.bookmark,
        ].sort((a, b) => a.position_seconds - b.position_seconds)
      );

      setLabel("");
      setMessage("Bookmark saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteBookmark(id) {
    setBusy(true);
    setMessage("");
    setError("");

    try {
      await bookmarkRequest(path + "/" + id, token, {
        method: "DELETE",
      });

      setBookmarks((previous) => previous.filter((item) => item.id !== id));
      setMessage("Bookmark deleted.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function jumpTo(seconds) {
    const video = videoRef.current;

    if (!video || !Number.isFinite(video.duration)) {
      setError("Wait for the video to load.");
      return;
    }

    video.currentTime = Math.min(seconds, video.duration);
    video.focus();
  }

  return (
    <section>
      <h4>My bookmarks</h4>

      <label>
        Bookmark label (optional)
        <input
          value={label}
          maxLength={200}
          onChange={(event) => setLabel(event.target.value)}
        />
      </label>

      <button
        type="button"
        disabled={loading || busy}
        onClick={addBookmark}
      >
        Bookmark current time
      </button>

      {loading && <p>Loading bookmarks...</p>}

      {!loading && bookmarks.length === 0 && (
        <p>No bookmarks yet.</p>
      )}

      <ul>
        {bookmarks.map((bookmark) => (
          <li key={bookmark.id}>
            <button
              type="button"
              onClick={() => jumpTo(bookmark.position_seconds)}
            >
              {formatTime(bookmark.position_seconds)}
              {bookmark.label ? " — " + bookmark.label : ""}
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => deleteBookmark(bookmark.id)}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>

      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}