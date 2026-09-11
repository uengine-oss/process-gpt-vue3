<template>
    <v-autocomplete
        v-model="selectedOwner"
        :items="memberItems"
        :label="label"
        :placeholder="placeholder"
        :loading="loading"
        :disabled="disabled"
        :clearable="clearable"
        :multiple="multiple"
        :chips="multiple"
        :closable-chips="multiple"
        :hide-details="hideDetails"
        :density="density"
        item-title="name"
        item-value="value"
        :return-object="false"
        @update:search="onSearch"
        @update:model-value="onSelect"
    >
        <template #item="{ item, props }">
            <v-list-item v-bind="props">
                <template #prepend>
                    <v-avatar size="32" :color="item.raw.avatar ? undefined : 'primary'" class="mr-2">
                        <v-img v-if="item.raw.avatar" :src="item.raw.avatar" />
                        <span v-else class="text-white text-body-2">
                            {{ getInitials(displayName(item.raw)) }}
                        </span>
                    </v-avatar>
                </template>
                <v-list-item-title>{{ displayName(item.raw) }}</v-list-item-title>
                <v-list-item-subtitle v-if="item.raw.department || item.raw.position">
                    {{ item.raw.department }}{{ item.raw.position ? ` / ${item.raw.position}` : '' }}
                </v-list-item-subtitle>
            </v-list-item>
        </template>

        <template #selection="{ item }">
            <div class="d-flex align-center">
                <v-avatar size="24" :color="item.raw.avatar ? undefined : 'primary'" class="mr-2">
                    <v-img v-if="item.raw.avatar" :src="item.raw.avatar" />
                    <span v-else class="text-white text-caption">
                        {{ getInitials(displayName(item.raw)) }}
                    </span>
                </v-avatar>
                <span>{{ displayName(item.raw) }}</span>
            </div>
        </template>

        <template #no-data>
            <v-list-item>
                <v-list-item-title>
                    {{ noDataText || $t('ownerSelect.noData') }}
                </v-list-item-title>
            </v-list-item>
        </template>
    </v-autocomplete>
</template>

<script lang="ts">
import { defineComponent, ref, computed, watch, onMounted, type PropType } from 'vue';
import { getOrganizationProvider, type OrganizationMember } from '@/providers/organization';
import BackendFactory from '@/components/api/BackendFactory';
import { userIdentityFromSearchResult } from '@/utils/userIdentity';

// 저장값은 이메일(신규) 또는 조직도 노드 id(과거 저장분)일 수 있어
// value 필드에 저장값 원문을 그대로 유지한다.
type OwnerItem = {
    value: string;
    id?: string;
    name: string;
    email?: string;
    department?: string;
    position?: string;
    avatar?: string;
};

