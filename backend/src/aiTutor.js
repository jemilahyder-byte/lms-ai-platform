const { z } = require("zod");
const { generateAnswer } = require("./gemini");
const { findTutorSources } = require("./tutorSources");

const courseIdSchema = z.string().uuid();
const questionSchema = z.object({
  question: z.string().trim().min(3).max(1000),
});

module.exports = function (
  app,
  pool,
  requireAuth,
  requireRole
) {
  app.post(
    "/api/student/courses/:courseId/tutor",
    requireAuth,
    requireRole("student"),
    async (req, res) => {
      const courseId = courseIdSchema.safeParse(
        req.params.courseId
      );
      const body = questionSchema.safeParse(req.body);

      if (!courseId.success || !body.success) {
        return res.status(400).json({
          message:
            "Provide a valid course and a question of 3–1000 characters.",
        });
      }

      try {
        const access = await pool.query(
          `SELECT c.id
           FROM courses c
           JOIN enrollments e ON e.course_id = c.id
           WHERE c.id = $1
             AND e.user_id = $2
             AND c.status = 'approved'`,
          [courseId.data, req.user.id]
        );

        if (!access.rows.length) {
          return res.status(403).json({
            message: "Enroll in this approved course first.",
          });
        }

        const sources = await findTutorSources(
          pool,
          req.user.id,
          courseId.data,
          body.data.question
        );

        if (!sources.length) {
          return res.json({
            answer:
              "I could not find relevant course material to answer this question. Try using words from the lesson.",
            sources: [],
          });
        }

        const answer = await generateAnswer(
          body.data.question,
          sources
        );

        return res.json({
          answer,
          sources: sources.map((source, index) => ({
            reference: index + 1,
            lecture_id: source.lecture_id,
            lecture_title: source.lecture_title,
            module_title: source.module_title,
            chunk_index: source.chunk_index,
            excerpt: source.content,
          })),
        });
      } catch (error) {
        console.error("AI tutor request failed:", error.name);

        return res.status(503).json({
          message:
            "AI tutor is temporarily unavailable. Please try again.",
        });
      }
    }
  );
};