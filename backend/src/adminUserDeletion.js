const { z } = require("zod");

module.exports = function (app, pool, requireAuth, requireRole) {
  app.delete(
    "/api/admin/users/:userId",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      const id = z.string().uuid().safeParse(req.params.userId);
      const email = req.body?.confirmEmail;

      if (!id.success || typeof email !== "string") {
        return res.status(400).json({
          message: "A valid user ID and confirmation email are required.",
        });
      }

      if (id.data === req.user.id) {
        return res.status(400).json({
          message: "You cannot delete your own account.",
        });
      }

      let client;

      try {
        client = await pool.connect();
        await client.query("BEGIN");

        await client.query(
          "LOCK TABLE users, user_roles IN SHARE ROW EXCLUSIVE MODE"
        );

        const actor = await client.query(`
          SELECT u.id
          FROM users u
          JOIN user_roles ur ON ur.user_id = u.id
          JOIN roles r ON r.id = ur.role_id
          WHERE u.id = $1 AND u.is_active = true
            AND r.name = 'admin'
        `, [req.user.id]);

        if (!actor.rowCount) {
          await client.query("ROLLBACK");
          return res.status(403).json({
            message: "Admin access required.",
          });
        }

        const target = await client.query(`
          SELECT u.id, u.email,
            EXISTS (
              SELECT 1
              FROM user_roles ur
              JOIN roles r ON r.id = ur.role_id
              WHERE ur.user_id = u.id AND r.name = 'admin'
            ) AS is_admin,
            EXISTS (
              SELECT 1 FROM courses c
              WHERE c.instructor_id = u.id
            ) AS owns_courses
          FROM users u
          WHERE u.id = $1
        `, [id.data]);

        const user = target.rows[0];

        if (!user) {
          await client.query("ROLLBACK");
          return res.status(404).json({
            message: "User not found.",
          });
        }

        if (email.trim().toLowerCase() !== user.email.toLowerCase()) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            message: "Confirmation email does not match.",
          });
        }

        if (user.is_admin || user.owns_courses) {
          await client.query("ROLLBACK");
          return res.status(409).json({
            message: user.is_admin
              ? "Admin accounts cannot be deleted."
              : "This user owns courses. Transfer the courses before deletion.",
          });
        }

        await client.query(
          "DELETE FROM user_roles WHERE user_id = $1",
          [id.data]
        );

        await client.query(
          "DELETE FROM users WHERE id = $1",
          [id.data]
        );

        await client.query("COMMIT");

        return res.json({
          message: "User permanently deleted.",
        });
      } catch (error) {
        if (client) {
          await client.query("ROLLBACK").catch(() => {});
        }

        console.error("Delete user failed:", error.message);

        return res.status(error.code === "23503" ? 409 : 500).json({
          message: error.code === "23503"
            ? "Related records prevent deletion. Suspend this account instead."
            : "Could not delete user.",
        });
      } finally {
        if (client) client.release();
      }
    }
  );
};