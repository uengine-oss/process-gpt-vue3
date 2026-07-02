import { expect, test } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import {
    createCustomGatewayBpmnXml,
    createExecutionDefinitionFromBpmnXml,
    createGatewayRegressionBpmnXml,
    coverageCases,
    customScenarios,
    scenarios
} from './gateway-regression-fixtures.cjs';

const executionRoot = process.env.EXECUTION_ROOT || 'D:\\uEngineProjectC\\processEsecution\\process-gpt-execution';

type Mode = 'ai' | 'deterministic';
const gatewayRegressionMode = process.env.GATEWAY_REGRESSION_MODE || 'all';
const includeAiTests = gatewayRegressionMode !== 'deterministic';

async function createDefinition(scenario: any) {
    return createExecutionDefinitionFromBpmnXml(createGatewayRegressionBpmnXml(scenario));
}

async function createCustomDefinition(scenario: any) {
    return createExecutionDefinitionFromBpmnXml(createCustomGatewayBpmnXml(scenario));
}

const scenariosById = new Map(scenarios.map((scenario: any) => [scenario.id, scenario]));
const customScenariosById = new Map(customScenarios.map((scenario: any) => [scenario.id, scenario]));

function mergeCoverageCase(base: any, coverageCase: any) {
    return {
        ...base,
        ...coverageCase,
        id: coverageCase.id,
        name: `${base.name} ${coverageCase.id}`,
        afterMerge: coverageCase.afterMerge || base.afterMerge
    };
}

function spawnPython(script: string, payload: unknown, mode: Mode) {
    const result = spawnSync('uv', ['run', 'python', '-c', script], {
        cwd: executionRoot,
        encoding: 'utf8',
        timeout: mode === 'ai' ? 180_000 : 60_000,
        env: {
            ...process.env,
            ENV: 'test',
            LLM_PROXY_URL: process.env.LLM_PROXY_URL || 'https://api.openai.com/v1',
            LLM_MODEL: process.env.LLM_MODEL || 'gpt-4o-mini',
            UV_CACHE_DIR: 'C:\\tmp\\uv-cache',
            UV_LINK_MODE: 'copy'
        },
        input: JSON.stringify(payload)
    });
    expect(result.status, result.stderr || result.stdout).toBe(0);
    const lastLine = result.stdout.trim().split(/\r?\n/).at(-1) || '{}';
    return JSON.parse(lastLine);
}

const commonPython = String.raw`
import asyncio
import importlib.util
import json
import pathlib
import sys
import types

root = pathlib.Path.cwd()
polling_root = root / "polling_service"
sys.path.insert(0, str(root))
sys.path.insert(0, str(polling_root))

def install_light_stubs():
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
wiproc.fetch_process_instance = lambda *_args, **_kwargs: None
wiproc.get_gateway_condition_data = lambda *_args, **_kwargs: None

request = json.loads(sys.stdin.read())
definition = request["definition"]
scenario = request["scenario"]
mode = request["mode"]
proc_def = load_process_definition(definition)

sequence_condition_data = {}
conditional_sequences = []
for seq in definition["sequences"]:
    props = json.loads(seq.get("properties") or "{}")
    if props.get("condition"):
        sequence_condition_data[seq["id"]] = {"condition": props["condition"], "name": seq["target"]}
        conditional_sequences.append(seq)

workitem = {
    "id": "wi-initial",
    "proc_inst_id": f"{definition['processDefinitionId']}.instance-1",
    "proc_def_id": definition["processDefinitionId"],
    "activity_id": "initial",
    "tenant_id": "localhost",
    "assignees": [{"name": "tester", "endpoint": "tester@example.com"}],
}
runtime_output = {
    "request_form": {
        "request_category": "proposal request",
        "request_detail": scenario.get("aiRequestDetail") or "The customer asks us to prepare a proposal for a new CRM workflow automation project.",
    }
}

async def evaluate_conditions():
    if mode == "ai":
        await wiproc._evaluate_sequence_conditions(
            wiproc.model,
            wiproc.parser,
            proc_def,
            runtime_output,
            {},
            sequence_condition_data,
            [],
            workitem=workitem,
        )
    else:
        targets = set(scenario.get("selectedBranches") or [])
        targets.update(scenario.get("nestedSelectedBranches") or [])
        targets.update((scenario.get("afterMerge") or {}).get("selectedBranches") or [])
        for seq in conditional_sequences:
            sequence_condition_data[seq["id"]]["conditionEval"] = seq["target"] in targets
`;

