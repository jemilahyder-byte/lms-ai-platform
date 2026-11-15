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

function SubmissionForm({ assignment, token, onSubmitted }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const file = fields.get("file");

    setError("");

    if (!(file instanceof File) || file.size === 0) {
      setError("Choose a non-empty file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("File must be 5 MB or smaller.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(
        "/api/student/assignments/" + assignment.id + "/submission",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + token,
          },
          body: fields,
        }
      );

      const data = await readResponse(response);
      onSubmitted(assignment.id, data.submission);
      form.reset();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <label>
        Answer notes (optional)
        <textarea
          name="submissionText"
          rows={3}
          maxLength={20000}
          disabled={saving}
          style={{ width: "100%" }}
        />
      </label>

      <label>
        Upload answer — PDF, TXT, JS, PY or DOCX (maximum 5 MB)
        <input
          type="file"
          name="file"
          accept=".pdf,.txt,.js,.py,.docx"
          required
          disabled={saving}
        />
      </label>

      <p>Check your file before submitting. One submission is allowed.</p>

      <button type="submit" disabled={saving}>
        {saving ? "Submitting..." : "Submit assignment"}
      </button>

      {error && <p role="alert">{error}</p>}
    </form>
  );
}

export default function StudentAssignments({ courseId, token }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch(
          "/api/student/courses/" + courseId + "/assignments",
          {
            headers: {
              Authorization: "Bearer " + token,
            },
            signal: controller.signal,
          }
        );

        const data = await readResponse(response);

        if (!Array.isArray(data.assignments)) {
          throw new Error("Invalid assignment list.");
        }

        if (!controller.signal.aborted) {
          setAssignments(data.assignments);
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

  function handleSubmitted(assignmentId, submission) {
    setAssignments((previous) =>
      previous.map((item) =>
        item.id === assignmentId
          ? {
              ...item,
              submission_id: submission.id,
              submitted_at: submission.submitted_at,
              has_file: true,
            }
          : item
      )
    );

    setMessage("Assignment submitted.");
  }

  return (
    <section>
      <h3>Course assignments</h3>

      {message && <p role="status">{message}</p>}
      {loading && <p>Loading assignments...</p>}
      {error && <p role="alert">{error}</p>}

      {!loading && !error && assignments.length === 0 && (
        <p>No assignments yet.</p>
      )}

      {assignments.map((item) => (
        <article key={item.id}>
          <h4>{item.title}</h4>
          <p>Module: {item.module_title}</p>
          <p style={{ whiteSpace: "pre-wrap" }}>{item.instructions}</p>
          <p>Maximum score: {item.max_score}</p>
          <p>Deadline: {new Date(item.due_at).toLocaleString()}</p>

          {item.submission_id ? (
            <>
              <p>
                Submitted: {new Date(item.submitted_at).toLocaleString()}
              </p>
              <p>
                {item.score == null
                  ? "Awaiting grading."
                  : "Score: " + item.score + " / " + item.max_score}
              </p>
              {item.feedback && <p>Feedback: {item.feedback}</p>}
            </>
          ) : now >= new Date(item.due_at).getTime() ? (
            <p>The assignment deadline has passed.</p>
          ) : (
            <SubmissionForm
              assignment={item}
              token={token}
              onSubmitted={handleSubmitted}
            />
          )}
        </article>
      ))}
    </section>
  );
}