/**
 * 중앙 날짜/시간 유틸리티 — 모든 시각 표시를 KST(Asia/Seoul)로 강제한다.
 *
 * 왜 필요한가:
 *  - 브라우저 로컬 타임존에 의존하면 해외 브라우저에서 시각이 어긋난다.
 *  - DB의 `timestamp without time zone` 컬럼은 오프셋 없는 문자열로 내려오는데,
 *    `new Date(str)`는 이를 "브라우저 로컬"로 해석해 9시간 오차가 난다.
 *  - 이 유틸은 오프셋 없는 문자열을 KST 벽시계 시각으로, 오프셋/Z 가 있는 값은
 *    절대 시각으로 파싱한 뒤 항상 Asia/Seoul 로 출력한다.
 *
 * 표시(display)에는 이 유틸을 사용한다.
 * DB 저장용 절대시각 직렬화에는 기존 `new Date().toISOString()`(UTC instant)을 그대로 쓴다.
 */
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import relativeTime from 'dayjs/plugin/relativeTime';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import 'dayjs/locale/ko';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);
dayjs.extend(customParseFormat);
dayjs.extend(localizedFormat);
dayjs.tz.setDefault('Asia/Seoul');

export const KST = 'Asia/Seoul';

export type DateInput = string | number | Date | null | undefined;

/** 문자열에 타임존 지정자(Z 또는 ±HH:MM)가 있는지 */
function hasTzDesignator(value: string): boolean {
    return /([zZ])$|([+-]\d{2}:?\d{2})$/.test(value.trim());
}

/**
 * 임의의 날짜 입력을 KST 기준 dayjs 객체로 변환한다.
 *  - 오프셋 없는 문자열 → KST 벽시계 시각으로 해석
 *  - 오프셋/Z 있는 문자열, Date, number(epoch) → 절대 시각을 KST 로 환산
 */
export function toKst(value: DateInput): dayjs.Dayjs | null {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'string') {
        const d = hasTzDesignator(value) ? dayjs(value) : dayjs.tz(value, KST);
        return d.isValid() ? d.tz(KST) : null;
    }
    const d = dayjs(value);
    return d.isValid() ? d.tz(KST) : null;
}

/**
 * KST 기준으로 포맷한다. 잘못된/빈 값이면 fallback(기본 '') 반환.
 * @param pattern dayjs 포맷 토큰 (예: 'YYYY-MM-DD HH:mm:ss')
 */
export function formatKST(value: DateInput, pattern = 'YYYY-MM-DD HH:mm:ss', fallback = ''): string {
    const d = toKst(value);
    return d ? d.format(pattern) : fallback;
}

/** 날짜만: 'YYYY-MM-DD' */
export function formatDateKST(value: DateInput, fallback = ''): string {
    return formatKST(value, 'YYYY-MM-DD', fallback);
}

/** 날짜+분: 'YYYY-MM-DD HH:mm' */
export function formatDateTimeKST(value: DateInput, fallback = ''): string {
    return formatKST(value, 'YYYY-MM-DD HH:mm', fallback);
}

/** 시간만: 'HH:mm' */
export function formatTimeKST(value: DateInput, fallback = ''): string {
    return formatKST(value, 'HH:mm', fallback);
}

/** 상대시간: 'n분 전' (locale ko, KST 기준) */
export function fromNowKST(value: DateInput, fallback = ''): string {
    const d = toKst(value);
    return d ? d.locale('ko').fromNow() : fallback;
}

/** 현재 시각(KST) dayjs 객체 */
export function nowKST(): dayjs.Dayjs {
    return dayjs().tz(KST);
}

/** 오늘 날짜(KST) 'YYYY-MM-DD' — toISOString().slice(0,10) 의 KST 안전 대체 */
export function todayKST(): string {
    return nowKST().format('YYYY-MM-DD');
}

export default {
    KST,
    toKst,
    formatKST,
    formatDateKST,
    formatDateTimeKST,
    formatTimeKST,
    fromNowKST,
    nowKST,
    todayKST
};
