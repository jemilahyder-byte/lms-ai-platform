import { useEffect, useState } from "react";

export default function StudentRewards({ token }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadRewards() {
      try {
        const response = await fetch("/api/student/rewards", {
          headers: {
            Authorization: "Bearer " + token,
          },
          signal: controller.signal,
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.message || "Could not load learning rewards."
          );
        }

        if (!controller.signal.aborted) {
          setData(result);
          setError("");
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadRewards();
    return () => controller.abort();
  }, [token, refreshCount]);

  function refreshRewards() {
    setLoading(true);
    setError("");
    setRefreshCount((count) => count + 1);
  }

  return (
    <section>
      <h3>My badges and learning streak</h3>

      <p>
        Watch a lesson or submit a quiz to record a learning day.
        Each day counts once, using India time.
      </p>

      {loading && <p role="status">Loading rewards...</p>}
      {error && <p role="alert">{error}</p>}

      {!loading && !error && data && (
        <>
          <p>Current streak: {data.current_streak} days</p>
          <p>Longest streak: {data.longest_streak} days</p>
          <p>Recorded learning days: {data.total_days}</p>

          <p>
            {data.active_today
              ? "Today's learning activity is recorded."
              : "Learn today to continue your streak."}
          </p>

          <h4>Learning badges</h4>

          <ul>
            {data.badges.map((badge) => (
              <li key={badge.code}>
                <strong>{badge.title}</strong>
                <p>{badge.description}</p>
                <p>
                  {badge.earned_at
                    ? "Earned on " +
                      new Date(badge.earned_at).toLocaleDateString(
                        "en-IN",
                        { timeZone: "Asia/Kolkata" }
                      )
                    : "Not earned yet"}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}

      <button
        type="button"
        onClick={refreshRewards}
        disabled={loading}
      >
        Refresh rewards
      </button>
    </section>
  );
}