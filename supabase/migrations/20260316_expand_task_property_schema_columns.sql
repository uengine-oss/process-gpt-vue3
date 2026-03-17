-- =============================================================================
-- Expand task_property_schema to match PropertySchemaStudio payload
-- =============================================================================

ALTER TABLE IF EXISTS public.task_property_schema
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS applies_to VARCHAR(50) DEFAULT 'both',
    ADD COLUMN IF NOT EXISTS placeholder TEXT,
    ADD COLUMN IF NOT EXISTS visible_by_default BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS is_readonly BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_mandatory BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS options JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS deprecated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN public.task_property_schema.description IS
'Schema field description/help text.';

COMMENT ON COLUMN public.task_property_schema.applies_to IS
'both | process | task | specific task type';

COMMENT ON COLUMN public.task_property_schema.placeholder IS
'Placeholder text shown in the input UI.';

COMMENT ON COLUMN public.task_property_schema.visible_by_default IS
'Whether the property is visible by default in the editor.';

COMMENT ON COLUMN public.task_property_schema.is_readonly IS
'Whether the property is read-only.';

COMMENT ON COLUMN public.task_property_schema.is_mandatory IS
'Whether the property is required.';

COMMENT ON COLUMN public.task_property_schema.options IS
'Select/multiselect options as JSON array.';

COMMENT ON COLUMN public.task_property_schema.config IS
'Additional property configuration such as db-select/formula settings.';

COMMENT ON COLUMN public.task_property_schema.display_order IS
'Sort order in UI.';

COMMENT ON COLUMN public.task_property_schema.deprecated_at IS
'Soft delete timestamp. NULL means active.';
