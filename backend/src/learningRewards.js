module.exports = function registerLearningRewards(
  app,
  pool,
  requireAuth,
  requireRole
) {
  app.get(
    "/api/student/rewards",
    requireAuth,
    requireRole("student"),
    async (req, res) => {
      let client;

      try {
        client = await pool.connect();
        await client.query("BEGIN");

        const result = await client.query(
          `
          WITH today AS (
            SELECT
              (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date AS day
          ),
          days AS (
            SELECT activity_date
            FROM learning_activity_days, today
            WHERE user_id = $1 AND activity_date <= today.day
          ),
          numbered AS (
            SELECT
              activity_date,
              activity_date -
                (ROW_NUMBER() OVER (
                  ORDER BY activity_date
                ))::integer AS group_day
            FROM days
          ),
          streaks AS (
            SELECT
              COUNT(*)::integer AS length,
              MAX(activity_date) AS last_day
            FROM numbered
            GROUP BY group_day
          )
          SELECT
            COALESCE(
              MAX(length) FILTER (
                WHERE last_day >= (SELECT day - 1 FROM today)
              ), 0
            )::integer AS current_streak,
            COALESCE(MAX(length), 0)::integer AS longest_streak,
            (SELECT COUNT(*)::integer FROM days) AS total_days,
            EXISTS (
              SELECT 1 FROM days, today
              WHERE activity_date = today.day
            ) AS active_today
          FROM streaks
          `,
          [req.user.id]
        );

        const stats = result.rows[0];

        for (const threshold of [3, 7]) {
          if (stats.longest_streak >= threshold) {
            await client.query(
              `INSERT INTO user_badges (user_id, badge_code)
               VALUES ($1, $2)
               ON CONFLICT DO NOTHING`,
              [req.user.id, "streak_" + threshold]
            );
          }
        }

        const badges = await client.query(
          `SELECT b.code, b.title, b.description, ub.earned_at
           FROM badges b
           LEFT JOIN user_badges ub
             ON ub.badge_code = b.code AND ub.user_id = $1
           ORDER BY b.code`,
          [req.user.id]
        );

        await client.query("COMMIT");

        return res.json({
          ...stats,
          timezone: "Asia/Kolkata",
          badges: badges.rows,
        });
      } catch (error) {
        if (client) {
          await client.query("ROLLBACK").catch(() => {});
        }

        console.error("Learning rewards failed:", error);

        return res.status(500).json({
          message: "Could not load learning rewards.",
        });
        } finally {
        if (client) client.release();
      }
    }
  );
};