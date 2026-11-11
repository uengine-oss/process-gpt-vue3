<template>
    <div class="m-screen">
        <header class="m-head"><h1>나</h1></header>
        <div class="m-body me">
            <div class="m-card m-card--lg profile">
                <span class="profile__avatar" aria-hidden="true">{{ initial }}</span>
                <span class="profile__body">
                    <strong>{{ name || email || '—' }}</strong>
                    <span class="m-muted">{{ [roleText, email].filter(Boolean).join(' · ') }}</span>
                    <span v-if="tenant" class="m-muted">조직 {{ tenant }}</span>
                </span>
            </div>

            <nav class="m-card m-card--lg menu" aria-label="내 일">
                <RouterLink class="menu__row" to="/progress?view=mine">
                    <Icon name="progress" /><span class="menu__label">내가 올린 요청</span>
                    <span v-if="counts" class="menu__value">{{ counts.requests }}</span><Icon name="chevron-right" class="menu__go" />
                </RouterLink>
                <RouterLink class="menu__row" to="/tasks?view=delegated">
                    <Icon name="robot" /><span class="menu__label">에이전트에 맡긴 일</span>
                    <span v-if="counts" class="menu__value">{{ counts.delegated }}</span><Icon name="chevron-right" class="menu__go" />
                </RouterLink>
                <RouterLink class="menu__row" to="/progress?view=done">
                    <Icon name="file" /><span class="menu__label">끝난 일</span>
                    <span v-if="counts" class="menu__value">{{ counts.done }}</span><Icon name="chevron-right" class="menu__go" />
                </RouterLink>
            </nav>

            <div class="m-card m-card--lg menu">
                <div class="menu__row">
                    <Icon name="bell" />
                    <span class="menu__label menu__label--stack">
                        휴대폰 알림
                        <span class="m-muted">{{ pushHint }}</span>
                    </span>
                    <label class="switch" :class="{ 'switch--off': !onPhone }">
                        <input type="checkbox" :checked="pushOn" :disabled="!onPhone || pushBusy" aria-label="휴대폰 알림" @change="togglePush" />
                        <span class="switch__track"><span class="switch__knob"></span></span>
                    </label>
                </div>
                <button type="button" class="menu__row" @click="sheet = 'lang'">
                    <Icon name="globe" /><span class="menu__label">언어</span>
                    <span class="menu__value">{{ locale === 'en' ? 'English' : '한국어' }}</span>
                </button>
                <button type="button" class="menu__row" @click="sheet = 'theme'">
                    <Icon name="brightness" /><span class="menu__label">화면 밝기</span>
                    <span class="menu__value">{{ APPEARANCE_LABELS[appearance]?.label }}</span>
                </button>
                <button v-if="!onPhone" type="button" class="menu__row" @click="toDesktop">
                    <Icon name="monitor" /><span class="menu__label">PC 화면으로 보기</span>
                    <Icon name="chevron-right" class="menu__go" />
                </button>
                <button type="button" class="menu__row menu__row--danger" @click="leave">
                    <Icon name="logout" /><span class="menu__label">로그아웃</span>
                </button>
            </div>

            <p class="m-note info">
                <Icon name="info" :size="20" />
                <span>프로세스 설계 · 조직도 · 관리 설정 · 분석은 PC에서 쓸 수 있습니다. 휴대폰에서는 메뉴에 나오지 않습니다.</span>
            </p>
        </div>

        <div v-if="sheet" class="sheet" @click.self="sheet = ''">
            <div class="sheet__panel" role="dialog" :aria-label="sheet === 'lang' ? '언어' : '화면 밝기'">
                <h2 class="sheet__title">{{ sheet === 'lang' ? '언어' : '화면 밝기' }}</h2>
                <template v-if="sheet === 'lang'">
                    <button
                        v-for="opt in LOCALES"
                        :key="opt.value"
                        type="button"
                        class="sheet__item"
                        :class="{ 'sheet__item--on': locale === opt.value }"
                        @click="chooseLocale(opt.value)"
                    >
                        <strong>{{ opt.label }}</strong>
                    </button>
                    <p class="m-muted">휴대폰 화면은 지금 한국어로만 나옵니다. 고른 언어는 PC 화면에 씁니다.</p>
                </template>
                <template v-else>
                    <button
                        v-for="opt in APPEARANCES"
                        :key="opt"
                        type="button"
                        class="sheet__item"
                        :class="{ 'sheet__item--on': appearance === opt }"
                        @click="chooseTheme(opt)"
                    >
                        <strong>{{ APPEARANCE_LABELS[opt].label }}</strong>
                    </button>
                </template>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';

