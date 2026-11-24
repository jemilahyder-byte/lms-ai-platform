const { z } = require("zod");

module.exports = function (app, pool, requireAuth, requireRole) {
  const changesSchema = z.object({
    is_active: z.boolean(),
    roles: z.array(
      z.enum(["student", "instructor", "admin"])
    ).min(1).max(3),
  }).strict();

  app.get(
    "/api/admin/users",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const result = await pool.query(`
          SELECT u.id, u.full_name, u.email, u.is_active,
            ARRAY(
              SELECT r.name
              FROM user_roles ur
              JOIN roles r ON r.id = ur.role_id
              WHERE ur.user_id = u.id
              ORDER BY r.name
            ) AS roles
          FROM users u
          ORDER BY u.full_name, u.id
        `);

        return res.json({
          users: result.rows,
          currentUserId: req.user.id,
        });
      } catch (error) {
        console.error("List users failed:", error.message);
        return res.status(500).json({
          message: "Could not load users.",
        });
      }
    }
  );

  app.patch(
    "/api/admin/users/:userId",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      const id = z.string().uuid().safeParse(req.params.userId);
      const changes = changesSchema.safeParse(req.body);

      if (!id.success || !changes.success) {
        return res.status(400).json({
          message: "Choose valid roles and account status.",
        });
      }

      if (id.data === req.user.id) {
        return res.status(400).json({
          message: "You cannot change your own account here.",
        });
      }

      let client;

      try {
        client = await pool.connect();
        await client.query("BEGIN");

        await client.query(
          "LOCK TABLE users, user_roles IN SHARE ROW EXCLUSIVE MODE"
        );

        // Recheck permission after acquiring the transaction lock.
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

        const target = await client.query(
          "SELECT id FROM users WHERE id = $1",
          [id.data]
        );

        if (!target.rowCount) {
          await client.query("ROLLBACK");
          return res.status(404).json({
            message: "User not found.",
          });
        }

        const roles = [...new Set(changes.data.roles)];

        await client.query(`
          UPDATE users
          SET is_active = $1, updated_at = now()
          WHERE id = $2
        `, [changes.data.is_active, id.data]);

        await client.query(
          "DELETE FROM user_roles WHERE user_id = $1",
          [id.data]
        );

        const inserted = await client.query(`
          INSERT INTO user_roles (user_id, role_id)
          SELECT $1, id FROM roles
          WHERE name = ANY($2::text[])
          RETURNING role_id
        `, [id.data, roles]);

        if (inserted.rowCount !== roles.length) {
          throw new Error("Required roles are missing from the database.");
        }

        await client.query("COMMIT");

        return res.json({
          message: "User updated successfully.",
        });
      } catch (error) {
        if (client) {
          await client.query("ROLLBACK").catch(() => {});
        }

        console.error("Update user failed:", error.message);
        return res.status(500).json({
          message: "Could not update user.",
        });
      } finally {
        if (client) client.release();
      }
    }
  );
};