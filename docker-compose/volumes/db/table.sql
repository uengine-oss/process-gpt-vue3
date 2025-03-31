create table if not exists public.tenants (
    id text not null,
    owner uuid null default auth.uid (),
    constraint tenants_pkey primary key (id)
) tablespace pg_default;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenants' AND column_name='id') THEN
        ALTER TABLE public.tenants ADD COLUMN id text not null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenants' AND column_name='owner') THEN
        ALTER TABLE public.tenants ADD COLUMN owner uuid null default auth.uid();
    END IF;
END;
$$;

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenants_insert_policy
    ON tenants
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY tenants_select_policy
    ON tenants
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY tenants_update_policy
    ON tenants
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = owner);

CREATE POLICY tenants_delete_policy
    ON tenants
    FOR DELETE
    TO authenticated
    USING (auth.uid() = owner);



SET request.jwt.claims = '{"app_metadata": {"tenant_id": "your_tenant_id"}}';
create or replace function auth.tenant_id()
returns text
language sql stable
as $$
    select 
        nullif(
            ((current_setting('request.jwt.claims')::jsonb ->>  'app_metadata')::jsonb ->> 'tenant_id'),
            ''
        )::text
$$;



create table if not exists public.users (
    id uuid not null,
    username text null,
    profile text null default '/src/assets/images/profile/defaultUser.png'::text,
    email text null,
    is_admin boolean not null default false,
    role text null,
    current_tenant text null,
    tenants text[] null,
    constraint users_pkey primary key (id)
) tablespace pg_default;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='tenants') THEN
        ALTER TABLE public.users ADD COLUMN tenants text[] null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='id') THEN
        ALTER TABLE public.users ADD COLUMN id uuid not null primary key;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='username') THEN
        ALTER TABLE public.users ADD COLUMN username text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='profile') THEN
        ALTER TABLE public.users ADD COLUMN profile text null default '/src/assets/images/profile/defaultUser.png'::text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='email') THEN
        ALTER TABLE public.users ADD COLUMN email text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_admin') THEN
        ALTER TABLE public.users ADD COLUMN is_admin boolean not null default false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='role') THEN
        ALTER TABLE public.users ADD COLUMN role text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='current_tenant') THEN
        ALTER TABLE public.users ADD COLUMN current_tenant text null;
    END IF;
END;
$$;

create or replace function public.handle_new_user() 
returns trigger as $$
begin
    insert into public.users (id, email)
    values (new.id, new.email);
    return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();

create or replace function public.handle_delete_user() 
returns trigger as $$
begin
    delete from auth.users where id = old.id;
    return old;
end;
$$ language plpgsql security definer;

create or replace trigger on_public_user_deleted
    after delete on public.users
    for each row execute procedure public.handle_delete_user();

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_insert_policy
    ON users
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY users_select_policy
    ON users
    FOR SELECT
    TO public
    USING (
        (auth.tenant_id() = ANY(tenants)) 
        OR 
        (auth.uid() = id)
    );

CREATE POLICY users_update_policy
    ON users
    FOR UPDATE
    TO public
    USING (
        (auth.tenant_id() = current_tenant) 
        OR 
        (auth.uid() = id)
        OR 
        (EXISTS (SELECT 1 FROM users WHERE is_admin = true))
    );

CREATE POLICY users_delete_policy
    ON users
    FOR DELETE
    TO authenticated
    USING (auth.tenant_id() = current_tenant);



-- 테넌트가 삭제될 때 users 테이블을 업데이트하는 함수
CREATE OR REPLACE FUNCTION update_users_on_tenant_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- 삭제된 테넌트 ID를 tenants 배열에서 제거하고, current_tenant가 동일한 경우 null로 설정
    UPDATE public.users
    SET 
        tenants = array_remove(tenants, OLD.id),
        current_tenant = CASE WHEN current_tenant = OLD.id THEN NULL ELSE current_tenant END
    WHERE OLD.id = ANY(tenants) OR current_tenant = OLD.id;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 테넌트가 삭제된 후 함수를 호출하는 트리거
CREATE TRIGGER after_tenant_delete
AFTER DELETE ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION update_users_on_tenant_delete();




create table if not exists public.configuration (
    key text not null,
    value jsonb null,
    tenant_id text null default auth.tenant_id(),
    uuid uuid not null default gen_random_uuid (),
    constraint configuration_pkey primary key (uuid),
    constraint configuration_tenant_id_fkey foreign key (tenant_id) references tenants (id) on update cascade on delete cascade
) tablespace pg_default;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='configuration' AND column_name='key') THEN
        ALTER TABLE public.configuration ADD COLUMN key text not null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='configuration' AND column_name='value') THEN
        ALTER TABLE public.configuration ADD COLUMN value jsonb null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='configuration' AND column_name='uuid') THEN
        ALTER TABLE public.configuration ADD COLUMN uuid uuid not null default gen_random_uuid ();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='configuration' AND column_name='tenant_id') THEN
        ALTER TABLE public.configuration ADD COLUMN tenant_id text null default auth.tenant_id();
    END IF;
END;
$$;

ALTER TABLE configuration ENABLE ROW LEVEL SECURITY;

CREATE POLICY configuration_insert_policy
    ON configuration
    FOR INSERT
    TO authenticated
    WITH CHECK (tenant_id = auth.tenant_id());

CREATE POLICY configuration_select_policy
    ON configuration
    FOR SELECT
    TO authenticated
    USING (tenant_id = auth.tenant_id());

CREATE POLICY configuration_update_policy
    ON configuration
    FOR UPDATE
    TO authenticated
    USING (tenant_id = auth.tenant_id());

CREATE POLICY configuration_delete_policy
    ON configuration
    FOR DELETE
    TO authenticated
    USING ((tenant_id = auth.tenant_id()) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));



create table if not exists public.proc_map_history (
    value jsonb not null,
    created_at timestamp with time zone not null default now(),
    tenant_id text null default auth.tenant_id(),
    uuid uuid not null default gen_random_uuid (),
    constraint proc_map_history_pkey primary key (uuid),
    constraint proc_map_history_tenant_id_fkey foreign key (tenant_id) references tenants (id) on update cascade on delete cascade
) tablespace pg_default;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_map_history' AND column_name='value') THEN
        ALTER TABLE public.proc_map_history ADD COLUMN value jsonb not null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_map_history' AND column_name='created_at') THEN
        ALTER TABLE public.proc_map_history ADD COLUMN created_at timestamp with time zone not null default now();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_map_history' AND column_name='tenant_id') THEN
        ALTER TABLE public.proc_map_history ADD COLUMN tenant_id text null default auth.tenant_id();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_map_history' AND column_name='uuid') THEN
        ALTER TABLE public.proc_map_history ADD COLUMN uuid uuid not null default gen_random_uuid ();
    END IF;
END;
$$;

ALTER TABLE proc_map_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY proc_map_history_insert_policy
    ON proc_map_history
    FOR INSERT
    TO authenticated
    WITH CHECK (tenant_id = auth.tenant_id());

CREATE POLICY proc_map_history_select_policy
    ON proc_map_history
    FOR SELECT
    TO authenticated
    USING (tenant_id = auth.tenant_id());

