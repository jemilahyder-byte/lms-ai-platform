BEGIN;

INSERT INTO lecture_chunks (
  lecture_id,
  chunk_index,
  content
)
SELECT
  l.id,
  (part.position - 1)::integer,
  trim(part.content)
FROM lectures l
CROSS JOIN LATERAL
  string_to_table(
    l.transcript,
    chr(10) || chr(10)
  ) WITH ORDINALITY AS part(content, position)
WHERE l.id = '77dc7f4f-bb22-4ee5-8002-ae782af8a8b3'
  AND length(trim(part.content)) > 0
ON CONFLICT (lecture_id, chunk_index)
DO UPDATE SET content = EXCLUDED.content;

COMMIT;