<template>
    <div class="m-screen">
        <header class="m-appbar">
            <button type="button" aria-label="뒤로" @click="router.back()"><Icon name="back" /></button>
            <h1>{{ name || definition?.processDefinitionName || '프로세스 시작' }}</h1>
        </header>

        <div class="m-body">
            <p v-if="error" class="m-note m-note--danger">{{ error }}</p>
            <p v-if="loading" class="m-muted">불러오는 중…</p>

            <template v-else>
                <!-- 전체 흐름. 시작하기 전에 어떤 일이 벌어지는지 먼저 보여 준다. -->
                <section class="card">
                    <h2 class="card__head">전체 흐름</h2>
                    <ProcessFlow :definition="definition" />
                </section>

                <!--
                    담당자 지정.
                    누가 맡을지 정하지 않고 시작하면 다음 단계가 아무에게도
                    가지 않아 그대로 멈춘다.
                -->
                <section v-if="roles.length" class="card">
                    <h2 class="card__head">담당자</h2>
                    <div v-for="role in roles" :key="role" class="m-field">
                        <label :for="`role-${role}`">{{ role }}</label>
                        <select :id="`role-${role}`" v-model="bindings[role]">
                            <option value="">지정 안 함</option>
                            <option v-for="u in candidatesFor(role)" :key="u.id" :value="u.id">
                                {{ u.name }}
                            </option>
                        </select>
                    </div>
                </section>

                <!-- 첫 단계 입력. 시작하면서 바로 적을 수 있게 한다. -->
                <section v-if="fields.length" class="card">
                    <h2 class="card__head">{{ firstStepName }}</h2>
                    <MobileForm
                        :fields="fields"
                        :values="values"
                        @update:values="values = $event"
                        @voice-error="(m: string) => (error = m)"
                    />
                </section>

                <button
                    class="m-btn m-btn--primary m-btn--block"
                    type="button"
                    :disabled="starting"
                    @click="submit"
                >
                    {{ starting ? '시작하는 중…' : '시작하기' }}
                </button>
            </template>
        </div>
    </div>
</template>

<script setup lang="ts">
/**
 * 프로세스를 시작하는 화면.
 *
 * 예전에는 목록에서 누르면 곧바로 인스턴스가 만들어지고 목록으로 튕겨 나왔다.
 * 사용자는 무엇이 시작됐는지도, 누가 맡는지도 모른 채였고, 첫 입력을 하려면
 * 할 일 목록에서 그 건을 다시 찾아 들어가야 했다.
 *
 * 포털처럼 **시작 전에** 흐름 · 담당자 · 첫 입력을 한 화면에서 보여 주고,
 * 확인한 뒤 시작한다.
 */

import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import Icon from '../components/Icon.vue';
import MobileForm from '../components/MobileForm.vue';
import ProcessFlow from '../components/ProcessFlow.vue';
import { backend } from '../lib/backend.js';
import { initialValues, toMobileFields } from '../lib/formSchema.js';
import { startProcess } from '../lib/start.js';
import { humanRoles, toFlow } from '@/shared/processFlow/index.js';

const route = useRoute();
const router = useRouter();

const defId = decodeURIComponent(String(route.params.id || ''));
const definition = ref<any>(null);
const name = ref('');
const fields = ref<any[]>([]);
const values = ref<Record<string, any>>({});
const bindings = ref<Record<string, string>>({});
const people = ref<any[]>([]);
const firstStepName = ref('첫 단계');
// 제출할 때 값을 어느 폼 아래에 넣을지 알아야 한다.
const formId = ref('');
const loading = ref(true);
const starting = ref(false);
const error = ref('');

/** 사람이 맡는 역할만 묻는다. 에이전트 단계까지 물으면 쓸데없는 질문이 된다. */
const roles = computed(() => humanRoles(toFlow(definition.value)));

/** 모든 사람 역할에 같은 후보(조직 구성원)를 준다. */
function candidatesFor(_role: string) {
    return people.value;
}

