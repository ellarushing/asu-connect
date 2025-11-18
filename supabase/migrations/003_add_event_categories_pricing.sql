-- Add category, is_free, and price columns to events table
ALTER TABLE public.events
  ADD COLUMN category TEXT CHECK (category IN ('Academic', 'Social', 'Sports', 'Arts', 'Career', 'Community Service', 'Other')),
  ADD COLUMN is_free BOOLEAN DEFAULT true,
  ADD COLUMN price DECIMAL(10, 2) CHECK (price >= 0);

-- Create index for category filtering
CREATE INDEX idx_events_category ON public.events(category);

-- Create index for pricing filtering
CREATE INDEX idx_events_is_free ON public.events(is_free);

-- Add constraint to ensure price is provided when event is not free
ALTER TABLE public.events
  ADD CONSTRAINT check_price_when_not_free
  CHECK (is_free = true OR (is_free = false AND price IS NOT NULL AND price > 0));
