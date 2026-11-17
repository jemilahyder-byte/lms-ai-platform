BEGIN;

CREATE OR REPLACE FUNCTION record_quiz_activity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.submitted_at IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.submitted_at IS NOT NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO learning_activity_days (user_id, activity_date)
  VALUES (
    NEW.user_id,
    (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
  )
  ON CONFLICT DO NOTHING;

  IF NEW.max_score > 0 AND EXISTS (
    SELECT 1
    FROM quizzes q
    WHERE q.id = NEW.quiz_id
      AND NEW.score::numeric * 100
          >= q.passing_percentage::numeric * NEW.max_score
  ) THEN
    INSERT INTO user_badges (user_id, badge_code)
    VALUES (NEW.user_id, 'first_quiz_pass')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER quiz_activity_record
AFTER INSERT OR UPDATE ON quiz_attempts
FOR EACH ROW
EXECUTE FUNCTION record_quiz_activity();

COMMIT;