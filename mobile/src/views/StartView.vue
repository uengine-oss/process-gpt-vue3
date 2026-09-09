<template>
    <div class="m-screen">
        <header class="m-appbar">
            <button type="button" aria-label="뒤로" @click="router.back()"><Icon name="back" /></button>
            <h1>프로세스 시작</h1>
        </header>

        <div class="m-body">
            <p v-if="error" class="m-note m-note--danger">{{ error }}</p>
            <p v-if="loading" class="m-muted">불러오는 중…</p>

            <div v-else class="m-field find">
                <input v-model="query" type="search" placeholder="프로세스 이름으로 찾기" aria-label="찾기" />
            </div>

            <template v-if="!loading && shown.length">
                <section v-for="g in shown" :key="g.key" class="grp">
                    <h2 class="grp__title">{{ g.title }}</h2>
                    <button
                        v-for="def in g.items"
                        :key="def.id"
                        type="button"
                        class="m-card"
                        :disabled="starting"
                        @click="open(def)"
                    >
                        <strong>{{ def.name }}</strong>
                    </button>
                </section>
            </template>

            <!--
                오류일 때는 "없습니다" 를 함께 내지 않는다. 둘이 같이 뜨면
                못 불러온 것인지 정말 없는 것인지 알 수 없다.
            -->
            <div v-else-if="!error && !loading" class="m-empty">
                <p>{{ query ? '찾는 프로세스가 없습니다.' : '시작할 수 있는 프로세스가 없습니다.' }}</p>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import Icon from '../components/Icon.vue';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { backend } from '../lib/backend.js';
import { filterGroups, toGroups, ungrouped } from '@/shared/processMap/index.js';
import { PROC_DEF_LIST_COLUMNS } from '@/components/api/ProcessGPTBackend';
import { startProcess } from '../lib/start.js';

const router = useRouter();
const definitions = ref<any[]>([]);
const loading = ref(true);
const starting = ref(false);
const error = ref('');
const query = ref('');
const procMap = ref<any>(null);

/**
 * 체계도 그룹 + 분류되지 않은 것들.
 *
 * 체계도만 보여 주면 아직 분류 안 된 프로세스는 앱에서 시작할 수 없다.
 */
const groups = computed(() => {
    const base = toGroups(procMap.value);
    const rest = ungrouped(procMap.value, definitions.value);
    return rest.length ? [...base, { key: '__rest', title: '분류되지 않음', items: rest }] : base;
});

const shown = computed(() => filterGroups(groups.value, query.value));

function uuid() {
    return (crypto as any).randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function load() {
    loading.value = true;
    error.value = '';
    try {
        // 'proc_def' 가 아니라 'bpmn' 이다. 앞의 인자는 표 이름이 아니라 **종류**이고,
        // 표 이름을 넣으면 그것이 id 앞머리 검색 조건이 되어 조회가 실패한다.
        // 포털도 같은 목록을 'bpmn' 으로 부른다(ProcessDefinitionMap).
        const list = (await backend().listDefinition('bpmn', { key: PROC_DEF_LIST_COLUMNS })) || [];
        definitions.value = list.filter((d: any) => d && d.id);

        // 포털의 "정의 체계도" 와 같은 자료. 대·중분류로 묶어 보여 준다.
        try {
            procMap.value = await backend().getProcessDefinitionMap();
        } catch (e) {
            // 체계도가 없어도 목록은 보여야 한다.
            console.warn('[start] 정의 체계도 조회 실패', e);
            procMap.value = null;
        }
    } catch (e: any) {
        error.value = '프로세스 목록을 불러오지 못했습니다.';
        console.error('[start] 정의 조회 실패', e);
    } finally {
        loading.value = false;
    }
}

/**
 * 곧바로 시작하지 않는다.
 *
 * 예전에는 누르는 즉시 인스턴스가 만들어지고 목록으로 튕겨 나왔다. 무엇이
 * 시작됐는지도, 누가 맡는지도 모른 채였다. 먼저 확인할 화면으로 보낸다.
 */
function open(definition: any) {
    void router.push(`/start/${encodeURIComponent(String(definition.id))}`);
}

async function start(definition: any) {
    starting.value = true;
    error.value = '';
    try {
        const result = await startProcess({
            backend: backend(),
            definition,
            user: {
                id: localStorage.getItem('uid'),
                name: localStorage.getItem('userName')
            },
            uuid
        });

        if (!result.ok) {
            error.value =
                result.reason === 'no-start-activity'
                    ? '이 프로세스는 시작 지점이 정해져 있지 않습니다. 웹에서 확인해 주세요.'
                    : '시작하지 못했습니다. 다시 시도해 주세요.';
            return;
        }

        // 시작하면 대개 첫 업무를 바로 처리한다. 할 일 목록으로 보낸다.
        await router.replace('/tasks');
    } catch (e: any) {
        error.value = '시작하지 못했습니다. 다시 시도해 주세요.';
        console.error('[start] 시작 실패', e);
    } finally {
        starting.value = false;
    }
}

onMounted(load);
</script>
