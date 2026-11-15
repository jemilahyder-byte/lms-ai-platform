import { useEffect, useState } from "react";

async function request(path, token, body, signal) {
  const response = await fetch("/api/student" + path, {
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

  let data;
  try {
    data = JSON.parse(await response.text());
  } catch {
    throw new Error("Invalid server response. Check the backend.");
  }

  if (!response.ok) {
    throw new Error(data.message || "Request failed.");
  }

  return data;
}

function QuizForm({ quizId, token }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    request("/quizzes/" + quizId, token, undefined, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setDetails(data);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [quizId, token]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;

    const form = event.currentTarget;
    const fields = new FormData(form);

    const answers = details.questions.map((question) => ({
      questionId: question.id,
      selectedOptionIndex: Number(fields.get(question.id)),
    }));

    if (details.questions.some((question) => !fields.has(question.id))) {
      setError("Please answer every question.");
      return;
    }

    setSaving(true);
    setError("");
    setResult(null);

    try {
      const data = await request(
        "/quizzes/" + quizId + "/submit",
        token,
        { answers }
      );

      setResult(data);
      setDetails((previous) => ({
        ...previous,
        attempts: [data.attempt, ...previous.attempts].slice(0, 10),
      }));
      form.reset();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Loading quiz...</p>;

  if (!details) {
    return <p role="alert">{error || "Could not load quiz."}</p>;
  }

  return (
    <article>
      <h4>{details.quiz.title}</h4>
      <p>Passing percentage: {details.quiz.passing_percentage}%</p>

      {error && <p role="alert">{error}</p>}

      {result && (
        <div role="status">
          <p>
            Score: {result.attempt.score} / {result.attempt.max_score}
          </p>
          <p>Percentage: {Number(result.percentage).toFixed(1)}%</p>
          <p>{result.passed ? "Passed" : "Not passed. Try again."}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <fieldset disabled={saving}>
          <legend>Answer every question</legend>

          {details.questions.map((question, index) => (
            <fieldset key={question.id}>
              <legend>
                {index + 1}. {question.question}
              </legend>

              <p>Points: {question.points}</p>

              {question.options.map((option, optionIndex) => (
                <label
                  key={optionIndex}
                  style={{ display: "block", marginBottom: "12px" }}
                >
                  <input
                    type="radio"
                    name={question.id}
                    value={optionIndex}
                    required
                  />{" "}
                  {option}
                </label>
              ))}
            </fieldset>
          ))}

          <button type="submit" disabled={!details.questions.length}>
            {saving ? "Submitting..." : "Submit quiz"}
          </button>
        </fieldset>
      </form>

      <h4>Recent attempts</h4>

      {details.attempts.length === 0 ? (
        <p>No attempts yet.</p>
      ) : (
        <ul>
          {details.attempts.map((attempt) => (
            <li key={attempt.id}>
              {attempt.score} / {attempt.max_score}
              {" — "}
              {new Date(attempt.submitted_at).toLocaleString()}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

export default function StudentQuizzes({ courseId, token }) {
  const [quizzes, setQuizzes] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    request(
      "/courses/" + courseId + "/quizzes",
      token,
      undefined,
      controller.signal
    )
      .then((data) => {
        if (!controller.signal.aborted) {
          setQuizzes(data.quizzes);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [courseId, token]);

  return (
    <section>
      <h3>Course quizzes</h3>

      {loading && <p>Loading quizzes...</p>}
      {error && <p role="alert">{error}</p>}

      {!loading && !error && quizzes.length === 0 && (
        <p>No quizzes yet.</p>
      )}

      {quizzes.map((quiz) => (
        <article key={quiz.id}>
          <h4>{quiz.title}</h4>
          <p>Module: {quiz.module_title}</p>
          <p>
            Questions: {quiz.question_count}
            {" — Maximum score: "}
            {quiz.max_score}
          </p>
          <button type="button" onClick={() => setSelectedId(quiz.id)}>
            Open quiz
          </button>
        </article>
      ))}

      {selectedId && (
        <QuizForm key={selectedId} quizId={selectedId} token={token} />
      )}
    </section>
  );
}