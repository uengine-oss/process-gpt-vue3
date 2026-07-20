import axios from '@/utils/axios';
import StorageBaseFactory from '@/utils/StorageBaseFactory';
const storage = StorageBaseFactory.getStorage();
import type { Backend } from './Backend';
import defaultProcessesData from './defaultProcesses.json';
import { useDefaultSetting } from '@/stores/defaultSetting';
import { runValidation } from '@/utils/bpmnValidationRules';
import { businessRuleToDmnXml, dmnXmlToBusinessRule } from '@/utils/businessRuleDmn';

import { formatDistanceToNowStrict } from 'date-fns';

enum ErrorCode {
    TableNotFound = '42P01'
}

class ProcessGPTBackend implements Backend {
    private hasWarnedMissingElementCommentCountView = false;

    // =========================
    // Business Rule raw-definition mock store (ProcessGPT 모드)
    // - uEngine 서버의 /definition/raw 저장 규약을 흉내내기 위해 localStorage를 사용한다.
    // - key: "business-rules/<id>" (확장자 없이 저장)
    // - value: JSON string
    // =========================
    __brRawStorageKey() {
        return 'processgpt_raw_definition_business_rules_v1';
    }
    __loadBrRawMap(): Record<string, string> {
        try {
            const raw = localStorage.getItem(this.__brRawStorageKey());
            const parsed = raw ? JSON.parse(raw) : {};
            return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
        } catch (e) {
            return {};
        }
    }
    __saveBrRawMap(map: Record<string, string>) {
        try {
            localStorage.setItem(this.__brRawStorageKey(), JSON.stringify(map || {}));
        } catch (e) {
            // ignore
        }
    }

    __testRawStorageKey() {
        return 'processgpt_test_raw_definition_v1';
    }
    __loadTestRawMap(): Record<string, string> {
        try {
            const raw = localStorage.getItem(this.__testRawStorageKey());
            const parsed = raw ? JSON.parse(raw) : {};
            return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
        } catch (e) {
            return {};
        }
    }
    __saveTestRawMap(map: Record<string, string>) {
        try {
            localStorage.setItem(this.__testRawStorageKey(), JSON.stringify(map || {}));
        } catch (e) {
            // ignore
        }
    }

    async deleteTest(_path: string, _tracingTag: string, _index: number): Promise<void> {
        const map = this.__loadTestRawMap();
        const key = String(_path || '').replace(/\.unit$/i, '');
        const raw = map[key];
        if (!raw) return;

        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const entries = Object.entries(parsed || {});
        const target = entries[_index];
        if (target) {
            delete parsed[target[0]];
            map[key] = JSON.stringify(parsed);
            this.__saveTestRawMap(map);
        }
    }

    async deleteRecordTest(path: string, index: number): Promise<void> {
        await this.deleteTest(`${path}/record`, '', index);
    }

    async releaseVersion(releaseName: string): Promise<any> {}

    async testList(_path: string): Promise<any> {
        const map = this.__loadTestRawMap();
        const prefix = String(_path || '').replace(/\/+$/g, '');
        return Object.entries(map)
            .filter(([key]) => key.startsWith(prefix))
            .map(([key, value]) => {
                const name = key.slice(prefix.length).replace(/^\/+/, '').split('/')[0];
                return {
                    name: name || key,
                    path: key,
                    directory: false,
                    definition: value
                };
            });
    }

    async testRecordList(_path: string): Promise<any> {
        return this.testList(`${_path}/record`);
    }

    async findCurrentWorkItemByInstId(_instId: string): Promise<any> {
        console.warn(`[ProcessGPT] findCurrentWorkItemByInstId은 ProcessGPT 모드에서 지원되지 않습니다.`);
        return null as any;
    }

    async checkDBConnection() {
        if (await storage.isConnection()) return true;
        return false;
    }

    async listDefinition(path: string, options?: any) {
        try {
            // 프로세스 정보, 폼 정보를 각각 불러와서 파일명을 포함해서 가공하기 위해서
            if (path == 'form_def') {
                if (options && options.match) {
                    options.match.tenant_id = window.$tenantName;
                } else {
                    options = {
                        match: {
                            tenant_id: window.$tenantName
                        }
                    };
                }
                const formDefs = await storage.list('form_def', options);
                formDefs.map((item: any) => {
                    item.path = item.id;
                    item.name = item.name || item.path;
                    item.fieldsJson = item.fields_json || {};
                    item.html = item.html || '';
                    item.procDefId = item.proc_def_id || '';
                    item.activityId = item.activity_id || '';
                });
                return formDefs;
            } else if (path === 'dmn') {
                // dmn 타입인 경우 기본적으로 type="dmn" 필터 추가
                if (!options) {
                    options = { match: { type: 'dmn' } };
                } else if (!options.match) {
                    options.match = { type: 'dmn' };
                } else {
                    options.match.type = 'dmn';
                }
                const procDefs = await storage.list('proc_def', options);
                return procDefs;
            } else {
                if (options) {
                    options.match = { isdeleted: false };
                    if (path) {
                        options.like = `${path}%`;
                    }
                }
                const procDefs = await storage.list('proc_def', options);
                // 임시저장(draft, is_draft=true) 프로세스는 목록에서 제외 (기존 null/false 는 유지).
                const visibleDefs = (procDefs || []).filter((item: any) => item && item.is_draft !== true);
                visibleDefs.map((item: any) => {
                    if (item.type && item.type === 'dmn') {
                        item.path = `${item.id}.dmn`;
                    } else {
                        item.path = `${item.id}.bpmn`;
                    }
                    item.name = item.name || item.id;
                });
                return visibleDefs;
            }
        } catch (e) {
            //@ts-ignore
            throw new Error(e.message);
        }
    }

