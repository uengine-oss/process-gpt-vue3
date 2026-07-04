import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { createExecutionDefinitionFromBpmnXml } from './gateway-regression-fixtures.cjs';

dotenv.config();

const executionRoot = process.env.EXECUTION_ROOT || 'D:\\uEngineProjectC\\processEsecution\\process-gpt-execution';
const uvCacheDir = path.resolve(process.cwd(), '.tmp', 'uv-cache');
const executionPython =
    process.env.EXECUTION_PYTHON ||
    'C:\\Users\\m6023\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe';

function spawnPython(script: string) {
    const result = spawnSync(executionPython, ['-c', script], {
        cwd: executionRoot,
        encoding: 'utf8',
        timeout: 60_000,
        env: {
            ...process.env,
            ENV: 'test',
            UV_CACHE_DIR: uvCacheDir,
            UV_LINK_MODE: 'copy'
        }
    });
    expect(result.status, result.stderr || result.stdout).toBe(0);
    const lastLine = result.stdout.trim().split(/\r?\n/).at(-1) || '{}';
    return JSON.parse(lastLine);
}

function requireDbE2e() {
    test.skip(process.env.CALL_ACTIVITY_DB_E2E !== '1', 'Set CALL_ACTIVITY_DB_E2E=1 to run the Supabase insert test.');

    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_KEY;
    test.skip(!url || !key, 'Supabase URL/key env vars are required for the DB E2E test.');

    return createClient(url!, key!, {
        auth: { persistSession: false, autoRefreshToken: false }
    });
}

async function expectNoSupabaseError<T>(operation: PromiseLike<{ data: T; error: any }>) {
    const { data, error } = await operation;
    expect(error?.message || error).toBeFalsy();
    return data;
}

