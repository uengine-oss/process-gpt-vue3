import type { Router, RouteLocationNormalizedLoaded } from 'vue-router';
import { getSsoUser } from '@/utils/ssoAuth';

export type UsageEventType =
    | 'session_start'
    | 'session_end'
    | 'route_view'
    | 'heartbeat'
    | 'model_view'
    | 'model_create'
    | 'model_edit'
    | 'model_save';

export interface UsageEventPayload {
    route?: string | null;
    procDefId?: string | null;
    modelId?: string | null;
    activeDurationMs?: number;
    metadata?: Record<string, any>;
    eventKey?: string | null;
}

export interface UsageDashboardSummary {
    totalUsers: number;
    activeUsers: number;
    activationRate: number;
    totalEvents: number;
    totalActiveDurationMs: number;
    totalModelViews: number;
    totalModelEdits: number;
}

export interface TeamUsageMetric {
    teamId: string;
    teamName: string;
    totalMembers: number;
    activeUsers: number;
    activationRate: number;
    dau: number;
    wau: number;
    avgDurationMs: number;
    totalDurationMs: number;
    modelViews: number;
    modelEdits: number;
    modelCreates: number;
    previousActiveUsers: number;
    returningUsers: number;
    retentionRate: number;
    lastSeen: string | null;
}

export interface ModelHitMetric {
    procDefId: string;
    modelId: string | null;
    modelName: string;
    viewCount: number;
    uniqueViewers: number;
    lastSeen: string | null;
}

export interface UserRankingMetric {
    userKey: string;
    userName: string;
    email: string | null;
    teamName: string;
    value: number;
    eventCount?: number;
    activeDays?: number;
    durationMs?: number;
    lastSeen?: string | null;
}

export interface UsageAdoptionDashboard {
    generatedAt: string;
    period: {
        currentStart: string;
        currentEnd: string;
        previousStart: string;
        todayStart: string;
    };
    summary: UsageDashboardSummary;
    teamActivity: TeamUsageMetric[];
    dauWauRanking: TeamUsageMetric[];
    modelTop: ModelHitMetric[];
    teamEditViewMix: TeamUsageMetric[];
    heroes: {
        frequentVisitors: UserRankingMetric[];
        topEditors: UserRankingMetric[];
        longestSessions: UserRankingMetric[];
    };
    retention: TeamUsageMetric[];
    lastSeen: TeamUsageMetric[];
    tableMissing: boolean;
    error?: string;
}

interface UsageIdentity {
    tenant_id: string;
    user_id: string | null;
    email: string | null;
    employee_no: string | null;
    user_name: string | null;
    department_id: string | null;
    department_name: string | null;
    org_code: string | null;
    org_name: string | null;
}

interface RawUsageEvent {
    id?: string;
    tenant_id?: string;
    event_type: UsageEventType;
    session_id?: string | null;
    user_id?: string | null;
    email?: string | null;
    employee_no?: string | null;
    user_name?: string | null;
    department_id?: string | null;
    department_name?: string | null;
    org_code?: string | null;
    org_name?: string | null;
    route?: string | null;
    proc_def_id?: string | null;
    model_id?: string | null;
    active_duration_ms?: number | null;
    metadata?: Record<string, any> | null;
    occurred_at: string;
}

interface RawUser {
    id?: string | null;
    email?: string | null;
    username?: string | null;
    employee_no?: string | null;
    department_id?: string | null;
    department_name?: string | null;
    org_code?: string | null;
    org_name?: string | null;
    is_agent?: boolean | null;
}

let userCache: { value: UsageIdentity; expiresAt: number } | null = null;
let trackingStarted = false;
let lastActivityAt = Date.now();
let lastHeartbeatAt = Date.now();
let heartbeatTimer: number | null = null;
let lastTrackedRouteSignature = '';
let lastTrackedRouteAt = 0;
let lastBackfilledIdentitySignature = '';
const PAGE_INSTANCE_ID = makeId();
const pendingEventKeys = new Set<string>();
const sentEventKeys = new Set<string>();

