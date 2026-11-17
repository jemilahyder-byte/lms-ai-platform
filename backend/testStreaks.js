const fs = require("node:fs");
const register = require("./src/learningRewards");

let handler;
let streakSql;

const app = {
  get(...args) {
    handler = args.at(-1);
  },
};

const client = {
  async query(sql) {
    if (sql.includes("WITH today AS")) {
      streakSql = sql;
      throw new Error("Query captured");
    }
    return { rows: [] };
  },
  release() {},
};

async function main() {
  register(app, { connect: async () => client }, () => {}, () => {});

  const originalError = console.error;
  console.error = () => {};
  try {
    await handler(
      { user: { id: "00000000-0000-0000-0000-000000000001" } },
      { status() { return this; }, json() {} }
    );
  } finally {
    console.error = originalError;
  }

  if (!streakSql) throw new Error("Streak query not found");

  const query = streakSql.replaceAll(
    "$1", "'00000000-0000-0000-0000-000000000001'"
  );

  const cases = [
    ["No activity", [], 0, 0],
    ["Three days", [0, 1, 2], 3, 3],
    ["Seven days", [0, 1, 2, 3, 4, 5, 6], 7, 7],
    ["Yesterday streak", [1, 2, 3], 3, 3],
    ["Expired streak", [2, 3, 4], 0, 3],
    ["Gap resets streak", [0, 2, 3, 4], 1, 3],
  ];

  let sql = `BEGIN;
CREATE TEMP TABLE learning_activity_days (
  user_id uuid, activity_date date
);
`;

  for (const [name, offsets, current, longest] of cases) {
    sql += "TRUNCATE learning_activity_days;\n";
    for (const offset of offsets) {
      sql += `INSERT INTO learning_activity_days VALUES (
        '00000000-0000-0000-0000-000000000001',
        (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
        - ${offset});\n`;
    }

    sql += `CREATE TEMP TABLE actual AS ${query};
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM actual
    WHERE current_streak = ${current}
      AND longest_streak = ${longest}
      AND total_days = ${offsets.length}
  ) THEN
    RAISE EXCEPTION '${name}: FAILED';
  END IF;
  RAISE NOTICE '${name}: PASS';
END $$;
DROP TABLE actual;
`;
  }

  sql += "ROLLBACK;\n";
  fs.writeFileSync("/tmp/lms-streak-test.sql", sql);
  console.log("Test SQL ready.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});