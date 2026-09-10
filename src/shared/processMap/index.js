/**
 * 프로세스 정의 체계도.
 *
 * 포털의 "정의 체계도" 와 같은 자료를 쓴다(configuration.proc_map).
 *   mega_proc_list  대분류 (예: 국민권익위원회)
 *     major_proc_list  중분류 (예: 민원)
 *       sub_proc_list    실제 프로세스 정의
 *
 * 화면은 웹과 앱이 다르지만(웹은 도표, 앱은 접히는 목록) **무엇이 어디에
 * 속하는가** 는 한 벌이어야 한다. 두 벌이면 앱에서만 빠지는 프로세스가 생긴다.
 */

/** 옛 자료는 이름 칸이 `label` 이다. 한쪽만 읽으면 이름이 비어 보인다. */
function nameOf(node) {
    return String(node?.name ?? node?.label ?? '').trim();
}

/**
 * 체계도를 평평한 그룹 목록으로 편다.
 *
 * 휴대폰에서는 3단 도표를 그릴 자리가 없다. 대신 "대분류 › 중분류" 를 한 줄
 * 제목으로 삼고 그 아래 프로세스를 늘어놓는다.
 *
 * @returns {Array<{key:string, title:string, items:Array<{id:string,name:string}>}>}
 */
export function toGroups(procMap) {
    const megas = Array.isArray(procMap?.mega_proc_list) ? procMap.mega_proc_list : [];
    const groups = [];

    for (const mega of megas) {
        const majors = Array.isArray(mega?.major_proc_list) ? mega.major_proc_list : [];
        for (const major of majors) {
            const subs = Array.isArray(major?.sub_proc_list) ? major.sub_proc_list : [];
            const items = subs
                .map((s) => ({ id: String(s?.id ?? '').trim(), name: nameOf(s) }))
                .filter((s) => s.id);

            // 빈 분류는 만들지 않는다. 눌러도 아무것도 없는 줄이 된다.
            if (!items.length) continue;

            const megaName = nameOf(mega);
            const majorName = nameOf(major);
            groups.push({
                key: `${mega?.id ?? megaName}::${major?.id ?? majorName}`,
                title: [megaName, majorName].filter(Boolean).join(' › ') || '분류 없음',
                items
            });
        }
    }
    return groups;
}

/**
 * 체계도에 들어 있지 않은 정의들.
 *
 * 체계도만 보여 주면 아직 분류되지 않은 프로세스는 앱에서 영영 시작할 수 없다.
 * 따로 모아 함께 보여 준다.
 */
export function ungrouped(procMap, definitions) {
    const known = new Set(toGroups(procMap).flatMap((g) => g.items.map((i) => i.id)));
    return (Array.isArray(definitions) ? definitions : [])
        .filter((d) => d?.id && !known.has(String(d.id)))
        .map((d) => ({ id: String(d.id), name: String(d.name || d.id) }));
}

/** 이름으로 걸러 낸다. 정의가 수백 개면 훑어서는 못 찾는다. */
export function filterGroups(groups, query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return groups;

    return groups
        .map((g) => ({
            ...g,
            // 이름 · 분류 · 식별자로 찾는다. 정의 id 만 아는 경우도 흔하다.
            items: g.items.filter(
                (i) =>
                    i.name.toLowerCase().includes(q) ||
                    String(i.id).toLowerCase().includes(q) ||
                    g.title.toLowerCase().includes(q)
            )
        }))
        .filter((g) => g.items.length);
}