export default defineComponent({
    name: 'OwnerSelect',
    props: {
        // v-model 바인딩
        modelValue: {
            type: [String, Array] as PropType<string | string[]>,
            default: ''
        },
        // 라벨
        label: {
            type: String,
            default: ''
        },
        // 플레이스홀더
        placeholder: {
            type: String,
            default: ''
        },
        // 비활성화
        disabled: {
            type: Boolean,
            default: false
        },
        // 클리어 버튼
        clearable: {
            type: Boolean,
            default: true
        },
        multiple: {
            type: Boolean,
            default: false
        },
        // 상세 숨기기
        hideDetails: {
            type: Boolean,
            default: false
        },
        // 밀도
        density: {
            type: String as () => 'default' | 'comfortable' | 'compact',
            default: 'default'
        },
        // 데이터 없을 때 텍스트
        noDataText: {
            type: String,
            default: ''
        },
        // 초기 로드 시 전체 목록 가져오기
        loadAllOnMount: {
            type: Boolean,
            default: true
        },
        // 검색 최소 글자 수
        minSearchLength: {
            type: Number,
            default: 0
        }
    },
    emits: ['update:modelValue', 'select'],
    setup(props, { emit }) {
        const loading = ref(false);
        const members = ref<OwnerItem[]>([]);
        // 현재 선택값에 대응하는 항목(해석 결과 또는 placeholder).
        // 목록 재로딩에 밀려나지 않도록 members 와 분리해 보관한다.
        const selectionItems = ref<Record<string, OwnerItem>>({});
        const selectedOwner = ref<string | string[]>(props.modelValue);
        const searchQuery = ref('');

        const provider = getOrganizationProvider();
        const backend = BackendFactory.createBackend();
        let searchToken = 0;

        const normalizeKey = (v: unknown): string =>
            String(v ?? '')
                .trim()
                .toLowerCase();

        const memberToItem = (m: OrganizationMember): OwnerItem => ({
            value: m.email || m.id,
            id: m.id,
            name: m.name,
            email: m.email,
            department: m.department,
            position: m.position,
            avatar: m.avatar
        });

        const searchUserToItem = (raw: any): OwnerItem | null => {
            const identity = userIdentityFromSearchResult(raw);
            const value = identity.email || identity.employee_no || identity.id || '';
            if (!value) return null;
            return {
                value,
                id: identity.id || undefined,
                name: identity.username || value,
                email: identity.email || undefined,
                department: identity.org_name || undefined
            };
        };

        const memberItems = computed<OwnerItem[]>(() => {
            const seen = new Set<string>();
            const result: OwnerItem[] = [];
            for (const item of [...Object.values(selectionItems.value), ...members.value]) {
                const key = normalizeKey(item.value);
                if (!key || seen.has(key)) continue;
                seen.add(key);
                result.push(item);
            }
            return result;
        });

        const displayName = (raw: unknown): string => {
            if (typeof raw === 'string') return raw;
            const item = raw as OwnerItem | null;
            return item?.name || item?.value || '';
        };

        // 이니셜 추출
        const getInitials = (name: string): string => {
            if (!name) return '?';
            const parts = name.split(' ');
            if (parts.length >= 2) {
                return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
            }
            return name.substring(0, 2).toUpperCase();
        };

        const selectedValues = (): string[] => {
            const raw = Array.isArray(selectedOwner.value) ? selectedOwner.value : [selectedOwner.value];
            return raw.map((v) => String(v ?? '').trim()).filter(Boolean);
        };

        // 저장값 하나를 표시 가능한 항목으로 해석한다.
        // 조직도(노드 id → 이메일) → resolveUserIdentities → 사용자 검색 순으로 시도.
        const resolveSelectionItem = async (value: string): Promise<OwnerItem | null> => {
            try {
                if (provider.initialize) await provider.initialize();
                const byId = await provider.getMember(value);
                if (byId) return { ...memberToItem(byId), value };
                const candidates = await provider.searchMembers(value, { limit: 10 });
                const byEmail = candidates.find((m) => normalizeKey(m.email) === normalizeKey(value));
                if (byEmail) return { ...memberToItem(byEmail), value };
            } catch {
                // 조직도 미구성(예: PAL SSO 테넌트) — 백엔드 조회로 계속
            }
            try {
                const identityMap = await backend.resolveUserIdentities([value]);
                const identity = identityMap?.[value];
                if (identity) {
                    return {
                        value,
                        id: identity.id || undefined,
                        name: identity.name || identity.username || value,
                        email: identity.email || undefined,
                        department: identity.org_name || undefined
                    };
                }
            } catch {
                // 미지원 백엔드 — 검색으로 계속
            }
            try {
                const result = await backend.searchUsersByName(value, 0, 5);
                const users = Array.isArray(result) ? result : result?.users || [];
                for (const raw of users) {
                    const item = searchUserToItem(raw);
                    if (!item) continue;
                    const keys = [item.value, item.email, item.id].filter(Boolean).map(normalizeKey);
                    if (keys.includes(normalizeKey(value))) return { ...item, value };
                }
            } catch {
                // 해석 실패 시 placeholder(값 그대로)가 유지된다
            }
            return null;
        };

        const ensureSelectionItems = () => {
            const values = selectedValues();
            for (const key of Object.keys(selectionItems.value)) {
                if (!values.includes(key)) delete selectionItems.value[key];
            }
            for (const value of values) {
                if (selectionItems.value[value]) continue;
                const inList = members.value.find((m) => m.value === value);
                if (inList) {
                    selectionItems.value[value] = inList;
                    continue;
                }
                // 우선 값 그대로 표시(빈 칸 방지)하고, 해석되면 이름으로 교체
                selectionItems.value[value] = { value, name: value };
                resolveSelectionItem(value).then((item) => {
                    if (item && selectionItems.value[value]) selectionItems.value[value] = item;
                });
            }
        };

        // 멤버 목록 로드 (조직도 + 백엔드 사용자 검색 병합)
        const loadMembers = async (query?: string) => {
            const token = ++searchToken;
            loading.value = true;
            try {
                let orgMembers: OrganizationMember[] = [];
                try {
                    if (provider.initialize) await provider.initialize();
                    orgMembers =
                        query && query.length >= props.minSearchLength
                            ? await provider.searchMembers(query, { limit: 20 })
                            : await provider.getMembers({ limit: 50 });
                } catch (error) {
                    console.warn('[OwnerSelect] 조직도 로드 실패:', error);
                }

                let searched: OwnerItem[] = [];
                const keyword = String(query || '').trim();
                if (keyword && keyword.length >= Math.max(props.minSearchLength, 1)) {
                    try {
                        const result = await backend.searchUsersByName(keyword, 0, 20);
                        const users = Array.isArray(result) ? result : result?.users || [];
                        searched = users.map(searchUserToItem).filter((item: OwnerItem | null): item is OwnerItem => !!item);
                    } catch {
                        // 사용자 검색 미지원 백엔드 — 조직도 결과만 사용
                    }
                }

                if (token !== searchToken) return; // 이후 검색이 시작됐으면 이 결과는 버린다
                const seen = new Set<string>();
                const merged: OwnerItem[] = [];
                for (const item of [...orgMembers.map(memberToItem), ...searched]) {
                    const key = normalizeKey(item.value);
                    if (!key || seen.has(key)) continue;
                    seen.add(key);
                    merged.push(item);
                }
                members.value = merged;
                ensureSelectionItems();
            } finally {
                if (token === searchToken) loading.value = false;
            }
        };

        // 검색 처리 (debounce)
        let searchTimeout: ReturnType<typeof setTimeout> | null = null;
        const onSearch = (query: string) => {
            searchQuery.value = query;

            if (searchTimeout) {
                clearTimeout(searchTimeout);
            }

            // 선택 직후 검색창에 표시명이 들어간 경우는 재검색하지 않는다
            const selectedNames = selectedValues().map((v) => normalizeKey(selectionItems.value[v]?.name));
            if (query && selectedNames.includes(normalizeKey(query))) return;

            searchTimeout = setTimeout(() => {
                if (query && query.length >= props.minSearchLength) {
                    loadMembers(query);
                } else if (!query && props.loadAllOnMount) {
                    loadMembers();
                }
            }, 300);
        };

        // 선택 처리
        const onSelect = (value: string | string[] | null) => {
            emit('update:modelValue', value || (props.multiple ? [] : ''));

            const list = memberItems.value;
            const selectedMembers = Array.isArray(value)
                ? list.filter((m) => value.includes(m.value))
                : list.find((m) => m.value === value) || null;
            emit('select', selectedMembers);
        };

        // modelValue 변경 감지
        watch(
            () => props.modelValue,
            (newVal) => {
                selectedOwner.value = newVal;
                ensureSelectionItems();
            },
            { immediate: true }
        );

        // 초기 로드
        onMounted(() => {
            if (props.loadAllOnMount) {
                loadMembers();
            }
        });

        return {
            loading,
            memberItems,
            selectedOwner,
            displayName,
            getInitials,
            onSearch,
            onSelect
        };
    }
});
</script>
