const { z } = require("zod");
const { generateQuizMaterial } = require("./quizMaterial");

module.exports = function (app, pool, requireAuth, requireRole) {
  app.post(
    "/api/instructor/modules/:moduleId/quiz-draft",
    requireAuth,
    requireRole("instructor"),
    async (req, res) => {
      const id = z.string().uuid().safeParse(req.params.moduleId);

      if (!id.success) {
        return res.status(400).json({
          message: "Provide a valid module ID.",
        });
      }

      try {
        const owned = await pool.query(
          `SELECT m.id
           FROM modules m
           JOIN courses c ON c.id = m.course_id
           WHERE m.id = $1 AND c.instructor_id = $2`,
          [id.data, req.user.id]
        );

        if (!owned.rows.length) {
          return res.status(403).json({
            message: "You can generate quizzes only for your own courses.",
          });
        }

    const { rows: lessons } = await pool.query(
          `SELECT id, title, transcript
           FROM lectures
           WHERE module_id = $1
           ORDER BY order_index, id`,
          [id.data]
        );

        const sources = lessons.filter(
          (lesson) => lesson.transcript?.trim()
        );

        if (!sources.length) {
          return res.status(422).json({
            message: "Add lesson transcripts to this module first.",
          });
        }

        const totalLength = sources.reduce(
          (total, lesson) => total + lesson.transcript.length,
          0
        );

        if (totalLength > 20000) {
          return res.status(422).json({
            message: "This module has too much material to process.",
          });
        }

        const draft = await generateQuizMaterial(sources);
        return res.json(draft);
      } catch (error) {
        console.error("AI quiz draft failed:", error.name, error.message);
        return res.status(503).json({
          message: "Quiz generation is unavailable. Try again.",
        });
      }
    }
  );
};

