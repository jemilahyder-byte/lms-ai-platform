const { z } = require("zod");

module.exports = function (app, pool, requireAuth, requireRole) {
  app.get(
    "/api/instructor/courses/:courseId/analytics",
    requireAuth,
    requireRole("instructor"),
    async (req, res) => {
      const id = z.string().uuid().safeParse(req.params.courseId);

      if (!id.success) {
        return res.status(400).json({ message: "Invalid course ID." });
      }

      try {
        const course = await pool.query(
          `SELECT id, title
           FROM courses
           WHERE id = $1 AND instructor_id = $2`,
          [id.data, req.user.id]
        );

        if (!course.rows.length) {
          return res.status(403).json({ message: "Course access denied." });
        }

        const students = await pool.query(
          `SELECT u.id, u.full_name, u.email,
             (
               SELECT COUNT(*)::int
               FROM lectures l
               JOIN modules m ON m.id = l.module_id
               WHERE m.course_id = $1
             ) AS total_lessons,
             (
               SELECT COUNT(*)::int
               FROM lecture_progress p
               JOIN lectures l ON l.id = p.lecture_id
               JOIN modules m ON m.id = l.module_id
               WHERE m.course_id = $1
                 AND p.user_id = u.id
                 AND p.is_completed = true
             ) AS completed_lessons
           FROM enrollments e
           JOIN users u ON u.id = e.user_id
           WHERE e.course_id = $1
           ORDER BY u.full_name, u.id`,
          [id.data]
        );

        const quizzes = await pool.query(
          `SELECT q.id AS quiz_id, q.title AS quiz_title,
             u.id AS user_id, u.full_name,
             a.score, a.max_score,
             ROUND(
               100.0 * a.score / NULLIF(a.max_score, 0), 1
             ) AS percentage,
             q.passing_percentage, a.submitted_at
           FROM quizzes q
           JOIN modules m ON m.id = q.module_id
           JOIN enrollments e ON e.course_id = m.course_id
           JOIN users u ON u.id = e.user_id
           JOIN LATERAL (
             SELECT score, max_score, submitted_at
             FROM quiz_attempts
             WHERE quiz_id = q.id
               AND user_id = u.id
               AND submitted_at IS NOT NULL
             ORDER BY submitted_at DESC, id DESC
             LIMIT 1
           ) a ON true
           WHERE m.course_id = $1
           ORDER BY q.title, q.id, u.full_name, u.id`,
          [id.data]
        );

        const lectures = await pool.query(
          `SELECT l.id, l.title,
             COUNT(p.user_id)::int AS started,
             COUNT(p.user_id)
               FILTER (WHERE p.is_completed)::int AS completed,
             COUNT(p.user_id)
               FILTER (WHERE NOT p.is_completed)::int AS incomplete
           FROM lectures l
           JOIN modules m ON m.id = l.module_id
           LEFT JOIN lecture_progress p
             ON p.lecture_id = l.id
             AND EXISTS (
               SELECT 1
               FROM enrollments e
               WHERE e.course_id = $1 AND e.user_id = p.user_id
             )
           WHERE m.course_id = $1
           GROUP BY l.id, l.title, m.order_index, m.id, l.order_index
           ORDER BY m.order_index, m.id, l.order_index, l.id`,
          [id.data]
        );

        const lecturePositions = await pool.query(
          `SELECT
             l.id AS lecture_id,
             l.title AS lecture_title,
             u.id AS user_id,
             u.full_name,
             p.last_position_seconds,
             l.duration_seconds,
             p.is_completed,
             p.updated_at AS last_saved_at,
             CASE
               WHEN l.duration_seconds > 0 THEN
                 ROUND(
                   LEAST(
                     100.0,
                     100.0 * p.last_position_seconds
                       / NULLIF(l.duration_seconds, 0)
                   ),
                   1
                 )
               ELSE NULL
             END AS position_percentage
           FROM lecture_progress p
           JOIN lectures l ON l.id = p.lecture_id
           JOIN modules m ON m.id = l.module_id
           JOIN users u ON u.id = p.user_id
           JOIN enrollments e
             ON e.course_id = m.course_id
             AND e.user_id = p.user_id
           WHERE m.course_id = $1
           ORDER BY
             m.order_index, m.id, l.order_index, l.id,
             u.full_name, u.id`,
          [id.data]
        );

        return res.json({
          course: course.rows[0],
          students: students.rows,
          quizzes: quizzes.rows,
          lectures: lectures.rows,
          lecturePositions: lecturePositions.rows,
        });
      } catch (error) {
        console.error("Instructor analytics failed:", error.message);
        return res.status(500).json({
          message: "Could not load analytics.",
        });
      }
    }
  );
};