function runExecutionScenario(definition: unknown, scenario: any, mode: Mode) {
    const script = commonPython + String.raw`

async def main():
    await evaluate_conditions()
    branch_count = scenario["branchCount"]
    selected_branches = set(scenario.get("selectedBranches") or [])

    selected_payloads = wiproc.resolve_next_activity_payloads(proc_def, "initial", workitem, sequence_condition_data)
    selected_ids = [p.get("nextActivityId") for p in selected_payloads]

    done_branches = set(scenario.get("doneBranches") or selected_branches)
    branch_merged_workitems = []
    for i in range(1, branch_count + 1):
        aid = f"branch_{i}"
        status = "DONE" if aid in done_branches else "TODO"
        branch_merged_workitems.append({"activity_id": aid, "status": status})

    after_branch = {}
    for branch_id in selected_ids:
        merge_payloads = wiproc.resolve_next_activity_payloads(
            proc_def,
            branch_id,
            {**workitem, "activity_id": branch_id},
            sequence_condition_data,
        )
        filtered = await wiproc.check_task_status(merge_payloads, {
            "activity_id": branch_id,
            "sequences": proc_def.sequences,
            "gateways": proc_def.gateways,
            "branch_merged_workitems": branch_merged_workitems,
        })
        after_branch[branch_id] = {
            "resolved": [p.get("nextActivityId") for p in merge_payloads],
            "filtered": [p.get("nextActivityId") for p in filtered],
        }

    after_merge = []
    if scenario.get("afterMerge"):
        after_merge = [p.get("nextActivityId") for p in wiproc.resolve_next_activity_payloads(
            proc_def,
            "merge_task",
            {**workitem, "activity_id": "merge_task"},
            sequence_condition_data,
        )]

    print(json.dumps({
        "scenarioId": scenario["id"],
        "mode": mode,
        "conditionEval": sequence_condition_data,
        "selectedNextActivityIds": selected_ids,
        "expectedReachMerge": scenario.get("expectedReachMerge", True),
        "afterBranch": after_branch,
        "afterMergeNextActivityIds": after_merge,
    }, ensure_ascii=False))

asyncio.run(main())
`;
    const payload = spawnPython(script, { definition, scenario, mode }, mode);
    console.log(`[${mode}-${scenario.id}]`, JSON.stringify(payload, null, 2));
    return payload;
}

function runCustomExecutionScenario(definition: unknown, scenario: any, mode: Mode) {
    const script = commonPython + String.raw`

async def main():
    await evaluate_conditions()
    selected_payloads = wiproc.resolve_next_activity_payloads(proc_def, "initial", workitem, sequence_condition_data)
    selected_ids = [p.get("nextActivityId") for p in selected_payloads]
    result = {
        "scenarioId": scenario["id"],
        "mode": mode,
        "conditionEval": sequence_condition_data,
        "selectedNextActivityIds": selected_ids,
    }

    scenario_kind = scenario.get("baseScenarioId") or scenario["id"]

    if scenario_kind == "nested-branch-inclusive-direct-merge":
        nested_payloads = wiproc.resolve_next_activity_payloads(
            proc_def,
            selected_ids[0],
            {**workitem, "activity_id": selected_ids[0]},
            sequence_condition_data,
        )
        nested_ids = [p.get("nextActivityId") for p in nested_payloads]
        nested_workitems = [
            {"activity_id": "nested_branch_1", "status": "TODO"},
            {"activity_id": "nested_branch_2", "status": "DONE"},
            {"activity_id": "nested_branch_3", "status": "DONE"},
        ]
        nested_after = {}
        for nid in nested_ids:
            merge_payloads = wiproc.resolve_next_activity_payloads(
                proc_def,
                nid,
                {**workitem, "activity_id": nid},
                sequence_condition_data,
            )
            filtered = await wiproc.check_task_status(merge_payloads, {
                "activity_id": nid,
                "sequences": proc_def.sequences,
                "gateways": proc_def.gateways,
                "branch_merged_workitems": nested_workitems,
            })
            nested_after[nid] = {
                "resolved": [p.get("nextActivityId") for p in merge_payloads],
                "filtered": [p.get("nextActivityId") for p in filtered],
            }
        result["nestedNextActivityIds"] = nested_ids
        result["nestedAfterBranch"] = nested_after

    if scenario_kind == "inclusive-split-without-merge":
        after = {}
        for sid in selected_ids:
            end_payloads = wiproc.resolve_next_activity_payloads(
                proc_def,
                sid,
                {**workitem, "activity_id": sid},
                sequence_condition_data,
            )
            filtered = await wiproc.check_task_status(end_payloads, {
                "activity_id": sid,
                "sequences": proc_def.sequences,
                "gateways": proc_def.gateways,
                "branch_merged_workitems": [],
            })
            after[sid] = {
                "resolved": [p.get("nextActivityId") for p in end_payloads],
                "filtered": [p.get("nextActivityId") for p in filtered],
            }
        result["afterBranch"] = after

    print(json.dumps(result, ensure_ascii=False))

asyncio.run(main())
`;
    const payload = spawnPython(script, { definition, scenario, mode }, mode);
    console.log(`[${mode}-${scenario.id}]`, JSON.stringify(payload, null, 2));
    return payload;
}

function expectBranchCanReachMerge(payload: any) {
    for (const branchId of payload.selectedNextActivityIds) {
        expect(payload.afterBranch[branchId].resolved).toContain('merge_task');
        if (payload.expectedReachMerge === false) {
            expect(payload.afterBranch[branchId].filtered).not.toContain('merge_task');
        } else {
            expect(payload.afterBranch[branchId].filtered).toContain('merge_task');
        }
    }
}

