const { z } = require("zod");

module.exports = function (app, pool, requireAuth) {
  const courseAccess = `
    SELECT c.id FROM courses c
    WHERE c.id = $1
      AND (
        c.instructor_id = $2
        OR $3::boolean
        OR EXISTS (
          SELECT 1 FROM enrollments e
          WHERE e.course_id = c.id AND e.user_id = $2
        )
      )
  `;

  app.post(
    "/api/courses/:courseId/discussions",
    requireAuth,
    async (req, res) => {
      const id = z.string().uuid().safeParse(req.params.courseId);
      const input = z.object({
        title: z.string().trim().min(1).max(200),
        body: z.string().trim().min(1).max(10000),
      }).strict().safeParse(req.body);

      if (!id.success || !input.success) {
        return res.status(400).json({
          message: "Enter a valid course, title and message.",
        });
      }

      try {
        const result = await pool.query(
          `WITH allowed AS (${courseAccess}),
          thread AS (
            INSERT INTO discussion_threads
              (course_id, author_id, title)
            SELECT id, $2, $4 FROM allowed
            RETURNING id
          )
          INSERT INTO discussion_posts
            (thread_id, author_id, body)
          SELECT id, $2, $5 FROM thread
          RETURNING id, thread_id`,
          [
            id.data,
            req.user.id,
            req.user.roles.includes("admin"),
            input.data.title,
            input.data.body,
          ]
        );

        if (!result.rows.length) {
          return res.status(403).json({
            message: "Course access denied.",
          });
        }

        return res.status(201).json({
          message: "Discussion created.",
          post: result.rows[0],
        });
      } catch (error) {
        console.error("Discussion creation failed:", error.message);
        return res.status(500).json({
          message: "Could not create discussion.",
        });
      }
    }
  );

  app.post(
    "/api/discussions/threads/:threadId/replies",
    requireAuth,
    async (req, res) => {
      const id = z.string().uuid().safeParse(req.params.threadId);
      const input = z.object({
        body: z.string().trim().min(1).max(10000),
      }).strict().safeParse(req.body);

      if (!id.success || !input.success) {
        return res.status(400).json({
          message: "Enter a valid discussion and reply.",
        });
      }

      try {
        const result = await pool.query(
          `INSERT INTO discussion_posts
            (thread_id, author_id, body)
          SELECT t.id, $2, $4
          FROM discussion_threads t
          JOIN courses c ON c.id = t.course_id
          WHERE t.id = $1
            AND (
              c.instructor_id = $2
              OR $3::boolean
              OR EXISTS (
                SELECT 1 FROM enrollments e
                WHERE e.course_id = c.id AND e.user_id = $2
              )
            )
          RETURNING id, thread_id`,
          [
            id.data,
            req.user.id,
            req.user.roles.includes("admin"),
            input.data.body,
          ]
        );

        if (!result.rows.length) {
          return res.status(403).json({
            message: "Discussion unavailable or access denied.",
          });
        }

        return res.status(201).json({
          message: "Reply posted.",
          post: result.rows[0],
        });
      } catch (error) {
        console.error("Discussion reply failed:", error.message);
        return res.status(500).json({
          message: "Could not post reply.",
        });
      }
    }
  );
};