-- Non-destructive phase-1 schema for production domain migration.
-- Run against Supabase Postgres.

create extension if not exists pgcrypto;

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  name text not null,
  model text,
  code text not null,
  opening_balance numeric default 0,
  image_url text,
  storage_path text,
  image_created_at timestamptz,
  chinese_unit_cost numeric,
  inner_box_cost numeric,
  outer_carton_cost numeric,
  units_per_carton numeric,
  selling_price numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists production_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  name text not null,
  code text,
  daily_working_hours numeric default 0,
  max_workers integer default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists line_statuses (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  line_id text not null,
  current_product_id text not null,
  target_today_qty numeric default 0,
  updated_at timestamptz not null default now()
);

create table if not exists line_product_configs (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  product_id text not null,
  line_id text not null,
  standard_assembly_time numeric default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists production_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  product_id text not null,
  line_id text not null,
  planned_quantity numeric default 0,
  produced_quantity numeric default 0,
  start_date text not null,
  planned_start_date text,
  planned_end_date text,
  estimated_duration_days numeric default 0,
  avg_daily_target numeric default 0,
  priority text,
  estimated_cost numeric default 0,
  actual_cost numeric default 0,
  status text not null default 'planned',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists work_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  work_order_number text not null,
  plan_id text,
  product_id text not null,
  line_id text not null,
  supervisor_id text not null,
  quantity numeric default 0,
  produced_quantity numeric default 0,
  max_workers integer default 0,
  target_date text,
  estimated_cost numeric default 0,
  actual_cost numeric default 0,
  status text not null default 'pending',
  notes text,
  break_start_time text,
  break_end_time text,
  workday_end_time text,
  scan_pause_windows jsonb,
  actual_workers_count numeric,
  actual_produced_from_scans numeric,
  actual_work_hours numeric,
  scan_summary jsonb,
  scan_session_closed_at timestamptz,
  quality_status text,
  quality_summary jsonb,
  quality_report_code text,
  quality_approved_by text,
  quality_approved_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists production_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  report_code text,
  employee_id text not null,
  product_id text not null,
  line_id text not null,
  date text not null,
  quantity_produced numeric default 0,
  quantity_waste numeric default 0,
  workers_count numeric default 0,
  work_hours numeric default 0,
  supervisor_hourly_rate_applied numeric,
  supervisor_indirect_cost numeric,
  notes text,
  work_order_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists line_worker_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  line_id text not null,
  employee_id text not null,
  employee_code text,
  employee_name text,
  date text not null,
  assigned_at timestamptz,
  assigned_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists product_materials (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  product_id text not null,
  material_name text not null,
  quantity_used numeric default 0,
  unit_cost numeric default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists scan_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  work_order_id text not null,
  line_id text not null,
  product_id text not null,
  serial_barcode text not null,
  employee_id text,
  action text not null,
  timestamp timestamptz not null default now(),
  scan_date text not null,
  session_id text not null,
  cycle_seconds numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_products_tenant on products (tenant_id);
create index if not exists idx_lines_tenant on production_lines (tenant_id);
create index if not exists idx_reports_tenant_date on production_reports (tenant_id, date);
create index if not exists idx_work_orders_tenant_status on work_orders (tenant_id, status);
create index if not exists idx_scan_events_tenant_wo on scan_events (tenant_id, work_order_id);
