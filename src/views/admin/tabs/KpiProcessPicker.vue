<template>
    <div class="picker-root">
        <!-- Toolbar -->
        <div class="px-3 pt-2 pb-2 d-flex align-center" style="gap: 8px;">
            <v-text-field
                v-model="search"
                placeholder="프로세스명 검색 (Enter 로 검색)"
                prepend-inner-icon="mdi-magnify"
                density="compact"
                variant="outlined"
                hide-details
                clearable
                class="flex-grow-1"
                @keyup.enter="applySearch"
                @click:clear="clearSearch"
            />
            <v-btn size="small" variant="text" @click="expandAll">모두 펼침</v-btn>
            <v-btn size="small" variant="text" @click="collapseAll">모두 접힘</v-btn>
            <v-chip size="small" color="primary" variant="tonal">
                {{ modelValue.length }}개 선택
            </v-chip>
            <v-btn
                v-if="modelValue.length > 0"
                size="small"
                variant="text"
                color="error"
                @click="clearSelection"
            >
                초기화
            </v-btn>
        </div>

        <v-divider />

        <!-- Tree body -->
        <div class="picker-body">
            <!-- Empty -->
            <div
                v-if="!loading && filteredTree.length === 0"
                class="d-flex flex-column align-center justify-center"
                style="height: 100%; color: rgb(var(--v-theme-on-surface), 0.5);"
            >
                <v-icon size="40" color="grey-lighten-1">mdi-folder-open-outline</v-icon>
                <div class="text-caption mt-2">검색 결과가 없습니다.</div>
            </div>

            <!-- Loading -->
            <div
                v-else-if="loading"
                class="d-flex align-center justify-center"
                style="height: 100%;"
            >
                <v-progress-circular indeterminate color="primary" size="32" width="3" />
            </div>

            <!-- Tree -->
            <v-list v-else density="compact" class="pa-0" nav>
                <template v-for="mega in filteredTree" :key="mega.id">
                    <v-list-item class="mega-row" @click="toggleExpand(mega.id)">
                        <template v-slot:prepend>
                            <v-icon size="18">
                                {{ expanded[mega.id] ? 'mdi-chevron-down' : 'mdi-chevron-right' }}
                            </v-icon>
                            <v-checkbox
                                :model-value="megaState(mega)"
                                :indeterminate="megaIndeterminate(mega)"
                                density="compact"
                                hide-details
                                color="primary"
                                class="ms-1"
                                @update:model-value="onToggleMega(mega, $event)"
                                @click.stop
                            />
                        </template>
                        <v-list-item-title class="font-weight-medium">
                            {{ mega.name }}
                            <span class="text-caption text-medium-emphasis ms-2">
                                ({{ mega.subCount }})
                            </span>
                        </v-list-item-title>
                    </v-list-item>

                    <template v-if="expanded[mega.id]">
                        <template v-for="major in mega.children" :key="major.id">
                            <v-list-item class="major-row ps-8" @click="toggleExpand(major.id)">
                                <template v-slot:prepend>
                                    <v-icon size="16">
                                        {{ expanded[major.id] ? 'mdi-chevron-down' : 'mdi-chevron-right' }}
                                    </v-icon>
                                    <v-checkbox
                                        :model-value="majorState(major)"
                                        :indeterminate="majorIndeterminate(major)"
                                        density="compact"
                                        hide-details
                                        color="primary"
                                        class="ms-1"
                                        @update:model-value="onToggleMajor(major, $event)"
                                        @click.stop
                                    />
                                </template>
                                <v-list-item-title>
                                    {{ major.name }}
                                    <span class="text-caption text-medium-emphasis ms-2">
                                        ({{ major.children.length }})
                                    </span>
                                </v-list-item-title>
                            </v-list-item>

                            <template v-if="expanded[major.id]">
                                <v-list-item
                                    v-for="sub in major.children"
                                    :key="sub.id"
                                    class="sub-row ps-16"
                                    @click="onToggleSub(sub.id)"
                                >
                                    <template v-slot:prepend>
                                        <v-checkbox
                                            :model-value="selectedSet.has(sub.id)"
                                            density="compact"
                                            hide-details
                                            color="primary"
                                            @update:model-value="onToggleSub(sub.id)"
                                            @click.stop
                                        />
                                    </template>
                                    <v-list-item-title class="text-body-2">
                                        {{ sub.name }}
                                    </v-list-item-title>
                                </v-list-item>
                            </template>
                        </template>
                    </template>
                </template>
            </v-list>
        </div>
    </div>
