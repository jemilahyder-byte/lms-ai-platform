const { z } = require("zod");

module.exports = function (app, pool, requireAuth) {
  app.get(
    "/api/courses/:courseId/discussion-posts",
    requireAuth,
    async (req, res) => {
      const id = z.string().uuid().safeParse(req.params.courseId);

      if (!id.success) {
        return res.status(400).json({
          message: "Invalid course ID.",
        });
      }

      try {
        const access = await pool.query(
          `SELECT c.id
           FROM courses c
           WHERE c.id = $1
             AND (
               c.instructor_id = $2
               OR $3::boolean
               OR EXISTS (
                 SELECT 1 FROM enrollments e
                 WHERE e.course_id = c.id
                   AND e.user_id = $2
               )
             )`,
          [
            id.data,
            req.user.id,
            req.user.roles.includes("admin"),
          ]
        );

        if (!access.rows.length) {
          return res.status(403).json({
            message: "Course access denied.",
          });
        }

        const posts = await pool.query(
          `SELECT p.id, p.body, p.created_at,
             t.title AS thread_title,
             u.full_name AS author_name,
             EXISTS (
               SELECT 1 FROM discussion_reports r
               WHERE r.post_id = p.id
                 AND r.reporter_id = $2
             ) AS already_reported
           FROM discussion_posts p
           JOIN discussion_threads t ON t.id = p.thread_id
           JOIN users u ON u.id = p.author_id
           WHERE t.course_id = $1
             AND p.is_hidden = false
           ORDER BY p.created_at DESC, p.id DESC
           LIMIT 100`,
          [id.data, req.user.id]
        );

        return res.json({ posts: posts.rows });
      } catch (error) {
        console.error("Discussion loading failed:", error.message);

        return res.status(500).json({
          message: "Could not load discussion posts.",
        });
      }
    }
  );
};