CREATE POLICY proc_map_history_update_policy
    ON proc_map_history
    FOR UPDATE
    TO authenticated
    USING (tenant_id = auth.tenant_id());

CREATE POLICY proc_map_history_delete_policy
    ON proc_map_history
    FOR DELETE
    TO authenticated
    USING (tenant_id = auth.tenant_id());

create or replace function public.save_previous_proc_map()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.key = 'proc_map' THEN
        INSERT INTO public.proc_map_history(value, created_at)
        VALUES (OLD.value, now());
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

create or replace trigger trigger_save_previous_proc_map
BEFORE UPDATE ON configuration
FOR EACH ROW
WHEN (OLD.key = 'proc_map' AND NEW.value IS DISTINCT FROM OLD.value)
EXECUTE PROCEDURE public.save_previous_proc_map();



create table if not exists public.proc_def (
    id text not null,
    name text null,
    definition jsonb null,
    bpmn text null,
    uuid uuid not null default gen_random_uuid (),
    tenant_id text null default auth.tenant_id(),
    isDeleted boolean not null default false,
    constraint proc_def_pkey primary key (uuid),
    constraint proc_def_tenant_id_fkey foreign key (tenant_id) references tenants (id) on update cascade on delete cascade
) tablespace pg_default;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_def' AND column_name='id') THEN
        ALTER TABLE public.proc_def ADD COLUMN id text not null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_def' AND column_name='name') THEN
        ALTER TABLE public.proc_def ADD COLUMN name text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_def' AND column_name='definition') THEN
        ALTER TABLE public.proc_def ADD COLUMN definition jsonb null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_def' AND column_name='bpmn') THEN
        ALTER TABLE public.proc_def ADD COLUMN bpmn text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_def' AND column_name='uuid') THEN
        ALTER TABLE public.proc_def ADD COLUMN uuid uuid not null default gen_random_uuid ();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_def' AND column_name='tenant_id') THEN
        ALTER TABLE public.proc_def ADD COLUMN tenant_id text null default auth.tenant_id();
    END IF;
END;
$$;

