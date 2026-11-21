import { useState } from "react";

export default function LessonStudy({ lessonId, token }) {
  const [material, setMaterial] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
const [level, setLevel] = useState("beginner");
  async function generate() {
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/student/lessons/" + lessonId + "/study",
        {
          method: "POST",
          headers: {
  Authorization: "Bearer " + token,
  "Content-Type": "application/json",
},
body: JSON.stringify({ level }),
signal: AbortSignal.timeout(45000),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Request failed.");
      }

      setMaterial(data);
    } catch (err) {
      setError(
        err.name === "TimeoutError"
          ? "The request timed out. Please try again."
          : err.message
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section style={{ marginTop: 24 }}>
      <h3>Lesson study tools</h3>
      <label>
  Explanation level{" "}
  <select
    value={level}
    disabled={loading}
    onChange={(event) => {
      setLevel(event.target.value);
      setMaterial(null);
      setError("");
    }}
  >
<option value="beginner">Beginner</option>
<option value="intermediate">Intermediate</option>
<option value="advanced">Advanced</option>
  </select>
</label>
      <button type="button" onClick={generate} disabled={loading}>
        {loading ? "Generating…" : "Generate summary and flashcards"}
      </button>

      {error && <p role="alert">{error}</p>}

      <div aria-live="polite" aria-busy={loading}>
        {material && (
          <>
            <h4>Summary</h4>
            <p style={{ whiteSpace: "pre-wrap" }}>
              {material.summary}
            </p>

            <h4>Flashcards</h4>
            <p>Select a question to reveal its answer.</p>

            {material.flashcards.map((card, index) => (
              <details key={index} style={{ marginBottom: 12 }}>
                <summary>{card.question}</summary>
                <p>{card.answer}</p>
              </details>
            ))}

            <p>Source [1]: {material.source.title}</p>
          </>
        )}
      </div>
    </section>
  );
}