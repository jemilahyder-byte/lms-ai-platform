const PDFDocument = require("pdfkit");

module.exports = function registerCertificates(
  app,
  pool,
  z,
  requireAuth,
  requireRole
) {
  const uuid = z.string().uuid();

  async function getEligibility(db, userId, courseId) {
    const result = await db.query(
      `SELECT c.id, c.title, u.full_name,
        (
          SELECT COUNT(*)::integer
          FROM lectures l
          JOIN modules m ON m.id = l.module_id
          WHERE m.course_id = c.id
        ) AS total_lessons,
        (
          SELECT COUNT(*)::integer
          FROM lectures l
          JOIN modules m ON m.id = l.module_id
          JOIN lecture_progress p ON p.lecture_id = l.id
          WHERE m.course_id = c.id
            AND p.user_id = $1 AND p.is_completed = true
        ) AS completed_lessons,
        (
          SELECT COUNT(*)::integer
          FROM quizzes q
          JOIN modules m ON m.id = q.module_id
          WHERE m.course_id = c.id
        ) AS total_quizzes,
        (
          SELECT COUNT(*)::integer
          FROM quizzes q
          JOIN modules m ON m.id = q.module_id
          WHERE m.course_id = c.id
            AND EXISTS (
              SELECT 1 FROM quiz_attempts a
              WHERE a.quiz_id = q.id AND a.user_id = $1
                AND a.submitted_at IS NOT NULL
                AND a.max_score > 0
                AND a.score::numeric * 100
                    >= q.passing_percentage::numeric * a.max_score
            )
        ) AS passed_quizzes
       FROM courses c
       JOIN enrollments e ON e.course_id = c.id AND e.user_id = $1
       JOIN users u ON u.id = e.user_id
       WHERE c.id = $2 AND c.status = 'approved'`,
      [userId, courseId]
    );

    const course = result.rows[0];
    if (!course) return null;

    course.eligible =
      course.total_lessons > 0 &&
      course.completed_lessons === course.total_lessons &&
      course.passed_quizzes === course.total_quizzes;

    return course;
  }

  app.get(
    "/api/student/courses/:courseId/certificate",
    requireAuth,
    requireRole("student"),
    async (req, res) => {
      if (!uuid.safeParse(req.params.courseId).success) {
        return res.status(400).json({ message: "Invalid course ID." });
      }

      try {
        const course = await getEligibility(
          pool,
          req.user.id,
          req.params.courseId
        );

        if (!course) {
          return res.status(403).json({
            message: "Enroll in this approved course first.",
          });
        }

        const saved = await pool.query(
          "SELECT id, issued_at FROM certificates WHERE user_id = $1 AND course_id = $2",
          [req.user.id, req.params.courseId]
        );

        return res.json({
          ...course,
          certificate: saved.rows[0] || null,
        });
      } catch (error) {
        console.error("Certificate status failed:", error.message);
        return res.status(500).json({
          message: "Could not load certificate status.",
        });
      }
    }
  );

  app.post(
    "/api/student/courses/:courseId/certificate",
    requireAuth,
    requireRole("student"),
    async (req, res) => {
      if (!uuid.safeParse(req.params.courseId).success) {
        return res.status(400).json({ message: "Invalid course ID." });
      }

      let client;

      try {
        client = await pool.connect();
        await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");

        const course = await getEligibility(
          client,
          req.user.id,
          req.params.courseId
        );

        if (!course || !course.eligible) {
          await client.query("ROLLBACK");
          return res.status(403).json({
            message: "Complete every lesson and pass every quiz first.",
          });
        }

        const saved = await client.query(
          `INSERT INTO certificates
             (user_id, course_id, student_name, course_title)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, course_id)
           DO UPDATE SET user_id = EXCLUDED.user_id
           RETURNING id, student_name, course_title, issued_at`,
          [
            req.user.id,
            req.params.courseId,
            course.full_name,
            course.title,
          ]
        );

        await client.query(
          `INSERT INTO user_badges (user_id, badge_code)
           VALUES ($1, 'first_course')
           ON CONFLICT DO NOTHING`,
          [req.user.id]
        );

        await client.query("COMMIT");

        const certificate = saved.rows[0];
        const document = new PDFDocument({
          size: "A4",
          layout: "landscape",
          margin: 50,
        });

        document.on("error", (error) => {
          console.error("Certificate PDF failed:", error.message);
          res.destroy(error);
        });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          'attachment; filename="course-certificate.pdf"'
        );
        res.setHeader("Cache-Control", "no-store");

        document.pipe(res);

        const width = document.page.width;
        const height = document.page.height;
        const textWidth = width - 140;

        document
          .rect(25, 25, width - 50, height - 50)
          .lineWidth(3)
          .stroke("#2463a5");

        document
          .fillColor("#163b65")
          .font("Helvetica-Bold")
          .fontSize(20)
          .text("LMS AI PLATFORM", 70, 65, {
            width: textWidth,
            align: "center",
          });

        document.fontSize(30).text("Certificate of Completion", 70, 115, {
          width: textWidth,
          align: "center",
        });

        document
          .font("Helvetica")
          .fontSize(16)
          .text("This certificate is awarded to", 70, 175, {
            width: textWidth,
            align: "center",
          });

        document
          .font("Helvetica-Bold")
          .fontSize(26)
          .text(certificate.student_name, 70, 210, {
            width: textWidth,
            height: 65,
            align: "center",
            ellipsis: true,
          });

        document
          .font("Helvetica")
          .fontSize(16)
          .text("For successfully completing", 70, 290, {
            width: textWidth,
            align: "center",
          });

        document
          .font("Helvetica-Bold")
          .fontSize(23)
          .text(certificate.course_title, 70, 325, {
            width: textWidth,
            height: 65,
            align: "center",
            ellipsis: true,
          });

        const date = new Date(certificate.issued_at).toLocaleDateString(
          "en-IN",
          { timeZone: "Asia/Kolkata" }
        );

        document
          .font("Helvetica")
          .fontSize(13)
          .text("Issued: " + date, 70, 425, {
            width: textWidth,
            align: "center",
          });

        document.fontSize(10).text(
          "Certificate ID: " + certificate.id,
          70,
          465,
          { width: textWidth, align: "center" }
        );

        document.end();
      } catch (error) {
        if (client) {
          await client.query("ROLLBACK").catch(() => {});
        }

        console.error("Certificate creation failed:", error.message);

        if (!res.headersSent) {
          return res.status(500).json({
            message: "Could not create certificate. Please try again.",
          });
        }

        res.destroy(error);
      } finally {
        if (client) client.release();
      }
    }
  );
};