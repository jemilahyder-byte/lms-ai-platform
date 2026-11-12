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
  ),
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
const server = app.listen(port, "127.0.0.1", () => {
  console.log("LMS API running at http://127.0.0.1:" + port);
});

server.on("error", (error) => {
  console.error("Server failed to start:", error.message);
  process.exit(1);
});