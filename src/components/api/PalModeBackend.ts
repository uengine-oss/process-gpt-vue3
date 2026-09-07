import StorageBaseFactory from '@/utils/StorageBaseFactory';
const storage = StorageBaseFactory.getStorage();

import ProcessGPTBackend, { listProcDefWithFallback } from './ProcessGPTBackend';
import axios from 'axios';
import { streamSse } from '@/services/sseClient';
const axiosInstance = axios.create();

class PalModeBackend extends ProcessGPTBackend {
    async getProdVersion(procDefId: string): Promise<string | null> {
        try {
            if (!procDefId) return null;
            const defId = String(procDefId).toLowerCase();
            // StorageBaseSupabase.getString은 match/key 기반으로 컬럼을 조회할 수 있음
            const value = await storage.getString('proc_def', {
                match: {
                    id: defId,
                    tenant_id: window.$tenantName
                },
                column: 'prod_version'
            });
            return value || null;
        } catch (e) {
            return null;
        }
    }

    async dryRun(isSimulate: string, command: object) {
        // command를 object json으로 변경
        const config = {
            headers: {
                isSimulate: isSimulate ? isSimulate : 'false'
            }
        };

        //@ts-ignore
        command.authToken = localStorage.getItem('sb-127-auth-token')
            ? JSON.parse(localStorage.getItem('sb-127-auth-token')).access_token
            : null;
        const response = await axiosInstance.post(`/dry-run`, command, config);
        // const response = await axiosInstance.get(encodeURI(`/dry-run/${defPath}`));
        // const response = await axiosInstance.get(encodeURI(`/dry-run/${encodeURIComponent(defPath.toString())}`));

        if (!response.data) return null;
        return response.data;
    }

    async startAndComplete(command: object, isSimulate: string) {
        const config = {
            headers: {
                isSimulate: isSimulate ? isSimulate : 'false'
            }
        };
        const response = await axiosInstance.post(`/start-and-complete`, command, config);

        return response.data;
    }

    async listDefinition(path: string, options?: any) {
        try {
            // 목록에는 definition(JSONB)·bpmn(XML 원문)이 필요 없다. select * 는 행당 평균 34KB 로
            // 한 번에 수 MB 를 당겨 PostgREST 커넥션 풀을 점유하고 statement timeout(8s)을 유발한다 —
            // 이 풀 고갈이 users 단건 조회까지 실패시켜 자동 로그아웃 루프의 부하 원인이었다.
            // 컬럼 선택과 배포별로 없는 컬럼(42703) 처리는 listProcDefWithFallback 이 담당한다.
            const procDefs = await listProcDefWithFallback({
                ...(options || {}),
                ...(path ? { like: `${path}%` } : {})
            });
            procDefs.map((item: any) => {
                item.path = `${item.id}`;
                item.name = item.name || item.path;
                item.isDeleted = item.isDeleted || false;
            });
            return procDefs;
        } catch (e) {
            //@ts-ignore
            throw new Error(e.message);
        }
    }
    async deleteDefinition(defId: string, options: any): Promise<boolean | undefined> {
        try {
            const uuid = await storage.getString(`proc_def/${defId}`, { key: 'id', column: 'uuid' });
            await storage.putString(`proc_def`, [{ uuid: uuid, id: defId, isDeleted: true }], { onConflict: 'uuid' });
            return true;
        } catch (e) {
            //@ts-ignore
            throw new Error(e.message);
        }
    }

    async restoreDefinition(defId: string, options: any): Promise<boolean | undefined> {
        try {
            const uuid = await storage.getString(`proc_def/${defId}`, { key: 'id', column: 'uuid' });
            await storage.putString(`proc_def`, [{ uuid: uuid, id: defId, isDeleted: false }], { onConflict: 'uuid' });
            return true;
        } catch (e) {
            //@ts-ignore
            throw new Error(e.message);
        }
    }

