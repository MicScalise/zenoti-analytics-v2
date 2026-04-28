-- =============================================================================
-- seed_dim_dates.sql — Generate dim_dates rows for 2000-01-01 through 2099-12-31
-- Implements: TASK-013
-- Source: DD-31 §5.7 (dim_dates), §12 (migration notes)
-- =============================================================================

-- Generate 100 years of date dimension rows
-- Uses populate_dim_dates stored procedure from 007_stored_procedures.sql
-- Falls back to direct INSERT if the procedure is not yet available

-- Direct INSERT approach (no dependency on stored procedure)
INSERT INTO dim_dates (
  date, day_of_week, day_name, month, month_name, quarter, year,
  year_month, year_quarter, is_weekend, is_holiday
)
SELECT
  d::DATE,
  -- day_of_week: 0=Sunday, 1=Monday, ..., 6=Saturday
  -- EXTRACT(ISODOW) returns 1=Monday..7=Sunday, so adjust: (ISODOW % 7) gives 0=Sunday..6=Saturday
  (EXTRACT(ISODOW FROM d)::INTEGER) % 7,
  TRIM(TO_CHAR(d, 'Day')),
  EXTRACT(MONTH FROM d)::INTEGER,
  TRIM(TO_CHAR(d, 'Month')),
  EXTRACT(QUARTER FROM d)::INTEGER,
  EXTRACT(YEAR FROM d)::INTEGER,
  TO_CHAR(d, 'YYYY-MM'),
  TO_CHAR(d, 'YYYY') || '-Q' || EXTRACT(QUARTER FROM d)::TEXT,
  -- is_weekend: Saturday (ISODOW=6) or Sunday (ISODOW=7)
  EXTRACT(ISODOW FROM d) IN (6, 7),
  -- is_holiday: default false (populate from holiday calendar separately)
  false
FROM generate_series(
  '2000-01-01'::DATE,
  '2099-12-31'::DATE,
  INTERVAL '1 day'
) AS d
ON CONFLICT (date) DO NOTHING;
