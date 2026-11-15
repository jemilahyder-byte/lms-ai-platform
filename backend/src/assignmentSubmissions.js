module.exports = function registerAssignmentSubmissions(
  app,
  pool,
  z,
  requireAuth,
  requireRole
) {
  const uuid = z.string().uuid();
const multer = require("multer");
  const path = require("node:path");
  const fs = require("node:fs/promises");
  const { randomUUID } = require("node:crypto");

  const uploadDirectory = path.join(
    __dirname,
    "..",
    "uploads",
    "assignments"
  );

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 5 * 1024 * 1024,
      files: 1,
      fields: 1,
      fieldSize: 20000,
      parts: 2,
    },
    fileFilter(req, file, callback) {
      const extension = path.extname(file.originalname).toLowerCase();
      const allowed = [".pdf", ".txt", ".js", ".py", ".docx"];

      if (!allowed.includes(extension)) {
        return callback(
          new Error("Upload a PDF, TXT, JS, PY or DOCX file.")
        );
      }

      callback(null, true);
    },
  }).single("file");
  app.get(
    "/api/student/courses/:courseId/assignments",
    requireAuth,
    requireRole("student"),
    async (req, res) => {
      const courseId = uuid.safeParse(req.params.courseId);

      if (!courseId.success) {
        return res.status(400).json({
          message: "Invalid course ID.",
        });
      }

      try {
        const access = await pool.query(
          "SELECT c.id FROM courses c " +
            "JOIN enrollments e ON e.course_id = c.id " +
            "WHERE c.id = $1 AND e.user_id = $2 " +
            "AND c.status = 'approved'",
          [courseId.data, req.user.id]
        );

        if (access.rowCount === 0) {
          return res.status(403).json({
            message: "Enroll in this course to view assignments.",
          });
        }

        const result = await pool.query(
          "SELECT a.id, a.module_id, a.title, a.instructions, " +
            "a.max_score, a.due_at, m.title AS module_title, " +
            "s.id AS submission_id, s.submission_text, " +
            "(s.file_url IS NOT NULL) AS has_file, " +
            "s.submitted_at, s.score, s.feedback, s.graded_at " +
            "FROM assignments a " +
            "JOIN modules m ON m.id = a.module_id " +
            "LEFT JOIN assignment_submissions s " +
            "ON s.assignment_id = a.id AND s.user_id = $2 " +
            "WHERE m.course_id = $1 " +
            "ORDER BY m.order_index, a.created_at, a.id",
          [courseId.data, req.user.id]
        );

        return res.json({
          assignments: result.rows,
        });
      } catch (error) {
        console.error("Load student assignments failed:", error.message);

        return res.status(500).json({
          message: "Could not load assignments.",
        });
      }
    }
  );
  app.post(
    "/api/student/assignments/:assignmentId/submission",
    requireAuth,
    requireRole("student"),
    (req, res, next) => {
      if (!uuid.safeParse(req.params.assignmentId).success) {
        return res.status(400).json({
          message: "Invalid assignment ID.",
        });
      }

      upload(req, res, (error) => {
        if (error) {
          return res.status(400).json({
            message:
              error.code === "LIMIT_FILE_SIZE"
                ? "File must be 5 MB or smaller."
                : error.message,
          });
        }

        next();
      });
    },
    async (req, res) => {
      let savedPath = null;
      let saved = false;

      try {
        if (!req.file || req.file.size === 0) {
          return res.status(400).json({
            message: "Choose a non-empty file.",
          });
        }

        const text = z.string().trim().max(20000).safeParse(
          req.body.submissionText || ""
        );

        if (!text.success) {
          return res.status(400).json({
            message: "Answer text must be 20000 characters or fewer.",
          });
        }

        const access = await pool.query(
          "SELECT a.id, a.due_at FROM assignments a " +
            "JOIN modules m ON m.id = a.module_id " +
            "JOIN courses c ON c.id = m.course_id " +
            "JOIN enrollments e ON e.course_id = c.id " +
            "WHERE a.id = $1 AND e.user_id = $2 " +
            "AND c.status = 'approved'",
          [req.params.assignmentId, req.user.id]
        );

        if (access.rowCount === 0) {
          return res.status(403).json({
            message: "Assignment access denied.",
          });
        }

        if (Date.now() >= new Date(access.rows[0].due_at).getTime()) {
          return res.status(400).json({
            message: "The assignment deadline has passed.",
          });
        }

        const extension = path.extname(
          req.file.originalname
        ).toLowerCase();

        const filename = randomUUID() + extension;

        await fs.mkdir(uploadDirectory, { recursive: true });
        savedPath = path.join(uploadDirectory, filename);
        await fs.writeFile(savedPath, req.file.buffer, { flag: "wx" });

        const result = await pool.query(
          "INSERT INTO assignment_submissions " +
            "(assignment_id, user_id, submission_text, file_url, max_score) " +
            "SELECT a.id, $2, $3, $4, a.max_score " +
            "FROM assignments a " +
            "WHERE a.id = $1 AND a.due_at > clock_timestamp() " +
            "ON CONFLICT (assignment_id, user_id) DO NOTHING " +
            "RETURNING id, assignment_id, submitted_at, max_score",
          [
            req.params.assignmentId,
            req.user.id,
            text.data,
            filename,
          ]
        );

        if (result.rowCount === 0) {
          return res.status(409).json({
            message: "Already submitted or the deadline has passed.",
          });
        }

        saved = true;

        return res.status(201).json({
          message: "Assignment submitted.",
          submission: result.rows[0],
        });
      } catch (error) {
        console.error("Submit assignment failed:", error.message);

        return res.status(500).json({
          message: "Could not submit assignment.",
        });
      } finally {
        if (savedPath && !saved) {
          await fs.unlink(savedPath).catch(() => {});
        }
      }
    }
  );
};