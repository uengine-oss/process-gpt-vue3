<template>
    <!--
        채팅에서 프로세스를 시작했을 때 대화 안에 남는 카드.

        starting  '프로세스를 시작하는 중…' — 말이 아니라 작업 중 표시다(인스턴스 대화의 '작업 중…' 과 같은 모양).
        started   '… 프로세스가 실행되었습니다' 카드. 누르면 그 인스턴스 채팅으로 넘어간다.
                  클로드가 만든 파일을 대화 안에 카드로 두고 눌러서 여는 것과 같은 자리다.
        failed    시작하지 못한 까닭 한 줄.
    -->
    <div v-if="state === 'starting'" class="pg-launch-working" data-testid="process-launch-starting" role="status" aria-live="polite">
        <span class="pg-launch-working__spark" aria-hidden="true">✻</span>
        <span class="pg-launch-working__text">{{ title }}</span>
    </div>

    <button
        v-else-if="state === 'started'"
        type="button"
        class="pg-launch-card"
        data-testid="process-launch-card"
        :aria-label="`${title} — 인스턴스 채팅 열기`"
        @click="open"
    >
        <span class="pg-launch-card__icon" aria-hidden="true">
            <v-icon size="18">mdi-play-circle-outline</v-icon>
        </span>
        <span class="pg-launch-card__body">
            <span class="pg-launch-card__title">{{ title }}</span>
            <span class="pg-launch-card__meta">{{ meta }}</span>
        </span>
        <v-icon size="18" class="pg-launch-card__chev" aria-hidden="true">mdi-chevron-right</v-icon>
    </button>

    <div v-else class="pg-launch-failed" data-testid="process-launch-failed">
        <v-icon size="14" color="error" aria-hidden="true">mdi-alert-circle-outline</v-icon>
        <span>{{ title }}<template v-if="error"> — {{ error }}</template></span>
    </div>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import { instanceRouteOf, launchTitle } from '@/shared/processLaunch';

const backend = BackendFactory.createBackend();

// 같은 정의 · 인스턴스를 가리키는 카드가 대화에 여럿 있어도 한 번만 묻는다.
const defNameCache = new Map();
const instanceCache = new Map();

function cached(cache, key, load) {
    if (!key) return Promise.resolve(null);
    if (!cache.has(key)) {
        cache.set(
            key,
            load().catch(() => {
                cache.delete(key);
                return null;
            })
        );
    }
    return cache.get(key);
}

export default {
    name: 'ProcessLaunchCard',
    props: {
        /** shared/processLaunch 의 processLaunchOf 결과 */
        launch: { type: Object, required: true },
        /**
         * 메시지가 끝났는가. 끝난 메시지에 '시작하는 중' 이 남아 있으면(스트림이 끊겨 도구 끝을
         * 받지 못한 경우) 영영 도는 표시 대신 결과를 확인하지 못했다고 적는다.
         */
        settled: { type: Boolean, default: false }
    },
    data: () => ({
        processName: '',
        instance: null
    }),
    computed: {
        state() {
            return this.settled && this.launch.state === 'starting' ? 'failed' : this.launch.state;
        },

        error() {
            if (this.launch.state === 'starting') return '실행 결과를 받지 못했습니다. 인스턴스 목록에서 확인해 주세요.';
            return this.launch.error;
        },

        title() {
            return launchTitle(this.processName, this.state);
        },

        /** 카드 둘째 줄 — 인스턴스 이름이 있으면 그것, 없으면 무엇을 누르는지. */
        meta() {
            const name = this.instance && this.instance.name;
            // 인스턴스 이름이 정의 이름으로 시작하면 겹치는 앞부분은 뗀다('국민신문고 프로세스 · 교차로 …').
            const trimmed = name && this.processName ? String(name).replace(this.processName, '').replace(/^\s*[·:-]\s*/, '') : name;
            return trimmed ? `${trimmed} · 진행 상황 보기` : '눌러서 진행 상황 보기';
        }
    },
    watch: {
        'launch.definitionId': { immediate: true, handler: 'loadProcessName' },
        'launch.instanceId': { immediate: true, handler: 'loadInstance' }
    },
    methods: {
        async loadProcessName(id) {
            const rows = await cached(defNameCache, id, () => backend.listDefinition('', { match: { id } }));
            const row = Array.isArray(rows) ? rows[0] : null;
            this.processName = (row && row.name && row.name !== row.id ? row.name : '') || '';
        },

        async loadInstance(id, retry = 0) {
            this.instance = await cached(instanceCache, id, () => backend.getInstance(id));
            // 실행 직후에는 인스턴스 행이 아직 없을 수 있다. 빈 결과는 기억하지 않고 잠시 뒤 다시 묻는다.
            if (id && !this.instance) {
                instanceCache.delete(id);
                if (retry < 3) setTimeout(() => id === this.launch.instanceId && this.loadInstance(id, retry + 1), 2000);
                return;
            }
            // 정의 id 가 입력에 없던 호출이면 인스턴스가 가리키는 정의로 이름을 찾는다.
            if (!this.launch.definitionId && this.instance && this.instance.defId) this.loadProcessName(this.instance.defId);
        },

        open() {
            if (!this.launch.instanceId) return;
            this.$router.push(instanceRouteOf(this.launch.instanceId));
        }
    }
};
</script>

