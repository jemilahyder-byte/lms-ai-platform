require("dotenv").config({
  path: require("node:path").join(__dirname, "../.env"),
});

const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
const { z } = require("zod");

const app = express();
const port = Number(process.env.PORT || 4000);
const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error("JWT_SECRET is missing from backend/.env");
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing from backend/.env");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (error) => {
  console.error("Database connection error:", error.code || error.name);
});

app.use(express.json({ limit: "16kb" }));

const registrationSchema = z.object({
  fullName: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).refine(
    (password) => Buffer.byteLength(password, "utf8") <= 72,
    { message: "Password must be at most 72 bytes." }
  )
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    return res.json({
      status: "ok",
      database: "connected",
    });
  } catch (error) {
    console.error("Database check failed:", error.code || error.name);

    return res.status(503).json({
      status: "error",
      database: "unavailable",
    });
  }
});

app.post("/api/auth/register", async (req, res) => {
  const result = registrationSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      message: "Enter a full name, valid email, and password of 8–72 bytes.",
    });
  }

  const { fullName, password } = result.data;
  const email = result.data.email.toLowerCase();
  let client;

  try {
    const passwordHash = await bcrypt.hash(password, 12);

    client = await pool.connect();
    await client.query("BEGIN");

    const roleResult = await client.query(
      "SELECT id FROM roles WHERE name = $1",
      ["student"]
    );

    if (!roleResult.rows[0]) {
      throw new Error("Student role is missing from the database.");
    }

    const { rows } = await client.query(
      `INSERT INTO users (full_name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, full_name AS "fullName", email`,
      [fullName, email, passwordHash]
    );

    const user = rows[0];

    await client.query(
      `INSERT INTO user_roles (user_id, role_id)
       VALUES ($1, $2)`,
      [user.id, roleResult.rows[0].id]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      user: { ...user, roles: ["student"] },
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Rollback failed:", rollbackError.code || rollbackError.name);
      }
    }

    if (error.code === "23505") {
      return res.status(409).json({
        message: "Email already registered.",
      });
    }

    console.error("Registration failed:", error.code || error.message);

    return res.status(500).json({
      message: "Could not register.",
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

app.post("/api/auth/login", async (req, res) => {
  const result = loginSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      message: "Enter a valid email and password.",
    });
  }

  const email = result.data.email.toLowerCase();
  const { password } = result.data;

  try {
    const { rows } = await pool.query(
      `SELECT id, full_name, email, password_hash
       FROM users
       WHERE lower(email) = $1 AND is_active = TRUE`,
      [email]
    );

    const user = rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    const token = jwt.sign({}, jwtSecret, {
      algorithm: "HS256",
      subject: user.id,
      expiresIn: "1h",
    });

    return res.json({
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login failed:", error.code || error.name);

    return res.status(500).json({
      message: "Could not log in.",
    });
  }
});

async function requireAuth(req, res, next) {
  const authorization = req.get("Authorization") || "";
  const match = /^Bearer (\S+)$/i.exec(authorization);

  if (!match) {
    return res.status(401).json({
      message: "Login required.",
    });
  }

  let payload;

  try {
    payload = jwt.verify(match[1], jwtSecret, {
      algorithms: ["HS256"],
    });
  } catch {
    return res.status(401).json({
      message: "Invalid or expired token.",
    });
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    typeof payload.sub !== "string" ||
    !z.string().uuid().safeParse(payload.sub).success
  ) {
    return res.status(401).json({
      message: "Invalid token.",
    });
  }

  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.full_name AS "fullName", u.email,
              ARRAY(
                SELECT r.name
                FROM user_roles ur
                JOIN roles r ON r.id = ur.role_id
                WHERE ur.user_id = u.id
                ORDER BY r.name
              ) AS roles
       FROM users u
       WHERE u.id = $1 AND u.is_active = TRUE`,
      [payload.sub]
    );

    if (!rows[0]) {
      return res.status(401).json({
        message: "Account unavailable.",
      });
    }

    req.user = rows[0];
    return next();
  } catch (error) {
    console.error("Authentication failed:", error.code || error.name);

    return res.status(500).json({
      message: "Could not verify account.",
    });
  }
}

app.get("/api/auth/me", requireAuth, (req, res) => {
  return res.json({ user: req.user });
});
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || !req.user.roles.includes(role)) {
      return res.status(403).json({
        message: "Access denied.",
      });
    }

    return next();
  };
}

app.get("/api/admin/check", requireAuth, requireRole("admin"), (req, res) => {
  return res.json({
    message: "Admin access allowed.",
  });
});

app.get(
  "/api/instructor/check",
  requireAuth,
  requireRole("instructor"),
  (req, res) => {
    return res.json({
      message: "Instructor access allowed.",
    });
  }
);
const courseSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(10000),
  category: z.string().trim().min(1).max(100),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
});

app.post(
  "/api/instructor/courses",
  requireAuth,
  requireRole("instructor"),
  async (req, res) => {
    const result = courseSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        message: "Enter a title, description, category and valid difficulty.",
      });
    }

    const { title, description, category, difficulty } = result.data;

    try {
      const { rows } = await pool.query(
        `INSERT INTO courses
           (instructor_id, title, description, category, difficulty)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, title, description, category, difficulty, status`,
        [req.user.id, title, description, category, difficulty]
      );

      return res.status(201).json({ course: rows[0] });
    } catch (error) {
      console.error("Course creation failed:", error.code || error.name);

      return res.status(500).json({
        message: "Could not create course.",
      });
    }
  }
);
const moduleSchema = z.object({
  title: z.string().trim().min(1).max(200),
  orderIndex: z.number().int().min(0).max(10000),
});

app.post(
  "/api/instructor/courses/:courseId/modules",
  requireAuth,
  requireRole("instructor"),
  async (req, res) => {
    const courseId = z.string().uuid().safeParse(req.params.courseId);
    const result = moduleSchema.safeParse(req.body);

    if (!courseId.success || !result.success) {
      return res.status(400).json({
        message: "Enter a valid course ID, module title and order index.",
      });
    }

    try {
      const { rows } = await pool.query(
        `INSERT INTO modules (course_id, title, order_index)
         SELECT id, $2, $3
         FROM courses
         WHERE id = $1 AND instructor_id = $4
         RETURNING id, course_id, title, order_index`,
        [
          courseId.data,
          result.data.title,
          result.data.orderIndex,
          req.user.id,
        ]
      );

      if (!rows[0]) {
        return res.status(404).json({
          message: "Course not found or unavailable to you.",
        });
      }

      return res.status(201).json({ module: rows[0] });
    } catch (error) {
     if (error.code === "23505") {
  return res.status(409).json({
    message: "A module with these details or order number already exists. Choose a different order number."
  });
} 
      console.error("Module creation failed:", error.code || error.name);
      return res.status(500).json({
        message: "Could not create module.",
      });
    }
  }
);
const lessonSchema = z.object({
  title: z.string().trim().min(1).max(200),
  videoUrl: z.string().url().max(2000).refine(
    (value) => ["http:", "https:"].includes(new URL(value).protocol)
  ),
  transcript: z.string().max(10000).default(""),
  durationSeconds: z.number().int().min(0).max(86400),
  orderIndex: z.number().int().min(0).max(10000),
});

app.post(
  "/api/instructor/modules/:moduleId/lessons",
  requireAuth,
  requireRole("instructor"),
  async (req, res) => {
    const moduleId = z.string().uuid().safeParse(req.params.moduleId);
    const result = lessonSchema.safeParse(req.body);

    if (!moduleId.success || !result.success) {
      return res.status(400).json({
        message: "Enter valid lesson details and an HTTP or HTTPS video URL.",
      });
    }

    const lesson = result.data;

    try {
      const { rows } = await pool.query(
        `INSERT INTO lectures
           (module_id, title, video_url, transcript,
            duration_seconds, order_index)
         SELECT m.id, $2, $3, $4, $5, $6
         FROM modules m
         JOIN courses c ON c.id = m.course_id
         WHERE m.id = $1 AND c.instructor_id = $7
         RETURNING id, module_id, title, video_url,
                   duration_seconds, order_index`,
        [
          moduleId.data,
          lesson.title,
          lesson.videoUrl,
          lesson.transcript,
          lesson.durationSeconds,
          lesson.orderIndex,
          req.user.id,
        ]
      );

      if (!rows[0]) {
        return res.status(404).json({
          message: "Module not found or unavailable to you.",
        });
      }

      return res.status(201).json({ lesson: rows[0] });
    } catch (error) {
      if (error.code === "23505") {
  return res.status(409).json({
    message: "A lesson with these details or order number already exists. Choose a different order number."
  });
}
      console.error("Lesson creation failed:", error.code || error.name);
      return res.status(500).json({
        message: "Could not create lesson.",
      });
    }
  }
);
app.post(
  "/api/courses/:courseId/enroll",
  requireAuth,
  requireRole("student"),
  async (req, res) => {
    const result = z.string().uuid().safeParse(req.params.courseId);

    if (!result.success) {
      return res.status(400).json({ message: "Invalid course ID." });
    }

    try {
      const { rows } = await pool.query(
        `INSERT INTO enrollments (user_id, course_id)
         SELECT $1, id
         FROM courses
         WHERE id = $2 AND status = 'approved' AND price = 0
         ON CONFLICT DO NOTHING
         RETURNING course_id, enrolled_at`,
        [req.user.id, result.data]
      );

      if (rows[0]) {
        return res.status(201).json({
          message: "Enrolled successfully.",
          enrollment: rows[0],
        });
      }

      const existing = await pool.query(
        `SELECT course_id FROM enrollments
         WHERE user_id = $1 AND course_id = $2`,
        [req.user.id, result.data]
      );

      if (existing.rows[0]) {
        return res.status(200).json({
          message: "Already enrolled.",
        });
      }

      return res.status(409).json({
        message: "Course is unavailable for free enrollment.",
      });
    } catch (error) {
      console.error("Enrollment failed:", error.code || error.name);
      return res.status(500).json({
        message: "Could not enroll.",
      });
    }
  }
);
app.post(
  "/api/admin/courses/:courseId/approve",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    const result = z.string().uuid().safeParse(req.params.courseId);

    if (!result.success) {
      return res.status(400).json({ message: "Invalid course ID." });
    }

    try {
      const { rows } = await pool.query(
        `UPDATE courses
         SET status = 'approved'
         WHERE id = $1 AND status = 'pending'
         RETURNING id, title, status`,
        [result.data]
      );

      if (!rows[0]) {
        return res.status(404).json({
          message: "Pending course not found.",
        });
      }

      return res.json({
        message: "Course approved.",
        course: rows[0],
      });
    } catch (error) {
      console.error("Course approval failed:", error.code || error.name);
      return res.status(500).json({
        message: "Could not approve course.",
      });
    }
  }
);


    app.get("/api/courses", async (req, res) => {
  const filters = z.object({
    search: z.string().trim().max(200).default(""),
    category: z.string().trim().max(100).default(""),
    difficulty: z.enum([
      "", "beginner", "intermediate", "advanced"
    ]).default(""),
    minRating: z.enum(["0", "1", "2", "3", "4", "4.5", "5"])
      .default("0")
  }).safeParse(req.query);

  if (!filters.success) {
    return res.status(400).json({ message: "Invalid filters." });
  }

  const { search, category, difficulty, minRating } = filters.data;

  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.title, c.description, c.category,
              c.difficulty, c.thumbnail_url, c.price,
              COALESCE(r.average_rating, 0)::float8 AS average_rating,
              COALESCE(r.rating_count, 0)::int AS rating_count
       FROM courses c
       LEFT JOIN (
         SELECT course_id, AVG(rating) AS average_rating,
                COUNT(*) AS rating_count
         FROM course_ratings
         GROUP BY course_id
       ) r ON r.course_id = c.id
       WHERE c.status = 'approved'
         AND ($1 = '' OR c.title ILIKE '%' || $1 || '%'
              OR c.description ILIKE '%' || $1 || '%')
         AND ($2 = '' OR c.category = $2)
         AND ($3 = '' OR c.difficulty = $3)
         AND COALESCE(r.average_rating, 0) >= $4::numeric
       ORDER BY c.created_at DESC
       LIMIT 100`,
      [search, category, difficulty, Number(minRating)]
    );

    return res.json({ courses: rows });
  } catch (error) {
    console.error("Catalog failed:", error.code || error);
    return res.status(500).json({
      message: "Could not load courses."
    });
  }
});
app.get(
  "/api/student/enrollments",
  requireAuth,
  requireRole("student"),
  async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT c.id, c.title, c.description,
                c.category, c.difficulty, e.enrolled_at
         FROM enrollments e
         JOIN courses c ON c.id = e.course_id
         WHERE e.user_id = $1
         ORDER BY e.enrolled_at DESC`,
        [req.user.id]
      );

      return res.json({ courses: rows });
    } catch (error) {
      console.error("Enrollments failed:", error.code || error);
      return res.status(500).json({
        message: "Could not load enrolled courses."
      });
    }
  }
);
app.get(
  "/api/instructor/courses",
  requireAuth,
  requireRole("instructor"),
  async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, title, description, category,
                difficulty, status
         FROM courses
         WHERE instructor_id = $1
         ORDER BY created_at DESC`,
        [req.user.id]
      );

      return res.json({ courses: rows });
    } catch (error) {
      console.error("Instructor courses failed:", error.code || error);
      return res.status(500).json({
        message: "Could not load your courses."
      });
    }
  }
);
app.get(
  "/api/admin/courses",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT c.id, c.title, c.description,
                c.category, c.difficulty, c.status,
                u.full_name AS instructor_name
         FROM courses c
         JOIN users u ON u.id = c.instructor_id
         WHERE c.status = 'pending'
         ORDER BY c.created_at DESC`
      );

      return res.json({ courses: rows });
    } catch (error) {
      console.error("Pending courses failed:", error.code || error);
      return res.status(500).json({
        message: "Could not load pending courses."
      });
    }
  }
);
app.get(
  "/api/instructor/courses/:courseId/modules",
  requireAuth,
  requireRole("instructor"),
  async (req, res) => {
    const parsed = z.string().uuid().safeParse(req.params.courseId);

    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid course ID." });
    }

    try {
      const course = await pool.query(
        `SELECT id FROM courses
         WHERE id = $1 AND instructor_id = $2`,
        [parsed.data, req.user.id]
      );

      if (course.rows.length === 0) {
        return res.status(404).json({ message: "Course not found." });
      }

      const { rows } = await pool.query(
        `SELECT id, course_id, title, order_index
         FROM modules
         WHERE course_id = $1
         ORDER BY order_index, id`,
        [parsed.data]
      );

      return res.json({ modules: rows });
    } catch (error) {
      console.error("Modules failed:", error.code || error);
      return res.status(500).json({
        message: "Could not load modules."
      });
    }
  }
);
app.post(
  "/api/courses/:courseId/rating",
  requireAuth,
  requireRole("student"),
  async (req, res) => {
    const courseId = z.string().uuid().safeParse(req.params.courseId);
    const body = z.object({
      rating: z.number().int().min(1).max(5)
    }).safeParse(req.body);

    if (!courseId.success || !body.success) {
      return res.status(400).json({
        message: "Choose a rating from 1 to 5."
      });
    }

    try {
      const { rows } = await pool.query(
        `INSERT INTO course_ratings (user_id, course_id, rating)
         SELECT $1, c.id, $3
         FROM courses c
         JOIN enrollments e ON e.course_id = c.id
         WHERE c.id = $2
           AND e.user_id = $1
           AND c.status = 'approved'
           AND c.instructor_id <> $1
         ON CONFLICT (user_id, course_id)
         DO UPDATE SET rating = EXCLUDED.rating,
                       updated_at = NOW()
         RETURNING course_id, rating`,
        [req.user.id, courseId.data, body.data.rating]
      );

      if (rows.length === 0) {
        return res.status(403).json({
          message: "Enroll in this course before rating it. Instructors cannot rate their own courses."
        });
      }

      return res.json({
        message: "Rating saved.",
        rating: rows[0]
      });
    } catch (error) {
      console.error("Rating failed:", error.code || error);
      return res.status(500).json({
        message: "Could not save rating."
      });
    }
  }
);
const server = app.listen(port, "127.0.0.1", () => {
  console.log("LMS API running at http://127.0.0.1:" + port);
});

server.on("error", (error) => {
  console.error("Server failed to start:", error.message);
  process.exit(1);
});