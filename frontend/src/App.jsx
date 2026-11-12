import { useEffect, useState } from "react";

const tokenKey = "lms-token";

async function apiRequest(path, { token, body, signal } = {}) {
  const headers = {};

  if (body) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = "Bearer " + token;
  }

  const response = await fetch("/api" + path, {
    method: body ? "POST" : "GET",
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Request failed.");
  }

  return data;
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
    return <main className="auth-card">Checking your session...</main>;
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

          {user.roles.includes("student") && (
            <section>
              <h3>Student dashboard</h3>
              <p>Your enrolled courses will appear here.</p>
            </section>
          )}

          {user.roles.includes("instructor") && (
            <section>
              <h3>Instructor dashboard</h3>
              <p>Your course management tools will appear here.</p>
            </section>
          )}

          {user.roles.includes("admin") && (
            <section>
              <h3>Admin dashboard</h3>
              <p>Your platform management tools will appear here.</p>
            </section>
          )}

          <button type="button" onClick={logout}>
            Log out
          </button>
        </>
      ) : (
        <>
          <h2>{mode === "login" ? "Log in" : "Create account"}</h2>

          <form onSubmit={handleSubmit}>
            {mode === "register" && (
              <label>
                Full name
                <input
                  name="fullName"
                  autoComplete="name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
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
                  mode === "login" ? "current-password" : "new-password"
                }
                value={password}
                onChange={(event) => setPassword(event.target.value)}
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

          <button type="button" onClick={changeMode} disabled={busy}>
            {mode === "login"
              ? "Create a new account"
              : "Already registered? Log in"}
          </button>
        </>
      )}
    </main>
  );
}