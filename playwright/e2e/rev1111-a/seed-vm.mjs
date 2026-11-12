/**
 * rev1111-a 시험 데이터 — VM(튜토리얼 설치본) DB 에 「전달받은 산출물」을 보여 줄 업무 하나를 만들고 지운다.
 *
 * 운영에서 본 모양(2026-11-11 녹화 t098 · t106 · t211)을 그대로 만든다.
 *   - 앞 단계(제안서 검토) 폼: 자유입력 행 + 예전 편집기가 alias 없이 넣은 text-field-2 · boolean-field-3
 *   - 앞 단계 산출물: 줄 머리("적합한 점:")와 글머리 · 번호 목록이 섞인 글, 예/아니오 값은 문자열 "false"
 *   - 지금 단계(제안서 보완작성) 폼: 기본 자유입력 폼, 에이전트 초안이 이미 들어 있다(편집 단추가 보이는 읽기 화면)
 * 정의는 시연 데이터 「영업 제안서 승인」을 복사해 이름만 바꾼다(원본은 건드리지 않는다).
 *
 *   node playwright/e2e/rev1111-a/seed-vm.mjs seed | cleanup
 * SQL 은 RV_PSQL(기본: colima pgtut 의 supabase-db psql)로 보낸다.
 */
import { spawnSync } from 'node:child_process';

const SRC = 'cb456fd9_3c3a_47f7_83d6_dd5aa93e7191';
export const PD = 'rev1111a_handover_test';
export const INST = `${PD}.0b5e6a1c-1111-4a00-9a00-000000000001`;
export const TASK_ID = '0b5e6a1c-1111-4a00-9a00-0000000000a3';
const TASK1 = '0b5e6a1c-1111-4a00-9a00-0000000000a1';
const TASK2 = '0b5e6a1c-1111-4a00-9a00-0000000000a2';
const JANG = 'faaeb734-8fc4-4e36-963b-604867bed542';
const MINJI = '5b433460-21d5-45fd-9bfe-5f6f3d5c5dda';
const TENANT = 'localhost';

export const PREV_TEXT = [
    '검토 결과: 조건부 적합입니다.',
    '적합한 점:',
    '- 고객이 제시한 핵심 요구사항인 생산 현황 조회 지연 개선, 작업 실적 수집, 불량 이력 관리를 제안 범위에 반영했습니다.',
    '- 1개 생산라인 시범 적용으로 범위를 제한해 초기 도입 위험을 낮추는 방향이 타당합니다.',
    '- 요구사항 확인 후 데이터 항목과 화면을 합의하고 시범 운영한다는 추진 방식은 합리적입니다.',
    '보완이 필요한 사항:',
    '1. 설비 연동 방식, 연동 대상 설비, 수집 데이터 항목, 수집 주기와 오류 발생 시 처리 방안을 구체화해야 합니다.',
    '2. 작업 실적과 불량 이력의 입력 담당자, 승인 또는 검증 절차, 운영 시간 및 지원 체계를 명시해야 합니다.',
    '3. 생산 현황 조회 화면의 주요 지표와 사용자별 권한을 정의해야 합니다.',
    '4. 시범 운영의 성공 기준을 정량 또는 객관적으로 제시해야 합니다. 현재 자료만으로는 생산 현황 확인 시간 단축이나 데이터 누락 감소 목표를 확정할 근거가 없습니다.',
    '5. 요구사항 확정 후 별도 협의로 남겨둔 견적과 구축 일정은 현재 자료에 구체적인 근거가 없으므로 임의의 금액이나 기간을 제시하지 말고, 2026년 10월 23일 요구사항 미팅에서 확정할 항목과 산출물을 명시해야 합니다.',
    '6. 시범 적용 종료 후 평가, 운영 전환 여부, 추가 라인 확대 조건과 후속 지원 범위를 추가해야 합니다.',
    '권고 후속 조치:',
    '- 2026년 10월 23일 요구사항 미팅에서 설비 연동, 데이터 항목, 화면, 담당자, 운영 시간, 성공 기준을 확정합니다.',
    '- 확정된 요구사항을 기준으로 기능 범위, 산출물, 역할 분담, 일정, 견적을 별도 제안서에 반영합니다.',
    '- 위 항목 보완 전에는 최종 승인보다 보완작성 단계로 회부하는 것이 적절합니다.',
    '참고 근거: 이전 고객 요구사항과 제안서 초안을 대조했습니다. 제공된 지식 자료에서는 본 MES 제안의 가격, 구축 기간 또는 세부 평가 기준을 확인하지 못했으므로 해당 수치는 제시하지 않았습니다.',
    // 마크다운을 그대로 HTML 로 넣으면 실행되는 글 — 화면에서 걸러지는지 본다(정상이면 보이지도 실행되지도 않는다).
    '<img src="x" alt="" onerror="window.__rv1111aXss=1">'
].join('\n');

