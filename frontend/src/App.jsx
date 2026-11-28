import { useEffect, useState } from "react";
import InstructorDashboard from "./InstructorDashboard";
import AdminDashboard from "./AdminDashboard";
import { StudentLearning } from "./StudentCoursePlayer";
import useLanguage from "./useLanguage";

const tokenKey = "lms-token";

const selectStyle = {
  width: "100%",
  padding: 10,
  margin: "8px 0",
};

const translations = {
  en: {
    appTitle: "LMS AI Platform",
    login: "Log in",
    logout: "Log out",
    createAccount: "Create account",
    createNewAccount: "Create a new account",
    alreadyRegistered: "Already registered? Log in",
    fullName: "Full name",
    email: "Email",
    password: "Password",
    pleaseWait: "Please wait...",
    register: "Register",
    checkingSession: "Checking your session...",
    accountCreated: "Account created. Please log in.",
    loggedOut: "You have logged out.",
    welcome: "Welcome",
    roles: "Roles",
    enrolledCourses: "My enrolled courses",
    loadingEnrollments: "Loading your enrollments...",
    noEnrollments: "You have not enrolled in any courses yet.",
    catalog: "Course catalog",
    searchCourses: "Search courses",
    searchPlaceholder: "Search title or description",
    category: "Category",
    categoryPlaceholder: "All categories — or type Programming",
    difficulty: "Difficulty",
    allDifficulties: "All difficulties",
    beginner: "Beginner",
    intermediate: "Intermediate",
    advanced: "Advanced",
    minimumRating: "Minimum rating",
    allRatings: "All ratings",
    threeAbove: "3 and above",
    fourAbove: "4 and above",
    fourHalfAbove: "4.5 and above",
    fiveOnly: "5 only",
    loadingCourses: "Loading courses...",
    noCourses: "No courses found. Try different filters.",
    free: "Free",
    price: "Price",
    ratings: "ratings",
    noRatings: "No ratings yet",
    checkingEnrollment: "Checking enrollment...",
    enrolled: "Enrolled",
    enrolling: "Enrolling...",
    paidUnavailable: "Paid enrollment unavailable",
    enroll: "Enroll",
    yourRating: "Your rating",
    chooseRating: "Choose a rating",
    saving: "Saving...",
    saveRating: "Save rating",
  },
  ta: {
    appTitle: "LMS AI கற்றல் தளம்",
    login: "உள்நுழைய",
    logout: "வெளியேறு",
    createAccount: "கணக்கு உருவாக்கு",
    createNewAccount: "புதிய கணக்கு உருவாக்கு",
    alreadyRegistered: "ஏற்கெனவே கணக்கு உள்ளதா? உள்நுழைய",
    fullName: "முழுப் பெயர்",
    email: "மின்னஞ்சல்",
    password: "கடவுச்சொல்",
    pleaseWait: "காத்திருக்கவும்...",
    register: "பதிவு செய்",
    checkingSession: "உங்கள் உள்நுழைவு சரிபார்க்கப்படுகிறது...",
    accountCreated: "கணக்கு உருவாக்கப்பட்டது. உள்நுழையுங்கள்.",
    loggedOut: "நீங்கள் வெளியேறிவிட்டீர்கள்.",
    welcome: "வரவேற்கிறோம்",
    roles: "பங்குகள்",
    enrolledCourses: "நான் சேர்ந்த பாடங்கள்",
    loadingEnrollments: "நீங்கள் சேர்ந்த பாடங்கள் ஏற்றப்படுகின்றன...",
    noEnrollments: "நீங்கள் இன்னும் எந்தப் பாடத்திலும் சேரவில்லை.",
    catalog: "பாடப் பட்டியல்",
    searchCourses: "பாடங்களைத் தேடுங்கள்",
    searchPlaceholder: "தலைப்பு அல்லது விளக்கத்தைத் தேடுங்கள்",
    category: "வகை",
    categoryPlaceholder: "அனைத்து வகைகள் — அல்லது Programming என உள்ளிடவும்",
    difficulty: "கடினத்தன்மை",
    allDifficulties: "அனைத்து நிலைகள்",
    beginner: "தொடக்க நிலை",
    intermediate: "இடைநிலை",
    advanced: "மேம்பட்ட நிலை",
    minimumRating: "குறைந்தபட்ச மதிப்பீடு",
    allRatings: "அனைத்து மதிப்பீடுகள்",
    threeAbove: "3 மற்றும் அதற்கு மேல்",
    fourAbove: "4 மற்றும் அதற்கு மேல்",
    fourHalfAbove: "4.5 மற்றும் அதற்கு மேல்",
    fiveOnly: "5 மட்டும்",
    loadingCourses: "பாடங்கள் ஏற்றப்படுகின்றன...",
    noCourses: "பாடங்கள் கிடைக்கவில்லை. வேறு வடிகட்டிகளை முயற்சிக்கவும்.",
    free: "இலவசம்",
    price: "விலை",
    ratings: "மதிப்பீடுகள்",
    noRatings: "இன்னும் மதிப்பீடுகள் இல்லை",
    checkingEnrollment: "பாடச் சேர்க்கை சரிபார்க்கப்படுகிறது...",
    enrolled: "சேர்ந்துவிட்டீர்கள்",
    enrolling: "சேர்க்கப்படுகிறது...",
    paidUnavailable: "கட்டணப் பாடச் சேர்க்கை தற்போது இல்லை",
    enroll: "பாடத்தில் சேர்",
    yourRating: "உங்கள் மதிப்பீடு",
    chooseRating: "மதிப்பீட்டைத் தேர்ந்தெடுக்கவும்",
    saving: "சேமிக்கப்படுகிறது...",
    saveRating: "மதிப்பீட்டைச் சேமி",
  },
};

