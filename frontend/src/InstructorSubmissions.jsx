import { useEffect, useState } from "react";

async function readResponse(response) {
  const text = await response.text();
  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Invalid server response. Check the backend.");
  }

  if (!response.ok) {
    throw new Error(data.message || "Request failed.");
  }

  return data;
}

function SubmissionCard({ item, token, onGraded }) {
  const [score, setScore] = useState(
    item.score == null ? "" : String(item.score)
  );
  const [feedback, setFeedback] = useState(item.feedback || "");
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function download() {
    setError("");
    setDownloading(true);

    try {
      const response = await fetch(
        "/api/instructor/submissions/" + item.id + "/file",
        {
          headers: { Authorization: "Bearer " + token },
        }
      );

      if (!response.ok) {
        await readResponse(response);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const disposition = response.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="([^"]+)"/);

      link.href = url;
      link.download = match ? match[1] : "submission";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDownloading(false);
    }
  }

  async function grade(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    const value = Number(score);

    if (
      score.trim() === "" ||
      !Number.isInteger(value) ||
      value < 0 ||
      value > item.max_score ||
      !feedback.trim()
    ) {
      setError("Enter a score within the maximum and add feedback.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(
        "/api/instructor/submissions/" + item.id + "/grade",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            score: value,
            feedback: feedback.trim(),
          }),
        }
      );

      const data = await readResponse(response);
      onGraded(data.submission);
      setMessage("Grade saved.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <article>
      <h4>{item.assignment_title}</h4>
      <p>Module: {item.module_title}</p>
      <p>Student: {item.student_name}</p>
      <p>{item.student_email}</p>
      <p>Submitted: {new Date(item.submitted_at).toLocaleString()}</p>

      {item.submission_text && (
        <p style={{ whiteSpace: "pre-wrap" }}>{item.submission_text}</p>
      )}

      {item.has_file && (
        <button type="button" onClick={download} disabled={downloading}>
          {downloading ? "Downloading..." : "Download answer"}
        </button>
      )}

      <p>
        {item.score == null
          ? "Awaiting grading."
          : "Saved score: " + item.score + " / " + item.max_score}
      </p>

      <form onSubmit={grade}>
        <label>
          Score (maximum {item.max_score})
          <input
            type="number"
            min="0"
            max={item.max_score}
            step="1"
            required
            value={score}
            onChange={(event) => setScore(event.target.value)}
            disabled={saving}
          />
        </label>

        <label>
          Feedback
          <textarea
            rows={4}
            maxLength={20000}
            required
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            disabled={saving}
            style={{ width: "100%" }}
          />
        </label>

        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save grade"}
        </button>
      </form>

      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </article>
  );
}

export default function InstructorSubmissions({ courseId, token }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch(
          "/api/instructor/courses/" + courseId + "/submissions",
          {
            headers: { Authorization: "Bearer " + token },
            signal: controller.signal,
          }
        );

        const data = await readResponse(response);

        if (!Array.isArray(data.submissions)) {
          throw new Error("Invalid submission list.");
        }

        if (!controller.signal.aborted) {
          setSubmissions(data.submissions);
        }
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setError(requestError.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    load();
    return () => controller.abort();
  }, [courseId, token]);

  function handleGraded(updated) {
    setSubmissions((previous) =>
      previous.map((item) =>
        item.id === updated.id ? { ...item, ...updated } : item
      )
    );
  }

  return (
    <section>
      <h3>Student submissions</h3>

      {loading && <p>Loading submissions...</p>}
      {error && <p role="alert">{error}</p>}

      {!loading && !error && submissions.length === 0 && (
        <p>No submissions yet.</p>
      )}

      {submissions.map((item) => (
        <SubmissionCard
          key={item.id}
          item={item}
          token={token}
          onGraded={handleGraded}
        />
      ))}
    </section>
  );
}