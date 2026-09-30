/**
 * 개인정보 마스킹 (보안 확인표 항목 6 / docs/security.md 4-1)
 *
 * 진짜 마스킹은 DB 쪽 `public.users_masked` 같은 `security_invoker` 뷰가 한다
 * (`supabase/migrations/20260911_pii_masking.sql`). 클라이언트에서 가리는 것은
 * 통제가 아니라 화장이기 때문이다.
 *
 * 이 파일이 필요한 이유는 두 가지뿐이다.
 *
 *   1. 조직도 트리는 이메일을 `configuration` JSON 안에 **복사해 저장**한다
 *      (`orgChartModel.createMemberNode`). 이 값은 뷰를 거치지 않으므로 표시
 *      직전에 한 번 더 가려야 한다.
 *   2. 마스킹된 값이 다시 DB 로 저장되는 것을 막아야 한다. `organizationUtils`
 *      가 조직도 JSON 의 email 로 권한·공개범위를 매칭하기 때문에, `ab***@x.com`
 *      이 저장되면 그 사람이 조용히 팀에서 빠진다. `isMaskedEmail()` 은 그
 *      방어용이다.
 *
 * DB 함수(`public.mask_email` / `public.mask_phone`)와 규칙을 맞춰 둔다.
 */

const MASK_MARK = '***';

/** `ab***@domain.com` — 도메인은 남기고 로컬파트만 가린다. */
export function maskEmail(value: unknown): string {
    if (value === null || value === undefined) return '';
    const raw = String(value);
    if (!raw.trim()) return raw;

    const at = raw.indexOf('@');
    const local = at >= 0 ? raw.slice(0, at) : raw;
    const domain = at >= 0 ? raw.slice(at) : '';

    if (local.length >= 3) return `${local.slice(0, 2)}${MASK_MARK}${domain}`;
    if (local.length === 2) return `${local.slice(0, 1)}${MASK_MARK}${domain}`;
    return `${MASK_MARK}${domain}`;
}

/** `010-****-1234` — 하이픈 유무·+82 국가번호·02 지역번호를 모두 받는다. */
export function maskPhone(value: unknown): string {
    if (value === null || value === undefined) return '';
    const raw = String(value);
    if (!raw.trim()) return raw;

    let digits = raw.replace(/[^0-9]/g, '');
    if (raw.trim().startsWith('+') && digits.startsWith('82')) {
        digits = `0${digits.slice(2)}`;
    }
    if (digits.length < 7) return '****';

    const prefix = digits.startsWith('02') ? digits.slice(0, 2) : digits.slice(0, 3);
    return `${prefix}-****-${digits.slice(-4)}`;
}

/**
 * 이미 마스킹된 값인지. DB 뷰에서 내려온 값을 다시 저장하지 않으려고 쓴다.
 * 로컬파트가 `***` 로 끝나는 형태만 마스킹으로 본다 — 실제 이메일 주소에는
 * `*` 를 쓸 수 없으므로(RFC 5322 인용 문자열을 제외하면) 오탐 여지가 거의 없다.
 */
export function isMaskedEmail(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    const raw = String(value);
    const at = raw.indexOf('@');
    const local = at >= 0 ? raw.slice(0, at) : raw;
    return local.endsWith(MASK_MARK);
}