    async getRawDefinition(defId: string, options: any) {
        try {
            if (defId) {
                defId = defId.toLowerCase();
            } else {
                return;
            }

            if (options) {
                // 폼 정보를 불러오기 위해서
                if (options.type === 'form') {
                    if (defId.includes('/')) defId = defId.replace(/\//g, '#');
                    const data = await storage.getString(`form_def/${defId}`, { key: 'id', column: 'html' });
                    if (!data) {
                        return null;
                    }
                    return data;
                } else if (options.type === 'bpmn') {
                    if (defId.includes('/')) defId = defId.replace(/\//g, '_');
                    const data = await storage.getString(`proc_def/${defId}`, { key: 'id', column: 'bpmn' });
                    if (!data) {
                        return null;
                    }
                    return data;
                } else if (options.type === 'deleted') {
                    const data = await storage.getString(`proc_def/${defId}`, { key: 'id', column: 'isDeleted' });
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

    async saveTask(id: string, name: string, type: string, json: any) {
        try {
            // Prepare data object for storing in the process_tasks table
            const taskData = {
                name: name,
                type: type,
                json_ko: typeof json === 'string' ? json : JSON.stringify(json),
                ...(id ? { id: id } : {}) // Use provided UUID if available
            };

            // Use the StorageBase to store data in Supabase
            const result = await storage.putObject('process_tasks', taskData, {
                onConflict: id ? 'id' : 'id' // Use UUID for conflict resolution if provided, otherwise use task_id
            });

            // 저장 후 데이터를 다시 조회하여 생성된 UUID를 포함한 최신 데이터 반환
            if (result && result.statusText === 'Created') {
                // 새로 생성된 경우 id를 가져옴
                const savedTask = await storage.getObject('process_tasks', {
                    match: {
                        name: taskData.name
                    }
                });
                return savedTask;
            } else {
                // 기존 데이터 업데이트인 경우
                const savedTask = await storage.getObject('process_tasks', {
                    match: {
                        id: taskData.id
                    }
                });
                return savedTask;
            }
        } catch (e) {
            //@ts-ignore
            throw new Error(e.message);
        }
    }

    async getTaskList() {
        try {
            // Retrieve all tasks from the process_tasks table
            const tasks = await storage.list('process_tasks', {
                orderBy: 'created_at',
                sort: 'desc'
            });

            // Process the returned data to parse JSON strings if needed
            if (tasks && tasks.length > 0) {
                return tasks.map((task) => {
                    // Parse JSON data if it's stored as a string
                    if (task.json_ko && typeof task.json_ko === 'string') {
                        try {
                            task.json_ko = JSON.parse(task.json_ko);
                        } catch (e) {
                            // If parsing fails, keep the original string
                            console.warn(`Failed to parse JSON data for task ${task.name}`);
                        }
                    }
                    return task;
                });
            }

            return [];
        } catch (e) {
            //@ts-ignore
            throw new Error(e.message);
        }
    }

    async getTask(options: any) {
        try {
            // options이 객체인지 확인
            if (!options || typeof options !== 'object') {
                throw new Error('Invalid options parameter');
            }

            // id 필드가 있는지 확인
            if (!options.id) {
                throw new Error('Task ID is required');
            }

            // id로 명확하게 하나의 레코드만 조회
            const task = await storage.getObject('process_tasks', {
                match: options
            });

            // JSON 문자열 파싱
            if (task && task.json_ko && typeof task.json_ko === 'string') {
                try {
                    task.json_ko = JSON.parse(task.json_ko);
                } catch (e) {
                    console.warn(`Failed to parse JSON data for task ${task.name}`);
                }
            }

            return task;
        } catch (e) {
            //@ts-ignore
            throw new Error(e.message);
        }
    }

    private get supabase() {
        const client = window.$supabase;
        if (!client) throw new Error('Supabase not initialized');
        return client;
    }

    async insertAdminAuditLog(entry: {
        action: string;
        target_type: string;
        target_id?: string;
        target_name?: string;
        before_value?: any;
        after_value?: any;
        comment?: string;
    }): Promise<void> {
        try {
            const actorId =
                localStorage.getItem('employeeNo') ||
                localStorage.getItem('email') ||
                localStorage.getItem('uid') ||
                (window as any).$user?.email ||
                (window as any).$user?.id ||
                'system';
            const { error } = await this.supabase.from('admin_audit_log').insert({
                tenant_id: window.$tenantName,
                actor_id: actorId,
                action: entry.action,
                target_type: entry.target_type,
                target_id: entry.target_id || null,
                target_name: entry.target_name || null,
                before_value: entry.before_value ? JSON.stringify(entry.before_value) : null,
                after_value: entry.after_value ? JSON.stringify(entry.after_value) : null,
                comment: entry.comment || null,
                created_at: new Date().toISOString()
            });
            if (error) throw error;
        } catch (error) {
            console.error('[PalModeBackend] insertAdminAuditLog error:', error);
        }
    }

    async getDeletedProcesses(): Promise<any[]> {
        const tenantId = window.$tenantName;
        const results: any[] = [];
        const modelResult = await this.supabase
            .from('tb_bpmn_model')
            .select('id, proc_def_id, name, deleted_at, deleted_by, created_by')
            .eq('tenant_id', tenantId)
            .not('deleted_at', 'is', null)
            .order('deleted_at', { ascending: false });
        if (!modelResult.error) {
            results.push(
                ...(modelResult.data || []).map((item: any) => ({
                    ...item,
                    id: item.proc_def_id || item.id,
                    model_id: item.id,
                    _source: 'tb_bpmn_model'
                }))
            );
        }

        const procResult = await this.supabase
            .from('proc_def')
            .select('id, name, deleted_at, deleted_by, deleted_from, owner')
            .eq('tenant_id', tenantId)
            .not('deleted_at', 'is', null)
            .order('deleted_at', { ascending: false });
        if (!procResult.error) {
            const existingIds = new Set(results.map((item: any) => item.id));
            results.push(...(procResult.data || []).filter((item: any) => !existingIds.has(item.id)));
        }

        return results.map((item: any) => ({
            ...item,
            deleted_by: item.deleted_by || item.created_by || item.owner || 'Unknown',
            deleted_from: item.deleted_from || null,
            remaining_days: Math.max(0, 30 - Math.floor((Date.now() - new Date(item.deleted_at).getTime()) / 86400000))
        }));
    }

    async restoreProcess(procDefId: string): Promise<void> {
        const tenantId = window.$tenantName;
        const { data: procDef, error: lookupError } = await this.supabase
            .from('proc_def')
            .select('id, name, deleted_from')
            .eq('id', procDefId)
            .eq('tenant_id', tenantId)
            .maybeSingle();
        if (lookupError) throw lookupError;

        const [modelResult, procResult] = await Promise.all([
            this.supabase.from('tb_bpmn_model').update({ deleted_at: null, deleted_by: null }).eq('proc_def_id', procDefId).eq('tenant_id', tenantId),
            this.supabase
                .from('proc_def')
                .update({ deleted_at: null, deleted_by: null, deleted_from: null })
                .eq('id', procDefId)
                .eq('tenant_id', tenantId)
        ]);
        if (modelResult.error) throw modelResult.error;
        if (procResult.error) throw procResult.error;

        const deletedFrom = procDef?.deleted_from;
        if (!deletedFrom?.mega_id || !deletedFrom?.major_id) return;
        const procMap = await this.getProcessDefinitionMap();
        const mega = procMap?.mega_proc_list?.find((item: any) => item.id === deletedFrom.mega_id);
        const major = mega?.major_proc_list?.find((item: any) => item.id === deletedFrom.major_id);
        if (!major) return;
        major.sub_proc_list = major.sub_proc_list || [];
        if (!major.sub_proc_list.some((item: any) => item.id === procDefId)) {
            major.sub_proc_list.push({ id: procDefId, name: deletedFrom.process_name || procDef?.name || procDefId });
            await this.putProcessDefinitionMap(procMap);
        }
    }

    async hardDeleteProcess(procDefId: string): Promise<void> {
        const tenantId = window.$tenantName;
        const related = [
            this.supabase.from('form_def').delete().eq('proc_def_id', procDefId).eq('tenant_id', tenantId),
            this.supabase.from('proc_def_version').delete().eq('proc_def_id', procDefId).eq('tenant_id', tenantId),
            this.supabase.from('lock').delete().eq('id', procDefId).eq('tenant_id', tenantId),
            this.supabase.from('todolist').delete().eq('proc_def_id', procDefId).eq('tenant_id', tenantId),
            this.supabase.from('bpm_proc_inst').delete().eq('proc_def_id', procDefId).eq('tenant_id', tenantId)
        ];
        const settled = await Promise.allSettled(related);
        for (const result of settled) {
            if (result.status === 'rejected') throw result.reason;
            if (result.value?.error) throw result.value.error;
        }
        const [modelResult, procResult] = await Promise.all([
            this.supabase.from('tb_bpmn_model').delete().eq('proc_def_id', procDefId).eq('tenant_id', tenantId),
            this.supabase.from('proc_def').delete().eq('id', procDefId).eq('tenant_id', tenantId)
        ]);
        if (modelResult.error) throw modelResult.error;
        if (procResult.error) throw procResult.error;
    }

    async hardDeleteInstance(instId: string): Promise<void> {
        await storage.delete('bpm_proc_inst', { match: { proc_inst_id: instId, tenant_id: window.$tenantName } });
    }

    private isPropertyValueInUse(value: any): boolean {
        if (value === null || value === undefined) return false;
        if (typeof value === 'string') return value.trim().length > 0;
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === 'object') return Object.keys(value).length > 0;
        return true;
    }

    async getPropertyUsageProcesses(propertyKey: string): Promise<Array<{ id: string; name: string; usedAt: 'process' | 'task' | 'both' }>> {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(propertyKey || '')) return [];
        const { data, error } = await this.supabase
            .from('proc_def')
            .select('id, name, definition')
            .eq('tenant_id', window.$tenantName)
            .is('deleted_at', null);
        if (error) throw error;
        return (data || []).flatMap((row: any) => {
            const definition = row?.definition;
            if (!definition || typeof definition !== 'object') return [];
            const processUsed = this.isPropertyValueInUse(definition[propertyKey]);
            const taskUsed = (Array.isArray(definition.elements) ? definition.elements : []).some((element: any) =>
                this.isPropertyValueInUse((element?.properties || element || {})[propertyKey])
            );
            if (!processUsed && !taskUsed) return [];
            return [{ id: row.id, name: row.name || row.id, usedAt: processUsed && taskUsed ? 'both' : taskUsed ? 'task' : 'process' }];
        });
    }

    async getPropertyUsageCount(propertyKey: string): Promise<number> {
        return (await this.getPropertyUsageProcesses(propertyKey)).length;
    }

    async softDeletePropertySchema(id: string): Promise<void> {
        const { error } = await this.supabase
            .from('task_property_schema')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id)
            .eq('tenant_id', window.$tenantName);
        if (error) throw error;
    }

    async getDeletedPropertySchemas(): Promise<any[]> {
        const { data, error } = await this.supabase
            .from('task_property_schema')
            .select('id, property_key, property_label, property_type, applies_to, is_active, deleted_at, deleted_by, display_order')
            .eq('tenant_id', window.$tenantName)
            .not('deleted_at', 'is', null)
            .order('deleted_at', { ascending: false });
        if (error) throw error;
        return data || [];
    }

    async restorePropertySchema(id: string): Promise<void> {
        const { error } = await this.supabase
            .from('task_property_schema')
            .update({ deleted_at: null, deleted_by: null, is_active: true })
            .eq('id', id)
            .eq('tenant_id', window.$tenantName);
        if (error) throw error;
    }

    async deactivatePropertySchema(id: string): Promise<void> {
        const { error } = await this.supabase
            .from('task_property_schema')
            .update({ is_active: false })
            .eq('id', id)
            .eq('tenant_id', window.$tenantName);
        if (error) throw error;
    }

    async activatePropertySchema(id: string): Promise<void> {
        const { error } = await this.supabase
            .from('task_property_schema')
            .update({ is_active: true })
            .eq('id', id)
            .eq('tenant_id', window.$tenantName);
        if (error) throw error;
    }

    async backfillProcessDefinitionNullForProperty(propertyKey: string, appliesTo?: string): Promise<number> {
        if (!propertyKey || (appliesTo !== 'process' && appliesTo !== 'both')) return 0;
        const { data, error } = await this.supabase.rpc('backfill_proc_def_property', {
            p_key: propertyKey,
            p_tenant: window.$tenantName
        });
        if (error) throw error;
        return typeof data === 'number' ? data : 0;
    }

    async listDefinitionStatusLite(path: string = '') {
        let query = this.supabase
            .from('proc_def')
            .select('id,name,description,definition,prod_version,owner,type,tenant_id,saved_at,deleted_at')
            .eq('tenant_id', window.$tenantName)
            .is('deleted_at', null)
            .order('id', { ascending: true });
        if (path) query = query.ilike('id', `${path}%`);
        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map((item: any) => ({
            ...item,
            version: item.prod_version || null,
            path: `${item.id}.bpmn`,
            name: item.name || item.id
        }));
    }

    async getDefinitionDetailLite(defId: string) {
        if (!defId) return null;
        const { data, error } = await this.supabase
            .from('proc_def')
            .select('id,name,description,bpmn,definition,tobe,executable,prod_version,owner,type,tenant_id')
            .eq('tenant_id', window.$tenantName)
            .eq('id', defId)
            .is('deleted_at', null)
            .maybeSingle();
        if (error) throw error;
        if (!data) return null;
        const definition = data.definition && typeof data.definition === 'object' ? { ...data.definition } : {};
        if (data.tobe != null) definition.tobe = data.tobe;
        if (data.executable != null) definition.executable = data.executable;
        return { ...data, definition, version: data.prod_version || null, path: `${data.id}.bpmn`, name: data.name || data.id };
    }

    async updateProcessDefinitionMetadata(defId: string, updatePayload: any, actionLabel: string = '저장') {
        if (!defId) throw new Error('Process definition id is required');
        const { data, error } = await this.supabase
            .from('proc_def')
            .update(updatePayload)
            .eq('id', defId)
            .eq('tenant_id', window.$tenantName)
            .select('id');
        if (error) throw error;
        if (!data?.length) throw new Error(`${actionLabel} 실패: 프로세스(${defId})에 변경이 적용되지 않았습니다.`);
    }

    async findProcessesReferencing(targetDefId: string, excludeDefId?: string): Promise<Array<{ id: string; name: string }>> {
        const target = String(targetDefId || '').trim();
        if (!target) return [];
        const { data, error } = await this.supabase
            .from('proc_def')
            .select('id,name,bpmn')
            .eq('tenant_id', window.$tenantName)
            .neq('id', target)
            .ilike('bpmn', `%${target}%`);
        if (error) throw error;
        const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const calledElement = new RegExp(`calledElement\\s*=\\s*"${escaped}(?:\\.bpmn)?"`);
        const definitionId = new RegExp(`(?:"|&#34;|&#x22;|&quot;)definitionId(?:"|&#34;|&#x22;|&quot;)\\s*:\\s*(?:"|&#34;|&#x22;|&quot;)${escaped}(?:\\.bpmn)?(?:"|&#34;|&#x22;|&quot;)`);
        return (data || [])
            .filter((row: any) => row.id !== excludeDefId && (calledElement.test(String(row.bpmn || '')) || definitionId.test(String(row.bpmn || ''))))
            .map((row: any) => ({ id: String(row.id), name: String(row.name || row.id) }));
    }

    private processHierarchyContext(procDefId: string, procMap: any, metricsMap: any) {
        for (const mega of procMap?.mega_proc_list || []) {
            for (const major of mega.major_proc_list || []) {
                const sub = (major.sub_proc_list || []).find((item: any) => String(item.id) === procDefId);
                if (!sub) continue;
                const rawDomain = major.domain_id || major.domain || major.business_domain || major.businessDomain || '';
                const domain = (metricsMap?.domains || []).find((item: any) => item.id === rawDomain || item.name === rawDomain);
                return {
                    procDefId,
                    domainId: domain?.id || rawDomain || null,
                    megaId: mega.id || null,
                    majorId: major.id || null
                };
            }
        }
        return null;
    }

    async getProcessDefinitionHierarchy(procDefId: string) {
        const { data, error } = await this.supabase
            .from('proc_def')
            .select('id,domain_id,mega_process_id,major_process_id')
            .eq('tenant_id', window.$tenantName)
            .eq('id', procDefId)
            .maybeSingle();
        if (error) throw error;
        return data || null;
    }

    async syncProcessDefinitionHierarchy(procDefId: string, hierarchy: any): Promise<void> {
        const { error } = await this.supabase
            .from('proc_def')
            .update({
                domain_id: hierarchy?.domainId ?? hierarchy?.domain_id ?? null,
                mega_process_id: hierarchy?.megaId ?? hierarchy?.mega_process_id ?? null,
                major_process_id: hierarchy?.majorId ?? hierarchy?.major_process_id ?? null
            })
            .eq('tenant_id', window.$tenantName)
            .eq('id', procDefId);
        if (error) throw error;
    }

    async syncProcessDefinitionHierarchyFromMap(procDefId: string, procMap?: any, metricsMap?: any): Promise<void> {
        const [map, metrics] = await Promise.all([
            procMap?.mega_proc_list ? procMap : this.getProcessDefinitionMap(),
            metricsMap?.domains ? metricsMap : this.getMetricsMap()
        ]);
        const context = this.processHierarchyContext(procDefId, map, metrics);
        if (context) await this.syncProcessDefinitionHierarchy(procDefId, context);
    }

    async syncAllProcessDefinitionHierarchyFromMap(procMap?: any, metricsMap?: any): Promise<void> {
        const [map, metrics] = await Promise.all([
            procMap?.mega_proc_list ? procMap : this.getProcessDefinitionMap(),
            metricsMap?.domains ? metricsMap : this.getMetricsMap()
        ]);
        const updates: Promise<void>[] = [];
        for (const mega of map?.mega_proc_list || []) {
            for (const major of mega.major_proc_list || []) {
                for (const sub of major.sub_proc_list || []) {
                    const context = this.processHierarchyContext(String(sub.id), map, metrics);
                    if (context) updates.push(this.syncProcessDefinitionHierarchy(String(sub.id), context));
                }
            }
        }
        await Promise.all(updates);
    }

    async updateLockHeartbeat(id: string) {
        const lock = await this.getLock(id);
        if (!lock) return;
        await storage.putObject('lock', { ...lock, heartbeat_at: new Date().toISOString() });
    }

    async acquireLockWithStaleCheck(lockObj: any, thresholdMinutes: number = 60) {
        const currentUserId = String(lockObj?.user_id || localStorage.getItem('email') || localStorage.getItem('uid') || '').trim();
        if (!currentUserId) return { acquired: false, lockedBy: null, lockedByName: null };
        const lock = await this.getLock(lockObj.id);
        if (lock && String(lock.user_id || '') !== currentUserId) {
            const heartbeat = new Date(lock.heartbeat_at || lock.started_time || 0).getTime();
            const stale = !heartbeat || Date.now() - heartbeat > thresholdMinutes * 60 * 1000;
            if (!stale) {
                return { acquired: false, lockedBy: lock.user_id, lockedByName: lock.user_name || lock.user_id };
            }
            await this.deleteLock(lockObj.id);
        }
        await this.setLock({
            ...lockObj,
            user_id: currentUserId,
            user_name: lockObj.user_name || localStorage.getItem('userName') || currentUserId,
            heartbeat_at: new Date().toISOString()
        });
        return { acquired: true, lockedBy: null, lockedByName: null };
    }

    async getDataFreezeList(): Promise<any[]> {
        const { data, error } = await this.supabase
            .from('configuration')
            .select('value')
            .eq('tenant_id', window.$tenantName)
            .eq('key', 'data_freeze')
            .maybeSingle();
        if (error) throw error;
        if (!data?.value) return [];
        return typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
    }

    async setDataFreeze(item: any) {
        const current = await this.getDataFreezeList();
        const created = {
            ...item,
            id: item.id || `freeze_${Date.now()}`,
            locked_by: (window as any).$userName || localStorage.getItem('email') || 'admin',
            locked_at: new Date().toISOString()
        };
        const { error } = await this.supabase.from('configuration').upsert(
            { tenant_id: window.$tenantName, key: 'data_freeze', value: [...current, created] },
            { onConflict: 'tenant_id,key' }
        );
        if (error) throw error;
        return created;
    }

    async removeDataFreeze(targetId: string): Promise<void> {
        const current = await this.getDataFreezeList();
        const { error } = await this.supabase.from('configuration').upsert(
            {
                tenant_id: window.$tenantName,
                key: 'data_freeze',
                value: current.filter((item: any) => item.id !== targetId && item.target_id !== targetId)
            },
            { onConflict: 'tenant_id,key' }
        );
        if (error) throw error;
    }

    async getLastPageVisit(userEmail: string, page: string): Promise<string | null> {
        const row = await storage.getObject('user_page_visits', {
            match: { user_email: userEmail, page, tenant_id: window.$tenantName }
        });
        return row?.last_visit_at || null;
    }

    async updateLastPageVisit(userEmail: string, page: string): Promise<void> {
        const row = await storage.getObject('user_page_visits', {
            match: { user_email: userEmail, page, tenant_id: window.$tenantName }
        });
        await storage.putObject(
            'user_page_visits',
            row
                ? { ...row, last_visit_at: new Date().toISOString() }
                : { user_email: userEmail, page, tenant_id: window.$tenantName, last_visit_at: new Date().toISOString() }
        );
    }

    async searchUsersByName(keyword: string, page: number = 0, limit: number = 20) {
        try {
            const response = await axiosInstance.get('/pi-system-backend/organization/users/search', {
                params: { keyword, page, limit }
            });
            return response.data;
        } catch {
            let query = this.supabase
                .from('users')
                .select('id,username,email,employee_no,org_name,org_code', { count: 'exact' })
                .eq('tenant_id', window.$tenantName)
                .range(page * limit, page * limit + limit - 1);
            const search = String(keyword || '').trim();
            if (search) query = query.or(`username.ilike.%${search}%,email.ilike.%${search}%,employee_no.ilike.%${search}%`);
            const { data, error, count } = await query;
            if (error) throw error;
            return {
                users: (data || []).map((user: any) => ({ ...user, user_id: user.id, name: user.username })),
                page: { index: page, limit, total_count: count || 0 }
            };
        }
    }

    async searchGroupsByName(keyword: string, page: number = 0, limit: number = 20) {
        try {
            const response = await axiosInstance.get('/pi-system-backend/organization/groups/search', {
                params: { keyword, page, limit }
            });
            return response.data;
        } catch {
            return { groups: [], page: { index: page, limit, total_count: 0 } };
        }
    }

    async getGroupById(id: string) {
        try {
            const response = await axiosInstance.get(`/pi-system-backend/organization/groups/${id}`);
            return response.data;
        } catch {
            return null;
        }
    }

    async searchSuppliers(keyword: string, page: number = 0, limit: number = 20) {
        try {
            const response = await axiosInstance.get('/pi-system-backend/suppliers/search', { params: { keyword, page, limit } });
            return response.data;
        } catch {
            let query = this.supabase
                .from('suppliers')
                .select('*', { count: 'exact' })
                .eq('tenant_id', window.$tenantName)
                .is('deleted_at', null)
                .range(page * limit, page * limit + limit - 1);
            if (keyword) query = query.ilike('name', `%${keyword}%`);
            const { data, error, count } = await query;
            if (error) throw error;
            return { suppliers: data || [], page: { index: page, limit, total_count: count || 0 } };
        }
    }

    async resolveUserIdentities(ids: Array<string | null | undefined>): Promise<Record<string, any | null>> {
        const normalized = [...new Set(ids.map((id) => String(id || '').trim()).filter(Boolean))];
        const result: Record<string, any | null> = Object.fromEntries(normalized.map((id) => [id, null]));
        if (!normalized.length) return result;
        const { data, error } = await this.supabase
            .from('users')
            .select('id,username,email,employee_no,org_name,org_code')
            .eq('tenant_id', window.$tenantName)
            .limit(5000);
        if (error) throw error;
        for (const user of data || []) {
            const identity = {
                id: user.id,
                name: user.username || user.email || user.employee_no,
                username: user.username,
                email: user.email,
                employee_no: user.employee_no,
                org_name: user.org_name,
                org_code: user.org_code
            };
            for (const key of [user.id, user.email, user.employee_no].filter(Boolean)) {
                const original = normalized.find((id) => id.toLowerCase() === String(key).toLowerCase());
                if (original) result[original] = identity;
            }
        }
        return result;
    }

    async getLatestVersionMap(): Promise<any[]> {
        const { data, error } = await this.supabase
            .from('proc_def_version')
            .select('proc_def_id,version')
            .order('timeStamp', { ascending: false });
        if (error) throw error;
        return data || [];
    }

    async getLatestVersionMapByProcIds(procDefIds: string[]): Promise<any[]> {
        if (!procDefIds?.length) return [];
        const { data, error } = await this.supabase
            .from('proc_def_version')
            .select('proc_def_id,version')
            .in('proc_def_id', procDefIds)
            .order('timeStamp', { ascending: false });
        if (error) throw error;
        return data || [];
    }

    async getApprovalStateList(): Promise<any[]> {
        const { data, error } = await this.supabase
            .from('proc_def_approval_state')
            .select('proc_def_id,state,created_at,updated_at')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    }

    async getApprovalStateListByProcIds(procDefIds: string[]): Promise<any[]> {
        if (!procDefIds?.length) return [];
        const { data, error } = await this.supabase
            .from('proc_def_approval_state')
            .select('proc_def_id,state,created_at,updated_at')
            .in('proc_def_id', procDefIds)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    }

    async getAdminAuditLogs(filters: any = {}): Promise<{ data: any[]; total: number }> {
        const page = filters.page || 1;
        const pageSize = filters.pageSize || 50;
        let query = this.supabase
            .from('admin_audit_log')
            .select('*', { count: 'exact' })
            .eq('tenant_id', window.$tenantName)
            .order('created_at', { ascending: false });
        if (pageSize > 0) query = query.range((page - 1) * pageSize, page * pageSize - 1);
        if (filters.action) query = query.eq('action', filters.action);
        if (filters.targetType) query = query.eq('target_type', filters.targetType);
        if (filters.targetId) query = query.eq('target_id', filters.targetId);
        if (filters.startDate) query = query.gte('created_at', filters.startDate);
        if (filters.endDate) query = query.lte('created_at', `${filters.endDate}T23:59:59`);
        const { data, error, count } = await query;
        if (error) throw error;
        return { data: data || [], total: count || 0 };
    }

    async qdrantChat(payload: any, opts: { onDelta?: (text: string) => void; signal?: AbortSignal } = {}) {
        let accumulated = '';
        const done = await streamSse(
            '/pi-system-backend/langchain-chat/qdrant-chat/stream',
            JSON.stringify({ message: payload.message, xml: payload.xml || undefined, sessionId: payload.sessionId || undefined }),
            {
                headers: { 'Content-Type': 'application/json' },
                signal: opts.signal,
                onDelta: (text: string) => {
                    accumulated += text;
                    opts.onDelta?.(accumulated);
                }
            }
        );
        return { answer: done && typeof done.answer === 'string' ? done.answer : accumulated };
    }

    async saveCopilotLog(payload: { procDefId: string; question: string; answer: string }) {
        const createdBy = (window as any).$user?.id || localStorage.getItem('uid') || localStorage.getItem('email');
        if (!createdBy) throw new Error('현재 사용자 식별자를 찾을 수 없습니다.');
        const { data, error } = await this.supabase
            .from('proc_def_copilot_log')
            .insert({
                proc_def_id: payload.procDefId,
                question: payload.question,
                answer: payload.answer,
                created_by: createdBy,
                tenant_id: window.$tenantName
            })
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    async deleteCopilotLog(logId: string) {
        const createdBy = (window as any).$user?.id || localStorage.getItem('uid') || localStorage.getItem('email');
        const { error } = await this.supabase
            .from('proc_def_copilot_log')
            .delete()
            .eq('id', logId)
            .eq('created_by', createdBy)
            .eq('tenant_id', window.$tenantName);
        if (error) throw error;
        return true;
    }

    async listCopilotLogs(procDefId: string): Promise<any[]> {
        const createdBy = (window as any).$user?.id || localStorage.getItem('uid') || localStorage.getItem('email');
        if (!createdBy) return [];
        const { data, error } = await this.supabase
            .from('proc_def_copilot_log')
            .select('id,proc_def_id,question,answer,created_at,created_by')
            .eq('proc_def_id', procDefId)
            .eq('created_by', createdBy)
            .eq('tenant_id', window.$tenantName)
            .order('created_at', { ascending: true });
        if (error) throw error;
        return data || [];
    }

    private async getConfigurationValue<T>(key: string, fallback: T): Promise<T> {
        const { data, error } = await this.supabase
            .from('configuration')
            .select('value')
            .eq('tenant_id', window.$tenantName)
            .eq('key', key)
            .maybeSingle();
        if (error) throw error;
        if (data?.value == null) return fallback;
        return (typeof data.value === 'string' ? JSON.parse(data.value) : data.value) as T;
    }

    private async setConfigurationValue<T>(key: string, value: T): Promise<T> {
        const { error } = await this.supabase.from('configuration').upsert(
            { tenant_id: window.$tenantName, key, value },
            { onConflict: 'tenant_id,key' }
        );
        if (error) throw error;
        return value;
    }

    async getNoticeBanner() {
        return this.getConfigurationValue('notice_banner', { enabled: false, text: '', color: 'info', start_date: '', end_date: '' });
    }

    async saveNoticeBanner(config: any) {
        return this.setConfigurationValue('notice_banner', config);
    }

    async getMaintenanceMode() {
        return this.getConfigurationValue('maintenance_mode', { enabled: false, message: '', activated_by: '', activated_at: '' });
    }

    async setMaintenanceMode(config: any) {
        return this.setConfigurationValue('maintenance_mode', config);
    }

    async getRestructureCutoverJobs(): Promise<any[]> {
        return this.getConfigurationValue('restructure_cutover_jobs', []);
    }

    async saveRestructureCutoverJobs(jobs: any[]): Promise<any[]> {
        return this.setConfigurationValue('restructure_cutover_jobs', jobs);
    }

    private async saveKpiTargets(items: any[]): Promise<void> {
        await this.setConfigurationValue('kpi_targets', items);
    }

    async deleteKpiTarget(id: string): Promise<void> {
        await this.saveKpiTargets((await this.getKpiTargets()).filter((item: any) => item.id !== id));
    }

    async softDeleteKpiTarget(id: string, deletedBy: string): Promise<void> {
        const now = new Date().toISOString();
        await this.saveKpiTargets(
            (await this.getKpiTargets()).map((item: any) =>
                item.id === id ? { ...item, deleted_at: now, deleted_by: deletedBy || '' } : item
            )
        );
    }

    async restoreKpiTarget(id: string): Promise<void> {
        await this.saveKpiTargets(
            (await this.getKpiTargets()).map((item: any) => {
                if (item.id !== id) return item;
                const { deleted_at: _deletedAt, deleted_by: _deletedBy, ...rest } = item;
                return rest;
            })
        );
    }

    async getAliveProcessIdsAmong(procDefIds: string[]): Promise<Set<string>> {
        if (!procDefIds?.length) return new Set();
        const { data, error } = await this.supabase
            .from('proc_def')
            .select('id')
            .eq('tenant_id', window.$tenantName)
            .is('deleted_at', null)
            .in('id', procDefIds);
        if (error) throw error;
        return new Set((data || []).map((item: any) => item.id));
    }

    async getPublishedProcessIds(procDefIds: string[]): Promise<Set<string>> {
        if (!procDefIds?.length) return new Set();
        const { data, error } = await this.supabase
            .from('proc_def_version')
            .select('proc_def_id')
            .eq('version_tag', 'published')
            .in('proc_def_id', procDefIds);
        if (error) throw error;
        return new Set((data || []).map((item: any) => item.proc_def_id));
    }

    // systems CRUD — pi-system-web 과 동일하게 /pi-system-backend/systems REST 를 1차로 사용한다
    // (pi-system-backend 도 함께 이관되어 있음: system_api.py).
    // 백엔드 미기동 등으로 REST 가 실패하면 Supabase systems 테이블 직접 접근으로 폴백
    // (searchUsersByName/searchSuppliers 와 같은 관례).
    async getSystemList() {
        try {
            const response = await axiosInstance.get('/pi-system-backend/systems');
            return response.data;
        } catch {
            const { data, error } = await this.supabase
                .from('systems')
                .select('*')
                .eq('tenant_id', window.$tenantName)
                .is('deleted_at', null)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        }
    }

    async getSystem(systemId: string) {
        try {
            const response = await axiosInstance.get(`/pi-system-backend/systems/${systemId}`);
            return response.data;
        } catch {
            const { data, error } = await this.supabase
                .from('systems')
                .select('*')
                .eq('tenant_id', window.$tenantName)
                .eq('id', systemId)
                .maybeSingle();
            if (error) throw error;
            return data;
        }
    }

    async putSystem(system: any) {
        try {
            let response;
            if (system.id) {
                response = await axiosInstance.put(`/pi-system-backend/systems/${system.id}`, system);
            } else {
                response = await axiosInstance.post('/pi-system-backend/systems', system);
            }
            return response.data;
        } catch {
            const row: any = { ...system, tenant_id: window.$tenantName, updated_at: new Date().toISOString() };
            if (!row.id) delete row.id;
            const { data, error } = await this.supabase.from('systems').upsert(row, { onConflict: 'id' }).select('*').single();
            if (error) throw error;
            return data;
        }
    }

    async deleteSystem(system: any) {
        return await this.softDeleteSystem(system);
    }

    async softDeleteSystem(system: any, deletedBy?: string) {
        try {
            const response = await axiosInstance.delete(`/pi-system-backend/systems/${system.id}`, {
                data: { deleted_by: deletedBy }
            });
            return response.data;
        } catch {
            const now = new Date().toISOString();
            const { data, error } = await this.supabase
                .from('systems')
                .update({ deleted_at: now, deleted_by: deletedBy || null, updated_at: now })
                .eq('tenant_id', window.$tenantName)
                .eq('id', system.id)
                .select('*')
                .single();
            if (error) throw error;
            return data;
        }
    }

    async getDeletedSystemList(): Promise<any[]> {
        try {
            const response = await axiosInstance.get('/pi-system-backend/systems/deleted');
            return response.data;
        } catch {
            const { data, error } = await this.supabase
                .from('systems')
                .select('*')
                .eq('tenant_id', window.$tenantName)
                .not('deleted_at', 'is', null)
                .order('deleted_at', { ascending: false });
            if (error) throw error;
            return data || [];
        }
    }

    async restoreSystem(systemId: string) {
        try {
            const response = await axiosInstance.post(`/pi-system-backend/systems/${systemId}/restore`);
            return response.data;
        } catch {
            const { data, error } = await this.supabase
                .from('systems')
                .update({ deleted_at: null, deleted_by: null, updated_at: new Date().toISOString() })
                .eq('tenant_id', window.$tenantName)
                .eq('id', systemId)
                .select('*')
                .single();
            if (error) throw error;
            return data;
        }
    }

    async hardDeleteSystem(systemId: string) {
        try {
            const response = await axiosInstance.delete(`/pi-system-backend/systems/${systemId}/permanent`);
            return response.data;
        } catch {
            const { data, error } = await this.supabase
                .from('systems')
                .delete()
                .eq('tenant_id', window.$tenantName)
                .eq('id', systemId)
                .select('*')
                .single();
            if (error) throw error;
            return data;
        }
    }
}

export default PalModeBackend;
