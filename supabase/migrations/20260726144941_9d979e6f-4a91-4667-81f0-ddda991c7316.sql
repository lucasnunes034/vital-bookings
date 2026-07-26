-- Enable btree_gist to combine equality (professional_id) with range overlap in an exclusion constraint
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Add a generated tstzrange column representing the booking's time window
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS time_range tstzrange
    GENERATED ALWAYS AS (tstzrange(start_at, end_at, '[)')) STORED;

-- Prevent overlapping active bookings for the same professional.
-- Only 'pending' and 'confirmed' bookings block the slot;
-- 'cancelled' and 'completed' bookings do not.
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_no_overlap;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (
    professional_id WITH =,
    time_range WITH &&
  ) WHERE (status IN ('pending', 'confirmed'));