export const DRAFT_TEXT = [
    '보완 방향: 검토 의견 6건을 모두 반영합니다.',
    '반영 계획:',
    '1. 설비 연동 방식과 수집 주기를 부록 A에 정리합니다.',
    '2. 작업 실적 입력 담당자와 검증 절차를 4장에 추가합니다.',
    '3. 시범 운영 성공 기준(조회 시간 50% 단축)을 명시합니다.',
    '남은 확인 사항:',
    '- 견적과 일정은 10월 23일 미팅 뒤 확정합니다.'
].join('\n');

const FREE_ROW = (inner = '') =>
    `<row-layout name="free_input_section" alias="자유입력" is_multidata_mode="false" v-model="formValues" v-slot="slotProps"><div class="row"><div class="col-sm-12">      <textarea-field name="free_input" alias="자유입력" rows="5" disabled="false" readonly="false" v-model="slotProps.modelValue['free_input']"></textarea-field>    </div></div>${inner}</row-layout>`;

// 예전 편집기(KEditor)가 넣던 모양 — 이름은 '<태그>-<순번>', 보이는 이름(alias)은 비어 있다.
const REVIEW_FORM = `<section>  ${FREE_ROW(
    `<div class="row"><div class="col-sm-12"><text-field name="text-field-2" alias="" type="text" disabled="false" readonly="false" v-model="slotProps.modelValue['text-field-2']"></text-field></div></div><div class="row"><div class="col-sm-12"><boolean-field name="boolean-field-3" alias="" disabled="false" readonly="false" v-model="slotProps.modelValue['boolean-field-3']"></boolean-field></div></div>`
)}</section>`;
const FREE_FORM = `<section>  ${FREE_ROW()}</section>`;

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const j = (o) => `${q(JSON.stringify(o))}::jsonb`;