function uuid() {
    return (crypto as any).randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * 정의 본문을 꺼낸다.
 *
 * getRawDefinition 은 proc_def **행 전체**를 돌려준다. 그 안의 `definition` 칸이
 * 실제 정의 JSON 이고, 문자열로 저장돼 있기도 하다. 행을 그대로 쓰면 활동이
 * 하나도 없는 것으로 보여 흐름도가 통째로 비었다 — 실제로 그랬다.
 */
function definitionOf(row: any) {
    const body = row?.definition ?? row;
    if (typeof body === 'string') {
        try {
            return JSON.parse(body);
        } catch (_e) {
            return null;
        }
    }
    return body && typeof body === 'object' ? body : null;
}

async function load() {
    loading.value = true;
    error.value = '';
    try {
        const row = await backend().getRawDefinition(defId, null);
        definition.value = definitionOf(row);
        if (row?.name) name.value = String(row.name);

        // 첫 단계의 입력 양식. 시작하면서 바로 적을 수 있게 미리 가져온다.
        const start = await backend().getStartActivity({ process_definition_id: defId });
        const activity = start?.activity;
        if (activity) {
            firstStepName.value = activity.name || '첫 단계';
            try {
                // 위치 인자다(formId, activityId, procDefId). 객체를 넘기면 조용히 null 이 온다.
                // 활동의 tool 에 폼 식별자가 들어 있으면 그것이 가장 정확하다.
                const toolFormId = String(activity.tool || '').startsWith('formHandler:')
                    ? String(activity.tool).replace('formHandler:', '')
                    : undefined;
                const form = await backend().getFormFields(toolFormId, activity.id, defId);
                // 행 전체가 아니라 fields_json 을 넘겨야 한다. 행을 넘기면 필드가
                // 하나도 나오지 않아 입력 칸이 통째로 사라진다.
                fields.value = toMobileFields(form?.fields_json);
                values.value = initialValues(fields.value);
                formId.value = toolFormId || form?.id || '';
            } catch (_e) {
                // 양식이 없는 단계도 있다. 그때는 담당자만 정하고 시작한다.
                fields.value = [];
            }
        }

        await loadCandidates();
    } catch (e: any) {
        error.value = '프로세스를 불러오지 못했습니다.';
        console.error('[start] 정의 조회 실패', e);
    } finally {
        loading.value = false;
    }
}

/**
 * 담당자 후보와 기본값.
 *
 * 후보는 조직의 사용자 목록에서 받는다. 정의에 적힌 기본 담당자(default /
 * endpoint)가 있으면 미리 골라 둔다 — 대부분은 그대로 두고 시작하므로,
 * 매번 처음부터 고르게 하면 번거롭기만 하다.
 */
async function loadCandidates() {
    try {
        const users = (await backend().getUserList({ size: 200 })) || [];
        people.value = users
            .filter((u: any) => u?.id && u?.is_agent !== true)
            .map((u: any) => ({ id: String(u.id), name: String(u.username || u.email || u.id) }));
    } catch (e) {
        // 후보를 못 받아도 시작은 할 수 있다. 담당자는 엔진이 정한다.
        console.warn('[start] 담당자 후보 조회 실패', e);
    }

    // 정의에 적힌 기본 담당자를 미리 고른다.
    for (const role of definition.value?.roles || []) {
        const name = String(role?.name || '').trim();
        if (!name) continue;
        const picked = role?.endpoint || role?.default;
        const id = Array.isArray(picked) ? picked[0] : picked;
        if (id) bindings.value[name] = String(id);
    }
}

async function submit() {
    starting.value = true;
    error.value = '';
    try {
        const picked = Object.entries(bindings.value)
            .filter(([, id]) => id)
            .map(([name, id]) => ({ name, endpoint: id, resolutionRule: '' }));

        const result = await startProcess({
            backend: backend(),
            definition: { id: defId, name: name.value },
            user: { id: localStorage.getItem('uid'), name: localStorage.getItem('userName') },
            uuid,
            roleBindings: picked,
            initialValues: formId.value ? { [formId.value]: values.value } : values.value
        });

        if (!result.ok) {
            error.value =
                result.reason === 'no-start-activity'
                    ? '이 프로세스는 시작 지점이 정해져 있지 않습니다. 웹에서 확인해 주세요.'
                    : '시작하지 못했습니다. 다시 시도해 주세요.';
            return;
        }

        // 시작했으면 그 건의 진행 현황으로 보낸다. 목록으로 튕기지 않는다.
        await router.replace(`/instances/${encodeURIComponent(result.instanceId)}`);
    } catch (e: any) {
        error.value = '시작하지 못했습니다. 다시 시도해 주세요.';
        console.error('[start] 시작 실패', e);
    } finally {
        starting.value = false;
    }
}

onMounted(load);
</script>

<style scoped>
.card {
    background: var(--surface);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.card__head {
    margin: 0;
    font-size: 0.94rem;
    font-weight: 700;
}
</style>
