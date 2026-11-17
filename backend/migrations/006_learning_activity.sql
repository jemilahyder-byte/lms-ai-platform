BEGIN;

CREATE OR REPLACE FUNCTION record_lesson_activity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.last_position_seconds = OLD.last_position_seconds
       AND NEW.is_completed = OLD.is_completed THEN
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.last_position_seconds > 0 OR NEW.is_completed THEN
    INSERT INTO learning_activity_days (user_id, activity_date)
    VALUES (
      NEW.user_id,
      (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
    )
    ON CONFLICT DO NOTHING;
  END IF;

  IF NEW.is_completed THEN
    INSERT INTO user_badges (user_id, badge_code)
    VALUES (NEW.user_id, 'first_lesson')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER lesson_activity_record
AFTER INSERT OR UPDATE ON lecture_progress
FOR EACH ROW
EXECUTE FUNCTION record_lesson_activity();

COMMIT;