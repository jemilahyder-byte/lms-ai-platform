module.exports = function (app, pool, requireAuth, requireRole) {
  app.get(
    "/api/admin/overview",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const result = await pool.query(`
          SELECT
            (SELECT COUNT(*)::int FROM users)
              AS total_users,
            (SELECT COUNT(*)::int FROM users
              WHERE is_active = true)
              AS active_users,
            (SELECT COUNT(*)::int FROM users
              WHERE is_active = false)
              AS suspended_users,
            (SELECT COUNT(*)::int FROM courses)
              AS total_courses,
            (SELECT COUNT(*)::int FROM enrollments)
              AS total_enrollments,
            (SELECT COUNT(*)::int FROM lectures)
              AS total_lessons,
            (SELECT COUNT(*)::int FROM quizzes)
              AS total_quizzes,
            (SELECT COUNT(*)::int FROM quiz_attempts
              WHERE submitted_at IS NOT NULL)
              AS submitted_quiz_attempts
        `);

        return res.json({ statistics: result.rows[0] });
      } catch (error) {
        console.error("Admin overview failed:", error.message);
        return res.status(500).json({
          message: "Could not load platform statistics.",
        });
      }
    }
  );
};