const HEARTBEAT_MS = 30000;
const IDLE_LIMIT_MS = 5 * 60 * 1000;
const ROUTE_TRACK_DEDUPE_MS = 1000;
const USER_CACHE_MS = 60 * 1000;
const SESSION_BACKFILL_WINDOW_MS = 10 * 60 * 1000;

function getTenantId(): string {
    return (window as any).$tenantName || 'skt';
}

function normalizeText(value: any): string | null {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text || null;
}

function makeId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getSessionId(): string {
    const key = 'usage_session_id';
    let id = sessionStorage.getItem(key);
    if (!id) {
        id = makeId();
        sessionStorage.setItem(key, id);
    }
    return id;
}

function getPageInstanceId(): string {
    return PAGE_INSTANCE_ID;
}

function isDuplicateEventKeyError(error: any): boolean {
    const code = normalizeText(error?.code);
    const message = normalizeText(error?.message) || '';
    return code === '23505' && message.includes('idx_app_usage_events_event_key');
}

function makeUserKey(value: Partial<RawUser | RawUsageEvent | UsageIdentity>): string {
    return (
        normalizeText((value as any).user_id) ||
        normalizeText((value as any).id) ||
        normalizeText(value.email) ||
        normalizeText(value.employee_no) ||
        'anonymous'
    );
}

function resolveTeam(value: Partial<RawUser | RawUsageEvent | UsageIdentity>) {
    const id =
        normalizeText((value as any).department_id) ||
        normalizeText((value as any).department_name) ||
        normalizeText((value as any).org_code) ||
        normalizeText((value as any).org_name) ||
        'UNASSIGNED';
    const name =
        normalizeText((value as any).department_name) ||
        normalizeText((value as any).org_name) ||
        normalizeText((value as any).org_code) ||
        'Unassigned';
    return { id, name };
}

function userDisplayName(value: Partial<RawUser | RawUsageEvent | UsageIdentity>): string {
    return (
        normalizeText((value as any).user_name) ||
        normalizeText((value as any).username) ||
        normalizeText(value.email) ||
        normalizeText(value.employee_no) ||
        normalizeText((value as any).user_id) ||
        normalizeText((value as any).id) ||
        'Unknown'
    );
}

function currentIdentitySeed() {
    const ssoUser = getSsoUser();
    return {
        user_id: normalizeText(localStorage.getItem('uid')) || normalizeText(ssoUser?.id),
        email: normalizeText(localStorage.getItem('email')) || normalizeText(ssoUser?.email),
        employee_no: normalizeText(localStorage.getItem('employeeNo')) || normalizeText(ssoUser?.employee_no),
        user_name: normalizeText(localStorage.getItem('userName')) || normalizeText(ssoUser?.username),
        org_code: normalizeText((ssoUser as any)?.org_code),
        org_name: normalizeText(localStorage.getItem('orgName')) || normalizeText(ssoUser?.org_name)
    };
}

function shouldReuseCachedIdentity(now: number): boolean {
    if (!userCache || userCache.expiresAt <= now) return false;

    const seed = currentIdentitySeed();
    const cached = userCache.value;
    const keys: Array<keyof typeof seed> = ['user_id', 'email', 'employee_no', 'user_name', 'org_code', 'org_name'];

    return keys.every((key) => {
        const freshValue = normalizeText(seed[key]);
        const cachedValue = normalizeText((cached as any)[key]);
        if (!freshValue) return true;
        return freshValue === cachedValue;
    });
}

function resetUsageIdentityCache() {
    userCache = null;
}

function makeIdentitySignature(identity: UsageIdentity): string {
    return [
        identity.tenant_id,
        identity.user_id || '',
        identity.email || '',
        identity.employee_no || '',
        identity.department_id || '',
        identity.department_name || '',
        identity.org_code || '',
        identity.org_name || ''
    ].join('::');
}

