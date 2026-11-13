import { useEffect, useState } from "react";
import InstructorDashboard from "./InstructorDashboard";
import AdminDashboard from "./AdminDashboard";

const tokenKey = "lms-token";

const selectStyle = {
  width: "100%",
  padding: 10,
  margin: "8px 0",
};

async function apiRequest(path, { token, body, signal, method } = {}) {
  const response = await fetch("/api" + path, {
    method: method || (body ? "POST" : "GET"),
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  const text = await response.text();
  let data = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Invalid server response. Check the backend terminal.");
    }
  }

  if (!response.ok) {
    throw new Error(data.message || "Request failed.");
  }

  if (!text) {
    throw new Error("Empty server response. Check that the backend is running.");
  }

  return data;
}

function CourseCatalog({ token, canEnroll }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [minRating, setMinRating] = useState("0");
  const [ratingVersion, setRatingVersion] = useState(0);
  const [courses, setCourses] = useState([]);
  const [myCourses, setMyCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enrollmentLoading, setEnrollmentLoading] = useState(canEnroll);
  const [pendingId, setPendingId] = useState("");
  const [catalogError, setCatalogError] = useState("");
  const [enrollmentError, setEnrollmentError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!canEnroll) return;

    const controller = new AbortController();

    async function loadEnrollments() {
      try {
        const data = await apiRequest("/student/enrollments", {
          token,
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setMyCourses(data.courses);
          setEnrollmentError("");
        }
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setEnrollmentError(requestError.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setEnrollmentLoading(false);
        }
      }
    }

    loadEnrollments();
    return () => controller.abort();
  }, [token, canEnroll]);

  useEffect(() => {
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setLoading(true);
      setCatalogError("");

      try {
        const query = new URLSearchParams({
          search,
          category,
          difficulty,
          minRating,
        });

        const data = await apiRequest("/courses?" + query, {
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setCourses(data.courses);
        }
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setCatalogError(requestError.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, category, difficulty, minRating, ratingVersion]);

  async function enroll(course) {
    setPendingId(course.id);
    setEnrollmentError("");
    setMessage("");

    try {
      const data = await apiRequest(
        "/courses/" + course.id + "/enroll",
        { token, method: "POST" }
      );

      setMyCourses((previous) =>
        previous.some((item) => item.id === course.id)
          ? previous
          : [...previous, course]
      );

      setMessage(course.title + ": " + data.message);
    } catch (requestError) {
      setEnrollmentError(requestError.message);
    } finally {
      setPendingId("");
    }
  }

  async function saveRating(event, course) {
    event.preventDefault();

    const fields = new FormData(event.currentTarget);

    setPendingId(course.id);
    setEnrollmentError("");
    setMessage("");

    try {
      const data = await apiRequest(
        "/courses/" + course.id + "/rating",
        {
          token,
          body: { rating: Number(fields.get("rating")) },
        }
      );

      setMessage(course.title + ": " + data.message);
      setRatingVersion((previous) => previous + 1);
    } catch (requestError) {
      setEnrollmentError(requestError.message);
    } finally {
      setPendingId("");
    }
  }

  return (
    <>
      {canEnroll && (
        <section>
          <h3>My enrolled courses</h3>

          {enrollmentLoading ? (
            <p role="status">Loading your enrollments...</p>
          ) : myCourses.length === 0 ? (
            <p>You have not enrolled in any courses yet.</p>
          ) : (
            <ul>
              {myCourses.map((course) => (
                <li key={course.id}>{course.title}</li>
              ))}
            </ul>
          )}

          {enrollmentError && <p role="alert">{enrollmentError}</p>}
          {message && <p role="status">{message}</p>}
        </section>
      )}

      <section>
        <h3>Course catalog</h3>

        <label>
          Search courses
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title or description"
            maxLength={200}
          />
        </label>

        <label>
          Category
          <input
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder="All categories — or type Programming"
            maxLength={100}
          />
        </label>

        <label>
          Difficulty
          <select
            value={difficulty}
            onChange={(event) => setDifficulty(event.target.value)}
            style={selectStyle}
          >
            <option value="">All difficulties</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </label>

        <label>
          Minimum rating
          <select
            value={minRating}
            onChange={(event) => setMinRating(event.target.value)}
            style={selectStyle}
          >
            <option value="0">All ratings</option>
            <option value="3">3 and above</option>
            <option value="4">4 and above</option>
            <option value="4.5">4.5 and above</option>
            <option value="5">5 only</option>
          </select>
        </label>

        {catalogError && <p role="alert">{catalogError}</p>}

        {loading ? (
          <p role="status">Loading courses...</p>
        ) : catalogError ? null : courses.length === 0 ? (
          <p>No courses found. Try different filters.</p>
        ) : (
          courses.map((course) => {
            const isEnrolled = myCourses.some(
              (item) => item.id === course.id
            );
            const isFree = Number(course.price) === 0;

            return (
              <article
                key={course.id}
                style={{
                  background: "white",
                  padding: 16,
                  borderRadius: 10,
                  marginTop: 16,
                }}
              >
                <h4>{course.title}</h4>
                <p>{course.description}</p>
                <p>
                  {course.category} · {course.difficulty}
                </p>
                <p>{isFree ? "Free" : "Price: " + course.price}</p>

      <p>
  {Number(course.rating_count) > 0
    ? Number(course.average_rating).toFixed(1) +
      " / 5 (" + course.rating_count + " ratings)"
    : "No ratings yet"}
</p>

                {canEnroll && (
                  <button
                    type="button"
                    onClick={() => enroll(course)}
                    disabled={
                      enrollmentLoading ||
                      Boolean(pendingId) ||
                      isEnrolled ||
                      !isFree
                    }
                  >
                    {enrollmentLoading
                      ? "Checking enrollment..."
                      : isEnrolled
                        ? "Enrolled"
                        : pendingId === course.id
                          ? "Enrolling..."
                          : !isFree
                            ? "Paid enrollment unavailable"
                            : "Enroll"}
                  </button>
                )}

                {canEnroll && isEnrolled && (
                  <form
                    onSubmit={(event) => saveRating(event, course)}
                    style={{ marginTop: 16 }}
                  >
                    <label>
                      Your rating
                      <select
                        name="rating"
                        defaultValue=""
                        required
                        disabled={Boolean(pendingId)}
                        style={selectStyle}
                      >
                        <option value="" disabled>
                          Choose a rating
                        </option>
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4</option>
                        <option value="5">5</option>
                      </select>
                    </label>

                    <button
                      type="submit"
                      disabled={Boolean(pendingId)}
                    >
                      {pendingId === course.id
                        ? "Saving..."
                        : "Save rating"}
                    </button>
                  </form>
                )}
              </article>
            );
          })
        )}
      </section>
    </>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const token = sessionStorage.getItem(tokenKey);

    async function restoreSession() {
      try {
        if (token) {
          const data = await apiRequest("/auth/me", {
            token,
            signal: controller.signal,
          });

          if (!controller.signal.aborted) {
            setUser(data.user);
          }
        }
      } catch (requestError) {
        if (!controller.signal.aborted) {
          sessionStorage.removeItem(tokenKey);
          setError(requestError.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setChecking(false);
        }
      }
    }

    restoreSession();
    return () => controller.abort();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();

    setBusy(true);
    setError("");
    setMessage("");

    try {
      if (mode === "register") {
        await apiRequest("/auth/register", {
          body: { fullName, email, password },
        });

        setMode("login");
        setPassword("");
        setMessage("Account created. Please log in.");
      } else {
        const login = await apiRequest("/auth/login", {
          body: { email, password },
        });

        const profile = await apiRequest("/auth/me", {
          token: login.token,
        });

        sessionStorage.setItem(tokenKey, login.token);
        setUser(profile.user);
        setPassword("");
        setMessage("");
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  function changeMode() {
    setMode(mode === "login" ? "register" : "login");
    setPassword("");
    setError("");
    setMessage("");
  }

  function logout() {
    sessionStorage.removeItem(tokenKey);
    setUser(null);
    setPassword("");
    setMode("login");
    setError("");
    setMessage("You have logged out.");
  }

  if (checking) {
    return (
      <main className="auth-card">
        Checking your session...
      </main>
    );
  }

  return (
    <main className="auth-card">
      <h1>LMS AI Platform</h1>

      {user ? (
        <>
          <h2>Welcome, {user.fullName}</h2>
          <p>{user.email}</p>
          <p>
            Roles — <strong>{user.roles.join(", ")}</strong>
          </p>

          <CourseCatalog
            key={user.id || user.email}
            token={sessionStorage.getItem(tokenKey)}
            canEnroll={user.roles.includes("student")}
          />

          {user.roles.includes("instructor") && (
            <InstructorDashboard
              key={user.id || user.email}
              token={sessionStorage.getItem(tokenKey)}
            />
          )}

          {user.roles.includes("admin") && (
            <AdminDashboard
              key={user.id || user.email}
              token={sessionStorage.getItem(tokenKey)}
            />
          )}

          <button type="button" onClick={logout}>
            Log out
          </button>
        </>
      ) : (
        <>
          <h2>
            {mode === "login" ? "Log in" : "Create account"}
          </h2>

          <form onSubmit={handleSubmit}>
            {mode === "register" && (
              <label>
                Full name
                <input
                  name="fullName"
                  autoComplete="name"
                  value={fullName}
                  onChange={(event) =>
                    setFullName(event.target.value)
                  }
                  maxLength={200}
                  required
                  disabled={busy}
                />
              </label>
            )}

            <label>
              Email
              <input
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                maxLength={254}
                required
                disabled={busy}
              />
            </label>

            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete={
                  mode === "login"
                    ? "current-password"
                    : "new-password"
                }
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                minLength={mode === "register" ? 8 : 1}
                required
                disabled={busy}
              />
            </label>

            {error && <p role="alert">{error}</p>}
            {message && <p role="status">{message}</p>}

            <button type="submit" disabled={busy}>
              {busy
                ? "Please wait..."
                : mode === "login"
                  ? "Log in"
                  : "Register"}
            </button>
          </form>

          <button
            type="button"
            onClick={changeMode}
            disabled={busy}
          >
            {mode === "login"
              ? "Create a new account"
              : "Already registered? Log in"}
          </button>
        </>
      )}
    </main>
  );
}