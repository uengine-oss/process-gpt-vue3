

create or replace function public.normalize_cron_expr_for_pg_cron(
  p_cron_expr text
)
returns table(normalized_expr text, target_year int)
language plpgsql
as $$
declare
  v_tokens text[];
  v_count int;
  v_dom text;
  v_dow text;
begin
  v_tokens := regexp_split_to_array(
    trim(regexp_replace(coalesce(p_cron_expr, ''), '\s+', ' ', 'g')),
    ' '
  );
  v_count := coalesce(array_length(v_tokens, 1), 0);

  if v_count = 5 then
    v_dom := replace(v_tokens[3], '?', '*');
    v_dow := replace(v_tokens[5], '?', '*');
    normalized_expr := format('%s %s %s %s %s', v_tokens[1], v_tokens[2], v_dom, v_tokens[4], v_dow);
    target_year := null;
    return next;
    return;
  end if;

  if v_count = 6 then
    v_dom := replace(v_tokens[4], '?', '*');
    v_dow := replace(v_tokens[6], '?', '*');
    normalized_expr := format('%s %s %s %s %s', v_tokens[2], v_tokens[3], v_dom, v_tokens[5], v_dow);
    target_year := null;
    return next;
    return;
  end if;

  if v_count = 7 then
    v_dom := replace(v_tokens[4], '?', '*');
    v_dow := replace(v_tokens[6], '?', '*');
    normalized_expr := format('%s %s %s %s %s', v_tokens[2], v_tokens[3], v_dom, v_tokens[5], v_dow);

    if v_tokens[7] ~ '^\d{4}$' then
      target_year := v_tokens[7]::int;
    elsif v_tokens[7] in ('*', '?') then
      target_year := null;
    else
      raise exception 'Unsupported 7th cron token(year): %', v_tokens[7];
    end if;

    return next;
    return;
  end if;

  raise exception 'Unsupported cron field count: %, expr=%', v_count, p_cron_expr;
end;
$$;


create or replace function public.update_todolist_status_with_year(
  p_proc_inst_id text,
  p_activity_id text,
  p_target_year int default null
)
returns void
language plpgsql
security definer
as $$
declare
  v_current_year int := extract(year from now())::int;
  v_job_name text := p_proc_inst_id || '_' || p_activity_id;
begin
  if p_target_year is not null then
    if v_current_year > p_target_year then
      -- 이미 지나간 연도인 경우 불필요 반복 실행 방지를 위해 잡 정리
      perform cron.unschedule(v_job_name);
      return;
    end if;

    if v_current_year < p_target_year then
      -- 대상 연도가 아니면 대기
      return;
    end if;
  end if;

  perform public.update_todolist_status(p_proc_inst_id, p_activity_id);
end;
$$;


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
  v_normalized_cron_expr text;
  v_target_year int;
begin
  select normalized_expr, target_year
    into v_normalized_cron_expr, v_target_year
  from public.normalize_cron_expr_for_pg_cron(p_cron_expr);

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
    v_normalized_cron_expr,
    format(
      E'select public.update_todolist_status_with_year(''%s'', ''%s'', %s);',
      p_input->>'proc_inst_id',
      p_input->>'activity_id',
      coalesce(v_target_year::text, 'null')
    )
  );
end;
$$;

create or replace function update_todolist_status(
  p_proc_inst_id text,
  p_activity_id text
)
returns void
language plpgsql
security definer
as $$
declare
  v_job_name text := p_proc_inst_id || '_' || p_activity_id;
begin
  -- 상태를 SUBMITTED로 업데이트
  update todolist
  set status = 'SUBMITTED',
      updated_at = now()
  where proc_inst_id = p_proc_inst_id
    and activity_id = p_activity_id;

  -- 스케줄에서 job 제거
  perform cron.unschedule(v_job_name);
end;
$$;


create or replace function exec_sql(query text)
returns json
language plpgsql
as $$
declare
  result json;
begin
  execute query into result;
  return result;
end;
$$;


grant usage on schema cron to service_role;
grant execute on all functions in schema cron to service_role;

