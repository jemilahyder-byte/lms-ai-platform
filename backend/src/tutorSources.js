async function findTutorSources(pool, userId, courseId, question) {
  const result = await pool.query(
    `
    WITH search AS (
      SELECT to_tsquery(
        'english',
        replace(
          plainto_tsquery('english', $3)::text,
          ' & ',
          ' | '
        )
      ) AS query
    )
    SELECT
      ch.id AS chunk_id,
      l.id AS lecture_id,
      l.title AS lecture_title,
      m.title AS module_title,
      ch.chunk_index,
      ch.content
    FROM lecture_chunks ch
    JOIN lectures l ON l.id = ch.lecture_id
    JOIN modules m ON m.id = l.module_id
    JOIN courses c ON c.id = m.course_id
    JOIN enrollments e ON e.course_id = c.id
    CROSS JOIN search
    WHERE c.id = $2
      AND c.status = 'approved'
      AND e.user_id = $1
      AND to_tsvector('english', ch.content) @@ search.query
    ORDER BY
      ts_rank_cd(
        to_tsvector('english', ch.content),
        search.query
      ) DESC,
      l.id,
      ch.chunk_index
    LIMIT 4
    `,
    [userId, courseId, question]
  );

  return result.rows;
}

module.exports = { findTutorSources };