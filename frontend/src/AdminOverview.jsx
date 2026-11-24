import { useState } from "react";

const statisticsLabels = [
  ["total_users", "Total users"],
  ["active_users", "Active accounts"],
  ["suspended_users", "Suspended accounts"],
  ["total_courses", "Total courses"],
  ["total_enrollments", "Total enrollments"],
  ["total_lessons", "Total lessons"],
  ["total_quizzes", "Total quizzes"],
  ["submitted_quiz_attempts", "Submitted quiz attempts"],
];

export default function AdminOverview({ token }) {
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadStatistics() {
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/overview", {
        headers: {
          Authorization: "Bearer " + token,
        },
        signal: AbortSignal.timeout(15000),
      });

      const contentType =
        response.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        throw new Error(
          "Unexpected server response. Check the backend server."
        );
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Could not load statistics."
        );
      }

      setStatistics(result.statistics);
    } catch (err) {
      setError(
        err.name === "TimeoutError"
          ? "Request timed out. Please try again."
          : err.message || "Could not load statistics."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <h3>Platform statistics</h3>

      <button
        type="button"
        onClick={loadStatistics}
        disabled={loading}
      >
        {loading ? "Loading..." : "Refresh statistics"}
      </button>

      {error && <p role="alert">{error}</p>}

      {statistics && (
        <dl>
          {statisticsLabels.map(([field, label]) => (
            <div key={field}>
              <dt>{label}</dt>
              <dd>{statistics[field]}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}