function useAppText() {
  const { language } = useLanguage();
  const words = translations[language] || translations.en;
  return (key) => words[key] ?? translations.en[key] ?? key;
}

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
  const t = useAppText();
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
      const data = await apiRequest("/courses/" + course.id + "/enroll", {
        token,
        method: "POST",
      });

      setMyCourses((previous) =>
        previous.some((item) => item.id === course.id)
          ? previous
          : [...previous, course],
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
      const data = await apiRequest("/courses/" + course.id + "/rating", {
        token,
        body: { rating: Number(fields.get("rating")) },
      });

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
          <h3>{t("enrolledCourses")}</h3>

          {enrollmentLoading ? (
            <p role="status">{t("loadingEnrollments")}</p>
          ) : myCourses.length === 0 ? (
            <p>{t("noEnrollments")}</p>
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
        <h3>{t("catalog")}</h3>

        <label>
          {t("searchCourses")}
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("searchPlaceholder")}
            maxLength={200}
          />
        </label>

        <label>
          {t("category")}
          <input
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder={t("categoryPlaceholder")}
            maxLength={100}
          />
        </label>

        <label>
          {t("difficulty")}
          <select
            value={difficulty}
            onChange={(event) => setDifficulty(event.target.value)}
            style={selectStyle}
          >
            <option value="">{t("allDifficulties")}</option>
            <option value="beginner">{t("beginner")}</option>
            <option value="intermediate">{t("intermediate")}</option>
            <option value="advanced">{t("advanced")}</option>
          </select>
        </label>

        <label>
          {t("minimumRating")}
          <select
            value={minRating}
            onChange={(event) => setMinRating(event.target.value)}
            style={selectStyle}
          >
            <option value="0">{t("allRatings")}</option>
            <option value="3">{t("threeAbove")}</option>
            <option value="4">{t("fourAbove")}</option>
            <option value="4.5">{t("fourHalfAbove")}</option>
            <option value="5">{t("fiveOnly")}</option>
          </select>
        </label>

        {catalogError && <p role="alert">{catalogError}</p>}

        {loading ? (
          <p role="status">{t("loadingCourses")}</p>
        ) : catalogError ? null : courses.length === 0 ? (
          <p>{t("noCourses")}</p>
        ) : (
          courses.map((course) => {
            const isEnrolled = myCourses.some(
              (item) => item.id === course.id,
            );
            const isFree = Number(course.price) === 0;
            const difficultyLabel =
              translations.en[course.difficulty]
                ? t(course.difficulty)
                : course.difficulty;

            return (
              <article
                key={course.id}
                style={{
                  padding: 16,
                  borderRadius: 10,
                  marginTop: 16,
                  border: "1px solid #94a3b8",
                }}
              >
                <h4>{course.title}</h4>
                <p>{course.description}</p>
                <p>
                  {course.category} · {difficultyLabel}
                </p>
                <p>
                  {isFree ? t("free") : t("price") + ": " + course.price}
                </p>

                <p>
                  {Number(course.rating_count) > 0
                    ? Number(course.average_rating).toFixed(1) +
                      " / 5 (" +
                      course.rating_count +
                      " " +
                      t("ratings") +
                      ")"
                    : t("noRatings")}
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
                      ? t("checkingEnrollment")
                      : isEnrolled
                        ? t("enrolled")
                        : pendingId === course.id
                          ? t("enrolling")
                          : !isFree
                            ? t("paidUnavailable")
                            : t("enroll")}
                  </button>
                )}

                {canEnroll && isEnrolled && (
                  <form
                    onSubmit={(event) => saveRating(event, course)}
                    style={{ marginTop: 16 }}
                  >
                    <label>
                      {t("yourRating")}
                      <select
                        name="rating"
                        defaultValue=""
                        required
                        disabled={Boolean(pendingId)}
                        style={selectStyle}
                      >
                        <option value="" disabled>
                          {t("chooseRating")}
                        </option>
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4</option>
                        <option value="5">5</option>
                      </select>
                    </label>

                    <button type="submit" disabled={Boolean(pendingId)}>
                      {pendingId === course.id
                        ? t("saving")
                        : t("saveRating")}
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
  const t = useAppText();
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [messageKey, setMessageKey] = useState("");
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
    setMessageKey("");

    try {
      if (mode === "register") {
        await apiRequest("/auth/register", {
          body: { fullName, email, password },
        });

        setMode("login");
        setPassword("");
        setMessageKey("accountCreated");
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
        setMessageKey("");
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
    setMessageKey("");
  }

  function logout() {
    sessionStorage.removeItem(tokenKey);
    setUser(null);
    setPassword("");
    setMode("login");
    setError("");
    setMessageKey("loggedOut");
  }

  if (checking) {
    return (
      <main className="auth-card">
        <p role="status">{t("checkingSession")}</p>
      </main>
    );
  }

  return (
    <main className="auth-card">
      <h1>{t("appTitle")}</h1>

      {user ? (
        <>
          <h2>
            {t("welcome")}, {user.fullName}
          </h2>
          <p>{user.email}</p>
          <p>
            {t("roles")} — <strong>{user.roles.join(", ")}</strong>
          </p>

          {user.roles.includes("student") && (
            <StudentLearning token={sessionStorage.getItem(tokenKey)} />
          )}

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
            {t("logout")}
          </button>
        </>
      ) : (
        <>
          <h2>
            {mode === "login" ? t("login") : t("createAccount")}
          </h2>

          <form onSubmit={handleSubmit}>
            {mode === "register" && (
              <label>
                {t("fullName")}
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
              {t("email")}
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
              {t("password")}
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
            {messageKey && <p role="status">{t(messageKey)}</p>}

            <button type="submit" disabled={busy}>
              {busy
                ? t("pleaseWait")
                : mode === "login"
                  ? t("login")
                  : t("register")}
            </button>
          </form>

          <button type="button" onClick={changeMode} disabled={busy}>
            {mode === "login"
              ? t("createNewAccount")
              : t("alreadyRegistered")}
          </button>
        </>
      )}
    </main>
  );
}