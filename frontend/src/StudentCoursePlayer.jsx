import { useEffect, useRef, useState } from "react";

async function request(path, token, body, signal) {
  const response = await fetch("/api/student" + path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: "Bearer " + token,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  const text = await response.text();
  let data;

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("Invalid server response.");
  }

  if (!response.ok) {
    throw new Error(data.message || "Request failed.");
  }

  return data;
}

function LessonVideo({ lesson, token }) {
  const videoRef = useRef(null);
  const lastSaveRef = useRef(0);
  const queueRef = useRef(Promise.resolve());
  const [completed, setCompleted] = useState(lesson.is_completed);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  function saveProgress(video, finished = false) {
    if (!Number.isFinite(video.currentTime)) return;

    const body = {
      positionSeconds: Math.min(
        86400,
        Math.max(0, Math.floor(video.currentTime))
      ),
      isCompleted: finished,
    };

    lastSaveRef.current = Date.now();

    queueRef.current = queueRef.current
      .then(async () => {
        const data = await request(
          "/lessons/" + lesson.id + "/progress",
          token,
          body
        );

        setCompleted(data.progress.is_completed);
        setStatus("Progress saved.");
        setError("");
      })
      .catch((requestError) => {
        setError(requestError.message);
        setStatus("");
      });
  }

  function restorePosition(event) {
    const video = event.currentTarget;
    const position = Number(lesson.last_position_seconds) || 0;

    if (Number.isFinite(video.duration) && video.duration > 0) {
      video.currentTime = Math.min(
        position,
        Math.max(0, video.duration - 0.25)
      );
    }
  }

  function handleTimeUpdate(event) {
    const video = event.currentTarget;

    if (!video.paused && Date.now() - lastSaveRef.current >= 5000) {
      saveProgress(video);
    }
  }

  return (
    <article>
      <h4>{lesson.title}</h4>
      <p>{completed ? "Completed" : "In progress"}</p>

      <video
        ref={videoRef}
        src={lesson.video_url}
        controls
        preload="metadata"
        style={{ width: "100%", borderRadius: 8 }}
        onLoadedMetadata={restorePosition}
        onTimeUpdate={handleTimeUpdate}
        onPause={(event) => saveProgress(event.currentTarget)}
        onEnded={(event) => saveProgress(event.currentTarget, true)}
        onError={() => setError("Could not play this video URL.")}
      />

      <label>
        Playback speed
        <select
          defaultValue="1"
          onChange={(event) => {
            if (videoRef.current) {
              videoRef.current.playbackRate = Number(event.target.value);
            }
          }}
        >
          <option value="0.5">0.5×</option>
          <option value="0.75">0.75×</option>
          <option value="1">1×</option>
          <option value="1.25">1.25×</option>
          <option value="1.5">1.5×</option>
          <option value="2">2×</option>
        </select>
      </label>

      <button
        type="button"
        onClick={() => {
          if (videoRef.current) {
            saveProgress(videoRef.current);
          }
        }}
      >
        Save progress
      </button>

      {status && <p role="status">{status}</p>}
      {error && <p role="alert">{error}</p>}

      {lesson.transcript && (
        <details>
          <summary>Transcript</summary>
          <p style={{ whiteSpace: "pre-wrap" }}>{lesson.transcript}</p>
        </details>
      )}
    </article>
  );
}

export default function StudentCoursePlayer({ courseId, token }) {
  const [data, setData] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadLessons() {
      try {
        const result = await request(
          "/courses/" + courseId + "/lessons",
          token,
          undefined,
          controller.signal
        );

        if (!controller.signal.aborted) {
          setData(result);
          setSelectedId(result.lessons[0]?.id || "");
        }
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setError(requestError.message);
        }
      }
    }

    loadLessons();
    return () => controller.abort();
  }, [courseId, token]);

  if (error) {
    return <p role="alert">{error}</p>;
  }

  if (!data) {
    return <p>Loading lessons...</p>;
  }

  const selectedLesson = data.lessons.find(
    (lesson) => lesson.id === selectedId
  );

  return (
    <section>
      <h3>{data.course.title} — Lessons</h3>

      {data.lessons.length === 0 ? (
        <p>No lessons available yet.</p>
      ) : (
        <>
          <label>
            Select lesson
            <select
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              {data.lessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {lesson.module_title + " — " + lesson.title}
                </option>
              ))}
            </select>
          </label>

          {selectedLesson && (
            <LessonVideo
              key={selectedLesson.id}
              lesson={selectedLesson}
              token={token}
            />
          )}
        </>
      )}
    </section>
  );
}
export function StudentLearning({ token }) {
  const [courses, setCourses] = useState(null);
  const [courseId, setCourseId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadCourses() {
      try {
        const data = await request(
          "/enrollments",
          token,
          undefined,
          controller.signal
        );

        if (!controller.signal.aborted) {
          setCourses(data.courses);
        }
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setError(requestError.message);
        }
      }
    }

    loadCourses();
    return () => controller.abort();
  }, [token]);

  return (
    <section>
      <h3>Continue learning</h3>

      {error && <p role="alert">{error}</p>}
      {!courses && !error && <p>Loading enrolled courses...</p>}

      {courses && (
        <>
          <label>
            Choose an enrolled course
            <select
              value={courseId}
              onChange={(event) => setCourseId(event.target.value)}
            >
              <option value="">Select a course</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </label>

          {courses.length === 0 && (
            <p>Enroll in a course below, then refresh this page.</p>
          )}
        </>
      )}

      {courseId && (
        <StudentCoursePlayer
          key={courseId}
          courseId={courseId}
          token={token}
        />
      )}
    </section>
  );
}