    /**
     * 임시저장(draft) 프로세스를 completion 의 실행 엔진으로 검증 + LLM 자동개선한다.
     * completion 이 draft proc_def 를 id 로 로드 → 정적/실행 검증 → 매 개선마다 proc_def.definition UPDATE.
     * 반환: { passed, iterations, repaired, remaining_defects, final_definition }
     */
    async validateAndImproveDraft(
        defId: string,
        opts: { processName?: string; forms?: any; maxIters?: number; email?: string; userUid?: string } = {}
    ) {
        const input: any = { process_definition_id: String(defId || '').replace(/\.bpmn$/i, '') };
        if (opts.processName) input.process_name = opts.processName;
        if (opts.forms) input.forms = opts.forms;
        if (opts.maxIters) input.max_iters = opts.maxIters;
        if (opts.email) input.email = opts.email;
        if (opts.userUid) input.user_uid = opts.userUid;
        const response = await axios.post(
            '/validate-and-improve',
            { input },
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 0
            }
        );
        return response.data;
    }

    /** draft(임시저장) proc_def 행을 삭제한다(방 단위 재생성 시 이전 draft 정리). */
    async deleteDraftProcDef(defId: string) {
        const id = String(defId || '')
            .toLowerCase()
            .replace(/\.bpmn$/i, '');
        if (!id) return;
        try {
            await storage.delete('proc_def', { match: { id, tenant_id: window.$tenantName } });
        } catch (e) {
            /* best-effort cleanup */
        }
    }

    async listVersionDefinitions(_version: string, _basePath: string) {
        console.warn(`[ProcessGPT] listVersionDefinitions은 ProcessGPT 모드에서 지원되지 않습니다.`);
        return null as any;
    }

    async listVersions() {
        console.warn(`[ProcessGPT] listVersions은 ProcessGPT 모드에서 지원되지 않습니다.`);
        return null as any;
    }

    async deleteDefinition(defId: string, options: any) {
        try {
            if (defId.includes('.bpmn')) defId = defId.replace('.bpmn', '');

            if (options && options.type === 'form') {
                return await storage.delete(`form_def/${defId.replace(/\//g, '#')}`, { key: 'id' });
            } else {
                const form = await storage.list('form_def', {
                    sort: 'desc',
                    match: { proc_def_id: defId }
                });
                if (form && form.length > 0) {
                    await storage.delete(`form_def/${defId}`, { key: 'proc_def_id' });
                }

                const arcv = await storage.list('proc_def_version', {
                    sort: 'desc',
                    orderBy: 'timeStamp',
                    match: { proc_def_id: defId }
                });
                if (arcv && arcv.length > 0) {
                    await storage.delete(`proc_def_version/${defId}`, { key: 'proc_def_id' });
                }

                const isLocked = await storage.getObject(`lock/${defId}`, { key: 'id' });
                if (isLocked) {
                    await storage.delete(`lock/${defId}`, { key: 'id' });
                }

                await Promise.all([
                    await storage.delete('todolist', { match: { proc_def_id: defId } }),
                    await storage.delete('bpm_proc_inst', { match: { proc_def_id: defId } })
                ]);

                return await storage.delete(`proc_def/${defId}`, { key: 'id' });

                // var procDef: any = await storage.getObject('proc_def', {
                //     match: {
                //         id: defId,
                //     }
                // });
                // if (procDef) {
                //     procDef.isdeleted = true;
                //     await storage.putObject('proc_def', procDef, { onConflict: 'id,tenant_id' });
                // }
            }
        } catch (e) {
            //@ts-ignore
            throw new Error(e.message);
        }
    }

    async restoreDefinition(defId: string, options: any) {
        try {
            if (defId.includes('.bpmn')) defId = defId.replace('.bpmn', '');

            const procDef: any = await storage.getObject('proc_def', {
                match: {
                    id: defId
                }
            });
            if (procDef) {
                procDef.isdeleted = false;
                return await storage.putObject('proc_def', procDef, { onConflict: 'id,tenant_id' });
            }
        } catch (e) {
            throw new Error(e.message);
        }
    }

    async putRawDefinition(xml: any, defId: string, options: any) {
        try {
            // Business Rule (raw-definition mock)
            if (options && options.type === 'rule') {
                const map = this.__loadBrRawMap();
                const key = String(defId || '');
                const val = typeof xml === 'string' ? xml : JSON.stringify(xml);
                map[key] = val;
                this.__saveBrRawMap(map);
                return;
            }

            if (options && options.type === 'unit') {
                const map = this.__loadTestRawMap();
                const key = String(defId || '').replace(/\.unit$/i, '');
                map[key] = typeof xml === 'string' ? xml : JSON.stringify(xml);
                this.__saveTestRawMap(map);
                return;
            }

            if (options && options.type === 'json') {
                const map = this.__loadTestRawMap();
                const key = String(defId || '').replace(/\.json$/i, '');
                map[key] = typeof xml === 'string' ? xml : JSON.stringify(xml);
                this.__saveTestRawMap(map);
                return;
            }

            // 폼 정보를 저장하기 위해서
            if (options && options.type === 'form') {
                const fieldsJson = this.extractFields(xml);
                if (!fieldsJson) {
                    throw new Error('An error occurred while analyzing the form fields.');
                }

                if (defId === 'defaultform') {
                    const existingDefaultForm: any = await storage.getObject('form_def', {
                        match: {
                            id: defId,
                            tenant_id: window.$tenantName
                        }
                    });

                    await storage.putObject('form_def', {
                        uuid: existingDefaultForm?.uuid,
                        id: defId,
                        html: xml,
                        proc_def_id: 'proc_defaultform', // Not Null 조건 호환성 유지
                        activity_id: 'activity_defaultform', // Not Null 조건 호환성 유지
                        fields_json: fieldsJson,
                        tenant_id: window.$tenantName
                    });
                    return;
                }

                // 먼저 proc_def_id, activity_id로 조회
                let formDef: any = await storage.getObject('form_def', {
                    match: {
                        proc_def_id: options.proc_def_id,
                        activity_id: options.activity_id,
                        tenant_id: window.$tenantName
                    }
                });

                let putObj: any = {};
                let formId = defId.replace(/\//g, '#');
                if (!formId || formId == 'defaultform' || formId == '') {
                    formId = `${options.proc_def_id}_${options.activity_id?.toLowerCase()}_form`;
                }

                // formDef가 없으면 id로 한번 더 조회 (unique constraint: id, tenant_id)
                if (!formDef) {
                    formDef = await storage.getObject('form_def', {
                        match: {
                            id: formId,
                            tenant_id: window.$tenantName
                        }
                    });
                }

                if (formDef) {
                    putObj = {
                        uuid: formDef.uuid,
                        id: formDef.id || formId,
                        html: xml,
                        proc_def_id: formDef.proc_def_id || options.proc_def_id,
                        activity_id: formDef.activity_id || options.activity_id,
                        fields_json: fieldsJson,
                        tenant_id: formDef.tenant_id
                    };
                } else {
                    putObj = {
                        id: formId,
                        html: xml,
                        proc_def_id: options.proc_def_id,
                        activity_id: options.activity_id,
                        fields_json: fieldsJson,
                        tenant_id: window.$tenantName
                    };
                }
                await storage.putObject('form_def', putObj);
                return;
            }

            let procDef: any = await storage.getObject('proc_def', {
                match: {
                    id: defId
                }
            });

            if (procDef) {
                procDef.bpmn = xml;
                // name이 유효한 경우에만 업데이트 (null로 덮어쓰기 방지)
                if (options.name) procDef.name = options.name;
                if (options.owner) procDef.owner = options.owner;
                if (Object.prototype.hasOwnProperty.call(options, 'agent_id')) procDef.agent_id = options.agent_id;
                if (options.type) procDef.type = options.type;
                // 기존 정의도 함께 갱신되어야 activity.tool 변경이 proc_def.definition에 반영됨
                if (Object.prototype.hasOwnProperty.call(options, 'definition')) {
                    procDef.definition = options.definition;
                }
                // 임시저장(draft) 플래그 — true 면 프로세스 목록/맵에서 숨기고, 최종 저장 시 false 로 승격.
                if (Object.prototype.hasOwnProperty.call(options, 'is_draft')) {
                    procDef.is_draft = !!options.is_draft;
                }
            } else {
                // 신규 프로세스: 초기 bpmn/definition 포함하여 생성
                const currentOwner = options.owner || localStorage.getItem('uid') || null;
                procDef = {
                    id: defId,
                    name: options.name,
                    bpmn: xml,
                    definition: options.definition || null,
                    owner: currentOwner,
                    agent_id: options.agent_id || null,
                    type: options.type || 'bpmn'
                };
                if (Object.prototype.hasOwnProperty.call(options, 'is_draft')) {
                    procDef.is_draft = !!options.is_draft;
                }
            }
            await storage.putObject('proc_def', procDef, { onConflict: 'id,tenant_id' });

            if (options.version) {
                let saveVersion = options.version;
                let saveArcvId = options.arcv_id || `${defId}_${saveVersion}`;
                let existingUuid: string | null = null;

                // 동일 arcv_id가 이미 존재하는지 확인
                try {
                    const existingVersion = await storage.getObject('proc_def_version', {
                        match: { arcv_id: saveArcvId }
                    });
                    if (existingVersion) {
                        if (existingVersion.version_tag === 'published') {
                            // published 버전은 불변 보호 - minor 자동 증가
                            const parts = String(saveVersion).split('.');
                            const major = parseInt(parts[0]) || 0;
                            const minor = (parseInt(parts[1]) || 0) + 1;
                            saveVersion = `${major}.${minor}`;
                            saveArcvId = `${defId}_${saveVersion}`;
                            // 증가된 버전도 이미 존재하면 uuid 보존
                            try {
                                const bumpedVersion = await storage.getObject('proc_def_version', {
                                    match: { arcv_id: saveArcvId }
                                });
                                if (bumpedVersion && bumpedVersion.version_tag !== 'published') {
                                    existingUuid = bumpedVersion.uuid;
                                }
                            } catch (e) {
                                /* ignore */
                            }
                        } else {
                            // 기존 행 업데이트를 위해 uuid 보존 (PK가 uuid이므로 upsert에 필요)
                            existingUuid = existingVersion.uuid;
                        }
                    }
                } catch (e) {
                    // 기존 버전 조회 실패 시 그대로 진행
                }

                const procDefVersion: any = {
                    arcv_id: saveArcvId,
                    proc_def_id: defId,
                    version: saveVersion,
                    version_tag: options.version_tag,
                    timeStamp: new Date().toISOString(),
                    snapshot: xml,
                    definition: options.definition ?? procDef.definition,
                    diff: options.diff,
                    message: options.message
                };
                // 컴포넌트 업데이트(import update 모드) 시 이전 설치 버전을 부모로 연결.
                if (options.parent_version) {
                    procDefVersion.parent_version = options.parent_version;
                }
                // 기존 행이 있으면 uuid를 포함하여 UPDATE로 동작하게 함
                if (existingUuid) {
                    procDefVersion.uuid = existingUuid;
                }
                // agent_knowledge_history.id를 proc_def_version.uuid로 설정
                if (options.history_id) {
                    procDefVersion.uuid = options.history_id;
                }
                await storage.putObject('proc_def_version', procDefVersion);
            }

            const isLocked = await storage.getObject(`lock/${defId}`, { key: 'id' });
            if (isLocked) {
                await storage.delete(`lock/${defId}`, { key: 'id' });
            }

            const content = `${options.name}: ${JSON.stringify(options.definition)}`;
            this.updateVectorStore(content, 'process_definition');
        } catch (e) {
            throw new Error('error when to save definition: ' + (e instanceof Error ? e.message : ''));
        }
    }

    async getRawDefinition(defId: string, options: any) {
        try {
            if (!defId) return;

            // Business Rule (raw-definition mock)
            if (options && options.type === 'rule') {
                const map = this.__loadBrRawMap();
                const key = String(defId || '');
                return map[key] ?? null;
            }

            if (options && options.type === 'unit') {
                const map = this.__loadTestRawMap();
                const key = String(defId || '').replace(/\.unit$/i, '');
                return map[key] ?? null;
            }

            if (options && options.type === 'json') {
                const map = this.__loadTestRawMap();
                const key = String(defId || '').replace(/\.json$/i, '');
                return map[key] ?? null;
            }

            if (options) {
                // 폼 정보를 불러오기 위해서
                if (options.type === 'form') {
                    if (defId.includes('/')) defId = defId.replace(/\//g, '#');
                    if (!options.match) {
                        options.match = {
                            id: defId,
                            tenant_id: window.$tenantName
                        };
                    } else {
                        options.match.tenant_id = window.$tenantName;
                    }
                    const data = await storage.getString(`form_def`, {
                        match: options.match,
                        column: 'html'
                    });
                    if (!data) {
                        return null;
                    }
                    return data;
                } else if (options.type === 'bpmn') {
                    if (defId.includes('/')) defId = defId.replace(/\//g, '_');
                    let data: any = null;

                    // 버전이 명시된 경우: proc_def_version에서 해당 버전 스냅샷 조회
                    if (options.version) {
                        const match: any = {
                            proc_def_id: defId,
                            version: options.version
                        };
                        if (options.version_tag) {
                            match.version_tag = options.version_tag;
                        }
                        try {
                            const versionRow = await storage.getObject('proc_def_version', { match });
                            if (versionRow && (versionRow as any).snapshot) {
                                data = (versionRow as any).snapshot;
                            }
                        } catch (e) {
                            data = null;
                        }
                    }

                    // 버전 스냅샷이 없으면 최신 proc_def_version에서 조회
                    if (!data) {
                        try {
                            const supabase = window.$supabase;
                            if (supabase) {
                                const { data: latestVersion } = await supabase
                                    .from('proc_def_version')
                                    .select('snapshot')
                                    .eq('proc_def_id', defId)
                                    .eq('tenant_id', window.$tenantName)
                                    .order('created_at', { ascending: false })
                                    .limit(1)
                                    .maybeSingle();
                                if (latestVersion?.snapshot) {
                                    data = latestVersion.snapshot;
                                }
                            }
                        } catch (e) {
                            // 최신 버전 조회 실패 시 proc_def.bpmn으로 폴백
                        }
                    }
                    // 최종 폴백: proc_def.bpmn (버전이 하나도 없는 경우)
                    if (!data) {
                        data = await storage.getString(`proc_def`, { column: 'bpmn', match: { id: defId } });
                    }
                    return data;
                } else if (options.type === 'dmn') {
                    if (defId.includes('/')) defId = defId.replace(/\//g, '_');
                    const data = await storage.getString(`proc_def`, { column: 'bpmn', match: { id: defId } });
                    return data;
                }
            } else {
                if (defId.includes('/')) defId = defId.replace(/\//g, '_');
                const data = await storage.getObject(`proc_def/${defId}`, { key: 'id' });
                return data;
            }
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    uuid() {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000)
                .toString(16)
                .substring(1);
        }

        return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
    }
    /**
        process instance 실행 -> Completed (task)
        
    */
    async start(input: any) {
        try {
            const me = this;
            if (window.$jms) return;

            let defId = input.process_definition_id || input.processDefinitionId;
            if (!defId && input.process_instance_id && input.process_instance_id != '') {
                defId = input.process_instance_id.split('.')[0];
            }

            if (!input.answer) {
                input.answer = '';
            }
            if (!input.process_instance_id) {
                input.process_instance_id = `${defId}.${me.uuid()}`;
            } else {
                input['chat_room_id'] = input.process_instance_id;
            }
            if (!input.role_mappings) {
                input.role_mappings = [];
            }
            input['process_definition_id'] = defId.toLowerCase();
            if (!input.chat_room_id) {
                input['chat_room_id'] = `${input.process_definition_id}.${me.uuid()}`;
            }

            if (input.projectId) {
                input['project_id'] = input.projectId;
            }

            // form_values에서 체크포인트 정보를 추출하여 각 폼 객체 내부에 checkpoints 배열로 추가
            if (input.form_values && typeof input.form_values === 'object') {
                const checkedCheckpoints: string[] = [];

                // 먼저 체크된 체크포인트 이름을 수집
                Object.keys(input.form_values).forEach((key) => {
                    // _check로 끝나는 키는 체크포인트 정보로 간주
                    if (key.endsWith('_check') && typeof input.form_values[key] === 'boolean' && input.form_values[key] === true) {
                        // _check를 제거하여 원래 체크포인트 이름 복원
                        const checkpointName = key.replace(/_check$/, '');
                        checkedCheckpoints.push(checkpointName);
                    }
                });

                // 수집한 체크포인트 정보를 각 폼 객체 내부에 checkpoints 배열로 추가
                if (checkedCheckpoints.length > 0) {
                    Object.keys(input.form_values).forEach((key) => {
                        // _check로 끝나지 않는 키는 폼 객체로 간주
                        if (!key.endsWith('_check') && typeof input.form_values[key] === 'object' && input.form_values[key] !== null) {
                            // checkpoints 배열을 폼 객체 내부에 추가
                            input.form_values[key].checkpoints = checkedCheckpoints;
                        }
                    });

                    // 체크포인트 정보를 form_values 최상위 레벨에서 제거
                    Object.keys(input.form_values).forEach((key) => {
                        if (key.endsWith('_check')) {
                            delete input.form_values[key];
                        }
                    });
                }
            }

            return await me.executeInstance(input);
        } catch (error) {
            //@ts-ignore
            return error;
        }
    }

    async executeInstance(input: any) {
        try {
            const email = localStorage.getItem('email');
            input.email = email;
            input['tenant_id'] = window.$tenantName;

            let url = `/completion/complete`;
            if (input.answer && input.answer.image != null) {
                url = `/completion/vision-complete`;
            }

            const request = { input };
            const response = await axios.post(url, request, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response && response.data) {
                return response.data;
            } else {
                return null;
            }
        } catch (error: any) {
            return { error: error.message || error };
        }
    }

    async generateSemanticName(kind: 'chat' | 'instance', source: any, processName = ''): Promise<string | null> {
        try {
            const response = await axios.post(
                '/completion/generate-name',
                { kind, source, process_name: processName },
                { headers: { 'Content-Type': 'application/json' } }
            );
            const name = String(response?.data?.name || '').trim();
            return name ? name.substring(0, 50) : null;
        } catch (error) {
            return null;
        }
    }

    async getOrganization(path: string, options: any) {
        try {
            const organization = await storage.getObject(path, options);
            return organization;
        } catch (error) {
            return null;
        }
    }

    /**
     * 실행용 프로세스 정의 조회
     * - 1순위: proc_def_version 중 version_tag = 'major' 이면서 가장 높은 version
     * - 2순위: 해당 레코드가 없으면 proc_def에서 현재 정의 사용
     * - todolist / bpm_proc_inst 등에 버전 정보를 전달하기 위해 version, version_tag 도 함께 반환
     */
    async getExecutionDefinition(defId: string): Promise<{ definition: any; bpmn: string; version?: string; version_tag?: string } | null> {
        try {
            if (!defId) return null;

            defId = defId.toLowerCase();
            const compareVersion = (a?: string, b?: string) => {
                const pa = String(a || '0')
                    .split('.')
                    .map((v) => parseInt(v, 10) || 0);
                const pb = String(b || '0')
                    .split('.')
                    .map((v) => parseInt(v, 10) || 0);
                const len = Math.max(pa.length, pb.length);
                for (let i = 0; i < len; i += 1) {
                    const av = pa[i] ?? 0;
                    const bv = pb[i] ?? 0;
                    if (av !== bv) return av > bv ? 1 : -1;
                }
                return 0;
            };

            const procDef = await storage.getObject('proc_def', {
                match: { id: defId }
            });
            if (!procDef) return null;

            const prodVersion = (procDef as any).prod_version || (procDef as any).prodVersion;
            if (prodVersion) {
                try {
                    const prodRow = await storage.getObject('proc_def_version', {
                        match: {
                            proc_def_id: defId,
                            version: String(prodVersion)
                        }
                    });
                    if (prodRow && (prodRow as any).snapshot) {
                        return {
                            definition: (prodRow as any).definition,
                            bpmn: (prodRow as any).snapshot,
                            version: (prodRow as any).version,
                            version_tag: (prodRow as any).version_tag || 'major'
                        };
                    }
                } catch (e) {
                    // ignore and fallback
                }
            }

            // 1) major 버전 중 가장 최신 버전 검색
            let majorVersions: any[] = [];
            try {
                majorVersions = await storage.list('proc_def_version', {
                    match: {
                        proc_def_id: defId,
                        version_tag: 'major'
                    }
                });
            } catch (e) {
                majorVersions = [];
            }

            if (majorVersions && majorVersions.length > 0) {
                majorVersions.sort((a: any, b: any) => {
                    return compareVersion(b.version, a.version);
                });

                const latest = majorVersions[0];
                return {
                    definition: latest.definition,
                    bpmn: latest.snapshot,
                    version: latest.version,
                    version_tag: latest.version_tag
                };
            }

            // 2) major 버전이 없으면 minor 버전 중 가장 최신 버전 검색
            let minorVersions: any[] = [];
            try {
                minorVersions = await storage.list('proc_def_version', {
                    match: {
                        proc_def_id: defId,
                        version_tag: 'minor'
                    }
                });
            } catch (e) {
                minorVersions = [];
            }

            if (minorVersions && minorVersions.length > 0) {
                minorVersions.sort((a: any, b: any) => {
                    return compareVersion(b.version, a.version);
                });

                const latest = minorVersions[0];
                return {
                    definition: latest.definition,
                    bpmn: latest.snapshot,
                    version: latest.version,
                    version_tag: latest.version_tag
                };
            }

            // 3) 버전이 하나도 없으면 proc_def의 현재 정의 사용
            return {
                definition: procDef.definition,
                bpmn: procDef.bpmn
            };
        } catch (error) {
            return null;
        }
    }

    /**
     * 시뮬레이션용 프로세스 정의 조회
     * - 항상 proc_def의 현재 정의를 사용
     */
    async getSimulationDefinition(defId: string): Promise<{ definition: any; bpmn: string } | null> {
        try {
            if (!defId) return null;
            defId = defId.toLowerCase();

            const procDef = await storage.getObject('proc_def', {
                match: { id: defId }
            });

            if (!procDef) return null;

            return {
                definition: procDef.definition,
                bpmn: procDef.bpmn
            };
        } catch (error) {
            return null;
        }
    }

    async getInstance(instanceId: string) {
        try {
            const options = {
                match: {
                    proc_inst_id: instanceId
                }
            };
            const instance = await storage.getObject('bpm_proc_inst', options);
            // const instance = await storage.getObject('instance', { match: { 'instance_id': instanceId } });
            // if (instance) {
            //     instance.defId = instance.proc_def_id;
            //     instance.instanceId = instanceId;
            //     instance.name = instance.proc_inst_name;
            //     instance.defVer = instance.proc_def_version;
            // }
            return this.returnInstanceObject(instance);
            // return  {
            //     instId: instance.proc_inst_id,
            //     defId: instance.proc_def_id,
            //     name: instance.proc_inst_name,
            //     projectId: instance.project_id,
            //     currentActivityIds: instance.current_activity_ids,
            //     participants: instance.participants,
            //     roleBindings: instance.role_bindings,
            //     variables_data: instance.variables_data,
            //     status: instance.status,
            //     tenantId: instance.tenant_id,
            //     startDate: instance.start_date,
            //     endDate: instance.end_date,
            //     dueDate: instance.due_date,
            // };
        } catch (e) {
            //@ts-ignore
            throw new Error(e.message);
        }
    }

    async getAllInstanceList(page: any, size: any) {
        try {
            const list = await storage.list('bpm_proc_inst');
            return list.map((item: any) => {
                return this.returnInstanceObject(item);
                // return {
                //     instId: item.proc_inst_id,
                //     defId: item.proc_def_id,
                //     name: item.proc_inst_name,
                //     projectId: item.project_id,
                //     currentActivityIds: item.current_activity_ids,
                //     participants: item.participants,
                //     roleBindings: item.role_bindings,
                //     variables_data: item.variables_data,
                //     status: item.status,
                //     tenantId: item.tenant_id,
                //     startDate: item.start_date,
                //     endDate: item.end_date,
                //     dueDate: item.due_date,
                // }
            });
        } catch (e) {
            //@ts-ignore
            throw new Error(e.message);
        }
    }

    async getTodoListByInstances(instanceIds: string[]) {
        try {
            if (!instanceIds || instanceIds.length === 0) {
                return {};
            }

            // todolist 조회
            const { data: todos, error } = await window.$supabase
                .from('todolist')
                .select(
                    'proc_inst_id, proc_def_id, activity_id, activity_name, start_date, end_date, status, output, description, user_id, updated_at'
                )
                .in('proc_inst_id', instanceIds)
                .order('start_date', { ascending: true });

            if (error) {
                console.error('Error fetching todolist:', error);
                return {};
            }

            // 프로세스 정의별로 그룹화하고 중복 제거
            const result: any = {};

            todos.forEach((todo: any) => {
                const defId = todo.proc_def_id;
                const instId = todo.proc_inst_id;

                // 프로세스 정의 레벨
                if (!result[defId]) {
                    result[defId] = {
                        processDefinitionId: defId,
                        instances: {}
                    };
                }

                // 인스턴스 레벨
                if (!result[defId].instances[instId]) {
                    result[defId].instances[instId] = {
                        instanceId: instId,
                        activities: []
                    };
                }

                // 액티비티 추가
                result[defId].instances[instId].activities.push({
                    activityId: todo.activity_id,
                    activityName: todo.activity_name,
                    startDate: todo.start_date,
                    endDate: todo.end_date,
                    status: todo.status,
                    output: todo.output,
                    description: todo.description,
                    userId: todo.user_id,
                    updatedAt: todo.updated_at
                });
            });

            return result;
        } catch (e) {
            console.error('Error in getTodoListByInstances:', e);
            return {};
        }
    }

    async getInstanceByProjectId(projectId: number) {
        try {
            const list = await storage.list('bpm_proc_inst', { match: { project_id: projectId } });

            return list.map((item: any) => {
                return this.returnInstanceObject(item);
                // return {
                //     instId: item.proc_inst_id,
                //     defId: item.proc_def_id,
                //     name: item.proc_inst_name,
                //     projectId: item.project_id,
                //     currentActivityIds: item.current_activity_ids,
                //     participants: item.participants,
                //     roleBindings: item.role_bindings,
                //     variables_data: item.variables_data,
                //     status: item.status,
                //     tenantId: item.tenant_id,
                //     startDate: item.start_date,
                //     endDate: item.end_date,
                //     dueDate: item.due_date,
                // }
            });
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getWorkItem(taskId: string) {
        try {
            if (!taskId) return;

            const workitem = await storage.getObject(`todolist/${taskId}`, { key: 'id' });
            let definition: any = null;
            let instance: any = null;

            if (!workitem) {
                return;
            } else if (workitem.proc_def_id) {
                definition = await this.getRawDefinition(workitem.proc_def_id, null);
                if (workitem.proc_inst_id) {
                    instance = await this.getInstance(workitem.proc_inst_id);
                }
            }

            let parameters: any[] = [];
            const outParameterContext: any = {
                variable: {
                    name: ''
                }
            };
            let activityInfo: any = null;

            if (definition && definition.definition) {
                activityInfo = definition.definition.activities.find((activity: any) => activity.id === workitem.activity_id);
                if (activityInfo && activityInfo.properties) {
                    const properties = JSON.parse(activityInfo.properties);
                    if (properties.parameters && instance) {
                        parameters = properties.parameters;
                        parameters.forEach((item: any) => {
                            item.variable.defaultValue = instance[item.variable.name.toLowerCase().replace(/ /g, '_')] || '';
                        });
                    }
                    if (activityInfo.tool && activityInfo.tool.includes('formHandler:')) {
                        outParameterContext.variable.name = activityInfo.tool.replace('formHandler:', '');
                    }
                }
            }
            const parameterValues: any = {};
            if (parameters.length > 0) {
                parameters.forEach((item) => {
                    parameterValues[item.argument.text] = item.variable.defaultValue;
                });
            }

            let currentActivities = [];
            if (instance && instance.currentActivityIds) {
                currentActivities = instance.currentActivityIds;
            } else if (activityInfo && activityInfo.id && !workitem.adhoc) {
                currentActivities = [activityInfo.id];
            }

            const newWorkItem = {
                worklist: {
                    defId: workitem.proc_def_id || '',
                    endpoint: workitem.user_id,
                    instId: workitem.proc_inst_id,
                    rootInstId: null,
                    taskId: workitem.id,
                    startDate: workitem.start_date,
                    endDate: workitem.end_date,
                    dueDate: workitem.due_date,
                    status: workitem.status === 'TODO' ? 'NEW' : workitem.status === 'DONE' ? 'COMPLETED' : workitem.status,
                    description: workitem.description || '',
                    tool: workitem.tool || '',
                    adhoc: workitem.adhoc || false,
                    currentActivities: currentActivities,
                    defVerId: instance && instance.defVersion ? instance.defVersion : null,
                    output: workitem.output || '',
                    log: workitem.log || '',
                    orchestration: workitem.agent_orch || '',
                    agentMode: workitem.agent_mode || '',
                    version_tag: workitem.version_tag || null,
                    version: workitem.version || null
                },
                activity: {
                    name: workitem.activity_name || '',
                    tracingTag: workitem.activity_id || '',
                    parameters: parameters || [],
                    outParameterContext: outParameterContext || {},
                    // tool은 WorkItem UI에서 분기 처리에 사용됨 (urlHandler/formHandler 등)
                    tool: activityInfo && (activityInfo as any).tool ? (activityInfo as any).tool : workitem.tool || '',
                    instruction: activityInfo && activityInfo.instruction ? activityInfo.instruction : '',
                    checkpoints: activityInfo && activityInfo.checkpoints ? activityInfo.checkpoints : [],
                    pythonCode: activityInfo && activityInfo.pythonCode ? activityInfo.pythonCode : '',
                    type: activityInfo && activityInfo.type ? activityInfo.type : ''
                },
                parameterValues: parameterValues || {}
            };
            return newWorkItem;
        } catch (e) {
            //@ts-ignore
            throw new Error(e.message);
        }
    }

    /**
     * 태스크 반송(이전 단계 담당자에게 재처리 요청) - uEngine 모드에서 구현됨
     * ProcessGPT 모드에서도 필요하다면 아래 2개 메서드를 ProcessGPT 백엔드 사양에 맞게 구현하세요.
     *
     * - 조회: GET  `/work-item/{taskId}/return/availability`
     * - 실행: POST `/work-item/{taskId}/return`
     */
    async getTaskReturnAvailability(taskId: string): Promise<any> {
        throw new Error(
            '[ProcessGPTBackend] 태스크 반송 기능은 현재 uEngine 모드에서 구현되었습니다. ' +
                'ProcessGPT 모드에서는 백엔드 API(예: GET `/work-item/{taskId}/return/availability`)를 먼저 제공한 뒤 구현해주세요.'
        );
    }

    async returnTask(taskId: string, payload: any): Promise<any> {
        throw new Error(
            '[ProcessGPTBackend] 태스크 반송 기능은 현재 uEngine 모드에서 구현되었습니다. ' +
                'ProcessGPT 모드에서는 백엔드 API(예: POST `/work-item/{taskId}/return`)를 먼저 제공한 뒤 구현해주세요.'
        );
    }

    /**
     * 태스크 SKIP(건너뛰기) - uEngine 모드에서 구현됨
     * ProcessGPT 모드에서도 필요하다면 아래 2개 메서드를 ProcessGPT 백엔드 사양에 맞게 구현하세요.
     *
     * - 조회: GET  `/work-item/{taskId}/skip/availability`
     * - 실행: POST `/work-item/{taskId}/skip`
     */
    async getTaskSkipAvailability(taskId: string): Promise<any> {
        throw new Error(
            '[ProcessGPTBackend] 태스크 SKIP 기능은 현재 uEngine 모드에서 구현되었습니다. ' +
                'ProcessGPT 모드에서는 백엔드 API(예: GET `/work-item/{taskId}/skip/availability`)를 먼저 제공한 뒤 구현해주세요.'
        );
    }

    async skipTask(taskId: string, payload: any): Promise<any> {
        throw new Error(
            '[ProcessGPTBackend] 태스크 SKIP 기능은 현재 uEngine 모드에서 구현되었습니다. ' +
                'ProcessGPT 모드에서는 백엔드 API(예: POST `/work-item/{taskId}/skip`)를 먼저 제공한 뒤 구현해주세요.'
        );
    }

    async getTask(taskId: string) {
        try {
            const task = await storage.getObject('todolist', { key: 'id', match: { id: taskId } });
            return this.convertKeysToCamelCase(task);
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getWorkList(options?: any) {
        try {
            const filter: any = { match: {} };
            if (options && options.match) {
                filter.match = options.match;
            }

            if (options && options.status) {
                filter.match.status = options.status;
            }

            if (options && options.projectId) {
                filter.match.project_id = options.projectId;
            }

            if (options && options.instId) {
                filter.match.root_proc_inst_id = options.instId;
            }

            if (options && options.userId) {
                filter.like = {
                    key: 'user_id',
                    value: `%${options.userId}%`
                };
            }

            if (options && options.orderBy) {
                filter.orderBy = options.orderBy;
                filter.sort = options.sort || 'asc';
            }

            let list = await storage.list('todolist', filter);
            if (list.length === 0) {
                //자식인스턴스 워크아이템 조회
                if (options && options.instId) {
                    filter.match.proc_inst_id = options.instId;
                    delete filter.match.root_proc_inst_id;
                }
                list = await storage.list('todolist', filter);
            }

            list = list.filter((item: any) => !((!item.tool || item.tool === '') && item.description === 'start event'));

            // 페이지네이션 처리
            let paginatedList = list;
            if (options && options.page !== undefined && options.size) {
                const page = options.page || 0;
                const size = options.size || 20;
                const startIndex = page * size;
                const endIndex = startIndex + size;
                paginatedList = list.slice(startIndex, endIndex);
            }

            return paginatedList.map((item: any) => {
                return this.returnWorkItemObject(item);
                // return {
                //     taskId: item.id,
                //     defId: item.proc_def_id,
                //     endpoint: item.user_id,
                //     instId: item.proc_inst_id,
                //     rootInstId: null,
                //     startDate: item.start_date,
                //     endDate: item.end_date,
                //     dueDate: item.due_date,
                //     status: item.status,
                //     name: item.activity_name || "",
                //     tracingTag: item.activity_id || "",
                //     description: item.description || "",
                //     tool: item.tool || "",
                //     instName: item.proc_inst_name || "",
                //     projectId: item.project_id || null,
                //     adhoc: item.adhoc || false,
                //     output: item.output || ""
                // }
            });
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async putWorkItem(taskId: string, workItem: any) {
        try {
            // id와 변경할 필드만 포함하여 upsert
            const putObj = { id: taskId, ...workItem };
            console.log('putObj 업데이트할 데이터:', putObj);
            return await storage.putObject('todolist', putObj);
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async putWorklist(taskId: string, workItem: any) {
        try {
            let result: any = null;
            if (!workItem.instId || workItem.status != 'DONE') {
                if (workItem.adhoc && !workItem.tool) workItem.tool = 'formHandler:defaultform'; // adhoc 작업인 경우 tool을 defaultform으로 설정
                const putObj = {
                    id: taskId || this.uuid(),
                    proc_def_id: workItem.defId || workItem.defId,
                    user_id: workItem.endpoint || localStorage.getItem('email'),
                    proc_inst_id: workItem.instId || workItem.parent,
                    start_date: workItem.startDate || workItem.startDate,
                    end_date: workItem.endDate || workItem.endDate,
                    due_date: workItem.dueDate || workItem.dueDate,
                    status: workItem.status || workItem.status,
                    activity_id: workItem.tracingTag || workItem.title,
                    activity_name: workItem.title || workItem.name,
                    description: workItem.description || null,
                    reference_ids: workItem.referenceIds || null,
                    tool: workItem.tool || null,
                    adhoc: workItem.adhoc || null,
                    project_id: workItem.projectId || null
                };
                await storage.putObject('todolist', putObj);

                const _currentEmail = localStorage.getItem('email');
                const _currentUuid = (() => {
                    try {
                        return JSON.parse(localStorage.getItem('sb-127-auth-token') || '{}')?.user?.id;
                    } catch {
                        return null;
                    }
                })();
                if (
                    (workItem.status === 'IN_PROGRESS' || workItem.status === 'PENDING') &&
                    putObj.user_id &&
                    putObj.user_id !== _currentEmail &&
                    putObj.user_id !== _currentUuid
                ) {
                    await this.sendNotification({
                        userId: putObj.user_id,
                        type: 'workitem_bpm',
                        title: putObj.activity_name || '새 할 일',
                        description: putObj.proc_def_id || null,
                        url: '/todolist',
                        fromUserId: localStorage.getItem('email') || undefined
                    });
                }

                if (workItem.status == 'IN_PROGRESS' || workItem.status == 'PENDING') {
                    const putInst = {
                        proc_inst_id: workItem.instId,
                        current_activity_ids: [workItem.tracingTag || workItem.title]
                    };
                    await storage.putObject('bpm_proc_inst', putInst);
                }
            } else {
                // instance workItem
                const answer = {
                    activity_id: workItem.tracingTag || workItem.title,
                    status_to_change: workItem.status
                };
                result = await this.putWorkItemComplete(taskId, answer);
                // 다음 액티비티로 넘어가지 못한 경우
                if (result.cannotProceedErrors && result.cannotProceedErrors.length > 0) {
                    result.errors = result.cannotProceedErrors;
                    const dataNotExist = result.cannotProceedErrors.find((item: any) => item.type === 'DATA_FIELD_NOT_EXIST');
                    if (!dataNotExist) {
                        throw new Error(result.cannotProceedErrors.map((item: any) => item.reason).join('\n'));
                    }
                }
            }
            return result;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async deleteWorkItem(taskId: string) {
        try {
            await storage.delete(`todolist/${taskId}`, { key: 'id' });
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getFormDefinition(formName: string) {
        try {
            const form = await storage.getString(`form_def/${formName}`, { key: 'key' });
            if (form && form.html) {
                return form.html;
            }
            return null;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getFormFields(formId?: string, activityId?: string, procDefId?: string) {
        try {
            let data = null;
            if (formId) {
                data = await storage.getObject('form_def', {
                    match: {
                        id: formId,
                        tenant_id: window.$tenantName
                    }
                });
            } else if (activityId && procDefId) {
                data = await storage.getObject('form_def', {
                    match: {
                        proc_def_id: procDefId,
                        activity_id: activityId,
                        tenant_id: window.$tenantName
                    }
                });
            } else {
                console.error('formId or activityId and procDefId is required');
                return null;
            }
            return data;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    private getPreviousActivities(activityId: string, definition: any) {
        if (!definition || !definition.sequences || !definition.activities) {
            return [];
        }

        const sequences = definition.sequences;
        const activities = definition.activities;
        const previousActivities = new Set<string>();
        const visited = new Set<string>();

        // 특정 액티비티로 들어오는 시퀀스를 찾아서 이전 액티비티들을 재귀적으로 탐색
        const findPreviousActivities = (targetId: string) => {
            if (visited.has(targetId)) {
                return; // 순환 참조 방지
            }
            visited.add(targetId);

            // targetId로 들어오는 시퀀스들을 찾음
            const incomingSequences = sequences.filter((seq: any) => seq.target === targetId);

            for (const sequence of incomingSequences) {
                const sourceId = sequence.source;

                // 소스가 액티비티인지 확인 (events, gateways 제외)
                const sourceActivity = activities.find((act: any) => act.id === sourceId);
                if (sourceActivity) {
                    previousActivities.add(sourceId);
                    // 재귀적으로 더 이전 액티비티들을 찾음
                    findPreviousActivities(sourceId);
                } else {
                    // 소스가 gateway나 event인 경우에도 재귀적으로 탐색
                    findPreviousActivities(sourceId);
                }
            }
        };

        findPreviousActivities(activityId);

        // Set을 배열로 변환하고 액티비티 객체들을 반환
        return Array.from(previousActivities)
            .map((actId) => activities.find((act: any) => act.id === actId))
            .filter((act) => act !== undefined);
    }

    // 액티비티가 속한 서브프로세스를 찾는 헬퍼 함수
    private findSubProcessContainingActivity(activityId: string, definition: any): any {
        if (!definition.subProcesses || definition.subProcesses.length === 0) {
            return null;
        }

        for (const subProcess of definition.subProcesses) {
            if (subProcess.children && subProcess.children.activities) {
                const foundActivity = subProcess.children.activities.find((act: any) => act.id === activityId);
                if (foundActivity) {
                    return subProcess;
                }
                // 중첩된 서브프로세스도 확인
                const nestedSubProcess = this.findSubProcessContainingActivity(activityId, subProcess.children);
                if (nestedSubProcess) {
                    return nestedSubProcess;
                }
            }
        }
        return null;
    }

    // 서브프로세스를 고려하여 이전 액티비티들을 찾는 함수
    private getPreviousActivitiesWithSubProcess(activityId: string, definition: any) {
        const allPreviousActivities = [];

        // 1. 액티비티가 루트 프로세스에 있는지 서브프로세스에 있는지 확인
        const subProcess = this.findSubProcessContainingActivity(activityId, definition);

        if (subProcess) {
            // 2. 서브프로세스 내부에서 이전 액티비티들을 찾음
            const subProcessActivities = this.getPreviousActivities(activityId, subProcess.children);
            allPreviousActivities.push(...subProcessActivities);

            // 3. 루트 프로세스에서 해당 서브프로세스 이전의 액티비티들을 찾음
            const rootPreviousActivities = this.getPreviousActivities(subProcess.id, definition);
            allPreviousActivities.push(...rootPreviousActivities);

            // 4. 루트 프로세스의 이전 액티비티들 중에 서브프로세스가 있다면,
            //    그 서브프로세스 내부의 모든 액티비티들도 포함
            for (const rootActivity of rootPreviousActivities) {
                if (rootActivity.type === 'subProcess' && rootActivity.children) {
                    const subProcessAllActivities = this.getAllActivitiesFromDefinition(rootActivity.children);
                    allPreviousActivities.push(...subProcessAllActivities);
                }
            }
        } else {
            // 루트 프로세스의 액티비티인 경우 기존 로직 사용
            const rootActivities = this.getPreviousActivities(activityId, definition);
            allPreviousActivities.push(...rootActivities);

            // 이전 액티비티들 중에 서브프로세스가 있다면,
            // 그 서브프로세스 내부의 모든 액티비티들도 포함
            for (const activity of rootActivities) {
                if (activity.type === 'subProcess' && activity.children) {
                    const subProcessAllActivities = this.getAllActivitiesFromDefinition(activity.children);
                    allPreviousActivities.push(...subProcessAllActivities);
                }
            }
        }

        // 중복 제거 (id 기준)
        const uniqueActivities = [];
        const activityIds = new Set();
        for (const activity of allPreviousActivities) {
            if (!activityIds.has(activity.id)) {
                activityIds.add(activity.id);
                uniqueActivities.push(activity);
            }
        }

        return uniqueActivities;
    }

    // Definition에서 모든 액티비티들을 추출하는 헬퍼 함수
    private getAllActivitiesFromDefinition(definition: any): any[] {
        const allActivities = [];

        if (definition.activities) {
            allActivities.push(...definition.activities);
        }

        if (definition.subProcesses) {
            for (const subProcess of definition.subProcesses) {
                if (subProcess.children) {
                    const subActivities = this.getAllActivitiesFromDefinition(subProcess.children);
                    allActivities.push(...subActivities);
                }
            }
        }

        return allActivities;
    }

    async getPreviousForms(activityId: string, definition?: any) {
        try {
            if (definition) {
                const prevActivities = this.getPreviousActivitiesWithSubProcess(activityId, definition);

                if (prevActivities.length > 0) {
                    const formPromises = prevActivities.map(async (activity: any) => {
                        // tool이 formHandler로 시작하는 경우만 처리
                        if (!activity.tool || !activity.tool.startsWith('formHandler:')) {
                            return null;
                        }

                        const formId = activity.tool.split('formHandler:')[1];
                        const form = await storage.getObject('form_def', {
                            match: {
                                id: formId,
                                tenant_id: window.$tenantName
                            }
                        });

                        if (form) {
                            // DB에 저장된 경우
                            form['title'] = activity.name;
                            form['activityId'] = activity.id;
                            return form;
                        } else {
                            // DB에 저장 전인 경우 > 로컬스토리지에서 조회
                            const formHtml = localStorage.getItem(formId);
                            if (formHtml) {
                                const fields = this.extractFields(formHtml);
                                return {
                                    id: formId,
                                    activityId: activity.id,
                                    title: activity.name || activity.id,
                                    html: formHtml,
                                    fields_json: fields
                                };
                            }
                        }
                        return null;
                    });

                    const formResults = await Promise.all(formPromises);
                    const validForms = formResults.filter((form) => form !== null);
                    return validForms;
                }
            }
            return [];
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    /**
     * 프로세스 정의 체계도 조회
     * @returns
     */
    async getProcessDefinitionMap() {
        try {
            const isPal = window.$pal;
            const options = {
                match: {
                    key: 'proc_map',
                    tenant_id: window.$tenantName
                }
            };
            const procMap = await storage.getObject('configuration', options);
            if (procMap && procMap.value) {
                const renameLabels = (obj: any) => {
                    if (obj instanceof Array) {
                        obj.forEach((item) => renameLabels(item));
                    } else if (obj instanceof Object) {
                        if (obj.hasOwnProperty('label')) {
                            obj.name = obj.label;
                            delete obj.label;
                        }
                        Object.values(obj).forEach((value) => renameLabels(value));
                    }
                };
                renameLabels(procMap.value);

                // 권한 체크: PAL 모드 여부와 관계없이 권한이 설정되어 있으면 필터링 적용
                const usePermissions = await this.checkUsePermissions();
                const role = localStorage.getItem('role');
                const isAdmin = localStorage.getItem('isAdmin') === 'true';

                // superAdmin이거나 권한 설정이 없으면 전체 반환
                if (role === 'superAdmin' || !usePermissions) {
                    return procMap.value;
                }

                // 관리자는 전체 볼 수 있음 (권한 설정은 일반 사용자에게만 적용)
                if (isAdmin) {
                    return procMap.value;
                }

                // 일반 사용자는 권한에 따라 필터링
                const filteredMap = await this.filterProcDefMap(procMap.value);
                return filteredMap;
            }
            return {};
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async putProcessDefinitionMap(editedMap: any) {
        try {
            const isPal = window.$pal;
            const options = {
                match: {
                    key: 'proc_map',
                    tenant_id: window.$tenantName
                },
                column: 'uuid'
            };
            const procMapId = await storage.getString('configuration', options);
            let updatedProcMap: any = null;
            const role = localStorage.getItem('role');
            if (role !== 'superAdmin' && isPal) {
                const existingProcMap = await storage.getObject('configuration', options);
                const usePermissions = await this.checkUsePermissions();
                if (usePermissions) {
                    updatedProcMap = await this.mergeProcessMaps(existingProcMap.value, editedMap);
                } else {
                    updatedProcMap = editedMap;
                }
                // console.log("병합한 프로세스 정의 체계도 ", updatedProcMap);
            } else {
                updatedProcMap = editedMap;
            }

            const putObj = {
                uuid: typeof procMapId === 'string' ? procMapId : this.uuid(),
                key: 'proc_map',
                value: updatedProcMap,
                tenant_id: window.$tenantName
            };
            await storage.putObject('configuration', putObj, { onConflict: 'key,tenant_id' });
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    /**
     * 메트릭스 맵 저장 (2D 매트릭스 뷰)
     * @param metricsData 저장할 메트릭스 데이터
     */
    async putMetricsMap(metricsData: any) {
        try {
            const options = {
                match: {
                    key: 'metrics',
                    tenant_id: window.$tenantName
                },
                column: 'uuid'
            };
            const metricsMapId = await storage.getString('configuration', options);

            const putObj = {
                uuid: typeof metricsMapId === 'string' ? metricsMapId : this.uuid(),
                key: 'metrics',
                value: metricsData,
                tenant_id: window.$tenantName
            };
            await storage.putObject('configuration', putObj, { onConflict: 'key,tenant_id' });
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    /**
     * 메트릭스 맵 조회 (2D 매트릭스 뷰)
     * @returns 메트릭스 데이터 (domains, mega_processes, processes)
     */
    async getMetricsMap() {
        try {
            const options = {
                match: {
                    key: 'metrics',
                    tenant_id: window.$tenantName
                }
            };
            const metricsMap = await storage.getObject('configuration', options);
            if (metricsMap && metricsMap.value) {
                return metricsMap.value;
            }
            // 기본 구조 반환
            return {
                domains: [],
                mega_processes: [],
                processes: []
            };
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    /**
     * 프로세스 정의 체계도(proc_map)의 프로세스 이름 동기화
     *
     * 프로세스 정의(proc_def) 저장 시 이름이 변경되면
     * 정의 체계도(configuration 테이블의 proc_map)에 있는 동일한 ID의 프로세스 이름도 자동으로 업데이트
     *
     * @param procDefId - 업데이트할 프로세스 정의 ID
     * @param newName - 새로운 프로세스 이름
     *
     * 특징:
     * - tenant_id 기반 격리: 현재 테넌트의 proc_map만 조회/수정
     * - uuid 기반 업데이트: 다른 테넌트 데이터 보호
     * - 동일 ID 전체 업데이트: proc_map 내 모든 동일 ID의 이름 일괄 변경
     */
    async updateProcessNameInMap(procDefId: string, newName: string) {
        try {
            // 현재 테넌트의 proc_map만 조회
            const options = {
                match: {
                    key: 'proc_map',
                    tenant_id: window.$tenantName
                }
            };
            const procMapRecord = await storage.getObject('configuration', options);

            if (!procMapRecord || !procMapRecord.value || !procMapRecord.value.mega_proc_list) {
                return;
            }

            let isUpdated = false;

            // mega > major > sub 계층 구조를 순회하며 동일 ID의 이름 업데이트
            procMapRecord.value.mega_proc_list.forEach((megaProc: any) => {
                if (megaProc.major_proc_list) {
                    megaProc.major_proc_list.forEach((majorProc: any) => {
                        if (majorProc.sub_proc_list) {
                            majorProc.sub_proc_list.forEach((subProc: any) => {
                                if (subProc.id === procDefId) {
                                    subProc.name = newName;
                                    isUpdated = true;
                                }
                            });
                        }
                    });
                }
            });

            // uuid 기반으로 현재 테넌트의 proc_map만 업데이트
            if (isUpdated) {
                const { error } = await window.$supabase
                    .from('configuration')
                    .update({
                        value: procMapRecord.value
                    })
                    .eq('uuid', procMapRecord.uuid);

                if (error) {
                    throw new Error(error.message);
                }
            }
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getBSCard() {
        try {
            const options = {
                match: {
                    key: 'strategy'
                },
                column: 'uuid'
            };
            const card = await storage.getObject(`configuration`, options);
            return card;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }
    async putBSCard(card: any) {
        try {
            const options = {
                match: {
                    key: 'strategy'
                },
                column: 'uuid'
            };

            const existing = await storage.getString('configuration', options);

            const uuid = typeof existing === 'string' ? existing : this.uuid();

            const putObj = {
                uuid,
                key: 'strategy',
                value: card,
                tenant_id: window.$tenantName
            };

            await storage.putObject('configuration', putObj, { onConflict: 'key,tenant_id' });
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    // =========================
    // Business Rule (비즈니스 규칙)
    // - UI에는 JSON을 노출하지 않는다. (내부 데이터)
    // - 백엔드 미구현 환경에서는 localStorage 기반 mock을 사용한다.
    // =========================
    __brStorageKey() {
        return 'uengine_business_rules_v1';
    }
    __loadRulesFromStorage() {
        try {
            const raw = localStorage.getItem(this.__brStorageKey());
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }
    __saveRulesToStorage(rules: any[]) {
        try {
            localStorage.setItem(this.__brStorageKey(), JSON.stringify(rules));
        } catch (e) {
            // ignore
        }
    }

    async listBusinessRules() {
        // raw definition 저장소에서 목록 생성
        const map = this.__loadBrRawMap();
        const entries = Object.entries(map).filter(([k]) => String(k).startsWith('business-rules/'));

        const results = entries
            .map(([k, v]) => {
                const idFromKey = String(k).split('/').pop() || '';
                try {
                    const parsed = v ? JSON.parse(v) : null;
                    return {
                        id: parsed?.id ?? idFromKey,
                        name: parsed?.name ?? idFromKey,
                        description: parsed?.description ?? ''
                    };
                } catch (e) {
                    return { id: idFromKey, name: idFromKey, description: '' };
                }
            })
            .filter((r: any) => r && r.id);

        return results.sort((a: any, b: any) => String(a?.name ?? '').localeCompare(String(b?.name ?? '')));
    }

    async getBusinessRule(ruleId: string) {
        if (!ruleId) return null;
        const raw = await this.getRawDefinition(`business-rules/${ruleId}`, { type: 'rule' });
        if (!raw) return null;

        const parsedJson = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const dmnXml =
            (typeof parsedJson?.dmnXml === 'string' ? parsedJson.dmnXml : '') ||
            (typeof parsedJson?.ruleJson?.dmnXml === 'string' ? parsedJson.ruleJson.dmnXml : '');

        // 저장본이 dmnXml만 가지고 있으므로, 화면에서 필요한 inputs/rules는 dmnXml로부터 즉석에서 구성한다.
        if (dmnXml) {
            const parsed = dmnXmlToBusinessRule(dmnXml);
            if (parsed) {
                return {
                    ...parsedJson,
                    dmnXml,
                    inputs: parsed.inputs || [],
                    rules: parsed.rules || []
                };
            }
        }

        return { ...parsedJson, dmnXml };
    }

    async saveBusinessRule(rule: any, _options?: { isNew?: boolean }) {
        const toSave = { ...(rule || {}) };
        if (!toSave.id) toSave.id = this.uuid();

        // 저장 포맷을 uEngine과 동일하게 "dmnXml 단일 진실원천"으로 둔다.
        let dmnXml = typeof toSave?.dmnXml === 'string' ? toSave.dmnXml : '';
        if (!dmnXml || !String(dmnXml).trim()) {
            try {
                dmnXml = businessRuleToDmnXml({
                    id: toSave?.id,
                    name: toSave?.name,
                    description: toSave?.description,
                    inputs: Array.isArray(toSave?.inputs) ? toSave.inputs : [],
                    rules: Array.isArray(toSave?.rules) ? toSave.rules : []
                });
            } catch (e) {
                dmnXml = '';
            }
        }

        const payload = {
            id: toSave.id,
            name: toSave.name ?? '',
            description: toSave.description ?? '',
            dmnXml
        };

        await this.putRawDefinition(JSON.stringify(payload), `business-rules/${toSave.id}`, { type: 'rule' });
        return { id: toSave.id };
    }

    async deleteBusinessRule(ruleId: string): Promise<void> {
        // ProcessGPT 모드에서는 삭제 기능 미지원
        console.warn(`[ProcessGPT] deleteBusinessRule은 ProcessGPT 모드에서 지원되지 않습니다. ruleId: ${ruleId}`);
        return null as any;
    }

    // =========================
    // Business Rule Test (룰 테스트 실행)
    // =========================
    async executeBusinessRule(ruleId: string, inputs: Record<string, any>): Promise<any> {
        const startedAt = performance.now();
        const rule = await this.getBusinessRule(ruleId);
        if (!rule) {
            throw new Error('룰을 찾을 수 없습니다.');
        }

        const rules = Array.isArray(rule.rules) ? rule.rules : [];
        const matchedRuleIndex = rules.findIndex((candidate: any) => this.__matchesBusinessRule(candidate, inputs || {}));
        const matchedRule = matchedRuleIndex >= 0 ? rules[matchedRuleIndex] : null;
        const result = matchedRule?.result || {};

        return {
            outcome: result.outcome ?? result.value ?? 'none',
            note: result.note ?? '',
            matchedRuleIndex: matchedRuleIndex >= 0 ? matchedRuleIndex : undefined,
            executionTime: Math.round(performance.now() - startedAt)
        };
    }

    async saveRuleTestCase(ruleId: string, testCase: any): Promise<void> {
        if (!ruleId || !testCase) {
            throw new Error('룰 ID와 테스트 케이스가 필요합니다.');
        }

        const testCaseId = testCase.id || this.uuid();
        const testCaseData = {
            ...testCase,
            id: testCaseId,
            ruleId,
            updatedAt: new Date().toISOString(),
            createdAt: testCase.createdAt || new Date().toISOString()
        };

        await this.putRawDefinition(
            JSON.stringify(testCaseData),
            `businessRules/${encodeURIComponent(ruleId)}/testCases/${encodeURIComponent(testCaseId)}`,
            { type: 'json' }
        );
    }

    async getRuleTestCases(ruleId: string): Promise<any[]> {
        if (!ruleId) return [];

        const prefix = `businessRules/${encodeURIComponent(ruleId)}/testCases/`;
        const map = this.__loadTestRawMap();
        return Object.entries(map)
            .filter(([key]) => key.startsWith(prefix))
            .map(([key, raw]) => {
                try {
                    const testCase = typeof raw === 'string' ? JSON.parse(raw) : raw;
                    const fileName = key.slice(prefix.length);
                    return {
                        id: testCase.id || fileName,
                        name: testCase.name || fileName,
                        inputs: testCase.inputs || {},
                        expectedOutcome: testCase.expectedOutcome,
                        expectedNote: testCase.expectedNote,
                        createdAt: testCase.createdAt,
                        updatedAt: testCase.updatedAt
                    };
                } catch (e) {
                    return null;
                }
            })
            .filter(Boolean)
            .sort((a: any, b: any) => {
                const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
                const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
                return dateB - dateA;
            });
    }

    async deleteRuleTestCase(ruleId: string, testCaseId: string): Promise<void> {
        if (!ruleId || !testCaseId) {
            throw new Error('룰 ID와 테스트 케이스 ID가 필요합니다.');
        }

        const map = this.__loadTestRawMap();
        const key = `businessRules/${encodeURIComponent(ruleId)}/testCases/${encodeURIComponent(testCaseId)}`;
        delete map[key];
        this.__saveTestRawMap(map);
    }

    __matchesBusinessRule(rule: any, inputs: Record<string, any>) {
        const conditions = Array.isArray(rule?.conditions) ? rule.conditions : [];
        if (conditions.length === 0) return true;
        return conditions.every((condition: any) => this.__matchesBusinessCondition(condition, inputs));
    }

    __matchesBusinessCondition(condition: any, inputs: Record<string, any>) {
        const key = condition?.key || condition?.item;
        const actual = inputs?.[key];
        const expected = condition?.value;
        switch (condition?.operator) {
            case 'ne':
                return actual !== expected;
            case 'gt':
                return Number(actual) > Number(expected);
            case 'gte':
                return Number(actual) >= Number(expected);
            case 'lt':
                return Number(actual) < Number(expected);
            case 'lte':
                return Number(actual) <= Number(expected);
            case 'contains':
                return String(actual ?? '').includes(String(expected ?? ''));
            case 'notContains':
                return !String(actual ?? '').includes(String(expected ?? ''));
            case 'startsWith':
                return String(actual ?? '').startsWith(String(expected ?? ''));
            case 'endsWith':
                return String(actual ?? '').endsWith(String(expected ?? ''));
            case 'eq':
            default:
                return actual === expected;
        }
    }

    async filterProcDefMap(map: any) {
        // 사용자 권한에 따라 필터링 (user, organization, org_group 모두 체크)
        const uid = localStorage.getItem('uid');
        if (!uid) {
            return {};
        }

        try {
            // 1. 사용자의 조직 목록 가져오기
            const { getCurrentUserOrganizations } = await import('@/utils/organizationUtils');
            const userOrganizations = await getCurrentUserOrganizations();

            // 2. 사용자가 속한 조직 그룹 가져오기
            const userOrgGroupIds: string[] = [];
            if (userOrganizations.length > 0) {
                try {
                    const orgGroups = await this.getOrgChartGroupList();
                    for (const group of orgGroups) {
                        // group.team_ids 배열에 사용자 조직이 포함되어 있는지 확인
                        const groupTeams = await storage.list('org_chart_group_teams', { match: { group_id: group.id } });
                        const groupTeamIds = groupTeams.map((t: any) => t.team_id);
                        const hasUserOrg = userOrganizations.some((orgId) => groupTeamIds.includes(orgId));
                        if (hasUserOrg) {
                            userOrgGroupIds.push(group.id);
                        }
                    }
                } catch (e) {
                    console.warn('[filterProcDefMap] 조직 그룹 조회 실패:', e);
                }
            }

            // 3. 모든 유형의 권한 조회 (user, organization, org_group)
            const allPermissions: any[] = [];

            // 3-1. 직접 사용자 권한 (target_type='user' 또는 legacy 권한)
            const userPermissions = await storage.list('user_permissions', {
                match: { user_id: uid, tenant_id: window.$tenantName }
            });
            if (userPermissions && userPermissions.length > 0) {
                // target_type이 'user'이거나 없는 경우만 추가 (legacy 호환)
                const filteredUserPerms = userPermissions.filter((p: any) => !p.target_type || p.target_type === 'user');
                allPermissions.push(...filteredUserPerms);
            }

            // 3-2. 조직 권한 (사용자가 속한 조직에 부여된 권한)
            for (const orgId of userOrganizations) {
                const orgPermissions = await storage.list('user_permissions', {
                    match: { organization_id: orgId, target_type: 'organization', tenant_id: window.$tenantName }
                });
                if (orgPermissions && orgPermissions.length > 0) {
                    allPermissions.push(...orgPermissions);
                }
            }

            // 3-3. 조직 그룹 권한
            for (const groupId of userOrgGroupIds) {
                const groupPermissions = await storage.list('user_permissions', {
                    match: { org_group_id: groupId, target_type: 'org_group', tenant_id: window.$tenantName }
                });
                if (groupPermissions && groupPermissions.length > 0) {
                    allPermissions.push(...groupPermissions);
                }
            }

            // 4. 모든 권한에서 사용자에게 readable이 true인 프로세스 ID 추출
            const accessibleProcDefIds = new Set<string>();
            for (const permission of allPermissions) {
                if (permission.readable === true) {
                    if (permission.proc_def_id) {
                        accessibleProcDefIds.add(permission.proc_def_id);
                    }
                    if (permission.proc_def_ids) {
                        this.extractProcDefIds(permission.proc_def_ids, accessibleProcDefIds);
                    }
                }
            }

            // 5. 권한이 설정된 모든 프로세스 ID 조회 (제한된 프로세스 목록)
            const restrictedProcDefIds = new Set<string>();
            try {
                const allDefinedPermissions = await storage.list('user_permissions', {
                    match: { tenant_id: window.$tenantName }
                });
                if (allDefinedPermissions && allDefinedPermissions.length > 0) {
                    for (const perm of allDefinedPermissions) {
                        if (perm.proc_def_id) {
                            restrictedProcDefIds.add(perm.proc_def_id);
                        }
                        if (perm.proc_def_ids) {
                            this.extractProcDefIds(perm.proc_def_ids, restrictedProcDefIds);
                        }
                    }
                }
            } catch (e) {
                console.warn('[filterProcDefMap] 전체 권한 목록 조회 실패:', e);
            }

            // 6. 원본 맵에서 필터링
            // - 권한이 정의되지 않은 프로세스: 모두에게 공개 (표시)
            // - 권한이 정의된 프로세스: 사용자에게 readable 권한이 있어야 표시
            if (!map || !map.mega_proc_list) {
                return {};
            }

            const isProcessAllowed = (procId: string): boolean => {
                // 권한이 정의되지 않은 프로세스는 공개
                if (!restrictedProcDefIds.has(procId)) {
                    return true;
                }
                // 권한이 정의된 프로세스는 사용자에게 접근 권한이 있어야 함
                return accessibleProcDefIds.has(procId);
            };

            const filteredMegaList = map.mega_proc_list
                .map((mega: any) => {
                    if (!mega) return null;

                    // mega 프로세스가 허용되는지 확인
                    const megaAllowed = isProcessAllowed(mega.id);

                    // major_proc_list 필터링
                    let filteredMajorList: any[] = [];
                    if (mega.major_proc_list) {
                        filteredMajorList = mega.major_proc_list
                            .map((major: any) => {
                                if (!major) return null;

                                // major 프로세스가 허용되는지 확인
                                const majorAllowed = megaAllowed || isProcessAllowed(major.id);

                                // sub_proc_list 필터링
                                let filteredSubList: any[] = [];
                                if (major.sub_proc_list) {
                                    filteredSubList = major.sub_proc_list.filter(
                                        (sub: any) => sub && (majorAllowed || isProcessAllowed(sub.id))
                                    );
                                }

                                // major가 허용되거나 허용된 sub가 있으면 포함
                                if (majorAllowed || filteredSubList.length > 0) {
                                    return {
                                        ...major,
                                        sub_proc_list: majorAllowed ? major.sub_proc_list : filteredSubList
                                    };
                                }
                                return null;
                            })
                            .filter((m: any) => m !== null);
                    }

                    // mega가 허용되거나 허용된 major가 있으면 포함
                    if (megaAllowed || filteredMajorList.length > 0) {
                        return {
                            ...mega,
                            major_proc_list: megaAllowed ? mega.major_proc_list : filteredMajorList
                        };
                    }
                    return null;
                })
                .filter((m: any) => m !== null);

            return {
                mega_proc_list: filteredMegaList
            };
        } catch (error) {
            console.error('[filterProcDefMap] 권한 필터링 오류:', error);
            return {};
        }
    }

    /**
     * proc_def_ids 구조에서 모든 프로세스 ID를 추출
     * @param procDefIds - 프로세스 정의 구조 (mega/major/sub 레벨)
     * @param idSet - ID를 저장할 Set
     */
    private extractProcDefIds(procDefIds: any, idSet: Set<string>): void {
        if (!procDefIds) return;

        // 현재 노드의 ID 추가
        if (procDefIds.id) {
            idSet.add(procDefIds.id);
        }

        // major_proc_list (mega 레벨)
        if (procDefIds.major_proc_list && Array.isArray(procDefIds.major_proc_list)) {
            for (const major of procDefIds.major_proc_list) {
                if (major && major.id) {
                    idSet.add(major.id);
                }
                // sub_proc_list
                if (major && major.sub_proc_list && Array.isArray(major.sub_proc_list)) {
                    for (const sub of major.sub_proc_list) {
                        if (sub && sub.id) {
                            idSet.add(sub.id);
                        }
                    }
                }
            }
        }

        // sub_proc_list (major 레벨 - major_proc_list 없이 바로 sub_proc_list가 있는 경우)
        if (procDefIds.sub_proc_list && Array.isArray(procDefIds.sub_proc_list)) {
            for (const sub of procDefIds.sub_proc_list) {
                if (sub && sub.id) {
                    idSet.add(sub.id);
                }
            }
        }
    }

    async mergeProcessMaps(oldValue: any, newValue: any) {
        if (!oldValue || !oldValue.mega_proc_list) {
            return newValue;
        } else {
            const existingMap = oldValue.mega_proc_list;
            const changes = newValue.mega_proc_list;
            const uid = localStorage.getItem('uid');

            for (const item of existingMap) {
                const change = changes.find((changeItem: any) => changeItem.id === item.id);
                if (change) {
                    const permission = await this.getUserPermissions({ user_id: uid, proc_def_id: item.id });
                    if (permission && permission.writable) {
                        // 개정 권한이 있는 경우 수정된 버전으로 권한 업데이트
                        const putObj = {
                            user_id: uid,
                            proc_def_id: item.id,
                            proc_def_ids: item
                        };
                        // await this.putUserPermission(putObj);
                        Object.assign(item, change);
                    } else {
                        // 권한이 없는 프로세스
                    }

                    Object.assign(item, change);
                } else {
                    const permission = await this.getUserPermissions({ user_id: uid, proc_def_id: item.id });
                    if (permission && permission.writable) {
                        const index = existingMap.indexOf(item);
                        if (index > -1) {
                            existingMap.splice(index, 1);
                        }
                    } else {
                        // 권한이 없는 프로세스
                    }
                }
            }

            // 편집 내용 중 새로 추가된 프로세스
            for (const item of changes) {
                const newProc = existingMap.find((existingItem: any) => existingItem.id === item.id);
                if (!newProc) {
                    const permission = await this.getUserPermissions({ user_id: uid, proc_def_id: item.id });
                    if (!permission) {
                        const putObj = {
                            user_id: uid,
                            proc_def_id: item.id,
                            proc_def_ids: item
                        };
                        // await this.putUserPermission(putObj);
                    }
                    existingMap.push(item);
                }
            }
            // console.log("변경된 프로세스 정의 체계도", existingMap);
            return {
                mega_proc_list: existingMap
            };
        }
    }

    async getDefinitionVersions(defId: string, options: any) {
        try {
            let list: any = [];
            defId = defId.toLowerCase();
            if (!options) {
                options = {
                    match: {
                        proc_def_id: defId
                    }
                };
            } else {
                if (!options.match) options.match = {};
                options.match.proc_def_id = defId;
            }
            list = await storage.list('proc_def_version', options);
            const procDefName = await storage.getString(`proc_def/${defId}`, { key: 'id', column: 'name' });
            if (procDefName) {
                list.forEach((item: any) => {
                    item.name = procDefName;
                });
            }
            return list;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }
    async versionUp(_version: string, _major: boolean, _makeProduction: boolean) {
        console.warn(`[ProcessGPT] versionUp은 ProcessGPT 모드에서 지원되지 않습니다.`);
        return null as any;
    }

    async makeProduction(_version: string) {
        console.warn(`[ProcessGPT] makeProduction은 ProcessGPT 모드에서 지원되지 않습니다.`);
        return null as any;
    }

    async getProduction() {
        console.warn(`[ProcessGPT] getProduction은 ProcessGPT 모드에서 지원되지 않습니다.`);
        return null as any;
    }

    async getVersion(_version: string) {
        console.warn(`[ProcessGPT] getVersion은 ProcessGPT 모드에서 지원되지 않습니다.`);
        return null as any;
    }

    async getDefinition(_defPath: string) {
        console.warn(`[ProcessGPT] getDefinition은 ProcessGPT 모드에서 지원되지 않습니다.`);
        return null as any;
    }

    async renameOrMove(_definition: any, _requestPath: string) {
        console.warn(`[ProcessGPT] renameOrMove은 ProcessGPT 모드에서 지원되지 않습니다.`);
        return null as any;
    }

    async createFolder(_newResource: any, _requestPath: string) {
        console.warn(`[ProcessGPT] createFolder은 ProcessGPT 모드에서 지원되지 않습니다.`);
        return null as any;
    }

    async stop(_instanceId: string) {
        console.warn(`[ProcessGPT] stop은 ProcessGPT 모드에서 지원되지 않습니다.`);
        return null as any;
    }

    async suspend(_instanceId: string) {
        console.warn(`[ProcessGPT] suspend은 ProcessGPT 모드에서 지원되지 않습니다.`);
        return null as any;
    }

    async resume(_instanceId: string) {
        console.warn(`[ProcessGPT] resume은 ProcessGPT 모드에서 지원되지 않습니다.`);
        return null as any;
    }

    async backToHere(_instanceId: string, _tracingTag: string) {
        console.warn(`[ProcessGPT] backToHere은 ProcessGPT 모드에서 지원되지 않습니다.`);
        return null as any;
    }

    async advanceToActivity(
        _instanceId: string,
        _tracingTag: string,
        _body?: { payloadMapping?: Record<string, Record<string, any>>; maxAttempts?: number }
    ) {
        console.warn(`[ProcessGPT] advanceToActivity은 ProcessGPT 모드에서 지원되지 않습니다.`);
        return null as any;
    }

    async startFromActivity(_instanceId: string, _tracingTag: string, _body?: { variables?: Record<string, any> }) {
        console.warn(`[ProcessGPT] startFromActivity은 ProcessGPT 모드에서 지원되지 않습니다.`);
        return null as any;
    }

    async getProcessVariables(instanceId: string) {
        try {
            const varData: any = {};
            const instance: any = await this.getInstance(instanceId);
            if (instance && instance.variables_data && instance.variables_data.length > 0) {
                instance.variables_data.forEach((item: any) => {
                    if (item.key) {
                        varData[item.key] = item.value;
                    }
                });
            }
            return varData;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
        // throw new Error("Method not implemented.");
    }

    async getVariable(instId: string, varName: string) {
        try {
            let varData: any = null;
            const instance: any = await this.getInstance(instId);
            if (instance && instance.variables_data && instance.variables_data.length > 0) {
                instance.variables_data.forEach((item: any) => {
                    if (item.key === varName || item.name === varName) {
                        varData = item.value;
                    }
                });
            }
            return varData;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    extractFields(html: string) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const fields: any[] = [];

        function extractFieldAttributes(elements: any) {
            elements.forEach((element: any) => {
                const alias = element.getAttribute('alias');
                const nameAttr = element.getAttribute('name') || '';
                const vModel = element.getAttribute('v-model') || '';
                // v-model 바인딩에서 bracket 표기법으로 키를 추출, 없으면 name 속성을 기본으로 사용
                const bracketMatch = vModel.match(/\[['"](.+?)['"]\]/);
                const key = bracketMatch && bracketMatch[1] ? bracketMatch[1] : nameAttr;
                const tagName = element.tagName.toLowerCase();
                const disabled = element.getAttribute('disabled');
                const readonly = element.getAttribute('readonly');
                const type = element.getAttribute('type') || tagName.replace('-field', '');

                const field: any = {
                    text: alias || '',
                    key: key,
                    type: type,
                    disabled: disabled ? disabled : false,
                    readonly: readonly ? readonly : false
                };
                fields.push(field);
            });
        }

        const fieldTags = [
            'text-field',
            'select-field',
            'checkbox-field',
            'radio-field',
            'file-field',
            'label-field',
            'boolean-field',
            'textarea-field',
            'user-select-field',
            'report-field',
            'slide-field',
            'bpmn-uengine-field'
        ];

        fieldTags.forEach((tag) => {
            const elements = doc.querySelectorAll(tag);
            extractFieldAttributes(elements);
        });

        return fields;
    }

    async getVariableWithTaskId(instId: string, taskId: string, formDefId: string) {
        try {
            let varData: any = null;
            const workItem = await storage.getObject(`todolist/${taskId}`, { key: 'id' });
            if (workItem) {
                // const formId = workItem.tool.replace('formHandler:', '');
                if (formDefId) {
                    if (!workItem.output) workItem.output = {};

                    if (formDefId == 'user_input_text') {
                        if (!workItem.output[formDefId]) workItem.output[formDefId] = '';
                        varData = workItem.output;
                    } else {
                        if (!workItem.output[formDefId]) workItem.output[formDefId] = {};
                        varData = workItem.output[formDefId];
                    }
                }
            }

            if (varData) {
                let fields: any = [];
                const formObject: any = await storage.getObject(`form_def/${formDefId}`, { key: 'id' });
                if (formObject) {
                    fields = formObject.fields_json;
                } else {
                    const html = await storage.getString(`form_def/${formDefId}`, { key: 'id', column: 'html' });
                    fields = this.extractFields(html);
                }
                if (fields && fields.length > 0) {
                    fields.forEach((field: any) => {
                        if (!varData[field.key]) {
                            varData[field.key] = '';
                        }
                    });
                }
            }

            // if(formDefId == 'user_input_text') {
            //     if(!varData['user_input_text']) varData['user_input_text'] = varData;
            // }

            const result = {
                valueMap: varData
            };
            return result;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async setVariable(instanceId: string, varName: string, varValue: any) {
        try {
            const columnName: any = varName.toLowerCase().replace(/ /g, '_');
            const putObj: any = {
                proc_inst_id: instanceId,
                variables_data: {
                    [columnName]: varValue
                }
            };

            await storage.putObject('bpm_proc_inst', putObj);
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async setVariableWithTaskId(instId: string, taskId: string, varName: string, varValue: any) {
        try {
            if (!varName) {
                console.log('varName is null');
                return;
            }

            if (varValue.valueMap) {
                varValue = varValue.valueMap;
            }

            if (varValue._type) {
                delete varValue._type;
            }

            const workItem = await storage.getObject(`todolist/${taskId}`, { key: 'id' });
            if (workItem) {
                if (varName == 'user_input_text') {
                    if (!workItem.output) workItem.output = {};
                    if (!workItem.output[varName]) workItem.output[varName] = '';
                    workItem.output[varName] = varValue[varName];
                } else {
                    if (workItem.adhoc && !workItem.tool) workItem.tool = 'formHandler:defaultform';
                    const formId = workItem.tool.replace('formHandler:', '');
                    if (formId) {
                        if (!workItem.output) workItem.output = {};
                        if (!workItem.output[formId]) workItem.output[formId] = {};
                        workItem.output[formId] = varValue;
                    }
                }
            }
            await storage.putObject('todolist', workItem);
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getRoleMapping(_instId: string, _roleName: string) {
        console.warn(`[ProcessGPT] getRoleMapping은 ProcessGPT 모드에서 지원되지 않습니다.`);
        return null as any;
    }

    async setRoleMapping(_instanceId: string, _roleName: string, _roleMapping: any) {
        console.warn(`[ProcessGPT] setRoleMapping은 ProcessGPT 모드에서 지원되지 않습니다.`);
        return null as any;
    }

    async signal(_instanceId: string, _signal: string) {
        console.warn(`[ProcessGPT] signal은 ProcessGPT 모드에서 지원되지 않습니다.`);
        return null as any;
    }

    async serviceMessage(_requestPath: string) {
        console.warn(`[ProcessGPT] serviceMessage은 ProcessGPT 모드에서 지원되지 않습니다.`);
        return null as any;
    }

    async postMessage(_instanceId: string, _message: any) {
        console.warn(`[ProcessGPT] postMessage은 ProcessGPT 모드에서 지원되지 않습니다.`);
        return null as any;
    }

    async getInProgressList(options?: any) {
        const completedOptions = { ...options, status: 'IN_PROGRESS' };
        return this.getWorkList(completedOptions);
    }

    async getCompletedList(options?: any) {
        const completedOptions = { ...options, status: 'DONE' };
        return this.getWorkList(completedOptions);
    }

    async getPendingList(options?: any) {
        const completedOptions = { ...options, status: 'PENDING' };
        return this.getWorkList(completedOptions);
    }

    async getAllWorkListByInstId(instId: number) {
        const byInstId = await this.getWorkListByInstId(instId);
        const byRootInstId = await this.getWorkListByRootInstId(instId);
        const seen = new Set(byInstId.map((item: any) => item.taskId));
        const merged = [...byInstId];
        for (const item of byRootInstId) {
            if (!seen.has(item.taskId)) {
                merged.push(item);
                seen.add(item.taskId);
            }
        }
        return merged;
    }

    async putWorkItemComplete(taskId: string, inputData: any) {
        try {
            const me = this;
            if (window.$jms) return;

            const workItem = await storage.getObject(`todolist/${taskId}`, { key: 'id' });
            let answer = '';

            if (inputData['user_input_text'] && inputData['user_input_text'] != '') {
                answer = inputData['user_input_text'];
                const newMessage = {
                    name: localStorage.getItem('userName'),
                    role: 'user',
                    email: localStorage.getItem('email'),
                    image: '',
                    content: inputData['user_input_text'],
                    timeStamp: new Date().toISOString()
                };
                me.updateInstanceChat(workItem.proc_inst_id, newMessage);
            }

            const formId = inputData.formId || inputData.tool?.replace('formHandler:', '') || workItem.tool.replace('formHandler:', '');
            const formValues = {};
            if (formId && inputData.parameterValues) {
                formValues[formId] = inputData.parameterValues;
            }

            const input = {
                answer: answer,
                form_values: formValues,
                process_instance_id: workItem.proc_inst_id,
                process_definition_id: workItem.proc_def_id,
                activity_id: workItem.activity_id,
                chat_room_id: workItem.proc_inst_id,
                task_id: workItem.id,
                // complete 호출 시에도 todolist 버전 정보를 함께 전달
                version_tag: (workItem as any).version_tag || null,
                version: (workItem as any).version || null
            };

            // Task 실행 속성은 DB 트리거(todolist INSERT/UPDATE)에서 자동 처리됨
            const result = await me.executeInstance(input);

            return result;
        } catch (error) {
            return error;
        }
    }

    async updateInstanceChat(instanceId: string, newMessage: any, threadId: string = null, msgId?: string) {
        try {
            const uuid = msgId || this.uuid();
            const putObj = {
                id: instanceId,
                uuid: uuid,
                messages: newMessage,
                thread_id: threadId || null
            };
            await storage.putObject('chats', putObj);
        } catch (e) {
            //@ts-ignore
            throw new Error(e.message);
        }
    }

    async fetchInstances(callback: (payload: any) => void) {
        try {
            const subscription = await storage.watch('bpm_proc_inst', 'bpm_proc_inst', (payload) => {
                if (payload && payload.new && payload.eventType) {
                    const instance = payload.new;
                    if (callback) {
                        callback(this.returnInstanceObject(instance));
                    }
                }
            });

            return subscription;
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async fetchInstanceListByStatus(status: string): Promise<any[]> {
        const me = this;
        const list = await storage.list('bpm_proc_inst', { match: { status: status } });
        const email = window.localStorage.getItem('email');
        const filteredData = list.filter((item: any) => item.participants.includes(email));

        if (filteredData && filteredData.length > 0) {
            return filteredData.map((item: any) => {
                return me.returnInstanceObject(item);
            });
        }
        return [];
    }

    async getInstanceList(options?: any) {
        try {
            const me = this;
            if (!options) {
                // 기본 정렬
                options = {
                    orderBy: 'start_date',
                    sort: 'desc',
                    secondaryOrderBy: 'proc_inst_id',
                    secondarySort: 'asc'
                };
            }

            const lists = await storage.list('bpm_proc_inst', options);
            if (lists && lists.length > 0) {
                return lists
                    .filter((item: any) => !item.parent_proc_inst_id)
                    .map((item: any) => {
                        return me.returnInstanceObject(item);
                    });
            }
            return [];
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getInstanceListByStatus(status: string[], options?: any) {
        try {
            const me = this;
            if (!options) options = {};
            if (!status) return [];
            if (status.includes('*')) status = ['NEW', 'RUNNING', 'COMPLETED'];
            const uid = window.localStorage.getItem('uid');
            const filter = {
                inArray: {
                    column: 'status',
                    values: status
                },
                matchArray: {
                    column: 'participants',
                    values: [uid]
                },
                orderBy: 'start_date',
                sort: 'desc',
                secondaryOrderBy: 'proc_inst_id',
                secondarySort: 'asc',
                range: null,
                like: null
            };

            if (options) {
                Object.keys(options).forEach((key) => {
                    filter[key] = options[key];
                });
            }
            return await me.getInstanceList(filter);
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async watchInstanceList(callback: (payload: any) => void, options?: any) {
        try {
            if (!options) options = {};
            const statusFilter = options.status || [];
            if (statusFilter.includes('*')) {
                options.status = ['NEW', 'RUNNING', 'DONE', 'COMPLETED', 'PENDING', 'IN_PROGRESS'];
            }
            const uid = window.localStorage.getItem('uid');

            return await storage._watch(
                {
                    channel: `instance-${uid}-${Date.now()}`,
                    table: 'bpm_proc_inst'
                },
                (payload) => {
                    if (statusFilter.length > 0) {
                        const newStatus = payload.new?.status;
                        const oldStatus = payload.old?.status;
                        if (!statusFilter.includes(newStatus) && !statusFilter.includes(oldStatus)) {
                            return;
                        }
                    }

                    if (payload.eventType === 'DELETE') {
                        callback(payload);
                    } else {
                        if (payload.new?.participants?.includes(uid)) {
                            callback(payload);
                        } else if (payload.old?.participants?.includes(uid)) {
                            callback(payload);
                        }
                    }
                }
            );
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async watchInstance(instanceId: string, callback: (instance: any, payload: any) => void) {
        try {
            if (!instanceId) return null;

            return await storage._watch(
                {
                    channel: `instance-${instanceId}-${Date.now()}`,
                    table: 'bpm_proc_inst',
                    filter: `proc_inst_id=eq.${instanceId}`
                },
                (payload) => {
                    const row = payload.new || payload.old;
                    callback(row ? this.returnInstanceObject(row) : null, payload);
                }
            );
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async watchWorkList(callback: (payload: any) => void, options?: any) {
        try {
            let filter = options?.filter;
            if (!filter && options?.rootInstId) {
                filter = `root_proc_inst_id=eq.${options.rootInstId}`;
            }
            if (!filter && options?.instId) {
                filter = `proc_inst_id=eq.${options.instId}`;
            }
            return await storage._watch(
                {
                    channel: options?.channel || `workitem-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    table: 'todolist',
                    ...(filter ? { filter } : {})
                },
                (payload) => {
                    callback(payload);
                }
            );
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getInstanceListByRole(roles: string) {
        // return this.getInstanceList();
        return this.getInstanceListByStatus(['NEW', 'RUNNING']);
    }

    async getInstanceListByGroup(group: string) {
        return null;
    }

    async getCompleteInstanceList(filter) {
        try {
            return this.getInstanceListByStatus(['COMPLETED']);
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getWorkListByInstId(instId: number) {
        try {
            const list = await storage.list('todolist', { match: { proc_inst_id: instId } });
            const worklist: any[] = list
                .filter((item: any) => !((!item.tool || item.tool === '') && item.description === 'start event'))
                .map((item: any) => {
                    return this.returnWorkItemObject(item);
                });
            return worklist;
        } catch (e) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getWorkListByRootInstId(rootInstId: number) {
        try {
            const list = await storage.list('todolist', { match: { root_proc_inst_id: rootInstId } });
            const worklist: any[] = list
                .filter((item: any) => !((!item.tool || item.tool === '') && item.description === 'start event'))
                .map((item: any) => {
                    return this.returnWorkItemObject(item);
                });
            return worklist;
        } catch (e) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getFilteredInstanceList(filters: object, page: number) {
        //TODO: 인스턴스 목록 관리자 페이지 필터 결과
        return null;
    }

    async getCompletedTaskId(instId: string) {
        // instance/{instanceId}/completed
        //TODO: 현재 완료된 태스크 ID 가져오기

        return null;
    }

    async getActivitiesStatus(instId: string, executionScope = '0') {
        // instance/{instanceId}/completed
        //TODO: 현재 프로세스 진행상태 추가
        try {
            const list = await storage.list('todolist', { match: { proc_inst_id: instId } });
            const result: any = {};
            const procDefId = list.find((item: any) => item?.proc_def_id)?.proc_def_id;
            const callActivityIds = await this.getCallActivityIdsForDefinition(procDefId);

            // activity_id별로 그룹화하고 rework_count가 큰 순서로 정렬
            const groupedByActivity = list.reduce((acc: any, item: any) => {
                if (!acc[item.activity_id]) {
                    acc[item.activity_id] = [];
                }
                acc[item.activity_id].push(item);
                return acc;
            }, {});

            // 각 activity_id별로 rework_count가 가장 큰 아이템을 선택
            Object.keys(groupedByActivity).forEach((activityId) => {
                const items = groupedByActivity[activityId];
                // rework_count가 큰 순서로 정렬 (내림차순)
                const sortedItems = items.sort((a: any, b: any) => (b.rework_count || 0) - (a.rework_count || 0));
                const selectedItem = sortedItems[0]; // 가장 큰 rework_count를 가진 아이템
                const isCallActivity = callActivityIds.has(selectedItem.activity_id);

                if (selectedItem.status == 'DONE') {
                    result[selectedItem.activity_id] = 'Completed';
                } else if (selectedItem.status == 'IN_PROGRESS' || selectedItem.status == 'SUBMITTED') {
                    result[selectedItem.activity_id] = 'Running';
                } else if (selectedItem.status == 'PENDING') {
                    result[selectedItem.activity_id] = isCallActivity ? 'Running' : 'Pending';
                } else if (selectedItem.status == 'TODO') {
                    result[selectedItem.activity_id] = 'New';
                } else if (selectedItem.status == 'CANCELLED') {
                    result[selectedItem.activity_id] = 'Cancelled';
                }
            });

            return result;
        } catch (e) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    private async getCallActivityIdsForDefinition(procDefId?: string): Promise<Set<string>> {
        if (!procDefId) return new Set();

        try {
            const procDef = await storage.getObject('proc_def', {
                match: { id: procDefId }
            });
            const rawDefinition = procDef?.definition;
            const definition = typeof rawDefinition === 'string' ? JSON.parse(rawDefinition) : rawDefinition;
            const activities = Array.isArray(definition?.activities) ? definition.activities : [];
            return new Set(
                activities
                    .filter((activity: any) => String(activity?.type || '').toLowerCase() === 'callactivity')
                    .map((activity: any) => activity?.id)
                    .filter(Boolean)
            );
        } catch (error) {
            console.warn('[ProcessGPTBackend] Failed to resolve CallActivity ids for activity status.', error);
            return new Set();
        }
    }

    async getEventList(instanceId: string) {
        try {
            return null;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async fetchEventList(options?: any) {
        try {
            const response = await storage.list('events', options);
            return response;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async fireMessage(_instanceId: string, _event: any) {
        console.warn(`[ProcessGPT] fireMessage은 ProcessGPT 모드에서 지원되지 않습니다.`);
        return null as any;
    }

    async dryRun(isSimulate: string, command: object) {
        try {
            return null;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async startAndComplete(command: object, isSimulate: string) {
        try {
            return null;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async putSystem(system: any) {
        try {
            return null;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async deleteSystem(system: any) {
        try {
            return null;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getSystemList() {
        try {
            return [];
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getSystem(systemId: string) {
        try {
            return {};
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async validate(xml: string) {
        try {
            // BPMN XML 유효성 검사 실행
            const i18nFunc = window.$i18n?.global?.t;
            return runValidation(xml, i18nFunc);
        } catch (error) {
            console.warn('BPMN validation error:', error);
            //@ts-ignore
            return {};
        }
    }

    async getCurrentWorkItemByCorrKey(corrKey: number) {
        try {
            return null;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async putInstance(instId: string, instItem: any) {
        try {
            return await storage.putObject('bpm_proc_inst', {
                proc_inst_id: instId || this.uuid(),
                proc_def_id: instItem.procDefId,
                proc_def_version: instItem.procDefVersion,
                proc_inst_name: instItem.name,
                current_activity_ids: instItem.currentActivityIds || [],
                participants: instItem.participants || [],
                role_bindings: instItem.roleBindings || [],
                variables_data: instItem.variablesData || [],
                status: instItem.status,
                tenant_id: instItem.tenantId || window.$tenantName,
                start_date: instItem.startDate,
                end_date: instItem.endDate,
                due_date: instItem.dueDate,
                project_id: instItem.projectId
            });
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getDeletedInstances() {
        try {
            return await storage.list('bpm_proc_inst', { match: { is_deleted: true } });
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async deleteInstance(instId: string) {
        try {
            await Promise.all([
                await storage.putObject('bpm_proc_inst', { proc_inst_id: instId, is_deleted: true, deleted_at: new Date().toISOString() })
                // await storage.delete('bpm_proc_inst', { match: { proc_inst_id: instId } }),
                // await storage.delete('todolist', { match: { proc_inst_id: instId } }),
                // await storage.delete('chats', { match: { id: instId } })
            ]);
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async restoreInstance(instId: string) {
        try {
            await storage.putObject('bpm_proc_inst', { proc_inst_id: instId, is_deleted: false, deleted_at: null });
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async bindRole(roles: any, defId?: string) {
        try {
            let result: any = null;
            await axios
                .post(`/completion/role-binding`, {
                    input: {
                        roles: roles,
                        uuid: localStorage.getItem('uid'),
                        proc_def_id: defId || null
                    }
                })
                .then((res) => {
                    if (res.data) {
                        const data = JSON.parse(res.data);
                        result = data.roleBindings;
                    }
                })
                .catch((error) => {
                    return null;
                });
            return result;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async watchChats(callback: (payload: any) => void, options: any = {}) {
        try {
            const channel = options?.channel || `chats-${Date.now()}-${Math.random().toString(16).slice(2)}`;
            return await storage._watch(
                {
                    channel,
                    table: 'chats',
                    filter: options?.filter || null
                },
                (payload) => {
                    callback(payload);
                }
            );
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async watchTenantSkills(callback: (payload: any) => void, options: any = {}) {
        try {
            const channel = options?.channel || `tenant-skills-${Date.now()}-${Math.random().toString(16).slice(2)}`;
            return await storage._watch(
                {
                    channel,
                    table: 'tenant_skills',
                    filter: options?.filter || null
                },
                (payload) => {
                    callback(payload);
                }
            );
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async watchNotifications(callback: (payload: any) => void) {
        try {
            return await storage._watch(
                {
                    channel: 'notifications',
                    table: 'notifications'
                },
                (payload) => {
                    callback(payload);
                }
            );
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async fetchNotifications() {
        try {
            let notifications: any[] = [];
            const userId = localStorage.getItem('email');
            const userUuid = (() => {
                try {
                    return JSON.parse(localStorage.getItem('sb-127-auth-token') || '{}')?.user?.id;
                } catch {
                    return null;
                }
            })();
            const userIds = [userId, ...(userUuid && userUuid !== userId ? [userUuid] : [])].filter(Boolean);
            const options: any = {
                size: 50,
                orderBy: 'time_stamp',
                sort: 'desc',
                match: { is_checked: false },
                inArray: { column: 'user_id', values: userIds }
            };
            const list = await storage.list('notifications', options);
            if (list.length > 0) {
                notifications = Object.values(
                    list.reduce((acc: any, item: any) => {
                        const timeStamp = formatDistanceToNowStrict(new Date(item.time_stamp), {
                            addSuffix: false
                        });
                        item.timeStamp = timeStamp;
                        if (!acc[item.url]) {
                            item.count = 1;
                            acc[item.url] = item;
                        } else if (new Date(item.time_stamp) > new Date(acc[item.url].time_stamp)) {
                            item.count = acc[item.url].count + 1;
                            acc[item.url] = item;
                        } else {
                            acc[item.url].count += 1;
                        }
                        return acc;
                    }, {})
                );
            }

            notifications = notifications.filter((item: any) => !item.is_checked);
            return notifications;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async setNotifications(value: any) {
        try {
            const userId = value.user_id ?? localStorage.getItem('email');
            // 같은 채팅방(url)의 미확인 알림을 DB에서 모두 조회하여 한 번에 읽음 처리
            if (value.url && userId) {
                const list = await storage.list('notifications', {
                    match: { url: value.url, user_id: userId, is_checked: false }
                });
                await Promise.all(list.map((item: any) => storage.putObject('notifications', { id: item.id, is_checked: true })));
                return;
            }
            // url 없으면 클릭한 항목만 읽음 처리
            const putObj = { id: value.id, is_checked: true };
            await storage.putObject('notifications', putObj);
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    private async sendNotification(params: {
        userId: string;
        type: string;
        title: string;
        description?: string;
        url?: string;
        fromUserId?: string;
    }): Promise<void> {
        try {
            await storage.putObject('notifications', {
                id: this.uuid(),
                user_id: params.userId,
                type: params.type,
                title: params.title,
                description: params.description || null,
                url: params.url || null,
                is_checked: false,
                time_stamp: new Date().toISOString(),
                from_user_id: params.fromUserId || null
            });
        } catch (e) {
            console.warn('[sendNotification] 알림 발송 실패:', e);
        }
    }

    private async getResourceOwner(resourceType: 'skill' | 'bpmn' | 'dmn', resourceId: string): Promise<string | null> {
        try {
            if (resourceType === 'skill') return await this.getSkillOwner(resourceId);
            const row: any = await storage.getObject('proc_def', {
                match: { id: resourceId, tenant_id: window.$tenantName }
            });
            return row?.owner ?? null;
        } catch {
            return null;
        }
    }

    private getResourcePrUrl(resourceType: string, resourceId: string): string {
        if (resourceType === 'skill') return `/skills/${resourceId}`;
        if (resourceType === 'dmn') return `/dmn/${resourceId}`;
        return `/process/${resourceId}`;
    }

    async search(keyword: string, callback?: (results: any[]) => void) {
        try {
            let results: any[] = [];

            const dbPromise = storage.search ? storage.search(keyword) : Promise.resolve([]);
            const vectorPromise = this.searchVector(keyword);
            const agentPromise = this.searchAgents(keyword);

            results.push({
                type: 'loading',
                header: '유사한 결과 검색 중...',
                list: []
            });

            const dbResult = await dbPromise;
            results = [...results, ...dbResult];

            const agentResult = await agentPromise;
            if (agentResult) {
                results.push(agentResult);
            }

            if (callback) {
                callback(results);
            }

            vectorPromise
                .then(async (vectorResult) => {
                    if (vectorResult && vectorResult.length > 0) {
                        const procDefs = await storage.list('proc_def', { match: { isdeleted: false } });
                        let list = procDefs.filter((item: any) => vectorResult.includes(item.id));
                        list = list.map((item: any) => {
                            return {
                                title: item.name,
                                href: `/definitions/${item.id}`,
                                matches: [item.bpmn]
                            };
                        });
                        if (list.length > 0) {
                            const loadingIndex = results.findIndex((item) => item.type === 'loading');
                            if (loadingIndex !== -1) {
                                results.splice(loadingIndex, 1, {
                                    type: 'similar-definition',
                                    header: '유사한 프로세스 정의',
                                    list: list
                                });
                            }
                        }
                    }
                    const newResults = results.filter((item: any) => item.type !== 'loading');
                    if (callback) {
                        callback(newResults);
                    }
                })
                .catch((error) => {
                    console.error('Vector search error:', error);
                    const newResults = results.filter((item: any) => item.type !== 'loading');
                    if (callback) {
                        callback(newResults);
                    }
                });
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async searchVector(keyword: string) {
        try {
            const list = [];
            const response = await axios.post('/completion/process-search', {
                query: keyword
            });
            let vectorResult = response.data;
            if (vectorResult && vectorResult.length > 0) {
                vectorResult = vectorResult.map((item: any) => {
                    const matchingColumns = item.page_content.split(': ');
                    const content = JSON.parse(matchingColumns[1]);
                    return content.processDefinitionId;
                });
            }

            const uniqueList = vectorResult.filter((item, index, self) => {
                if (item) {
                    return index === self.findIndex((t) => t === item);
                }
            });
            return uniqueList;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async searchAgents(keyword: string) {
        try {
            const agentList = await this.getAgentList();
            const lowerKeyword = keyword.toLowerCase();

            const filteredAgents = agentList.filter((agent: any) => {
                const name = agent.username || agent.name || '';
                const role = agent.role || '';
                return name.toLowerCase().includes(lowerKeyword) || role.toLowerCase().includes(lowerKeyword);
            });

            if (filteredAgents.length > 0) {
                return {
                    type: 'agent',
                    header: 'headerMenu.agent',
                    list: filteredAgents.map((agent: any) => ({
                        title: agent.username || agent.name,
                        href: `/agent-chat/${agent.id}`,
                        matches: [agent.role || ''],
                        img: agent.profile || agent.img
                    }))
                };
            }

            return null;
        } catch (error) {
            console.error('Agent search error:', error);
            return null;
        }
    }

    async getDeletedTenants() {
        try {
            const tenants = await storage.list('tenants', {
                match: {
                    is_deleted: true
                }
            });
            return tenants;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getUserAllTenants() {
        try {
            const uid: string = localStorage.getItem('uid') || '';
            const options = {
                orderBy: 'username',
                sort: 'asc',
                match: {
                    id: uid
                }
            };
            const users = await storage.list('users', options);
            return users;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getUserList(options: any) {
        try {
            if (!options) options = {};

            const filter = {
                orderBy: 'username',
                sort: 'asc',
                match: {
                    tenant_id: window.$tenantName
                }
            };

            if (options) {
                Object.keys(options).forEach((key) => {
                    filter[key] = options[key];
                });
                return await storage.list('users', filter);
            }

            const defaultSetting = useDefaultSetting();
            const defaultAgents = defaultSetting.getAgentList;
            const users = await storage.list('users', filter);

            return [...defaultAgents, ...users];
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getGroupList() {
        try {
            const options = {
                match: {
                    key: 'organization'
                }
            };
            const result = await storage.getObject('configuration', options);
            const value = result.value;
            if (value && value.chart && value.chart.children) {
                return value.chart.children;
            } else {
                return [];
            }
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getAgentList() {
        try {
            const list = await storage.list('users', { match: { is_agent: true, tenant_id: window.$tenantName } });
            // 임시저장(draft, is_draft=true) 에이전트는 목록에서 제외(기존 null/false 는 유지).
            const visible = (list || []).filter((a: any) => a && a.is_draft !== true);
            const defaultSetting = useDefaultSetting();
            const defaultAgents = defaultSetting.getAgentList;
            return [...defaultAgents, ...visible];
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getAgent(agentId: string) {
        try {
            const options = {
                match: {
                    id: agentId,
                    is_agent: true
                }
            };
            const agent = await storage.getObject('users', options);
            return agent;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    /** 임시저장(draft) 에이전트를 정식 등록으로 승격(is_draft=false) — 목록에 노출. */
    async promoteDraftAgent(agentId: string) {
        const id = String(agentId || '').trim();
        if (!id) return;
        await storage.putObject('users', { id, tenant_id: window.$tenantName, is_draft: false }, { onConflict: 'id,tenant_id' });
    }

    async putAgent(newAgent: any) {
        try {
            const isGs = window.$gs;
            const putObj: any = {
                id: newAgent.id,
                username: newAgent.name,
                // users.email 이 NOT NULL 인 스키마에서 신규 에이전트 insert 가 400 나는 것을 방지.
                ...(newAgent.email ? { email: newAgent.email } : {}),
                role: newAgent.role,
                goal: newAgent.goal,
                persona: newAgent.persona,
                endpoint: newAgent.endpoint,
                description: newAgent.description,
                tools: newAgent.tools,
                profile: newAgent.img,
                skills: newAgent.skills,
                model: newAgent.model,
                tenant_id: window.$tenantName,
                is_agent: newAgent.isAgent,
                agent_type: newAgent.type,
                alias: newAgent.alias,
                // 임시저장(draft) 플래그 — true 면 에이전트 목록에서 숨기고, 저장 시 false 로 승격.
                ...(Object.prototype.hasOwnProperty.call(newAgent, 'is_draft') ? { is_draft: !!newAgent.is_draft } : {}),
                ...(isGs ? {} : { tool_priority: newAgent.tool_priority ?? null })
            };

            await storage.putObject('users', putObj);

            if (!isGs && putObj.id) {
                const skillsArray =
                    typeof putObj.skills === 'string'
                        ? putObj.skills
                              .split(',')
                              .map((s: string) => s.trim())
                              .filter((s: string) => s.length > 0)
                        : Array.isArray(putObj.skills)
                        ? putObj.skills
                        : [];

                try {
                    await this.replaceAgentSkills({
                        userId: putObj.id,
                        skills: skillsArray,
                        tenantId: putObj.tenant_id || window.$tenantName
                    });
                } catch (syncError) {
                    console.error('[ProcessGPTBackend] replaceAgentSkills error:', syncError);
                }
            }
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async deleteAgent(agentId: string) {
        try {
            await storage.delete('users', { match: { id: agentId } });
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    // agent_skills
    /**
     * agent_skills 조회 (tenant_id 기본 적용)
     */
    async getAgentSkills(options?: {
        tenantId?: string;
        userId?: string;
        skillName?: string;
        orderBy?: string;
        sort?: 'asc' | 'desc';
    }): Promise<any[]> {
        try {
            const tenantId = options?.tenantId || window.$tenantName;
            const match: any = { tenant_id: tenantId };
            if (options?.userId) match.user_id = options.userId;
            if (options?.skillName) match.skill_name = options.skillName;

            const result = await storage.list('agent_skills', {
                match,
                ...(options?.orderBy ? { orderBy: options.orderBy } : {}),
                ...(options?.sort ? { sort: options.sort } : {})
            });
            return Array.isArray(result) ? result : result || [];
        } catch (error) {
            console.error('[ProcessGPTBackend] getAgentSkills error:', error);
            return [];
        }
    }

    /**
     * 특정 스킬을 사용하는 agent_skills 행 조회
     */
    async getAgentSkillsBySkill(skillName: string, tenantId?: string): Promise<any[]> {
        return await this.getAgentSkills({
            tenantId: tenantId || window.$tenantName,
            skillName,
            orderBy: 'created_at',
            sort: 'desc'
        });
    }

    /**
     * 특정 에이전트(user_id)의 스킬 목록(agent_skills 기준)
     */
    async getAgentSkillsByUser(userId: string, tenantId?: string): Promise<any[]> {
        return await this.getAgentSkills({
            tenantId: tenantId || window.$tenantName,
            userId,
            orderBy: 'created_at',
            sort: 'desc'
        });
    }

    /**
     * agent_skills 단건 upsert (user_id, tenant_id, skill_name 기준)
     */
    async upsertAgentSkill(params: { userId: string; skillName: string; tenantId?: string }): Promise<any> {
        try {
            const tenantId = params.tenantId || window.$tenantName;
            const row: any = {
                user_id: params.userId,
                tenant_id: tenantId,
                skill_name: params.skillName,
                created_at: new Date().toISOString()
            };
            // onConflict 지원(다른 테이블에서도 사용 중) — 없더라도 storage 구현에 따라 무시될 수 있음
            return await storage.putObject('agent_skills', row, { onConflict: 'user_id,tenant_id,skill_name' });
        } catch (error) {
            console.error('[ProcessGPTBackend] upsertAgentSkill error:', error);
            throw error;
        }
    }

    /**
     * 에이전트의 스킬을 agent_skills 기준으로 "덮어쓰기" 동기화
     * - 기존 user_id/tenant_id 매핑 전부 삭제 후
     * - 전달된 skills를 upsert
     */
    async replaceAgentSkills(params: { userId: string; skills: string[]; tenantId?: string }): Promise<void> {
        const tenantId = params.tenantId || window.$tenantName;
        const skills = Array.isArray(params.skills) ? params.skills : [];
        const normalized = skills.map((s) => String(s).trim()).filter(Boolean);

        try {
            await storage.delete('agent_skills', { match: { user_id: params.userId, tenant_id: tenantId } });
            for (const skillName of normalized) {
                await this.upsertAgentSkill({ userId: params.userId, tenantId, skillName });
            }
        } catch (error) {
            console.error('[ProcessGPTBackend] replaceAgentSkills error:', error);
            throw error;
        }
    }

    /**
     * agent_skills 단건 삭제
     */
    async deleteAgentSkill(params: { userId: string; skillName: string; tenantId?: string }): Promise<void> {
        try {
            const tenantId = params.tenantId || window.$tenantName;
            await storage.delete('agent_skills', {
                match: {
                    user_id: params.userId,
                    tenant_id: tenantId,
                    skill_name: params.skillName
                }
            });
        } catch (error) {
            console.error('[ProcessGPTBackend] deleteAgentSkill error:', error);
            throw error;
        }
    }

    /**
     * 특정 스킬에 대한 agent_skills 매핑 전체 삭제 (예: 스킬 삭제 시 정리)
     */
    async deleteAgentSkillsBySkill(params: { skillName: string; tenantId?: string }): Promise<void> {
        try {
            const tenantId = params.tenantId || window.$tenantName;
            await storage.delete('agent_skills', {
                match: {
                    tenant_id: tenantId,
                    skill_name: params.skillName
                }
            });
        } catch (error) {
            console.error('[ProcessGPTBackend] deleteAgentSkillsBySkill error:', error);
            throw error;
        }
    }

    async checkAgentAlias(alias: string, id: string) {
        try {
            const options = {
                match: {
                    alias: alias,
                    tenant_id: window.$tenantName
                }
            };
            const existingAgent = await storage.getObject('users', options);
            if (existingAgent && existingAgent.id !== id) {
                return { error: true, message: 'Alias already exists' };
            }
            return { error: false, message: 'Alias is available' };
        } catch (error) {
            //@ts-ignore
            return { error: true, message: error.message };
        }
    }

    async fetchAgentData(endpoint: string) {
        try {
            const response = await axios.get(`/completion/multi-agent/fetch-data?agent_url=${encodeURIComponent(endpoint)}`);
            return response.data;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async setupAgentKnowledge(params: { agent_id: string; goal?: string | null; persona?: string | null }): Promise<any> {
        try {
            const response = await axios.post('/agent-feedback/setup-agent-knowledge', params);
            return response.data;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getUserInfo() {
        try {
            const user = await storage.getUserInfo();
            return user;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async updateUserInfo(value: any) {
        try {
            if (value.type === 'update') {
                value.user.tenant_id = window.$tenantName;
                await storage.putObject('users', value.user);
                const user: any = await this.getUserInfo();
                if (user && value.user.id === user.uid) {
                    const userInfo = {
                        email: value.user.email,
                        user_metadata: {
                            name: value.user.username
                        }
                    };
                    await this.updateUser(userInfo);
                    await storage.writeUserData(value);
                }
            } else if (value.type === 'delete') {
                await storage.delete('users', { match: { id: value.user.id } });
            }
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async delegateSuperAdmin(targetUserId: string) {
        try {
            if (!targetUserId) {
                throw new Error('Target user is required');
            }

            const result: any = await storage.callProcedure('delegate_super_admin', {
                p_new_super_admin_id: targetUserId,
                p_tenant_id: window.$tenantName
            });

            const payload = Array.isArray(result) ? result[0] : result;
            if (!payload || payload.success === false) {
                throw new Error(payload?.error || 'Failed to delegate super admin');
            }

            // 위임 직후 현재 사용자는 admin으로 강등되므로 로컬 상태를 즉시 동기화
            localStorage.setItem('role', 'admin');
            localStorage.setItem('isAdmin', 'true');
            window.dispatchEvent(new CustomEvent('localStorageChange', { detail: { key: 'role', value: 'admin' } }));
            window.dispatchEvent(new CustomEvent('localStorageChange', { detail: { key: 'isAdmin', value: true } }));

            return payload;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async uploadDefinition(file: File, path: string) {}

    async getLock(id: string) {
        try {
            const options = {
                match: {
                    id: id,
                    tenant_id: window.$tenantName
                }
            };
            const lock = await storage.getObject('lock', options);
            return lock;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async setLock(lockObj: any) {
        try {
            const putObj: any = {
                id: lockObj.id,
                user_id: lockObj.user_id,
                tenant_id: window.$tenantName
            };
            const lock = await this.getLock(lockObj.id);
            if (lock && lock.tenant_id === window.$tenantName) {
                putObj.uuid = lock.uuid;
                await storage.putObject('lock', putObj);
            } else {
                await storage.putObject('lock', putObj);
            }
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async deleteLock(id: string) {
        try {
            const options = {
                match: {
                    id: id,
                    tenant_id: window.$tenantName
                }
            };
            await storage.delete('lock', options);
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    // Force checkout: notify the current editor that someone else is taking over
    async forceCheckout(id: string, newUserId: string) {
        try {
            const lock = await this.getLock(id);
            if (lock && lock.user_id && lock.user_id !== newUserId) {
                // Update lock with force_checkout info
                const putObj: any = {
                    id: id,
                    user_id: lock.user_id,
                    tenant_id: window.$tenantName,
                    uuid: lock.uuid,
                    force_checkout_by: newUserId,
                    force_checkout_at: new Date().toISOString()
                };
                await storage.putObject('lock', putObj);
                return { success: true, previousUser: lock.user_id };
            }
            return { success: false, previousUser: null };
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    // Clear force checkout flags after handover is complete
    async clearForceCheckout(id: string) {
        try {
            const lock = await this.getLock(id);
            if (lock) {
                const putObj: any = {
                    id: id,
                    user_id: lock.user_id,
                    tenant_id: window.$tenantName,
                    uuid: lock.uuid,
                    force_checkout_by: null,
                    force_checkout_at: null
                };
                await storage.putObject('lock', putObj);
            }
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getTenants() {
        try {
            const uid: string = localStorage.getItem('uid') || '';
            const tenants = await storage.list('tenants', {
                match: {
                    owner: uid
                }
            });
            return tenants;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getTenant(tenantId: string) {
        try {
            const tenant = await storage.getString('tenants', {
                match: {
                    id: tenantId
                },
                column: 'id'
            });
            return tenant;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async setTenant(tenantId: string) {
        try {
            if (!tenantId) {
                return;
            }
            const user: any = await this.getUserInfo();
            if (!user || !user.uid) {
                return false;
            }
            const user_id = user.uid;
            const request = {
                input: {
                    user_id: user_id,
                    user_info: {
                        app_metadata: {
                            tenant_id: tenantId
                        }
                    }
                }
            };
            const response = await axios.post('/completion/set-tenant', request);
            if (response.status === 200) {
                // auth.users 메타데이터 갱신 후에도 클라이언트 JWT는 그대로이므로 RLS(tenant_id())가 옛 tenant_id 를 씀.
                // refresh 로 새 access token 을 받아 app_metadata.tenant_id 와 DB 를 맞춘다.
                await storage.refreshSession({ clearOnError: false });

                const isOwner = await storage.checkTenantOwner(tenantId);
                // email/username을 넣지 않으면 upsert 시 새 행은 null로 들어가 유령 레코드가 됨 (setTenant가 원인)
                const putObj: any = {
                    id: user_id,
                    role: isOwner ? 'superAdmin' : 'user',
                    tenant_id: tenantId,
                    email: user.email ?? (typeof localStorage !== 'undefined' ? localStorage.getItem('email') : null) ?? undefined,
                    username: user.name ?? (typeof localStorage !== 'undefined' ? localStorage.getItem('userName') : null) ?? undefined
                };
                if (isOwner) {
                    putObj.is_admin = true;
                }
                await storage.putObject('users', putObj);
                return await storage.isConnection();
            } else {
                return false;
            }
        } catch (error) {
            //@ts-ignore
            // console.log(error);
            return false;
            // throw new Error(error.message);
        }
    }

    async putTenant(tenantId: string) {
        try {
            if (!tenantId) {
                throw new Error('Tenant ID cannot be null or empty');
            }
            await storage.putObject('tenants', { id: tenantId });
            const user: any = await this.getUserInfo();
            await storage.putObject('users', {
                id: user.uid,
                email: user.email,
                username: user.name,
                role: 'superAdmin',
                is_admin: true,
                tenant_id: tenantId
            });

            if (window.$tenantName !== 'localhost') {
                for (const process of defaultProcessesData.defaultProcesses) {
                    try {
                        await this.duplicateDefinition(
                            {
                                id: process.id,
                                name: process.name,
                                author_uid: process.author_uid
                            },
                            tenantId
                        );
                    } catch (error) {
                        console.warn(`Failed to duplicate process ${process.id}:`, error);
                    }
                }
            }
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async deleteTenant(tenantId: string) {
        try {
            await storage.delete('tenants', { match: { id: tenantId } });
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async restoreTenant(tenantId: string) {
        try {
            await storage.putObject('tenants', { id: tenantId, is_deleted: false, deleted_at: null });
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async inviteUser(userInfo: any) {
        try {
            const request = {
                input: userInfo
            };
            const response = await axios.post('/completion/invite-user', request);
            if (response.status === 200) {
                if (response.data) {
                    return response.data;
                } else {
                    const newUser = await storage.getObject('users', {
                        match: {
                            email: userInfo.email,
                            tenant_id: userInfo.tenant_id
                        }
                    });
                    return { user: newUser };
                }
            } else {
                return { error: true, message: response.data.message };
            }
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async createUser(userInfo: any) {
        try {
            const request = {
                input: userInfo
            };
            const response = await axios.post('/completion/create-user', request);
            if (response.status === 200) {
                if (response.data) {
                    return response.data;
                } else {
                    const newUser = await storage.getObject('users', {
                        match: {
                            email: userInfo.email,
                            tenant_id: window.$tenantName
                        }
                    });
                    return { user: newUser };
                }
            } else {
                return { error: true, message: response.data.message };
            }
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async updateUser(userInfo: any) {
        try {
            const user: any = await this.getUserInfo();
            if (user && user.uid) {
                const user_id = user.uid;
                const request = {
                    input: {
                        user_id: user_id,
                        user_info: userInfo
                    }
                };
                const response = await axios.post('/completion/update-user', request);
                return response.data;
            }
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getWorkListAll() {
        try {
            const list = await this.getWorkList();
            return list;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async uploadImage(fileName: string, image: File) {
        try {
            return await storage.uploadImage(fileName, image);
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getImageUrl(fileName: string) {
        try {
            return await storage.getImageUrl(fileName);
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async uploadFile(fileName: string, file: File, options?: any, onProgress?: (progress: number) => void) {
        try {
            let result: any = null;
            if (!options) {
                return await storage.uploadFile(fileName, file);
            }
            await this.uploadFileToStorage(file, options, onProgress)
                .then(async (response) => {
                    if (response) {
                        await this.putInstanceSource({
                            id: options.file_id,
                            proc_inst_id: options.proc_inst_id,
                            file_name: fileName,
                            file_path: response.public_url,
                            is_process: true,
                            file_id: response.file_path
                        });
                        result = { success: true, message: 'File uploaded successfully' };
                    } else {
                        result = { error: true, message: response.message };
                    }
                })
                .catch((error) => {
                    result = { error: true, message: error.message };
                });

            // 드라이브 업로드는 비동기로 백그라운드에서 처리
            this.getDriveInfo()
                .then((checkDrive) => {
                    if (checkDrive) {
                        this.uploadFileToDrive(fileName, file, options).catch((error) => {
                            // 백그라운드 에러는 콘솔에만 출력 (무시)
                            console.error('드라이브 업로드 실패:', error);
                        });
                    }
                })
                .catch((error) => {
                    // 드라이브 정보 확인 실패도 무시
                    console.error('드라이브 정보 확인 실패:', error);
                });

            return result;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async uploadFileToStorage(file: File, options?: any, onProgress?: (progress: number) => void) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('tenant_id', window.$tenantName);
            formData.append('options', JSON.stringify(options));

            const response = await axios.post('/memento/save-to-storage', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                },
                onUploadProgress: (progressEvent) => {
                    if (onProgress && progressEvent.total) {
                        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        onProgress(percent);
                    }
                }
            });

            return response.data;
        } catch (error) {
            const err: any = error;
            const status = err?.response?.status;
            const detail = err?.response?.data?.detail || err?.response?.data?.message || err?.message || '알 수 없는 오류';

            if (status === 504 || status === 408) {
                throw new Error('파일 처리 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.');
            }
            if (typeof detail === 'string' && detail.toLowerCase().includes('timeout')) {
                throw new Error('파일 처리 중 타임아웃이 발생했습니다. 파일 크기를 줄이거나 잠시 후 다시 시도해 주세요.');
            }
            throw new Error(`파일 업로드 실패: ${detail}`);
        }
    }

    async uploadFileToDrive(fileName: string, file: File, options?: any) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('file_name', fileName);
            formData.append('tenant_id', window.$tenantName);
            if (options && options.folder_path) {
                formData.append('folder_path', options.folder_path);
            }

            const response = await axios.post('/memento/save-to-drive', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            if (response.status === 200) {
                if (options && options.chat_room_id) {
                    const putObj = {
                        id: response.data.file_id,
                        file_name: response.data.file_name,
                        file_path: response.data.download_link,
                        chat_room_id: options.chat_room_id,
                        user_name: options.user_name,
                        tenant_id: window.$tenantName
                    };
                    await storage.putObject('chat_attachments', putObj);
                }
                return response.data;
            } else {
                throw new Error(response.data.message);
            }
        } catch (error) {
            const checkDrive = await this.getDriveInfo();
            if (!checkDrive) {
                throw new Error('구글 드라이브 연동이 필요합니다. 관리자에게 문의하세요.');
            } else {
                throw new Error('파일 업로드 실패: ' + (error.message ? error.message : '재로그인 후 다시 시도하세요.'));
            }
        }
    }

    async getDriveInfo() {
        try {
            const response = await storage.getObject('tenant_oauth', {
                match: {
                    tenant_id: window.$tenantName
                }
            });
            return response;
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async saveDriveInfo(driveInfo: any) {
        try {
            await storage.putObject('tenant_oauth', driveInfo);
            const drive = await storage.getObject('tenant_oauth', {
                match: {
                    tenant_id: window.$tenantName
                }
            });

            if (!drive.google_credentials || !drive.google_credentials_updated_at) {
                const response = await axios.get('/memento/auth/google/url?tenant_id=' + window.$tenantName);
                if (response.data && response.data.auth_url) {
                    location.href = response.data.auth_url;
                } else {
                    throw new Error(response.data.message);
                }
            }
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async getGitConfigs() {
        try {
            return (
                (await storage.list('tenant_git_config', {
                    match: { tenant_id: window.$tenantName }
                })) || []
            );
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async saveGitConfig(config: {
        id?: string;
        provider: string;
        base_url?: string;
        username: string;
        token: string;
        is_default: boolean;
    }) {
        try {
            if (config.is_default) {
                const existing = await storage.list('tenant_git_config', {
                    match: { tenant_id: window.$tenantName }
                });
                for (const item of existing || []) {
                    if (item.id !== config.id && item.is_default) {
                        await storage.putObject('tenant_git_config', { ...item, is_default: false }, { onConflict: 'id' });
                    }
                }
            }
            const payload: any = {
                tenant_id: window.$tenantName,
                provider: config.provider,
                base_url: config.base_url || null,
                username: config.username,
                token: config.token,
                is_default: config.is_default,
                updated_at: new Date().toISOString()
            };
            if (config.id) {
                payload.id = config.id;
                await storage.putObject('tenant_git_config', payload, { onConflict: 'id' });
            } else {
                await storage.putObject('tenant_git_config', payload, { onConflict: 'tenant_id,provider' });
            }
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async deleteGitConfig(id: string) {
        try {
            await storage.delete(`tenant_git_config/${id}`, { key: 'id' });
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async callbackOAuth() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code');
            const state = urlParams.get('state');
            const scope = urlParams.get('scope');
            const email = localStorage.getItem('email');

            const response = await fetch('/memento/auth/google/callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, state, scope, user_email: email })
            });
            const result = await response.json();
            if (result.success) {
                console.log('OAuth 성공');
            }
        } catch (error) {
            console.error('OAuth 실패:', error);
        }
    }

    async getFileUrl(path: string, options?: any) {
        try {
            if (options && options.storageType == 'drive') {
                const filePath = await storage.getString('chat_attachments', {
                    column: 'file_path',
                    match: {
                        id: path,
                        tenant_id: window.$tenantName
                    }
                });
                if (filePath) {
                    return filePath;
                } else {
                    return null;
                }
            } else {
                return await storage.getFileUrl(path);
            }
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async downloadFile(path: string) {
        try {
            return await storage.downloadFile(path);
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async processFile(file: any, options?: any) {
        try {
            let file_path = '';
            let original_filename = '';
            if (options.storageType == 'drive') {
                if (options && options.folder_path) {
                    file_path = file.file_id;
                } else {
                    file_path = file.file_name;
                }
                original_filename = file.file_name;
            } else {
                file_path = file.fullPath.replace('files/', '');
                original_filename = file.original_filename;
            }

            const response = await axios.post(
                '/memento/process',
                {
                    file_path: file_path,
                    original_filename: original_filename,
                    storage_type: options.storageType,
                    tenant_id: window.$tenantName,
                    options: options
                },
                {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );
            return response.data;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    /**
     * Google Drive 폴더(tenant 설정에 저장된 folder_id)의 파일들을 문서 처리(인덱싱)합니다.
     * - 기존 `processFile()`과 분리된 신규 호출로, 기존 로직에 영향이 없습니다.
     * - 백엔드가 폴더 전체 처리를 지원하는 경우(file_path 없이 storage_type="drive") 이를 사용합니다.
     */
    async processDriveFolder(options?: { drive_folder_id?: string; [key: string]: any }) {
        try {
            const response = await axios.post(
                '/memento/process',
                {
                    storage_type: 'drive',
                    tenant_id: window.$tenantName,
                    options: options || {}
                },
                {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );
            return response.data;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    /**
     * Google Drive 폴더 문서 처리(인덱싱) 작업 상태 조회.
     * 백엔드 구현/배포 환경에 따라 경로가 다를 수 있어, 우선순위대로 시도합니다.
     */
    async getDriveFolderProcessStatus(params?: { tenant_id?: string; job_id?: string }) {
        const tenantId = params?.tenant_id || window.$tenantName;
        const jobId = params?.job_id;

        const tryGet = async (url: string) => {
            return await axios.get(url, {
                params: {
                    tenant_id: tenantId,
                    ...(jobId ? { job_id: jobId } : {})
                },
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        };

        try {
            // 1) 문서/계획에서 기대하는 형태(기본 prefix 포함)
            const res = await tryGet('/memento/process/drive/status');
            return res.data;
        } catch (e1) {
            try {
                // 2) prefix 없는 형태
                const res = await tryGet('/process/drive/status');
                return res.data;
            } catch (e2) {
                // 3) 일부 구현에서 사용할 수 있는 경로
                const res = await tryGet('/memento/process/status');
                return res.data;
            }
        }
    }

    async getAttachments(chatRoomId: string, callback: (attachment: any) => void) {
        const channelName = `chat_attachments_${chatRoomId}_${Date.now()}`;
        const subscription = await storage.watch(
            'chat_attachments',
            channelName,
            (payload) => {
                if ((payload && payload.new && payload.eventType === 'INSERT') || payload.eventType === 'UPDATE') {
                    const attachment = payload.new;
                    if (callback) {
                        callback(attachment);
                    }
                }
            },
            {
                filter: `chat_room_id=eq.${chatRoomId}`
            }
        );

        if (callback) {
            const attachments = await storage.list('chat_attachments', {
                match: {
                    chat_room_id: chatRoomId
                }
            });
            if (attachments && attachments.length > 0) {
                for (const attachment of attachments) {
                    callback(attachment);
                }
            }
        }

        return subscription;
    }

    async getEmbedding(text) {
        const response = await axios.post(
            '/completion/langchain-chat/embeddings',
            JSON.stringify({
                text: text,
                model: 'text-embedding-3-small',
                vendor: 'openai'
            }),
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
        const data = response.data;
        return data.embedding;
    }

    async updateVectorStore(content: string, type: string) {
        try {
            const embedding = await this.getEmbedding(content);
            await storage.putObject('documents', {
                id: this.uuid(),
                content: content,
                metadata: {
                    tenant_id: window.$tenantName,
                    type: type
                },
                embedding: embedding
            });
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async putUserPermission(permission: any) {
        try {
            // ID 생성: target_type에 따라 다른 조합 사용
            let idSuffix = '';
            if (permission.target_type === 'user') {
                idSuffix = permission.user_id;
            } else if (permission.target_type === 'organization') {
                idSuffix = permission.organization_id;
            } else if (permission.target_type === 'org_group') {
                idSuffix = permission.org_group_id;
            }

            const permissionData = {
                ...permission,
                id: `${permission.proc_def_id}_${idSuffix}`,
                tenant_id: window.$tenantName
            };

            await storage.putObject('user_permissions', permissionData);
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async deleteUserPermission(options: any) {
        try {
            await storage.delete('user_permissions', options);
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    /**
     * 사용자별 프로세스 권한 체크
     * @param options
     *  proc_def_id: 프로세스 정의 ID
     *  user_id: 사용자 ID
     *  user_organizations: 사용자 소속 조직 ID 배열 (선택)
     * @returns
     */
    async getUserPermissions(options: any) {
        try {
            let filter: any = {};
            if (options.proc_def_id && options.user_id) {
                filter = {
                    p_user_id: options.user_id,
                    p_proc_def_id: options.proc_def_id
                };
                // 조직 정보가 있으면 추가
                if (options.user_organizations) {
                    filter.p_user_organizations = options.user_organizations;
                }
            } else if (options.proc_def_id && !options.user_id) {
                filter = {
                    p_proc_def_id: options.proc_def_id
                };
            }

            // v2 함수 우선 시도, 없으면 기존 함수 사용
            try {
                const result = await storage.callProcedure('check_process_permission_v2', filter);
                if (result && result.length > 0) {
                    return result;
                }
            } catch (e) {
                // v2 함수가 없으면 기존 함수 사용
                const result = await storage.callProcedure('check_process_permission', filter);
                if (result && result.length > 0) {
                    return result;
                }
            }
            return null;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    /**
     * 조직 그룹 목록 조회
     * @returns org_chart_groups 목록
     */
    async getOrgChartGroupList() {
        try {
            const filter = {
                match: { tenant_id: window.$tenantName },
                orderBy: 'name',
                sort: 'asc'
            };
            const result = await storage.list('org_chart_groups', filter);
            return result || [];
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    /**
     * 프로세스에 대한 병합된 권한 조회 (사용자의 모든 권한 OR 병합)
     * @param options proc_def_id, user_id, user_organizations
     * @returns { has_readable, has_executable, has_writable }
     */
    async getMergedPermission(options: any) {
        try {
            const filter = {
                p_proc_def_id: options.proc_def_id,
                p_user_id: options.user_id,
                p_user_organizations: options.user_organizations || []
            };
            const result = await storage.callProcedure('get_merged_permission', filter);
            if (result && result.length > 0) {
                return result[0];
            }
            return { has_readable: false, has_executable: false, has_writable: false };
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    /**
     * 현재 사용자의 특정 프로세스에 대한 권한 체크
     * 직접 쿼리로 사용자, 조직, 조직그룹 권한을 모두 확인하여 병합
     * @param procDefId 프로세스 정의 ID
     * @returns { readable, executable, writable, isPublic }
     */
    async checkProcessPermission(
        procDefId: string
    ): Promise<{ readable: boolean; executable: boolean; writable: boolean; isPublic: boolean }> {
        try {
            const uid = localStorage.getItem('uid');
            const role = localStorage.getItem('role');
            const isAdmin = localStorage.getItem('isAdmin') === 'true';

            // superAdmin 또는 admin은 모든 권한 있음
            if (role === 'superAdmin' || isAdmin) {
                return { readable: true, executable: true, writable: true, isPublic: false };
            }

            if (!uid) {
                return { readable: false, executable: false, writable: false, isPublic: false };
            }

            // 해당 프로세스에 정의된 모든 권한 조회
            const allPermissions = await storage.list('user_permissions', {
                match: { proc_def_id: procDefId, tenant_id: window.$tenantName }
            });

            // 권한이 정의되지 않은 프로세스는 공개 (모든 권한 있음)
            if (!allPermissions || allPermissions.length === 0) {
                return { readable: true, executable: true, writable: true, isPublic: true };
            }

            // 사용자의 조직 목록 가져오기
            const { getCurrentUserOrganizations } = await import('@/utils/organizationUtils');
            const userOrganizations = await getCurrentUserOrganizations();

            // 사용자가 속한 조직 그룹 가져오기
            const userOrgGroupIds: string[] = [];
            if (userOrganizations.length > 0) {
                try {
                    const orgGroups = await this.getOrgChartGroupList();
                    for (const group of orgGroups) {
                        const groupTeams = await storage.list('org_chart_group_teams', { match: { group_id: group.id } });
                        const groupTeamIds = groupTeams.map((t: any) => t.team_id);
                        const hasUserOrg = userOrganizations.some((orgId) => groupTeamIds.includes(orgId));
                        if (hasUserOrg) {
                            userOrgGroupIds.push(group.id);
                        }
                    }
                } catch (e) {
                    console.warn('[checkProcessPermission] 조직 그룹 조회 실패:', e);
                }
            }

            // 사용자에게 적용되는 권한 필터링
            const applicablePermissions = allPermissions.filter((p: any) => {
                // 직접 사용자 권한
                if (p.target_type === 'user' && p.user_id === uid) {
                    return true;
                }
                // legacy 권한 (target_type 없이 user_id만 있는 경우)
                if (!p.target_type && p.user_id === uid) {
                    return true;
                }
                // 조직 권한
                if (p.target_type === 'organization' && userOrganizations.includes(p.organization_id)) {
                    return true;
                }
                // 조직 그룹 권한
                if (p.target_type === 'org_group' && userOrgGroupIds.includes(p.org_group_id)) {
                    return true;
                }
                return false;
            });

            // 적용 가능한 권한 병합 (OR 연산)
            let readable = false;
            let executable = false;
            let writable = false;

            for (const perm of applicablePermissions) {
                if (perm.readable) readable = true;
                if (perm.executable) executable = true;
                if (perm.writable) writable = true;
            }

            return { readable, executable, writable, isPublic: false };
        } catch (error) {
            console.error('[checkProcessPermission] 권한 체크 실패:', error);
            return { readable: false, executable: false, writable: false, isPublic: false };
        }
    }

    /**
     * 프로세스별 권한 목록 조회 (설정된 모든 권한)
     * @param procDefId 프로세스 정의 ID
     * @returns 권한 목록
     */
    async getPermissionsByProcDef(procDefId: string) {
        try {
            const filter = {
                match: {
                    proc_def_id: procDefId,
                    tenant_id: window.$tenantName
                }
            };
            const result = await storage.list('user_permissions', filter);
            return result || [];
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async checkUsePermissions() {
        try {
            const permissionCount = await storage.getCount('user_permissions');
            if (permissionCount > 0) {
                return true;
            } else {
                return false;
            }
        } catch (error) {
            console.log(error);
        }
    }

    /**
     * 현재 사용자가 접근 가능한 모든 proc_def_id 목록 조회
     * 사용자, 조직, 조직그룹 기반 권한 모두 체크
     * @param permissionType - 'readable' | 'executable' | 'writable'
     * @returns proc_def_id 배열
     */
    async getAccessibleProcDefIds(permissionType: 'readable' | 'executable' | 'writable' = 'readable'): Promise<string[]> {
        const uid = localStorage.getItem('uid');
        if (!uid) {
            return [];
        }

        try {
            // 1. 사용자의 조직 목록 가져오기
            const { getCurrentUserOrganizations } = await import('@/utils/organizationUtils');
            const userOrganizations = await getCurrentUserOrganizations();

            // 2. 사용자가 속한 조직 그룹 가져오기
            const userOrgGroupIds: string[] = [];
            if (userOrganizations.length > 0) {
                try {
                    const orgGroups = await this.getOrgChartGroupList();
                    for (const group of orgGroups) {
                        const groupTeams = await storage.list('org_chart_group_teams', { match: { group_id: group.id } });
                        const groupTeamIds = groupTeams.map((t: any) => t.team_id);
                        const hasUserOrg = userOrganizations.some((orgId) => groupTeamIds.includes(orgId));
                        if (hasUserOrg) {
                            userOrgGroupIds.push(group.id);
                        }
                    }
                } catch (e) {
                    console.warn('[getAccessibleProcDefIds] 조직 그룹 조회 실패:', e);
                }
            }

            // 3. 모든 유형의 권한 조회
            const allPermissions: any[] = [];

            // 사용자 직접 권한
            const userPermissions = await storage.list('user_permissions', {
                match: { user_id: uid, tenant_id: window.$tenantName }
            });
            if (userPermissions && userPermissions.length > 0) {
                const filteredUserPerms = userPermissions.filter((p: any) => !p.target_type || p.target_type === 'user');
                allPermissions.push(...filteredUserPerms);
            }

            // 조직 권한
            for (const orgId of userOrganizations) {
                const orgPermissions = await storage.list('user_permissions', {
                    match: { organization_id: orgId, target_type: 'organization', tenant_id: window.$tenantName }
                });
                if (orgPermissions && orgPermissions.length > 0) {
                    allPermissions.push(...orgPermissions);
                }
            }

            // 조직 그룹 권한
            for (const groupId of userOrgGroupIds) {
                const groupPermissions = await storage.list('user_permissions', {
                    match: { org_group_id: groupId, target_type: 'org_group', tenant_id: window.$tenantName }
                });
                if (groupPermissions && groupPermissions.length > 0) {
                    allPermissions.push(...groupPermissions);
                }
            }

            // 4. 지정된 권한 타입이 있는 것만 필터링
            const filteredPermissions = allPermissions.filter((p) => p[permissionType] === true);

            // 5. proc_def_id 추출
            const accessibleIds = new Set<string>();
            for (const permission of filteredPermissions) {
                if (permission.proc_def_id) {
                    accessibleIds.add(permission.proc_def_id);
                }
                if (permission.proc_def_ids) {
                    this.extractProcDefIds(permission.proc_def_ids, accessibleIds);
                }
            }

            return Array.from(accessibleIds);
        } catch (error) {
            console.error('[getAccessibleProcDefIds] 오류:', error);
            return [];
        }
    }

    async addSampleProcess() {
        try {
            const response = await axios.post('/completion/insert-sample');
            // console.log(response.data);
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async createThreadId() {
        try {
            const serverUrl = 'http://127.0.0.1:2024';
            const threadRes = await axios.post(`${serverUrl}/threads`, JSON.stringify({}), {
                headers: { 'Content-Type': 'application/json' }
            });
            const threadData = threadRes.data;
            const currentThreadId = threadData.thread_id;
            return currentThreadId;
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async sendMessageWithThreadId(threadId: string, message: string, chatRoomId: string) {
        try {
            const serverUrl = 'http://127.0.0.1:2024';
            const assistantId = 'agent';

            const runRes = await axios.post(
                `${serverUrl}/threads/${threadId}/runs`,
                JSON.stringify({
                    assistant_id: assistantId,
                    input: {
                        messages: [{ role: 'user', content: message }]
                    }
                }),
                {
                    headers: { 'Content-Type': 'application/json' }
                }
            );
            const runData = runRes.data;
            const runId = runData.run_id;

            let messages = [];
            const streamRes = await axios.get(`${serverUrl}/threads/${threadId}/runs/${runId}/stream`, {
                headers: { 'Content-Type': 'application/json' }
            });
            if (streamRes.status === 200) {
                const result = streamRes.data;
                const data = result.split('data: ').pop();
                if (data) {
                    const json = JSON.parse(data);
                    if (json && json.messages) {
                        messages = json.messages;
                    }
                }
            }

            const aiMessage = messages.filter((message: any) => message.type === 'ai').pop();
            const newMessage = {
                name: 'system',
                role: 'system',
                email: 'system@uengine.org',
                image: '',
                content: aiMessage.content,
                timeStamp: new Date().toISOString()
            };
            await this.updateInstanceChat(chatRoomId, newMessage, threadId);

            return newMessage;
        } catch (error) {
            console.error('Error:', error);
        }
    }

    async listMarketplaceDefinition(tagOrKeyword?: string, isSearch = false, limit?: number, offset = 0) {
        try {
            // 컴포넌트 id 별 최신 버전만 노출하는 뷰에서 조회(버전/패키지 인지형).
            const sourceTable = 'proc_def_marketplace_latest';
            const selectColumns =
                'uuid, id, name, description, image, tags, author_name, author_uid, import_count, category, version, package_path';

            // 검색 기능이 활성화된 경우 - DB 레벨에서 검색
            if (isSearch && tagOrKeyword && tagOrKeyword.trim() !== '') {
                const keyword = tagOrKeyword.trim();
                const searchPattern = `%${keyword}%`;

                // Supabase를 직접 사용하여 DB 레벨에서 검색
                let query = window.$supabase
                    .from(sourceTable)
                    .select(selectColumns)
                    .or(`name.ilike.${searchPattern},author_name.ilike.${searchPattern},tags.ilike.${searchPattern}`)
                    .order('import_count', { ascending: false });

                if (limit !== undefined) {
                    query = query.range(offset, offset + limit - 1);
                }

                const { data, error } = await query;

                if (error) {
                    console.error('검색 중 오류:', error);
                    return [];
                }

                return data || [];
            }
            // 태그 필터링 - DB 레벨에서 필터링
            else if (tagOrKeyword && tagOrKeyword !== 'all') {
                const searchPattern = `%${tagOrKeyword}%`;

                let query = window.$supabase
                    .from(sourceTable)
                    .select(selectColumns)
                    .ilike('tags', searchPattern)
                    .order('import_count', { ascending: false });

                if (limit !== undefined) {
                    query = query.range(offset, offset + limit - 1);
                }

                const { data, error } = await query;

                if (error) {
                    console.error('태그 필터링 중 오류:', error);
                    return [];
                }

                return data || [];
            }
            // 전체 목록 조회
            else {
                const options: any = {
                    key: selectColumns,
                    orderBy: 'import_count',
                    sort: 'desc'
                };

                if (limit !== undefined) {
                    options.range = {
                        from: offset,
                        to: offset + limit - 1
                    };
                }

                const list = await storage.list(sourceTable, options);

                if (!Array.isArray(list)) {
                    console.error('storage.list가 배열을 반환하지 않았습니다:', list);
                    return [];
                }

                return list;
            }
        } catch (error) {
            console.error('❌ [백엔드] listMarketplaceDefinition 오류:', error);
            return [];
        }
    }

    /** 특정 컴포넌트 id 의 모든 등록 버전 목록(최신순). */
    async listMarketplaceVersions(componentId: string) {
        try {
            const { data, error } = await window.$supabase
                .from('proc_def_marketplace')
                .select('uuid, id, name, version, package_path, source_arcv_id, created_at, import_count, category')
                .eq('id', componentId)
                .order('created_at', { ascending: false });
            if (error) {
                console.error('[백엔드] listMarketplaceVersions 오류:', error);
                return [];
            }
            return data || [];
        } catch (error) {
            console.error('[백엔드] listMarketplaceVersions 오류:', error);
            return [];
        }
    }

    async getAllMarketplaceTags() {
        try {
            // Supabase를 직접 사용하여 tags 컬럼만 조회(최신 버전 뷰)
            const { data, error } = await window.$supabase.from('proc_def_marketplace_latest').select('tags');

            if (error) {
                console.error('태그 목록 조회 중 오류:', error);
                return [];
            }

            if (!Array.isArray(data)) {
                console.error('태그 목록이 배열이 아닙니다:', data);
                return [];
            }

            // 모든 태그를 수집하고 중복 제거
            const tagsSet = new Set();
            data.forEach((item) => {
                if (item.tags) {
                    // 쉼표로 구분된 태그를 분리하고 중복 제거
                    item.tags.split(',').forEach((tag) => {
                        const trimmedTag = tag ? tag.trim() : '';
                        if (trimmedTag) {
                            tagsSet.add(trimmedTag);
                        }
                    });
                }
            });

            return Array.from(tagsSet);
        } catch (error) {
            console.error('[백엔드] getAllMarketplaceTags 오류:', error);
            return [];
        }
    }

    async deleteMarketplaceDefinition(definitionId: string) {
        try {
            const { error } = await window.$supabase.from('proc_def_marketplace').delete().eq('id', definitionId);

            if (error) {
                throw new Error(error.message);
            }

            return true;
        } catch (error) {
            console.error('[백엔드] deleteMarketplaceDefinition 오류:', error);
            throw error;
        }
    }

    async getMarketplaceDefinitionBpmn(uuid: string) {
        try {
            const response = await storage.getObject('proc_def_marketplace', {
                match: {
                    uuid: uuid
                }
            });

            if (!response || !response.bpmn) {
                throw new Error('BPMN 데이터를 찾을 수 없습니다.');
            }

            return response.bpmn;
        } catch (error) {
            console.error('[백엔드] getMarketplaceDefinitionBpmn 오류:', error);
            throw error;
        }
    }

    /**
     * @deprecated 레거시 마켓플레이스 복사 API. 이제 표준 패키지 설치 경로(installProcessComponent)로 위임한다.
     * 최소 정보({id, name, author_uid})만 넘어와도 마켓플레이스 최신 행을 조회해 설치한다.
     */
    async duplicateDefinition(definition: any, tenantId?: string) {
        try {
            // package_path/definition 이 이미 실려 있으면 그대로, 아니면 최신 행 조회.
            let entry = definition;
            if (!definition.package_path && !definition.definition) {
                const { data } = await window.$supabase.from('proc_def_marketplace_latest').select('*').eq('id', definition.id).limit(1);
                if (Array.isArray(data) && data.length > 0) {
                    entry = { ...data[0], ...definition };
                }
            }
            return await this.installProcessComponent(entry, tenantId);
        } catch (error: any) {
            throw new Error(error?.message || String(error));
        }
    }

    // =========================================================================
    // 프로세스 컴포넌트 패키지(zip) export / import
    // - 프로세스 + 에이전트 + 스킬(+폼/DMN)을 하나의 표준 zip 으로 묶고 푸는 단일 경로.
    // - 마켓플레이스 등록/설치, 파일 내보내기/가져오기가 공통으로 사용한다.
    // =========================================================================

    /** 짧은 충돌 회피용 접미사. */
    private _shortUuid(): string {
        if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) {
            return (crypto as any).randomUUID().split('-')[0];
        }
        return Math.random().toString(36).slice(2, 10);
    }

    /** 현재 테넌트에 해당 id 의 프로세스 정의가 존재하는지. */
    async hasProcessDefinition(defId: string): Promise<boolean> {
        try {
            const existing = await storage.getObject('proc_def', { match: { id: String(defId).toLowerCase() } });
            return !!existing;
        } catch (e) {
            return false;
        }
    }

    /**
     * 포터블 에이전트 스펙 배열로 users(is_agent=true) 행을 생성/재사용한다.
     * username/role 정규화 매칭으로 기존 테넌트 에이전트를 재사용하고, 없으면 신규 생성한다.
     * putAgent 가 내부적으로 replaceAgentSkills 로 agent_skills·users.skills 를 동기화한다.
     * (saveGeneratedProcessArtifacts 의 에이전트 처리 로직을 추출·공용화한 것)
     */
    async ensureAgentsFromSpecs(
        specs: any[],
        agentMapping?: Record<string, { action?: 'create' | 'skip' | 'existing'; existingId?: string }>
    ): Promise<{ created: string[]; warnings: string[] }> {
        const created: string[] = [];
        const warnings: string[] = [];
        if (!Array.isArray(specs) || specs.length === 0) return { created, warnings };

        let existingAgents: any[] = [];
        try {
            existingAgents = (await storage.list('users', { match: { is_agent: true, tenant_id: window.$tenantName } })) || [];
        } catch (e) {
            /* best-effort */
        }
        const norm = (s: any) =>
            String(s || '')
                .trim()
                .toLowerCase()
                .replace(/\s+/g, '');

        for (const a of specs) {
            try {
                const name = a.name || a.username;
                const role = a.role || '';
                // agentMapping: 역할/이름 키로 'skip' 지정 시 생성 건너뜀.
                if (agentMapping) {
                    const key = String(role || name || '').toLowerCase();
                    const decision = agentMapping[key];
                    if (decision && decision.action === 'skip') continue;
                    if (decision && decision.action === 'existing' && decision.existingId) {
                        created.push(decision.existingId);
                        continue;
                    }
                }
                const dup = existingAgents.find(
                    (u: any) => (name && norm(u.username) === norm(name)) || (role && norm(u.role) === norm(role))
                );
                const agentId =
                    dup?.id ||
                    a.id ||
                    (typeof crypto !== 'undefined' && (crypto as any).randomUUID
                        ? (crypto as any).randomUUID()
                        : `agent_${Date.now()}_${created.length}`);
                const skills = Array.isArray(a.skills)
                    ? a.skills
                    : typeof a.skills === 'string'
                    ? a.skills
                          .split(',')
                          .map((s: string) => s.trim())
                          .filter(Boolean)
                    : [];
                await this.putAgent({
                    id: agentId,
                    name,
                    role,
                    goal: a.goal || '',
                    persona: a.persona || '',
                    tools: a.tools || '',
                    endpoint: null,
                    description: a.description || null,
                    skills,
                    model: a.model || null,
                    isAgent: true,
                    type: 'agent',
                    alias: a.alias || null
                });
                created.push(agentId);
            } catch (e: any) {
                warnings.push(`agent '${a?.username || a?.name}' 생성 실패: ${e?.message || e}`);
            }
        }
        return { created, warnings };
    }

    /** 스킬 파일을 zip(ArrayBuffer)으로 받아온다(백엔드 /skills/{name}/export). */
    async fetchSkillExportZip(skillName: string): Promise<ArrayBuffer | null> {
        try {
            const resp = await axios.get(`/process-gpt-deepagents/skills/${encodeURIComponent(skillName)}/export`, {
                params: { tenant_id: window.$tenantName },
                responseType: 'arraybuffer',
                // deepagents 미기동/지연 시 export 전체가 멈추지 않도록 타임아웃.
                timeout: 15000
            });
            return resp.data as ArrayBuffer;
        } catch (e) {
            console.warn('[exportProcessComponent] 스킬 export 실패(건너뜀):', skillName, e);
            return null;
        }
    }

    /**
     * 프로세스 정의를 표준 컴포넌트 패키지(zip Blob)로 export 한다.
     * @param defId 프로세스 정의 id
     * @param arcvId 특정 버전 스냅샷(proc_def_version.arcv_id). 없으면 실행용 버전 해석(prod→major→minor→현재).
     * @param meta 마켓플레이스 메타(description/category/tags/author/thumbnail). 파일 export 시 생략 가능.
     */
    async exportProcessComponent(
        defId: string,
        arcvId?: string,
        meta?: {
            description?: string;
            category?: { mega?: string; major?: string } | string;
            tags?: string[] | string;
            author?: { name?: string; uid?: string };
            thumbnail?: { data: ArrayBuffer | Uint8Array | Blob; ext?: string } | null;
        }
    ): Promise<{ blob: Blob; manifest: any }> {
        const { buildPackage, sanitizeDefinition, collectSkillNames } = await import('@/utils/processComponentPackage');

        const lowerId = String(defId).toLowerCase();
        const procDef: any = await storage.getObject('proc_def', { match: { id: lowerId } });
        if (!procDef) throw new Error(`프로세스 정의를 찾을 수 없습니다: ${defId}`);

        // 1) 버전/정의/BPMN 해석
        let definition: any = procDef.definition;
        let bpmn: string | null = procDef.bpmn || null;
        let version = '1.0';
        let versionTag: string | null = null;
        let sourceArcvId: string | null = null;

        if (arcvId) {
            const row: any = await storage.getObject('proc_def_version', { match: { arcv_id: arcvId } });
            if (row) {
                definition = row.definition ?? definition;
                bpmn = row.snapshot ?? bpmn;
                version = row.version ?? version;
                versionTag = row.version_tag ?? null;
                sourceArcvId = row.arcv_id;
            }
        } else {
            const resolved = await this.getExecutionDefinition(lowerId);
            if (resolved) {
                definition = resolved.definition ?? definition;
                bpmn = resolved.bpmn ?? bpmn;
                if (resolved.version) {
                    version = resolved.version;
                    versionTag = resolved.version_tag ?? null;
                    sourceArcvId = `${lowerId}_${resolved.version}`;
                }
            }
        }
        if (!definition) throw new Error('프로세스 정의(JSON)가 비어 있어 export 할 수 없습니다.');

        const componentId = procDef.id;
        const sanitized = sanitizeDefinition(definition, componentId);

        // 2) 폼 수집
        let forms: any[] = [];
        try {
            forms =
                (await storage.list('form_def', {
                    match: { proc_def_id: lowerId, tenant_id: window.$tenantName }
                })) || [];
        } catch (e) {
            forms = [];
        }
        const formEntries = forms.map((f: any) => ({
            id: f.id,
            activity_id: f.activity_id,
            html: f.html,
            fields_json: f.fields_json ?? null
        }));

        // 3) 에이전트 수집 — 정의가 참조하는 역할/이름에 매칭되는 tenant 에이전트를 포터블 스펙으로 축소
        let agentSpecs: any[] = [];
        try {
            const users: any[] = (await storage.list('users', { match: { is_agent: true, tenant_id: window.$tenantName } })) || [];
            const { collectAgentRefs } = await import('@/utils/processComponentPackage');
            const refs = new Set(collectAgentRefs(sanitized).map((r) => r.toLowerCase()));
            const norm = (s: any) =>
                String(s || '')
                    .trim()
                    .toLowerCase();
            const matched = users.filter((u: any) => refs.has(norm(u.role)) || refs.has(norm(u.username)) || refs.has(norm(u.alias)));
            const pool = matched.length > 0 ? matched : users;
            agentSpecs = pool.map((u: any) => ({
                username: u.username,
                role: u.role || '',
                alias: u.alias || null,
                goal: u.goal || '',
                persona: u.persona || '',
                model: u.model || null,
                tools: u.tools || '',
                skills:
                    typeof u.skills === 'string'
                        ? u.skills
                              .split(',')
                              .map((s: string) => s.trim())
                              .filter(Boolean)
                        : Array.isArray(u.skills)
                        ? u.skills
                        : [],
                description: u.description || null
            }));
        } catch (e) {
            agentSpecs = [];
        }

        // 4) 스킬 수집 — 정의·에이전트가 참조하는 스킬 파일을 백엔드에서 zip 으로 받아 동봉
        const skillNames = collectSkillNames(sanitized, agentSpecs);
        const skillPacks: Array<{ name: string; nestedZip: ArrayBuffer }> = [];
        for (const name of skillNames) {
            const zipBuf = await this.fetchSkillExportZip(name);
            if (zipBuf) skillPacks.push({ name, nestedZip: zipBuf });
        }

        // 5) 메타 정규화
        const category =
            typeof meta?.category === 'string'
                ? { mega: meta.category.split('/')[0], major: meta.category.split('/')[1] }
                : meta?.category || {};
        const tags = Array.isArray(meta?.tags)
            ? meta?.tags
            : typeof meta?.tags === 'string'
            ? (meta?.tags as string)
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
            : [];
        let author = meta?.author;
        if (!author) {
            try {
                const u = await this.getUserInfo();
                author = { name: u?.name, uid: u?.uid };
            } catch (e) {
                /* ignore */
            }
        }

        return await buildPackage({
            componentId,
            name: procDef.name,
            version,
            sourceArcvId,
            versionTag,
            description: meta?.description ?? '',
            category,
            tags,
            author,
            definition: sanitized,
            bpmn,
            forms: formEntries,
            agents: agentSpecs,
            skills: skillPacks,
            thumbnail: meta?.thumbnail ?? null
        });
    }

    /**
     * 표준 컴포넌트 패키지(zip)를 현재 테넌트로 import 한다(단일 경로).
     * 파일 가져오기·마켓플레이스 설치·업데이트가 모두 이 함수를 호출한다.
     * @param zipData 패키지 zip
     * @param opts.mode 'install'(신규/충돌 시 복제) | 'update'(targetDefId 갱신)
     */
    async importProcessComponent(
        zipData: ArrayBuffer | Uint8Array | Blob,
        opts: {
            mode?: 'install' | 'update';
            targetDefId?: string;
            versionTag?: string;
            parentVersion?: string;
            agentMapping?: Record<string, { action?: 'create' | 'skip' | 'existing'; existingId?: string }>;
        } = {}
    ): Promise<any> {
        const { parsePackage } = await import('@/utils/processComponentPackage');
        const parsed = await parsePackage(zipData);
        const manifest = parsed.manifest;
        const mode = opts.mode || 'install';

        const report: any = {
            componentId: manifest.componentId,
            name: manifest.name,
            version: manifest.version,
            newDefId: '',
            forms: 0,
            agents: [] as string[],
            skills: [] as string[],
            skillsSkipped: [] as string[],
            warnings: [] as string[]
        };

        // 1) 대상 defId 결정
        let newDefId = manifest.componentId;
        if (mode === 'update' && opts.targetDefId) {
            newDefId = opts.targetDefId;
        } else {
            let collides = false;
            try {
                const existing = await storage.getObject('proc_def', { match: { id: manifest.componentId } });
                collides = !!existing;
            } catch (e) {
                collides = false;
            }
            if (collides) {
                newDefId = `${manifest.componentId}_${this._shortUuid()}`;
            }
        }
        report.newDefId = newDefId;

        // 2) 정의의 processDefinitionId 재작성(복제된 경우)
        const definition = { ...parsed.definition, processDefinitionId: newDefId };

        // 3) proc_def + proc_def_version 저장(기존 putRawDefinition 경로 재사용)
        try {
            await this.putRawDefinition(parsed.bpmn ?? null, newDefId, {
                name: manifest.name,
                type: 'bpmn',
                definition,
                version: manifest.version,
                version_tag: opts.versionTag || (mode === 'install' ? 'published' : 'major'),
                message: `Imported from package ${manifest.componentId}@${manifest.version}`,
                ...(mode === 'update' && opts.parentVersion ? { parent_version: opts.parentVersion } : {})
            });
        } catch (e: any) {
            throw new Error('프로세스 정의 저장 실패: ' + (e?.message || e));
        }

        // 4) 폼 저장
        for (const form of parsed.forms) {
            try {
                await storage.putObject(
                    'form_def',
                    {
                        id: form.id,
                        proc_def_id: newDefId,
                        activity_id: form.activity_id,
                        html: form.html ?? '',
                        fields_json: form.fields_json ?? null,
                        tenant_id: window.$tenantName
                    },
                    { onConflict: 'id,tenant_id' }
                );
                report.forms += 1;
            } catch (e: any) {
                report.warnings.push(`form '${form.id}' 저장 실패: ${e?.message || e}`);
            }
        }

        // 5) 에이전트 생성/매핑
        try {
            const { created, warnings } = await this.ensureAgentsFromSpecs(parsed.agents, opts.agentMapping);
            report.agents = created;
            report.warnings.push(...warnings);
        } catch (e: any) {
            report.warnings.push(`에이전트 처리 실패: ${e?.message || e}`);
        }

        // 6) 스킬 업로드(파일) + 등록(tenant_skills). 409(이미 존재)는 재사용으로 간주.
        const registeredSkills: string[] = [];
        for (const skill of parsed.skills) {
            const file = new File([skill.zipBlob], `${skill.name}.zip`, { type: 'application/zip' });
            try {
                await this.uploadSkills({ type: 'file', file, skipRegister: true });
                report.skills.push(skill.name);
                registeredSkills.push(skill.name);
            } catch (e: any) {
                const msg = String(e?.message || e);
                if (msg.includes('409') || msg.toLowerCase().includes('already exists')) {
                    report.skillsSkipped.push(skill.name);
                    registeredSkills.push(skill.name); // 이름은 등록 유지
                } else {
                    report.warnings.push(`skill '${skill.name}' 업로드 실패: ${msg}`);
                }
            }
        }
        if (registeredSkills.length > 0) {
            try {
                await this.saveSkills(registeredSkills);
            } catch (e: any) {
                report.warnings.push(`skills 등록 실패: ${e?.message || e}`);
            }
        }

        // 7) 프로세스 정의 체계도(맵) 갱신
        try {
            const mega = manifest.category?.mega;
            const major = manifest.category?.major;
            if (mega && major) {
                const newProcessMap = {
                    mega_proc_list: [
                        {
                            id: mega,
                            name: mega,
                            major_proc_list: [
                                {
                                    id: major,
                                    name: major,
                                    sub_proc_list: [{ id: newDefId, name: manifest.name }]
                                }
                            ]
                        }
                    ]
                };
                const existed = await this.getProcessDefinitionMap();
                const merged = await this.mergeProcessMaps(existed, newProcessMap);
                await this.putProcessDefinitionMap(merged);
            }
        } catch (e: any) {
            report.warnings.push(`프로세스 맵 갱신 실패: ${e?.message || e}`);
        }

        return report;
    }

    // ---- 마켓플레이스: 패키지 기반 등록/설치 --------------------------------

    private _marketplaceBucket() {
        return window.$supabase.storage.from('process-components');
    }

    /**
     * 프로세스 정의를 컴포넌트 패키지로 export 해 Storage 버킷에 올리고,
     * proc_def_marketplace 에 버전 메타 행을 등록한다.
     * 같은 id+version 재등록은 유니크 인덱스로 차단된다("버전을 올리세요").
     */
    async publishProcessComponent(
        defId: string,
        arcvId: string | undefined,
        meta: {
            name?: string;
            description?: string;
            category?: { mega?: string; major?: string } | string;
            tags?: string[] | string;
            image?: string | null;
        }
    ): Promise<any> {
        const user = await this.getUserInfo();
        if (!user || !user.uid) throw new Error('User not found');

        // 썸네일(base64) 을 패키지 assets 에도 동봉(선택).
        let thumbnail: any = null;
        if (meta.image && typeof meta.image === 'string' && meta.image.startsWith('data:')) {
            try {
                const commaIdx = meta.image.indexOf(',');
                const b64 = meta.image.slice(commaIdx + 1);
                const bin = atob(b64);
                const bytes = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
                const mime = meta.image.slice(5, meta.image.indexOf(';'));
                const ext = mime.split('/')[1] || 'png';
                thumbnail = { data: bytes, ext };
            } catch (e) {
                /* 썸네일 동봉 실패는 무시 */
            }
        }

        const { blob, manifest } = await this.exportProcessComponent(defId, arcvId, {
            description: meta.description,
            category: meta.category,
            tags: meta.tags,
            author: { name: user.name, uid: user.uid },
            thumbnail
        });

        const category =
            typeof meta.category === 'string'
                ? meta.category
                : meta.category
                ? `${meta.category.mega || ''}/${meta.category.major || ''}`
                : '';
        const tagsStr = Array.isArray(meta.tags) ? meta.tags.join(',') : meta.tags || '';

        // 중복 버전 사전 체크(친절한 에러 메시지).
        try {
            const dup = await storage.getObject('proc_def_marketplace', {
                match: { id: manifest.componentId, version: manifest.version }
            });
            if (dup) {
                throw new Error(`이미 등록된 버전입니다: ${manifest.componentId} v${manifest.version}. 버전을 올린 뒤 다시 등록하세요.`);
            }
        } catch (e: any) {
            if (e?.message && e.message.includes('이미 등록된 버전')) throw e;
            /* 조회 실패는 통과(등록 시 유니크 인덱스가 최종 방어) */
        }

        // 1) Storage 업로드
        const packagePath = `${manifest.componentId}/${manifest.version}.zip`;
        const { error: upErr } = await this._marketplaceBucket().upload(packagePath, blob, {
            cacheControl: '3600',
            upsert: false,
            contentType: 'application/zip'
        });
        if (
            upErr &&
            !String(upErr.message || '')
                .toLowerCase()
                .includes('exists')
        ) {
            throw new Error('패키지 업로드 실패: ' + (upErr.message || upErr));
        }

        // 2) 메타 행 insert(버전별 신규 행)
        const row: any = {
            id: manifest.componentId,
            name: meta.name || manifest.name,
            definition: manifest && (await this._readPackageDefinition(blob)),
            bpmn: await this._readPackageBpmn(blob),
            description: meta.description || '',
            category,
            tags: tagsStr,
            author_name: user.name,
            author_uid: user.uid,
            image: meta.image || null,
            version: manifest.version,
            package_path: packagePath,
            source_arcv_id: manifest.sourceArcvId || null,
            manifest
        };
        try {
            await storage.putObject('proc_def_marketplace', row);
        } catch (e: any) {
            const msg = String(e?.message || e);
            if (msg.includes('proc_def_marketplace_id_version_uq') || msg.toLowerCase().includes('duplicate') || msg.includes('23505')) {
                throw new Error(`이미 등록된 버전입니다: ${manifest.componentId} v${manifest.version}. 버전을 올린 뒤 다시 등록하세요.`);
            }
            throw new Error('마켓플레이스 등록 실패: ' + msg);
        }
        return { manifest, packagePath };
    }

    /** 패키지 blob 에서 정의 JSON 을 읽어 미리보기/검색용 컬럼에 저장한다. */
    private async _readPackageDefinition(blob: Blob): Promise<any> {
        try {
            const { parsePackage } = await import('@/utils/processComponentPackage');
            const parsed = await parsePackage(blob);
            return parsed.definition;
        } catch (e) {
            return null;
        }
    }

    private async _readPackageBpmn(blob: Blob): Promise<string | null> {
        try {
            const { parsePackage } = await import('@/utils/processComponentPackage');
            const parsed = await parsePackage(blob);
            return parsed.bpmn;
        } catch (e) {
            return null;
        }
    }

    /**
     * 마켓플레이스 항목을 현재 테넌트에 설치한다(표준 import 경로).
     * package_path 가 있으면 zip 다운로드 후 import, 없으면(레거시) 메모리에서 패키지를 합성한다.
     */
    async installProcessComponent(entry: any, tenantId?: string): Promise<any> {
        let zipData: ArrayBuffer;
        if (entry.package_path) {
            const { data, error } = await this._marketplaceBucket().download(entry.package_path);
            if (error || !data) throw new Error('패키지 다운로드 실패: ' + (error?.message || 'no data'));
            zipData = await data.arrayBuffer();
        } else {
            const blob = await this.synthesizeLegacyPackage(entry);
            zipData = await blob.arrayBuffer();
        }

        const report = await this.importProcessComponent(zipData, { mode: 'install', versionTag: 'published' });

        // import_count 증가(특정 행 우선, 없으면 id 기준)
        try {
            if (entry.uuid) {
                await window.$supabase
                    .from('proc_def_marketplace')
                    .update({ import_count: (entry.import_count || 0) + 1 })
                    .eq('uuid', entry.uuid);
            }
        } catch (e) {
            /* best-effort */
        }

        // 설치 추적 기록(best-effort)
        try {
            await storage.putObject(
                'installed_components',
                {
                    tenant_id: tenantId || window.$tenantName,
                    component_id: entry.id,
                    marketplace_uuid: entry.uuid || null,
                    installed_version: entry.version || report.version || '0',
                    local_proc_def_id: report.newDefId,
                    updated_at: new Date().toISOString()
                },
                { onConflict: 'tenant_id,local_proc_def_id' }
            );
        } catch (e) {
            report.warnings.push('설치 추적 기록 실패(무시): ' + ((e as any)?.message || e));
        }

        return report;
    }

    /**
     * 레거시 마켓플레이스 행(패키지 없음)을 메모리에서 표준 패키지로 합성한다.
     * definition + bpmn + form_def_marketplace 만 담고 에이전트/스킬은 비운다.
     */
    async synthesizeLegacyPackage(entry: any): Promise<Blob> {
        const { buildPackage } = await import('@/utils/processComponentPackage');

        // 전체 행(정의/bpmn) 조회
        const full: any = entry.definition ? entry : await storage.getObject('proc_def_marketplace', { match: { uuid: entry.uuid } });
        if (!full || !full.definition) throw new Error('레거시 마켓플레이스 정의를 찾을 수 없습니다.');

        // 폼 수집(form_def_marketplace)
        let forms: any[] = [];
        try {
            forms = (await storage.list('form_def_marketplace', { match: { proc_def_id: full.id } })) || [];
        } catch (e) {
            forms = [];
        }
        const formEntries = forms.map((f: any) => ({
            id: f.id,
            activity_id: f.activity_id,
            html: f.html,
            fields_json: f.fields_json ?? null
        }));

        const cat = typeof full.category === 'string' ? full.category : '';
        const category = { mega: cat.split('/')[0], major: cat.split('/')[1] };

        const { blob } = await buildPackage({
            componentId: full.id,
            name: full.name,
            version: entry.version || '0',
            description: full.description || '',
            category,
            tags:
                typeof full.tags === 'string'
                    ? full.tags
                          .split(',')
                          .map((s: string) => s.trim())
                          .filter(Boolean)
                    : [],
            author: { name: full.author_name, uid: full.author_uid },
            definition: full.definition,
            bpmn: full.bpmn || null,
            forms: formEntries,
            agents: [],
            skills: []
        });
        return blob;
    }

    /** major.minor 형태 버전 비교. a>b → 1, a<b → -1, 같음 → 0. */
    private _compareVersion(a?: string, b?: string): number {
        const pa = String(a || '0')
            .split('.')
            .map((v) => parseInt(v, 10) || 0);
        const pb = String(b || '0')
            .split('.')
            .map((v) => parseInt(v, 10) || 0);
        const len = Math.max(pa.length, pb.length);
        for (let i = 0; i < len; i += 1) {
            const av = pa[i] ?? 0;
            const bv = pb[i] ?? 0;
            if (av !== bv) return av > bv ? 1 : -1;
        }
        return 0;
    }

    /** 현재 테넌트에 설치된 컴포넌트 목록. */
    async listInstalledComponents(tenantId?: string): Promise<any[]> {
        try {
            const { data, error } = await window.$supabase
                .from('installed_components')
                .select('*')
                .eq('tenant_id', tenantId || window.$tenantName);
            if (error) {
                console.error('[백엔드] listInstalledComponents 오류:', error);
                return [];
            }
            return data || [];
        } catch (e) {
            console.error('[백엔드] listInstalledComponents 오류:', e);
            return [];
        }
    }

    /**
     * 설치된 컴포넌트 중 마켓플레이스 최신 버전이 더 높은 항목을 반환한다.
     * 각 항목: { component_id, local_proc_def_id, installed_version, latest }
     */
    async checkComponentUpdates(tenantId?: string): Promise<any[]> {
        try {
            const installed = await this.listInstalledComponents(tenantId);
            if (!installed || installed.length === 0) return [];

            const ids = Array.from(new Set(installed.map((i: any) => i.component_id)));
            const { data: latestRows, error } = await window.$supabase
                .from('proc_def_marketplace_latest')
                .select('uuid, id, name, version, package_path, category, import_count, image')
                .in('id', ids);
            if (error) {
                console.error('[백엔드] checkComponentUpdates 오류:', error);
                return [];
            }
            const latestById: Record<string, any> = {};
            for (const row of latestRows || []) latestById[row.id] = row;

            const updates: any[] = [];
            for (const inst of installed) {
                const latest = latestById[inst.component_id];
                if (!latest || !latest.version) continue;
                if (this._compareVersion(latest.version, inst.installed_version) > 0) {
                    updates.push({
                        component_id: inst.component_id,
                        local_proc_def_id: inst.local_proc_def_id,
                        installed_version: inst.installed_version,
                        latest
                    });
                }
            }
            return updates;
        } catch (e) {
            console.error('[백엔드] checkComponentUpdates 오류:', e);
            return [];
        }
    }

    /**
     * 설치된 컴포넌트를 마켓플레이스 최신 버전으로 업그레이드한다.
     * 새 proc_def_version 행에 parent_version(이전 설치 버전)을 연결하고 installed_components 를 갱신한다.
     * 실행 중 인스턴스는 버전을 고정하고 있어 영향받지 않는다.
     */
    async updateInstalledComponent(update: any, tenantId?: string): Promise<any> {
        const latest = update.latest;
        if (!latest) throw new Error('업데이트 대상 최신 버전 정보가 없습니다.');

        let zipData: ArrayBuffer;
        if (latest.package_path) {
            const { data, error } = await this._marketplaceBucket().download(latest.package_path);
            if (error || !data) throw new Error('패키지 다운로드 실패: ' + (error?.message || 'no data'));
            zipData = await data.arrayBuffer();
        } else {
            const blob = await this.synthesizeLegacyPackage(latest);
            zipData = await blob.arrayBuffer();
        }

        const report = await this.importProcessComponent(zipData, {
            mode: 'update',
            targetDefId: update.local_proc_def_id,
            versionTag: 'published',
            parentVersion: update.installed_version
        });

        try {
            await window.$supabase
                .from('installed_components')
                .update({ installed_version: latest.version, updated_at: new Date().toISOString() })
                .eq('tenant_id', tenantId || window.$tenantName)
                .eq('local_proc_def_id', update.local_proc_def_id);
        } catch (e) {
            report.warnings.push('설치 추적 갱신 실패(무시): ' + ((e as any)?.message || e));
        }

        return report;
    }

    async duplicateLocalProcess(
        sourceId: string,
        newName: string,
        bpmn: string,
        definition?: any
    ): Promise<{ success: boolean; newId: string }> {
        try {
            // Generate new ID from source ID with _copy suffix
            let newId = `${sourceId}_copy`;
            let counter = 1;

            // Check if ID already exists and find unique ID
            let existing = await storage.getObject('proc_def', { match: { id: newId } });
            while (existing) {
                newId = `${sourceId}_copy${counter++}`;
                existing = await storage.getObject('proc_def', { match: { id: newId } });
            }

            // Create new process definition
            const newProcDef = {
                id: newId,
                name: newName,
                bpmn: bpmn,
                definition: definition || null,
                owner: localStorage.getItem('uid') || null,
                type: 'bpmn',
                isdeleted: false
            };

            await storage.putObject('proc_def', newProcDef, { onConflict: 'id,tenant_id' });

            return {
                success: true,
                newId: newId
            };
        } catch (error) {
            console.error('Failed to duplicate local process:', error);
            throw new Error(error.message);
        }
    }

    async getTaskLog(taskId: string, callback: (payload: any) => void) {
        try {
            const channelName = `todolist_${taskId}_${Date.now()}`;
            const subscription = await storage.watch(
                'todolist',
                channelName,
                (payload) => {
                    if (payload && payload.new && (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE')) {
                        const task = payload.new;
                        if (callback) {
                            callback(task);
                        }
                    }
                },
                {
                    filter: `id=eq.${taskId}`
                }
            );

            return subscription;
        } catch (error) {
            console.error('Error in getTaskLog:', error);
            throw new Error(error.message);
        }
    }

    async saveTask(id: string, name: string, type: string, json: any) {
        console.warn('method is not implemented only use PalModeBackend');
        return null;
    }

    async getRefForm(taskId: string) {
        try {
            const refForms = [];
            const workItem = await storage.getObject('todolist', { match: { id: taskId } });

            if (workItem && workItem.proc_def_id && workItem.reference_ids && workItem.reference_ids.length > 0) {
                const formPromises = workItem.reference_ids.map(async (referenceId: string) => {
                    const { data, error } = await window.$supabase
                        .from('todolist')
                        .select('*')
                        .eq('proc_inst_id', workItem.proc_inst_id)
                        .eq('activity_id', referenceId)
                        .eq('status', 'DONE')
                        .order('updated_at', { ascending: false })
                        .limit(1);

                    if (error) {
                        console.log(error);
                        return null;
                    }

                    // data는 배열이므로 첫 번째 항목 사용
                    const prevWorkItem = data && data.length > 0 ? data[0] : null;

                    if (prevWorkItem && prevWorkItem.proc_inst_id && prevWorkItem.activity_id && prevWorkItem.tool) {
                        // tool이 'formHandler:'로 시작하는지 확인
                        if (!prevWorkItem.tool.includes('formHandler:')) {
                            return null;
                        }

                        const formId = prevWorkItem.tool.split('formHandler:')[1];
                        if (!formId) {
                            return null;
                        }

                        try {
                            const [form, formData] = await Promise.all([
                                this.getRawDefinition(formId, { type: 'form' }),
                                this.getVariableWithTaskId(workItem.proc_inst_id, prevWorkItem.id, formId)
                            ]);

                            // 폼을 찾지 못한 경우 null 반환
                            if (!form) {
                                return null;
                            }

                            return {
                                name: prevWorkItem.activity_name || '',
                                html: form,
                                formData: formData && formData.valueMap ? formData.valueMap : {}
                            };
                        } catch (error) {
                            console.error(`참조 폼 조회 중 오류 (formId: ${formId}):`, error);
                            return null;
                        }
                    }
                    return null;
                });

                const results = await Promise.all(formPromises);
                refForms.push(...results.filter((result) => result !== null));
            }

            return refForms;
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async getTaskList() {
        console.warn('method is not implemented only use PalModeBackend');
        return null;
    }

    //////////////////////////////////////////////////////// PROJECT ////////////////////////////////////////////////////////
    async fetchProjectByStatus(status: string): Promise<any[]> {
        const me = this;
        const list = await storage.list('project', { match: { status: status } });

        if (!list) return [];
        if (!Array.isArray(list)) return [];

        return list.map((item: any) => {
            return me.returnProjectObject(item);
        });
    }

    async putProject(project: any) {
        try {
            return await storage.putObject('project', {
                project_id: project.projectId || this.uuid(),
                name: project.name || 'Untitled Project',
                start_date: project.startDate || new Date().toISOString(),
                end_date: project.endDate || null,
                due_date: project.dueDate || null,
                status: project.status || 'NEW',
                created_date: project.createdDate || new Date().toISOString(),
                user_id: project.userId || localStorage.getItem('email'),
                tenant_id: window.$tenantName
            });
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getProjectList(options?: any) {
        try {
            const me = this;
            if (!options) {
                // 기본 정렬
                options = {
                    orderBy: 'updated_at',
                    sort: 'desc',
                    match: {
                        tenant_id: window.$tenantName
                    }
                };
            }

            const lists = await storage.list('project', options);
            if (lists && lists.length > 0) {
                return lists.map((item: any) => {
                    return me.returnProjectObject(item);
                });
            }
            return [];
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getProjectListByStatus(status: string[], options?: any) {
        try {
            const me = this;
            if (!options) options = {};
            if (!status) return [];
            if (status.includes('*')) status = ['NEW', 'RUNNING', 'DONE', 'PENDING', 'IN_PROGRESS'];
            const email = window.localStorage.getItem('email');
            const filter = {
                inArray: {
                    column: 'status',
                    values: status
                },
                orderBy: 'updated_at',
                sort: 'desc',
                range: null,
                like: null,
                match: {
                    tenant_id: window.$tenantName
                }
            };

            if (options) {
                Object.keys(options).forEach((key) => {
                    filter[key] = options[key];
                });
            }
            return await me.getProjectList(filter);
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getUsage(options?: any) {
        try {
            if (!options) options = {};
            if (!options.match) options.match = {};
            if (!options.match['tenant_id']) options.match['tenant_id'] = window.$tenantName;

            const lists = await storage.list('usage', options);
            if (lists && lists.length > 0) {
                return lists.map((item: any) => {
                    return this.convertKeysToCamelCase(item);
                });
            }
            return [];
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getUsageWithService(options?: any) {
        try {
            if (!options) options = {};
            if (!options.startAt)
                options.startAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10).replace(/-/g, '-');
            if (!options.endAt) options.endAt = `${new Date().toISOString().slice(0, 10).replace(/-/g, '-')} 23:59:59`;

            return await storage.callProcedure('get_usage_with_service', {
                p_tenant_id: window.$tenantName,
                p_start_time: options.startAt,
                p_end_time: options.endAt
            });
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async watchOff(ref: any) {
        try {
            return await storage._watch_off(ref);
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }
    async watchProjectList(callback: (payload: any) => void) {
        try {
            return await storage._watch(
                {
                    channel: 'project',
                    table: 'project'
                },
                (payload) => {
                    let obj = payload;
                    if (payload.eventType === 'UPDATE') {
                        obj = { id: payload.old.project_id, value: this.returnProjectObject(payload.new) };
                    } else if (payload.eventType === 'INSERT') {
                        obj = { id: payload.new.project_id, value: this.returnProjectObject(payload.new) };
                    } else if (payload.eventType === 'DELETE') {
                        obj = { id: payload.old.project_id, value: null };
                    }
                    callback(obj);
                }
            );
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getProjectById(projectId: number) {
        try {
            const list = await storage.list('project', { match: { project_id: projectId } });
            const project = list && list.length > 0 ? list[0] : null;
            if (!project) return null;
            return this.returnProjectObject(project);
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getTaskDependencyByProjectId(projectId: number) {
        try {
            const list = await storage.list('v_task_dependency', {
                key: `*`,
                orderBy: 'project_id',
                startAt: projectId,
                endAt: projectId
            });

            return list.map((item: any) => {
                return this.returnDependencyObject(item);
            });
        } catch (e) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getTaskDependencyByInstId(instId: number) {
        try {
            const list = await storage.list('v_task_dependency', {
                key: `*`,
                orderBy: 'proc_inst_id',
                startAt: instId,
                endAt: instId
            });

            return list.map((item: any) => {
                return this.returnDependencyObject(item);
            });
        } catch (e) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async putTaskDependency(item: any) {
        try {
            return await storage.putObject('task_dependency', item);
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async deleteTaskDependency(id: string) {
        try {
            return await storage.delete('task_dependency', { match: { id: id } });
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    // 백엔드로 보낼 날짜 포맷 함수
    formatDateForBackend(date, isEndDate) {
        if (!date) return;
        let year, month, day;

        if (typeof date === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(date)) {
            // '일-월-연도' 형식
            const [d, m, y] = date.split('-');
            year = y;
            month = m.padStart(2, '0');
            day = d.padStart(2, '0');
        } else {
            // Date 객체 또는 ISO 문자열 등
            const d = new Date(date);
            year = d.getFullYear();
            month = String(d.getMonth() + 1).padStart(2, '0');
            day = String(d.getDate()).padStart(2, '0');
        }

        const time = isEndDate ? '23:59:59' : '00:00:00';
        return `${year}-${month}-${day}T${time}.000Z`;
    }

    async isColumnValueExists(table: string, key: string, value: string) {
        try {
            return !!(await storage.list(table, {
                orderBy: key,
                startAt: value,
                endAt: value,
                maybeSingle: true
            }));
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    private returnProjectObject(item: any) {
        return {
            projectId: item.project_id,
            name: item.name,
            startDate: item.start_date,
            endDate: item.end_date,
            dueDate: item.due_date,
            createdDate: item.created_date,
            status: item.status,
            tenantId: item.tenant_id,
            updatedAt: item.updated_at
        };
    }

    private returnInstanceObject(item: any) {
        if (!item || !item.proc_inst_id) return null;
        return {
            instId: item.proc_inst_id,
            defId: item.proc_def_id,
            defVersion: item.proc_def_version,
            name: item.proc_inst_name,
            projectId: item.project_id,
            currentActivityIds: item.current_activity_ids,
            participants: item.participants,
            roleBindings: item.role_bindings,
            variables_data: item.variables_data,
            status: item.status,
            tenantId: item.tenant_id,
            startDate: item.start_date,
            endDate: item.end_date,
            dueDate: item.due_date,
            updatedAt: item.updated_at,
            is_deleted: item.is_deleted,
            deleted_at: item.deleted_at,
            parent_proc_inst_id: item.parent_proc_inst_id,
            root_proc_inst_id: item.root_proc_inst_id,
            execution_scope: item.execution_scope,
            version: item.version,
            version_tag: item.version_tag
        };
    }

    private returnWorkItemObject(item: any) {
        return {
            defId: item.proc_def_id,
            instId: item.proc_inst_id,
            rootInstId: item.root_proc_inst_id || item.proc_inst_id,
            taskId: item.id,
            startDate: item.start_date,
            endDate: item.end_date,
            dueDate: item.due_date,
            status: item.status,
            name: item.activity_name,
            tool: item.tool || '',
            tracingTag: item.activity_id || '',
            description: item.description || '',
            endpoint: item.user_id,
            username: item.username,
            assignees: item.assignees || [],
            adhoc: item.adhoc || false,
            referenceIds: item.reference_ids || [],
            projectId: item.project_id || null,
            updatedAt: item.updated_at,
            log: item.log || '',
            task: item,
            version_tag: item.version_tag || null,
            version: item.version || null
        };
    }

    private returnDependencyObject(item: any) {
        return {
            ...item,
            lagTime: item.lag_time,
            leadTime: item.lead_time,
            createdDate: item.created_date,
            taskId: item.task_id,
            dependsId: item.depends_id,
            projectId: item.project_id,
            procInstId: item.proce_inst_id
        };
    }

    async getMCPTools() {
        try {
            const response = await axios.get('/completion/mcp-tools');
            return response.data;
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async getMCPByTenant() {
        try {
            const tenantId = window.$tenantName;
            const mcp = await storage.getString('tenants', { match: { id: tenantId }, column: 'mcp' });
            return mcp;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getCredits(options?: any) {
        try {
            if (!options) options = {};
            if (!options.match) options.match = {};
            if (!options.match['tenant_id']) options.match['tenant_id'] = window.$tenantName;

            const lists = await storage.list('credit', options);
            if (lists && lists.length > 0) {
                return lists.map((item: any) => {
                    return this.convertKeysToCamelCase(item);
                });
            }
            return [];
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getService(options?: any) {
        try {
            if (!options) options = {};
            if (!options.match) options.match = {};
            if (!options.match['tenant_id']) options.match['tenant_id'] = window.$tenantName;

            const lists = await storage.list('credit', options);
            if (lists && lists.length > 0) {
                return lists.map((item: any) => {
                    return this.convertKeysToCamelCase(item);
                });
            }
            return [];
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async getCurrentServiceCatalog() {
        try {
            return await storage.callProcedure('get_current_service_catalog', {
                p_tenant_id: window.$tenantName
            });
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async getCreditBalance() {
        try {
            return await storage.callProcedure('get_credit_balance', {
                p_tenant_id: window.$tenantName
            });
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async getValidCreditPurchase(options?: any) {
        try {
            if (!options.startAt) options.startAt = new Date().toISOString().slice(0, 10).replace(/-/g, '-');

            return await storage.callProcedure('get_valid_credit_purchases', {
                p_tenant_id: window.$tenantName,
                p_date: options.startAt
            });
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async watchCreditUsage(callback: (payload: any) => void) {
        try {
            return await storage._watch(
                {
                    channel: 'credit_usage',
                    table: 'credit_usage',
                    filter: `tenant_id=eq.(${window.$tenantName})`
                },
                (payload) => {
                    callback(payload);
                }
            );
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getPlans(options?: any) {
        try {
            if (!options) options = {};

            const lists = await storage.list('plan', options);
            if (lists && lists.length > 0) {
                return lists.map((item: any) => {
                    return this.convertKeysToCamelCase(item);
                });
            }
            return [];
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getCurrentPlan() {
        const me = this;
        try {
            // if(!options) options = {}
            // window.$tenantName;

            return {
                id: '1',
                tenant_id: window.$tenantName,
                plan_id: '7fb2d603-59ab-4365-948b-68c62d6622a5',
                user_id: 'sooheon45@uengine.org',
                start_at: '',
                end_at: '',
                created_at: null,
                plan: {
                    type: 'free',
                    status: 'active'
                }
            };
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async putRequestPayment(item: any) {
        try {
            return await storage.putObject('payment', item);
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    convertKeysToCamelCase(obj: any): any {
        if (typeof obj !== 'object' || obj === null) {
            return obj;
        }

        if (Array.isArray(obj)) {
            return obj.map((item) => this.convertKeysToCamelCase(item));
        }

        return Object.keys(obj).reduce((acc: any, key: string) => {
            const camelCaseKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
            acc[camelCaseKey] = this.convertKeysToCamelCase(obj[key]);
            return acc;
        }, {});
    }

    async setMCPByTenant(mcp: any) {
        try {
            const tenantId = window.$tenantName;
            await storage.putObject('tenants', { id: tenantId, mcp: mcp });
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async setSchedule(json: any) {
        try {
            const defId = json.proc_def_id;
            const activityId = json.event_id; // 여기서는 여전히 event_id 쓰고 있네?
            const cronExpression = json.cronExpression;
            const tenantId = window.$tenantName;
            const jobName = `${defId}_${activityId}_${tenantId}`;

            // ✅ JSON payload 만들어서 함수로 보냄
            const inputPayload = {
                input: {
                    process_definition_id: defId,
                    activity_id: activityId,
                    process_instance_id: 'new', // 필요하면 하드코딩
                    email: json.email ?? '', // 필요하면 외부에서 받기
                    tenant_id: tenantId
                }
            };

            await storage.callProcedure('register_cron_job', {
                p_job_name: jobName,
                p_cron_expr: cronExpression,
                p_input: inputPayload // 이제 JSONB 하나로!
            });

            console.log(`✅ pg_cron 잡 ${jobName} 등록 완료`);
        } catch (e) {
            throw new Error('setSchedule failed: ' + (e instanceof Error ? e.message : ''));
        }
    }

    async getSchedule(defId: string, eventId: string) {
        try {
            const tenantId = window.$tenantName;
            let jobName = `${defId}_${eventId}_${tenantId}`;
            let result = null;
            if (!defId || !eventId) {
                jobName = null;
                result = await storage.callProcedure('get_cron_jobs');
            } else {
                result = await storage.callProcedure('get_cron_jobs', {
                    p_job_name: jobName
                });
            }

            console.log(`✅ 잡 ${jobName} 조회 결과`, result);
            return result;
        } catch (e) {
            throw new Error('getSchedule failed: ' + (e instanceof Error ? e.message : ''));
        }
    }

    async deleteSchedule(job: any) {
        try {
            const jobName = job.jobname;

            await storage.callProcedure('delete_cron_job', {
                p_job_name: jobName
            });

            console.log(`✅ pg_cron 잡 ${jobName} 삭제 완료`);
        } catch (e) {
            throw new Error('deleteSchedule failed: ' + (e instanceof Error ? e.message : ''));
        }
    }

    async putEvent(newEvent: any) {
        try {
            return await storage.putObject('events', newEvent);
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getAgentEvents(taskId: string) {
        return (
            (await storage.list('events', {
                match: { todo_id: taskId },
                inArray: {
                    column: 'event_type',
                    values: [
                        'task_started',
                        'task_completed',
                        'crew_completed',
                        'tool_usage_started',
                        'tool_usage_finished',
                        'human_asked',
                        'human_response',
                        'error',
                        'human_checked',
                        'task_working'
                    ]
                },
                orderBy: 'timestamp'
            })) || []
        );
    }

    async getAgentEventById(eventId: string) {
        return await storage.getObject(`events/${eventId}`, { key: 'id' });
    }

    async getTodoStatus(taskId: string) {
        return await storage.list('todolist', {
            key: 'status, agent_mode, draft_status, feedback, agent_orch, consumer, draft, query',
            match: { id: taskId },
            maybeSingle: true
        });
    }

    async getTodoOutput(taskId: string) {
        return await storage.list('todolist', {
            key: 'output, output_url',
            match: { id: taskId },
            maybeSingle: true
        });
    }

    async watchAgentEvents(taskId: string, callback: (row: any) => void) {
        return await storage._watch(
            {
                channel: `events-${taskId}`,
                event: 'INSERT',
                table: 'events',
                filter: `todo_id=eq.${taskId}`
            },
            (payload: any) => {
                callback(payload.new);
            }
        );
    }

    async watchTodoStatus(taskId: string, callback: (newRow: any, oldRow: any) => void) {
        return await storage._watch(
            {
                channel: `todolist-${taskId}`,
                event: 'UPDATE',
                table: 'todolist',
                filter: `id=eq.${taskId}`
            },
            (payload: any) => {
                callback(payload.new, payload.old);
            }
        );
    }

    unwatchChannel(ref: any) {
        if (ref) {
            storage._watch_off(ref);
        }
    }

    // 상태 업데이트는 더 이상 사용하지 않음 (status 비사용 정책)

    async getData(path: string, options: any) {
        try {
            return await storage.getObject(path, options);
        } catch (error) {
            throw new Error(error.message);
        }
    }

    /**
     * 채팅 메시지 조회 (페이지네이션 지원)
     *
     * chats 테이블 스키마에는 created_at 같은 정렬 컬럼이 없고 uuid는 랜덤이라
     * messages->>'timeStamp' (ISO 문자열) 기준으로 정렬/커서를 잡는다.
     *
     * options:
     * - size: number (가져올 개수)
     * - sort: 'asc' | 'desc' (기본 'desc' = 최신부터)
     * - orderBy: string (기본 "messages->>timeStamp")
     * - endBefore: string (timeStamp ISO) - 이 값보다 "이전" 메시지들
     * - startAfter: string (timeStamp ISO) - 이 값보다 "이후" 메시지들
     */
    async getMessages(chatRoomId: string, options: any = {}) {
        try {
            const sizeRaw = options?.size ?? options?.limit ?? null;
            const size = Number(sizeRaw);
            const orderBy = (options?.orderBy || `messages->>timeStamp`).toString();
            const sort = (options?.sort || 'desc').toString();

            const listOptions: any = {
                match: { id: chatRoomId },
                orderBy,
                sort
            };
            if (Number.isFinite(size) && size > 0) listOptions.size = size;
            if (options?.endBefore) listOptions.endBefore = options.endBefore;
            if (options?.startAfter) listOptions.startAfter = options.startAfter;
            if (options?.range) listOptions.range = options.range;

            const messages = await storage.list('chats', listOptions);
            return messages;
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async getChatRoom(instId: string) {
        try {
            return await storage.getObject('chat_rooms', { match: { id: instId } });
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async getChatRoomList(path: string) {
        try {
            return await storage.list(path);
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async putObject(path: string, obj: any, options: any) {
        try {
            return await storage.putObject(path, obj, options);
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async pushObject(path: string, obj: any, options: any) {
        try {
            return await storage.pushObject(path, obj, options);
        } catch (error) {
            throw new Error(error.message);
        }
    }

    // async setObject(path: string, obj: any, options: any) {
    //     try {
    //         return await storage.setObject(`db://${path}`, obj, options);
    //     } catch (error) {
    //         throw new Error(error.message);
    //     }
    // }

    async delete(path: string, options: any) {
        try {
            return await storage.delete(path, options);
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async getDataSourceList() {
        try {
            const tenant_id = window.$tenantName;
            return await storage.list('data_source', {
                match: {
                    tenant_id: tenant_id
                }
            });
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async addDataSource(dataSource: any) {
        try {
            const tenant_id = window.$tenantName;
            dataSource.tenant_id = tenant_id;
            return await storage.putObject('data_source', dataSource);
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async updateDataSource(dataSource: any) {
        try {
            const tenant_id = window.$tenantName;
            dataSource.tenant_id = tenant_id;
            return await storage.putObject('data_source', dataSource);
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async deleteDataSource(dataSource: any) {
        try {
            return await storage.delete('data_source', { match: { uuid: dataSource.uuid } });
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async extractDatasourceSchema() {
        const datasource = await this.getDataSourceList();
        const datasourceResult = [];
        await Promise.all(
            datasource.map(async (item) => {
                const endpoint = item.value.endpoint;
                if (endpoint.includes(':54321')) {
                    const authKey = 'Authorization';
                    const authValue = 'Bearer ' + window.$supabase.supabaseKey;

                    const authHeader = item.value.headers.find((h) => h.key === authKey);
                    if (authHeader) {
                        authHeader.value = authValue;
                    } else {
                        item.value.headers.push({ key: authKey, value: authValue });
                    }
                }

                const response = await this.callDataSource(item);

                const result = [];

                for (const path in response.paths) {
                    const pathItem = response.paths[path];
                    const getMethod = pathItem.get;

                    if (getMethod && getMethod.responses?.['200']?.schema?.items?.$ref) {
                        const ref = getMethod.responses['200'].schema.items.$ref;
                        const defName = ref.replace('#/definitions/', '');
                        const definition = response.definitions[defName];

                        const columns = Object.keys(definition.properties || {});

                        result.push({
                            path,
                            description: getMethod.summary || '',
                            availableColumns: columns
                        });
                    }
                }
                datasourceResult.push({
                    endpoint: endpoint,
                    result: result
                });
            })
        );

        return datasourceResult;
    }

    async callDataSource(dataSource: any, bodyData: any = null) {
        const config = dataSource.value;

        let url = config.endpoint;

        if (config.method === 'GET' && Array.isArray(config.parameters)) {
            const params = config.parameters
                .filter((p) => p.key && p.value)
                .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
                .join('&');

            if (params) {
                url += (url.includes('?') ? '&' : '?') + params;
            }
        }

        const headers: Record<string, string> = {};
        if (Array.isArray(config.headers)) {
            config.headers.forEach((h) => {
                if (h.key && h.value) {
                    headers[h.key] = h.value;
                }
            });
        }

        if (config.auth?.enabled && config.auth.username) {
            const authString = btoa(`${config.auth.username}:${config.auth.password || ''}`);
            headers['Authorization'] = `Basic ${authString}`;
        }

        const fetchOptions: RequestInit = {
            method: config.method || 'GET',
            headers
        };

        if (['POST', 'PUT', 'PATCH'].includes(config.method.toUpperCase()) && bodyData) {
            fetchOptions.body = JSON.stringify(bodyData);
            headers['Content-Type'] = 'application/json';
        }

        const response = await fetch(url, fetchOptions);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} - ${response.statusText}`);
        }
        return await response.json();
    }

    async getEnvByTenant() {
        try {
            const configmaps = await axios.get('/mcp/configmaps');
            return configmaps.data;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getSecretByTenant() {
        try {
            const secret = await axios.get('/mcp/secrets');
            return secret.data;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async deleteEnvByTenant(name: string) {
        try {
            const response = await axios.delete(`/mcp/configmaps?name=${name}`);
            return response.data;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async deleteSecretByTenant(name: string) {
        try {
            const response = await axios.delete(`/mcp/secrets?name=${name}`);
            return response.data;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async createEnvByTenant(data: any) {
        try {
            const response = await axios.post(`/mcp/configmaps`, data);
            return response.data;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async createSecretByTenant(data: any) {
        try {
            const response = await axios.post(`/mcp/secrets`, data);
            return response.data;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async updateEnvByTenant(data: any) {
        try {
            const response = await axios.put(`/mcp/configmaps`, data);
            return response.data;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async updateSecretByTenant(data: any) {
        try {
            const response = await axios.put(`/mcp/secrets`, data);
            return response.data;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getBrowserUseSecretByTenant() {
        try {
            return await storage.getObject('env', {
                match: {
                    key: 'browser_use',
                    tenant_id: window.$tenantName
                }
            });
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async createBrowserUseSecretByTenant(data: any) {
        try {
            const secretData = {
                key: 'browser_use',
                value: JSON.stringify(data),
                tenant_id: window.$tenantName
            };
            const options = {
                match: {
                    key: 'browser_use',
                    tenant_id: window.$tenantName
                }
            };
            return await storage.putObject('env', secretData, options);
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async updateBrowserUseSecretByTenant(data: any) {
        try {
            const secretData = {
                key: 'browser_use',
                value: JSON.stringify(data),
                tenant_id: window.$tenantName
            };
            return await storage.putObject('env', secretData, {
                match: {
                    key: 'browser_use',
                    tenant_id: window.$tenantName
                }
            });
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async deleteBrowserUseSecretByTenant(name: string) {
        try {
            return await storage.delete('env', {
                match: {
                    key: 'browser_use',
                    tenant_id: window.$tenantName
                }
            });
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getMCPLists() {
        try {
            const response = await axios.get('/mcp/tools');
            return response.data;
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async getFieldValue(field: string, procDefId: string, instanceId: string) {
        try {
            if (!field || !procDefId || !instanceId) {
                throw new Error('field, procDefId, instanceId is required');
            }

            const fieldValue = {};
            const procDef = await this.getRawDefinition(procDefId, null);
            if (!procDef) {
                throw new Error('procDef not found');
            }
            const definition = procDef.definition;
            const fieldInfo = field.split('.');
            const formId = fieldInfo[0];
            const fieldId = fieldInfo[1];

            let activityId = null;
            if (definition.activities.length > 0) {
                definition.activities.forEach((activity: any) => {
                    if (activity.tool && activity.tool.includes('formHandler:') && activity.tool.replace('formHandler:', '') === formId) {
                        activityId = activity.id;
                    }
                });
            } else {
                activityId = null;
            }

            let executionScope = null;

            let workitem = null;
            let workitems = null;
            const { data, error } = await window.$supabase
                .from('todolist')
                .select('*')
                .eq('proc_inst_id', instanceId)
                .ilike('activity_id', activityId)
                .eq('status', 'DONE')
                .order('updated_at', { ascending: false })
                .limit(1);

            if (!error) {
                workitem = data[0];
            }

            if (!workitem) {
                const instance = await this.getInstance(instanceId);
                const rootInstanceId = instance.root_proc_inst_id;
                executionScope = instance.execution_scope;
                const { data, error } = await window.$supabase
                    .from('todolist')
                    .select('*')
                    .eq('proc_inst_id', rootInstanceId)
                    .ilike('activity_id', activityId)
                    .eq('status', 'DONE')
                    .order('updated_at', { ascending: false })
                    .limit(1);

                if (!error) {
                    workitem = data[0];
                }
            }

            if (!workitem) {
                const { data, error } = await window.$supabase
                    .from('todolist')
                    .select('*')
                    .eq('root_proc_inst_id', instanceId)
                    .ilike('activity_id', activityId);
                if (!error) {
                    workitems = data;

                    const sorted = (workitems ?? []).sort((a, b) => Number(a.execution_scope ?? 0) - Number(b.execution_scope ?? 0));

                    workitems = sorted;
                }
            }

            if (!workitem && !workitems) {
                throw new Error('workitem not found');
            }

            if (workitems) {
                const fieldList = [];
                workitems.forEach((item: any, index: number) => {
                    workitem = item;
                    const output = item.output;
                    if (output && output[formId]) {
                        const field = output[formId][fieldId];
                        if (field) {
                            fieldList.push(workitem.execution_scope + ':' + field);
                        }
                    }
                });

                fieldValue[formId] = {
                    [fieldId]: fieldList
                };
                return fieldValue;
            }
            if (workitem) {
                const output = workitem.output;
                if (output && output[formId]) {
                    const filed = output[formId][fieldId];
                    if (filed) {
                        fieldValue[formId] = {
                            [fieldId]: filed
                        };
                    } else {
                        const group = Object.values(output[formId]);
                        if (group) {
                            group.forEach((item: any) => {
                                if (executionScope) {
                                    if (item[executionScope][fieldId]) {
                                        fieldValue[formId] = {
                                            [fieldId]: item[executionScope][fieldId]
                                        };
                                    }
                                }
                            });
                        }
                    }
                    return fieldValue;
                } else {
                    return null;
                }
            }
        } catch (error) {
            throw new Error(error.message);
        }
    }

    groupFieldsByForm(fieldValues: any) {
        const formGroups = {};

        for (const key in fieldValues) {
            if (!fieldValues[key]) {
                continue;
            }

            const form_id = key.split('.')[0];
            if (!formGroups[form_id]) {
                formGroups[form_id] = {};
            }

            const field_id = key.split('.')[1];

            if (fieldValues[key] && form_id in fieldValues[key]) {
                const actual_value = fieldValues[key][form_id][field_id];
                if (actual_value) {
                    formGroups[form_id][field_id] = actual_value;
                } else {
                    formGroups[form_id][field_id] = '';
                }
            }
        }

        return formGroups;
    }

    async getFeedback(obj: any) {
        try {
            const response = await axios.post('/completion/get-feedback', obj);
            return response.data;
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async saveFeedback(feedback: string, taskId: string) {
        try {
            const workItem = await storage.getObject('todolist', {
                match: {
                    id: taskId
                }
            });
            workItem.temp_feedback = feedback;
            await storage.putObject('todolist', workItem);
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async getFeedbackDiff(taskId: string) {
        try {
            const response = await axios.post('/completion/get-feedback-diff', {
                taskId: taskId
            });
            return response.data;
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async applyFeedback(diff: any, taskId: string) {
        try {
            const workItem = await storage.getObject('todolist', {
                match: {
                    id: taskId
                }
            });
            if (!workItem) {
                throw new Error('workItem not found');
            }
            const defId = workItem.proc_def_id;
            const activityId = workItem.activity_id;
            const version = workItem.version;

            const process = await storage.getObject('proc_def_version', {
                match: {
                    proc_def_id: defId,
                    tenant_id: window.$tenantName,
                    version: version
                }
            });
            if (!process) {
                throw new Error('process not found');
            }

            const definition = process.definition;
            const activity = definition.activities.find((activity: any) => activity.id === activityId);
            if (!activity) {
                throw new Error('activity not found');
            }
            if (diff.inputData) {
                activity.inputData = diff.inputData;
            }
            if (diff.checkpoints) {
                activity.checkpoints = diff.checkpoints;
            }
            if (diff.description) {
                activity.description = diff.description;
            }
            if (diff.instruction) {
                activity.instruction = diff.instruction;
            }

            if (diff.conditionExamples && diff.conditionExamples.sequenceId) {
                const sequence = process.definition.sequences.find((sequence: any) => sequence.id === diff.conditionExamples.sequenceId);
                if (sequence) {
                    const properties = JSON.parse(sequence.properties);
                    properties.examples = {
                        good_example: diff.conditionExamples.good_example,
                        bad_example: diff.conditionExamples.bad_example
                    };
                    sequence.properties = JSON.stringify(properties);
                }
            }

            let parentVersion: string = process.version || version;
            if (parentVersion.includes('-')) {
                parentVersion = parentVersion.split('-')[0];
            }
            const newVersion = parentVersion + '-' + Math.random().toString(36).substring(2, 15);
            const newProcess = {
                proc_def_id: defId,
                version: newVersion,
                version_tag: 'minor',
                snapshot: process.snapshot,
                definition: definition,
                arcv_id: defId + '_' + newVersion,
                parent_version: parentVersion,
                source_todolist_id: workItem.id
            };
            await storage.putObject('proc_def_version', newProcess);

            // 병합 요청 생성
            const majorNum = (parseInt(String(parentVersion).split('.')[0]) || 0) + 1;
            const user = await this.getUserInfo();
            await this.createResourcePrRecord('bpmn', {
                resourceId: defId,
                branchName: `v${newVersion}`,
                baseBranch: `v${majorNum}.0`,
                title: `[피드백] ${activity.name || activityId} 정의 변경`,
                description: `피드백 기반 자동 생성 (task: ${workItem.id})`,
                requesterId: user.uid,
                requesterName: user.name || localStorage.getItem('userName') || ''
            });

            // 임시 minor 버전으로 해당 워크아이템만 재실행
            workItem.version = newVersion;
            workItem.version_tag = 'minor';
            workItem.status = 'SUBMITTED';
            await storage.putObject('todolist', workItem);

            const { arcv_id, parent_version, source_todolist_id, ...procDefData } = process;
            await storage.putObject('proc_def', procDefData, { onConflict: 'id,tenant_id' });
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async saveAccessPage(user_email: string, access_page: string) {
        try {
            const response = await storage.getObject('user_devices', {
                match: {
                    user_email: user_email
                }
            });
            if (response) {
                response.access_page = access_page;
                response.last_access_at = new Date().toISOString();
                await storage.putObject('user_devices', response);
            } else {
                await storage.putObject('user_devices', {
                    user_email: user_email,
                    access_page: access_page,
                    device_token: null,
                    last_access_at: new Date().toISOString()
                });
            }
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async getInstanceSource(proc_inst_id: string) {
        try {
            const response = await storage.list('proc_inst_source', {
                match: {
                    proc_inst_id: proc_inst_id
                },
                sort: 'desc',
                orderBy: 'created_at'
            });
            return response;
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async putInstanceSource(source: any) {
        try {
            return await storage.putObject('proc_inst_source', source);
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async deleteInstanceSource(source: any) {
        try {
            return await storage.delete('proc_inst_source', { match: { id: source.id } });
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async getUserById(id: string) {
        try {
            const user = await storage.getObject('users', {
                match: {
                    id: id,
                    tenant_id: window.$tenantName
                }
            });
            if (!user) {
                throw new Error('user not found');
            }
            return user;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getVecsDocuments(options?: any) {
        try {
            if (!options.agent_id) {
                throw new Error('agent_id is required');
            }
            const response = await storage.callProcedure('get_memories', {
                agent: options.agent_id,
                lim: options.limit || 100
            });
            if (response) {
                return response;
            }
            return [];
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async deleteVecsDocument(options?: any) {
        try {
            if (options.agent_id) {
                return await storage.callProcedure('delete_memories_by_agent', {
                    agent: options.agent_id
                });
            } else if (options.memory_id) {
                return await storage.callProcedure('delete_memory', {
                    mem_id: options.memory_id
                });
            }
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async getReworkActivities(workItem: any) {
        try {
            const response = await axios.post('/completion/get-rework-activities', workItem);
            if (response.status === 200) {
                return response.data;
            } else {
                throw new Error(response.data.message);
            }
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async reWorkItem(item?: any) {
        try {
            if (!item.instanceId || !item.activities) {
                throw new Error('instance Id and activities are required');
            }
            const response = await axios.post('/completion/rework-complete', item);
            if (response.status === 200) {
                return response.data;
            } else {
                throw new Error(response.data.message);
            }
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async enableRework(workItem?: any) {
        try {
            if (!workItem) {
                return false;
            }
            if (workItem.worklist) {
                const { worklist, activity, ...rest } = workItem;
                workItem = {
                    ...worklist,
                    ...activity,
                    ...rest
                };
            }

            const isCompleted = workItem.status === 'COMPLETED' || workItem.status === 'DONE';
            if (!isCompleted) {
                return false;
            }
            const currentUserId = localStorage.getItem('uid');
            const endpoint = workItem.endpoint;
            if (!currentUserId || !endpoint) {
                return false;
            }

            let isOwnWorkItem = false;
            if (Array.isArray(endpoint)) {
                isOwnWorkItem = endpoint.includes(currentUserId);
            } else {
                const endpointList = String(endpoint)
                    .split(',')
                    .map((e) => e.trim());
                isOwnWorkItem = endpointList.includes(currentUserId);
            }

            if (!isOwnWorkItem) {
                return false;
            }

            const activityId = workItem.tracingTag;
            const procInstId = workItem.instId;

            const allWorkItems = await storage.list('todolist', {
                match: {
                    proc_inst_id: procInstId,
                    activity_id: activityId,
                    tenant_id: window.$tenantName
                },
                orderBy: 'rework_count',
                sort: 'desc'
            });

            if (allWorkItems.length === 0) {
                return false;
            }

            const recentWorkItem = allWorkItems[0];
            const isRecentWorkItem = recentWorkItem.id === workItem.taskId;

            if (isRecentWorkItem) {
                return true;
            }

            const isAllCompleted = allWorkItems.every((item) => item.status === 'COMPLETED' || item.status === 'DONE');

            return isAllCompleted;
        } catch (error) {
            console.error('Error checking rework enable:', error);
            return false;
        }
    }

    async watchData(table: string, channel: string, callback: (payload: any) => void, options?: any) {
        try {
            const subscription = await storage.watch(table, channel, callback, options);
            return subscription;
        } catch (error) {
            throw new Error(error.message);
        }
    }

    /**
     * 에이전트 초기 지식 셋업 로그 조회 (agent_knowledge_setup_log).
     * @returns 해당 agent_id의 로그 행 1개 또는 null
     */
    async getAgentKnowledgeSetupLog(agentId: string): Promise<any | null> {
        try {
            const list = await storage.list('agent_knowledge_setup_log', {
                match: { agent_id: agentId }
            });
            if (list && list.length > 0) {
                return list[0];
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    async getTenantInfo(id: string) {
        try {
            const response = await storage.getObject('tenants', {
                match: {
                    id: id
                }
            });
            if (response) {
                return response;
            }
            return null;
        } catch (error) {
            throw new Error(error.message);
        }
    }

    // skills
    async saveSkills(skills: any, isOverride?: boolean) {
        try {
            const tenantId = window.$tenantName;
            const tenantInfo = await this.getTenantInfo(tenantId);
            if (!tenantInfo) {
                throw new Error('tenant not found');
            }
            let tenantSkills = tenantInfo.skills || [];
            if (isOverride) {
                tenantSkills = skills;
            } else {
                // 기존 skills와 새로운 skills를 병합하고 중복 제거
                const mergedSkills = [...new Set([...tenantSkills, ...skills])];
                tenantSkills = mergedSkills;
            }
            await storage.putObject('tenants', {
                id: tenantId,
                skills: tenantSkills
            });

            return tenantSkills;
        } catch (error) {
            throw new Error(error.message);
        }
    }

    /**
     * deepagent(bpmn-process-generation-skill)가 서비스 실행 모드에서 생성해 돌려준
     * 프로세스 정의 결과를 기존 저장 API로 영속화한다.
     * pdf2bpmn 백엔드의 후처리(_save_proc_def / _save_form_def / 스킬 동기화)와
     * 동일한 결과를 프론트에서 수행한다.
     *
     * 입력 result (references/09-service-execution.md 출력 계약):
     * {
     *   type: 'process-definition-result',
     *   processDefinition: { processDefinitionId, processDefinitionName, definition contract..., dmn_decisions, dmn_rules },
     *   forms?: [{ activity_id, form_id, html }],
     *   skills?: string[],
     *   bpmn?: string | null
     * }
     * options: { version?, version_tag?, owner? }
     */
    async saveGeneratedProcessArtifacts(result: any, options: any = {}) {
        if (!result) throw new Error('saveGeneratedProcessArtifacts: result is empty');

        // deepagent done.content가 문자열(JSON)로 오는 경우 파싱
        let payload: any = result;
        if (typeof payload === 'string') {
            try {
                payload = JSON.parse(payload);
            } catch (e) {
                throw new Error('saveGeneratedProcessArtifacts: result JSON 파싱 실패');
            }
        }

        // 최상위 래퍼 허용: { processDefinition: {...} } 또는 정의 객체 자체
        const def = payload.processDefinition || payload.process_definition || payload.definition || payload;
        const procDefId = def.processDefinitionId || def.processDefinitionID || def.id;
        const procName = def.processDefinitionName || def.name;
        if (!procDefId) {
            throw new Error('saveGeneratedProcessArtifacts: processDefinitionId 누락');
        }

        const saved: any = { procDefId, name: procName, forms: [], agents: [], skills: [], dmnRules: 0 };

        // 1) proc_def 저장 (definition JSON + bpmn). pdf2bpmn처럼 bpmn은 선택(없으면 null).
        await this.putRawDefinition(payload.bpmn ?? null, procDefId, {
            name: procName,
            type: 'bpmn',
            owner: options.owner || null,
            definition: def,
            version: options.version,
            version_tag: options.version_tag
        });

        // 2) 폼 저장 (form_def). 각 폼 HTML을 활동에 연결.
        const forms = Array.isArray(payload.forms) ? payload.forms : [];
        for (const f of forms) {
            const activityId = f.activity_id || f.activityId;
            const html = f.html || f.content;
            if (!activityId || !html) continue;
            const formId = f.form_id || f.formId || `${procDefId}_${String(activityId).toLowerCase()}_form`;
            try {
                await this.putRawDefinition(html, formId, {
                    type: 'form',
                    proc_def_id: procDefId,
                    activity_id: activityId
                });
                saved.forms.push(formId);
            } catch (e) {
                console.warn('[saveGeneratedProcessArtifacts] form 저장 실패:', formId, e);
            }
        }

        // 3) DMN 규칙 저장 (business rule raw). processDefinition.dmn_rules 또는 result.dmn 사용.
        const dmnRules: any[] = def.dmn_rules || payload.dmn?.dmn_rules || payload.dmn_rules || [];
        for (const rule of dmnRules) {
            const ruleId = rule.rule_id || rule.id;
            if (!ruleId) continue;
            try {
                await this.putRawDefinition(rule, ruleId, { type: 'rule' });
                saved.dmnRules++;
            } catch (e) {
                console.warn('[saveGeneratedProcessArtifacts] dmn rule 저장 실패:', ruleId, e);
            }
        }

        // 4) 에이전트 생성/매핑 (pdf2bpmn _insert_agent_user + _sync_skills_to_supabase 동일).
        //    - users(is_agent=true) 행 생성. 중복은 username/role 기준으로 기존 agent 재사용.
        //    - putAgent가 내부적으로 replaceAgentSkills로 agent_skills + users.skills 동기화.
        const agents: any[] = Array.isArray(payload.agents) ? payload.agents : Array.isArray(def.agents) ? def.agents : [];
        if (agents.length > 0) {
            let existingAgents: any[] = [];
            try {
                existingAgents =
                    (await storage.list('users', {
                        match: { is_agent: true, tenant_id: window.$tenantName }
                    })) || [];
            } catch (e) {
                /* best-effort: 기존 agent 조회 실패 시 신규 생성 */
            }
            const norm = (s: any) =>
                String(s || '')
                    .trim()
                    .toLowerCase()
                    .replace(/\s+/g, '');
            for (const a of agents) {
                try {
                    const name = a.name || a.username;
                    const role = a.role || '';
                    // 중복 방지: username/role이 같은 기존 agent 재사용 (pdf2bpmn 동일)
                    const dup = existingAgents.find(
                        (u: any) => (name && norm(u.username) === norm(name)) || (role && norm(u.role) === norm(role))
                    );
                    const agentId =
                        dup?.id ||
                        a.id ||
                        a.endpoint ||
                        (typeof crypto !== 'undefined' && (crypto as any).randomUUID
                            ? (crypto as any).randomUUID()
                            : `agent_${Date.now()}_${saved.agents.length}`);
                    const skills = Array.isArray(a.skills)
                        ? a.skills
                        : typeof a.skills === 'string'
                        ? a.skills
                              .split(',')
                              .map((s: string) => s.trim())
                              .filter(Boolean)
                        : [];
                    await this.putAgent({
                        id: agentId,
                        name,
                        role,
                        goal: a.goal || '',
                        persona: a.persona || '',
                        tools: a.tools || '',
                        endpoint: a.endpoint || null,
                        description: a.description || null,
                        skills,
                        model: a.model || null,
                        isAgent: true,
                        type: 'agent',
                        alias: a.alias || null
                    });
                    saved.agents.push(agentId);
                } catch (e) {
                    console.warn('[saveGeneratedProcessArtifacts] agent 저장 실패:', a?.name, e);
                }
            }
        }

        // 5) 재사용 스킬명 등록 (tenants.skills). 에이전트별 매핑은 위 putAgent에서 이미 수행됨.
        const skillNames: string[] = Array.isArray(payload.skills) ? payload.skills : Array.isArray(def.skills) ? def.skills : [];
        if (skillNames.length > 0) {
            try {
                await this.saveSkills(skillNames);
                saved.skills = skillNames;
            } catch (e) {
                console.warn('[saveGeneratedProcessArtifacts] skills 등록 실패:', e);
            }
        }

        return saved;
    }

    async uploadSkills(options: any) {
        try {
            let response: any = null;
            const header = {
                Accept: 'application/json'
            };
            if (options.type == 'file') {
                const form = new FormData();
                form.append('file', options.file, options.file.name);
                form.append('tenant_id', window.$tenantName);

                response = await axios.post('/process-gpt-deepagents/skills/upload', form, {
                    headers: header
                });
            } else if (options.type == 'url') {
                response = await axios.post(
                    '/process-gpt-deepagents/skills/upload-from-git',
                    {
                        repo_url: options.url,
                        tenant_id: window.$tenantName,
                        owner_id: localStorage.getItem('uid')
                    },
                    {
                        headers: header
                    }
                );
            }

            if (response.status === 201) {
                const skillName = response.data.skill_name;
                // skipRegister(draft): 파일만 업로드(편집기 로드용)하고 tenants.skills 목록 등록은 건너뛴다.
                // 최종 저장 시 호출부가 saveSkills 로 승격(목록 노출)한다.
                if (skillName && !options.skipRegister) {
                    await this.saveSkills([skillName]);
                }
                return response.data;
            } else {
                throw new Error(response);
            }
        } catch (error) {
            throw new Error(error.detail);
        }
    }

    async checkSkills(options: any) {
        try {
            const encodedSkills = encodeURIComponent(options.skillName);
            const tenantId = window.$tenantName;
            let query = `name=${encodedSkills}`;
            if (tenantId) {
                query += `&tenant_id=${tenantId}`;
            }
            const response = await axios.get(`/claude-skills/skills/check?${query}`);
            if (response.status === 200) {
                return response.data;
            } else {
                return false;
            }
        } catch (error) {
            console.log(error);
            return false;
        }
    }

    async deleteSkills(options: any) {
        try {
            const skillName = options.skillName;
            const response = await axios.delete(`/process-gpt-deepagents/skills/${encodeURIComponent(skillName)}`, {
                data: { tenant_id: window.$tenantName, mode: 'local' }
            });
            if (response.status === 200 && response.data && response.data.skill_name) {
                const deletedSkill = response.data.skill_name;
                const tenantId = window.$tenantName;
                const tenantInfo = await this.getTenantInfo(tenantId);
                if (!tenantInfo) {
                    throw new Error('tenant not found');
                }
                let tenantSkills = tenantInfo.skills || [];
                tenantSkills = tenantSkills.filter((skill: any) => skill.name !== deletedSkill);
                await this.saveSkills(tenantSkills);
                return response.data;
            } else {
                return false;
            }
        } catch (error) {
            throw new Error(error.detail);
        }
    }

    async getTenantSkills(tenantId: string) {
        try {
            const response = await axios.get(`/process-gpt-deepagents/skills?tenant_id=${encodeURIComponent(tenantId)}`);
            if (response.status === 200) {
                return response.data;
            } else {
                return [];
            }
        } catch (error) {
            console.error('테넌트 스킬 목록 조회 실패:', error);
            return [];
        }
    }

    async getTenantBuiltinSkills() {
        try {
            const response = await axios.get('/process-gpt-deepagents/skills-builtin');
            if (response.status === 200) {
                return response.data;
            } else {
                return [];
            }
        } catch (error) {
            console.error('기본 내장 스킬 목록 조회 실패:', error);
            return [];
        }
    }

    async getSkillFile(skillName: string, fileName?: string) {
        try {
            let url = `/process-gpt-deepagents/skills/${encodeURIComponent(skillName)}/files`;
            const tenantId = window.$tenantName;
            if (fileName) {
                url += `/${encodeURIComponent(fileName)}`;
            }
            if (tenantId) {
                url += `?tenant_id=${encodeURIComponent(tenantId)}`;
            }
            const response = await axios.get(url);
            if (response.status === 200) {
                return response.data;
            } else {
                return false;
            }
        } catch (error) {
            return false;
        }
    }

    async putSkillFile(
        skillName: string,
        filePath: string,
        content: string,
        commitMessage = 'docs: update skill description',
        branch = 'main'
    ) {
        try {
            const url = `/process-gpt-deepagents/skills/${encodeURIComponent(skillName)}/commit`;
            const tenantId = window.$tenantName;
            const body: any = {
                tenant_id: tenantId,
                file_path: filePath,
                content: content,
                message: commitMessage,
                branch: branch
            };
            if (localStorage.getItem('userName') && localStorage.getItem('email')) {
                body.author_name = localStorage.getItem('userName');
                body.author_email = localStorage.getItem('email');
            }

            const response = await axios.post(url, body, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if (response.status === 200 || response.status === 201) {
                return response.data;
            } else {
                throw new Error(response.data.message);
            }
        } catch (error) {
            throw new Error(error.detail);
        }
    }

    async addCommitToSkillPrBranch(
        skillName: string,
        branchName: string,
        filePath: string,
        content: string,
        commitMessage: string
    ): Promise<any> {
        return this.putSkillFile(skillName, filePath, content, commitMessage, branchName);
    }

    async getSkillBranches(skillName: string): Promise<{ branches: { name: string; sha: string }[]; default_branch: string }> {
        try {
            const params = new URLSearchParams();
            if (window.$tenantName) params.set('tenant_id', window.$tenantName);
            const url = `/process-gpt-deepagents/skills/${encodeURIComponent(skillName)}/branches?${params}`;
            const response = await axios.get(url);
            if (response.status === 200) {
                return {
                    branches: response.data.branches ?? [],
                    default_branch: response.data.default_branch || 'main'
                };
            }
            return { branches: [], default_branch: 'main' };
        } catch (error) {
            console.error('스킬 브랜치 목록 조회 실패:', error);
            return { branches: [], default_branch: 'main' };
        }
    }

    async getSkillCommits(skillName: string, branch?: string): Promise<any[]> {
        try {
            const params = new URLSearchParams();
            if (window.$tenantName) params.set('tenant_id', window.$tenantName);
            if (branch) params.set('branch', branch);
            const url = `/process-gpt-deepagents/skills/${encodeURIComponent(skillName)}/commits?${params}`;
            const response = await axios.get(url);
            if (response.status === 200) {
                return response.data.commits ?? [];
            }
            return [];
        } catch (error) {
            console.error('스킬 커밋 이력 조회 실패:', error);
            return [];
        }
    }

    async createSkillRepo(skillName: string, options?: { initialContent?: string; filePath?: string }) {
        const url = `/process-gpt-deepagents/skills/${encodeURIComponent(skillName)}/repo`;
        const body: Record<string, string> = { tenant_id: window.$tenantName };
        const uid = localStorage.getItem('uid');
        if (uid) body.owner_id = uid;
        if (options?.initialContent !== undefined) body.initial_content = options.initialContent;
        if (options?.filePath !== undefined) body.file_path = options.filePath;
        const response = await axios.post(url, body);
        if (response.status === 200 || response.status === 201) {
            return response.data;
        }
        throw new Error(response.data?.message || 'Repo creation failed');
    }

    async createSkillBranch(skillName: string, branch: string, from = 'main') {
        const url = `/process-gpt-deepagents/skills/${encodeURIComponent(skillName)}/branches`;
        const response = await axios.post(url, {
            tenant_id: window.$tenantName,
            branch,
            from
        });
        if (response.status === 200 || response.status === 201) {
            return response.data;
        }
        throw new Error(response.data?.message || 'Branch creation failed');
    }

    async createSkillPullRequest(skillName: string, title: string, description: string, head: string, base = 'main') {
        const url = `/process-gpt-deepagents/skills/${encodeURIComponent(skillName)}/pull-requests`;
        const response = await axios.post(url, {
            tenant_id: window.$tenantName,
            title,
            description,
            head,
            base
        });
        if (response.status === 200 || response.status === 201) {
            return response.data;
        }
        throw new Error(response.data?.message || 'PR creation failed');
    }

    async getSkillPullRequests(skillName: string, state = 'open') {
        const params = new URLSearchParams();
        if (window.$tenantName) params.set('tenant_id', window.$tenantName);
        params.set('state', state);
        const url = `/process-gpt-deepagents/skills/${encodeURIComponent(skillName)}/pull-requests?${params}`;
        const response = await axios.get(url);
        if (response.status === 200) return response.data;
        throw new Error(response.data?.message || 'Failed to fetch pull requests');
    }

    async getSkillPrFiles(
        skillName: string,
        prNumber: number
    ): Promise<{ filename: string; status: string; additions: number; deletions: number; patch?: string }[]> {
        try {
            const params = new URLSearchParams();
            if (window.$tenantName) params.set('tenant_id', window.$tenantName);
            const url = `/process-gpt-deepagents/skills/${encodeURIComponent(skillName)}/pull-requests/${prNumber}/files?${params}`;
            const response = await axios.get(url);
            if (response.status === 200) return response.data?.files ?? response.data ?? [];
            return [];
        } catch {
            return [];
        }
    }

    async mergeSkillPullRequest(skillName: string, prNumber: number, message?: string) {
        const url = `/process-gpt-deepagents/skills/${encodeURIComponent(skillName)}/pull-requests/${prNumber}/merge`;
        const response = await axios.post(url, {
            tenant_id: window.$tenantName,
            message: message || `Merge pull request #${prNumber}`,
            auto_sync: true
        });
        if (response.status === 200) return response.data;
        throw new Error(response.data?.message || 'Merge failed');
    }

    async getSkillBranchFiles(skillName: string, branch: string): Promise<any> {
        try {
            const params = new URLSearchParams();
            params.set('branch', branch);
            if (window.$tenantName) params.set('tenant_id', window.$tenantName);
            const url = `/process-gpt-deepagents/skills/${encodeURIComponent(skillName)}/branches/files?${params}`;
            const response = await axios.get(url);
            if (response.status === 200) {
                return response.data;
            }
            return null;
        } catch (error) {
            console.error('원격 브랜치 파일 목록 조회 실패:', error);
            return null;
        }
    }

    async getSkillBranchFile(skillName: string, branch: string, filePath: string): Promise<any> {
        try {
            const params = new URLSearchParams();
            params.set('branch', branch);
            if (window.$tenantName) params.set('tenant_id', window.$tenantName);
            const url = `/process-gpt-deepagents/skills/${encodeURIComponent(skillName)}/branches/files/${encodeURIComponent(
                filePath
            )}?${params}`;
            const response = await axios.get(url);
            if (response.status === 200) {
                return response.data;
            }
            return null;
        } catch (error) {
            console.error('원격 브랜치 파일 조회 실패:', error);
            return null;
        }
    }

    async getSkillInheritance(
        skillName: string
    ): Promise<{ skill: string; extends: string[]; chain: { name: string }[]; warnings?: string[] } | null> {
        try {
            const params = new URLSearchParams();
            if (window.$tenantName) params.set('tenant_id', window.$tenantName);
            const url = `/process-gpt-deepagents/skills/${encodeURIComponent(skillName)}/inheritance?${params}`;
            const response = await axios.get(url);
            if (response.status === 200) return response.data;
            return null;
        } catch {
            return null;
        }
    }

    async syncSkill(skillName: string) {
        const url = `/process-gpt-deepagents/skills/${encodeURIComponent(skillName)}/sync`;
        const response = await axios.post(url, { tenant_id: window.$tenantName });
        if (response.status === 200) {
            return response.data;
        }
        throw new Error(response.data?.message || 'Sync failed');
    }

    async getSkillOwner(skillName: string): Promise<string | null> {
        try {
            const tenantId = window.$tenantName;
            const row: any = await storage.getObject('tenant_skills', {
                match: { tenant_id: tenantId, skill_name: skillName }
            });
            return row?.owner_id ?? null;
        } catch (error) {
            return null;
        }
    }

    // ============================================================
    // 범용 리소스 PR 워크플로우 (DB: resource_pull_requests / resource_pr_reviews)
    // resourceType: 'skill' | 'proc_def' | 'dmn'
    // ============================================================

    async createResourcePrRecord(
        resourceType: 'skill' | 'bpmn' | 'dmn',
        data: {
            resourceId: string;
            branchName: string;
            baseBranch: string;
            title: string;
            description?: string;
            requesterId: string;
            requesterName?: string;
            gitPrNumber?: number;
            gitPrUrl?: string;
            gitRepoUrl?: string;
        }
    ): Promise<any> {
        const tenantId = window.$tenantName;
        const record = {
            id: this.uuid(),
            tenant_id: tenantId,
            resource_type: resourceType,
            resource_id: data.resourceId,
            branch_name: data.branchName,
            base_branch: data.baseBranch,
            title: data.title,
            description: data.description || null,
            status: 'OPEN',
            requester_id: data.requesterId,
            requester_name: data.requesterName || null,
            git_pr_number: data.gitPrNumber ?? null,
            git_pr_url: data.gitPrUrl ?? null,
            git_repo_url: data.gitRepoUrl ?? null
        };
        await storage.putObject('resource_pull_requests', record, { onConflict: 'id' });

        const ownerId = await this.getResourceOwner(resourceType, data.resourceId);
        if (ownerId && ownerId !== data.requesterId) {
            await this.sendNotification({
                userId: ownerId,
                type: 'merge_request',
                title: `[PR 요청] ${data.title}`,
                description: `${resourceType} 병합 요청`,
                url: this.getResourcePrUrl(resourceType, data.resourceId),
                fromUserId: data.requesterId
            });
        }

        return record;
    }

    async getResourcePrRecords(
        resourceType: 'skill' | 'bpmn' | 'dmn',
        resourceId: string,
        status?: string,
        gitUrlPrefix?: string
    ): Promise<any[]> {
        const tenantId = window.$tenantName;
        const match: any = { tenant_id: tenantId, resource_type: resourceType, resource_id: resourceId };
        if (status) match.status = status;
        const result = await storage.list('resource_pull_requests', { match, orderBy: 'created_at' });
        const records: any[] = Array.isArray(result) ? result : [];
        if (!gitUrlPrefix) return records;
        return records.filter((r) => !r.git_pr_url || r.git_pr_url.startsWith(gitUrlPrefix));
    }

    async updateResourcePrStatus(pr: any, status: string, fields: { reviewerId?: string; mergedAt?: string } = {}): Promise<void> {
        const update: any = {
            id: pr.id,
            tenant_id: window.$tenantName,
            resource_type: pr.resource_type,
            resource_id: pr.resource_id,
            branch_name: pr.branch_name,
            base_branch: pr.base_branch || 'main',
            title: pr.title,
            requester_id: pr.requester_id,
            status
        };
        if (fields.reviewerId) update.reviewer_id = fields.reviewerId;
        if (fields.mergedAt) update.merged_at = fields.mergedAt;
        await storage.putObject('resource_pull_requests', update, { onConflict: 'id' });

        const statusLabel: Record<string, string> = {
            APPROVED: '[PR 승인]',
            MERGED: '[PR 병합]',
            CHANGES_REQUESTED: '[수정 요청]'
        };
        if (statusLabel[status] && pr.requester_id) {
            await this.sendNotification({
                userId: pr.requester_id,
                type: 'merge_request',
                title: `${statusLabel[status]} ${pr.title}`,
                description: `${pr.resource_type} PR`,
                url: this.getResourcePrUrl(pr.resource_type, pr.resource_id),
                fromUserId: localStorage.getItem('email') || undefined
            });
        }
    }

    async addResourcePrReview(
        prId: string,
        action: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENT',
        comment: string,
        reviewerId: string,
        reviewerName?: string
    ): Promise<any> {
        const tenantId = window.$tenantName;
        const record = {
            id: this.uuid(),
            pr_id: prId,
            tenant_id: tenantId,
            reviewer_id: reviewerId,
            reviewer_name: reviewerName || null,
            action,
            comment: comment || null
        };
        await storage.putObject('resource_pr_reviews', record, { onConflict: 'id' });
        return record;
    }

    async getResourcePrReviews(prId: string): Promise<any[]> {
        const result = await storage.list('resource_pr_reviews', {
            match: { pr_id: prId },
            orderBy: 'created_at'
        });
        return Array.isArray(result) ? result : [];
    }

    async deleteSkillFile(skillName: string, fileName: string, commitMessage = 'chore: delete skill file', branch = 'main') {
        try {
            const url = `/process-gpt-deepagents/skills/${encodeURIComponent(skillName)}/files/${encodeURIComponent(fileName)}`;
            const data: any = {
                tenant_id: window.$tenantName,
                message: commitMessage,
                branch: branch
            };
            if (localStorage.getItem('userName') && localStorage.getItem('email')) {
                data.author_name = localStorage.getItem('userName');
                data.author_email = localStorage.getItem('email');
            }
            const response = await axios.delete(url, { data });
            if (response.status === 200) {
                return response.data;
            } else {
                throw new Error(response.data.message);
            }
        } catch (error) {
            throw new Error(error.detail);
        }
    }

    async claimWorkItem(taskId: string, data: any) {
        throw new Error('Method not implemented.');
    }
    // ============================================
    // Task Catalog API
    // ============================================

    async getTaskSystems() {
        const storage = StorageBaseFactory.getStorage();
        const options = {
            match: { tenant_id: window.$tenantName },
            orderBy: 'name'
        };
        const result = await storage.list('task_systems', options);
        return result || [];
    }

    async saveTaskSystem(system: any) {
        const storage = StorageBaseFactory.getStorage();
        const data = {
            ...system,
            id: system.id || this.uuid(),
            tenant_id: window.$tenantName
        };
        await storage.putObject('task_systems', data, {
            onConflict: 'id'
        });
        return data;
    }

    async deleteTaskSystem(id: string) {
        const storage = StorageBaseFactory.getStorage();
        await storage.delete('task_systems', {
            match: { id: id }
        });
    }

    async getTaskCatalogList(options?: any) {
        const storage = StorageBaseFactory.getStorage();
        const queryOptions: any = {
            match: { tenant_id: window.$tenantName },
            orderBy: 'display_name'
        };
        if (options?.taskType) {
            queryOptions.match.task_type = options.taskType;
        }
        if (options?.systemName) {
            queryOptions.match.system_name = options.systemName;
        }
        if (options?.search) {
            queryOptions.like = { display_name: `%${options.search}%` };
        }
        const result = await storage.list('task_catalog', queryOptions);
        return result || [];
    }

    async getTaskCatalog(id: string) {
        const storage = StorageBaseFactory.getStorage();
        const result = await storage.getObject('task_catalog', {
            match: { id: id }
        });
        return result;
    }

    async saveTaskCatalog(item: any) {
        const storage = StorageBaseFactory.getStorage();
        const systemName = item.system_name || item.systemName;
        const displayName = `${item.name} [${systemName}]`;
        const data = {
            ...item,
            id: item.id || this.uuid(),
            system_name: systemName,
            display_name: displayName,
            tenant_id: window.$tenantName,
            updated_at: new Date().toISOString()
        };
        // Remove the camelCase version if present
        delete data.systemName;
        if (!item.id) {
            data.created_at = new Date().toISOString();
        }
        await storage.putObject('task_catalog', data, {
            onConflict: 'id'
        });
        return data;
    }

    async deleteTaskCatalog(id: string) {
        const storage = StorageBaseFactory.getStorage();
        await storage.delete('task_catalog', {
            match: { id: id }
        });
    }

    async getPropertySchemas(taskType?: string, appliesTo?: string) {
        const storage = StorageBaseFactory.getStorage();
        const queryOptions: any = {
            match: { tenant_id: window.$tenantName },
            orderBy: 'display_order'
        };
        if (taskType) {
            queryOptions.match.task_type = taskType;
        }
        let result = await storage.list('task_property_schema', queryOptions);
        result = result || [];
        if (appliesTo && appliesTo !== 'all') {
            result = result.filter((s: any) => s.applies_to === appliesTo || s.applies_to === 'both');
        }
        return result;
    }

    async savePropertySchema(schema: any) {
        const storage = StorageBaseFactory.getStorage();
        const data = {
            ...schema,
            id: schema.id || this.uuid(),
            tenant_id: window.$tenantName
        };
        await storage.putObject('task_property_schema', data, {
            onConflict: 'id'
        });
        return data;
    }

    async deletePropertySchema(id: string) {
        const storage = StorageBaseFactory.getStorage();
        await storage.delete('task_property_schema', {
            match: { id: id }
        });
    }

    async getPaletteSettings() {
        const storage = StorageBaseFactory.getStorage();
        const result = await storage.getObject('configuration', {
            match: { key: 'palette_settings', tenant_id: window.$tenantName }
        });
        if (result && result.value) {
            return result.value;
        }
        // Default settings
        return {
            visibleTaskTypes: ['bpmn:ManualTask', 'bpmn:ServiceTask']
        };
    }

    async savePaletteSettings(settings: any) {
        const storage = StorageBaseFactory.getStorage();
        const existingId = await storage.getString('configuration', {
            match: { key: 'palette_settings', tenant_id: window.$tenantName },
            column: 'uuid'
        });
        const data = {
            uuid: existingId || this.uuid(),
            key: 'palette_settings',
            value: settings,
            tenant_id: window.$tenantName
        };
        await storage.putObject('configuration', data, {
            onConflict: 'uuid'
        });
        return settings;
    }

    // ============================================
    // Palette Task Types API
    // ============================================

    async getPaletteTaskTypes() {
        const storage = StorageBaseFactory.getStorage();
        const options = {
            match: { tenant_id: window.$tenantName },
            orderBy: 'display_order'
        };
        const result = await storage.list('palette_task_types', options);
        return result || [];
    }

    async updatePaletteTaskType(id: string, isEnabled: boolean) {
        const { data, error } = await window.$supabase.from('palette_task_types').update({ is_enabled: isEnabled }).eq('id', id).select();

        if (error) {
            throw new Error(error.message);
        }
        return data?.[0] || { id, is_enabled: isEnabled };
    }

    async getSkillHistory(agentId: string, skillName?: string) {
        try {
            const options: any = {
                match: {
                    agent_id: agentId,
                    tenant_id: window.$tenantName,
                    knowledge_type: 'SKILL'
                },
                sort: 'desc',
                orderBy: 'created_at'
            };

            if (skillName) {
                options.match.knowledge_id = skillName;
            }

            const history = await storage.list('agent_knowledge_history', options);
            return history || [];
        } catch (error) {
            console.error('스킬 히스토리 조회 실패:', error);
            return [];
        }
    }

    // ============================================
    // Task Execution Properties API (분석용)
    // ============================================

    /**
     * Task 완료 시 상태 업데이트
     */
    async updateTaskExecutionCompletion(params: {
        procInstId: string;
        activityId: string;
        status: 'COMPLETED' | 'CANCELLED' | 'FAILED';
    }): Promise<any> {
        const storage = StorageBaseFactory.getStorage();

        // 기존 STARTED 상태 레코드 찾기
        const existingRecord = await storage.getObject('task_execution_properties', {
            match: {
                proc_inst_id: params.procInstId,
                activity_id: params.activityId,
                execution_status: 'STARTED',
                tenant_id: window.$tenantName
            }
        });

        if (existingRecord && existingRecord.id) {
            const completedAt = new Date().toISOString();
            const startedAt = new Date(existingRecord.started_at);
            const durationMs = new Date(completedAt).getTime() - startedAt.getTime();
            const durationSeconds = Math.floor(durationMs / 1000);

            await storage.putObject(
                'task_execution_properties',
                {
                    id: existingRecord.id,
                    execution_status: params.status,
                    completed_at: completedAt,
                    actual_duration: `${durationSeconds} seconds`
                },
                { onConflict: 'id' }
            );

            return { ...existingRecord, execution_status: params.status, completed_at: completedAt };
        }
        return null;
    }

    /**
     * Task 실행 속성 목록 조회 (분석용)
     */
    async getTaskExecutionProperties(options?: {
        procDefId?: string;
        systemName?: string;
        agentMode?: string;
        dateFrom?: string;
        dateTo?: string;
        limit?: number;
    }): Promise<any[]> {
        const storage = StorageBaseFactory.getStorage();
        const queryOptions: any = {
            match: { tenant_id: window.$tenantName },
            orderBy: 'started_at',
            sort: 'desc'
        };

        if (options?.procDefId) queryOptions.match.proc_def_id = options.procDefId;
        if (options?.systemName) queryOptions.match.system_name = options.systemName;
        if (options?.agentMode) queryOptions.match.agent_mode = options.agentMode;
        if (options?.limit) queryOptions.size = options.limit;

        const result = await storage.list('task_execution_properties', queryOptions);
        return result || [];
    }

    // ============================================
    // FTE Heatmap API
    // ============================================

    async getDmnHistory(agentId: string, ruleId?: string) {
        try {
            const options: any = {
                match: {
                    agent_id: agentId,
                    tenant_id: window.$tenantName,
                    knowledge_type: 'DMN_RULE'
                },
                sort: 'desc',
                orderBy: 'created_at'
            };

            if (ruleId) {
                options.match.knowledge_id = ruleId;
            }

            const history = await storage.list('agent_knowledge_history', options);
            return history || [];
        } catch (error) {
            console.error('DMN 히스토리 조회 실패:', error);
            return [];
        }
    }

    /**
     * DMN 버전 적용 공통 로직
     * @param historyId 변경 이력 ID
     * @param ruleId DMN 규칙 ID
     * @param usePreviousContent true면 previous_content 사용 (되돌리기), false면 new_content 사용 (다시 적용)
     * @param useParentVersion true면 parent_version 사용, false면 version 사용
     * @param errorMessages 에러 메시지 객체
     */
    async applyDmnVersion(
        historyId: string,
        ruleId: string,
        usePreviousContent: boolean,
        useParentVersion: boolean,
        errorMessages: { contentNotFound: string; operationNotAllowed: string; applyFailed: string }
    ) {
        // 변경 이력 조회
        const history = await storage.getObject('agent_knowledge_history', {
            match: {
                id: historyId,
                tenant_id: window.$tenantName
            }
        });

        const contentKey = usePreviousContent ? 'previous_content' : 'new_content';
        if (!history || !history[contentKey]) {
            throw new Error(errorMessages.contentNotFound);
        }

        if (history.operation !== 'UPDATE') {
            throw new Error(errorMessages.operationNotAllowed);
        }

        // 현재 DMN 조회
        const currentDmn = await storage.getObject('proc_def', {
            match: {
                id: ruleId,
                tenant_id: window.$tenantName
            }
        });

        if (!currentDmn) {
            throw new Error('DMN 규칙을 찾을 수 없습니다.');
        }

        // 적용할 내용 가져오기
        const newContent = history[contentKey];

        // historyId로 proc_def_version 조회하여 버전 번호 가져오기
        let targetVersionNumber = currentDmn.prod_version;
        try {
            const targetVersion = await storage.getObject('proc_def_version', {
                match: {
                    uuid: historyId,
                    tenant_id: window.$tenantName
                }
            });
            if (targetVersion) {
                const versionKey = useParentVersion ? 'parent_version' : 'version';
                if (targetVersion[versionKey]) {
                    targetVersionNumber = targetVersion[versionKey];
                }
            }
        } catch (e) {
            // 버전을 찾지 못해도 계속 진행 (prod_version은 현재 값 유지)
        }

        // proc_def 테이블만 업데이트 (proc_def_version과 agent_knowledge_history는 수정하지 않음)
        currentDmn.bpmn = newContent;
        currentDmn.prod_version = targetVersionNumber;
        await storage.putObject('proc_def', currentDmn);

        return {
            success: true,
            version: targetVersionNumber
        };
    }

    async restoreDmnVersion(historyId: string, ruleId: string, agentId: string) {
        try {
            const result = await this.applyDmnVersion(
                historyId,
                ruleId,
                true, // previous_content 사용
                true, // parent_version 사용
                {
                    contentNotFound: '이전 버전 내용을 찾을 수 없습니다.',
                    operationNotAllowed: '되돌리기는 UPDATE 작업에만 가능합니다.',
                    applyFailed: 'DMN 버전 되돌리기에 실패했습니다.'
                }
            );

            return {
                ...result,
                message: '이전 버전으로 성공적으로 되돌렸습니다.'
            };
        } catch (error) {
            console.error('DMN 버전 되돌리기 실패:', error);
            throw new Error(error instanceof Error ? error.message : 'DMN 버전 되돌리기에 실패했습니다.');
        }
    }

    async reapplyDmnVersion(historyId: string, ruleId: string, agentId: string) {
        try {
            const result = await this.applyDmnVersion(
                historyId,
                ruleId,
                false, // new_content 사용
                false, // version 사용
                {
                    contentNotFound: '적용할 버전 내용을 찾을 수 없습니다.',
                    operationNotAllowed: '다시 적용은 UPDATE 작업에만 가능합니다.',
                    applyFailed: 'DMN 버전 적용에 실패했습니다.'
                }
            );

            return {
                ...result,
                message: '변경 사항을 성공적으로 적용했습니다.'
            };
        } catch (error) {
            console.error('DMN 버전 다시 적용 실패:', error);
            throw new Error(error instanceof Error ? error.message : 'DMN 버전 적용에 실패했습니다.');
        }
    }
    // ============================================
    // Task Execution Properties API (분석용)
    // ============================================

    /**
     * Task 실행 시작 시 속성 저장
     */
    async saveTaskExecutionProperties(params: {
        procDefId: string;
        procInstId: string;
        activityId: string;
        activityName?: string;
        todoId?: string;
        properties: any;
        executorEmail?: string;
    }): Promise<any> {
        const storage = StorageBaseFactory.getStorage();
        const props = params.properties || {};

        const data = {
            id: this.uuid(),
            tenant_id: window.$tenantName,
            proc_def_id: params.procDefId,
            proc_inst_id: params.procInstId,
            activity_id: params.activityId,
            activity_name: params.activityName,
            todo_id: params.todoId,

            // Task 속성
            role: props.role,
            duration: props.duration,
            instruction: props.instruction,
            description: props.description,
            checkpoints: props.checkpoints,

            // AI/Agent 속성
            agent_id: props.agent,
            agent_mode: props.agentMode !== 'none' ? props.agentMode : null,
            orchestration: props.orchestration,
            tool: props.tool,

            // 시스템 정보
            system_name: props.systemName,
            menu_name: props.menuName,

            // JSONB 데이터
            input_data: props.inputData || [],
            custom_properties: props.customProperties || [],

            // 실행 정보
            execution_status: 'STARTED',
            executor_email: params.executorEmail || localStorage.getItem('email')
        };

        await storage.putObject('task_execution_properties', data);
        return data;
    }

    // ============================================
    // FTE Heatmap API
    // ============================================

    /**
     * Activity별 FTE 설정 조회
     */
    async getActivityConfig(procDefId: string): Promise<any[]> {
        const storage = StorageBaseFactory.getStorage();
        try {
            const result = await storage.list('activity_config', {
                match: {
                    tenant_id: window.$tenantName,
                    proc_def_id: procDefId
                }
            });
            return result || [];
        } catch (e) {
            console.error('[ProcessGPTBackend] getActivityConfig error:', e);
            return [];
        }
    }

    /**
     * Activity FTE 설정 저장/업데이트
     */
    async saveActivityConfig(config: {
        procDefId: string;
        activityId: string;
        activityName?: string;
        standardMinutes: number;
        roleName?: string;
        complexityFactor?: number;
    }): Promise<any> {
        const storage = StorageBaseFactory.getStorage();
        const data = {
            tenant_id: window.$tenantName,
            proc_def_id: config.procDefId,
            activity_id: config.activityId,
            activity_name: config.activityName || config.activityId,
            standard_minutes: config.standardMinutes,
            role_name: config.roleName || 'Default',
            complexity_factor: config.complexityFactor || 1.0
        };

        try {
            // Upsert using putObject
            return await storage.putObject('activity_config', data);
        } catch (e) {
            console.error('[ProcessGPTBackend] saveActivityConfig error:', e);
            throw e;
        }
    }

    /**
     * Activity FTE 설정 일괄 저장
     */
    async saveActivityConfigBatch(
        procDefId: string,
        configs: Array<{
            activityId: string;
            activityName?: string;
            standardMinutes: number;
            roleName?: string;
        }>
    ): Promise<void> {
        for (const config of configs) {
            await this.saveActivityConfig({
                procDefId,
                ...config
            });
        }
    }

    /**
     * Role별 FTE 용량 조회
     */
    async getFteCapacity(): Promise<any[]> {
        const storage = StorageBaseFactory.getStorage();
        try {
            const result = await storage.list('fte_capacity', {
                match: { tenant_id: window.$tenantName }
            });
            return result || [];
        } catch (e) {
            console.error('[ProcessGPTBackend] getFteCapacity error:', e);
            return [];
        }
    }

    /**
     * Role FTE 용량 저장/업데이트
     */
    async saveFteCapacity(capacity: {
        roleName: string;
        availableFte: number;
        hoursPerDay?: number;
        workingDaysPerMonth?: number;
    }): Promise<any> {
        const storage = StorageBaseFactory.getStorage();
        const data = {
            tenant_id: window.$tenantName,
            role_name: capacity.roleName,
            available_fte: capacity.availableFte,
            hours_per_day: capacity.hoursPerDay || 8.0,
            working_days_per_month: capacity.workingDaysPerMonth || 20
        };

        try {
            // Upsert using putObject
            return await storage.putObject('fte_capacity', data);
        } catch (e) {
            console.error('[ProcessGPTBackend] saveFteCapacity error:', e);
            throw e;
        }
    }

    /**
     * Role FTE 용량 삭제
     */
    async deleteFteCapacity(roleName: string): Promise<void> {
        const storage = StorageBaseFactory.getStorage();
        try {
            const existing = await storage.list('fte_capacity', {
                match: {
                    tenant_id: window.$tenantName,
                    role_name: roleName
                }
            });

            if (existing && existing.length > 0) {
                await storage.delete('fte_capacity', existing[0].id);
            }
        } catch (e) {
            console.error('[ProcessGPTBackend] deleteFteCapacity error:', e);
            throw e;
        }
    }

    /**
     * FTE 스냅샷 저장 (일별 집계)
     */
    async saveFteSnapshot(snapshot: {
        procDefId: string;
        activityId: string;
        snapshotDate: string;
        instanceCount: number;
        totalWorkMinutes: number;
        workloadFte: number;
        peakConcurrent: number;
        peakFte: number;
        loadRatio: number;
    }): Promise<any> {
        const storage = StorageBaseFactory.getStorage();
        const data = {
            tenant_id: window.$tenantName,
            proc_def_id: snapshot.procDefId,
            activity_id: snapshot.activityId,
            snapshot_date: snapshot.snapshotDate,
            instance_count: snapshot.instanceCount,
            total_work_minutes: snapshot.totalWorkMinutes,
            workload_fte: snapshot.workloadFte,
            peak_concurrent: snapshot.peakConcurrent,
            peak_fte: snapshot.peakFte,
            load_ratio: snapshot.loadRatio
        };

        try {
            // Upsert using putObject
            return await storage.putObject('fte_snapshot', data);
        } catch (e) {
            console.error('[ProcessGPTBackend] saveFteSnapshot error:', e);
            throw e;
        }
    }

    /**
     * FTE 스냅샷 조회
     */
    async getFteSnapshots(options: { procDefId: string; dateFrom?: string; dateTo?: string }): Promise<any[]> {
        const storage = StorageBaseFactory.getStorage();
        try {
            const result = await storage.list('fte_snapshot', {
                match: {
                    tenant_id: window.$tenantName,
                    proc_def_id: options.procDefId
                },
                orderBy: 'snapshot_date',
                sort: 'desc'
            });
            return result || [];
        } catch (e) {
            console.error('[ProcessGPTBackend] getFteSnapshots error:', e);
            return [];
        }
    }

    // =====================================================
    // 노드 단위 댓글 API
    // =====================================================

    /**
     * 프로세스 정의의 특정 요소에 대한 댓글 목록 조회
     */
    async getElementComments(procDefId: string, elementId?: string): Promise<any[]> {
        const supabase = window.$supabase;
        if (!supabase) return [];

        try {
            let query = supabase
                .from('proc_def_comments')
                .select('*')
                .eq('proc_def_id', procDefId)
                .eq('tenant_id', window.$tenantName)
                .order('created_at', { ascending: true });

            if (elementId) {
                query = query.eq('element_id', elementId);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        } catch (e) {
            console.error('[ProcessGPTBackend] getElementComments error:', e);
            return [];
        }
    }

    /**
     * 프로세스 정의의 모든 요소에 대한 댓글 개수 조회
     */
    async getElementCommentCounts(procDefId: string): Promise<Record<string, { total: number; unresolved: number }>> {
        const supabase = window.$supabase;
        if (!supabase) return {};

        try {
            const { data, error } = await supabase.from('proc_def_element_comment_counts').select('*').eq('proc_def_id', procDefId);

            if (error) throw error;

            const result: Record<string, { total: number; unresolved: number }> = {};
            (data || []).forEach((item: any) => {
                result[item.element_id] = {
                    total: item.total_count || 0,
                    unresolved: item.unresolved_count || 0
                };
            });
            return result;
        } catch (e: any) {
            const isMissingView =
                e?.code === 'PGRST205' || (typeof e?.message === 'string' && e.message.includes('proc_def_element_comment_counts'));

            if (isMissingView) {
                if (!this.hasWarnedMissingElementCommentCountView) {
                    console.warn('[ProcessGPTBackend] proc_def_element_comment_counts 뷰/테이블이 없어 댓글 카운트 조회를 건너뜁니다.');
                    this.hasWarnedMissingElementCommentCountView = true;
                }
                return {};
            }

            console.error('[ProcessGPTBackend] getElementCommentCounts error:', e);
            return {};
        }
    }

    /**
     * 댓글 추가
     */
    async addElementComment(comment: {
        procDefId: string;
        elementId: string;
        elementType?: string;
        elementName?: string;
        content: string;
        parentCommentId?: string;
    }): Promise<any> {
        const supabase = window.$supabase;
        if (!supabase) throw new Error('Supabase not initialized');

        const user = window.$user || {};
        const data = {
            proc_def_id: comment.procDefId,
            element_id: comment.elementId,
            element_type: comment.elementType || null,
            element_name: comment.elementName || null,
            author_id: user.id || 'anonymous',
            author_name: user.name || user.email || 'Anonymous',
            content: comment.content,
            parent_comment_id: comment.parentCommentId || null,
            tenant_id: window.$tenantName
        };

        try {
            const { data: result, error } = await supabase.from('proc_def_comments').insert(data).select().single();

            if (error) throw error;
            return result;
        } catch (e) {
            console.error('[ProcessGPTBackend] addElementComment error:', e);
            throw e;
        }
    }

    /**
     * 댓글 수정
     */
    async updateElementComment(commentId: string, content: string): Promise<any> {
        const supabase = window.$supabase;
        if (!supabase) throw new Error('Supabase not initialized');

        try {
            const { data, error } = await supabase.from('proc_def_comments').update({ content }).eq('id', commentId).select().single();

            if (error) throw error;
            return data;
        } catch (e) {
            console.error('[ProcessGPTBackend] updateElementComment error:', e);
            throw e;
        }
    }

    /**
     * 댓글 삭제
     */
    async deleteElementComment(commentId: string): Promise<void> {
        const supabase = window.$supabase;
        if (!supabase) throw new Error('Supabase not initialized');

        try {
            const { error } = await supabase.from('proc_def_comments').delete().eq('id', commentId);

            if (error) throw error;
        } catch (e) {
            console.error('[ProcessGPTBackend] deleteElementComment error:', e);
            throw e;
        }
    }

    /**
     * 댓글 해결 처리
     */
    async resolveElementComment(commentId: string, resolved = true, resolveActionText?: string): Promise<any> {
        const supabase = window.$supabase;
        if (!supabase) throw new Error('Supabase not initialized');

        const user = window.$user || {};
        const updateData: any = {
            is_resolved: resolved
        };

        if (resolved) {
            updateData.resolved_by = user.name || user.email || 'Unknown';
            updateData.resolved_at = new Date().toISOString();
            if (resolveActionText) updateData.resolve_action_text = resolveActionText;
        } else {
            updateData.resolved_by = null;
            updateData.resolved_at = null;
            updateData.resolve_action_text = null;
        }

        try {
            const { data, error } = await supabase.from('proc_def_comments').update(updateData).eq('id', commentId).select().single();

            if (error) throw error;
            return data;
        } catch (e) {
            console.error('[ProcessGPTBackend] resolveElementComment error:', e);
            throw e;
        }
    }

    // =====================================================
    // 프로세스 승인 워크플로우 API
    // =====================================================

    /**
     * 프로세스 정의의 최신 승인 상태 조회
     */
    async getApprovalState(procDefId: string): Promise<any> {
        const supabase = window.$supabase;
        if (!supabase) return null;

        try {
            const { data, error } = await supabase
                .from('proc_def_approval_state')
                .select('*')
                .eq('proc_def_id', procDefId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) throw error;
            return data;
        } catch (e) {
            console.error('[ProcessGPTBackend] getApprovalState error:', e);
            return null;
        }
    }

    /**
     * 특정 리뷰 건 조회 (review_id로)
     */
    async getApprovalStateById(reviewId: string): Promise<any> {
        const supabase = window.$supabase;
        if (!supabase) return null;

        try {
            const { data, error } = await supabase.from('proc_def_approval_state').select('*').eq('id', reviewId).maybeSingle();

            if (error) throw error;
            return data;
        } catch (e) {
            console.error('[ProcessGPTBackend] getApprovalStateById error:', e);
            return null;
        }
    }

    /**
     * 검토 요청 (draft → in_review) - 새 리뷰 건 생성 + HQ/Field 병렬 승인 시작
     * 기존 진행 중인 리뷰가 있으면 자동 취소 후 새로 생성
     */
    async submitForReview(
        procDefId: string,
        comment?: string,
        version?: string,
        reviewers?: {
            hq?: { id: string; name: string };
            field?: { id: string; name: string };
        }
    ): Promise<any> {
        // 기존 활성 리뷰 모두 일괄 취소
        const supabase = window.$supabase;
        if (supabase) {
            try {
                await supabase
                    .from('proc_def_approval_state')
                    .update({
                        state: 'cancelled',
                        reject_comment: 'Cancelled: new review submitted',
                        updated_at: new Date().toISOString()
                    })
                    .eq('proc_def_id', procDefId)
                    .eq('tenant_id', window.$tenantName)
                    .not('state', 'in', '("draft","published","rejected","cancelled","archived")');
            } catch (e) {
                console.warn('[ProcessGPTBackend] Failed to cancel existing reviews:', e);
            }
        }
        return this._changeApprovalState(procDefId, 'submit', 'in_review', comment, { version, reviewers });
    }

    /**
     * 본사(HQ) 승인 - 병렬 승인 중 하나
     * HQ + Field 모두 승인 시 자동으로 public_feedback 진입
     */
    async approveHQ(reviewId: string, comment?: string): Promise<any> {
        return this._changeApprovalState(reviewId, 'approve_hq', 'in_review', comment);
    }

    /**
     * 현업(Field) 승인 - 병렬 승인 중 하나
     * HQ + Field 모두 승인 시 자동으로 public_feedback 진입
     */
    async approveField(reviewId: string, comment?: string): Promise<any> {
        return this._changeApprovalState(reviewId, 'approve_field', 'in_review', comment);
    }

    /**
     * 본사(HQ) 반려 - 병렬 검토 중 반려
     */
    async rejectHQ(reviewId: string, comment: string): Promise<any> {
        return this._changeApprovalState(reviewId, 'reject_hq', 'rejected', comment);
    }

    /**
     * 현업(Field) 반려 - 병렬 검토 중 반려
     */
    async rejectField(reviewId: string, comment: string): Promise<any> {
        return this._changeApprovalState(reviewId, 'reject_field', 'rejected', comment);
    }

    /**
     * 최종 배포 (final_edit → published)
     * 미해결 피드백이 0건이어야만 실행 가능
     */
    async publishDefinition(reviewId: string, comment?: string): Promise<any> {
        // 미해결 피드백 검증
        const supabase = window.$supabase;
        if (supabase) {
            const state = await this.getApprovalStateById(reviewId);
            if (state) {
                const { data: unresolvedComments } = await supabase
                    .from('proc_def_comments')
                    .select('id', { count: 'exact', head: true })
                    .eq('proc_def_id', state.proc_def_id)
                    .eq('tenant_id', window.$tenantName)
                    .eq('is_resolved', false)
                    .is('parent_comment_id', null);
                if (unresolvedComments && (unresolvedComments as any).length > 0) {
                    throw new Error('미해결 피드백이 존재합니다. 모든 피드백을 해결한 후 배포할 수 있습니다.');
                }
            }
        }
        return this._changeApprovalState(reviewId, 'publish', 'published', comment);
    }

    /**
     * 공람 조기 종료 (public_feedback → final_edit)
     */
    async endPublicFeedback(reviewId: string, comment?: string): Promise<any> {
        return this._changeApprovalState(reviewId, 'end_public_feedback', 'final_edit', comment);
    }

    /**
     * 반려 (어느 상태에서든 → rejected)
     */
    async rejectDefinition(procDefIdOrReviewId: string, comment: string): Promise<any> {
        return this._changeApprovalState(procDefIdOrReviewId, 'reject', 'rejected', comment);
    }

    /**
     * 재작성 (rejected → draft)
     */
    async reopenDefinition(procDefIdOrReviewId: string, comment?: string): Promise<any> {
        return this._changeApprovalState(procDefIdOrReviewId, 'reopen', 'draft', comment);
    }

    /**
     * 승인 취소 (진행 중인 리뷰 → cancelled)
     */
    async cancelApproval(procDefIdOrReviewId: string, comment?: string): Promise<any> {
        return this._changeApprovalState(procDefIdOrReviewId, 'cancel', 'cancelled', comment);
    }

    /**
     * 현장 개선 요청 (Published 모델에 대한 수정 요청)
     */
    async requestReopen(procDefId: string, reason: string): Promise<any> {
        return this._changeApprovalState(procDefId, 'request_reopen', 'reopen_requested', reason);
    }

    /**
     * 개선 요청 승인 (Master) → 자동으로 v(N+1).0 Draft 생성
     */
    async approveReopen(reviewId: string, comment?: string): Promise<any> {
        const result = await this._changeApprovalState(reviewId, 'approve_reopen', 'draft', comment);

        // 새 Draft 리뷰 자동 생성 (v(N+1).0)
        if (result) {
            const supabase = window.$supabase;
            if (supabase) {
                const currentMajor = result.major_version || 1;
                const newVersion = `v${currentMajor + 1}.0`;

                const { data: newDraft } = await supabase
                    .from('proc_def_approval_state')
                    .insert({
                        proc_def_id: result.proc_def_id,
                        state: 'draft',
                        major_version: currentMajor + 1,
                        minor_version: 0,
                        version_label: newVersion,
                        root_cause_review_id: result.id,
                        submitted_by: result.reopen_requested_by,
                        tenant_id: result.tenant_id,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .select()
                    .single();

                return newDraft || result;
            }
        }
        return result;
    }

    /**
     * 개선 요청 반려 (Master) → 현행 유지 (published 상태로 복원)
     */
    async rejectReopen(reviewId: string, comment?: string): Promise<any> {
        return this._changeApprovalState(reviewId, 'reject_reopen', 'published', comment);
    }

    /**
     * 승인 Reset: 모델 수정 발생 시 기존 병렬 승인 내역 초기화
     */
    async resetApprovals(reviewId: string): Promise<any> {
        const supabase = window.$supabase;
        if (!supabase) return null;

        try {
            const { data, error } = await supabase
                .from('proc_def_approval_state')
                .update({
                    hq_status: 'pending',
                    hq_reviewed_at: null,
                    hq_review_comment: null,
                    field_status: 'pending',
                    field_reviewed_at: null,
                    field_review_comment: null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', reviewId)
                .eq('state', 'in_review')
                .select()
                .single();

            if (error) throw error;

            // 이력 기록
            if (data) {
                await supabase.from('proc_def_approval_history').insert({
                    proc_def_id: data.proc_def_id,
                    review_id: data.id,
                    action: 'reset_approvals',
                    from_state: 'in_review',
                    to_state: 'in_review',
                    actor_id: 'system',
                    actor_name: 'System',
                    comment: '모델 수정으로 인한 승인 내역 초기화',
                    tenant_id: window.$tenantName
                });
            }

            return data;
        } catch (e) {
            console.error('[ProcessGPTBackend] resetApprovals error:', e);
            return null;
        }
    }

    /**
     * Self-Approval 체크: 기안자와 현재 사용자가 동일한지 확인
     */
    async checkSelfApproval(reviewId: string): Promise<boolean> {
        const supabase = window.$supabase;
        if (!supabase) return false;

        try {
            const state = await this.getApprovalStateById(reviewId);
            if (!state) return false;

            const { data: authData } = await supabase.auth.getUser();
            if (!authData?.user) return false;

            const { data: userData } = await supabase.from('users').select('username').eq('id', authData.user.id).limit(1).maybeSingle();

            const currentUserName = userData?.username || authData.user.email || '';
            return state.submitted_by === currentUserName;
        } catch (e) {
            return false;
        }
    }

    /**
     * 3-Way Inbox 데이터 조회
     * @param inbox - 'approval' | 'reopen' | 'submissions'
     */
    async getReviewBoardByInbox(inbox: 'approval' | 'reopen' | 'submissions'): Promise<any[]> {
        const supabase = window.$supabase;
        if (!supabase) return [];
        const tenantId = window.$tenantName;

        try {
            let userId = '';
            let userName = '';
            const { data: authData } = await supabase.auth.getUser();
            if (authData?.user) {
                userId = authData.user.id;
                const { data: userData } = await supabase
                    .from('users')
                    .select('username')
                    .eq('id', authData.user.id)
                    .limit(1)
                    .maybeSingle();
                userName = userData?.username || authData.user.email || '';
            }

            let query = supabase.from('v_review_board').select('*').eq('tenant_id', tenantId);

            switch (inbox) {
                case 'approval':
                    // 내가 HQ 또는 Field 검토자로 지정된 건 (pending 상태)
                    query = query.or(
                        `and(hq_reviewer_id.eq.${userId},hq_status.eq.pending),and(field_reviewer_id.eq.${userId},field_status.eq.pending),assigned_reviewer_id.eq.${userId}`
                    );
                    break;
                case 'reopen':
                    // Re-open 요청 건 (Master 전용)
                    query = query.eq('state', 'reopen_requested');
                    break;
                case 'submissions':
                    // 내가 상신한 건
                    query = query.eq('submitted_by', userName);
                    break;
            }

            const { data, error } = await query.order('updated_at', { ascending: false });
            if (error) throw error;
            return data || [];
        } catch (e) {
            console.error('[ProcessGPTBackend] getReviewBoardByInbox error:', e);
            return [];
        }
    }

    /**
     * 스냅샷 저장 (stage 진입 시점의 BPMN 상태)
     */
    async saveSnapshot(reviewId: string, procDefId: string, stage: string, bpmnXml: string, bpmnJson?: any): Promise<any> {
        const supabase = window.$supabase;
        if (!supabase) return null;

        try {
            const state = await this.getApprovalStateById(reviewId);
            const { data, error } = await supabase
                .from('proc_def_snapshots')
                .insert({
                    review_id: reviewId,
                    proc_def_id: procDefId,
                    stage,
                    major_version: state?.major_version,
                    minor_version: state?.minor_version,
                    bpmn_xml: bpmnXml,
                    bpmn_json: bpmnJson || null,
                    tenant_id: window.$tenantName
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (e) {
            console.error('[ProcessGPTBackend] saveSnapshot error:', e);
            return null;
        }
    }

    /**
     * 스냅샷 조회 (비교용)
     */
    async getSnapshots(reviewId: string): Promise<any[]> {
        const supabase = window.$supabase;
        if (!supabase) return [];

        try {
            const { data, error } = await supabase
                .from('proc_def_snapshots')
                .select('*')
                .eq('review_id', reviewId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            return data || [];
        } catch (e) {
            console.error('[ProcessGPTBackend] getSnapshots error:', e);
            return [];
        }
    }

    /**
     * 진행 중인(활성) 승인 건 조회 (draft/confirmed/rejected/cancelled 제외)
     */
    async getActiveApprovalState(procDefId: string): Promise<any> {
        const supabase = window.$supabase;
        if (!supabase) return null;

        try {
            const { data, error } = await supabase
                .from('proc_def_approval_state')
                .select('*')
                .eq('proc_def_id', procDefId)
                .eq('tenant_id', window.$tenantName)
                .not('state', 'in', '("draft","published","rejected","cancelled","archived")')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) throw error;
            return data;
        } catch (e) {
            console.error('[ProcessGPTBackend] getActiveApprovalState error:', e);
            return null;
        }
    }

    /**
     * 승인 상태 변경 내부 메서드
     * - submit: 항상 새 리뷰 건 INSERT (per-submission)
     * - approve_hq/approve_field: 병렬 승인 처리, 양측 완료 시 자동 공람 진입
     * - publish: proc_def.bpmn 반영 + 구버전 아카이빙
     * - request_reopen: Published → reopen_requested
     * - approve_reopen/reject_reopen: Master 판단
     * @param procDefIdOrReviewId - submit/request_reopen 시 proc_def_id, 그 외 review_id 또는 proc_def_id
     */
    private async _changeApprovalState(
        procDefIdOrReviewId: string,
        action: string,
        toState: string,
        comment?: string,
        options?: {
            version?: string;
            assignedReviewer?: { id: string; name: string };
            reviewers?: {
                hq?: { id: string; name: string };
                field?: { id: string; name: string };
            };
        }
    ): Promise<any> {
        const supabase = window.$supabase;
        if (!supabase) throw new Error('Supabase not initialized');

        // Supabase auth에서 유저 정보 조회
        let userId = 'anonymous';
        let userName = 'Anonymous';
        try {
            const { data: authData } = await supabase.auth.getUser();
            if (authData?.user) {
                userId = authData.user.id;
                const { data: userData } = await supabase
                    .from('users')
                    .select('username, email')
                    .eq('id', authData.user.id)
                    .limit(1)
                    .maybeSingle();
                userName = userData?.username || authData.user.email || 'Anonymous';
            }
        } catch (authErr) {
            console.warn('Failed to get user info for approval:', authErr);
        }
        const now = new Date().toISOString();

        try {
            let currentState: any = null;
            let procDefId: string;

            if (action === 'submit' || action === 'request_reopen') {
                // submit/request_reopen: procDefIdOrReviewId는 proc_def_id
                procDefId = procDefIdOrReviewId;
                if (action === 'request_reopen') {
                    // Published 상태의 최신 리뷰 조회
                    currentState = await this.getApprovalState(procDefIdOrReviewId);
                }
            } else {
                // 다른 액션: reviewId(UUID) 또는 proc_def_id로 조회
                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(procDefIdOrReviewId);
                if (isUUID) {
                    currentState = await this.getApprovalStateById(procDefIdOrReviewId);
                }
                if (!currentState) {
                    currentState = await this.getApprovalState(procDefIdOrReviewId);
                }
                if (!currentState) {
                    throw new Error('No active review found for: ' + procDefIdOrReviewId);
                }
                procDefId = currentState.proc_def_id;
            }

            const fromState = currentState?.state || 'draft';

            if (action === 'submit') {
                // version이 없으면 최신 버전 자동 조회
                let submitVersion = options?.version || null;
                if (!submitVersion) {
                    try {
                        const { data: latestVer } = await supabase
                            .from('proc_def_version')
                            .select('version')
                            .eq('proc_def_id', procDefId)
                            .eq('tenant_id', window.$tenantName)
                            .order('timeStamp', { ascending: false })
                            .limit(1)
                            .maybeSingle();
                        if (latestVer?.version) {
                            submitVersion = latestVer.version;
                        }
                    } catch (e) {
                        console.warn('[_changeApprovalState] Failed to fetch latest version:', e);
                    }
                }

                // 새 리뷰 건 INSERT (병렬 승인 검토자 포함)
                const stateData: any = {
                    proc_def_id: procDefId,
                    state: toState,
                    version: submitVersion,
                    submitted_by: userName,
                    submitted_at: now,
                    submit_comment: comment || null,
                    // 병렬 승인 검토자 지정
                    hq_reviewer_id: options?.reviewers?.hq?.id || null,
                    hq_reviewer_name: options?.reviewers?.hq?.name || null,
                    hq_status: 'pending',
                    field_reviewer_id: options?.reviewers?.field?.id || null,
                    field_reviewer_name: options?.reviewers?.field?.name || null,
                    field_status: 'pending',
                    tenant_id: window.$tenantName,
                    created_at: now,
                    updated_at: now
                };

                const { data, error } = await supabase.from('proc_def_approval_state').insert(stateData).select().single();

                if (error) throw error;
                currentState = data;
            } else {
                // 기존 리뷰 건 UPDATE
                const updateData: any = {
                    state: toState,
                    updated_at: now
                };

                // 다음 담당자 지정
                if (options?.assignedReviewer) {
                    updateData.assigned_reviewer_id = options.assignedReviewer.id;
                    updateData.assigned_reviewer_name = options.assignedReviewer.name;
                }

                switch (action) {
                    // === 병렬 승인 (HQ) ===
                    case 'approve_hq':
                        updateData.hq_status = 'approved';
                        updateData.hq_reviewed_at = now;
                        updateData.hq_review_comment = comment || null;
                        // 양측 모두 승인 완료 시 → 자동 공람 진입
                        if (currentState.field_status === 'approved') {
                            updateData.state = 'public_feedback';
                            updateData.public_feedback_started_at = now;
                            updateData.public_feedback_ends_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
                            toState = 'public_feedback';
                        }
                        break;

                    // === 병렬 승인 (Field) ===
                    case 'approve_field':
                        updateData.field_status = 'approved';
                        updateData.field_reviewed_at = now;
                        updateData.field_review_comment = comment || null;
                        // 양측 모두 승인 완료 시 → 자동 공람 진입
                        if (currentState.hq_status === 'approved') {
                            updateData.state = 'public_feedback';
                            updateData.public_feedback_started_at = now;
                            updateData.public_feedback_ends_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
                            toState = 'public_feedback';
                        }
                        break;

                    // === 공람 조기 종료 ===
                    case 'end_public_feedback':
                        updateData.public_feedback_auto_transitioned = true;
                        break;

                    // === 병렬 반려 ===
                    case 'reject_hq':
                        updateData.hq_status = 'rejected';
                        updateData.hq_reviewed_at = now;
                        updateData.hq_review_comment = comment || null;
                        updateData.rejected_by_id = userId;
                        updateData.rejected_by_name = userName;
                        updateData.rejected_at = now;
                        updateData.reject_comment = `[HQ] ${comment || ''}`;
                        break;

                    case 'reject_field':
                        updateData.field_status = 'rejected';
                        updateData.field_reviewed_at = now;
                        updateData.field_review_comment = comment || null;
                        updateData.rejected_by_id = userId;
                        updateData.rejected_by_name = userName;
                        updateData.rejected_at = now;
                        updateData.reject_comment = `[Field] ${comment || ''}`;
                        break;

                    // === 최종 배포 ===
                    case 'publish':
                        updateData.published_by_id = userId;
                        updateData.published_by_name = userName;
                        updateData.published_at = now;
                        updateData.publish_comment = comment || null;
                        // 거버넌스 버전 규칙:
                        // - 최초 배포(major_version=0): v1.0
                        // - Re-open Draft(major_version이 이미 N+1로 설정됨): 그대로 유지
                        const currentMajor = currentState.major_version || 0;
                        if (currentMajor === 0) {
                            // 최초 배포: v0.x → v1.0
                            updateData.major_version = 1;
                            updateData.minor_version = 0;
                            updateData.version_label = 'v1.0';
                        } else {
                            // Re-open 후 배포: major는 draft 생성 시 이미 설정됨, minor=0 확정
                            updateData.major_version = currentMajor;
                            updateData.minor_version = 0;
                            updateData.version_label = `v${currentMajor}.0`;
                        }
                        // proc_def.bpmn 반영
                        try {
                            let publishVersion = currentState.version;

                            // version이 없으면 최신 버전 자동 조회 (fallback)
                            if (!publishVersion) {
                                const { data: latestVer } = await supabase
                                    .from('proc_def_version')
                                    .select('version')
                                    .eq('proc_def_id', procDefId)
                                    .eq('tenant_id', window.$tenantName)
                                    .order('timeStamp', { ascending: false })
                                    .limit(1)
                                    .maybeSingle();
                                if (latestVer?.version) {
                                    publishVersion = latestVer.version;
                                }
                            }

                            if (publishVersion) {
                                const { data: versionData } = await supabase
                                    .from('proc_def_version')
                                    .select('*')
                                    .eq('proc_def_id', procDefId)
                                    .eq('version', publishVersion)
                                    .eq('tenant_id', window.$tenantName)
                                    .limit(1)
                                    .maybeSingle();
                                if (versionData?.snapshot) {
                                    const procDefUpdate: any = { bpmn: versionData.snapshot };
                                    if (versionData.definition) procDefUpdate.definition = versionData.definition;
                                    await supabase
                                        .from('proc_def')
                                        .update(procDefUpdate)
                                        .eq('id', procDefId)
                                        .eq('tenant_id', window.$tenantName);

                                    // 이전 published 태그 해제 (동일 proc_def의 다른 버전들)
                                    await supabase
                                        .from('proc_def_version')
                                        .update({ version_tag: null })
                                        .eq('proc_def_id', procDefId)
                                        .eq('tenant_id', window.$tenantName)
                                        .eq('version_tag', 'published');

                                    // 현재 버전에 published 태그 설정
                                    await supabase
                                        .from('proc_def_version')
                                        .update({ version_tag: 'published' })
                                        .eq('arcv_id', versionData.arcv_id);
                                }
                            } else {
                                console.warn('[ProcessGPTBackend] publish: No version found for proc_def_id:', procDefId);
                            }
                            // 이전 published 건 아카이빙
                            await supabase
                                .from('proc_def_approval_state')
                                .update({ state: 'archived', updated_at: now })
                                .eq('proc_def_id', procDefId)
                                .eq('state', 'published')
                                .eq('tenant_id', window.$tenantName)
                                .neq('id', currentState.id);
                        } catch (publishErr) {
                            console.warn('[ProcessGPTBackend] Failed to update proc_def.bpmn on publish:', publishErr);
                        }
                        break;

                    // === Re-open 요청 ===
                    case 'request_reopen':
                        updateData.reopen_requested_by = userName;
                        updateData.reopen_requested_at = now;
                        updateData.reopen_reason = comment || null;
                        break;

                    case 'approve_reopen':
                        updateData.reopen_approved_by = userName;
                        updateData.reopen_approved_at = now;
                        break;

                    case 'reject_reopen':
                        // 현행 유지: published로 복원
                        updateData.reopen_reason = null;
                        updateData.reopen_requested_by = null;
                        updateData.reopen_requested_at = null;
                        break;

                    // === 기존 액션 하위호환 ===
                    case 'reject':
                        updateData.rejected_by_id = userId;
                        updateData.rejected_by_name = userName;
                        updateData.rejected_at = now;
                        updateData.reject_comment = comment || null;
                        break;
                    case 'reopen':
                        break;
                    case 'cancel':
                        updateData.reject_comment = comment || 'Cancelled due to new version save';
                        break;
                }

                const { data, error } = await supabase
                    .from('proc_def_approval_state')
                    .update(updateData)
                    .eq('id', currentState.id)
                    .select()
                    .single();

                if (error) throw error;
                currentState = data;
            }

            // 이력 기록 (review_id 연결)
            await supabase.from('proc_def_approval_history').insert({
                proc_def_id: procDefId,
                review_id: currentState.id,
                action: action,
                from_state: fromState,
                to_state: toState,
                actor_id: userId,
                actor_name: userName,
                comment: comment || null,
                tenant_id: window.$tenantName
            });

            // 공람 자동 진입 시 스냅샷 저장
            if (toState === 'public_feedback') {
                try {
                    const { data: procDef } = await supabase
                        .from('proc_def')
                        .select('bpmn')
                        .eq('id', procDefId)
                        .eq('tenant_id', window.$tenantName)
                        .maybeSingle();
                    if (procDef?.bpmn) {
                        await this.saveSnapshot(currentState.id, procDefId, 'public_feedback', procDef.bpmn);
                    }
                } catch (snapErr) {
                    console.warn('[ProcessGPTBackend] Failed to save public_feedback snapshot:', snapErr);
                }
            }

            return currentState;
        } catch (e) {
            console.error('[ProcessGPTBackend] _changeApprovalState error:', e);
            throw e;
        }
    }

    /**
     * 승인 이력 조회
     * @param procDefIdOrReviewId - proc_def_id 또는 review_id
     * @param byReviewId - true이면 review_id로 조회
     */
    async getApprovalHistory(procDefIdOrReviewId: string, byReviewId?: boolean): Promise<any[]> {
        const supabase = window.$supabase;
        if (!supabase) return [];

        try {
            let query = supabase.from('proc_def_approval_history').select('*').eq('tenant_id', window.$tenantName);

            if (byReviewId) {
                query = query.eq('review_id', procDefIdOrReviewId);
            } else {
                query = query.eq('proc_def_id', procDefIdOrReviewId);
            }

            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (e) {
            console.error('[ProcessGPTBackend] getApprovalHistory error:', e);
            return [];
        }
    }

    // =====================================================
    // Review Board & KPI API
    // =====================================================

    /**
     * 리뷰 보드 데이터 조회 (v_review_board 뷰) - 리뷰 건별 조회
     */
    async getReviewBoardData(): Promise<any[]> {
        const supabase = window.$supabase;
        if (!supabase) return [];
        const tenantId = window.$tenantName;

        try {
            // Try view first
            const { data, error } = await supabase
                .from('v_review_board')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('updated_at', { ascending: false });

            if (!error && data) return data;
        } catch (e) {
            console.warn('[ProcessGPTBackend] v_review_board not available, using fallback:', e);
        }

        // Fallback: direct query (리뷰 건별)
        try {
            const { data: states, error: stErr } = await supabase
                .from('proc_def_approval_state')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('updated_at', { ascending: false });
            if (stErr || !states) return [];

            const procDefIds = [...new Set(states.map((s: any) => s.proc_def_id))];
            if (!procDefIds.length) return [];

            const { data: defs } = await supabase
                .from('proc_def')
                .select('id, name, owner')
                .eq('tenant_id', tenantId)
                .eq('isdeleted', false)
                .in('id', procDefIds);
            const defMap: Record<string, any> = {};
            (defs || []).forEach((d: any) => {
                defMap[d.id] = d;
            });

            return states
                .filter((s: any) => defMap[s.proc_def_id])
                .map((s: any) => {
                    const def = defMap[s.proc_def_id];
                    return {
                        review_id: s.id,
                        proc_def_id: s.proc_def_id,
                        process_name: def.name,
                        owner: def.owner,
                        state: s.state,
                        version: s.version || null,
                        submitted_by: s.submitted_by,
                        submitted_at: s.submitted_at,
                        reviewer_level1_name: s.reviewer_level1_name,
                        reviewed_at_level1: s.reviewed_at_level1,
                        confirmed_by_name: s.confirmed_by_name,
                        confirmed_at: s.confirmed_at,
                        rejected_by_name: s.rejected_by_name,
                        rejected_at: s.rejected_at,
                        reject_comment: s.reject_comment,
                        comment_count: 0,
                        tenant_id: s.tenant_id,
                        updated_at: s.updated_at
                    };
                });
        } catch (e) {
            console.error('[ProcessGPTBackend] getReviewBoardData fallback error:', e);
            return [];
        }
    }

    /**
     * 2.3: Cross-version Governance Timeline
     * 특정 프로세스의 모든 리뷰 사이클과 이력을 시간순으로 조합
     */
    async getCrossVersionTimeline(procDefId: string): Promise<any[]> {
        const supabase = window.$supabase;
        if (!supabase) return [];
        const tenantId = window.$tenantName;

        try {
            // 1. 해당 proc_def_id의 모든 approval_state (리뷰 사이클) 조회
            const { data: cycles, error: cycleErr } = await supabase
                .from('proc_def_approval_state')
                .select('*')
                .eq('proc_def_id', procDefId)
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: true });

            if (cycleErr) throw cycleErr;

            // 2. 해당 proc_def_id의 모든 approval_history 조회
            const { data: actions, error: actErr } = await supabase
                .from('proc_def_approval_history')
                .select('*')
                .eq('proc_def_id', procDefId)
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: true });

            if (actErr) throw actErr;

            // 3. 두 데이터를 합산해서 시간순 정렬
            const timeline: any[] = [];

            // 리뷰 사이클 시작점 추가
            (cycles || []).forEach((c: any) => {
                timeline.push({
                    type: 'cycle_start',
                    cycle_id: c.id,
                    version: c.version || '',
                    state: c.state,
                    created_at: c.created_at
                });
            });

            // 개별 액션 추가
            (actions || []).forEach((a: any) => {
                timeline.push({
                    type: 'action',
                    cycle_id: a.review_id,
                    action: a.action,
                    actor_id: a.actor_id,
                    actor_name: a.actor_name,
                    comment: a.comment,
                    from_state: a.from_state,
                    to_state: a.to_state,
                    resolved: a.resolved,
                    resolve_action_text: a.resolve_action_text,
                    created_at: a.created_at
                });
            });

            // 최근 날짜순 정렬 (descending)
            timeline.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            return timeline;
        } catch (e) {
            console.error('[ProcessGPTBackend] getCrossVersionTimeline error:', e);
            return [];
        }
    }

    /**
     * KPI 파이프라인 요약 (v_kpi_pipeline_summary 뷰)
     */
    async getKpiPipelineSummary(): Promise<any> {
        const supabase = window.$supabase;
        if (!supabase) return null;

        try {
            const { data, error } = await supabase
                .from('v_kpi_pipeline_summary')
                .select('*')
                .eq('tenant_id', window.$tenantName)
                .maybeSingle();

            if (error) throw error;
            return data;
        } catch (e) {
            console.error('[ProcessGPTBackend] getKpiPipelineSummary error:', e);
            return null;
        }
    }

    /**
     * KPI 도메인별 진행 현황 (v_kpi_domain_progress 뷰)
     */
    async getKpiDomainProgress(): Promise<any[]> {
        const supabase = window.$supabase;
        if (!supabase) return [];

        try {
            const { data, error } = await supabase.from('v_kpi_domain_progress').select('*').eq('tenant_id', window.$tenantName);

            if (error) throw error;
            return data || [];
        } catch (e) {
            console.error('[ProcessGPTBackend] getKpiDomainProgress error:', e);
            return [];
        }
    }

    /**
     * KPI 주간 배포 속도 (v_weekly_deployment_velocity 뷰)
     */
    async getKpiWeeklyVelocity(weeks = 10): Promise<any[]> {
        const supabase = window.$supabase;
        if (!supabase) return [];

        try {
            const { data, error } = await supabase
                .from('v_weekly_deployment_velocity')
                .select('*')
                .eq('tenant_id', window.$tenantName)
                .order('week_start', { ascending: false })
                .limit(weeks);

            if (error) throw error;
            return (data || []).reverse();
        } catch (e) {
            console.error('[ProcessGPTBackend] getKpiWeeklyVelocity error:', e);
            return [];
        }
    }

    /**
     * KPI 목표 조회 (kpi_targets 테이블)
     */
    async getKpiTargets(): Promise<any[]> {
        const supabase = window.$supabase;
        if (!supabase) return [];

        try {
            const { data, error } = await supabase
                .from('kpi_targets')
                .select('*')
                .eq('tenant_id', window.$tenantName)
                .order('period_start', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (e) {
            console.error('[ProcessGPTBackend] getKpiTargets error:', e);
            return [];
        }
    }

    /**
     * KPI 목표 생성/수정 (kpi_targets 테이블 upsert)
     */
    async upsertKpiTarget(targetData: any): Promise<any> {
        const supabase = window.$supabase;
        if (!supabase) throw new Error('Supabase not initialized');

        try {
            const payload = {
                ...targetData,
                tenant_id: window.$tenantName,
                updated_at: new Date().toISOString()
            };
            const { data, error } = await supabase
                .from('kpi_targets')
                .upsert(payload, { onConflict: 'tenant_id,period_type,period_start' })
                .select()
                .maybeSingle();

            if (error) throw error;
            return data;
        } catch (e) {
            console.error('[ProcessGPTBackend] upsertKpiTarget error:', e);
            throw e;
        }
    }

    /**
     * 최신 버전 번호 조회
     */
    async getLatestVersionNumber(procDefId: string): Promise<string> {
        const supabase = window.$supabase;
        if (!supabase) return '1.0';

        try {
            const { data, error } = await supabase
                .from('proc_def_version')
                .select('version')
                .eq('proc_def_id', procDefId)
                .eq('tenant_id', window.$tenantName)
                .order('version', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) throw error;
            return data?.version || '1.0';
        } catch (e) {
            console.error('[ProcessGPTBackend] getLatestVersionNumber error:', e);
            return '1.0';
        }
    }

    // ---------------------------------------------------------------
    // BPMN 인앱 단위 테스트 — 백엔드 test_mode.py 라우트 호출.
    // 경로: 게이트웨이 /completion/** → completion-service(/test/*)
    // ---------------------------------------------------------------
    async testInitiate(payload: {
        process_definition_id: string;
        target_activity_id?: string;
        given?: Record<string, any>;
        version_tag?: string;
        version?: number | string;
        email?: string;
    }) {
        const input: any = { ...payload };
        if (!input.email) input.email = localStorage.getItem('email') || undefined;
        input.tenant_id = window.$tenantName;
        const response = await axios.post(
            '/completion/test/initiate',
            { input },
            {
                headers: { 'Content-Type': 'application/json' }
            }
        );
        return response?.data || null;
    }

    async testComplete(payload: { task_id: string; form_values?: Record<string, any>; timeout_ms?: number }) {
        const input: any = { ...payload };
        input.tenant_id = window.$tenantName;
        const response = await axios.post(
            '/completion/test/complete',
            { input },
            {
                headers: { 'Content-Type': 'application/json' }
            }
        );
        return response?.data || null;
    }

    async testCleanup(procInstId: string) {
        if (!procInstId) return null;
        const response = await axios.post(
            `/completion/test/cleanup/${encodeURIComponent(procInstId)}`,
            {},
            {
                headers: { 'Content-Type': 'application/json' }
            }
        );
        return response?.data || null;
    }

    async getDelegationHistory(taskId: string) {
        if (!taskId) return [];
        const { data, error } = await window.$supabase
            .from('delegation_history')
            .select('*')
            .eq('task_id', taskId)
            .order('created_at', { ascending: false });
        if (error) throw new Error(error.message);
        return data || [];
    }

    async addDelegationHistory(record: {
        task_id: string;
        from_user_id: string;
        from_username: string;
        to_user_id: string;
        to_username: string;
        reason?: string;
        status?: string;
    }) {
        const { data, error } = await window.$supabase.from('delegation_history').insert(record).select().single();
        if (error) throw new Error(error.message);
        return data;
    }
}

export default ProcessGPTBackend;