test.describe('ProcessGPT CallActivity execution contract', () => {
    test('BPMN CallActivity stores definitionId in runtime definition properties', async () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:uengine="http://uengine" id="Definitions_call" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="parent_process" name="Parent" isExecutable="true">
    <bpmn:startEvent id="start"><bpmn:outgoing>flow_start_a</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="A" name="A"><bpmn:incoming>flow_start_a</bpmn:incoming><bpmn:outgoing>flow_a_call</bpmn:outgoing></bpmn:userTask>
    <bpmn:callActivity id="call_child" name="Call child">
      <bpmn:extensionElements>
        <uengine:properties>
          <uengine:json>{"definitionId":"child_process","roleBindings":[{"sourceRole":"requester","targetRole":"child_worker"}],"parameters":[]}</uengine:json>
        </uengine:properties>
      </bpmn:extensionElements>
      <bpmn:incoming>flow_a_call</bpmn:incoming>
      <bpmn:outgoing>flow_call_b</bpmn:outgoing>
    </bpmn:callActivity>
    <bpmn:userTask id="B" name="B"><bpmn:incoming>flow_call_b</bpmn:incoming><bpmn:outgoing>flow_b_end</bpmn:outgoing></bpmn:userTask>
    <bpmn:endEvent id="end"><bpmn:incoming>flow_b_end</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="flow_start_a" sourceRef="start" targetRef="A" />
    <bpmn:sequenceFlow id="flow_a_call" sourceRef="A" targetRef="call_child" />
    <bpmn:sequenceFlow id="flow_call_b" sourceRef="call_child" targetRef="B" />
    <bpmn:sequenceFlow id="flow_b_end" sourceRef="B" targetRef="end" />
  </bpmn:process>
</bpmn:definitions>`;

        const definition = await createExecutionDefinitionFromBpmnXml(xml);
        const callActivity = definition.activities.find((activity: any) => activity.id === 'call_child');
        expect(callActivity).toBeTruthy();
        expect(callActivity.type).toBe('CallActivity');
        expect(JSON.parse(callActivity.properties)).toMatchObject({
            definitionId: 'child_process',
            roleBindings: [{ sourceRole: 'requester', targetRole: 'child_worker' }]
        });
    });

    test('completion spawns child instance and wakes parent when child completes', async () => {
        const payload = spawnPython(String.raw`
import importlib.util
import asyncio
import json
import pathlib
import sys
import types
from types import SimpleNamespace

root = pathlib.Path.cwd()
polling_root = root / "polling_service"
sys.path.insert(0, str(root))
sys.path.insert(0, str(polling_root))

def install_light_stubs():
    langchain = types.ModuleType("langchain")
    langchain_prompts = types.ModuleType("langchain.prompts")
    class DummyPrompt:
        def __init__(self, template):
            self.template = template
        def format(self, **_kwargs):
            return self.template
    class DummyPromptTemplate:
        @classmethod
        def from_template(cls, template):
            return DummyPrompt(template)
    langchain_prompts.PromptTemplate = DummyPromptTemplate
    langchain_schema = types.ModuleType("langchain.schema")
    langchain_schema.Document = object
    langchain_output_parsers = types.ModuleType("langchain.output_parsers")
    langchain_output_parsers_json = types.ModuleType("langchain.output_parsers.json")
    class DummySimpleJsonOutputParser:
        pass
    langchain_output_parsers_json.SimpleJsonOutputParser = DummySimpleJsonOutputParser
    sys.modules["langchain"] = langchain
    sys.modules["langchain.prompts"] = langchain_prompts
    sys.modules["langchain.schema"] = langchain_schema
    sys.modules["langchain.output_parsers"] = langchain_output_parsers
    sys.modules["langchain.output_parsers.json"] = langchain_output_parsers_json

    llm_factory = types.ModuleType("llm_factory")
    class DummyModel:
        async def astream(self, *_args, **_kwargs):
            if False:
                yield None
            return
        def invoke(self, *_args, **_kwargs):
            return SimpleNamespace(content="")
    llm_factory.create_llm = lambda **_kwargs: DummyModel()
    sys.modules["llm_factory"] = llm_factory

    fastapi = types.ModuleType("fastapi")
    class HTTPException(Exception):
        def __init__(self, status_code=500, detail=""):
            super().__init__(detail)
            self.status_code = status_code
            self.detail = detail
    fastapi.HTTPException = HTTPException
    sys.modules["fastapi"] = fastapi

    dotenv = types.ModuleType("dotenv")
    dotenv.load_dotenv = lambda *_args, **_kwargs: None
    sys.modules["dotenv"] = dotenv

    requests_mod = types.ModuleType("requests")
    class DummyResponse:
        def json(self):
            return {}
    requests_mod.post = lambda *_args, **_kwargs: DummyResponse()
    sys.modules["requests"] = requests_mod

    database_mod = types.ModuleType("database")
    def noop(*_args, **_kwargs):
        return None
    class DummyProcessInstance:
        pass
    for name in [
        "fetch_process_definition_by_version",
        "fetch_process_instance",
        "fetch_ui_definition",
        "fetch_ui_definition_by_activity_id",
        "fetch_ui_definitions_by_def_id",
        "fetch_user_info",
        "fetch_assignee_info",
        "fetch_workitem_by_proc_inst_and_activity",
        "upsert_process_instance",
        "upsert_completed_workitem",
        "upsert_next_workitems",
        "upsert_chat_message",
        "upsert_todo_workitems",
        "upsert_workitem",
        "fetch_todolist_by_proc_inst_id",
        "execute_rpc",
        "upsert_cancelled_workitem",
        "insert_process_instance",
        "fetch_child_instances_by_parent",
        "fetch_organization_chart",
        "fetch_workitems_by_root_proc_inst_id",
        "get_field_value",
        "group_fields_by_form",
        "get_input_data",
        "update_proc_def_prod_version",
    ]:
        setattr(database_mod, name, noop)
    database_mod.ProcessInstance = DummyProcessInstance
    sys.modules["database"] = database_mod

    mcp_processor_mod = types.ModuleType("mcp_processor")
    class DummyMCP:
        async def execute_mcp_tools(self, *_args, **_kwargs):
            return {"messages": []}
        async def cleanup(self):
            return None
    mcp_processor_mod.mcp_processor = DummyMCP()
    sys.modules["mcp_processor"] = mcp_processor_mod

    code_executor_mod = types.ModuleType("code_executor")
    code_executor_mod.execute_python_code = lambda *_args, **_kwargs: None
    sys.modules["code_executor"] = code_executor_mod

    smtp_handler_mod = types.ModuleType("smtp_handler")
    smtp_handler_mod.generate_email_template = lambda *_args, **_kwargs: ""
    smtp_handler_mod.send_email = lambda *_args, **_kwargs: None
    sys.modules["smtp_handler"] = smtp_handler_mod

install_light_stubs()

from process_definition import load_process_definition
spec = importlib.util.spec_from_file_location("wiproc", str(polling_root / "workitem_processor.py"))
wiproc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(wiproc)

parent_json = {
    "processDefinitionName": "Parent",
    "processDefinitionId": "parent_process",
    "roles": [
        {"name": "requester"},
        {"name": "child_worker"}
    ],
    "activities": [
        {"id": "A", "name": "A", "type": "userTask", "description": "", "role": "requester"},
        {
            "id": "call_child",
            "name": "Call child",
            "type": "CallActivity",
            "description": "",
            "role": "requester",
            "properties": json.dumps({
                "definitionId": "child_process",
                "roleBindings": [{"sourceRole": "requester", "targetRole": "child_worker"}]
            })
        },
        {"id": "B", "name": "B", "type": "userTask", "description": "", "role": "requester"}
    ],
    "events": [
        {"id": "start", "name": "Start", "type": "startEvent"},
        {"id": "end", "name": "End", "type": "endEvent"}
    ],
    "gateways": [],
    "sequences": [
        {"id": "flow_start_a", "source": "start", "target": "A"},
        {"id": "flow_a_call", "source": "A", "target": "call_child"},
        {"id": "flow_call_b", "source": "call_child", "target": "B"},
        {"id": "flow_b_end", "source": "B", "target": "end"}
    ],
    "subProcesses": []
}
child_json = {
    "processDefinitionName": "Child",
    "processDefinitionId": "child_process",
    "roles": [{"name": "child_worker"}],
    "activities": [
        {"id": "X", "name": "Child task", "type": "userTask", "description": "", "role": "child_worker"}
    ],
    "events": [
        {"id": "child_start", "name": "Child start", "type": "startEvent"},
        {"id": "child_end", "name": "Child end", "type": "endEvent"}
    ],
    "gateways": [],
    "sequences": [
        {"id": "flow_child_start_x", "source": "child_start", "target": "X"},
        {"id": "flow_x_child_end", "source": "X", "target": "child_end"}
    ],
    "subProcesses": []
}

parent_def = load_process_definition(parent_json)
child_def = load_process_definition(child_json)
role_bindings = [{"name": "requester", "endpoint": "requester@example.com"}]
parent_inst = SimpleNamespace(
    proc_inst_id="parent_process.1",
    proc_inst_name="Parent.1",
    proc_def_id="parent_process",
    role_bindings=role_bindings,
    current_activity_ids=["A"],
    participants=[],
    variables_data=[],
    process_definition=parent_def,
    status="RUNNING",
    tenant_id="localhost",
    parent_proc_inst_id=None,
    root_proc_inst_id="parent_process.1",
    execution_scope=None,
)
parent_inst.model_dump = lambda: parent_inst.__dict__
parent_call_workitem = SimpleNamespace(id="wi-call", status="PENDING")

inserted_instances = []
upserted_workitems = []

def fetch_process_instance(proc_inst_id, tenant_id=None):
    if proc_inst_id == "parent_process.1":
        return parent_inst
    if proc_inst_id == "child_process.1":
        return SimpleNamespace(
            proc_inst_id="child_process.1",
            parent_proc_inst_id="parent_process.1",
            status="COMPLETED",
        )
    return None

wiproc.fetch_process_instance = fetch_process_instance
wiproc.fetch_process_definition_by_version = lambda def_id, *_args, **_kwargs: child_json if def_id == "child_process" else parent_json
wiproc.insert_process_instance = lambda data, tenant_id=None: inserted_instances.append(data)
wiproc.upsert_workitem = lambda data, tenant_id=None: upserted_workitems.append(data)
wiproc.fetch_workitem_by_proc_inst_and_activity = lambda proc_inst_id, activity_id, tenant_id=None: None
wiproc.upsert_chat_message = lambda *_args, **_kwargs: None
wiproc.check_external_customer_and_send_email = lambda *_args, **_kwargs: None
wiproc._execute_script_tasks = lambda *_args, **_kwargs: None
wiproc._persist_process_data = lambda *_args, **_kwargs: None
wiproc._register_event = lambda *_args, **_kwargs: None
wiproc._check_service_tasks = lambda *_args, **_kwargs: None

process_result_json = {
    "instanceId": "parent_process.1",
    "instanceName": "Parent.1",
    "processDefinitionId": "parent_process",
    "fieldMappings": [],
    "roleBindings": role_bindings,
    "completedActivities": [{"completedActivityId": "A", "completedUserEmail": "requester@example.com", "result": "DONE"}],
    "nextActivities": [{"nextActivityId": "call_child", "nextActivityName": "Call child", "nextUserEmail": "requester@example.com", "result": "IN_PROGRESS", "type": "CallActivity"}],
    "cancelledActivities": []
}

wiproc.execute_next_activity(process_result_json, "localhost")

wiproc.fetch_child_instances_by_parent = lambda parent_id, tenant_id=None: [{"proc_inst_id": "child_process.running", "status": "RUNNING"}]
wiproc.fetch_todolist_by_proc_inst_id = lambda proc_inst_id: [{"status": "IN_PROGRESS"}]
asyncio.run(wiproc.handle_pending_workitem({
    "id": "wi-call",
    "status": "PENDING",
    "proc_def_id": "parent_process",
    "proc_inst_id": "parent_process.1",
    "activity_id": "call_child",
    "tenant_id": "localhost"
}))

wiproc.fetch_process_instance = lambda proc_inst_id, tenant_id=None: (
    SimpleNamespace(proc_inst_id="child_process.1", parent_proc_inst_id="parent_process.1", status="COMPLETED")
    if proc_inst_id == "child_process.1" else parent_inst
)
wiproc.fetch_child_instances_by_parent = lambda parent_id, tenant_id=None: [{"proc_inst_id": "child_process.1", "status": "COMPLETED"}]
wiproc.fetch_workitem_by_proc_inst_and_activity = lambda proc_inst_id, activity_id, tenant_id=None: parent_call_workitem
wiproc._progress_parent_if_all_children_completed("child_process.1", "localhost")

print(json.dumps({
    "nextActivities": process_result_json["nextActivities"],
    "completedActivities": process_result_json["completedActivities"],
    "parentCurrentActivityIds": parent_inst.current_activity_ids,
    "insertedInstances": inserted_instances,
    "upsertedWorkitems": upserted_workitems
}, ensure_ascii=False))
`);

        expect(payload.nextActivities[0]).toMatchObject({
            nextActivityId: 'call_child',
            result: 'PENDING'
        });
        expect(payload.parentCurrentActivityIds).toContain('call_child');
        expect(payload.insertedInstances).toHaveLength(1);
        expect(payload.insertedInstances[0]).toMatchObject({
            proc_def_id: 'child_process',
            parent_proc_inst_id: 'parent_process.1',
            root_proc_inst_id: 'parent_process.1',
            status: 'NEW'
        });
        expect(payload.insertedInstances[0].role_bindings).toEqual([
            { name: 'child_worker', endpoint: 'requester@example.com' }
        ]);
        expect(payload.upsertedWorkitems).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    proc_inst_id: 'parent_process.1',
                    proc_def_id: 'parent_process',
                    activity_id: 'call_child',
                    activity_name: 'Call child',
                    status: 'PENDING',
                    root_proc_inst_id: 'parent_process.1',
                    assignees: [{ name: 'child_worker', endpoint: 'requester@example.com' }]
                }),
                expect.objectContaining({
                    proc_inst_id: expect.stringMatching(/^child_process\./),
                    proc_def_id: 'child_process',
                    activity_id: 'child_start',
                    status: 'SUBMITTED',
                    assignees: [{ name: 'child_worker', endpoint: 'requester@example.com' }]
                }),
                expect.objectContaining({
                    id: 'wi-call',
                    status: 'SUBMITTED'
                })
            ])
        );
        expect(payload.upsertedWorkitems).not.toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'wi-call',
                    status: 'DONE'
                })
            ])
        );
    });

    test('polling_workitem processes submitted parent workitem into CallActivity child execution', async () => {
        const payload = spawnPython(String.raw`
import asyncio
import importlib.util
import json
import pathlib
import sys
import types
from types import SimpleNamespace

root = pathlib.Path.cwd()
polling_root = root / "polling_service"
sys.path.insert(0, str(root))
sys.path.insert(0, str(polling_root))

def install_light_stubs():
    langchain = types.ModuleType("langchain")
    langchain_prompts = types.ModuleType("langchain.prompts")
    class DummyPrompt:
        def __init__(self, template):
            self.template = template
        def format(self, **_kwargs):
            return self.template
    class DummyPromptTemplate:
        @classmethod
        def from_template(cls, template):
            return DummyPrompt(template)
    langchain_prompts.PromptTemplate = DummyPromptTemplate
    langchain_schema = types.ModuleType("langchain.schema")
    langchain_schema.Document = object
    langchain_output_parsers = types.ModuleType("langchain.output_parsers")
    langchain_output_parsers_json = types.ModuleType("langchain.output_parsers.json")
    class DummySimpleJsonOutputParser:
        pass
    langchain_output_parsers_json.SimpleJsonOutputParser = DummySimpleJsonOutputParser
    sys.modules["langchain"] = langchain
    sys.modules["langchain.prompts"] = langchain_prompts
    sys.modules["langchain.schema"] = langchain_schema
    sys.modules["langchain.output_parsers"] = langchain_output_parsers
    sys.modules["langchain.output_parsers.json"] = langchain_output_parsers_json

    llm_factory = types.ModuleType("llm_factory")
    class DummyModel:
        async def astream(self, *_args, **_kwargs):
            if False:
                yield None
            return
        def invoke(self, *_args, **_kwargs):
            return SimpleNamespace(content="")
    llm_factory.create_llm = lambda **_kwargs: DummyModel()
    sys.modules["llm_factory"] = llm_factory

    fastapi = types.ModuleType("fastapi")
    class HTTPException(Exception):
        def __init__(self, status_code=500, detail=""):
            super().__init__(detail)
            self.status_code = status_code
            self.detail = detail
    fastapi.HTTPException = HTTPException
    sys.modules["fastapi"] = fastapi

    dotenv = types.ModuleType("dotenv")
    dotenv.load_dotenv = lambda *_args, **_kwargs: None
    sys.modules["dotenv"] = dotenv

    requests_mod = types.ModuleType("requests")
    class DummyResponse:
        def json(self):
            return {}
    requests_mod.post = lambda *_args, **_kwargs: DummyResponse()
    sys.modules["requests"] = requests_mod

    database_mod = types.ModuleType("database")
    def noop(*_args, **_kwargs):
        return None
    class DummyProcessInstance:
        pass
    for name in [
        "setting_database",
        "fetch_workitem_with_submitted_status",
        "fetch_workitem_with_pending_status",
        "cleanup_stale_consumers",
        "fetch_process_definition_by_version",
        "fetch_process_instance",
        "fetch_ui_definition",
        "fetch_ui_definition_by_activity_id",
        "fetch_ui_definitions_by_def_id",
        "fetch_user_info",
        "fetch_assignee_info",
        "fetch_workitem_by_proc_inst_and_activity",
        "upsert_process_instance",
        "upsert_completed_workitem",
        "upsert_next_workitems",
        "upsert_chat_message",
        "upsert_todo_workitems",
        "upsert_workitem",
        "fetch_todolist_by_proc_inst_id",
        "execute_rpc",
        "upsert_cancelled_workitem",
        "insert_process_instance",
        "fetch_child_instances_by_parent",
        "fetch_organization_chart",
        "fetch_workitems_by_root_proc_inst_id",
        "get_field_value",
        "group_fields_by_form",
        "get_input_data",
        "update_proc_def_prod_version",
    ]:
        setattr(database_mod, name, noop)
    database_mod.ProcessInstance = DummyProcessInstance
    sys.modules["database"] = database_mod

    file_cleanup_mod = types.ModuleType("file_cleanup_service")
    async def file_cleanup_polling_task(*_args, **_kwargs):
        return None
    file_cleanup_mod.file_cleanup_polling_task = file_cleanup_polling_task
    sys.modules["file_cleanup_service"] = file_cleanup_mod

    mcp_processor_mod = types.ModuleType("mcp_processor")
    class DummyMCP:
        async def execute_mcp_tools(self, *_args, **_kwargs):
            return {"messages": []}
        async def cleanup(self):
            return None
    mcp_processor_mod.mcp_processor = DummyMCP()
    sys.modules["mcp_processor"] = mcp_processor_mod

    code_executor_mod = types.ModuleType("code_executor")
    code_executor_mod.execute_python_code = lambda *_args, **_kwargs: None
    sys.modules["code_executor"] = code_executor_mod

    smtp_handler_mod = types.ModuleType("smtp_handler")
    smtp_handler_mod.generate_email_template = lambda *_args, **_kwargs: ""
    smtp_handler_mod.send_email = lambda *_args, **_kwargs: None
    sys.modules["smtp_handler"] = smtp_handler_mod

install_light_stubs()

from process_definition import load_process_definition

wiproc_spec = importlib.util.spec_from_file_location("workitem_processor", str(polling_root / "workitem_processor.py"))
wiproc = importlib.util.module_from_spec(wiproc_spec)
wiproc_spec.loader.exec_module(wiproc)
sys.modules["workitem_processor"] = wiproc

polling_spec = importlib.util.spec_from_file_location("polling_runtime", str(polling_root / "polling_service.py"))
polling = importlib.util.module_from_spec(polling_spec)
polling_spec.loader.exec_module(polling)

parent_json = {
    "processDefinitionName": "Parent",
    "processDefinitionId": "parent_process",
    "roles": [{"name": "requester"}, {"name": "child_worker"}],
    "activities": [
        {"id": "A", "name": "A", "type": "userTask", "description": "", "role": "requester"},
        {
            "id": "call_child",
            "name": "Call child",
            "type": "CallActivity",
            "description": "",
            "role": "requester",
            "properties": json.dumps({
                "definitionId": "child_process",
                "roleBindings": [{"sourceRole": "requester", "targetRole": "child_worker"}]
            })
        },
        {"id": "B", "name": "B", "type": "userTask", "description": "", "role": "requester"}
    ],
    "events": [
        {"id": "start", "name": "Start", "type": "startEvent"},
        {"id": "end", "name": "End", "type": "endEvent"}
    ],
    "gateways": [],
    "sequences": [
        {"id": "flow_start_a", "source": "start", "target": "A"},
        {"id": "flow_a_call", "source": "A", "target": "call_child"},
        {"id": "flow_call_b", "source": "call_child", "target": "B"},
        {"id": "flow_b_end", "source": "B", "target": "end"}
    ],
    "subProcesses": []
}
child_json = {
    "processDefinitionName": "Child",
    "processDefinitionId": "child_process",
    "roles": [{"name": "child_worker"}],
    "activities": [
        {"id": "X", "name": "Child task", "type": "userTask", "description": "", "role": "child_worker"}
    ],
    "events": [
        {"id": "child_start", "name": "Child start", "type": "startEvent"},
        {"id": "child_end", "name": "Child end", "type": "endEvent"}
    ],
    "gateways": [],
    "sequences": [
        {"id": "flow_child_start_x", "source": "child_start", "target": "X"},
        {"id": "flow_x_child_end", "source": "X", "target": "child_end"}
    ],
    "subProcesses": []
}

parent_def = load_process_definition(parent_json)
role_bindings = [{"name": "requester", "endpoint": "requester@example.com"}]
parent_inst = SimpleNamespace(
    proc_inst_id="parent_process.1",
    proc_inst_name="Parent.1",
    proc_def_id="parent_process",
    role_bindings=role_bindings,
    current_activity_ids=["A"],
    participants=[],
    variables_data=[],
    process_definition=parent_def,
    status="RUNNING",
    tenant_id="localhost",
    parent_proc_inst_id=None,
    root_proc_inst_id="parent_process.1",
    execution_scope=None,
)
parent_inst.model_dump = lambda: parent_inst.__dict__

submitted_workitem = {
    "id": "wi-a",
    "status": "SUBMITTED",
    "activity_id": "A",
    "activity_name": "A",
    "proc_def_id": "parent_process",
    "proc_inst_id": "parent_process.1",
    "tenant_id": "localhost",
    "assignees": role_bindings,
    "user_id": "requester@example.com",
    "retry": 0,
    "output": {},
}

inserted_instances = []
upserted_workitems = []
polling_trace = []

def fetch_process_instance(proc_inst_id, tenant_id=None):
    if proc_inst_id == "parent_process.1":
        return parent_inst
    return None

def deterministic_handle_workitem(workitem):
    polling_trace.append({"handler": "handle_workitem", "workitem": workitem["id"]})
    process_result_json = {
        "instanceId": workitem["proc_inst_id"],
        "instanceName": "Parent.1",
        "processDefinitionId": workitem["proc_def_id"],
        "fieldMappings": [],
        "roleBindings": workitem["assignees"],
        "completedActivities": [
            {"completedActivityId": workitem["activity_id"], "completedUserEmail": workitem["user_id"], "result": "DONE"}
        ],
        "nextActivities": [
            {
                "nextActivityId": "call_child",
                "nextActivityName": "Call child",
                "nextUserEmail": workitem["user_id"],
                "result": "IN_PROGRESS",
                "type": "CallActivity"
            }
        ],
        "cancelledActivities": []
    }
    wiproc.execute_next_activity(process_result_json, workitem["tenant_id"])

async def async_handle_workitem(workitem):
    deterministic_handle_workitem(workitem)

wiproc.fetch_process_instance = fetch_process_instance
wiproc.fetch_process_definition_by_version = lambda def_id, *_args, **_kwargs: child_json if def_id == "child_process" else parent_json
wiproc.insert_process_instance = lambda data, tenant_id=None: inserted_instances.append(data)
wiproc.upsert_workitem = lambda data, tenant_id=None: upserted_workitems.append(data)
wiproc.upsert_chat_message = lambda *_args, **_kwargs: None
wiproc.check_external_customer_and_send_email = lambda *_args, **_kwargs: None
wiproc._execute_script_tasks = lambda *_args, **_kwargs: None
wiproc._persist_process_data = lambda *_args, **_kwargs: None
wiproc._register_event = lambda *_args, **_kwargs: None
wiproc._check_service_tasks = lambda *_args, **_kwargs: None
wiproc._progress_parent_if_all_children_completed = lambda *_args, **_kwargs: None

polling.fetch_workitem_with_submitted_status = lambda: [submitted_workitem]
polling.fetch_workitem_with_pending_status = lambda: []
polling.fetch_process_definition_by_version = lambda *_args, **_kwargs: parent_json
polling.fetch_process_instance = fetch_process_instance
polling.upsert_workitem = lambda data, tenant_id=None: upserted_workitems.append(data)
polling.handle_workitem = async_handle_workitem
polling.handle_pending_workitem = lambda *_args, **_kwargs: None
polling.shutdown_event.clear()
polling.running_tasks.clear()

asyncio.run(polling.polling_workitem())

print(json.dumps({
    "pollingTrace": polling_trace,
    "parentCurrentActivityIds": parent_inst.current_activity_ids,
    "insertedInstances": inserted_instances,
    "upsertedWorkitems": upserted_workitems
}, ensure_ascii=False))
`);

        expect(payload.pollingTrace).toEqual([{ handler: 'handle_workitem', workitem: 'wi-a' }]);
        expect(payload.parentCurrentActivityIds).toContain('call_child');
        expect(payload.insertedInstances).toHaveLength(1);
        expect(payload.insertedInstances[0]).toMatchObject({
            proc_def_id: 'child_process',
            parent_proc_inst_id: 'parent_process.1',
            root_proc_inst_id: 'parent_process.1',
            status: 'NEW'
        });
        expect(payload.upsertedWorkitems).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'wi-a',
                    log: expect.any(String)
                }),
                expect.objectContaining({
                    proc_inst_id: 'parent_process.1',
                    proc_def_id: 'parent_process',
                    activity_id: 'call_child',
                    activity_name: 'Call child',
                    status: 'PENDING',
                    root_proc_inst_id: 'parent_process.1',
                    assignees: [{ name: 'child_worker', endpoint: 'requester@example.com' }]
                }),
                expect.objectContaining({
                    proc_inst_id: expect.stringMatching(/^child_process\./),
                    proc_def_id: 'child_process',
                    activity_id: 'child_start',
                    status: 'SUBMITTED'
                }),
                expect.objectContaining({
                    id: 'wi-a',
                    consumer: null
                })
            ])
        );
    });

    test('Supabase schema accepts CallActivity parent-child execution rows', async () => {
        const supabase = requireDbE2e();
        const suffix = randomUUID().slice(0, 8);
        const tenantId = process.env.CALL_ACTIVITY_DB_E2E_TENANT || 'process-gpt';
        const parentDefId = `codex_call_parent_${suffix}`;
        const childDefId = `codex_call_child_${suffix}`;
        const parentInstId = `${parentDefId}.1`;
        const childInstId = `${childDefId}.1`;
        const parentWorkitemId = randomUUID();
        const childWorkitemId = randomUUID();

        const parentDefinition = {
            processDefinitionName: 'Codex CallActivity DB Parent',
            processDefinitionId: parentDefId,
            roles: [{ name: 'requester' }, { name: 'child_worker' }],
            activities: [
                { id: 'A', name: 'A', type: 'userTask', role: 'requester', description: '' },
                {
                    id: 'call_child',
                    name: 'Call child',
                    type: 'CallActivity',
                    role: 'requester',
                    description: '',
                    properties: JSON.stringify({
                        definitionId: childDefId,
                        roleBindings: [{ sourceRole: 'requester', targetRole: 'child_worker' }]
                    })
                }
            ],
            events: [{ id: 'start', type: 'startEvent' }, { id: 'end', type: 'endEvent' }],
            gateways: [],
            sequences: [
                { id: 'flow_start_a', source: 'start', target: 'A' },
                { id: 'flow_a_call', source: 'A', target: 'call_child' },
                { id: 'flow_call_end', source: 'call_child', target: 'end' }
            ],
            subProcesses: []
        };
        const childDefinition = {
            processDefinitionName: 'Codex CallActivity DB Child',
            processDefinitionId: childDefId,
            roles: [{ name: 'child_worker' }],
            activities: [{ id: 'X', name: 'Child task', type: 'userTask', role: 'child_worker', description: '' }],
            events: [{ id: 'child_start', type: 'startEvent' }, { id: 'child_end', type: 'endEvent' }],
            gateways: [],
            sequences: [
                { id: 'flow_child_start_x', source: 'child_start', target: 'X' },
                { id: 'flow_x_child_end', source: 'X', target: 'child_end' }
            ],
            subProcesses: []
        };

        try {
            await expectNoSupabaseError(
                supabase.from('tenants').upsert({ id: tenantId }, { onConflict: 'id' })
            );
            await expectNoSupabaseError(
                supabase.from('proc_def').upsert([
                    {
                        id: parentDefId,
                        name: 'Codex CallActivity DB Parent',
                        tenant_id: tenantId,
                        definition: parentDefinition,
                        bpmn: '<bpmn:callActivity id="call_child" />',
                        isdeleted: false,
                        type: 'process'
                    },
                    {
                        id: childDefId,
                        name: 'Codex CallActivity DB Child',
                        tenant_id: tenantId,
                        definition: childDefinition,
                        bpmn: '<bpmn:userTask id="X" />',
                        isdeleted: false,
                        type: 'process'
                    }
                ])
            );
            await expectNoSupabaseError(
                supabase.from('bpm_proc_inst').upsert([
                    {
                        proc_inst_id: parentInstId,
                        proc_inst_name: 'Codex CallActivity DB Parent.1',
                        proc_def_id: parentDefId,
                        tenant_id: tenantId,
                        current_activity_ids: ['call_child'],
                        participants: ['requester@example.com'],
                        role_bindings: [{ name: 'requester', endpoint: 'requester@example.com' }],
                        variables_data: {},
                        status: 'RUNNING',
                        root_proc_inst_id: parentInstId,
                        parent_proc_inst_id: null
                    },
                    {
                        proc_inst_id: childInstId,
                        proc_inst_name: 'Codex CallActivity DB Child.1',
                        proc_def_id: childDefId,
                        tenant_id: tenantId,
                        current_activity_ids: ['child_start'],
                        participants: ['requester@example.com'],
                        role_bindings: [{ name: 'child_worker', endpoint: 'requester@example.com' }],
                        variables_data: {},
                        status: 'NEW',
                        root_proc_inst_id: parentInstId,
                        parent_proc_inst_id: parentInstId
                    }
                ])
            );
            await expectNoSupabaseError(
                supabase.from('todolist').upsert([
                    {
                        id: parentWorkitemId,
                        proc_inst_id: parentInstId,
                        root_proc_inst_id: parentInstId,
                        proc_def_id: parentDefId,
                        activity_id: 'call_child',
                        activity_name: 'Call child',
                        status: 'PENDING',
                        tenant_id: tenantId,
                        user_id: 'requester@example.com',
                        username: 'requester@example.com',
                        assignees: [{ name: 'child_worker', endpoint: 'requester@example.com' }],
                        output: {},
                        retry: 0
                    },
                    {
                        id: childWorkitemId,
                        proc_inst_id: childInstId,
                        root_proc_inst_id: parentInstId,
                        proc_def_id: childDefId,
                        activity_id: 'child_start',
                        activity_name: 'Child start',
                        status: 'SUBMITTED',
                        tenant_id: tenantId,
                        user_id: 'requester@example.com',
                        username: 'requester@example.com',
                        assignees: [{ name: 'child_worker', endpoint: 'requester@example.com' }],
                        output: {},
                        retry: 0
                    }
                ])
            );

            const childInstance = await expectNoSupabaseError(
                supabase
                    .from('bpm_proc_inst')
                    .select('proc_inst_id, proc_def_id, parent_proc_inst_id, root_proc_inst_id, role_bindings, current_activity_ids, status')
                    .eq('proc_inst_id', childInstId)
                    .eq('tenant_id', tenantId)
                    .single()
            );
            expect(childInstance).toMatchObject({
                proc_inst_id: childInstId,
                proc_def_id: childDefId,
                parent_proc_inst_id: parentInstId,
                root_proc_inst_id: parentInstId,
                status: 'NEW',
                current_activity_ids: ['child_start'],
                role_bindings: [{ name: 'child_worker', endpoint: 'requester@example.com' }]
            });

            const childWorkitem = await expectNoSupabaseError(
                supabase
                    .from('todolist')
                    .select('id, proc_inst_id, root_proc_inst_id, proc_def_id, activity_id, status, assignees')
                    .eq('id', childWorkitemId)
                    .eq('tenant_id', tenantId)
                    .single()
            );
            expect(childWorkitem).toMatchObject({
                id: childWorkitemId,
                proc_inst_id: childInstId,
                root_proc_inst_id: parentInstId,
                proc_def_id: childDefId,
                activity_id: 'child_start',
                status: 'SUBMITTED',
                assignees: [{ name: 'child_worker', endpoint: 'requester@example.com' }]
            });

            const parentWorkitem = await expectNoSupabaseError(
                supabase
                    .from('todolist')
                    .select('id, proc_inst_id, root_proc_inst_id, proc_def_id, activity_id, activity_name, status, assignees')
                    .eq('id', parentWorkitemId)
                    .eq('tenant_id', tenantId)
                    .single()
            );
            expect(parentWorkitem).toMatchObject({
                id: parentWorkitemId,
                proc_inst_id: parentInstId,
                root_proc_inst_id: parentInstId,
                proc_def_id: parentDefId,
                activity_id: 'call_child',
                activity_name: 'Call child',
                status: 'PENDING',
                assignees: [{ name: 'child_worker', endpoint: 'requester@example.com' }]
            });
        } finally {
            await supabase.from('todolist').delete().in('id', [childWorkitemId, parentWorkitemId]).eq('tenant_id', tenantId);
            await supabase.from('bpm_proc_inst').delete().in('proc_inst_id', [childInstId, parentInstId]).eq('tenant_id', tenantId);
            await supabase.from('proc_def').delete().in('id', [childDefId, parentDefId]).eq('tenant_id', tenantId);
        }
    });
});
