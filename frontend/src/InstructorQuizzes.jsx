import { useEffect, useState } from "react";

async function request(path, token, body, signal) {
  const response = await fetch("/api/instructor" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: "Bearer " + token,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
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

  if (!response.ok) throw new Error(data.message || "Request failed.");
  return data;
}

export default function InstructorQuizzes({ courseId, token }) {
  const [modules, setModules] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const [moduleData, quizData] = await Promise.all([
          request("/courses/" + courseId + "/modules", token,
            undefined, controller.signal),
          request("/courses/" + courseId + "/quizzes", token,
            undefined, controller.signal),
        ]);

        if (!controller.signal.aborted) {
          setModules(moduleData.modules);
          setQuizzes(quizData.quizzes);
        }
      } catch (requestError) {
        if (!controller.signal.aborted) setError(requestError.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [courseId, token]);

  function addQuestion(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);

    if (questions.length >= 50) {
      setError("Maximum 50 questions.");
      return;
    }

    const question = String(fields.get("question")).trim();
    const options = ["option1", "option2", "option3", "option4"].map(
      (name) => String(fields.get(name)).trim()
    );

    if (!question || options.some((option) => !option)) {
      setError("Enter the question and all four options.");
      return;
    }

    setQuestions((previous) => [
      ...previous,
      {
        question,
        options,
        correctOptionIndex: Number(fields.get("correct")),
        points: Number(fields.get("points")),
      },
    ]);
    setError("");
    setMessage("");
    form.reset();
  }

  async function createQuiz(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setError("");
    setMessage("");

    if (questions.length === 0) {
      setError("Add at least one question first.");
      return;
    }

    setSaving(true);

    try {
      const data = await request(
        "/modules/" + fields.get("moduleId") + "/quizzes",
        token,
        {
          title: String(fields.get("title")).trim(),
          passingPercentage: Number(fields.get("passingPercentage")),
          questions,
        }
      );

      setQuizzes((previous) => [
        ...previous,
        {
          ...data.quiz,
          module_title: modules.find(
            (item) => item.id === data.quiz.module_id
          )?.title,
          question_count: questions.length,
          max_score: questions.reduce((sum, item) => sum + item.points, 0),
        },
      ]);
      setQuestions([]);
      setMessage("Quiz created.");
      form.reset();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h3>Quizzes</h3>
      {loading && <p>Loading quizzes...</p>}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}

      {!loading && modules.length > 0 && (
        <>
          <h4>1. Add questions</h4>
          <form onSubmit={addQuestion}>
            <fieldset disabled={saving}>
              <label>
                Question
                <textarea name="question" required maxLength={5000}
                  rows={3} style={{ width: "100%" }} />
              </label>

              {[1, 2, 3, 4].map((number) => (
                <label key={number}>
                  Option {number}
                  <input name={"option" + number} required maxLength={1000} />
                </label>
              ))}

              <label>
                Correct answer
                <select name="correct" defaultValue="0">
                  <option value="0">Option 1</option>
                  <option value="1">Option 2</option>
                  <option value="2">Option 3</option>
                  <option value="3">Option 4</option>
                </select>
              </label>

              <label>
                Points
                <input name="points" type="number" min="1" max="100"
                  step="1" defaultValue="1" required />
              </label>

              <button type="submit">Add question</button>
            </fieldset>
          </form>

          <p>Questions ready: {questions.length}</p>
          <ol>
            {questions.map((item, index) => (
              <li key={index}>
                <p>{item.question}</p>
                <p>Options: {item.options.join(" / ")}</p>
                <p>
                  Correct: Option {item.correctOptionIndex + 1}
                  {" — Points: "}{item.points}
                </p>
                <button type="button" disabled={saving} onClick={() =>
                  setQuestions((previous) =>
                    previous.filter((_, position) => position !== index)
                  )
                }>
                  Remove question
                </button>
              </li>
            ))}
          </ol>

          <h4>2. Save quiz</h4>
          <form onSubmit={createQuiz}>
            <fieldset disabled={saving}>
              <label>
                Module
                <select name="moduleId" required>
                  {modules.map((item) => (
                    <option key={item.id} value={item.id}>{item.title}</option>
                  ))}
                </select>
              </label>

              <label>
                Quiz title
                <input name="title" required maxLength={200} />
              </label>

              <label>
                Passing percentage
                <input name="passingPercentage" type="number" min="0"
                  max="100" step="1" defaultValue="50" required />
              </label>

              <button type="submit" disabled={questions.length === 0}>
                {saving ? "Creating..." : "Create quiz"}
              </button>
            </fieldset>
          </form>
        </>
      )}

      {!loading && !error && modules.length === 0 && (
        <p>Add a module before creating quizzes.</p>
      )}

      <h4>Existing quizzes</h4>
      {!loading && !error && quizzes.length === 0 && <p>No quizzes yet.</p>}

      {quizzes.map((item) => (
        <article key={item.id}>
          <h4>{item.title}</h4>
          <p>Module: {item.module_title}</p>
          <p>Questions: {item.question_count}</p>
          <p>Maximum score: {item.max_score}</p>
          <p>Passing percentage: {item.passing_percentage}%</p>
        </article>
      ))}
    </section>
  );
}