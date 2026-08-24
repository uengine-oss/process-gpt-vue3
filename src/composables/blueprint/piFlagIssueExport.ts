/**
 * PI Flag → 이슈 트래커(GitLab/Jira) 등록용 JSON 직렬화.
 *
 * GitLab Issue API / Jira Issue 양쪽에서 공통으로 쓰기 좋은 중립 구조를 만든다.
 * title + (markdown) description + labels 를 기본으로, 원본 메타는 fields 에 보존한다.
 */

export interface PiFlagIssueInput {
    domainName?: string;
    procDefName?: string;
    procDefId?: string;
    elementId?: string;
    elementName?: string;
    elementNames?: string[];
    status?: string; // open | resolved
    type?: string;
    category?: string;
    title?: string;
    problem?: string;
    improvement?: string;
    description?: string;
    authorName?: string;
    createdAt?: string;
}

export interface IssueExport {
    title: string;
    description: string;
    labels: string[];
    fields: Record<string, any>;
}

function statusLabel(status?: string): string {
    return status === 'resolved' ? '즉시개선' : '향후과제';
}

function buildLabels(f: PiFlagIssueInput): string[] {
    const labels = ['PI-Flag'];
    const cat = (f.category || f.type || '').trim();
    if (cat) labels.push(cat);
    labels.push(statusLabel(f.status));
    return Array.from(new Set(labels));
}

function buildDescription(f: PiFlagIssueInput): string {
    const problem = (f.problem || f.description || '').trim();
    const improvement = (f.improvement || '').trim();
    const names = (f.elementNames && f.elementNames.length ? f.elementNames.join(', ') : f.elementName || '').trim();
    const lines: string[] = [];
    if (f.procDefName) lines.push(`**프로세스**: ${f.procDefName}`);
    if (names) lines.push(`**대상 요소**: ${names}`);
    else lines.push('**대상 요소**: (프로세스 전반)');
    lines.push('');
    lines.push('### 문제점');
    lines.push(problem || '-');
    lines.push('');
    lines.push('### 개선방향');
    lines.push(improvement || '-');
    return lines.join('\n');
}

/** PI Flag 1건을 이슈 1건으로 변환. */
export function piFlagToIssue(f: PiFlagIssueInput): IssueExport {
    const title = (f.title || f.problem || f.description || '개선 이슈').trim().slice(0, 200);
    return {
        title,
        description: buildDescription(f),
        labels: buildLabels(f),
        fields: {
            domain: f.domainName || '',
            process: f.procDefName || '',
            procDefId: f.procDefId || '',
            elementId: f.elementId || '',
            element: f.elementNames && f.elementNames.length ? f.elementNames : f.elementName || '',
            category: f.category || f.type || '',
            status: f.status || 'open',
            author: f.authorName || '',
            createdAt: f.createdAt || ''
        }
    };
}

/** PI Flag 배열을 이슈 트래커 등록용 JSON 페이로드로 변환. */
export function piFlagsToIssueExport(flags: PiFlagIssueInput[]): { generatedAt: string; count: number; issues: IssueExport[] } {
    const issues = (flags || []).map(piFlagToIssue);
    return {
        generatedAt: new Date().toISOString(),
        count: issues.length,
        issues
    };
}

/** 브라우저에서 JSON 파일 다운로드. */
export function downloadIssueJson(flags: PiFlagIssueInput[], filenamePrefix = 'pi_flag_issues'): void {
    const payload = piFlagsToIssueExport(flags);
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    a.href = url;
    a.download = `${filenamePrefix}_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
