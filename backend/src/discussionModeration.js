const { z } = require("zod");

module.exports = function (app, pool, requireAuth, requireRole) {
  const uuid = z.string().uuid();

  // Students can report posts only in courses they can access.
  app.post(
    "/api/discussions/posts/:postId/report",
    requireAuth,
    async (req, res) => {
      const id = uuid.safeParse(req.params.postId);
      const body = z.object({
        reason: z.string().trim().min(1).max(1000),
      }).strict().safeParse(req.body);

      if (!id.success || !body.success) {
        return res.status(400).json({
          message: "Enter a report reason of 1–1000 characters.",
        });
      }

      try {
        const result = await pool.query(`
          INSERT INTO discussion_reports (post_id, reporter_id, reason)
          SELECT p.id, $2, $3
          FROM discussion_posts p
          JOIN discussion_threads t ON t.id = p.thread_id
          JOIN courses c ON c.id = t.course_id
          WHERE p.id = $1 AND p.is_hidden = false
            AND (
              $4::boolean
              OR c.instructor_id = $2
              OR EXISTS (
                SELECT 1 FROM enrollments e
                WHERE e.course_id = c.id AND e.user_id = $2
              )
            )
          ON CONFLICT (post_id, reporter_id) DO NOTHING
          RETURNING id
        `, [
          id.data,
          req.user.id,
          body.data.reason,
          req.user.roles.includes("admin"),
        ]);

        if (!result.rowCount) {
          return res.status(409).json({
            message: "Post unavailable or already reported.",
          });
        }

        return res.status(201).json({
          message: "Report submitted for admin review.",
        });
      } catch (error) {
        console.error("Report post failed:", error.message);
        return res.status(500).json({
          message: "Could not submit report.",
        });
      }
    }
  );

  app.get(
    "/api/admin/discussion-reports",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const result = await pool.query(`
          SELECT
            r.id, r.reason, r.status, r.created_at,
            r.reviewed_at,
            reporter.full_name AS reporter_name,
            author.full_name AS author_name,
            p.id AS post_id, p.body, p.is_hidden,
            t.title AS thread_title,
            c.title AS course_title
          FROM discussion_reports r
          JOIN discussion_posts p ON p.id = r.post_id
          JOIN discussion_threads t ON t.id = p.thread_id
          JOIN courses c ON c.id = t.course_id
          JOIN users reporter ON reporter.id = r.reporter_id
          JOIN users author ON author.id = p.author_id
          ORDER BY
            CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END,
            r.created_at DESC, r.id
          LIMIT 200
        `);

        return res.json({ reports: result.rows });
      } catch (error) {
        console.error("Load reports failed:", error.message);
        return res.status(500).json({
          message: "Could not load reports.",
        });
      }
    }
  );

  app.patch(
    "/api/admin/discussion-reports/:reportId",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      const id = uuid.safeParse(req.params.reportId);
      const body = z.object({
        action: z.enum(["hide", "restore", "dismiss"]),
      }).strict().safeParse(req.body);

      if (!id.success || !body.success) {
        return res.status(400).json({
          message: "Choose hide, restore or dismiss.",
        });
      }

      let client;

      try {
        client = await pool.connect();
        await client.query("BEGIN");

        // Lock the post first so reports on the same post serialize.
        const post = await client.query(`
          SELECT p.id
          FROM discussion_posts p
          JOIN discussion_reports r ON r.post_id = p.id
          WHERE r.id = $1
          FOR UPDATE OF p
        `, [id.data]);

        if (!post.rowCount) {
          await client.query("ROLLBACK");
          return res.status(404).json({
            message: "Report not found.",
          });
        }

        const report = await client.query(`
          SELECT id, post_id
          FROM discussion_reports
          WHERE id = $1
          FOR UPDATE
        `, [id.data]);

        if (!report.rowCount) {
          await client.query("ROLLBACK");
          return res.status(404).json({
            message: "Report not found.",
          });
        }

        const action = body.data.action;
        const postId = report.rows[0].post_id;

        if (action === "dismiss") {
          await client.query(`
            UPDATE discussion_reports
            SET status = 'dismissed',
                reviewed_by = $2, reviewed_at = now()
            WHERE id = $1
          `, [id.data, req.user.id]);
        } else {
          await client.query(`
            UPDATE discussion_posts
            SET is_hidden = $2,
                moderated_by = $3, moderated_at = now()
            WHERE id = $1
          `, [postId, action === "hide", req.user.id]);

          if (action === "hide") {
            await client.query(`
              UPDATE discussion_reports
              SET status = 'resolved',
                  reviewed_by = $2, reviewed_at = now()
              WHERE post_id = $1 AND status = 'pending'
            `, [postId, req.user.id]);
          } else {
            await client.query(`
              UPDATE discussion_reports
              SET status = 'dismissed',
                  reviewed_by = $2, reviewed_at = now()
              WHERE id = $1
            `, [id.data, req.user.id]);
          }
        }

        await client.query("COMMIT");

        return res.json({
          message:
            action === "hide"
              ? "Post hidden. Pending reports resolved."
              : action === "restore"
                ? "Post restored."
                : "Report dismissed.",
        });
      } catch (error) {
        if (client) {
          await client.query("ROLLBACK").catch(() => {});
        }

        console.error("Moderation failed:", error.message);
        return res.status(500).json({
          message: "Could not update report.",
        });
      } finally {
        if (client) client.release();
      }
    }
  );
};