function psql(sql) {
    const cmd = (
        process.env.RV_PSQL || 'docker --context colima-pgtut exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -At'
    ).split(' ');
    const r = spawnSync(cmd[0], cmd.slice(1), { input: sql, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`psql 실패: ${r.stderr || r.stdout}`);
    return r.stdout.trim();
}

export function cleanup() {
    psql(`
        delete from events where todo_id in (${[TASK1, TASK2, TASK_ID].map(q).join(',')});
        delete from todolist where proc_inst_id = ${q(INST)} or id in (${[TASK1, TASK2, TASK_ID].map(q).join(',')});
        delete from bpm_proc_inst where proc_inst_id = ${q(INST)};
        delete from form_def where proc_def_id = ${q(PD)} and tenant_id = ${q(TENANT)};
        delete from proc_def_version where proc_def_id = ${q(PD)} and tenant_id = ${q(TENANT)};
        delete from proc_def where id = ${q(PD)} and tenant_id = ${q(TENANT)};
    `);
}

export function seed() {
    cleanup();
    const swap = `replace(%s, ${q(SRC)}, ${q(PD)})`;
    const fid = (task) => `${PD}_${task}_form`;
    const prevForm = {
        [fid('task2')]: { free_input: PREV_TEXT, 'text-field-2': 'MES 시범 도입 제안 v0.1 - 조건부 적합', 'boolean-field-3': 'false' }
    };
    psql(`
        begin;
        insert into proc_def (id, name, definition, bpmn, prod_version, tenant_id, owner, type)
        select ${q(PD)}, '[시험] 전달받은 산출물 표시',
               -- 지금 단계(task3)는 입력 데이터를 정하지 않는다 → 바로 앞 단계(task2) 폼 전체를 보여 준다(운영과 같은 경로)
               jsonb_set(${swap.replace('%s', 'definition::text')}::jsonb, '{activities}',
                   (select jsonb_agg(case when a->>'id' = 'task3' then jsonb_set(a, '{inputData}', '[]'::jsonb) else a end)
                      from jsonb_array_elements(${swap.replace('%s', 'definition::text')}::jsonb->'activities') a)),
               ${swap.replace('%s', 'bpmn')}, prod_version, tenant_id, owner, type
          from proc_def where id = ${q(SRC)} and tenant_id = ${q(TENANT)};
        insert into proc_def_version (arcv_id, proc_def_id, version, version_tag, snapshot, definition, "timeStamp", tenant_id)
        select ${q(PD)} || '_0.1', ${q(PD)}, version, version_tag, ${swap.replace('%s', 'snapshot')},
               (select definition from proc_def where id = ${q(PD)}), now(), tenant_id
          from proc_def_version where proc_def_id = ${q(SRC)} and tenant_id = ${q(TENANT)} limit 1;
        insert into form_def (html, proc_def_id, activity_id, tenant_id, id, fields_json)
        select html, ${q(PD)}, activity_id, tenant_id, ${q(fid('task1'))}, fields_json from form_def where id = ${q(`${SRC}_task1_form`)};
        insert into form_def (html, proc_def_id, activity_id, tenant_id, id, fields_json) values
          (${q(REVIEW_FORM)}, ${q(PD)}, 'task2', ${q(TENANT)}, ${q(fid('task2'))},
           ${j([
               { key: 'free_input', text: '자유입력', type: 'textarea', disabled: 'false', readonly: 'false' },
               { key: 'text-field-2', text: '', type: 'text', disabled: 'false', readonly: 'false' },
               { key: 'boolean-field-3', text: '', type: 'boolean', disabled: 'false', readonly: 'false' }
           ])}),
          (${q(FREE_FORM)}, ${q(PD)}, 'task3', ${q(TENANT)}, ${q(fid('task3'))},
           ${j([{ key: 'free_input', text: '자유입력', type: 'textarea', disabled: 'false', readonly: 'false' }])});
        insert into bpm_proc_inst (proc_def_id, proc_inst_id, proc_inst_name, root_proc_inst_id, current_activity_ids, participants,
                                   role_bindings, status, tenant_id, proc_def_version, version_tag, version, start_date, updated_at)
        select ${q(PD)}, ${q(INST)}, '[시험] 전달받은 산출물 표시', ${q(INST)}, array['task3'], array[${q(JANG)}, ${q(MINJI)}],
               role_bindings, 'RUNNING', tenant_id, ${q(PD + '_0.1')}, version_tag, version, now() - interval '1 hour', now()
          from bpm_proc_inst where proc_def_id = ${q(SRC)} and tenant_id = ${q(TENANT)} limit 1;
        insert into todolist (id, user_id, username, proc_inst_id, root_proc_inst_id, proc_def_id, version_tag, version, activity_id,
                              activity_name, start_date, end_date, status, tool, tenant_id, output, updated_at)
        values
          (${q(TASK1)}, ${q(JANG)}, '장진영', ${q(INST)}, ${q(INST)}, ${q(PD)}, 'minor', '0.1', 'task1', '요청사항 입력',
           now() - interval '50 minutes', now() - interval '45 minutes', 'DONE', ${q(`formHandler:${fid('task1')}`)}, ${q(TENANT)},
           ${j({ [fid('task1')]: { request_detail: '한빛제조 MES 시범 도입 제안을 검토해 주세요.' } })}, now()),
          (${q(TASK2)}, ${q(MINJI)}, '김민지', ${q(INST)}, ${q(INST)}, ${q(PD)}, 'minor', '0.1', 'task2', '제안서 검토 및 피드백',
           now() - interval '40 minutes', now() - interval '30 minutes', 'DONE', ${q(`formHandler:${fid('task2')}`)}, ${q(TENANT)},
           ${j(prevForm)}, now()),
          (${q(TASK_ID)}, ${q(JANG)}, '장진영', ${q(INST)}, ${q(INST)}, ${q(PD)}, 'minor', '0.1', 'task3', '제안서 보완작성',
           now() - interval '20 minutes', null, 'IN_PROGRESS', ${q(`formHandler:${fid('task3')}`)}, ${q(TENANT)},
           ${j({ [fid('task3')]: { free_input: DRAFT_TEXT } })}, now());
        commit;
    `);
    return { procDefId: PD, instId: INST, taskId: TASK_ID };
}

if (process.argv[1] && process.argv[1].endsWith('seed-vm.mjs')) {
    const what = process.argv[2];
    if (what === 'seed') console.log(JSON.stringify(seed()));
    else if (what === 'cleanup') {
        cleanup();
        console.log('cleaned');
    } else console.log('usage: seed-vm.mjs seed|cleanup');
}
