import { useState } from "react";

export default function StudentTutor({ courseId, token }) {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function askTutor(event) {
    event.preventDefault();
    const text = question.trim();
    if (loading || text.length < 3) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(
        "/api/student/courses/" + courseId + "/tutor",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token,
          },
          body: JSON.stringify({ question: text }),
          signal: AbortSignal.timeout(45000),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Request failed.");
      }

      setResult(data);
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
    <section style={{ marginTop: 24, padding: 20 }}>
      <h2>AI course tutor</h2>
      <p>Ask a question about this course's learning material.</p>

      <form onSubmit={askTutor}>
        <label htmlFor="tutor-question">Your question</label>
        <textarea
          id="tutor-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="What is the difference between let and const?"
          minLength={3}
          maxLength={1000}
          required
          disabled={loading}
          rows={3}
          style={{ display: "block", width: "100%", margin: "12px 0" }}
        />
        <button
          type="submit"
          disabled={loading || question.trim().length < 3}
        >
          {loading ? "Finding an answer…" : "Ask tutor"}
        </button>
      </form>

      {error && <p role="alert">{error}</p>}

      <div aria-live="polite" aria-busy={loading}>
        {result && (
          <>
            <h3>Answer</h3>
            <p style={{ whiteSpace: "pre-wrap" }}>{result.answer}</p>

            {result.sources?.length > 0 && (
              <>
                <h3>Sources</h3>
                {result.sources.map((source) => (
                  <details
                    key={source.lecture_id + ":" + source.chunk_index}
                  >
                    <summary>
                      [{source.reference}] {source.lecture_title}
                      {" — "}{source.module_title}
                    </summary>
                    <p>{source.excerpt}</p>
                  </details>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}