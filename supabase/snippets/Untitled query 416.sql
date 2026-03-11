create or replace function register_cron_intermidiated(
  p_job_name text,
  p_cron_expr text,
  p_input jsonb
)
returns void
language plpgsql
security definer
as $$
declare
  v_job_name text;
begin
  -- 기존 job이 있으면 unschedule
  select jobname into v_job_name
  from cron.job
  where jobname = p_job_name;

  if v_job_name is not null then
    perform cron.unschedule(v_job_name);
  end if;

  -- 새로 schedule
  perform cron.schedule(
    p_job_name,
    p_cron_expr,
    format(
      E'select public.update_todolist_status(''%s'', ''%s'');',
      p_input->>'proc_inst_id',
      p_input->>'activity_id'
    )
  );
end;
$$;