INSERT INTO "public"."proc_def" ("id", "name", "definition", "bpmn", "tenant_id") 
VALUES (
    'leave_request_process', 
    '휴가 신청 프로세스', 
    '{"data": [{"name": "vacation_start_date", "type": "text", "description": "시작일"}, {"name": "vacation_end_date", "type": "text", "description": "복귀일"}, {"name": "approval_status", "type": "boolean", "description": "승인 여부"}, {"name": "vacation_reason", "type": "textarea", "description": "휴가 신청 사유"}, {"name": "rejection_reason_input", "type": "textarea", "description": "반려 사유 입력"}, {"name": "vacation_message", "type": "textarea", "description": "휴가 신청 결과 메세지"}], "roles": [{"name": "직원", "process": "leave_request_process", "resolutionRule": "현재 로그인한 사용자가 직원 역할인 경우"}, {"name": "팀장", "process": "leave_request_process", "resolutionRule": "현재 로그인한 사용자가 팀장의 역할인 경우"}, {"name": "인사팀", "process": "leave_request_process", "resolutionRule": "인사팀 담당자의 역할인 경우"}], "events": [{"id": "end_event", "name": "프로세스 종료", "role": "직원", "type": "endEvent", "process": "leave_request_process", "properties": "{}", "description": "start event"}, {"id": "start_event", "name": "휴가 신청 시작", "role": "직원", "type": "startEvent", "process": "leave_request_process", "properties": "{}", "description": "start event"}], "version": null, "gateways": [{"id": "approval_gateway", "name": "검토 결과", "role": "팀장", "type": "exclusiveGateway", "process": "leave_request_process", "condition": "", "properties": "{}", "description": "검토 결과 description"}], "sequences": [{"id": "SequenceFlow_start_event_submit_leave_request", "source": "start_event", "target": "submit_leave_request", "condition": "", "properties": "{}"}, {"id": "SequenceFlow_submit_leave_request_review_leave_request", "source": "submit_leave_request", "target": "review_leave_request", "condition": "", "properties": "{}"}, {"id": "SequenceFlow_review_leave_request_approval_gateway", "source": "review_leave_request", "target": "approval_gateway", "condition": "", "properties": "{}"}, {"id": "SequenceFlow_approval_gateway_approve_leave", "source": "approval_gateway", "target": "approve_leave", "condition": "", "properties": "{}"}, {"id": "SequenceFlow_approval_gateway_reject_leave", "source": "approval_gateway", "target": "reject_leave", "condition": "", "properties": "{}"}, {"id": "SequenceFlow_approve_leave_notify_hr", "source": "approve_leave", "target": "notify_hr", "condition": "", "properties": "{}"}, {"id": "SequenceFlow_notify_hr_end_event", "source": "notify_hr", "target": "end_event", "condition": "", "properties": "{}"}], "activities": [{"id": "submit_leave_request", "name": "휴가 신청", "role": "직원", "tool": "formHandler:leave_request_process_submit_leave_request_form", "type": "userTask", "process": "leave_request_process", "duration": 5, "inputData": [], "outputData": [], "properties": "{\"_type\":{\"org.uengine.kernel.FormActivity\":{\"role\":{\"name\":\"\"},\"variableForHtmlFormContext\":{\"name\":\"leave_request_process_submit_leave_request_form\"}}}"}, {"id": "review_leave_request", "name": "휴가 검토 및 승인", "role": "팀장", "tool": "formHandler:leave_request_process_review_leave_request_form", "type": "userTask", "process": "leave_request_process", "duration": 5, "inputData": [], "outputData": [], "properties": "{\"_type\":{\"org.uengine.kernel.FormActivity\":{\"role\":{\"name\":\"\"},\"variableForHtmlFormContext\":{\"name\":\"leave_request_process_review_leave_request_form\"}}}"}, {"id": "approve_leave", "name": "휴가 승인", "role": "팀장", "tool": "formHandler:leave_request_process_approve_leave_form", "type": "userTask", "process": "leave_request_process", "duration": 5, "inputData": [], "outputData": [], "properties": "{\"_type\":{\"org.uengine.kernel.FormActivity\":{\"role\":{\"name\":\"\"},\"variableForHtmlFormContext\":{\"name\":\"leave_request_process_approve_leave_form\"}}}"}, {"id": "reject_leave", "name": "휴가 반려", "role": "팀장", "tool": "formHandler:leave_request_process_reject_leave_form", "type": "userTask", "process": "leave_request_process", "duration": 5, "inputData": [], "outputData": [], "properties": "{\"_type\":{\"org.uengine.kernel.FormActivity\":{\"role\":{\"name\":\"\"},\"variableForHtmlFormContext\":{\"name\":\"leave_request_process_reject_leave_form\"}}}"}, {"id": "notify_hr", "name": "인사팀 통지", "role": "인사팀", "tool": "formHandler:leave_request_process_notify_hr_form", "type": "userTask", "process": "leave_request_process", "duration": 5, "inputData": [], "outputData": [], "properties": "{\"_type\":{\"org.uengine.kernel.FormActivity\":{\"role\":{\"name\":\"\"},\"variableForHtmlFormContext\":{\"name\":\"leave_request_process_notify_hr_form\"}}}"}], "description": "process.description", "participants": {"id": "Participant", "name": "Participant", "processRef": "leave_request_process", "bpmn:extensionElements": {"uengine:properties": {"uengine:json": "{}"}}}, "shortDescription": {"text": null}, "instanceNamePattern": null, "processDefinitionId": "leave_request_process", "processDefinitionName": "휴가 신청 프로세스"}'::jsonb,
    '<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:uengine="http://uengine" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" id="Definitions_leave_request_process" name="휴가 신청 프로세스" targetNamespace="http://bpmn.io/schema/bpmn" exporter="Custom BPMN Modeler" exporterVersion="1.0">
  <bpmn:collaboration id="Collaboration_1">
    <bpmn:participant id="Participant" name="Participant" processRef="leave_request_process">
      <bpmn:extensionElements>
        <uengine:properties>
          <uengine:json>{}</uengine:json>
        </uengine:properties>
      </bpmn:extensionElements>
    </bpmn:participant>
  </bpmn:collaboration>
  <bpmn:process id="leave_request_process" isExecutable="true">
    <bpmn:extensionElements>
      <uengine:properties>
        <uengine:json>{"definitionName":"휴가 신청 프로세스","version":null,"shortDescription":{"text":null}}</uengine:json>
        <uengine:variable name="휴가 신청 사유" type="Text">
          <uengine:json>{"defaultValue":""}</uengine:json>
        </uengine:variable>
        <uengine:variable name="휴가 시작일" type="Date">
          <uengine:json>{"defaultValue":""}</uengine:json>
        </uengine:variable>
        <uengine:variable name="복귀일" type="Date">
          <uengine:json>{"defaultValue":""}</uengine:json>
        </uengine:variable>
      </uengine:properties>
    </bpmn:extensionElements>
    <bpmn:laneSet id="LaneSet_1">
      <bpmn:lane id="Lane_0" name="직원">
        <bpmn:extensionElements>
          <uengine:properties>
            <uengine:json>{}</uengine:json>
          </uengine:properties>
        </bpmn:extensionElements>
        <bpmn:flowNodeRef>leave_application_submission</bpmn:flowNodeRef>
      </bpmn:lane>
      <bpmn:lane id="Lane_1" name="팀장">
        <bpmn:extensionElements>
          <uengine:properties>
            <uengine:json>{}</uengine:json>
          </uengine:properties>
        </bpmn:extensionElements>
        <bpmn:flowNodeRef>leave_review_approval</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>review_result_gateway</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>leave_approval</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>leave_rejected</bpmn:flowNodeRef>
      </bpmn:lane>
      <bpmn:lane id="Lane_2" name="인사팀">
        <bpmn:extensionElements>
          <uengine:properties>
            <uengine:json>{}</uengine:json>
          </uengine:properties>
        </bpmn:extensionElements>
        <bpmn:flowNodeRef>notify_hr</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>
    <bpmn:sequenceFlow id="SequenceFlow_start_event_leave_application_submission" name="" sourceRef="start_event" targetRef="leave_application_submission" />
    <bpmn:sequenceFlow id="SequenceFlow_leave_application_submission_leave_review_approval" name="" sourceRef="leave_application_submission" targetRef="leave_review_approval" />
    <bpmn:sequenceFlow id="SequenceFlow_leave_review_approval_review_result_gateway" name="" sourceRef="leave_review_approval" targetRef="review_result_gateway" />
    <bpmn:sequenceFlow id="SequenceFlow_review_result_gateway_leave_approval" name="승인됨" sourceRef="review_result_gateway" targetRef="leave_approval">
      <bpmn:extensionElements>
        <uengine:properties>
          <uengine:json>{}</uengine:json>
        </uengine:properties>
      </bpmn:extensionElements>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="SequenceFlow_review_result_gateway_leave_rejected" name="반려됨" sourceRef="review_result_gateway" targetRef="leave_rejected">
      <bpmn:extensionElements>
        <uengine:properties>
          <uengine:json>{}</uengine:json>
        </uengine:properties>
      </bpmn:extensionElements>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="SequenceFlow_leave_approval_notify_hr" name="" sourceRef="leave_approval" targetRef="notify_hr" />
    <bpmn:sequenceFlow id="SequenceFlow_notify_hr_end_event" name="" sourceRef="notify_hr" targetRef="end_event" />
    <bpmn:startEvent id="start_event" name="휴가 신청 시작">
      <bpmn:extensionElements>
        <uengine:properties>
          <uengine:json>{}</uengine:json>
        </uengine:properties>
      </bpmn:extensionElements>
    </bpmn:startEvent>
    <bpmn:userTask id="leave_application_submission" name="휴가 신청">
      <bpmn:extensionElements>
        <uengine:properties>
          <uengine:json>{"_type":"org.uengine.kernel.FormActivity","role":{"name":""},"variableForHtmlFormContext":{"name":"leave_request_process_leave_application_submission_form"}}</uengine:json>
        </uengine:properties>
      </bpmn:extensionElements>
      <bpmn:incoming>SequenceFlow_start_event_leave_application_submission</bpmn:incoming>
      <bpmn:outgoing>SequenceFlow_leave_application_submission_leave_review_approval</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:userTask id="leave_review_approval" name="휴가 검토 및 승인">
      <bpmn:extensionElements>
        <uengine:properties>
          <uengine:json>{"_type":"org.uengine.kernel.FormActivity","role":{"name":""},"variableForHtmlFormContext":{"name":"leave_request_process_leave_review_approval_form"}}</uengine:json>
        </uengine:properties>
      </bpmn:extensionElements>
      <bpmn:incoming>SequenceFlow_leave_application_submission_leave_review_approval</bpmn:incoming>
      <bpmn:outgoing>SequenceFlow_leave_review_approval_review_result_gateway</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:exclusiveGateway id="review_result_gateway" name="검토 결과">
      <bpmn:extensionElements>
        <uengine:properties>
          <uengine:json>{}</uengine:json>
        </uengine:properties>
      </bpmn:extensionElements>
      <bpmn:incoming>SequenceFlow_leave_review_approval_review_result_gateway</bpmn:incoming>
      <bpmn:outgoing>SequenceFlow_review_result_gateway_leave_rejected</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:userTask id="leave_approval" name="휴가 승인">
      <bpmn:extensionElements>
        <uengine:properties>
          <uengine:json>{}</uengine:json>
        </uengine:properties>
      </bpmn:extensionElements>
      <bpmn:incoming>SequenceFlow_review_result_gateway_leave_approval</bpmn:incoming>
      <bpmn:outgoing>SequenceFlow_leave_approval_notify_hr</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:userTask id="leave_rejected" name="휴가 반려">
      <bpmn:extensionElements>
        <uengine:properties>
          <uengine:json>{}</uengine:json>
        </uengine:properties>
      </bpmn:extensionElements>
      <bpmn:incoming>SequenceFlow_review_result_gateway_leave_rejected</bpmn:incoming>
    </bpmn:userTask>
    <bpmn:userTask id="notify_hr" name="인사팀 통지">
      <bpmn:extensionElements>
        <uengine:properties>
          <uengine:json>{}</uengine:json>
        </uengine:properties>
      </bpmn:extensionElements>
      <bpmn:incoming>SequenceFlow_leave_approval_notify_hr</bpmn:incoming>
      <bpmn:outgoing>SequenceFlow_notify_hr_end_event</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:endEvent id="end_event" name="휴가 신청 종료">
      <bpmn:extensionElements>
        <uengine:properties>
          <uengine:json>{}</uengine:json>
        </uengine:properties>
      </bpmn:extensionElements>
    </bpmn:endEvent>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1">
      <bpmndi:BPMNShape id="Participant_1" bpmnElement="Participant" isHorizontal="true">
        <dc:Bounds x="20" y="50" width="1200" height="400" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="BPMNShape_2" bpmnElement="Lane_2" isHorizontal="true">
        <dc:Bounds x="50" y="350" width="1170" height="100" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="BPMNShape_1" bpmnElement="Lane_1" isHorizontal="true">
        <dc:Bounds x="50" y="150" width="1170" height="200" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="BPMNShape_0" bpmnElement="Lane_0" isHorizontal="true">
        <dc:Bounds x="50" y="50" width="1170" height="100" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_start_event" bpmnElement="start_event">
        <dc:Bounds x="83" y="83" width="34" height="34" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="68" y="123" width="64" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="BPMNShape_leave_application_submission" bpmnElement="leave_application_submission">
        <dc:Bounds x="200" y="60" width="100" height="80" />
        <bpmndi:BPMNLabel />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="BPMNShape_leave_review_approval" bpmnElement="leave_review_approval">
        <dc:Bounds x="350" y="160" width="100" height="80" />
        <bpmndi:BPMNLabel />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="BPMNShape_review_result_gateway" bpmnElement="review_result_gateway" isMarkerVisible="true">
        <dc:Bounds x="525" y="175" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="BPMNShape_leave_approval" bpmnElement="leave_approval">
        <dc:Bounds x="650" y="160" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="BPMNShape_leave_rejected" bpmnElement="leave_rejected">
        <dc:Bounds x="650" y="260" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="BPMNShape_notify_hr" bpmnElement="notify_hr">
        <dc:Bounds x="800" y="360" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_end_event" bpmnElement="end_event">
        <dc:Bounds x="1183" y="383" width="34" height="34" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="1168" y="423" width="64" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="BPMNEdge_start_event_leave_application_submission" bpmnElement="SequenceFlow_start_event_leave_application_submission">
        <di:waypoint xmlns:di="http://www.omg.org/spec/DD/20100524/DI" x="117" y="100" />
        <di:waypoint xmlns:di="http://www.omg.org/spec/DD/20100524/DI" x="200" y="100" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="BPMNEdge_leave_application_submission_leave_review_approval" bpmnElement="SequenceFlow_leave_application_submission_leave_review_approval">
        <di:waypoint xmlns:di="http://www.omg.org/spec/DD/20100524/DI" x="250" y="140" />
        <di:waypoint xmlns:di="http://www.omg.org/spec/DD/20100524/DI" x="250" y="140" />
        <di:waypoint xmlns:di="http://www.omg.org/spec/DD/20100524/DI" x="250" y="200" />
        <di:waypoint xmlns:di="http://www.omg.org/spec/DD/20100524/DI" x="350" y="200" />
        <di:waypoint xmlns:di="http://www.omg.org/spec/DD/20100524/DI" x="350" y="200" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="BPMNEdge_leave_review_approval_review_result_gateway" bpmnElement="SequenceFlow_leave_review_approval_review_result_gateway">
        <di:waypoint xmlns:di="http://www.omg.org/spec/DD/20100524/DI" x="450" y="200" />
        <di:waypoint xmlns:di="http://www.omg.org/spec/DD/20100524/DI" x="525" y="200" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="BPMNEdge_review_result_gateway_leave_approval" bpmnElement="SequenceFlow_review_result_gateway_leave_approval">
        <di:waypoint xmlns:di="http://www.omg.org/spec/DD/20100524/DI" x="575" y="200" />
        <di:waypoint xmlns:di="http://www.omg.org/spec/DD/20100524/DI" x="650" y="200" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="BPMNEdge_review_result_gateway_leave_rejected" bpmnElement="SequenceFlow_review_result_gateway_leave_rejected">
        <di:waypoint xmlns:di="http://www.omg.org/spec/DD/20100524/DI" x="550" y="225" />
        <di:waypoint xmlns:di="http://www.omg.org/spec/DD/20100524/DI" x="550" y="225" />
        <di:waypoint xmlns:di="http://www.omg.org/spec/DD/20100524/DI" x="550" y="300" />
        <di:waypoint xmlns:di="http://www.omg.org/spec/DD/20100524/DI" x="650" y="300" />
        <di:waypoint xmlns:di="http://www.omg.org/spec/DD/20100524/DI" x="650" y="300" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="BPMNEdge_leave_approval_notify_hr" bpmnElement="SequenceFlow_leave_approval_notify_hr">
        <di:waypoint xmlns:di="http://www.omg.org/spec/DD/20100524/DI" x="700" y="240" />
        <di:waypoint xmlns:di="http://www.omg.org/spec/DD/20100524/DI" x="700" y="240" />
        <di:waypoint xmlns:di="http://www.omg.org/spec/DD/20100524/DI" x="700" y="400" />
        <di:waypoint xmlns:di="http://www.omg.org/spec/DD/20100524/DI" x="800" y="400" />
        <di:waypoint xmlns:di="http://www.omg.org/spec/DD/20100524/DI" x="800" y="400" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="BPMNEdge_notify_hr_end_event" bpmnElement="SequenceFlow_notify_hr_end_event">
        <di:waypoint xmlns:di="http://www.omg.org/spec/DD/20100524/DI" x="900" y="400" />
        <di:waypoint xmlns:di="http://www.omg.org/spec/DD/20100524/DI" x="1183" y="400" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>',
    null
);

