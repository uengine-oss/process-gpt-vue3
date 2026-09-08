<template>
    <div class="m-screen login">
        <div class="login__head">
            <h1>Process-GPT</h1>
            <p class="m-muted">웹에서 쓰던 계정으로 들어갑니다.</p>
        </div>

        <form class="login__form" @submit.prevent="submit">
            <div class="m-field">
                <label for="email">이메일</label>
                <input
                    id="email"
                    v-model="email"
                    type="email"
                    inputmode="email"
                    autocomplete="username"
                    autocapitalize="none"
                    spellcheck="false"
                    required
                />
            </div>

            <div class="m-field">
                <label for="password">비밀번호</label>
                <input id="password" v-model="password" type="password" autocomplete="current-password" required />
            </div>

            <p v-if="error" class="m-note m-note--danger">{{ error }}</p>

            <button class="m-btn m-btn--primary m-btn--block" type="submit" :disabled="busy">
                {{ busy ? '확인 중…' : '로그인' }}
            </button>

            <!--
              앱에는 가입도 조직 만들기도 없다. 처음 온 사람이 이 화면에서
              할 수 있는 것이 로그인뿐인데 그 말이 없으면, 가입 버튼을 찾다가
              앱이 덜 만들어진 것으로 여긴다.
            -->
            <p class="m-muted login__note">
                처음이라면 웹 포털에서 가입하고 조직을 만든 뒤 이곳에서 로그인하세요.
            </p>
        </form>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { signIn } from '../lib/session.js';
import { establishSession } from '../main';

const route = useRoute();
const router = useRouter();

const email = ref('');
const password = ref('');
const busy = ref(false);
const error = ref('');

/**
 * 실패 이유를 사용자가 할 수 있는 일로 바꿔 말한다.
 *
 * 서버에 닿지 못한 것과 입력이 틀린 것은 해야 할 일이 다르다. 뭉뚱그리면
 * 네트워크가 막혔을 때 맞는 비밀번호를 계속 다시 치게 된다.
 *
 * 다만 거절당한 이유는 더 나누지 않는다 — "없는 계정" 과 "비밀번호 틀림" 을
 * 구분해 주면 그것으로 계정이 있는지 확인할 수 있다.
 */
function messageFor(reason?: string) {
    if (reason === 'offline') return '서버에 연결하지 못했습니다. 네트워크를 확인해 주세요.';
    if (reason === 'unavailable') return '앱을 다시 시작해 주세요. 서버 설정을 읽지 못했습니다.';
    if (reason === 'too-many') return '시도가 너무 잦습니다. 잠시 후 다시 시도해 주세요.';
    return '이메일 또는 비밀번호가 맞지 않습니다.';
}

async function submit() {
    busy.value = true;
    error.value = '';

    const result = await signIn(email.value, password.value);

    if (!result.ok) {
        error.value = messageFor(result.reason);
        busy.value = false;
        return;
    }

    // 조직과 사용자 정보를 정하기 전에 화면을 넘기면 첫 조회가 조직 없이 나가
    // 빈 목록이 뜨고, 제출도 "누가" 없이 나간다.
    await establishSession(result.session);

    const next = (route.query.next as string) || '/chat';
    busy.value = false;
    await router.replace(next);
}
</script>

<style scoped>
.login {
    justify-content: center;
    padding: calc(var(--safe-top) + 32px) 20px calc(var(--safe-bottom) + 32px);
    gap: 28px;
}

.login__head {
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.login__head h1 {
    margin: 0;
    font-size: 1.6rem;
    letter-spacing: -0.02em;
}

.login__form {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

/* 안내일 뿐이라 버튼과 붙어 보이지 않게 띄우고, 가운데로 모은다. */
.login__note {
    margin-top: 4px;
    text-align: center;
    font-size: 0.82rem;
}
</style>