async function resolveIdentity(): Promise<UsageIdentity> {
    const now = Date.now();
    if (shouldReuseCachedIdentity(now)) {
        return userCache.value;
    }

    const seed = currentIdentitySeed();
    const base: UsageIdentity = {
        tenant_id: getTenantId(),
        user_id: seed.user_id,
        email: seed.email,
        employee_no: seed.employee_no,
        user_name: seed.user_name,
        department_id: null,
        department_name: null,
        org_code: seed.org_code,
        org_name: seed.org_name
    };

    const supabase = (window as any).$supabase;
    if (supabase && (base.user_id || base.email)) {
        try {
            let query = supabase
                .from('users')
                .select('id,email,username,employee_no,department_id,department_name,org_code,org_name')
                .eq('tenant_id', base.tenant_id)
                .limit(1);
            query = base.user_id ? query.eq('id', base.user_id) : query.eq('email', base.email);
            const { data } = await query.maybeSingle();
            if (data) {
                base.user_id = normalizeText(data.id) || base.user_id;
                base.email = normalizeText(data.email) || base.email;
                base.employee_no = normalizeText(data.employee_no) || base.employee_no;
                base.user_name = normalizeText(data.username) || base.user_name;
                base.department_id = normalizeText(data.department_id);
                base.department_name = normalizeText(data.department_name);
                base.org_code = normalizeText(data.org_code) || base.org_code;
                base.org_name = normalizeText(data.org_name) || base.org_name;
            }
        } catch {
            // Usage tracking must never break app flow.
        }
    }

    userCache = { value: base, expiresAt: now + USER_CACHE_MS };
    return base;
}

async function backfillSessionIdentity(): Promise<void> {
    const supabase = (window as any).$supabase;
    if (!supabase) return;

    try {
        const identity = await resolveIdentity();
        if (!identity.user_id && !identity.email) return;
        const identitySignature = makeIdentitySignature(identity);
        if (identitySignature === lastBackfilledIdentitySignature) return;

        const patch = {
            user_id: identity.user_id,
            email: identity.email,
            employee_no: identity.employee_no,
            user_name: identity.user_name,
            department_id: identity.department_id,
            department_name: identity.department_name,
            org_code: identity.org_code,
            org_name: identity.org_name
        };

        const recentSince = new Date(Date.now() - SESSION_BACKFILL_WINDOW_MS).toISOString();
        await supabase
            .from('app_usage_events')
            .update(patch)
            .eq('tenant_id', identity.tenant_id)
            .eq('session_id', getSessionId())
            .gte('occurred_at', recentSince)
            .or('user_id.is.null,email.is.null,department_name.is.null,org_name.is.null');
        lastBackfilledIdentitySignature = identitySignature;
    } catch {
        // Best-effort only.
    }
}

function handleUsageIdentityReady() {
    resetUsageIdentityCache();
    lastBackfilledIdentitySignature = '';
    void backfillSessionIdentity();
}

export async function recordUsageEvent(eventType: UsageEventType, payload: UsageEventPayload = {}): Promise<void> {
    const supabase = (window as any).$supabase;
    if (!supabase) return;

    try {
        const eventKey = normalizeText(payload.eventKey);
        if (eventKey && (sentEventKeys.has(eventKey) || pendingEventKeys.has(eventKey))) {
            return;
        }
        if (eventKey) pendingEventKeys.add(eventKey);

        const identity = await resolveIdentity();
        if (!identity.user_id && !identity.email && !identity.employee_no) {
            if (eventKey) pendingEventKeys.delete(eventKey);
            return;
        }
        const route = payload.route ?? `${window.location.pathname}${window.location.search}`;
        const record = {
            tenant_id: identity.tenant_id,
            event_type: eventType,
            event_key: eventKey,
            session_id: getSessionId(),
            user_id: identity.user_id,
            email: identity.email,
            employee_no: identity.employee_no,
            user_name: identity.user_name,
            department_id: identity.department_id,
            department_name: identity.department_name,
            org_code: identity.org_code,
            org_name: identity.org_name,
            route,
            proc_def_id: normalizeText(payload.procDefId),
            model_id: normalizeText(payload.modelId),
            active_duration_ms: Math.max(0, Math.floor(payload.activeDurationMs || 0)),
            metadata: payload.metadata || {},
            occurred_at: new Date().toISOString()
        };

        const { error } = await supabase.from('app_usage_events').insert(record);
        if (error) {
            if (eventKey && isDuplicateEventKeyError(error)) {
                sentEventKeys.add(eventKey);
                pendingEventKeys.delete(eventKey);
            } else if (eventKey) {
                pendingEventKeys.delete(eventKey);
            }
            return;
        }
        if (eventKey) {
            pendingEventKeys.delete(eventKey);
            sentEventKeys.add(eventKey);
        }
        void backfillSessionIdentity();
    } catch {
        const eventKey = normalizeText(payload.eventKey);
        if (eventKey) pendingEventKeys.delete(eventKey);
        // Non-blocking by design.
    }
}