ALTER TABLE proc_def ENABLE ROW LEVEL SECURITY;

CREATE POLICY proc_def_insert_policy
    ON proc_def
    FOR INSERT
    TO authenticated
    WITH CHECK ((tenant_id = auth.tenant_id()) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));

CREATE POLICY proc_def_select_policy
    ON proc_def
    FOR SELECT        
    TO authenticated
    USING (
        tenant_id = auth.tenant_id() AND
        (
            EXISTS (
                SELECT 1
                FROM users
                WHERE users.id = auth.uid()
                    AND users.role = 'superAdmin'
            )
            OR
            EXISTS (
                SELECT 1
                FROM user_permissions
                WHERE user_permissions.user_id = auth.uid()
                    AND (
                        user_permissions.proc_def_id = proc_def.id OR
                        EXISTS (
                            SELECT 1
                            FROM jsonb_array_elements(user_permissions.proc_def_ids->'major_proc_list') AS major_proc
                            JOIN jsonb_array_elements(major_proc->'sub_proc_list') AS sub_proc
                            ON sub_proc->>'id' = proc_def.id
                        )
                    )
                    AND user_permissions.readable = true
            )
        )
    );

CREATE POLICY proc_def_update_policy
    ON proc_def
    FOR UPDATE
    TO authenticated
    USING ((tenant_id = auth.tenant_id()) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));

