module.exports = function registerLessonBookmarks(
  app,
  pool,
  z,
  requireAuth,
  requireRole
) {
  const basePath = "/api/student/lessons/:lessonId/bookmarks";

  async function checkLesson(req, res, next) {
    const parsed = z.string().uuid().safeParse(req.params.lessonId);

    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid lesson ID." });
    }

    try {
      const result = await pool.query(
        "SELECT l.id FROM lectures l " +
          "JOIN modules m ON m.id = l.module_id " +
          "JOIN courses c ON c.id = m.course_id " +
          "JOIN enrollments e ON e.course_id = c.id " +
          "WHERE l.id = $1 AND e.user_id = $2 " +
          "AND c.status = 'approved'",
        [parsed.data, req.user.id]
      );

      if (!result.rows.length) {
        return res.status(403).json({ message: "Lesson unavailable." });
      }

      return next();
    } catch (error) {
      console.error("Bookmark access failed:", error.code || error.message);
      return res.status(500).json({ message: "Could not access lesson." });
    }
  }

  app.get(
    basePath,
    requireAuth,
    requireRole("student"),
    checkLesson,
    async (req, res) => {
      try {
        const result = await pool.query(
          "SELECT id, position_seconds, label, created_at " +
            "FROM lesson_bookmarks " +
            "WHERE user_id = $1 AND lecture_id = $2 " +
            "ORDER BY position_seconds, id",
          [req.user.id, req.params.lessonId]
        );

        return res.json({ bookmarks: result.rows });
      } catch (error) {
        console.error("Load bookmarks failed:", error.code || error.message);
        return res.status(500).json({
          message: "Could not load bookmarks.",
        });
      }
    }
  );

  app.post(
    basePath,
    requireAuth,
    requireRole("student"),
    checkLesson,
    async (req, res) => {
      const parsed = z
        .object({
          positionSeconds: z.number().int().min(0).max(86400),
          label: z.string().trim().max(200).default(""),
        })
        .safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid position or label. Maximum label: 200 characters.",
        });
      }

      try {
        const result = await pool.query(
          "INSERT INTO lesson_bookmarks " +
            "(user_id, lecture_id, position_seconds, label) " +
            "VALUES ($1, $2, $3, $4) " +
            "ON CONFLICT (user_id, lecture_id, position_seconds) " +
            "DO UPDATE SET label = EXCLUDED.label " +
            "RETURNING id, position_seconds, label, created_at",
          [
            req.user.id,
            req.params.lessonId,
            parsed.data.positionSeconds,
            parsed.data.label,
          ]
        );

        return res.json({
          message: "Bookmark saved.",
          bookmark: result.rows[0],
        });
      } catch (error) {
        console.error("Save bookmark failed:", error.code || error.message);
        return res.status(500).json({
          message: "Could not save bookmark.",
        });
      }
    }
  );

  app.delete(
    basePath + "/:bookmarkId",
    requireAuth,
    requireRole("student"),
    checkLesson,
    async (req, res) => {
      const parsed = z.string().uuid().safeParse(req.params.bookmarkId);

      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid bookmark ID." });
      }

      try {
        const result = await pool.query(
          "DELETE FROM lesson_bookmarks " +
            "WHERE id = $1 AND user_id = $2 AND lecture_id = $3 " +
            "RETURNING id",
          [parsed.data, req.user.id, req.params.lessonId]
        );

        if (!result.rows.length) {
          return res.status(404).json({ message: "Bookmark not found." });
        }

        return res.json({ message: "Bookmark deleted." });
      } catch (error) {
        console.error("Delete bookmark failed:", error.code || error.message);
        return res.status(500).json({
          message: "Could not delete bookmark.",
        });
      }
    }
  );
};