function shouldTrackRoute(path: string): boolean {
    return !path.startsWith('/auth') && !path.startsWith('/external-forms');
}

function normalizeProcDefId(raw: any): string | null {
    const text = normalizeText(raw);
    if (!text) return null;
    return decodeURIComponent(text).replace(/\.bpmn$/i, '');
}

function routeQueryValue(raw: any): string | null {
    return Array.isArray(raw) ? normalizeText(raw[0]) : normalizeText(raw);
}

export function extractProcDefIdFromRoute(route: Pick<RouteLocationNormalizedLoaded, 'path' | 'query' | 'params'>): string | null {
    const path = route.path || '';
    if (path.startsWith('/definition-map/sub/')) {
        return normalizeProcDefId(path.replace('/definition-map/sub/', ''));
    }
    if (path === '/process-hierarchy' && route.query?.id) {
        return normalizeProcDefId(routeQueryValue(route.query.id));
    }
    if (path === '/version-comparison' && route.query?.processId) {
        return normalizeProcDefId(routeQueryValue(route.query.processId));
    }
    if (path.startsWith('/definitions/chat') && route.query?.id) {
        return normalizeProcDefId(routeQueryValue(route.query.id));
    }
    if (path.startsWith('/definitions/')) {
        const raw = Array.isArray(route.params?.pathMatch) ? route.params.pathMatch.join('/') : route.params?.pathMatch;
        return normalizeProcDefId(raw || path.replace('/definitions/', ''));
    }
    return null;
}

function shouldSkipRecentRouteTrack(path: string, procDefId: string | null): boolean {
    const now = Date.now();
    const signature = `${path}::${procDefId || ''}`;
    if (signature === lastTrackedRouteSignature && now - lastTrackedRouteAt < ROUTE_TRACK_DEDUPE_MS) {
        return true;
    }
    lastTrackedRouteSignature = signature;
    lastTrackedRouteAt = now;
    return false;
}

function trackRouteUsage(
    route: Pick<RouteLocationNormalizedLoaded, 'path' | 'query' | 'params' | 'fullPath' | 'name'>,
    source: string
) {
    if (!shouldTrackRoute(route.path)) return;

    const procDefId = extractProcDefIdFromRoute(route as Pick<RouteLocationNormalizedLoaded, 'path' | 'query' | 'params'>);
    if (shouldSkipRecentRouteTrack(route.path || '', procDefId)) return;

    void recordUsageEvent('route_view', {
        route: route.fullPath || route.path,
        procDefId,
        metadata: { routeName: route.name ? String(route.name) : null, source }
    });

    if (procDefId) {
        void recordUsageEvent('model_view', {
            route: route.fullPath || route.path,
            procDefId,
            metadata: { source }
        });
    }
}

function markActivity() {
    lastActivityAt = Date.now();
}

function flushActiveTime(eventType: UsageEventType = 'heartbeat') {
    const now = Date.now();
    const visible = document.visibilityState === 'visible';
    const active = now - lastActivityAt <= IDLE_LIMIT_MS;
    const duration = visible && active ? now - lastHeartbeatAt : 0;
    lastHeartbeatAt = now;
    if (duration > 0) {
        void recordUsageEvent(eventType, {
            activeDurationMs: duration,
            eventKey: `${getSessionId()}:${getPageInstanceId()}:${eventType}:${Math.floor(now / HEARTBEAT_MS)}`
        });
    }
}