</template>

<script>
import { defineComponent, ref, computed, watch, onMounted } from 'vue';
import BackendFactory from '@/components/api/BackendFactory';

export default defineComponent({
    name: 'KpiProcessPicker',
    props: {
        modelValue: { type: Array, default: () => [] },
        // 트리에서 숨길 sub-process id 목록 (이미 다른 KPI 목표에 할당된 것)
        excludeIds: { type: Array, default: () => [] }
    },
    emits: ['update:modelValue'],

    setup(props, { emit }) {
        const procMap = ref(null);
        const loading = ref(false);
        const search = ref('');
        // 입력값(search) 과 분리된 "검색 적용값". Enter 누를 때만 갱신되어
        //   타이핑 중 트리가 매번 재계산되는 부담을 없앤다.
        const appliedQuery = ref('');
        const expanded = ref({});

        function applySearch() {
            appliedQuery.value = (search.value || '').trim();
        }

        function clearSearch() {
            search.value = '';
            appliedQuery.value = '';
        }

        const selectedSet = computed(() => new Set(props.modelValue));

        function setSelected(nextIds) {
            emit('update:modelValue', nextIds);
        }

        // -------------------------------------------------------
        // Tree build
        // -------------------------------------------------------
        const excludeSet = computed(() => new Set((props.excludeIds || []).map((id) => String(id || '').trim()).filter(Boolean)));

        const tree = computed(() => {
            const map = procMap.value;
            if (!map?.mega_proc_list) return [];
            const safeText = (v) => (v == null ? '' : String(v).trim());
            const excluded = excludeSet.value;

            return map.mega_proc_list
                .map((mega, mi) => {
                    const megaId = safeText(mega?.id) || `mega-${mi}`;
                    const majors = (mega?.major_proc_list || [])
                        .map((major, mj) => {
                            const majorId = safeText(major?.id) || `${megaId}-major-${mj}`;
                            const subs = (major?.sub_proc_list || [])
                                .map((sub, sk) => ({
                                    id: safeText(sub?.id) || `${majorId}-sub-${sk}`,
                                    name: safeText(sub?.name) || safeText(sub?.id) || `${majorId}-sub-${sk}`
                                }))
                                // 이미 다른 KPI 목표에 할당된 sub-process 는 트리에서 제외
                                .filter((sub) => !excluded.has(sub.id));
                            return {
                                id: `major_${majorId}`,
                                rawId: majorId,
                                name: safeText(major?.name) || majorId,
                                children: subs
                            };
                        })
                        // sub 가 0인 major 는 숨김 (사용자가 펼쳐도 빈 영역만 보이는 걸 방지)
                        .filter((major) => major.children.length > 0);
                    const subCount = majors.reduce((acc, m) => acc + m.children.length, 0);
                    return {
                        id: `mega_${megaId}`,
                        rawId: megaId,
                        name: safeText(mega?.name) || megaId,
                        children: majors,
                        subCount
                    };
                })
                // major 가 0인 mega 도 숨김
                .filter((mega) => mega.children.length > 0);
        });

        const filteredTree = computed(() => {
            const kw = (appliedQuery.value || '').toLowerCase();
            if (!kw) return tree.value;
            return tree.value
                .map((mega) => {
                    const filteredMajors = mega.children
                        .map((major) => {
                            const matchedSubs = major.children.filter((sub) =>
                                sub.name.toLowerCase().includes(kw)
                            );
                            const majorMatch = major.name.toLowerCase().includes(kw);
                            if (majorMatch) return { ...major, children: major.children };
                            if (matchedSubs.length > 0)
                                return { ...major, children: matchedSubs };
                            return null;
                        })
                        .filter(Boolean);
                    const megaMatch = mega.name.toLowerCase().includes(kw);
                    if (megaMatch) return mega;
                    if (filteredMajors.length > 0) return { ...mega, children: filteredMajors };
                    return null;
                })
                .filter(Boolean);
        });

        watch(appliedQuery, (kw) => {
            if (kw) expandAll();
        });

        // -------------------------------------------------------
        // Tri-state helpers
        // -------------------------------------------------------
        function megaState(mega) {
            const total = mega.subCount;
            if (total === 0) return false;
            const sel = mega.children
                .flatMap((m) => m.children)
                .filter((s) => selectedSet.value.has(s.id)).length;
            return sel === total;
        }
        function megaIndeterminate(mega) {
            const total = mega.subCount;
            if (total === 0) return false;
            const sel = mega.children
                .flatMap((m) => m.children)
                .filter((s) => selectedSet.value.has(s.id)).length;
            return sel > 0 && sel < total;
        }
        function majorState(major) {
            const total = major.children.length;
            if (total === 0) return false;
            const sel = major.children.filter((s) => selectedSet.value.has(s.id)).length;
            return sel === total;
        }
        function majorIndeterminate(major) {
            const total = major.children.length;
            if (total === 0) return false;
            const sel = major.children.filter((s) => selectedSet.value.has(s.id)).length;
            return sel > 0 && sel < total;
        }

        // -------------------------------------------------------
        // Toggle handlers
        // -------------------------------------------------------
        function onToggleSub(subId) {
            const ids = [...props.modelValue];
            const idx = ids.indexOf(subId);
            if (idx >= 0) ids.splice(idx, 1);
            else ids.push(subId);
            setSelected(ids);
        }
        function onToggleMajor(major, value) {
            const ids = major.children.map((s) => s.id);
            const next = new Set(props.modelValue);
            if (value) ids.forEach((id) => next.add(id));
            else ids.forEach((id) => next.delete(id));
            setSelected([...next]);
        }
        function onToggleMega(mega, value) {
            const ids = mega.children.flatMap((m) => m.children).map((s) => s.id);
            const next = new Set(props.modelValue);
            if (value) ids.forEach((id) => next.add(id));
            else ids.forEach((id) => next.delete(id));
            setSelected([...next]);
        }
        function toggleExpand(id) {
            expanded.value = { ...expanded.value, [id]: !expanded.value[id] };
        }
        function expandAll() {
            const next = {};
            for (const mega of tree.value) {
                next[mega.id] = true;
                for (const major of mega.children) next[major.id] = true;
            }
            expanded.value = next;
        }
        function collapseAll() {
            expanded.value = {};
        }
        function clearSelection() {
            setSelected([]);
        }

        // -------------------------------------------------------
        // Lifecycle: load procMap once on mount
        // -------------------------------------------------------
        async function loadProcMap() {
            loading.value = true;
            try {
                const cached = window.$procMap;
                if (cached?.mega_proc_list) {
                    procMap.value = cached;
                } else {
                    const backend = BackendFactory.createBackend();
                    const result = await backend.getProcessDefinitionMap();
                    procMap.value = result?.value || result || null;
                }
                // 트리 로드 직후 전체 펼침
                expandAll();
            } catch (e) {
                console.error('[KpiProcessPicker] loadProcMap error:', e);
                procMap.value = null;
            } finally {
                loading.value = false;
            }
        }

        onMounted(loadProcMap);

        return {
            loading,
            search,
            applySearch,
            clearSearch,
            expanded,
            tree,
            filteredTree,
            selectedSet,
            megaState,
            megaIndeterminate,
            majorState,
            majorIndeterminate,
            onToggleSub,
            onToggleMajor,
            onToggleMega,
            toggleExpand,
            expandAll,
            collapseAll,
            clearSelection
        };
    }
});
</script>

<style scoped>
.picker-root {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
}
.picker-body {
    flex: 1 1 auto;
    overflow-y: auto;
    min-height: 0;
}
.mega-row {
    cursor: pointer;
}
.mega-row :deep(.v-list-item-title) {
    font-weight: 600;
}
.major-row {
    cursor: pointer;
}
.major-row :deep(.v-list-item-title) {
    font-weight: 500;
}
.sub-row {
    cursor: pointer;
}
</style>