CREATE POLICY proc_def_delete_policy
    ON proc_def
    FOR DELETE
    TO authenticated
    USING ((tenant_id = auth.tenant_id()) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));



create table if not exists public.proc_def_arcv (
    arcv_id text not null,
    proc_def_id text not null,
    version text not null,
    snapshot text null,
    "timeStamp" timestamp without time zone null default current_timestamp,
    diff text null,
    message text null,
    uuid uuid not null default gen_random_uuid (),
    tenant_id text null default auth.tenant_id(),
    constraint proc_def_arcv_pkey primary key (uuid),
    constraint proc_def_arcv_tenant_id_fkey foreign key (tenant_id) references tenants (id) on update cascade on delete cascade
) tablespace pg_default;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_def_arcv' AND column_name='arcv_id') THEN
        ALTER TABLE public.proc_def_arcv ADD COLUMN arcv_id text not null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_def_arcv' AND column_name='proc_def_id') THEN
        ALTER TABLE public.proc_def_arcv ADD COLUMN proc_def_id text not null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_def_arcv' AND column_name='version') THEN
        ALTER TABLE public.proc_def_arcv ADD COLUMN version text not null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_def_arcv' AND column_name='snapshot') THEN
        ALTER TABLE public.proc_def_arcv ADD COLUMN snapshot text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_def_arcv' AND column_name='timeStamp') THEN
        ALTER TABLE public.proc_def_arcv ADD COLUMN timeStamp timestamp without time zone null default current_timestamp;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_def_arcv' AND column_name='diff') THEN
        ALTER TABLE public.proc_def_arcv ADD COLUMN diff text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_def_arcv' AND column_name='message') THEN
        ALTER TABLE public.proc_def_arcv ADD COLUMN message text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_def_arcv' AND column_name='uuid') THEN
        ALTER TABLE public.proc_def_arcv ADD COLUMN uuid uuid not null default gen_random_uuid ();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_def_arcv' AND column_name='tenant_id') THEN
        ALTER TABLE public.proc_def_arcv ADD COLUMN tenant_id text null default auth.tenant_id();
    END IF;
END;
$$;

ALTER TABLE proc_def_arcv ENABLE ROW LEVEL SECURITY;

CREATE POLICY proc_def_arcv_insert_policy
    ON proc_def_arcv
    FOR INSERT
    TO authenticated
    WITH CHECK (tenant_id = auth.tenant_id());

CREATE POLICY proc_def_arcv_select_policy
    ON proc_def_arcv
    FOR SELECT
    TO authenticated
    USING (tenant_id = auth.tenant_id());

CREATE POLICY proc_def_arcv_update_policy
    ON proc_def_arcv
    FOR UPDATE
    TO authenticated
    USING (tenant_id = auth.tenant_id());;

CREATE POLICY proc_def_arcv_delete_policy
    ON proc_def_arcv
    FOR DELETE
    TO authenticated
    USING (tenant_id = auth.tenant_id());



create table if not exists public.form_def (
    uuid uuid not null default gen_random_uuid (),
    html text not null,
    proc_def_id text not null,
    activity_id text not null,
    tenant_id text null default auth.tenant_id(),
    id text null default ''::text,
    fields_json jsonb null,
    constraint form_def_pkey primary key (uuid),
    constraint form_def_tenant_id_fkey foreign key (tenant_id) references tenants (id) on update cascade on delete cascade
) tablespace pg_default;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='form_def' AND column_name='uuid') THEN
        ALTER TABLE public.form_def ADD COLUMN uuid uuid not null default gen_random_uuid ();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='form_def' AND column_name='html') THEN
        ALTER TABLE public.form_def ADD COLUMN html text not null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='form_def' AND column_name='proc_def_id') THEN
        ALTER TABLE public.form_def ADD COLUMN proc_def_id text not null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='form_def' AND column_name='activity_id') THEN
        ALTER TABLE public.form_def ADD COLUMN activity_id text not null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='form_def' AND column_name='tenant_id') THEN
        ALTER TABLE public.form_def ADD COLUMN tenant_id text null default auth.tenant_id();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='form_def' AND column_name='id') THEN
        ALTER TABLE public.form_def ADD COLUMN id text null default ''::text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='form_def' AND column_name='fields_json') THEN
        ALTER TABLE public.form_def ADD COLUMN fields_json jsonb null;
    END IF;
END;
$$;

ALTER TABLE form_def ENABLE ROW LEVEL SECURITY;

CREATE POLICY form_def_insert_policy
    ON form_def
    FOR INSERT
    TO authenticated
    WITH CHECK (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true))));

CREATE POLICY form_def_select_policy
    ON form_def
    FOR SELECT
    TO authenticated
    USING (tenant_id = auth.tenant_id());

CREATE POLICY form_def_update_policy
    ON form_def
    FOR UPDATE
    TO authenticated
    USING (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true))));

CREATE POLICY form_def_delete_policy
    ON form_def
    FOR DELETE
    TO authenticated
    USING (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true))));



create table if not exists public.notifications (
    id uuid not null,
    title text null,
    type text null,
    description text null,
    is_checked boolean null default false,
    time_stamp timestamp with time zone null default now(),
    user_id text null,
    url text null,
    tenant_id text null default auth.tenant_id(),
    constraint notifications_pkey primary key (id),
    constraint notifications_tenant_id_fkey foreign key (tenant_id) references tenants (id) on update cascade on delete cascade
) tablespace pg_default;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='id') THEN
        ALTER TABLE public.notifications ADD COLUMN id uuid not null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='title') THEN
        ALTER TABLE public.notifications ADD COLUMN title text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='type') THEN
        ALTER TABLE public.notifications ADD COLUMN type text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='description') THEN
        ALTER TABLE public.notifications ADD COLUMN description text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='is_checked') THEN
        ALTER TABLE public.notifications ADD COLUMN is_checked boolean null default false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='time_stamp') THEN
        ALTER TABLE public.notifications ADD COLUMN time_stamp timestamp with time zone null default now();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='user_id') THEN
        ALTER TABLE public.notifications ADD COLUMN user_id text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='url') THEN
        ALTER TABLE public.notifications ADD COLUMN url text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='tenant_id') THEN
        ALTER TABLE public.notifications ADD COLUMN tenant_id text null default auth.tenant_id();
    END IF;
END;
$$;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_insert_policy
    ON notifications
    FOR INSERT
    TO authenticated
    WITH CHECK (tenant_id = auth.tenant_id());

CREATE POLICY notifications_select_policy
    ON notifications
    FOR SELECT
    TO authenticated
    USING (tenant_id = auth.tenant_id());

CREATE POLICY notifications_update_policy
    ON notifications
    FOR UPDATE
    TO authenticated
    USING (tenant_id = auth.tenant_id());

CREATE POLICY notifications_delete_policy
    ON notifications
    FOR DELETE
    TO authenticated
    USING (tenant_id = auth.tenant_id());



