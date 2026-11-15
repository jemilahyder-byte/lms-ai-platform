module.exports = function registerAssignments(
  app,
  pool,
  z,
  requireAuth,
  requireRole
) {
  const uuid = z.string().uuid();
  app.get(
    "/api/instructor/courses/:courseId/modules",
    requireAuth,
    requireRole("instructor"),
    async (req, res) => {
      const parsed = uuid.safeParse(req.params.courseId);

      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid course ID." });
      }

      try {
        const course = await pool.query(
          "SELECT id FROM courses WHERE id = $1 AND instructor_id = $2",
          [parsed.data, req.user.id]
        );

        if (course.rowCount === 0) {
          return res.status(403).json({ message: "Course access denied." });
        }

        const result = await pool.query(
          "SELECT id, title, order_index FROM modules " +
            "WHERE course_id = $1 ORDER BY order_index, id",
          [parsed.data]
        );

        return res.json({ modules: result.rows });
      } catch (error) {
        console.error("Load modules failed:", error.message);
        return res.status(500).json({
          message: "Could not load modules.",
        });
      }
    }
  );

  const assignmentSchema = z.object({
    title: z.string().trim().min(1).max(200),
    instructions: z.string().trim().min(1).max(20000),
    maxScore: z.number().int().min(1).max(10000),
    dueAt: z.string().datetime({ offset: true }),
  });

  app.post(
    "/api/instructor/modules/:moduleId/assignments",
    requireAuth,
    requireRole("instructor"),
    async (req, res) => {
      const moduleId = uuid.safeParse(req.params.moduleId);
      const body = assignmentSchema.safeParse(req.body);

      if (!moduleId.success || !body.success) {
        return res.status(400).json({
          message: "Enter a title, instructions, maximum score and valid deadline.",
        });
      }

      if (Date.parse(body.data.dueAt) <= Date.now()) {
        return res.status(400).json({
          message: "Deadline must be in the future.",
        });
      }

      try {
        const result = await pool.query(
          "INSERT INTO assignments " +
            "(module_id, title, instructions, max_score, due_at) " +
            "SELECT m.id, $3, $4, $5, $6 FROM modules m " +
            "JOIN courses c ON c.id = m.course_id " +
            "WHERE m.id = $1 AND c.instructor_id = $2 " +
            "RETURNING id, module_id, title, instructions, " +
            "max_score, due_at, created_at",
          [
            moduleId.data,
            req.user.id,
            body.data.title,
            body.data.instructions,
            body.data.maxScore,
            body.data.dueAt,
          ]
        );

        if (result.rowCount === 0) {
          return res.status(403).json({
            message: "You can create assignments only for your own course.",
          });
        }

        return res.status(201).json({
          message: "Assignment created.",
          assignment: result.rows[0],
        });
      } catch (error) {
        console.error("Create assignment failed:", error.message);
        return res.status(500).json({
          message: "Could not create assignment.",
        });
      }
    }
  );

  app.get(
    "/api/instructor/courses/:courseId/assignments",
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
        const course = await pool.query(
          "SELECT id FROM courses WHERE id = $1 AND instructor_id = $2",
          [courseId.data, req.user.id]
        );

        if (course.rowCount === 0) {
          return res.status(403).json({
            message: "You can view assignments only for your own course.",
          });
        }

        const result = await pool.query(
          "SELECT a.id, a.module_id, a.title, a.instructions, " +
            "a.max_score, a.due_at, a.created_at, " +
            "m.title AS module_title " +
            "FROM assignments a " +
            "JOIN modules m ON m.id = a.module_id " +
            "WHERE m.course_id = $1 " +
            "ORDER BY m.order_index, a.created_at, a.id",
          [courseId.data]
        );

        return res.json({ assignments: result.rows });
      } catch (error) {
        console.error("List assignments failed:", error.message);
        return res.status(500).json({
          message: "Could not load assignments.",
        });
      }
    }
  );
};