function expectAfterMergeGateway(payload: any, scenario: any) {
    if (!scenario.afterMerge) return;
    expect(payload.afterMergeNextActivityIds.sort()).toEqual([...scenario.afterMerge.selectedBranches].sort());
}

test.describe('gateway branch regression matrix', () => {
    for (const scenario of scenarios) {
        test(`deterministic ${scenario.id}`, async () => {
            const definition = await createDefinition(scenario);
            const payload = runExecutionScenario(definition, scenario, 'deterministic');
            if (scenario.splitType !== 'parallel') {
                expect(payload.selectedNextActivityIds.sort()).toEqual([...scenario.selectedBranches].sort());
            }
            expectBranchCanReachMerge(payload);
            expectAfterMergeGateway(payload, scenario);
        });
    }

    if (includeAiTests) {
        for (const scenario of scenarios.filter((item) => item.splitType !== 'parallel')) {
            test(`AI ${scenario.id}`, async () => {
                const definition = await createDefinition(scenario);
                const payload = runExecutionScenario(definition, scenario, 'ai');
                for (const entry of Object.values(payload.conditionEval) as Array<Record<string, unknown>>) {
                    expect(entry).toHaveProperty('conditionEval');
                }
                expect(payload.selectedNextActivityIds.sort()).toEqual([...(scenario.aiExpectedBranches || scenario.selectedBranches)].sort());
                expectBranchCanReachMerge(payload);
                expectAfterMergeGateway(payload, scenario);
            });
        }
    }

    for (const scenario of customScenarios) {
        test(`deterministic ${scenario.id}`, async () => {
            const definition = await createCustomDefinition(scenario);
            const payload = runCustomExecutionScenario(definition, scenario, 'deterministic');
            expect(payload.selectedNextActivityIds.sort()).toEqual([...scenario.selectedBranches].sort());
            assertCustomPayload(payload, scenario);
        });

        if (includeAiTests) {
            test(`AI ${scenario.id}`, async () => {
                const definition = await createCustomDefinition(scenario);
                const payload = runCustomExecutionScenario(definition, scenario, 'ai');
                for (const entry of Object.values(payload.conditionEval) as Array<Record<string, unknown>>) {
                    expect(entry).toHaveProperty('conditionEval');
                }
                expect(payload.selectedNextActivityIds.sort()).toEqual([...(scenario.aiExpectedBranches || scenario.selectedBranches)].sort());
                assertCustomPayload(payload, scenario);
            });
        }
    }

    for (const coverageCase of coverageCases) {
        const modes = (coverageCase.modes || ['deterministic', 'ai'])
            .filter((mode: Mode) => includeAiTests || mode === 'deterministic');
        const base = coverageCase.custom
            ? customScenariosById.get(coverageCase.baseScenarioId)
            : scenariosById.get(coverageCase.baseScenarioId);
        if (!base) throw new Error(`Unknown coverage base scenario: ${coverageCase.baseScenarioId}`);
        const scenario = mergeCoverageCase(base, coverageCase);

        for (const mode of modes) {
            test(`${mode} coverage ${coverageCase.id}`, async () => {
                const definition = coverageCase.custom
                    ? await createCustomDefinition(base)
                    : await createDefinition(scenario);
                const payload = coverageCase.custom
                    ? runCustomExecutionScenario(definition, scenario, mode)
                    : runExecutionScenario(definition, scenario, mode);

                if (mode === 'ai') {
                    for (const entry of Object.values(payload.conditionEval) as Array<Record<string, unknown>>) {
                        expect(entry).toHaveProperty('conditionEval');
                    }
                }

                expect(payload.selectedNextActivityIds.sort()).toEqual([...(mode === 'ai' ? scenario.aiExpectedBranches : scenario.selectedBranches)].sort());
                if (coverageCase.custom) {
                    assertCustomPayload(payload, scenario);
                } else {
                    expectBranchCanReachMerge(payload);
                    expectAfterMergeGateway(payload, scenario);
                }
            });
        }
    }
});

function assertCustomPayload(payload: any, scenario: any) {
    const scenarioKind = scenario.baseScenarioId || scenario.id;
    if (scenarioKind === 'nested-branch-inclusive-direct-merge') {
        const expectedNested = payload.mode === 'ai' && scenario.aiNestedExpectedBranches
            ? scenario.aiNestedExpectedBranches
            : scenario.nestedSelectedBranches;
        expect(payload.nestedNextActivityIds.sort()).toEqual([...expectedNested].sort());
        for (const branchId of payload.nestedNextActivityIds) {
            expect(payload.nestedAfterBranch[branchId].resolved).toContain('nested_merge_task');
            expect(payload.nestedAfterBranch[branchId].filtered).toContain('nested_merge_task');
        }
    }
    if (scenarioKind === 'inclusive-split-without-merge') {
        for (const branchId of payload.selectedNextActivityIds) {
            expect(payload.afterBranch[branchId].resolved).toContain(`${branchId}_end`);
            expect(payload.afterBranch[branchId].filtered).toContain(`${branchId}_end`);
        }
    }
}
