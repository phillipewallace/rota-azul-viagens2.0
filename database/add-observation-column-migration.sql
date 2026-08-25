-- Migration: Add observation column to route_points table
-- Description: Adds a text field for observations/notes per route point

-- Add observation column to route_points table
ALTER TABLE route_points 
ADD COLUMN IF NOT EXISTS observation TEXT;

-- Add comment
COMMENT ON COLUMN route_points.observation IS 'Optional observations or notes for this route point';

-- Log migration
DO $$
BEGIN
  RAISE NOTICE 'Migration completed: observation column added to route_points table';
END $$;
