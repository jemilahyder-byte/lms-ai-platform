const { z } = require("zod");
const { generateStudyPlan } = require("./studyPlanMaterial");

module.exports = function (app, pool, requireAuth, requireRole) {
  app.post(
    "/api/student/courses/:courseId/study-plan",
    requireAuth,
    requireRole("student"),
    async (req, res) => {
      const id = z.string().uuid().safeParse(req.params.courseId);

      if (!id.success) {
        return res.status(400).json({
          message: "Provide a valid course ID.",
        });
      }

      try {
        const access = await pool.query(
          "SELECT c.id FROM courses c " +
          "JOIN enrollments e ON e.course_id = c.id " +
          "WHERE c.id = $1 AND e.user_id = $2 " +
          "AND c.status = 'approved'",
          [id.data, req.user.id]
        );

        if (!access.rows.length) {
          return res.status(403).json({
            message: "Course unavailable or enrollment required.",
          });
        }

        const results = await pool.query(
          "SELECT q.title AS quiz, m.title AS module, " +
          "q.passing_percentage, a.score, a.max_score, " +
          "a.submitted_at " +
          "FROM quizzes q " +
          "JOIN modules m ON m.id = q.module_id " +
          "JOIN LATERAL (" +
          "SELECT score, max_score, submitted_at " +
          "FROM quiz_attempts " +
          "WHERE quiz_id = q.id AND user_id = $2 " +
          "AND submitted_at IS NOT NULL " +
          "ORDER BY submitted_at DESC, id DESC LIMIT 1" +
          ") a ON true " +
          "WHERE m.course_id = $1 " +
          "ORDER BY a.score::numeric / NULLIF(a.max_score, 0), q.id " +
          "LIMIT 10",
          [id.data, req.user.id]
        );

        if (!results.rows.length) {
          return res.status(422).json({
            message: "Submit a course quiz first, then generate your study plan.",
          });
        }

        const plan = await generateStudyPlan(results.rows);
        return res.json({ ...plan, results: results.rows });
      } catch (error) {
        console.error("Study plan failed:", error.name, error.message);
        return res.status(503).json({
          message: "Study plan unavailable. Try again.",
        });
      }
    }
  );
};