export function startUsageTracking(router: Router): void {
    if (trackingStarted || typeof window === 'undefined') return;
    trackingStarted = true;

    const activityEvents = ['pointerdown', 'keydown', 'scroll', 'mousemove', 'touchstart'];
    activityEvents.forEach((name) => window.addEventListener(name, markActivity, { passive: true }));
    window.addEventListener('usage-identity-ready', handleUsageIdentityReady);

    void recordUsageEvent('session_start', {
        route: `${window.location.pathname}${window.location.search}`,
        eventKey: `${getSessionId()}:${getPageInstanceId()}:session_start`
    });

    void router.isReady().then(() => {
        const initialRoute = router.currentRoute?.value;
        if (initialRoute) {
            trackRouteUsage(
                initialRoute as Pick<RouteLocationNormalizedLoaded, 'path' | 'query' | 'params' | 'fullPath' | 'name'>,
                'router.initial'
            );
        }
    }).catch(() => {});

    router.afterEach((to) => {
        trackRouteUsage(to, 'router.afterEach');
    });

    heartbeatTimer = window.setInterval(() => flushActiveTime('heartbeat'), HEARTBEAT_MS);

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            flushActiveTime('heartbeat');
        } else {
            lastHeartbeatAt = Date.now();
            markActivity();
        }
    });

    window.addEventListener('pagehide', () => {
        flushActiveTime('session_end');
        if (heartbeatTimer !== null) {
            window.clearInterval(heartbeatTimer);
            heartbeatTimer = null;
        }
    });
}

function getWeekStart(date: Date): Date {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    const day = copy.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    copy.setDate(copy.getDate() + mondayOffset);
    return copy;
}

