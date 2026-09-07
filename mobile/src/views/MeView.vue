<template>
    <div class="m-screen">
        <header class="m-appbar"><h1>내 정보</h1></header>

        <div class="m-body">
            <div class="m-card">
                <span class="m-muted">계정</span>
                <strong>{{ email || '—' }}</strong>
            </div>

            <div class="m-card">
                <span class="m-muted">소속 조직</span>
                <strong>{{ tenant || '확인되지 않음' }}</strong>
                <p v-if="!tenant" class="m-muted">
                    조직을 확인하지 못했습니다. 이 상태에서는 목록이 비어 보입니다.
                </p>
            </div>

            <!-- 색상 테마. 포털 "테마 설정" 과 같은 세 장이다. -->
            <div class="m-card">
                <span class="m-muted">색상 테마</span>
                <div class="themes">
                    <button
                        v-for="opt in APPEARANCES"
                        :key="opt"
                        type="button"
                        class="theme"
                        :class="{ 'theme--on': appearance === opt }"
                        @click="chooseTheme(opt)"
                    >
                        <span class="theme__swatch" :style="{ background: APPEARANCE_LABELS[opt].swatch }">
                            <span class="theme__dot" :style="{ background: APPEARANCE_LABELS[opt].dot }" />
                        </span>
                        <span>{{ APPEARANCE_LABELS[opt].label }}</span>
                    </button>
                </div>
                <p class="m-muted">
                    웹에서 고른 테마는 그 브라우저에만 저장되어 앱이 읽지 못합니다. 여기서 고른 값은 이 기기에 남습니다.
                </p>
            </div>

            <!-- 알림 -->
            <div class="m-card">
                <span class="m-muted">알림</span>
                <strong>{{ pushOn ? '켜짐' : '꺼짐' }}</strong>
                <p class="m-muted">{{ pushHint }}</p>

                <button
                    v-if="onPhone"
                    class="m-btn"
                    type="button"
                    :disabled="pushBusy"
                    @click="togglePush"
                >
                    {{ pushBusy ? '처리 중…' : pushOn ? '알림 끄기' : '알림 켜기' }}
                </button>
            </div>

            <div class="m-card">
                <span class="m-muted">연결된 서버</span>
                <strong>{{ origin }}</strong>
            </div>

            <button class="m-btn m-btn--danger m-btn--block" type="button" @click="leave">로그아웃</button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { APPEARANCES, APPEARANCE_LABELS, apply, saved } from '../lib/appearance.js';
import { enablePush, isNativeApp, isRegistered, unregisterDevice } from '../lib/push.js';
import { currentSession, signOut } from '../lib/session.js';
import { apiBase } from '../main';

const router = useRouter();
const email = ref('');
const tenant = ref<string | null>(null);
const origin = ref(apiBase.origin);

const appearance = ref(saved());
const onPhone = ref(false);
const pushOn = ref(false);
const pushBusy = ref(false);
const pushHint = ref('');

let session: any = null;

onMounted(async () => {
    session = await currentSession();
    email.value = session?.user?.email || '';
    tenant.value = (window as any).$tenantName || null;
    origin.value = apiBase.origin;

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
.themes {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin: 4px 0 2px;
}

.theme {
    min-height: var(--tap);
    padding: 12px 6px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--ink-soft);
}

/* 포털 카드와 같은 모양 — 배경색 원 안에 강조색 점. */
.theme__swatch {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    box-shadow: inset 0 0 0 1px var(--rule);
}

.theme__dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
}

.theme--on {
    border-color: var(--brand);
    background: var(--brand-wash);
    color: var(--brand);
}

</style>
