/**
 * 워크아이템 화면 플러그인 해석기.
 *
 * 폼(formHandler:<formId>)은 그대로 데이터 계약으로 두고, workitem_app_binding 에 그 폼이 등록돼 있으면
 * 등록된 외부 앱의 화면을 대신(또는 함께) 보여 준다. Process GPT 는 앱을 이름으로만 안다.
 */
export interface AppHandler {
    appId: string;
    name: string;
    url: string;
    origin: string; // postMessage 상대 출처
    mode: 'replace' | 'beside';
}

export interface AppHandlerContext {
    formId: string;
    taskId?: string;
    procInstId?: string;
    procDefId?: string;
    activityId?: string;
}

const cache = new Map<string, Promise<{ binding: any; app: any } | null>>();

function fill(template: string, ctx: AppHandlerContext): string {
    const v: Record<string, string> = {
        task_id: ctx.taskId || '',
        proc_inst_id: ctx.procInstId || '',
        proc_def_id: ctx.procDefId || '',
        activity_id: ctx.activityId || '',
        form_id: ctx.formId || ''
    };
    return template.replace(/\{(task_id|proc_inst_id|proc_def_id|activity_id|form_id)\}/g, (_, k) => encodeURIComponent(v[k]));
}

async function lookup(formId: string): Promise<{ binding: any; app: any } | null> {
    const sb = (window as any).$supabase;
    if (!sb || !formId) return null;
    const { data: binding } = await sb.from('workitem_app_binding').select('*').eq('form_id', formId).eq('enabled', true).maybeSingle();
    if (!binding) return null;
    const { data: app } = await sb.from('workitem_app').select('*').eq('app_id', binding.app_id).eq('enabled', true).maybeSingle();
    return app ? { binding, app } : null;
}

export async function resolveAppHandler(ctx: AppHandlerContext): Promise<AppHandler | null> {
    if (!ctx.formId) return null;
    if (!cache.has(ctx.formId)) cache.set(ctx.formId, lookup(ctx.formId).catch(() => null));
    const hit = await cache.get(ctx.formId);
    if (!hit) return null;
    const base = String(hit.app.base_url).replace(/\/$/, '');
    const path = fill(String(hit.binding.view_path || ''), ctx);
    const url = new URL(base + (path.startsWith('/') ? path : '/' + path), window.location.origin);
    for (const [k, val] of Object.entries({ pgpt_task: ctx.taskId, pgpt_inst: ctx.procInstId, pgpt_activity: ctx.activityId })) {
        if (val && !url.searchParams.has(k)) url.searchParams.set(k, String(val));
    }
    return {
        appId: hit.app.app_id,
        name: hit.app.name,
        url: url.toString(),
        origin: hit.app.allowed_origin || url.origin,
        mode: hit.binding.mode === 'beside' ? 'beside' : 'replace'
    };
}
