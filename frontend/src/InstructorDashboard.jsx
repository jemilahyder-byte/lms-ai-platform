import { useEffect, useState } from "react";

async function request(path, token, body, signal) {
  const response = await fetch("/api/instructor" + path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: "Bearer " + token,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Request failed.");
  }

  return data;
}

const selectStyle = {
  width: "100%",
  padding: 10,
  margin: "8px 0",
};

const fieldsetStyle = {
  border: 0,
  padding: 0,
  minWidth: 0,
};

function CourseEditor({ course, token }) {
  const [modules, setModules] = useState([]);
  const [moduleId, setModuleId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadModules() {
      try {
        const data = await request(
          "/courses/" + course.id + "/modules",
          token,
          undefined,
          controller.signal
        );

        if (!controller.signal.aborted) {
          setModules(data.modules);
          setModuleId(data.modules[0]?.id || "");
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

    loadModules();
    return () => controller.abort();
  }, [course.id, token]);

  async function addModule(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const fields = new FormData(form);

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const data = await request(
        "/courses/" + course.id + "/modules",
        token,
        {
          title: fields.get("title"),
          orderIndex: Number(fields.get("orderIndex")),
        }
      );

      setModules((previous) =>
        [...previous, data.module].sort(
          (a, b) => a.order_index - b.order_index
        )
      );
      setModuleId(data.module.id);
      form.reset();
      setMessage("Module added: " + data.module.title);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function addLesson(event) {
    event.preventDefault();

    if (!moduleId) return;

    const form = event.currentTarget;
    const fields = new FormData(form);

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const data = await request(
        "/modules/" + moduleId + "/lessons",
        token,
        {
          title: fields.get("title"),
          videoUrl: fields.get("videoUrl"),
          transcript: fields.get("transcript"),
          durationSeconds: Number(fields.get("durationSeconds")),
          orderIndex: Number(fields.get("orderIndex")),
        }
      );

      form.reset();
      setMessage("Lesson added: " + data.lesson.title);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h4>Manage: {course.title}</h4>

      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}

      {loading ? (
        <p role="status">Loading modules...</p>
      ) : (
        <>
          <h4>Modules</h4>

          {modules.length === 0 ? (
            <p>No modules yet. Add your first module below.</p>
          ) : (
            <ul>
              {modules.map((module) => (
                <li key={module.id}>
                  {module.title} — order {module.order_index}
                </li>
              ))}
            </ul>
          )}

          <h4>Add module</h4>

          <form onSubmit={addModule}>
            <fieldset disabled={busy} style={fieldsetStyle}>
              <label>
                Module title
                <input name="title" maxLength={200} required />
              </label>

              <label>
                Order number (starts at 0)
                <input
                  name="orderIndex"
                  type="number"
                  min={0}
                  max={10000}
                  step={1}
                  defaultValue={0}
                  required
                />
              </label>

              <button type="submit">
                {busy ? "Please wait..." : "Add module"}
              </button>
            </fieldset>
          </form>

          {modules.length > 0 && (
            <>
              <h4>Add lesson</h4>

              <label>
                Select module
                <select
                  value={moduleId}
                  onChange={(event) => setModuleId(event.target.value)}
                  disabled={busy}
                  style={selectStyle}
                >
                  {modules.map((module) => (
                    <option key={module.id} value={module.id}>
                      {module.title}
                    </option>
                  ))}
                </select>
              </label>

              <form onSubmit={addLesson}>
                <fieldset disabled={busy} style={fieldsetStyle}>
                  <label>
                    Lesson title
                    <input name="title" maxLength={200} required />
                  </label>

                  <label>
                    Video URL (http or https)
                    <input
                      name="videoUrl"
                      type="url"
                      pattern="https?://.*"
                      maxLength={2000}
                      placeholder="https://example.com/video.mp4"
                      required
                    />
                  </label>

                  <label>
                    Transcript
                    <textarea
                      name="transcript"
                      maxLength={10000}
                      rows={4}
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                      }}
                    />
                  </label>

                  <label>
                    Duration in seconds
                    <input
                      name="durationSeconds"
                      type="number"
                      min={0}
                      max={86400}
                      step={1}
                      defaultValue={0}
                      required
                    />
                  </label>

                  <label>
                    Order number (starts at 0)
                    <input
                      name="orderIndex"
                      type="number"
                      min={0}
                      max={10000}
                      step={1}
                      defaultValue={0}
                      required
                    />
                  </label>

                  <button type="submit">
                    {busy ? "Please wait..." : "Add lesson"}
                  </button>
                </fieldset>
              </form>
            </>
          )}
        </>
      )}
    </section>
  );
}

export default function InstructorDashboard({ token }) {
  const [courses, setCourses] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadCourses() {
      try {
        const data = await request(
          "/courses",
          token,
          undefined,
          controller.signal
        );

        if (!controller.signal.aborted) {
          setCourses(data.courses);
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

    loadCourses();
    return () => controller.abort();
  }, [token]);

  async function createCourse(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const fields = new FormData(form);

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const data = await request("/courses", token, {
        title: fields.get("title"),
        description: fields.get("description"),
        category: fields.get("category"),
        difficulty: fields.get("difficulty"),
      });

      setCourses((previous) => [data.course, ...previous]);
      form.reset();
      setMessage("Course created. Waiting for admin approval.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  const selectedCourse = courses.find(
    (course) => course.id === selectedId
  );

  return (
    <section>
      <h3>Instructor dashboard</h3>
      <h4>Create a free course</h4>

      <form onSubmit={createCourse}>
        <fieldset
          disabled={busy || loading}
          style={fieldsetStyle}
        >
          <label>
            Course title
            <input name="title" maxLength={200} required />
          </label>

          <label>
            Description
            <textarea
              name="description"
              maxLength={10000}
              rows={4}
              required
              style={{ width: "100%", boxSizing: "border-box" }}
            />
          </label>

          <label>
            Category
            <input name="category" maxLength={100} required />
          </label>

          <label>
            Difficulty
            <select
              name="difficulty"
              defaultValue="beginner"
              style={selectStyle}
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>

          <button type="submit">
            {busy ? "Creating..." : "Create course"}
          </button>
        </fieldset>
      </form>

      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}

      <h4>My courses</h4>

      {loading ? (
        <p role="status">Loading courses...</p>
      ) : courses.length === 0 ? (
        <p>No courses loaded.</p>
      ) : (
        courses.map((course) => (
          <article key={course.id} style={{ marginBottom: 20 }}>
            <h4>{course.title}</h4>
            <p>{course.description}</p>
            <p>
              {course.category} · {course.difficulty}
            </p>
            <p>
              Status: <strong>{course.status}</strong>
            </p>

            <button
              type="button"
              onClick={() => setSelectedId(course.id)}
              disabled={selectedId === course.id}
            >
              {selectedId === course.id
                ? "Selected"
                : "Manage modules and lessons"}
            </button>
          </article>
        ))
      )}

      {selectedCourse && (
        <CourseEditor
          key={selectedCourse.id}
          course={selectedCourse}
          token={token}
        />
      )}
    </section>
  );
}