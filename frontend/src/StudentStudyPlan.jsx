import { useState } from "react";

export default function StudentStudyPlan({ courseId, token }) {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    if (loading) return;
    setLoading(true);
    setError("");
    setPlan(null);

    try {
      const response = await fetch(
        "/api/student/courses/" + courseId + "/study-plan",
        {
          method: "POST",
          headers: { Authorization: "Bearer " + token },
          signal: AbortSignal.timeout(45000),
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Study plan failed.");
      }

      setPlan(data);
    } catch (err) {
      setError(
        err.name === "TimeoutError"
          ? "Generation timed out. Try again."
          : err.message
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section aria-busy={loading}>
      <h3>Your study plan</h3>
      <p>Recommendations based on your latest course quiz scores.</p>
      <button type="button" onClick={generate} disabled={loading}>
        {loading ? "Generating..." : "Generate study plan"}
      </button>

      {error && <p role="alert">{error}</p>}

      <div aria-live="polite">
        {plan && (
          <>
            <p>{plan.summary}</p>
            <ol>
              {plan.steps.map((step, index) => (
                <li key={index}>
                  <h4>{step.title}</h4>
                  <p>{step.action}</p>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </section>
  );
}