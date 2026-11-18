BEGIN;

CREATE OR REPLACE FUNCTION sync_tutor_chunks()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM lecture_chunks
  WHERE lecture_id = NEW.id;

  INSERT INTO lecture_chunks (
    lecture_id,
    chunk_index,
    content
  )
  SELECT
    NEW.id,
    (row_number() OVER (
      ORDER BY paragraph.position, piece.start_at
    ) - 1)::integer,
    trim(substring(
      paragraph.content FROM piece.start_at FOR 1200
    ))
  FROM regexp_split_to_table(
    coalesce(NEW.transcript, ''),
    E'\\n\\s*\\n'
  ) WITH ORDINALITY AS paragraph(content, position)
  CROSS JOIN LATERAL generate_series(
    1,
    length(paragraph.content),
    1200
  ) AS piece(start_at)
  WHERE length(trim(substring(
    paragraph.content FROM piece.start_at FOR 1200
  ))) > 0;

  RETURN NEW;
END;
$$;

CREATE TRIGGER lectures_sync_tutor_chunks
AFTER INSERT OR UPDATE OF transcript
ON lectures
FOR EACH ROW
EXECUTE FUNCTION sync_tutor_chunks();

UPDATE lectures
SET transcript = transcript;

COMMIT;