function dateKey(value: string): string {
    const date = new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function isBetween(date: Date, start: Date, end: Date): boolean {
    const time = date.getTime();
    return time >= start.getTime() && time < end.getTime();
}

function emptyDashboard(error?: string, tableMissing = false): UsageAdoptionDashboard {
    const now = new Date();
    const currentStart = getWeekStart(now);
    const previousStart = new Date(currentStart);
    previousStart.setDate(previousStart.getDate() - 7);
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    return {
        generatedAt: now.toISOString(),
        period: {
            currentStart: currentStart.toISOString(),
            currentEnd: now.toISOString(),
            previousStart: previousStart.toISOString(),
            todayStart: todayStart.toISOString()
        },
        summary: {
            totalUsers: 0,
            activeUsers: 0,
            activationRate: 0,
            totalEvents: 0,
            totalActiveDurationMs: 0,
            totalModelViews: 0,
            totalModelEdits: 0
        },
        teamActivity: [],
        dauWauRanking: [],
        modelTop: [],
        teamEditViewMix: [],
        heroes: {
            frequentVisitors: [],
            topEditors: [],
            longestSessions: []
        },
        retention: [],
        lastSeen: [],
        tableMissing,
        error
    };
}

function incrementSet(map: Map<string, Set<string>>, key: string, value: string) {
    if (!map.has(key)) map.set(key, new Set());
    map.get(key)?.add(value);
}

function addNumber(map: Map<string, number>, key: string, value: number) {
    map.set(key, (map.get(key) || 0) + value);
}

function maxDate(current: string | null, next: string): string {
    if (!current) return next;
    return new Date(next).getTime() > new Date(current).getTime() ? next : current;
}

export async function getUsageAdoptionDashboard(options: { lookbackDays?: number; topLimit?: number } = {}): Promise<UsageAdoptionDashboard> {
    const supabase = (window as any).$supabase;
    if (!supabase) return emptyDashboard('Supabase is not configured.');

    const tenantId = getTenantId();
    const now = new Date();
    const currentStart = getWeekStart(now);
    const previousStart = new Date(currentStart);
    previousStart.setDate(previousStart.getDate() - 7);
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const lookbackStart = new Date(now);
    lookbackStart.setDate(lookbackStart.getDate() - (options.lookbackDays || 90));
    const topLimit = options.topLimit || 10;

    try {
        const [eventResult, userResult, modelResult, procResult] = await Promise.all([
            supabase
                .from('app_usage_events')
                .select('id, event_type, session_id, user_id, email, employee_no, proc_def_id, model_id, active_duration_ms, occurred_at')
                .eq('tenant_id', tenantId)
                .gte('occurred_at', lookbackStart.toISOString())
                .order('occurred_at', { ascending: false })
                .limit(10000),
            supabase
                .from('users')
                .select('id,email,username,employee_no,department_id,department_name,org_code,org_name,is_agent')
                .eq('tenant_id', tenantId)
                .limit(10000),
            supabase.from('tb_bpmn_model').select('id,proc_def_id,name').eq('tenant_id', tenantId).limit(10000),
            supabase.from('proc_def').select('id,name').eq('tenant_id', tenantId).limit(10000)
        ]);

        if (eventResult.error) {
            const missing = eventResult.error.code === '42P01' || `${eventResult.error.message || ''}`.includes('app_usage_events');
            return emptyDashboard(eventResult.error.message, missing);
        }

        const events = ((eventResult.data || []) as RawUsageEvent[]).filter(
            (event) => event.occurred_at && (normalizeText(event.user_id) || normalizeText(event.email) || normalizeText(event.employee_no))
        );
        const users = ((userResult.data || []) as RawUser[]).filter((user) => !user.is_agent);
        const modelNameMap = new Map<string, string>();
        const procNameMap = new Map<string, string>();

        (modelResult.data || []).forEach((model: any) => {
            if (model.id) modelNameMap.set(String(model.id), model.name || model.proc_def_id || String(model.id));
            if (model.proc_def_id) procNameMap.set(String(model.proc_def_id), model.name || model.proc_def_id);
        });
        (procResult.data || []).forEach((proc: any) => {
            if (proc.id) procNameMap.set(String(proc.id), proc.name || proc.id);
        });

        const userMap = new Map<string, RawUser>();
        const teamMembers = new Map<string, Set<string>>();
        const teamNames = new Map<string, string>();

        users.forEach((user) => {
            const key = makeUserKey(user);
            userMap.set(key, user);
            if (user.id) userMap.set(String(user.id), user);
            if (user.email) userMap.set(String(user.email), user);
            if (user.employee_no) userMap.set(String(user.employee_no), user);
            const team = resolveTeam(user);
            teamNames.set(team.id, team.name);
            incrementSet(teamMembers, team.id, key);
        });

        function eventUser(event: RawUsageEvent): RawUser | RawUsageEvent {
            return userMap.get(makeUserKey(event))
                || (event.user_id ? userMap.get(String(event.user_id)) : undefined)
                || (event.email ? userMap.get(String(event.email)) : undefined)
                || (event.employee_no ? userMap.get(String(event.employee_no)) : undefined)
                || event;
        }

        function eventTeam(event: RawUsageEvent) {
            const source = eventUser(event);
            const eventTeamSnapshot = resolveTeam(event);
            if (eventTeamSnapshot.id !== 'UNASSIGNED') {
                teamNames.set(eventTeamSnapshot.id, eventTeamSnapshot.name);
                return eventTeamSnapshot;
            }
            const team = resolveTeam(source);
            teamNames.set(team.id, team.name);
            return team;
        }

        const currentEvents = events.filter((event) => isBetween(new Date(event.occurred_at), currentStart, now));
        const previousEvents = events.filter((event) => isBetween(new Date(event.occurred_at), previousStart, currentStart));
        const todayEvents = events.filter((event) => isBetween(new Date(event.occurred_at), todayStart, now));
        const editTypes = new Set<UsageEventType>(['model_create', 'model_edit', 'model_save']);

        const activeByTeam = new Map<string, Set<string>>();
        const previousByTeam = new Map<string, Set<string>>();
        const todayByTeam = new Map<string, Set<string>>();
        const durationByTeam = new Map<string, number>();
        const modelViewsByTeam = new Map<string, number>();
        const modelEditsByTeam = new Map<string, number>();
        const modelCreatesByTeam = new Map<string, number>();
        const lastSeenByTeam = new Map<string, string>();
        const allActiveUsers = new Set<string>();

        currentEvents.forEach((event) => {
            const userKey = makeUserKey(event);
            const team = eventTeam(event);
            allActiveUsers.add(userKey);
            incrementSet(activeByTeam, team.id, userKey);
            addNumber(durationByTeam, team.id, Number(event.active_duration_ms || 0));
            if (event.event_type === 'model_view') addNumber(modelViewsByTeam, team.id, 1);
            if (editTypes.has(event.event_type)) addNumber(modelEditsByTeam, team.id, 1);
            if (event.event_type === 'model_create') addNumber(modelCreatesByTeam, team.id, 1);
            lastSeenByTeam.set(team.id, maxDate(lastSeenByTeam.get(team.id) || null, event.occurred_at));
        });

        previousEvents.forEach((event) => {
            incrementSet(previousByTeam, eventTeam(event).id, makeUserKey(event));
        });

        todayEvents.forEach((event) => {
            incrementSet(todayByTeam, eventTeam(event).id, makeUserKey(event));
        });

        events.forEach((event) => {
            const team = eventTeam(event);
            lastSeenByTeam.set(team.id, maxDate(lastSeenByTeam.get(team.id) || null, event.occurred_at));
        });

        const teamIds = new Set<string>([
            ...Array.from(teamMembers.keys()),
            ...Array.from(activeByTeam.keys()),
            ...Array.from(previousByTeam.keys()),
            ...Array.from(lastSeenByTeam.keys())
        ]);

        const teamActivity = Array.from(teamIds).map((teamId) => {
            const members = teamMembers.get(teamId) || new Set<string>();
            const active = activeByTeam.get(teamId) || new Set<string>();
            const previous = previousByTeam.get(teamId) || new Set<string>();
            const today = todayByTeam.get(teamId) || new Set<string>();
            const returning = Array.from(previous).filter((userKey) => active.has(userKey)).length;
            const totalMembers = members.size;
            return {
                teamId,
                teamName: teamNames.get(teamId) || teamId,
                totalMembers,
                activeUsers: active.size,
                activationRate: totalMembers > 0 ? active.size / totalMembers : 0,
                dau: today.size,
                wau: active.size,
                avgDurationMs: active.size > 0 ? Math.round((durationByTeam.get(teamId) || 0) / active.size) : 0,
                totalDurationMs: durationByTeam.get(teamId) || 0,
                modelViews: modelViewsByTeam.get(teamId) || 0,
                modelEdits: modelEditsByTeam.get(teamId) || 0,
                modelCreates: modelCreatesByTeam.get(teamId) || 0,
                previousActiveUsers: previous.size,
                returningUsers: returning,
                retentionRate: previous.size > 0 ? returning / previous.size : 0,
                lastSeen: lastSeenByTeam.get(teamId) || null
            };
        });

        const modelViewMap = new Map<string, { event: RawUsageEvent; viewers: Set<string>; count: number; lastSeen: string | null }>();
        currentEvents
            .filter((event) => event.event_type === 'model_view' && (event.proc_def_id || event.model_id))
            .forEach((event) => {
                const key = event.proc_def_id || event.model_id || 'unknown';
                if (!modelViewMap.has(key)) {
                    modelViewMap.set(key, { event, viewers: new Set(), count: 0, lastSeen: null });
                }
                const item = modelViewMap.get(key)!;
                item.count += 1;
                item.viewers.add(makeUserKey(event));
                item.lastSeen = maxDate(item.lastSeen, event.occurred_at);
            });

        const modelTop = Array.from(modelViewMap.entries())
            .map(([key, item]) => ({
                procDefId: item.event.proc_def_id || key,
                modelId: item.event.model_id || null,
                modelName:
                    (item.event.model_id ? modelNameMap.get(String(item.event.model_id)) : null) ||
                    procNameMap.get(String(item.event.proc_def_id || key)) ||
                    item.event.proc_def_id ||
                    key,
                viewCount: item.count,
                uniqueViewers: item.viewers.size,
                lastSeen: item.lastSeen
            }))
            .sort((a, b) => b.viewCount - a.viewCount)
            .slice(0, topLimit);

        const userDays = new Map<string, Set<string>>();
        const userEvents = new Map<string, number>();
        const userEdits = new Map<string, number>();
        const userLastSeen = new Map<string, string>();
        const sessionDurations = new Map<string, { userKey: string; durationMs: number; lastSeen: string | null }>();

        currentEvents.forEach((event) => {
            const userKey = makeUserKey(event);
            incrementSet(userDays, userKey, dateKey(event.occurred_at));
            addNumber(userEvents, userKey, 1);
            if (editTypes.has(event.event_type)) addNumber(userEdits, userKey, 1);
            userLastSeen.set(userKey, maxDate(userLastSeen.get(userKey) || null, event.occurred_at));

            if (event.session_id) {
                const key = `${userKey}:${event.session_id}`;
                if (!sessionDurations.has(key)) sessionDurations.set(key, { userKey, durationMs: 0, lastSeen: null });
                const session = sessionDurations.get(key)!;
                session.durationMs += Number(event.active_duration_ms || 0);
                session.lastSeen = maxDate(session.lastSeen, event.occurred_at);
            }
        });

        function toUserRanking(userKey: string, value: number, extra: Partial<UserRankingMetric> = {}): UserRankingMetric {
            const user = userMap.get(userKey) || {};
            const team = resolveTeam(user);
            return {
                userKey,
                userName: userDisplayName({ ...user, user_id: userKey }),
                email: normalizeText(user.email),
                teamName: team.name,
                value,
                lastSeen: userLastSeen.get(userKey) || null,
                ...extra
            };
        }

        const frequentVisitors = Array.from(userDays.entries())
            .map(([userKey, days]) =>
                toUserRanking(userKey, days.size, {
                    activeDays: days.size,
                    eventCount: userEvents.get(userKey) || 0
                })
            )
            .sort((a, b) => (b.activeDays || 0) - (a.activeDays || 0) || (b.eventCount || 0) - (a.eventCount || 0))
            .slice(0, 5);

        const topEditors = Array.from(userEdits.entries())
            .map(([userKey, count]) => toUserRanking(userKey, count, { eventCount: count }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        const longestSessions = Array.from(sessionDurations.values())
            .map((session) =>
                toUserRanking(session.userKey, session.durationMs, {
                    durationMs: session.durationMs,
                    lastSeen: session.lastSeen
                })
            )
            .filter((item) => (item.durationMs || 0) > 0)
            .sort((a, b) => (b.durationMs || 0) - (a.durationMs || 0))
            .slice(0, 5);

        const totalActiveDurationMs = currentEvents.reduce((sum, event) => sum + Number(event.active_duration_ms || 0), 0);
        const totalModelEdits = currentEvents.filter((event) => editTypes.has(event.event_type)).length;
        const totalModelViews = currentEvents.filter((event) => event.event_type === 'model_view').length;

        return {
            generatedAt: now.toISOString(),
            period: {
                currentStart: currentStart.toISOString(),
                currentEnd: now.toISOString(),
                previousStart: previousStart.toISOString(),
                todayStart: todayStart.toISOString()
            },
            summary: {
                totalUsers: users.length,
                activeUsers: allActiveUsers.size,
                activationRate: users.length > 0 ? allActiveUsers.size / users.length : 0,
                totalEvents: currentEvents.length,
                totalActiveDurationMs,
                totalModelViews,
                totalModelEdits
            },
            teamActivity: teamActivity.sort((a, b) => b.activationRate - a.activationRate || b.activeUsers - a.activeUsers),
            dauWauRanking: [...teamActivity].sort((a, b) => b.wau - a.wau || b.dau - a.dau).slice(0, 5),
            modelTop,
            teamEditViewMix: [...teamActivity].sort((a, b) => b.modelViews + b.modelEdits - (a.modelViews + a.modelEdits)).slice(0, 10),
            heroes: {
                frequentVisitors,
                topEditors,
                longestSessions
            },
            retention: [...teamActivity].sort((a, b) => b.retentionRate - a.retentionRate || b.returningUsers - a.returningUsers),
            lastSeen: [...teamActivity].sort((a, b) => {
                const at = a.lastSeen ? new Date(a.lastSeen).getTime() : 0;
                const bt = b.lastSeen ? new Date(b.lastSeen).getTime() : 0;
                return bt - at;
            }),
            tableMissing: false
        };
    } catch (error: any) {
        return emptyDashboard(error?.message || 'Failed to load usage analytics.');
    }
}
