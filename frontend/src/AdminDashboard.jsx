import { useEffect, useState } from "react";

export default function AdminDashboard({ token }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadCourses() {
      try {
        const response = await fetch("/api/admin/courses", {
          headers: { Authorization: "Bearer " + token },
          signal: controller.signal,
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Could not load courses.");
        }

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

  async function approve(course) {
    setPendingId(course.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/admin/courses/" + course.id + "/approve",
        {
          method: "POST",
          headers: { Authorization: "Bearer " + token },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not approve course.");
      }

      setCourses((previous) =>
        previous.filter((item) => item.id !== course.id)
      );
      setMessage(course.title + " approved successfully.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPendingId("");
    }
  }

  return (
    <section>
      <h3>Admin dashboard</h3>
      <h4>Courses awaiting approval</h4>

      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}

      {loading ? (
        <p role="status">Loading pending courses...</p>
      ) : courses.length === 0 ? (
        !error && <p>No courses awaiting approval.</p>
      ) : (
        courses.map((course) => (
          <article
            key={course.id}
            style={{
              background: "white",
              padding: 16,
              marginTop: 16,
              borderRadius: 10,
            }}
          >
            <h4>{course.title}</h4>
            <p>{course.description}</p>
            <p>Instructor: {course.instructor_name}</p>
            <p>
              {course.category} · {course.difficulty}
            </p>
            <p>Status: {course.status}</p>

            <button
              type="button"
              disabled={Boolean(pendingId)}
              onClick={() => approve(course)}
            >
              {pendingId === course.id ? "Approving..." : "Approve"}
            </button>
          </article>
        ))
      )}
    </section>
  );
}