create table if not exists public.lock (
    id text not null,
    user_id text null,
    tenant_id text null default auth.tenant_id(),
    uuid uuid not null default gen_random_uuid (),
    constraint lock_pkey primary key (uuid),
    constraint lock_tenant_id_fkey foreign key (tenant_id) references tenants (id) on update cascade on delete cascade
) tablespace pg_default;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lock' AND column_name='id') THEN
        ALTER TABLE public.lock ADD COLUMN id text not null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lock' AND column_name='user_id') THEN
        ALTER TABLE public.lock ADD COLUMN user_id text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lock' AND column_name='tenant_id') THEN
        ALTER TABLE public.lock ADD COLUMN tenant_id text null default auth.tenant_id();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lock' AND column_name='uuid') THEN
        ALTER TABLE public.lock ADD COLUMN uuid uuid not null default gen_random_uuid();
    END IF;
END;
$$;

ALTER TABLE lock ENABLE ROW LEVEL SECURITY;

CREATE POLICY lock_insert_policy
    ON lock
    FOR INSERT
    TO authenticated
    WITH CHECK (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true))));

CREATE POLICY lock_select_policy
    ON lock
    FOR SELECT
    TO authenticated
    USING (tenant_id = auth.tenant_id());

CREATE POLICY lock_update_policy
    ON lock
    FOR UPDATE
    TO authenticated
    USING (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true))));

CREATE POLICY lock_delete_policy
    ON lock
    FOR DELETE
    TO authenticated
    USING (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true))));



create table if not exists public.bpm_proc_inst (
    proc_def_id text null,
    proc_inst_id text not null,
    proc_inst_name text null,
    current_activity_ids text[] null,
    current_user_ids text[] null,
    role_bindings jsonb null,
    variables_data jsonb null,
    status text null,
    tenant_id text null default auth.tenant_id(),
    constraint bpm_proc_inst_pkey primary key (proc_inst_id),
    constraint bpm_proc_inst_tenant_id_fkey foreign key (tenant_id) references tenants (id) on update cascade on delete cascade
) tablespace pg_default;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bpm_proc_inst' AND column_name='proc_def_id') THEN
        ALTER TABLE public.bpm_proc_inst ADD COLUMN proc_def_id text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bpm_proc_inst' AND column_name='proc_inst_id') THEN
        ALTER TABLE public.bpm_proc_inst ADD COLUMN proc_inst_id text not null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bpm_proc_inst' AND column_name='proc_inst_name') THEN
        ALTER TABLE public.bpm_proc_inst ADD COLUMN proc_inst_name text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bpm_proc_inst' AND column_name='current_activity_ids') THEN
        ALTER TABLE public.bpm_proc_inst ADD COLUMN current_activity_ids text[] null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bpm_proc_inst' AND column_name='current_user_ids') THEN
        ALTER TABLE public.bpm_proc_inst ADD COLUMN current_user_ids text[] null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bpm_proc_inst' AND column_name='role_bindings') THEN
        ALTER TABLE public.bpm_proc_inst ADD COLUMN role_bindings jsonb null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bpm_proc_inst' AND column_name='variables_data') THEN
        ALTER TABLE public.bpm_proc_inst ADD COLUMN variables_data jsonb null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bpm_proc_inst' AND column_name='status') THEN
        ALTER TABLE public.bpm_proc_inst ADD COLUMN status text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bpm_proc_inst' AND column_name='tenant_id') THEN
        ALTER TABLE public.bpm_proc_inst ADD COLUMN tenant_id text null default auth.tenant_id();
    END IF;
END;
$$;

ALTER TABLE bpm_proc_inst ENABLE ROW LEVEL SECURITY;

CREATE POLICY bpm_proc_inst_insert_policy
    ON bpm_proc_inst
    FOR INSERT
    TO authenticated
    WITH CHECK ((tenant_id = auth.tenant_id()) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));

CREATE POLICY bpm_proc_inst_select_policy
    ON bpm_proc_inst  
    FOR SELECT
    TO authenticated
    USING (tenant_id = auth.tenant_id());

CREATE POLICY bpm_proc_inst_update_policy
    ON bpm_proc_inst
    FOR UPDATE
    TO authenticated
    USING ((tenant_id = auth.tenant_id()) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));

CREATE POLICY bpm_proc_inst_delete_policy
    ON bpm_proc_inst
    FOR DELETE
    TO authenticated
    USING ((tenant_id = auth.tenant_id()) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));



create table if not exists public.todolist (
    id uuid not null,
    user_id text null,
    proc_inst_id text null,
    proc_def_id text null,
    activity_id text null,
    activity_name text null,
    start_date timestamp without time zone null,
    end_date timestamp without time zone null,
    status text null,
    description text null,
    tool text null,
    due_date timestamp without time zone null,
    tenant_id text null default auth.tenant_id(),
    constraint todolist_pkey primary key (id),
    constraint todolist_tenant_id_fkey foreign key (tenant_id) references tenants (id) on update cascade on delete cascade
) tablespace pg_default;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todolist' AND column_name='id') THEN
        ALTER TABLE public.todolist ADD COLUMN id uuid not null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todolist' AND column_name='user_id') THEN
        ALTER TABLE public.todolist ADD COLUMN user_id text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todolist' AND column_name='proc_inst_id') THEN
        ALTER TABLE public.todolist ADD COLUMN proc_inst_id text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todolist' AND column_name='proc_def_id') THEN
        ALTER TABLE public.todolist ADD COLUMN proc_def_id text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todolist' AND column_name='activity_id') THEN
        ALTER TABLE public.todolist ADD COLUMN activity_id text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todolist' AND column_name='activity_name') THEN
        ALTER TABLE public.todolist ADD COLUMN activity_name text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todolist' AND column_name='start_date') THEN
        ALTER TABLE public.todolist ADD COLUMN start_date timestamp without time zone null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todolist' AND column_name='end_date') THEN
        ALTER TABLE public.todolist ADD COLUMN end_date timestamp without time zone null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todolist' AND column_name='status') THEN
        ALTER TABLE public.todolist ADD COLUMN status text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todolist' AND column_name='description') THEN
        ALTER TABLE public.todolist ADD COLUMN description text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todolist' AND column_name='tool') THEN
        ALTER TABLE public.todolist ADD COLUMN tool text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todolist' AND column_name='due_date') THEN
        ALTER TABLE public.todolist ADD COLUMN due_date timestamp without time zone null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todolist' AND column_name='tenant_id') THEN
        ALTER TABLE public.todolist ADD COLUMN tenant_id text null default auth.tenant_id();
    END IF;
END;
$$;

ALTER TABLE todolist ENABLE ROW LEVEL SECURITY;

CREATE POLICY todolist_insert_policy
    ON todolist
    FOR INSERT
    TO authenticated
    WITH CHECK (tenant_id = auth.tenant_id());

CREATE POLICY todolist_select_policy
    ON todolist
    FOR SELECT
    TO authenticated
    USING (tenant_id = auth.tenant_id());

CREATE POLICY todolist_update_policy
    ON todolist
    FOR UPDATE
    TO authenticated
    USING (tenant_id = auth.tenant_id());

CREATE POLICY todolist_delete_policy
    ON todolist
    FOR DELETE
    TO authenticated
    USING (tenant_id = auth.tenant_id());

create or replace function handle_todolist_change()
returns trigger as $$
declare
    v_proc_inst_name text;
