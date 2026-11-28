const { z } = require("zod");

module.exports = function notifications(app, pool, requireAuth) {
  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT n.id, n.read_at, n.created_at,
                a.id AS announcement_id,
                a.course_id, a.title, a.body,
                c.title AS course_title,
                u.full_name AS author_name
         FROM notifications n
         JOIN course_announcements a ON a.id = n.announcement_id
         JOIN courses c ON c.id = a.course_id
         JOIN users u ON u.id = a.author_id
         WHERE n.user_id = $1
           AND EXISTS (
             SELECT 1 FROM enrollments e
             WHERE e.course_id = a.course_id
               AND e.user_id = $1
           )
         ORDER BY n.created_at DESC, n.id DESC
         LIMIT 100`,
        [req.user.id]
      );

      const count = await pool.query(
        `SELECT COUNT(*)::int AS unread_count
         FROM notifications n
         JOIN course_announcements a ON a.id = n.announcement_id
         WHERE n.user_id = $1
           AND n.read_at IS NULL
           AND EXISTS (
             SELECT 1 FROM enrollments e
             WHERE e.course_id = a.course_id
               AND e.user_id = $1
           )`,
        [req.user.id]
      );

      return res.json({
        notifications: result.rows,
        unread_count: count.rows[0].unread_count,
      });
    } catch (error) {
      console.error("Notification loading failed:", error.message);

      return res.status(500).json({
        message: "Could not load notifications.",
      });
    }
  });

  app.patch(
    "/api/notifications/:notificationId",
    requireAuth,
    async (req, res) => {
      const id = z.string().uuid().safeParse(req.params.notificationId);
      const input = z
        .object({ read: z.boolean() })
        .strict()
        .safeParse(req.body);

      if (!id.success || !input.success) {
        return res.status(400).json({
          message: "Enter a valid notification ID and read status.",
        });
      }

      try {
        const result = await pool.query(
          `UPDATE notifications n
           SET read_at = CASE
             WHEN $3::boolean THEN COALESCE(n.read_at, NOW())
             ELSE NULL
           END
           WHERE n.id = $1
             AND n.user_id = $2
             AND EXISTS (
               SELECT 1
               FROM course_announcements a
               JOIN enrollments e ON e.course_id = a.course_id
               WHERE a.id = n.announcement_id
                 AND e.user_id = $2
             )
           RETURNING n.id, n.read_at`,
          [id.data, req.user.id, input.data.read]
        );

        if (result.rowCount === 0) {
          return res.status(404).json({
            message: "Notification unavailable.",
          });
        }

        return res.json({
          notification: result.rows[0],
        });
      } catch (error) {
        console.error("Notification update failed:", error.message);

        return res.status(500).json({
          message: "Could not update notification.",
        });
      }
    }
  );
};