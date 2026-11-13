module.exports = function registerLessonNotes(
  app,
  pool,
  z,
  requireAuth,
  requireRole
) {
  async function canAccessLesson(userId, lessonId) {
    const result = await pool.query(
      "SELECT l.id FROM lectures l " +
        "JOIN modules m ON m.id = l.module_id " +
        "JOIN courses c ON c.id = m.course_id " +
        "JOIN enrollments e ON e.course_id = c.id " +
        "WHERE l.id = $1 AND e.user_id = $2 " +
        "AND c.status = 'approved'",
      [lessonId, userId]
    );

    return result.rows.length > 0;
  }

  app.get(
    "/api/student/lessons/:lessonId/note",
    requireAuth,
    requireRole("student"),
    async (req, res) => {
      const parsed = z.string().uuid().safeParse(req.params.lessonId);

      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid lesson ID." });
      }

      try {
        if (!(await canAccessLesson(req.user.id, parsed.data))) {
          return res.status(403).json({ message: "Lesson unavailable." });
        }

        const result = await pool.query(
          "SELECT content, updated_at FROM lesson_notes " +
            "WHERE user_id = $1 AND lecture_id = $2",
          [req.user.id, parsed.data]
        );

        return res.json({
          note: result.rows[0] || { content: "", updated_at: null },
        });
      } catch (error) {
        console.error("Load note failed:", error.code || error.message);
        return res.status(500).json({ message: "Could not load note." });
      }
    }
  );

  app.post(
    "/api/student/lessons/:lessonId/note",
    requireAuth,
    requireRole("student"),
    async (req, res) => {
      const lesson = z.string().uuid().safeParse(req.params.lessonId);
      const body = z
        .object({ content: z.string().max(20000) })
        .safeParse(req.body);

      if (!lesson.success || !body.success) {
        return res.status(400).json({
          message: "Invalid lesson or note. Maximum 20000 characters.",
        });
      }

      try {
        if (!(await canAccessLesson(req.user.id, lesson.data))) {
          return res.status(403).json({ message: "Lesson unavailable." });
        }

        const result = await pool.query(
          "INSERT INTO lesson_notes (user_id, lecture_id, content) " +
            "VALUES ($1, $2, $3) " +
            "ON CONFLICT (user_id, lecture_id) DO UPDATE " +
            "SET content = EXCLUDED.content, updated_at = NOW() " +
            "RETURNING content, updated_at",
          [req.user.id, lesson.data, body.data.content]
        );

        return res.json({
          message: "Note saved.",
          note: result.rows[0],
        });
      } catch (error) {
        console.error("Save note failed:", error.code || error.message);
        return res.status(500).json({ message: "Could not save note." });
      }
    }
  );
};