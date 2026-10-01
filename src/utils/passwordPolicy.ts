/**
 * 비밀번호 정책 공용 유틸 (docs/security.md 2-2, 항목 21)
 *
 * 서버(GoTrue)에 설정된 값과 동일한 규칙을 클라이언트에서도 검증한다.
 *   GOTRUE_PASSWORD_MIN_LENGTH="10"
 *   GOTRUE_PASSWORD_REQUIRED_CHARACTERS="<소문자>:<대문자>:<숫자>:<특수문자>"
 *   GOTRUE_PASSWORD_HIBP_ENABLED="true"
 *
 * 정책을 바꿀 때는 반드시 GoTrue 설정(docker-compose/docker-compose.yaml,
 * kubernetes/supabase-deployment.yaml, docs/security-gotrue-password-policy.md)도 함께 수정한다.
 */

/** 최소 길이. GOTRUE_PASSWORD_MIN_LENGTH와 동일해야 한다. */
export const PASSWORD_MIN_LENGTH = 10;

/** GOTRUE_PASSWORD_REQUIRED_CHARACTERS의 특수문자 집합과 동일하다. */
export const PASSWORD_SPECIAL_CHARACTERS = '!@#$%^&*()_+-=[]{};\'\\":|<>?,./`~';

const LOWERCASE_PATTERN = /[a-z]/;
const UPPERCASE_PATTERN = /[A-Z]/;
const DIGIT_PATTERN = /[0-9]/;
const SPECIAL_PATTERN = /[!@#$%^&*()_+\-=[\]{};':"\\|<>?,./`~]/;

export type PasswordRuleKey = 'minLength' | 'lowercase' | 'uppercase' | 'digit' | 'special';

export const PASSWORD_RULE_KEYS: PasswordRuleKey[] = ['minLength', 'lowercase', 'uppercase', 'digit', 'special'];

/** i18n 미주입 환경(하드코딩 한국어 화면)에서 사용할 기본 문구. */
const FALLBACK_MESSAGES: Record<string, string> = {
    'passwordPolicy.required': '비밀번호를 입력하세요',
    'passwordPolicy.mismatch': '비밀번호가 일치하지 않습니다',
    'passwordPolicy.hint': '비밀번호는 10자 이상이며 영문 대문자·소문자·숫자·특수문자를 각각 1자 이상 포함해야 합니다.',
    'passwordPolicy.unmet': '비밀번호 조건이 부족합니다: {items}',
    'passwordPolicy.ruleMinLength': '10자 이상',
    'passwordPolicy.ruleLowercase': '영문 소문자 1자 이상',
    'passwordPolicy.ruleUppercase': '영문 대문자 1자 이상',
    'passwordPolicy.ruleDigit': '숫자 1자 이상',
    'passwordPolicy.ruleSpecial': '특수문자 1자 이상',
    'passwordPolicy.serverRejected':
        '비밀번호가 보안 정책에 맞지 않습니다. 10자 이상이며 영문 대문자·소문자·숫자·특수문자를 각각 1자 이상 포함해야 합니다.',
    'passwordPolicy.serverLeaked': '유출 이력이 있는 비밀번호는 사용할 수 없습니다. 다른 비밀번호를 입력해주세요.',
    'passwordPolicy.serverSameAsOld': '새 비밀번호는 이전 비밀번호와 다르게 설정해주세요.'
};

/** vue-i18n의 `$t`와 호환되는 번역 함수 타입. 미전달 시 한국어 기본 문구를 사용한다. */
export type Translator = ((key: string, named?: Record<string, unknown>) => string) | undefined | null;

const RULE_MESSAGE_KEYS: Record<PasswordRuleKey, string> = {
    minLength: 'passwordPolicy.ruleMinLength',
    lowercase: 'passwordPolicy.ruleLowercase',
    uppercase: 'passwordPolicy.ruleUppercase',
    digit: 'passwordPolicy.ruleDigit',
    special: 'passwordPolicy.ruleSpecial'
};

function interpolate(template: string, named?: Record<string, unknown>): string {
    if (!named) return template;
    return template.replace(/\{(\w+)\}/g, (match, name) => (name in named ? String(named[name]) : match));
}

function translate(t: Translator, key: string, named?: Record<string, unknown>): string {
    if (typeof t === 'function') {
        try {
            const translated = t(key, named);
            // 키가 없으면 vue-i18n은 키 문자열을 그대로 돌려준다.
            if (translated && translated !== key) return translated;
        } catch (e) {
            // i18n이 준비되지 않은 컨텍스트에서는 기본 문구로 대체한다.
        }
    }
    return interpolate(FALLBACK_MESSAGES[key] ?? key, named);
}

/** 충족하지 못한 규칙 목록을 반환한다. 빈 배열이면 정책을 만족한다. */
export function getPasswordViolations(password: string): PasswordRuleKey[] {
    const value = password || '';
    const violations: PasswordRuleKey[] = [];
    if (value.length < PASSWORD_MIN_LENGTH) violations.push('minLength');
    if (!LOWERCASE_PATTERN.test(value)) violations.push('lowercase');
    if (!UPPERCASE_PATTERN.test(value)) violations.push('uppercase');
    if (!DIGIT_PATTERN.test(value)) violations.push('digit');
    if (!SPECIAL_PATTERN.test(value)) violations.push('special');
    return violations;
}

/** 정책 충족 여부. */
export function isPasswordValid(password: string): boolean {
    return getPasswordViolations(password).length === 0;
}

/** 입력창 하단에 상시 노출할 정책 안내 문구. */
export function getPasswordPolicyHint(t?: Translator): string {
    return translate(t, 'passwordPolicy.hint', { min: PASSWORD_MIN_LENGTH });
}

/** 부족한 조건만 나열한 안내 문구. 정책을 만족하면 빈 문자열. */
export function getPasswordViolationMessage(password: string, t?: Translator): string {
    const violations = getPasswordViolations(password);
    if (violations.length === 0) return '';
    const items = violations.map((key) => translate(t, RULE_MESSAGE_KEYS[key], { min: PASSWORD_MIN_LENGTH })).join(', ');
    return translate(t, 'passwordPolicy.unmet', { items });
}

/**
 * Vuetify `:rules` 용 검증 함수 배열.
 * 미충족 시 어떤 조건이 부족한지 문구로 알려준다.
 */
export function createPasswordRules(t?: Translator): Array<(v: string) => true | string> {
    return [(v: string) => !!v || translate(t, 'passwordPolicy.required'), (v: string) => getPasswordViolationMessage(v, t) || true];
}

/** 비밀번호 확인 입력창용 검증 함수 배열. */
export function createConfirmPasswordRules(getPassword: () => string, t?: Translator): Array<(v: string) => true | string> {
    return [
        (v: string) => !!v || translate(t, 'passwordPolicy.required'),
        (v: string) => v === getPassword() || translate(t, 'passwordPolicy.mismatch')
    ];
}

/**
 * GoTrue가 돌려준 비밀번호 관련 오류 메시지를 사용자 문구로 변환한다.
 * 비밀번호 정책과 무관한 오류면 null을 반환하므로 호출부에서 기존 처리를 이어가면 된다.
 */
export function mapPasswordServerError(rawMessage: unknown, t?: Translator): string | null {
    if (!rawMessage) return null;
    const message = String(rawMessage).toLowerCase();

    // HIBP(유출 비밀번호) 차단
    if (message.includes('known to be weak') || message.includes('pwned') || message.includes('data breach')) {
        return translate(t, 'passwordPolicy.serverLeaked');
    }
    // 기존 비밀번호와 동일
    if (message.includes('different from the old password') || message.includes('same_password')) {
        return translate(t, 'passwordPolicy.serverSameAsOld');
    }
    // 길이/구성 문자 미충족
    if (
        message.includes('weak_password') ||
        message.includes('password should be at least') ||
        message.includes('password should contain at least') ||
        message.includes('password is too short') ||
        message.includes('password does not meet')
    ) {
        return translate(t, 'passwordPolicy.serverRejected', { min: PASSWORD_MIN_LENGTH });
    }
    return null;
}
