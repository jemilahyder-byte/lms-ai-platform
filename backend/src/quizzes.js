module.exports = function registerQuizzes(
  app,
  pool,
  z,
  requireAuth,
  requireRole
) {
  const uuid = z.string().uuid();

  const questionSchema = z.object({
    question: z.string().trim().min(1).max(5000),
    options: z.array(z.string().trim().min(1).max(1000)).min(2).max(6),
    correctOptionIndex: z.number().int().min(0),
    points: z.number().int().min(1).max(100),
  }).refine(
    (item) => item.correctOptionIndex < item.options.length,
    { message: "Choose a valid correct answer." }
  );

  const quizSchema = z.object({
    title: z.string().trim().min(1).max(200),
    passingPercentage: z.number().int().min(0).max(100),
    questions: z.array(questionSchema).min(1).max(50),
  });

  app.post(
    "/api/instructor/modules/:moduleId/quizzes",
    requireAuth,
    requireRole("instructor"),
    async (req, res) => {
      const moduleId = uuid.safeParse(req.params.moduleId);
      const body = quizSchema.safeParse(req.body);

      if (!moduleId.success || !body.success) {
        return res.status(400).json({
          message: "Enter valid quiz details, options and correct answers.",
        });
      }

      let client;

      try {
        client = await pool.connect();
        await client.query("BEGIN");

        const access = await client.query(
          "SELECT m.id FROM modules m " +
            "JOIN courses c ON c.id = m.course_id " +
            "WHERE m.id = $1 AND c.instructor_id = $2 " +
            "FOR SHARE OF m, c",
          [moduleId.data, req.user.id]
        );

        if (access.rowCount === 0) {
          await client.query("ROLLBACK");

          return res.status(403).json({
            message: "Module access denied.",
          });
        }

        const result = await client.query(
          "INSERT INTO quizzes (module_id, title, passing_percentage) " +
            "VALUES ($1, $2, $3) " +
            "RETURNING id, module_id, title, passing_percentage",
          [
            moduleId.data,
            body.data.title,
            body.data.passingPercentage,
          ]
        );

        const quiz = result.rows[0];

        for (const [index, item] of body.data.questions.entries()) {
          await client.query(
            "INSERT INTO quiz_questions " +
              "(quiz_id, question, options, correct_option_index, " +
              "points, order_index) VALUES ($1, $2, $3::jsonb, $4, $5, $6)",
            [
              quiz.id,
              item.question,
              JSON.stringify(item.options),
              item.correctOptionIndex,
              item.points,
              index,
            ]
          );
        }

        await client.query("COMMIT");

        return res.status(201).json({
          message: "Quiz created.",
          quiz,
        });
      } catch (error) {
        if (client) {
          await client.query("ROLLBACK").catch(() => {});
        }

        console.error("Create quiz failed:", error.message);

        return res.status(500).json({
          message: "Could not create quiz.",
        });
      } finally {
        if (client) client.release();
      }
    }
  );
  app.get(
    "/api/instructor/courses/:courseId/quizzes",
    requireAuth,
    requireRole("instructor"),
    async (req, res) => {
      const courseId = uuid.safeParse(req.params.courseId);

      if (!courseId.success) {
        return res.status(400).json({
          message: "Invalid course ID.",
        });
      }

      try {
        const access = await pool.query(
          "SELECT id FROM courses " +
            "WHERE id = $1 AND instructor_id = $2",
          [courseId.data, req.user.id]
        );

        if (access.rowCount === 0) {
          return res.status(403).json({
            message: "Course access denied.",
          });
        }

        const result = await pool.query(
          "SELECT q.id, q.module_id, q.title, q.passing_percentage, " +
            "m.title AS module_title, " +
            "COUNT(qq.id)::integer AS question_count, " +
            "COALESCE(SUM(qq.points), 0)::integer AS max_score " +
            "FROM quizzes q " +
            "JOIN modules m ON m.id = q.module_id " +
            "LEFT JOIN quiz_questions qq ON qq.quiz_id = q.id " +
            "WHERE m.course_id = $1 " +
            "GROUP BY q.id, m.id " +
            "ORDER BY m.order_index, q.created_at, q.id",
          [courseId.data]
        );

        return res.json({
          quizzes: result.rows,
        });
      } catch (error) {
        console.error("Load instructor quizzes failed:", error.message);

        return res.status(500).json({
          message: "Could not load quizzes.",
        });
      }
    }
  );
  app.get(
    "/api/student/courses/:courseId/quizzes",
    requireAuth,
    requireRole("student"),
    async (req, res) => {
      const courseId = uuid.safeParse(req.params.courseId);

      if (!courseId.success) {
        return res.status(400).json({
          message: "Invalid course ID.",
        });
      }

      try {
        const access = await pool.query(
          "SELECT c.id FROM courses c " +
            "JOIN enrollments e ON e.course_id = c.id " +
            "WHERE c.id = $1 AND e.user_id = $2 " +
            "AND c.status = 'approved'",
          [courseId.data, req.user.id]
        );

        if (access.rowCount === 0) {
          return res.status(403).json({
            message: "Enroll in this course to view quizzes.",
          });
        }

        const result = await pool.query(
          "SELECT q.id, q.title, q.passing_percentage, " +
            "m.title AS module_title, " +
            "COUNT(qq.id)::integer AS question_count, " +
            "COALESCE(SUM(qq.points), 0)::integer AS max_score " +
            "FROM quizzes q " +
            "JOIN modules m ON m.id = q.module_id " +
            "JOIN quiz_questions qq ON qq.quiz_id = q.id " +
            "WHERE m.course_id = $1 " +
            "GROUP BY q.id, m.id " +
            "ORDER BY m.order_index, q.created_at, q.id",
          [courseId.data]
        );

        return res.json({
          quizzes: result.rows,
        });
      } catch (error) {
        console.error("Load student quizzes failed:", error.message);

        return res.status(500).json({
          message: "Could not load quizzes.",
        });
      }
    }
  );
  app.get(
    "/api/student/quizzes/:quizId",
    requireAuth,
    requireRole("student"),
    async (req, res) => {
      const quizId = uuid.safeParse(req.params.quizId);

      if (!quizId.success) {
        return res.status(400).json({
          message: "Invalid quiz ID.",
        });
      }

      try {
        const access = await pool.query(
          "SELECT q.id, q.title, q.passing_percentage " +
            "FROM quizzes q " +
            "JOIN modules m ON m.id = q.module_id " +
            "JOIN courses c ON c.id = m.course_id " +
            "JOIN enrollments e ON e.course_id = c.id " +
            "WHERE q.id = $1 AND e.user_id = $2 " +
            "AND c.status = 'approved'",
          [quizId.data, req.user.id]
        );

        if (access.rowCount === 0) {
          return res.status(403).json({
            message: "Quiz access denied.",
          });
        }

        const questions = await pool.query(
          "SELECT id, question, options, points, order_index " +
            "FROM quiz_questions WHERE quiz_id = $1 " +
            "ORDER BY order_index, id",
          [quizId.data]
        );

        const attempts = await pool.query(
          "SELECT id, score, max_score, submitted_at " +
            "FROM quiz_attempts " +
            "WHERE quiz_id = $1 AND user_id = $2 " +
            "AND submitted_at IS NOT NULL " +
            "ORDER BY submitted_at DESC, id DESC LIMIT 10",
          [quizId.data, req.user.id]
        );

        return res.json({
          quiz: access.rows[0],
          questions: questions.rows,
          attempts: attempts.rows,
        });
      } catch (error) {
        console.error("Load quiz questions failed:", error.message);

        return res.status(500).json({
          message: "Could not load quiz questions.",
        });
      }
    }
  );
  app.post(
    "/api/student/quizzes/:quizId/submit",
    requireAuth,
    requireRole("student"),
    async (req, res) => {
      const quizId = uuid.safeParse(req.params.quizId);
      const body = z.object({
        answers: z.array(z.object({
          questionId: uuid,
          selectedOptionIndex: z.number().int().min(0).max(5),
        })).min(1).max(50),
      }).safeParse(req.body);

      if (!quizId.success || !body.success) {
        return res.status(400).json({
          message: "Enter valid answers.",
        });
      }

      let client;

      try {
        client = await pool.connect();
        await client.query("BEGIN");

        const access = await client.query(
          "SELECT q.id, q.passing_percentage FROM quizzes q " +
            "JOIN modules m ON m.id = q.module_id " +
            "JOIN courses c ON c.id = m.course_id " +
            "JOIN enrollments e ON e.course_id = c.id " +
            "WHERE q.id = $1 AND e.user_id = $2 " +
            "AND c.status = 'approved' " +
            "FOR SHARE OF q, m, c, e",
          [quizId.data, req.user.id]
        );

        if (access.rowCount === 0) {
          await client.query("ROLLBACK");
          return res.status(403).json({
            message: "Quiz access denied.",
          });
        }

        const result = await client.query(
          "SELECT id, options, correct_option_index, points " +
            "FROM quiz_questions WHERE quiz_id = $1 " +
            "ORDER BY order_index, id FOR SHARE",
          [quizId.data]
        );

        const answers = new Map(
          body.data.answers.map((answer) => [
            answer.questionId,
            answer.selectedOptionIndex,
          ])
        );

        const valid =
          result.rows.length > 0 &&
          answers.size === body.data.answers.length &&
          answers.size === result.rows.length &&
          result.rows.every((question) =>
            answers.has(question.id) &&
            answers.get(question.id) < question.options.length
          );

        if (!valid) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            message: "Answer every question once using a valid option.",
          });
        }

        let score = 0;
        let maxScore = 0;

        for (const question of result.rows) {
          maxScore += question.points;

          if (answers.get(question.id) === question.correct_option_index) {
            score += question.points;
          }
        }

        const attempt = await client.query(
          "INSERT INTO quiz_attempts (quiz_id, user_id) " +
            "VALUES ($1, $2) RETURNING id",
          [quizId.data, req.user.id]
        );

        const attemptId = attempt.rows[0].id;

        for (const question of result.rows) {
          await client.query(
            "INSERT INTO quiz_answers " +
              "(attempt_id, quiz_id, question_id, selected_option_index) " +
              "VALUES ($1, $2, $3, $4)",
            [
              attemptId,
              quizId.data,
              question.id,
              answers.get(question.id),
            ]
          );
        }

        const saved = await client.query(
          "UPDATE quiz_attempts SET score = $2, max_score = $3, " +
            "submitted_at = GREATEST(clock_timestamp(), started_at) " +
            "WHERE id = $1 " +
            "RETURNING id, score, max_score, submitted_at",
          [attemptId, score, maxScore]
        );

        await client.query("COMMIT");

        return res.status(201).json({
          message: "Quiz submitted.",
          attempt: saved.rows[0],
          percentage: (score * 100) / maxScore,
          passed:
            score * 100 >=
            access.rows[0].passing_percentage * maxScore,
        });
      } catch (error) {
        if (client) {
          await client.query("ROLLBACK").catch(() => {});
        }

        console.error("Submit quiz failed:", error.message);

        return res.status(500).json({
          message: "Could not submit quiz.",
        });
      } finally {
        if (client) client.release();
      }
    }
  );
};