/**
 * Dashboard Data Service
 * 백엔드 /dashboard/* 엔드포인트에서 실 데이터를 가져온다.
 */
import axios from 'axios';

const http = axios.create();
const API = '/pi-system-backend/dashboard';

// ── 공통 ──

function domainParams(domains?: string[]): string {
    if (!domains || domains.length === 0) return '';
    return domains.map((d) => `domains=${encodeURIComponent(d)}`).join('&');
}

function buildUrl(path: string, domains?: string[]): string {
    const qs = domainParams(domains);
    return qs ? `${API}/${path}?${qs}` : `${API}/${path}`;
}

// ── View 1: Executive Summary ──

export interface ExecutiveSummaryData {
    overview: {
        total_count: number;
        published_count: number;
        draft_count: number;
        review_count: number;
        approved_count: number;
        target_count: number;
        progress_pct: number;
        target_pct: number;
    };
    kpi_divisions: Array<{
        division: string;
        target_count: number;
        draft_count: number;
        review_count: number;
        approved_count: number;
        published_count: number;
        completion_pct: number;
        rag: 'G' | 'A' | 'R';
    }>;
    funnel: Array<{ stage: string; cnt: number }>;
    velocity: Array<{ week_label: string; actual: number; target: number }>;
    churn: Array<{
        proc_def_id: string;
        proc_def_name: string;
        domain: string;
        total_churn: number;
        approved_to_review: number;
        review_to_draft: number;
        current_state: string;
        last_revert: string | null;
        history: Array<{ from: string; to: string; dir: string }> | null;
    }>;
}

export async function fetchExecutiveSummary(domains?: string[]): Promise<ExecutiveSummaryData> {
    const { data } = await http.get(buildUrl('executive-summary', domains));
    return data;
}

// ── View 2: Process Analytics ──

export interface ProcessAnalyticsData {
    system_map: Array<{
        system_id?: string | null;
        tool_name: string;
        system_type?: string | null;
        category?: string | null;
        task_count: number;
        process_count: number;
        connected_processes?: Array<{ proc_def_id: string; proc_def_name: string; domain: string }>;
    }>;
    heatmap: Array<{ role_name: string; domain: string; task_count: number }>;
    task_types: Array<{ task_type: string; total_count: number }>;
    task_ratio: Array<{
        proc_def_id?: string;
        name: string;
        domain: string;
        tasks: Record<string, number>;
        automation_pct?: number;
    }>;
    top_n: {
        handoff: Array<{ process: string; proc_def_id?: string; count: number; domain: string }>;
        xor: Array<{ process: string; proc_def_id?: string; count: number; domain: string }>;
        manual: Array<{ process: string; proc_def_id?: string; count: number; domain: string }>;
        decision: Array<{ process: string; proc_def_id?: string; count: number; domain: string }>;
        loop: Array<{ process: string; proc_def_id?: string; count: number; domain: string }>;
    };
    automation_score?: {
        overall: number;
        auto_count: number;
        total_count: number;
        by_domain: Array<{ domain: string; automation_pct: number; auto_count: number; total_count: number }>;
    };
    project_map?: Array<{
        project_name: string;
        task_count: number;
        process_count: number;
        connected_processes?: Array<{ proc_def_id: string; proc_def_name: string; domain: string }>;
    }>;
}

export async function fetchProcessAnalytics(domains?: string[]): Promise<ProcessAnalyticsData> {
    const { data } = await http.get(buildUrl('process-analytics', domains));
    return data;
}

// ── View 3: Governance & Quality ──

export interface GovernanceQualityData {
    asset_status: Array<{
        domain: string;
        active_count: number;
        draft_count: number;
        deprecated_count: number;
        total_count: number;
    }>;
    version_top: Array<{ proc_def_name: string; change_count: number }>;
    dq_scores: Array<{
        field_key: string;
        label: string;
        score: number;
        trend: 'up' | 'down' | 'flat';
    }>;
    grammar_errors: Array<{
        proc_def_name: string;
        error_count: number;
        primary_error_type: string;
        last_checked_at: string;
        status: string;
    }>;
}

export async function fetchGovernanceQuality(domains?: string[]): Promise<GovernanceQualityData> {
    const { data } = await http.get(buildUrl('governance-quality', domains));
    return data;
}
