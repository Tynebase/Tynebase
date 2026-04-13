-- Migration: Create Audit Schedules and Notification Rules
-- Purpose: Support automated audit scheduling and notification preferences

-- ============================================================================
-- 1. Create audit_schedules table for automated audit runs
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.audit_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g., 'Weekly Audit', 'Monthly Health Check'
    frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
    interval_value INTEGER NOT NULL DEFAULT 1, -- e.g., run every 2 weeks, every 3 months
    day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Sunday, 6 = Saturday (for weekly)
    day_of_month INTEGER CHECK (day_of_month BETWEEN 1 AND 31), -- for monthly
    hour_of_day INTEGER NOT NULL DEFAULT 9 CHECK (hour_of_day BETWEEN 0 AND 23),
    minute_of_hour INTEGER NOT NULL DEFAULT 0 CHECK (minute_of_hour BETWEEN 0 AND 59),
    timezone TEXT NOT NULL DEFAULT 'UTC',
    is_active BOOLEAN NOT NULL DEFAULT true,
    auto_create_reviews BOOLEAN NOT NULL DEFAULT true,
    stale_threshold_days INTEGER NOT NULL DEFAULT 90,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for audit_schedules
CREATE INDEX idx_audit_schedules_tenant_id ON public.audit_schedules(tenant_id);
CREATE INDEX idx_audit_schedules_is_active ON public.audit_schedules(is_active) WHERE is_active = true;
CREATE INDEX idx_audit_schedules_next_run_at ON public.audit_schedules(next_run_at) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.audit_schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for audit_schedules
CREATE POLICY audit_schedules_select_policy ON public.audit_schedules
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.users WHERE id = auth.uid()
        )
    );

CREATE POLICY audit_schedules_insert_policy ON public.audit_schedules
    FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.users WHERE id = auth.uid()
        )
    );

CREATE POLICY audit_schedules_update_policy ON public.audit_schedules
    FOR UPDATE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.users WHERE id = auth.uid()
        )
    );

CREATE POLICY audit_schedules_delete_policy ON public.audit_schedules
    FOR DELETE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.users WHERE id = auth.uid()
        )
    );

-- Service role bypass for audit_schedules
CREATE POLICY audit_schedules_service_role ON public.audit_schedules
    FOR ALL
    USING (auth.role() = 'service_role');

-- Updated_at trigger for audit_schedules
CREATE TRIGGER update_audit_schedules_updated_at
    BEFORE UPDATE ON public.audit_schedules
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 2. Create notification_rules table for audit notification preferences
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.notification_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g., 'High Priority Reviews', 'Stale Content Alerts'
    rule_type TEXT NOT NULL CHECK (rule_type IN ('review_due', 'review_overdue', 'stale_content', 'audit_complete', 'health_threshold')),
    priority_filter TEXT CHECK (priority_filter IN ('low', 'medium', 'high', 'all')),
    days_before_due INTEGER CHECK (days_before_due BETWEEN 0 AND 30), -- for review_due
    stale_threshold_days INTEGER CHECK (stale_threshold_days BETWEEN 30 AND 365), -- for stale_content
    health_threshold_percentage INTEGER CHECK (health_threshold_percentage BETWEEN 0 AND 100), -- for health_threshold
    notify_via_email BOOLEAN NOT NULL DEFAULT true,
    notify_via_in_app BOOLEAN NOT NULL DEFAULT true,
    notify_users TEXT[] DEFAULT '{}', -- Array of user IDs to notify, empty = all tenant members
    notify_roles TEXT[] DEFAULT '{}', -- Array of role names to notify, empty = all roles
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for notification_rules
CREATE INDEX idx_notification_rules_tenant_id ON public.notification_rules(tenant_id);
CREATE INDEX idx_notification_rules_is_active ON public.notification_rules(is_active) WHERE is_active = true;
CREATE INDEX idx_notification_rules_rule_type ON public.notification_rules(rule_type);

-- Enable RLS
ALTER TABLE public.notification_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notification_rules
CREATE POLICY notification_rules_select_policy ON public.notification_rules
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.users WHERE id = auth.uid()
        )
    );

CREATE POLICY notification_rules_insert_policy ON public.notification_rules
    FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.users WHERE id = auth.uid()
        )
    );

CREATE POLICY notification_rules_update_policy ON public.notification_rules
    FOR UPDATE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.users WHERE id = auth.uid()
        )
    );