begin
    if (TG_OP = 'INSERT') then
        select proc_inst_name, tenant_id into v_proc_inst_name 
        from bpm_proc_inst 
        where proc_inst_id = NEW.proc_inst_id;
        
        insert into notifications (id, user_id, title, type, description, is_checked, time_stamp, tenant_id, url)
        values (
            gen_random_uuid(),
            NEW.user_id,
            NEW.activity_name,
            CASE 
                WHEN NEW.proc_inst_id IS NOT NULL AND NEW.proc_inst_id <> '' THEN 'workitem_bpm'
                ELSE 'workitem'
            END,
            coalesce(v_proc_inst_name, NEW.activity_name),
            case when NEW.status = 'DONE' then true else false end,
            now(),
            NEW.tenant_id,
            '/todolist/' || NEW.id
        )
        on conflict (id) do update
        set
            user_id = EXCLUDED.user_id,
            title = EXCLUDED.title,
            type = EXCLUDED.type,
            description = EXCLUDED.description,
            is_checked = EXCLUDED.is_checked,
            time_stamp = EXCLUDED.time_stamp,
            tenant_id = EXCLUDED.tenant_id,
            url = EXCLUDED.url;
    end if;
    return null;
end;
$$ language plpgsql;

create or replace trigger todolist_change_trigger
after insert on todolist
for each row
execute function handle_todolist_change();

create or replace function update_notification_user_id()
returns trigger as $$
begin
    update notifications
    set user_id = NEW.user_id,
        time_stamp = now()
    where url = '/todolist/' || NEW.id;

    return null;
end;
$$ language plpgsql;

create or replace trigger update_user_id_trigger
after update on todolist
for each row
when (OLD.user_id is distinct from NEW.user_id)
execute function update_notification_user_id();

create or replace function delete_notification_on_todolist_delete()
returns trigger as $$
begin
    delete from notifications
    where url = '/todolist/' || OLD.id;

    return null;
end;
$$ language plpgsql;

create or replace trigger delete_notification_trigger
after delete on todolist
for each row
execute function delete_notification_on_todolist_delete();



create table if not exists public.chat_rooms (
    id text not null,
    participants jsonb not null,
    message jsonb null,
    name text null,
    tenant_id text null default auth.tenant_id(),
    constraint chat_rooms_pkey primary key (id),
    constraint chat_rooms_tenant_id_fkey foreign key (tenant_id) references tenants (id) on update cascade on delete cascade
) tablespace pg_default;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_rooms' AND column_name='id') THEN
        ALTER TABLE public.chat_rooms ADD COLUMN id text not null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_rooms' AND column_name='participants') THEN
        ALTER TABLE public.chat_rooms ADD COLUMN participants jsonb not null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_rooms' AND column_name='message') THEN
        ALTER TABLE public.chat_rooms ADD COLUMN message jsonb null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_rooms' AND column_name='name') THEN
        ALTER TABLE public.chat_rooms ADD COLUMN name text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_rooms' AND column_name='tenant_id') THEN
        ALTER TABLE public.chat_rooms ADD COLUMN tenant_id text null default auth.tenant_id();
    END IF;
END;
$$;

ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_rooms_insert_policy
    ON chat_rooms
    FOR INSERT
    TO authenticated
    WITH CHECK (tenant_id = auth.tenant_id());

CREATE POLICY chat_rooms_select_policy
    ON chat_rooms
    FOR SELECT
    TO authenticated 
    USING (tenant_id = auth.tenant_id());

CREATE POLICY chat_rooms_update_policy
    ON chat_rooms
    FOR UPDATE
    TO authenticated 
    USING (tenant_id = auth.tenant_id());

CREATE POLICY chat_rooms_delete_policy
    ON chat_rooms
    FOR DELETE
    TO authenticated 
    USING (tenant_id = auth.tenant_id());



create table if not exists public.chats (
    uuid text not null,
    id text not null,
    messages jsonb null,
    tenant_id text null default auth.tenant_id(),
    constraint chats_pkey primary key (uuid),
    constraint chats_tenant_id_fkey foreign key (tenant_id) references tenants (id) on update cascade on delete cascade
) tablespace pg_default;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chats' AND column_name='uuid') THEN
        ALTER TABLE public.chats ADD COLUMN uuid text not null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chats' AND column_name='id') THEN
        ALTER TABLE public.chats ADD COLUMN id text not null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chats' AND column_name='messages') THEN
        ALTER TABLE public.chats ADD COLUMN messages jsonb null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chats' AND column_name='tenant_id') THEN
        ALTER TABLE public.chats ADD COLUMN tenant_id text null default auth.tenant_id();
    END IF;
END;
$$;

ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY chats_insert_policy
    ON chats
    FOR INSERT
    TO authenticated
    WITH CHECK (tenant_id = auth.tenant_id());

CREATE POLICY chats_select_policy
    ON chats
    FOR SELECT
    TO authenticated 
    USING (tenant_id = auth.tenant_id());

CREATE POLICY chats_update_policy
    ON chats
    FOR UPDATE
    TO authenticated
    USING (tenant_id = auth.tenant_id());

CREATE POLICY chats_delete_policy
    ON chats
    FOR DELETE
    TO authenticated 
    USING (tenant_id = auth.tenant_id());

create or replace function handle_chat_insert()
returns trigger as $$
declare
    chat_room_participant jsonb;
    participant_email text;
    participant_record record;
    chat_room_name text;
begin
    -- Fetch the chat room name
    select name into chat_room_name from public.chat_rooms where id = NEW.id;

    for participant_record in
        select jsonb_array_elements(participants) as p
        from public.chat_rooms
        where id = NEW.id
    loop
        chat_room_participant := participant_record.p;
        
        if chat_room_participant->>'username' != 'System' and chat_room_participant->>'email' != NEW.messages->>'email' then
            participant_email := chat_room_participant->>'email';
            
            insert into notifications (id, user_id, title, type, description, is_checked, time_stamp, url)
            values (
                gen_random_uuid(),
                participant_email,
                NEW.messages->>'content',
                'chat',
                chat_room_name,  -- Use chat room name as description
                false,
                now(),
                '/chats?id=' || NEW.id
            )
            on conflict (id) do update
            set
                user_id = EXCLUDED.user_id,
                title = EXCLUDED.title,
                time_stamp = EXCLUDED.time_stamp,
                is_checked = EXCLUDED.is_checked,
                url = EXCLUDED.url;
        end if;
    end loop;

    return null;
end;
$$ language plpgsql;

create or replace trigger chat_insert_trigger
after insert on public.chats
for each row
execute function handle_chat_insert();



create table if not exists public.calendar (
    uid text not null,
    data jsonb null,
    tenant_id text null default auth.tenant_id(),
    constraint calendar_pkey primary key (uid)
) tablespace pg_default;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calendar' AND column_name='uid') THEN
        ALTER TABLE public.calendar ADD COLUMN uid text not null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calendar' AND column_name='data') THEN
        ALTER TABLE public.calendar ADD COLUMN data jsonb null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calendar' AND column_name='tenant_id') THEN
        ALTER TABLE public.calendar ADD COLUMN tenant_id text null default auth.tenant_id();
    END IF;
END;
$$;

ALTER TABLE calendar ENABLE ROW LEVEL SECURITY;

