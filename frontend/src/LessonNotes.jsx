import { useEffect, useState } from "react";

export default function LessonNotes({ lessonId, token }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadNote() {
      try {
        const response = await fetch(
          "/api/student/lessons/" + lessonId + "/note",
          {
            headers: { Authorization: "Bearer " + token },
            signal: controller.signal,
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Could not load note.");
        }

        setContent(data.note.content);
        setLoading(false);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message);
          setLoading(false);
        }
      }
    }

    loadNote();
    return () => controller.abort();
  }, [lessonId, token]);

  async function saveNote() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        "/api/student/lessons/" + lessonId + "/note",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not save note.");
      }

      setMessage("Note saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p>Loading notes...</p>;
  }

  return (
    <section>
      <h4>My lesson notes</h4>

      <textarea
        aria-label="My lesson notes"
        value={content}
        maxLength={20000}
        rows={6}
        onChange={(event) => {
          setContent(event.target.value);
          setMessage("");
        }}
        style={{ width: "100%", boxSizing: "border-box", padding: 10 }}
      />

      <button type="button" disabled={saving} onClick={saveNote}>
        {saving ? "Saving..." : "Save note"}
      </button>

      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}