<style scoped>
.pg-launch-working {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    font-size: 14px;
    line-height: 20px;
    color: rgba(var(--v-theme-on-surface), 0.6);
}

.pg-launch-working__spark {
    color: rgb(var(--v-theme-primary));
    animation: pg-launch-spin 1.6s linear infinite;
}

/* 글자 위로 빛이 지나가는 작업 중 표시 — 인스턴스 대화의 '작업 중…' 과 같은 결. */
.pg-launch-working__text {
    background: linear-gradient(
        90deg,
        rgba(var(--v-theme-on-surface), 0.55) 0%,
        rgba(var(--v-theme-on-surface), 0.95) 50%,
        rgba(var(--v-theme-on-surface), 0.55) 100%
    );
    background-size: 200% 100%;
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    animation: pg-launch-shimmer 1.8s linear infinite;
}

.pg-launch-card {
    display: flex;
    align-items: center;
    gap: 12px;
    width: min(100%, 420px);
    padding: 10px 12px 10px 14px;
    border: 1px solid rgba(var(--v-theme-on-surface), 0.16);
    border-radius: 12px;
    background: rgb(var(--v-theme-surface));
    text-align: left;
    cursor: pointer;
    transition: border-color 0.15s ease, background-color 0.15s ease;
}

.pg-launch-card:hover,
.pg-launch-card:focus-visible {
    border-color: rgba(var(--v-theme-primary), 0.6);
    background: rgba(var(--v-theme-primary), 0.03);
    outline: none;
}

.pg-launch-card__icon {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 8px;
    color: rgb(var(--v-theme-primary));
    background: rgba(var(--v-theme-primary), 0.1);
}

.pg-launch-card__body {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
}

.pg-launch-card__title {
    font-size: 15px;
    line-height: 20px;
    color: rgba(var(--v-theme-on-surface), 0.92);
}

.pg-launch-card__meta {
    font-size: 13px;
    line-height: 17px;
    color: rgba(var(--v-theme-on-surface), 0.5);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.pg-launch-card__chev {
    flex: 0 0 auto;
    color: rgba(var(--v-theme-on-surface), 0.4);
}

.pg-launch-failed {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    font-size: 13px;
    line-height: 18px;
    color: rgba(var(--v-theme-on-surface), 0.65);
}

@keyframes pg-launch-spin {
    to {
        transform: rotate(360deg);
    }
}

@keyframes pg-launch-shimmer {
    from {
        background-position: 100% 0;
    }
    to {
        background-position: -100% 0;
    }
}

@media (prefers-reduced-motion: reduce) {
    .pg-launch-working__spark,
    .pg-launch-working__text {
        animation: none;
    }

    .pg-launch-working__text {
        color: rgba(var(--v-theme-on-surface), 0.7);
        background: none;
    }
}
</style>
