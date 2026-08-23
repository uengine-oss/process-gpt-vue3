const API_BASE_URL = '/pi-system-backend/api/v1/projects';

export interface LinkedSystemMapping {
    system_id?: string;
    system_name?: string;
}

export interface ProjectTaskMapping {
    task_id: string;
    task_name?: string;
    process_id?: string;
    linked_systems: LinkedSystemMapping[];
}

export interface ProjectMappingCommitPayload {
    project_id: string;
    process_id: string;
    process_name: string;
    task_list: ProjectTaskMapping[];
}

export interface ProjectMappingResponse {
    project_id?: string;
    process_id?: string | string[];
    process_name: string | string[];
    task_list: ProjectTaskMapping[];
    linked_systems: LinkedSystemMapping[];
}

function asText(value: unknown): string {
    return value == null ? '' : String(value).trim();
}

function readUengineProperties(businessObject: any): Record<string, any> {
    const properties = businessObject?.extensionElements?.values?.find(
        (value: any) => value?.$type === 'uengine:Properties'
    );
    if (!properties?.json) return {};
    try {
        const parsed = JSON.parse(properties.json);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function normalizeSystems(value: unknown): LinkedSystemMapping[] {
    const items = Array.isArray(value) ? value : (value ? [value] : []);
    const seen = new Set<string>();
    const result: LinkedSystemMapping[] = [];
    for (const item of items) {
        const systemId = typeof item === 'object' && item
            ? asText((item as any).id ?? (item as any).system_id)
            : '';
        const systemName = typeof item === 'string'
            ? asText(item)
            : asText((item as any)?.name ?? (item as any)?.system_name);
        if (!systemId && !systemName) continue;
        const key = systemId ? `id:${systemId}` : `name:${systemName}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push({
            ...(systemId ? { system_id: systemId } : {}),
            ...(systemName ? { system_name: systemName } : {})
        });
    }
    return result;
}

function isTaskLikeElement(element: any): boolean {
    const type = asText(element?.type ?? element?.businessObject?.$type);
    return type.includes('Task') || type === 'bpmn:SubProcess' || type === 'bpmn:CallActivity';
}

export function collectProjectMappingPayloads(
    modeler: any,
    processId: string,
    processName: string
): Map<string, ProjectMappingCommitPayload> {
    const registry = modeler?.get?.('elementRegistry');
    const elements = registry?.getAll?.() || [];
    const payloads = new Map<string, ProjectMappingCommitPayload>();

    for (const element of elements) {
        if (!isTaskLikeElement(element)) continue;
        const businessObject = element?.businessObject || element;
        const taskId = asText(businessObject?.id ?? element?.id);
        if (!taskId) continue;
        const properties = readUengineProperties(businessObject);
        const relatedProjects = Array.isArray(properties.relatedProjects) ? properties.relatedProjects : [];
        const task: ProjectTaskMapping = {
            task_id: taskId,
            task_name: asText(businessObject?.name) || taskId,
            linked_systems: normalizeSystems(properties.systems)
        };

        for (const project of relatedProjects) {
            const projectId = typeof project === 'object' && project
                ? asText((project as any).id ?? (project as any).task_id)
                : '';
            if (!projectId) continue;
            if (!payloads.has(projectId)) {
                payloads.set(projectId, {
                    project_id: projectId,
                    process_id: processId,
                    process_name: processName || processId,
                    task_list: []
                });
            }
            const taskList = payloads.get(projectId)!.task_list;
            if (!taskList.some((item) => item.task_id === taskId)) taskList.push(task);
        }
    }

    for (const payload of payloads.values()) {
        payload.task_list.sort((a, b) => a.task_id.localeCompare(b.task_id));
    }
    return payloads;
}

async function parseResponse(response: Response): Promise<any> {
    const body = await response.json().catch(() => null);
    if (response.ok) return body;
    const detail = typeof body?.detail === 'string' ? body.detail : `HTTP ${response.status}`;
    throw new Error(`과제 매핑 API 호출 실패: ${detail}`);
}

export async function getProjectMapping(projectId: string): Promise<ProjectMappingResponse | null> {
    const response = await fetch(`${API_BASE_URL}/${encodeURIComponent(projectId)}/mappings`, {
        headers: { Accept: 'application/json' },
        credentials: 'include'
    });
    if (response.status === 404) return null;
    return parseResponse(response);
}

export async function commitProjectMapping(
    payload: ProjectMappingCommitPayload
): Promise<ProjectMappingResponse> {
    const response = await fetch(`${API_BASE_URL}/mappings`, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(payload)
    });
    return parseResponse(response);
}

function canonicalTasks(tasks: ProjectTaskMapping[]): string {
    const normalized = tasks.map((task) => ({
        task_id: asText(task.task_id),
        task_name: asText(task.task_name),
        linked_systems: normalizeSystems(task.linked_systems).sort((a, b) =>
            `${a.system_id || ''}:${a.system_name || ''}`.localeCompare(
                `${b.system_id || ''}:${b.system_name || ''}`
            )
        )
    })).sort((a, b) => a.task_id.localeCompare(b.task_id));
    return JSON.stringify(normalized);
}

function existingTasksForProcess(
    mapping: ProjectMappingResponse | null,
    processId: string
): ProjectTaskMapping[] {
    if (!mapping) return [];
    const responseProcessIds = Array.isArray(mapping.process_id)
        ? mapping.process_id.map(asText)
        : [asText(mapping.process_id)].filter(Boolean);
    return (mapping.task_list || []).filter((task) => {
        const taskProcessId = asText(task.process_id);
        if (taskProcessId) return taskProcessId === processId;
        return responseProcessIds.length === 1 && responseProcessIds[0] === processId;
    });
}

export async function syncProjectMappingsFromModeler(options: {
    modeler: any;
    processId: string;
    processName: string;
    projectIds: Array<string | number | null | undefined>;
}): Promise<{ updated: string[]; unchanged: string[] }> {
    const processId = asText(options.processId);
    const ids = [...new Set((options.projectIds || []).map(asText).filter(Boolean))];
    const payloads = collectProjectMappingPayloads(options.modeler, processId, options.processName);
    const updated: string[] = [];
    const unchanged: string[] = [];

    await Promise.all(ids.map(async (projectId) => {
        const desired = payloads.get(projectId) || {
            project_id: projectId,
            process_id: processId,
            process_name: options.processName || processId,
            task_list: []
        };
        const existing = await getProjectMapping(projectId);
        const existingTasks = existingTasksForProcess(existing, processId);
        if (canonicalTasks(existingTasks) === canonicalTasks(desired.task_list)) {
            unchanged.push(projectId);
            return;
        }
        await commitProjectMapping(desired);
        updated.push(projectId);
    }));

    return { updated, unchanged };
}
