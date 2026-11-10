/**
 * 인스턴스 목록 표시용 순수 함수 — 사이드바 정렬과 날짜 빈칸 판정.
 *
 * - 사이드바 「인스턴스」는 가장 최근에 바뀐 것이 맨 위다(updated_at 내림차순).
 *   updated_at 이 비어 있으면 start_date 로 대신한다. 둘 다 없으면 맨 아래.
 *   서버 정렬(PostgreSQL DESC)은 NULL 을 맨 앞에 두므로, 날짜가 빈 오래된 인스턴스가
 *   방금 시작한 인스턴스 위로 올라왔다. 그래서 받은 뒤 여기서 다시 정렬한다.
 * - 삭제된 인스턴스는 맨 아래, 그 안에서는 삭제일 내림차순(기존 동작).
 * - 날짜가 null·0·빈 문자열이면 new Date(null) 이 1970-01-01 09:00(KST)로 보이므로 빈칸으로 본다.
 *
 * 오프셋 없는 문자열(timestamp without time zone 컬럼)은 KST 벽시계 시각으로 읽는다
 * (src/utils/datetime.ts 와 같은 규칙).
 */

const TZ_DESIGNATOR = /([zZ])$|([+-]\d{2}:?\d{2})$/;

/** 날짜 값을 epoch ms 로. 비었거나 읽을 수 없거나 1970-01-01 이전·당일 0시(=0)면 NaN. */
export function toEpochMs(value) {
    if (value === null || value === undefined || value === '') return NaN;
    let ms;
    if (value instanceof Date) {
        ms = value.getTime();
    } else if (typeof value === 'number') {
        ms = value;
    } else if (typeof value === 'string') {
        const s = value.trim();
        if (!s || s === '0') return NaN;
        // 'YYYY-MM-DD HH:mm:ss' 도 받는다. 오프셋이 없으면 KST 로 본다.
        const iso = s.includes('T') ? s : s.replace(' ', 'T');
        ms = Date.parse(TZ_DESIGNATOR.test(iso) || !/T\d/.test(iso) ? iso : `${iso}+09:00`);
    } else {
        return NaN;
    }
    return Number.isFinite(ms) && ms > 0 ? ms : NaN;
}

/** 표시할 날짜가 없는가(null·undefined·''·0·읽을 수 없는 값·epoch 0). */
export function isMissingDate(value) {
    return Number.isNaN(toEpochMs(value));
}

/** 사이드바 정렬 기준 시각: updated_at, 없으면 start_date. */
export function lastActivityMs(item) {
    const updated = toEpochMs(item?.updatedAt);
    return Number.isNaN(updated) ? toEpochMs(item?.startDate) : updated;
}

/** 사이드바 인스턴스 비교 — 삭제 안 된 것 먼저, 최근에 바뀐 것 먼저. */
export function compareSidebarInstances(a, b) {
    const aDeleted = Boolean(a?.isDeleted);
    const bDeleted = Boolean(b?.isDeleted);
    if (aDeleted !== bDeleted) return aDeleted ? 1 : -1;

    const [x, y] = aDeleted ? [toEpochMs(a?.deletedAt), toEpochMs(b?.deletedAt)] : [lastActivityMs(a), lastActivityMs(b)];
    const xMissing = Number.isNaN(x);
    const yMissing = Number.isNaN(y);
    if (xMissing && yMissing) return 0;
    if (xMissing) return 1; // 시각을 모르면 아래로
    if (yMissing) return -1;
    return y - x;
}

/** 새 배열로 정렬해 돌려준다(같은 시각이면 받은 순서 유지 — Array.prototype.sort 는 안정 정렬). */
export function sortSidebarInstances(items) {
    return [...(items || [])].sort(compareSidebarInstances);
}
