/**
 * 프로세스·의사결정 병합 요청을 실제로 병합한다.
 *
 * 스킬은 깃 PR 을 병합하면 끝이지만, 프로세스·의사결정은 깃이 아니라 `proc_def_version`
 * 스냅샷으로 관리된다 — 병합은 **이 요청이 가리키는 초안 스냅샷을 현재 정의로 올리고
 * 새 메이저 버전으로 굳히는 일**이다. 지금까지 이 일은 의사결정 버전 이력 화면에만 있어서,
 * 검토자는 승인만 여기서 하고 병합하러 다른 화면을 찾아가야 했다.
 */

import { t } from '@/composables/i18nText';

/** 프로세스·의사결정의 브랜치 이름은 `v4.0-abc` 처럼 버전 앞에 v 가 붙는다. */
function stripVersionPrefix(branch: string | null | undefined): string {
    return String(branch || '').replace(/^v/i, '');
}

/** 지금까지 나온 가장 큰 메이저 다음 번호. 초안(`4.0-h10y6`)도 앞자리로 센다. */
function nextMajorVersion(versions: any[]): string {
    const highest = versions.reduce((max, row) => {
        const major = parseInt(String(row?.version || '').split('.')[0], 10);
        return Number.isFinite(major) && major > max ? major : max;
    }, 0);
    return `${highest + 1}.0`;
}

export async function mergeDefinitionPr(backend: any, pr: any): Promise<string> {
    const defId = pr?.resource_id;
    if (!defId) throw new Error(t('mergeRequestBoard.error.noResource'));

    const rows = await backend.getDefinitionVersions(defId, { orderBy: 'timeStamp', sort: 'desc' });
    const versions: any[] = Array.isArray(rows) ? rows : [];
    const headVersion = stripVersionPrefix(pr.branch_name);
    const head = versions.find((row) => String(row.version) === headVersion);

    if (!head?.snapshot) {
        throw new Error(t('mergeRequestBoard.error.snapshotMissing'));
    }

    const version = nextMajorVersion(versions);
    await backend.putRawDefinition(head.snapshot, defId, {
        type: pr.resource_type === 'dmn' ? 'dmn' : 'bpmn',
        name: pr.resource_name,
        // 초안이 들고 있던 정의(JSON)도 같이 올려야 화면·엔진이 보는 정의가 스냅샷과 어긋나지 않는다.
        definition: head.definition,
        version,
        version_tag: 'major',
        arcv_id: `${defId}_${version}`,
        parent_version: headVersion,
        message: `[병합] ${pr.title || ''}`.trim()
    });

    return version;
}
