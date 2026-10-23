/**
 * The n8n backend, as ProcessGPT talks to it.
 *
 * Only two things happen from the browser: a workflow is created when an n8n
 * agent is registered, and it is read back to show what the agent does. Editing
 * happens in the n8n studio itself — this file deliberately has no update path,
 * because two editors writing the same workflow is how a canvas loses work.
 *
 * Everything goes through `/process-gpt-n8n`, which the gateway proxies to n8n
 * (see services/n8n-agent/deploy/nginx.conf) and vite proxies in dev.
 */

import axios from 'axios';

export const N8N_BASE_PATH = '/process-gpt-n8n';

/** The URL of the studio canvas for one workflow, for the embed to load. */
export function studioUrl(workflowId) {
    return `${N8N_BASE_PATH}/workflow/${workflowId}?processgpt=1`;
}

/**
 * Create the workflow that backs a newly registered n8n agent.
 *
 * It is created with a manual trigger already on the canvas rather than empty:
 * the ProcessGPT work item is pinned onto that node at execution time, so a
 * workflow without one has nowhere for the process data to enter.
 */
export async function createWorkflow(name) {
    const response = await axios.post(`${N8N_BASE_PATH}/rest/workflows`, {
        name: name || 'ProcessGPT 워크플로우',
        nodes: [
            {
                parameters: {},
                id: crypto.randomUUID(),
                name: 'ProcessGPT 업무 시작',
                type: 'n8n-nodes-base.manualTrigger',
                typeVersion: 1,
                position: [0, 0]
            }
        ],
        connections: {},
        // Not optional: n8n's schema has `active` NOT NULL, and omitting it
        // fails the insert rather than defaulting.
        active: false,
        settings: { executionOrder: 'v1' }
    });
    return unwrap(response.data);
}

/** Read a workflow back, or null when it is gone. */
export async function fetchWorkflow(workflowId) {
    if (!workflowId) return null;
    try {
        const response = await axios.get(`${N8N_BASE_PATH}/rest/workflows/${workflowId}`);
        return unwrap(response.data);
    } catch (error) {
        // A deleted workflow is a real state — the agent outlives it — and the
        // caller renders "워크플로우를 찾을 수 없음" rather than an error toast.
        if (error?.response?.status === 404) return null;
        throw error;
    }
}

/** A one-line description of what the workflow does, for the agent card. */
export function summarize(workflow) {
    const nodes = (workflow?.nodes || []).filter((n) => !n.disabled);
    if (!nodes.length) return '';
    return nodes.map((n) => n.name).join(' → ');
}

/** n8n answers `{data: …}` on one API surface and the bare object on the other. */
function unwrap(body) {
    return body && typeof body === 'object' && 'data' in body ? body.data : body;
}