import Icon from '../components/Icon.vue';
import { loadHome, loadProgress } from '../lib/data.js';
import { homeModel, startedBy } from '../lib/workspace.js';

import { APPEARANCES, APPEARANCE_LABELS, apply, saved } from '../lib/appearance.js';
import { enablePush, isNativeApp, isRegistered, unregisterDevice } from '../lib/push.js';
import { currentSession, signOut } from '../lib/session.js';

const router = useRouter();
const email = ref('');
const tenant = ref<string | null>(null);

const appearance = ref(saved());
const name = ref('');
const role = ref('');
const sheet = ref<'' | 'lang' | 'theme'>('');
const counts = ref<{ requests: number; delegated: number; done: number } | null>(null);
const LOCALES = [
    { value: 'ko', label: '한국어' },
    { value: 'en', label: 'English' }
];
const locale = ref(readLocale());
// 'user' · 'admin' 같은 내부 값은 보이지 않는다(사람이 붙인 이름만)
const roleText = computed(() => (/^[a-z_-]+$/i.test(role.value) ? '' : role.value));
const initial = computed(() => (name.value || email.value || '?').trim().charAt(0).toUpperCase());

function readLocale() {
    try {
        return localStorage.getItem('locale') || 'ko';
    } catch (_e) {
        return 'ko';
    }
}

/** 포털과 같은 저장 칸(locale)에 둔다 — 같은 주소라 PC 화면이 이 값을 읽는다. */
function chooseLocale(value: string) {
    try {
        localStorage.setItem('locale', value);
    } catch (_e) {
        // 저장을 막은 브라우저
    }
    locale.value = value;
    sheet.value = '';
}

/**
 * PC 화면으로 — 이 기기에서 「데스크톱 화면」을 고른 것으로 남기고 포털 첫 화면을 연다.
 * 포털(index.html)이 그 값을 읽어 1280px 데스크톱 화면으로 그린다. 다시 휴대폰 화면으로 오려면
 * PC 화면의 설정 › 테마 설정 「휴대폰 화면」에서 라이트를 고른다.
 */
function toDesktop() {
    try {
        localStorage.setItem('mobileView', 'desktop');
    } catch (_e) {
        // 저장을 막은 브라우저 — 포털이 다시 물어본다
    }
    window.location.assign('/definition-map');
}

async function loadCounts() {
    try {
        const uid = localStorage.getItem('uid') || '';
        const supabase = (window as any).$supabase;
        const tenant = (window as any).$tenantName || null;
        const [home, progress] = await Promise.all([loadHome(supabase, { uid, tenant }), loadProgress(supabase, { uid, tenant })]);
        if (!home || !progress) return;
        const m = homeModel({ ...home, uid });
        // 「내가 올린 요청」은 누르면 가는 진행 › 내가 올린 과 같은 수
        const mine = progress.instances.filter(
            (i: any) =>
                String(i.status || '').toUpperCase() === 'RUNNING' &&
                startedBy(progress.instRows.filter((r: any) => r.proc_inst_id === i.proc_inst_id), uid)
        );
        // 「끝난 일」은 누르면 가는 진행 › 끝난 건 과 같은 수
        const done = progress.instances.filter((i: any) => String(i.status || '').toUpperCase() !== 'RUNNING');
        counts.value = { requests: mine.length, delegated: m.delegated.length, done: done.length };
    } catch (e) {
        console.warn('[me] 수 세기 실패', e);
    }
}
const onPhone = ref(false);
const pushOn = ref(false);
const pushBusy = ref(false);
const pushHint = ref('');

let session: any = null;

onMounted(async () => {
    session = await currentSession();
    email.value = session?.user?.email || '';
    name.value = localStorage.getItem('userName') || '';
    role.value = localStorage.getItem('role') || '';
    void loadCounts();
    tenant.value = (window as any).$tenantName || null;

    onPhone.value = isNativeApp();
    if (!onPhone.value) {
        // 브라우저에서는 기기 토큰을 얻을 수 없다. 버튼을 눌러도 안 되는 것을
        // 보여 주는 대신, 왜 없는지 말한다.
        pushHint.value = '앱으로 설치하면 알림을 받을 수 있습니다.';
        return;
    }

    pushOn.value = await isRegistered({ supabase: (window as any).$supabase, session });
    pushHint.value = pushOn.value
        ? '승인 요청과 새 업무를 이 기기로 알려 드립니다.'
        : '켜면 승인 요청과 새 업무를 알려 드립니다.';
});