CREATE POLICY calendar_insert_policy
    ON calendar
    FOR INSERT
    TO authenticated
    WITH CHECK (tenant_id = auth.tenant_id());

CREATE POLICY calendar_select_policy
    ON calendar
    FOR SELECT
    TO authenticated
    USING (tenant_id = auth.tenant_id());

CREATE POLICY calendar_update_policy
    ON calendar
    FOR UPDATE
    TO authenticated
    USING (tenant_id = auth.tenant_id());

CREATE POLICY calendar_delete_policy
    ON calendar
    FOR DELETE
    TO authenticated
    USING (tenant_id = auth.tenant_id());



DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_views
        WHERE viewname = 'chat_room_chats'
        AND schemaname = 'public'
    ) THEN
        CREATE VIEW public.chat_room_chats AS
        SELECT
            cr.id,
            cr.name,
            cr.participants,
            c.uuid,
            c.messages
        FROM
            chat_rooms cr
            JOIN chats c ON cr.id = c.id;
    END IF;
END;
$$;



CREATE OR REPLACE FUNCTION search_bpm_proc_inst(keyword TEXT, user_email TEXT)
RETURNS SETOF bpm_proc_inst AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM bpm_proc_inst
    WHERE (proc_def_id ILIKE '%' || keyword || '%'
       OR proc_inst_id ILIKE '%' || keyword || '%'
       OR proc_inst_name ILIKE '%' || keyword || '%'
       OR variables_data::text ILIKE '%' || keyword || '%')
      AND user_email = ANY(current_user_ids);
END;
$$ LANGUAGE plpgsql;



CREATE OR REPLACE FUNCTION search_chat_room_chats(keyword TEXT)
RETURNS SETOF chat_room_chats AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM chat_room_chats
    WHERE messages->>'content' ILIKE '%' || keyword || '%'
       OR messages->>'name' ILIKE '%' || keyword || '%'
       OR messages->>'email' ILIKE '%' || keyword || '%';
END;
$$ LANGUAGE plpgsql;



-- public.proc_def의 tenant_id를 업데이트하는 새로운 함수 생성
CREATE OR REPLACE FUNCTION public.update_tenant_id_for_first_tenant()
RETURNS TRIGGER AS $$
DECLARE
    tenant_count INT;
BEGIN
    -- public.tenants 테이블의 현재 행 수를 확인
    SELECT COUNT(*) INTO tenant_count FROM public.tenants;

    -- 첫 번째 행이 삽입될 때만 업데이트 수행
    IF tenant_count = 1 THEN
        UPDATE public.proc_def
        SET tenant_id = NEW.id
        WHERE id = 'leave_request_process';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- public.tenants 테이블에 대한 트리거 생성
CREATE OR REPLACE TRIGGER on_first_tenant_inserted
AFTER INSERT ON public.tenants
FOR EACH ROW
EXECUTE PROCEDURE public.update_tenant_id_for_first_tenant();



CREATE POLICY "Allow authenticated users to upload"
ON storage.objects
FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
);




-- user_permissions 테이블: 테넌트별 사용자의 프로세스 접근 권한 관리
create table if not exists public.user_permissions (
    id text not null,
    user_id uuid not null,
    tenant_id text not null default auth.tenant_id(),
    proc_def_id text not null,
    proc_def_ids jsonb not null,
    readable boolean not null default false,
    writable boolean not null default false,
    constraint user_permissions_pkey primary key (id),
    constraint user_permissions_user_id_fkey foreign key (user_id) references users (id) on update cascade on delete cascade,
    constraint user_permissions_tenant_id_fkey foreign key (tenant_id) references tenants (id) on update cascade on delete cascade
) tablespace pg_default;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_permissions' AND column_name='id') THEN
        ALTER TABLE public.user_permissions ADD COLUMN id TEXT PRIMARY KEY;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_permissions' AND column_name='user_id') THEN
        ALTER TABLE public.user_permissions ADD COLUMN user_id UUID PRIMARY KEY;
    END IF;    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_permissions' AND column_name='proc_def_id') THEN
        ALTER TABLE public.user_permissions ADD COLUMN proc_def_id TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_permissions' AND column_name='proc_def_ids') THEN
        ALTER TABLE public.user_permissions ADD COLUMN proc_def_ids JSONB NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_permissions' AND column_name='readable') THEN
        ALTER TABLE public.user_permissions ADD COLUMN readable BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_permissions' AND column_name='writable') THEN
        ALTER TABLE public.user_permissions ADD COLUMN writable BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_permissions' AND column_name='tenant_id') THEN
        ALTER TABLE public.user_permissions ADD COLUMN tenant_id TEXT NOT NULL DEFAULT auth.tenant_id();
    END IF;
END;
$$;

ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_permissions_insert_policy
    ON user_permissions
    FOR INSERT
    TO authenticated
    WITH CHECK (tenant_id = auth.tenant_id());

CREATE POLICY user_permissions_select_policy
    ON user_permissions
    FOR SELECT
    TO authenticated
    USING (tenant_id = auth.tenant_id());

CREATE POLICY user_permissions_update_policy
    ON user_permissions
    FOR UPDATE
    TO authenticated
    USING (tenant_id = auth.tenant_id());

CREATE POLICY user_permissions_delete_policy
    ON user_permissions
    FOR DELETE
    TO authenticated
    USING (tenant_id = auth.tenant_id());


-- Create a function to set the id column
CREATE OR REPLACE FUNCTION set_user_permissions_id()
RETURNS TRIGGER AS $$
BEGIN
    NEW.id := NEW.proc_def_id || '_' || NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to call the function before insert
CREATE TRIGGER before_insert_user_permissions
BEFORE INSERT ON public.user_permissions
FOR EACH ROW EXECUTE FUNCTION set_user_permissions_id();

-- 프로세스 권한 체크
CREATE OR REPLACE FUNCTION check_process_permission(p_proc_def_id TEXT, p_user_id UUID DEFAULT NULL)
RETURNS SETOF user_permissions AS $$
BEGIN
    RETURN QUERY
    SELECT up.*
    FROM user_permissions up,
         jsonb_array_elements(up.proc_def_ids->'major_proc_list') AS major_proc,
         jsonb_array_elements(major_proc->'sub_proc_list') AS sub_proc
    WHERE (p_user_id IS NULL OR up.user_id = p_user_id)
    AND (
        up.proc_def_ids->>'id' = p_proc_def_id OR
        major_proc->>'id' = p_proc_def_id OR
        sub_proc->>'id' = p_proc_def_id
    );
END;
$$ LANGUAGE plpgsql;



-- vector store 구성
-- Enable the pgvector extension to work with embedding vectors
create extension vector;

-- Create a table to store your documents
create table documents (
  id uuid primary key,
  content text, -- corresponds to Document.pageContent
  metadata jsonb, -- corresponds to Document.metadata
  embedding vector(1536) -- 1536 works for OpenAI embeddings, change if needed
);

create or replace function match_documents(
  filter jsonb,
  query_embedding vector(1536)
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language sql
as $$
  select
    id,
    content,
    metadata,
    1 - (embedding <=> query_embedding) as similarity
  from documents
  where metadata @> filter
  order by embedding <=> query_embedding;
$$;
