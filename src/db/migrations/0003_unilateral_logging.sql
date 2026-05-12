ALTER TABLE exercises ADD COLUMN default_side_mode TEXT NOT NULL DEFAULT 'none'
  CHECK(default_side_mode IN ('none', 'each_side'));

ALTER TABLE exercises ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'
  CHECK(source IN ('seed', 'external', 'auto_created', 'manual'));

ALTER TABLE exercises ADD COLUMN needs_review INTEGER NOT NULL DEFAULT 0;

ALTER TABLE workout_sets ADD COLUMN side_mode TEXT NOT NULL DEFAULT 'none'
  CHECK(side_mode IN ('none', 'each_side', 'single_side'));

ALTER TABLE workout_sets ADD COLUMN side TEXT
  CHECK(side IS NULL OR side IN ('left', 'right'));
