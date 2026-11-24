import { useState } from "react";

function formatTime(value) {
  const seconds = Number(value);

  if (!Number.isFinite(seconds) || seconds < 0) {
    return "Unavailable";
  }

  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = String(total % 60).padStart(2, "0");

  if (hours > 0) {
    return hours + ":" +
      String(minutes).padStart(2, "0") + ":" + remaining;
  }

  return minutes + ":" + remaining;
}

function formatDate(value) {
  if (!value) return "Unavailable";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Unavailable"
    : date.toLocaleString();
}

export default function InstructorAnalytics({ courseId, token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadAnalytics() {
    if (loading || !courseId) return;

    setLoading(true);
    setError("");
    setData(null);

    try {
      const response = await fetch(
        "/api/instructor/courses/" + courseId + "/analytics",
        {
          headers: {
            Authorization: "Bearer " + token,
          },
          signal: AbortSignal.timeout(15000),
        }
      );

      const contentType = response.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        throw new Error("API unavailable. Check the backend terminal.");
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Could not load analytics.");
      }

      setData(result);
    } catch (err) {
      setError(
        err.name === "TimeoutError"
          ? "Request timed out. Please try again."
          : err.message || "Could not load analytics."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <h3>Course analytics</h3>

      <button
        type="button"
        onClick={loadAnalytics}
        disabled={loading || !courseId}
      >
        {loading ? "Loading..." : "Load analytics"}
      </button>

      {error && <p role="alert">{error}</p>}

      {data && (
        <>
          <h4>{data.course.title}</h4>

          <h4>Student progress</h4>

          {data.students.length === 0 ? (
            <p>No students enrolled yet.</p>
          ) : (
            <ul>
              {data.students.map((student) => (
                <li key={student.id}>
                  <strong>{student.full_name}</strong>
                  <p>{student.email}</p>
                  <p>
                    {student.completed_lessons} /{" "}
                    {student.total_lessons} lessons completed
                  </p>
                </li>
              ))}
            </ul>
          )}

          <h4>Latest quiz scores</h4>

          {data.quizzes.length === 0 ? (
            <p>No submitted quiz attempts yet.</p>
          ) : (
            <ul>
              {data.quizzes.map((quiz) => {
                const hasPercentage =
                  quiz.percentage !== null &&
                  quiz.percentage !== undefined;

                const passed =
                  hasPercentage &&
                  Number(quiz.percentage) >=
                    Number(quiz.passing_percentage);

                return (
                  <li key={quiz.quiz_id + ":" + quiz.user_id}>
                    <strong>{quiz.full_name}</strong>
                    <p>{quiz.quiz_title}</p>
                    <p>
                      Score: {quiz.score} / {quiz.max_score}
                      {" — "}
                      {hasPercentage
                        ? quiz.percentage + "%"
                        : "Percentage unavailable"}
                    </p>
                    <p>
                      {hasPercentage
                        ? passed
                          ? "Passed"
                          : "Needs revision"
                        : "Result unavailable"}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}

          <h4>Lecture progress</h4>

          <p>
            Incomplete lessons may still be in progress.
            These counts do not confirm abandonment.
          </p>

          {data.lectures.length === 0 ? (
            <p>No lectures available yet.</p>
          ) : (
            <ul>
              {data.lectures.map((lecture) => (
                <li key={lecture.id}>
                  <strong>{lecture.title}</strong>
                  <p>
                    Students with recorded progress: {lecture.started}
                  </p>
                  <p>Completed: {lecture.completed}</p>
                  <p>Started but incomplete: {lecture.incomplete}</p>
                </li>
              ))}
            </ul>
          )}

          <h4>Last saved video positions</h4>

          <p>
            Shows each student's latest saved playback position.
            Seeking can change this position; it is not total watch time
            or proof that a student abandoned the lesson.
          </p>

          {!Array.isArray(data.lecturePositions) ? (
            <p>
              Position data unavailable. Restart the backend after
              saving the updated analytics file, then load again.
            </p>
          ) : data.lecturePositions.length === 0 ? (
            <p>No video progress recorded yet.</p>
          ) : (
            <ul>
              {data.lecturePositions.map((position) => {
                const hasDuration =
                  Number(position.duration_seconds) > 0;

                const hasPercentage =
                  position.position_percentage !== null &&
                  position.position_percentage !== undefined;

                return (
                  <li
                    key={position.lecture_id + ":" + position.user_id}
                  >
                    <strong>{position.full_name}</strong>
                    <p>Lecture: {position.lecture_title}</p>

                    <p>
                      Last saved position:{" "}
                      {formatTime(position.last_position_seconds)}
                      {hasDuration
                        ? " / " + formatTime(position.duration_seconds)
                        : " — duration unavailable"}
                    </p>

                    {hasPercentage && (
                      <p>
                        Position in video: {position.position_percentage}%
                      </p>
                    )}

                    <p>
                      Status:{" "}
                      {position.is_completed ? "Completed" : "Incomplete"}
                    </p>

                    <p>
                      Last saved: {formatDate(position.last_saved_at)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}