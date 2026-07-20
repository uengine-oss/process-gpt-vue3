import { expect, test } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const executionRoot = process.env.EXECUTION_ROOT || 'D:\\uEngineProjectC\\processEsecution\\process-gpt-execution';
const executionPython =
    process.env.EXECUTION_PYTHON || 'C:\\Users\\m6023\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe';
const uvCacheDir = path.resolve(process.cwd(), '.tmp', 'uv-cache');

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

test.describe('ProcessGPT mapper backend execution', () => {
    test('polling handle_workitem executes persisted mapper without browser runtime', async () => {
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

def install_stubs():
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
    requests_mod.post = lambda *_args, **_kwargs: SimpleNamespace(json=lambda: {})
    sys.modules["requests"] = requests_mod

    database_mod = types.ModuleType("database")
    def noop(*_args, **_kwargs):
        return None
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
    class DummyProcessInstance:
        pass
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

install_stubs()

from process_definition import load_process_definition
spec = importlib.util.spec_from_file_location("wiproc", str(polling_root / "workitem_processor.py"))
wiproc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(wiproc)

process_json = {
    "processDefinitionName": "MapperProcess",
    "processDefinitionId": "mapper_process",
    "roles": [{"name": "requester", "default": "user@example.com"}],
    "activities": [
        {
            "id": "A",
            "name": "A",
            "type": "userTask",
            "description": "",
            "role": "requester",
            "properties": json.dumps({
                "eventSynchronization": {
                    "mappingContext": {
                        "mappingElements": [
                            {
                                "argument": {"text": "customerName"},
                                "direction": "out",
                                "variable": {"name": "name"}
                            },
                            {
                                "argument": {"text": "lane.approver.endpoint"},
                                "direction": "out",
                                "variable": {"name": "approverEmail"}
                            },
                            {
                                "argument": {"text": "forms.current.fullName"},
                                "direction": "out",
                                "transformerMapping": {
                                    "transformer": {
                                        "_type": "org.uengine.processdesigner.mapper.transformers.ConcatTransformer",
                                        "argumentSourceMap": {
                                            "str1": "firstName",
                                            "str2": "lastName"
                                        }
                                    },
                                    "linkedArgumentName": "fullName"
                                }
                            }
                        ]
                    }
                }
            })
        },
        {"id": "B", "name": "B", "type": "userTask", "description": "", "role": "approver"}
    ],
    "sequences": [{"id": "s1", "source": "A", "target": "B"}],
    "gateways": [],
    "subProcesses": []
}
process_definition = load_process_definition(process_json)

class ProcInst:
    def __init__(self):
        self.proc_inst_id = "mapper_process.1"
        self.proc_inst_name = "MapperProcess_1"
        self.current_activity_ids = ["A"]
        self.role_bindings = []
        self.participants = []
        self.variables_data = []
        self.status = "RUNNING"
        self.tenant_id = "tenant"
        self.parent_proc_inst_id = None
        self.process_definition = process_definition
    def model_dump(self):
        return {
            "proc_inst_id": self.proc_inst_id,
            "proc_inst_name": self.proc_inst_name,
            "current_activity_ids": self.current_activity_ids,
            "role_bindings": self.role_bindings,
            "participants": self.participants,
            "variables_data": self.variables_data,
            "status": self.status,
            "tenant_id": self.tenant_id,
            "execution_scope": None,
        }
    def get_def_id(self):
        return "mapper_process"

inst = ProcInst()
upserted_workitems = []
persisted = {}

wiproc.get_workitem_position = lambda _workitem: (False, False)
wiproc.fetch_process_definition_by_version = lambda *_args, **_kwargs: process_json
wiproc.fetch_process_instance = lambda *_args, **_kwargs: inst
wiproc.fetch_assignee_info = lambda user_id: {"name": "User", "email": user_id, "type": "user", "info": {}}
wiproc.fetch_ui_definition_by_activity_id = lambda *_args, **_kwargs: SimpleNamespace(id="formA")
wiproc.fetch_ui_definitions_by_def_id = lambda *_args, **_kwargs: []
wiproc.fetch_organization_chart = lambda *_args, **_kwargs: []
wiproc.get_sequence_condition_data = lambda *_args, **_kwargs: {}
wiproc.get_input_data = lambda *_args, **_kwargs: {}
wiproc.get_all_input_data = lambda *_args, **_kwargs: {}
async def noop_eval(*_args, **_kwargs):
    return None
wiproc._evaluate_sequence_conditions = noop_eval
wiproc.run_completed_determination = lambda completed_json, _chain_input: {
    **completed_json,
    "completedActivities": [{
        "completedActivityId": "A",
        "completedActivityName": "A",
        "completedUserEmail": "user@example.com",
        "type": "activity",
        "result": "DONE",
        "cannotProceedErrors": []
    }]
}
wiproc.resolve_next_activity_payloads = lambda *_args, **_kwargs: [{
    "nextActivityId": "B",
    "nextActivityName": "B",
    "nextUserEmail": "user@example.com",
    "type": "activity",
    "result": "TODO"
}]
wiproc.inject_boundary_events_as_next = lambda payloads, *_args, **_kwargs: payloads
async def identity(payloads, *_args, **_kwargs):
    return payloads
wiproc.check_event_expression = identity
wiproc.check_subprocess_expression = identity
wiproc.check_task_status = identity
wiproc.check_role_binding = identity
wiproc._handle_deploy_approval = lambda *_args, **_kwargs: None
wiproc.process_output = lambda *_args, **_kwargs: None
wiproc.upsert_workitem = lambda data, tenant_id=None: upserted_workitems.append(data)
wiproc._process_next_activities = lambda *_args, **_kwargs: None
wiproc._process_sub_processes = lambda *_args, **_kwargs: None
wiproc._execute_script_tasks = lambda *_args, **_kwargs: None
wiproc._register_event = lambda *_args, **_kwargs: None
wiproc._check_service_tasks = lambda *_args, **_kwargs: None
wiproc._progress_parent_if_all_children_completed = lambda *_args, **_kwargs: None
def persist_process_data(process_instance, process_result, process_result_json, process_definition, tenant_id=None):
    persisted["variables_data"] = process_instance.variables_data
    persisted["role_bindings"] = process_instance.role_bindings
    persisted["mapperResults"] = process_result_json.get("mapperResults")
wiproc._persist_process_data = persist_process_data

workitem = {
    "id": "wi-a",
    "activity_id": "A",
    "activity_name": "A",
    "proc_def_id": "mapper_process",
    "proc_inst_id": "mapper_process.1",
    "tenant_id": "tenant",
    "user_id": "user@example.com",
    "status": "SUBMITTED",
    "tool": "formHandler:formA",
    "assignees": [],
    "output": {
        "formA": {
            "name": "Jane Kim",
            "firstName": "Jane",
            "lastName": "Kim",
            "approverEmail": "approver@example.com"
        }
    },
    "retry": 0
}

asyncio.run(wiproc.handle_workitem(workitem))

print(json.dumps({
    "variablesData": persisted.get("variables_data"),
    "roleBindings": persisted.get("role_bindings"),
    "mapperResults": persisted.get("mapperResults"),
    "workitemOutput": upserted_workitems[0]["output"] if upserted_workitems else {},
}, ensure_ascii=False))
`);

        expect(payload.variablesData).toMatchObject({ customerName: 'Jane Kim' });
        expect(payload.roleBindings).toEqual(expect.arrayContaining([{ name: 'approver', endpoint: 'approver@example.com' }]));
        expect(payload.mapperResults.role_bindings).toEqual([{ name: 'approver', endpoint: 'approver@example.com' }]);
        expect(payload.mapperResults.trace).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ target: 'customerName', status: 'mapped', scope: 'variables_data' }),
                expect.objectContaining({ target: 'lane.approver.endpoint', status: 'mapped', scope: 'role_bindings' }),
                expect.objectContaining({ target: 'forms.current.fullName', status: 'mapped', scope: 'forms.formA' })
            ])
        );
        expect(payload.workitemOutput.formA).toMatchObject({
            name: 'Jane Kim',
            firstName: 'Jane',
            lastName: 'Kim',
            fullName: 'JaneKim'
        });
        expect(payload.workitemOutput.__mapped).toMatchObject({ customerName: 'Jane Kim' });
    });
});
