import { useEffect, useState } from "react";

async function readJson(response) {
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

export default function StudentCertificate({ courseId, token }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refreshCount, setRefreshCount] = useState(0);

  const endpoint =
    "/api/student/courses/" + courseId + "/certificate";

  useEffect(() => {
    const controller = new AbortController();

    fetch(endpoint, {
      headers: { Authorization: "Bearer " + token },
      signal: controller.signal,
    })
      .then(readJson)
      .then((data) => {
        if (!controller.signal.aborted) {
          setStatus(data);
          setError("");
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
  }, [endpoint, token, refreshCount]);

  function refreshStatus() {
    setLoading(true);
    setError("");
    setRefreshCount((previous) => previous + 1);
  }

  async function downloadCertificate() {
    if (downloading) return;

    setDownloading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
      });

      if (!response.ok) {
        await readJson(response);
      }

      const contentType = response.headers.get("Content-Type") || "";

      if (!contentType.includes("application/pdf")) {
        throw new Error("The server did not return a PDF certificate.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = "course-certificate.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Certificate downloaded.");
      setRefreshCount((previous) => previous + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section>
      <h3>Course certificate</h3>
      <p>
        Complete every lesson and pass every quiz to earn your
        certificate.
      </p>

      {loading && <p>Checking completion...</p>}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}

      {!loading && !error && status && (
        <>
          <p>
            Lessons completed: {status.completed_lessons} /{" "}
            {status.total_lessons}
          </p>
          <p>
            Quizzes passed: {status.passed_quizzes} /{" "}
            {status.total_quizzes}
          </p>

          {status.eligible ? (
            <p>You have qualified for this certificate.</p>
          ) : (
            <p>Complete the remaining requirements first.</p>
          )}

          {status.certificate && (
            <p>
              Certificate issued:{" "}
              {new Date(
                status.certificate.issued_at
              ).toLocaleDateString()}
            </p>
          )}

          <button
            type="button"
            onClick={downloadCertificate}
            disabled={!status.eligible || downloading}
          >
            {downloading
              ? "Preparing certificate..."
              : "Download certificate"}
          </button>
        </>
      )}

      <button
        type="button"
        onClick={refreshStatus}
        disabled={loading || downloading}
      >
        Refresh completion status
      </button>
    </section>
  );
}