const { z } = require("zod");
const { generateStudyMaterial } = require("./studyMaterial");

module.exports = function (app, pool, requireAuth, requireRole) {
  app.post(
    "/api/student/lessons/:lessonId/study",
    requireAuth,
    requireRole("student"),
    async (req, res) => {
      const options = z.object({
  level: z.enum(["beginner", "intermediate", "advanced"]).default("beginner")
}).safeParse(req.body ?? {});

if (!options.success) {
  return res.status(400).json({
    message: "Choose beginner, intermediate or advanced explanation.",
  });
}
      const id = z.string().uuid().safeParse(req.params.lessonId);

      if (!id.success) {
        return res.status(400).json({
          message: "Provide a valid lesson ID.",
        });
      }

      try {
        const { rows } = await pool.query(
          `SELECT l.id, l.title, l.transcript
           FROM lectures l
           JOIN modules m ON m.id = l.module_id
           JOIN courses c ON c.id = m.course_id
           JOIN enrollments e ON e.course_id = c.id
           WHERE l.id = $1 AND e.user_id = $2
             AND c.status = 'approved'`,
          [id.data, req.user.id]
        );

        if (!rows.length) {
          return res.status(403).json({
            message: "Lesson unavailable or enrollment required.",
          });
        }

        const lesson = rows[0];

        if (!lesson.transcript?.trim()) {
          return res.status(422).json({
            message: "This lesson has no learning material yet.",
          });
        }

        if (lesson.transcript.length > 10000) {
          return res.status(422).json({
            message: "This lesson's material is too long to process.",
          });
        }

        const material = await generateStudyMaterial(
  lesson,
  options.data.level
);

        return res.json({
          ...material,
          source: { lecture_id: lesson.id, title: lesson.title },
        });
      } catch (error) {
        console.error("Lesson study failed:", error.name);
        return res.status(503).json({
          message: "Study tools are temporarily unavailable. Try again.",
        });
      }
    }
  );
};