function chooseTheme(next: string) {
    appearance.value = apply(next);
    sheet.value = '';
}

async function togglePush() {
    pushBusy.value = true;
    try {
        const supabase = (window as any).$supabase;

        if (pushOn.value) {
            const result = await unregisterDevice({ supabase, session });
            if (result.ok) {
                pushOn.value = false;
                pushHint.value = '켜면 승인 요청과 새 업무를 알려 드립니다.';
            } else {
                pushHint.value = '알림을 끄지 못했습니다. 다시 시도해 주세요.';
            }
            return;
        }

        const result = await enablePush({ supabase, session });
        if (result.ok) {
            pushOn.value = true;
            pushHint.value = '승인 요청과 새 업무를 이 기기로 알려 드립니다.';
            return;
        }
        pushHint.value = reasonText(result.reason);
    } finally {
        pushBusy.value = false;
    }
}

/** 왜 안 됐는지 사용자가 할 수 있는 일로 바꿔 말한다. */
function reasonText(reason?: string) {
    if (reason === 'denied') return '기기 설정에서 알림을 허용해 주세요.';
    if (reason === 'no-token') return '기기 등록에 시간이 너무 걸렸습니다. 다시 시도해 주세요.';
    if (reason === 'plugin-missing') return '이 버전에서는 알림을 지원하지 않습니다.';
    if (reason === 'not-configured') return '이 빌드에는 알림 설정이 들어 있지 않습니다. 운영 빌드에서 사용할 수 있습니다.';
    if (reason === 'not-an-app') return '앱으로 설치하면 알림을 받을 수 있습니다.';
    return '알림을 켜지 못했습니다. 다시 시도해 주세요.';
}

async function leave() {
    // 로그아웃하면서 알림도 끈다. 안 그러면 다음 사람이 이 폰으로 내 알림을 받는다.
    try {
        await unregisterDevice({ supabase: (window as any).$supabase, session });
    } catch (_e) {
        // 못 껐다고 로그아웃을 막지는 않는다.
    }
    await signOut();
    await router.replace('/login');
}
</script>

<style scoped>
.me {
    padding: 4px 16px 20px;
}

.profile {
    flex-direction: row;
    align-items: center;
    gap: 16px;
}

.profile__avatar {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--brand-wash);
    color: var(--brand);
    display: grid;
    place-items: center;
    font-size: 1.4rem;
    font-weight: 800;
    flex: none;
}

.profile__body {
    display: flex;
    flex-direction: column;
    min-width: 0;
}

.profile__body strong {
    font-size: 1.2rem;
}

.menu {
    padding: 0;
    gap: 0;
    overflow: hidden;
}

.menu__row {
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 54px;
    padding: 0 16px;
    border-bottom: 1px solid var(--rule);
    color: var(--ink);
    width: 100%;
    text-align: left;
}

.menu__row:last-child {
    border-bottom: none;
}

.menu__row > .icon:first-child {
    color: var(--ink-soft);
}

.menu__label {
    flex: 1;
    font-size: 1rem;
}

.menu__value {
    color: var(--ink-faint);
}

.menu__go {
    color: var(--ink-faint);
}

.menu__row--danger,
.menu__row--danger > .icon:first-child {
    color: var(--danger);
}

.menu__label--stack {
    display: flex;
    flex-direction: column;
    padding: 10px 0;
    line-height: 1.35;
}

.menu__label--stack .m-muted {
    font-size: 0.8rem;
}

.switch input {
    position: absolute;
    opacity: 0;
    width: 1px;
    height: 1px;
}

.switch__track {
    display: block;
    width: 50px;
    height: 30px;
    border-radius: 15px;
    background: var(--rule);
    position: relative;
    transition: background 0.15s ease;
}

.switch__knob {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    transition: transform 0.15s ease;
}

.switch input:checked + .switch__track {
    background: var(--ok);
}

.switch input:checked + .switch__track .switch__knob {
    transform: translateX(20px);
}

.switch--off {
    opacity: 0.6;
}

.info {
    display: flex;
    gap: 10px;
    align-items: flex-start;
}
</style>
