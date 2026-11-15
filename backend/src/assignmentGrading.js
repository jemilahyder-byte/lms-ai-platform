module.exports = function registerAssignmentGrading(
  app,
  pool,
  z,
  requireAuth,
  requireRole
) {
  const uuid = z.string().uuid();

  app.get(
    "/api/instructor/courses/:courseId/submissions",
    requireAuth,
    requireRole("instructor"),
    async (req, res) => {
      const courseId = uuid.safeParse(req.params.courseId);

      if (!courseId.success) {
        return res.status(400).json({
          message: "Invalid course ID.",
        });
      }

      try {
        const access = await pool.query(
          "SELECT id FROM courses " +
            "WHERE id = $1 AND instructor_id = $2",
          [courseId.data, req.user.id]
        );

        if (access.rowCount === 0) {
          return res.status(403).json({
            message: "Course access denied.",
          });
        }

        const result = await pool.query(
          "SELECT s.id, s.assignment_id, s.submission_text, " +
            "(s.file_url IS NOT NULL) AS has_file, " +
            "s.submitted_at, s.max_score, s.score, " +
            "s.feedback, s.graded_at, " +
            "a.title AS assignment_title, " +
            "m.title AS module_title, " +
            "u.full_name AS student_name, u.email AS student_email " +
            "FROM assignment_submissions s " +
            "JOIN assignments a ON a.id = s.assignment_id " +
            "JOIN modules m ON m.id = a.module_id " +
            "JOIN users u ON u.id = s.user_id " +
            "WHERE m.course_id = $1 " +
            "ORDER BY s.submitted_at DESC, s.id",
          [courseId.data]
        );

        return res.json({
          submissions: result.rows,
        });
      } catch (error) {
        console.error("Load submissions failed:", error.message);

        return res.status(500).json({
          message: "Could not load submissions.",
        });
      }
    }
  );
  app.get(
    "/api/instructor/submissions/:submissionId/file",
    requireAuth,
    requireRole("instructor"),
    async (req, res) => {
      const submissionId = uuid.safeParse(req.params.submissionId);

      if (!submissionId.success) {
        return res.status(400).json({
          message: "Invalid submission ID.",
        });
      }

      try {
        const result = await pool.query(
          "SELECT s.file_url FROM assignment_submissions s " +
            "JOIN assignments a ON a.id = s.assignment_id " +
            "JOIN modules m ON m.id = a.module_id " +
            "JOIN courses c ON c.id = m.course_id " +
            "WHERE s.id = $1 AND c.instructor_id = $2",
          [submissionId.data, req.user.id]
        );

        if (result.rowCount === 0) {
          return res.status(404).json({
            message: "Submission not found.",
          });
        }

        const filename = result.rows[0].file_url;

        if (
          !filename ||
          !/^[0-9a-f-]{36}\.(pdf|txt|js|py|docx)$/.test(filename)
        ) {
          return res.status(404).json({
            message: "File not found.",
          });
        }

        const path = require("node:path");
        const directory = path.join(
          __dirname,
          "..",
          "uploads",
          "assignments"
        );

        res.setHeader("Cache-Control", "no-store");
        res.setHeader("X-Content-Type-Options", "nosniff");

        return res.download(
          path.join(directory, filename),
          "submission" + path.extname(filename),
          (error) => {
            if (error && !res.headersSent) {
              res.status(error.code === "ENOENT" ? 404 : 500).json({
                message: "Could not download file.",
              });
            } else if (error) {
              res.destroy();
            }
          }
        );
      } catch (error) {
        console.error("Download submission failed:", error.message);

        return res.status(500).json({
          message: "Could not download file.",
        });
      }
    }
  );
  app.post(
    "/api/instructor/submissions/:submissionId/grade",
    requireAuth,
    requireRole("instructor"),
    async (req, res) => {
      const submissionId = uuid.safeParse(req.params.submissionId);

      const body = z.object({
        score: z.number().int().min(0).max(10000),
        feedback: z.string().trim().min(1).max(20000),
      }).safeParse(req.body);

      if (!submissionId.success || !body.success) {
        return res.status(400).json({
          message: "Enter a valid score and feedback.",
        });
      }

      try {
        const result = await pool.query(
          "UPDATE assignment_submissions s " +
            "SET score = $3, feedback = $4, graded_by = $2, " +
            "graded_at = GREATEST(clock_timestamp(), s.submitted_at) " +
            "FROM assignments a " +
            "JOIN modules m ON m.id = a.module_id " +
            "JOIN courses c ON c.id = m.course_id " +
            "WHERE s.assignment_id = a.id " +
            "AND s.id = $1 AND c.instructor_id = $2 " +
            "AND $3 <= s.max_score " +
            "RETURNING s.id, s.score, s.max_score, " +
            "s.feedback, s.graded_at",
          [
            submissionId.data,
            req.user.id,
            body.data.score,
            body.data.feedback,
          ]
        );

        if (result.rowCount === 0) {
          return res.status(400).json({
            message:
              "Submission unavailable or score exceeds maximum.",
          });
        }

        return res.json({
          message: "Grade saved.",
          submission: result.rows[0],
        });
      } catch (error) {
        console.error("Grade submission failed:", error.message);

        return res.status(500).json({
          message: "Could not save grade.",
        });
      }
    }
  );
};