import { useEffect, useState } from "react";

async function request(path, token, body, signal) {
  const response = await fetch("/api/instructor" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: "Bearer " + token,
      ...(body === undefined
        ? {}
        : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

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

export default function InstructorAssignments({ courseId, token }) {
  const [modules, setModules] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [moduleId, setModuleId] = useState("");
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [maxScore, setMaxScore] = useState("100");
  const [dueAt, setDueAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const [moduleData, assignmentData] = await Promise.all([
          request(
            "/courses/" + courseId + "/modules",
            token,
            undefined,
            controller.signal
          ),
          request(
            "/courses/" + courseId + "/assignments",
            token,
            undefined,
            controller.signal
          ),
        ]);

        if (!controller.signal.aborted) {
          setModules(moduleData.modules);
          setModuleId(moduleData.modules[0]?.id || "");
          setAssignments(assignmentData.assignments);
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

  async function createAssignment(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    const deadline = new Date(dueAt);
    const score = Number(maxScore);

    if (
      !moduleId ||
      !title.trim() ||
      !instructions.trim() ||
      !Number.isInteger(score) ||
      score < 1 ||
      score > 10000 ||
      !Number.isFinite(deadline.getTime()) ||
      deadline.getTime() <= Date.now()
    ) {
      setError("Complete all fields and choose a future deadline.");
      return;
    }

    setSaving(true);

    try {
      const data = await request(
        "/modules/" + moduleId + "/assignments",
        token,
        {
          title: title.trim(),
          instructions: instructions.trim(),
          maxScore: score,
          dueAt: deadline.toISOString(),
        }
      );

      const selectedModule = modules.find((item) => item.id === moduleId);

      setAssignments((previous) => [
        ...previous,
        {
          ...data.assignment,
          module_title: selectedModule?.title || "",
        },
      ]);
      setTitle("");
      setInstructions("");
      setDueAt("");
      setMessage("Assignment created.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p>Loading assignments...</p>;
  }

  return (
    <section>
      <h3>Assignments</h3>

      {modules.length === 0 ? (
        <p>Add a module to this course before creating assignments.</p>
      ) : (
        <form onSubmit={createAssignment}>
          <label>
            Module
            <select
              value={moduleId}
              onChange={(event) => setModuleId(event.target.value)}
              disabled={saving}
              required
            >
              {modules.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>

          <label>
            Assignment title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              disabled={saving}
              required
            />
          </label>

          <label>
            Instructions
            <textarea
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              rows={5}
              maxLength={20000}
              style={{ width: "100%", boxSizing: "border-box" }}
              disabled={saving}
              required
            />
          </label>

          <label>
            Maximum score
            <input
              type="number"
              min="1"
              max="10000"
              step="1"
              value={maxScore}
              onChange={(event) => setMaxScore(event.target.value)}
              disabled={saving}
              required
            />
          </label>

          <label>
            Deadline (your local time)
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
              disabled={saving}
              required
            />
          </label>

          <button type="submit" disabled={saving}>
            {saving ? "Creating..." : "Create assignment"}
          </button>
        </form>
      )}

      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}

      <h4>Existing assignments</h4>

      {assignments.length === 0 ? (
        <p>No assignments yet.</p>
      ) : (
        <ul>
          {assignments.map((item) => (
            <li key={item.id}>
              <strong>{item.title}</strong>
              <p>Module: {item.module_title}</p>
              <p style={{ whiteSpace: "pre-wrap" }}>
                {item.instructions}
              </p>
              <p>Maximum score: {item.max_score}</p>
              <p>
                Deadline:{" "}
                {item.due_at
                  ? new Date(item.due_at).toLocaleString()
                  : "No deadline"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}