CREATE POLICY notification_rules_delete_policy ON public.notification_rules
    FOR DELETE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.users WHERE id = auth.uid()
        )
    );

-- Service role bypass for notification_rules
CREATE POLICY notification_rules_service_role ON public.notification_rules
    FOR ALL
    USING (auth.role() = 'service_role');

-- Updated_at trigger for notification_rules
CREATE TRIGGER update_notification_rules_updated_at
    BEFORE UPDATE ON public.notification_rules
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 3. Create function to calculate next run time for audit schedules
-- ============================================================================
CREATE OR REPLACE FUNCTION public.calculate_next_run_at(
    schedule_id UUID
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    sched RECORD;
    next_run TIMESTAMPTZ;
    current_time TIMESTAMPTZ := NOW() AT TIME ZONE 'UTC';
BEGIN
    SELECT * INTO sched FROM public.audit_schedules WHERE id = schedule_id;
    
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    
    -- Start from current time or last_run_at
    IF sched.last_run_at IS NOT NULL THEN
        next_run := sched.last_run_at AT TIME ZONE sched.timezone AT TIME ZONE 'UTC';
    ELSE
        next_run := current_time;
    END IF;
    
    -- Calculate next run based on frequency
    CASE sched.frequency
        WHEN 'daily' THEN
            next_run := next_run + (sched.interval_value || ' days')::INTERVAL;
        WHEN 'weekly' THEN
            IF sched.day_of_week IS NOT NULL THEN
                -- Calculate next occurrence of specified day
                LOOP
                    next_run := next_run + (sched.interval_value || ' days')::INTERVAL;
                    EXIT WHEN EXTRACT(DOW FROM next_run AT TIME ZONE sched.timezone) = sched.day_of_week;
                END LOOP;
            ELSE
                next_run := next_run + (sched.interval_value || ' weeks')::INTERVAL;
            END IF;
        WHEN 'monthly' THEN
            IF sched.day_of_month IS NOT NULL THEN
                LOOP
                    next_run := next_run + (sched.interval_value || ' months')::INTERVAL;
                    -- Adjust to the specified day of month
                    next_run := date_trunc('month', next_run) + ((sched.day_of_month - 1) || ' days')::INTERVAL;
                    -- Ensure we don't go back in time
                    EXIT WHEN next_run > current_time;
                END LOOP;
            ELSE
                next_run := next_run + (sched.interval_value || ' months')::INTERVAL;
            END IF;
    END CASE;
    
    -- Set the specific time of day
    next_run := date_trunc('day', next_run) + 
                (sched.hour_of_day || ' hours')::INTERVAL + 
                (sched.minute_of_hour || ' minutes')::INTERVAL;
    
    -- Convert back to UTC
    next_run := next_run AT TIME ZONE sched.timezone AT TIME ZONE 'UTC';
    
    RETURN next_run;
END;
$$;

-- ============================================================================
-- 4. Create function to update next_run_at when schedule is created/updated
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_schedule_next_run()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.is_active = true AND (OLD.is_active IS DISTINCT FROM NEW.is_active OR OLD.frequency IS DISTINCT FROM NEW.frequency OR OLD.interval_value IS DISTINCT FROM NEW.interval_value OR OLD.day_of_week IS DISTINCT FROM NEW.day_of_week OR OLD.day_of_month IS DISTINCT FROM NEW.day_of_month OR OLD.hour_of_day IS DISTINCT FROM NEW.hour_of_day OR OLD.minute_of_hour IS DISTINCT FROM NEW.minute_of_hour OR OLD.timezone IS DISTINCT FROM NEW.timezone) THEN
        NEW.next_run_at := public.calculate_next_run_at(NEW.id);
    ELSIF NEW.is_active = false THEN
        NEW.next_run_at := NULL;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER audit_schedule_update_next_run
    BEFORE INSERT OR UPDATE ON public.audit_schedules
    FOR EACH ROW
    EXECUTE FUNCTION public.update_schedule_next_run();

-- Comments for documentation
COMMENT ON TABLE public.audit_schedules IS 'Automated schedules for running content audits';
COMMENT ON TABLE public.notification_rules IS 'Rules for sending notifications about audit events';
COMMENT ON FUNCTION public.calculate_next_run_at IS 'Calculates the next run time for an audit schedule based on its frequency configuration';
