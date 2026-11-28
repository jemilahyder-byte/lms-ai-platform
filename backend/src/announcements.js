const { sendAnnouncementEmail } = require("./mailer");
const { z } = require("zod");

const uuid = z.string().uuid();

const announcementSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(10000),
  })
  .strict();

module.exports = function announcements(
  app,
  pool,
  requireAuth,
  requireRole
) {
  app.get(
    "/api/courses/:courseId/announcements",
    requireAuth,
    async (req, res) => {
      const courseId = uuid.safeParse(req.params.courseId);

      if (!courseId.success) {
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
                 SELECT 1
                 FROM enrollments e
                 WHERE e.course_id = c.id
                   AND e.user_id = $2
               )
             )`,
          [
            courseId.data,
            req.user.id,
            req.user.roles.includes("admin"),
          ]
        );

        if (access.rowCount === 0) {
          return res.status(403).json({
            message: "Course access denied.",
          });
        }

        const result = await pool.query(
          `SELECT a.id, a.course_id, a.title, a.body,
                  a.created_at, u.full_name AS author_name
           FROM course_announcements a
           JOIN users u ON u.id = a.author_id
           WHERE a.course_id = $1
           ORDER BY a.created_at DESC, a.id DESC
           LIMIT 100`,
          [courseId.data]
        );

        return res.json({
          announcements: result.rows,
        });
      } catch (error) {
        console.error("Announcement loading failed:", error.message);

        return res.status(500).json({
          message: "Could not load announcements.",
        });
      }
    }
  );

  app.post(
    "/api/instructor/courses/:courseId/announcements",
    requireAuth,
    requireRole("instructor"),
    async (req, res) => {
      const courseId = uuid.safeParse(req.params.courseId);
      const input = announcementSchema.safeParse(req.body);

      if (!courseId.success || !input.success) {
        return res.status(400).json({
          message: "Enter a valid course, title and message.",
        });
      }

      try {
        const result = await pool.query(
          `WITH announcement AS (
             INSERT INTO course_announcements (
               course_id, author_id, title, body
             )
             SELECT c.id, $2, $3, $4
             FROM courses c
             WHERE c.id = $1
               AND c.instructor_id = $2
             RETURNING id, course_id, title, body, created_at
           ),
           recipients AS (
             SELECT DISTINCT e.user_id
             FROM enrollments e
             JOIN users u ON u.id = e.user_id
             WHERE e.course_id = $1
               AND u.is_active = TRUE
               AND e.user_id <> $2
           ),
           delivered AS (
             INSERT INTO notifications (
               user_id, announcement_id
             )
             SELECT r.user_id, a.id
             FROM recipients r
             CROSS JOIN announcement a
             ON CONFLICT (user_id, announcement_id) DO NOTHING
             RETURNING id
           )
           SELECT a.*,
                  (SELECT COUNT(*)::int FROM delivered)
                    AS notification_count
           FROM announcement a`,
          [
            courseId.data,
            req.user.id,
            input.data.title,
            input.data.body,
          ]
        );

        if (result.rowCount === 0) {
          return res.status(403).json({
            message: "You can announce only in your own course.",
          });
        }
const announcement = result.rows[0];

(async () => {
  const recipients = await pool.query(
    `SELECT DISTINCT u.id, u.email, c.title AS course_title
     FROM notifications n
     JOIN users u ON u.id = n.user_id
     JOIN course_announcements a ON a.id = n.announcement_id
     JOIN courses c ON c.id = a.course_id
     JOIN enrollments e
       ON e.course_id = c.id AND e.user_id = u.id
     WHERE n.announcement_id = $1
       AND u.is_active = TRUE`,
    [announcement.id]
  );

  let sent = 0;
  let failed = 0;

  for (const recipient of recipients.rows) {
    try {
      await sendAnnouncementEmail({
        to: recipient.email,
        courseTitle: recipient.course_title,
        title: announcement.title,
        body: announcement.body,
      });
      sent += 1;
    } catch (error) {
      failed += 1;
      console.error("Announcement email failed:", error.code || error.name);
    }
  }

  console.log("Announcement emails:", { sent, failed });
})().catch((error) => {
  console.error("Announcement email loading failed:", error.code || error.name);
});
        return res.status(201).json({
          message: "Announcement published.",
          announcement: result.rows[0],
        });
      } catch (error) {
        console.error("Announcement creation failed:", error.message);

        return res.status(500).json({
          message: "Could not publish announcement.",
        });
      }
    }
  );
};