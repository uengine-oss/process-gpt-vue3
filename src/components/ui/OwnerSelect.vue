<template>
    <v-autocomplete
        v-model="selectedOwner"
        :items="memberItems"
        :label="label"
        :placeholder="placeholder"
        :loading="loading"
        :disabled="disabled"
        :clearable="clearable"
        :hide-details="hideDetails"
        :density="density"
        item-title="name"
        item-value="id"
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
                            {{ getInitials(item.raw.name) }}
                        </span>
                    </v-avatar>
                </template>
                <v-list-item-title>{{ item.raw.name }}</v-list-item-title>
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
                        {{ getInitials(item.raw.name) }}
                    </span>
                </v-avatar>
                <span>{{ item.raw.name }}</span>
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
import { defineComponent, ref, computed, watch, onMounted } from 'vue';
import {
    getOrganizationProvider,
    type OrganizationMember
} from '@/providers/organization';

export default defineComponent({
    name: 'OwnerSelect',
    props: {
        // v-model 바인딩
        modelValue: {
            type: String,
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
        const members = ref<OrganizationMember[]>([]);
        const selectedOwner = ref<string>(props.modelValue);
        const searchQuery = ref('');

        const provider = getOrganizationProvider();

        // 멤버 목록을 아이템 형식으로 변환
        const memberItems = computed(() => {
            return members.value.map(m => ({
                id: m.id,
                name: m.name,
                email: m.email,
                department: m.department,
                position: m.position,
                avatar: m.avatar
            }));
        });

        // 이니셜 추출
        const getInitials = (name: string): string => {
            if (!name) return '?';
            const parts = name.split(' ');
            if (parts.length >= 2) {
                return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
            }
            return name.substring(0, 2).toUpperCase();
        };

        // 멤버 목록 로드
        const loadMembers = async (query?: string) => {
            loading.value = true;
            try {
                if (provider.initialize) {
                    await provider.initialize();
                }

                if (query && query.length >= props.minSearchLength) {
                    members.value = await provider.searchMembers(query, { limit: 20 });
                } else if (props.loadAllOnMount || !query) {
                    members.value = await provider.getMembers({ limit: 50 });
                }

                // 선택된 값이 있는데 목록에 없으면 해당 멤버 추가
                if (selectedOwner.value && !members.value.find(m => m.id === selectedOwner.value)) {
                    const selectedMember = await provider.getMember(selectedOwner.value);
                    if (selectedMember) {
                        members.value = [selectedMember, ...members.value];
                    }
                }
            } catch (error) {
                console.error('[OwnerSelect] 멤버 로드 실패:', error);
                members.value = [];
            } finally {
                loading.value = false;
            }
        };

        // 검색 처리 (debounce)
        let searchTimeout: ReturnType<typeof setTimeout> | null = null;
        const onSearch = (query: string) => {
            searchQuery.value = query;

            if (searchTimeout) {
                clearTimeout(searchTimeout);
            }

            searchTimeout = setTimeout(() => {
                if (query && query.length >= props.minSearchLength) {
                    loadMembers(query);
                } else if (!query && props.loadAllOnMount) {
                    loadMembers();
                }
            }, 300);
        };

        // 선택 처리
        const onSelect = (value: string | null) => {
            emit('update:modelValue', value || '');

            const selectedMember = members.value.find(m => m.id === value);
            emit('select', selectedMember || null);
        };

        // modelValue 변경 감지
        watch(() => props.modelValue, async (newVal) => {
            selectedOwner.value = newVal;
            // 새 값이 목록에 없으면 해당 멤버 로드
            if (newVal && !members.value.find(m => m.id === newVal)) {
                try {
                    if (provider.initialize) {
                        await provider.initialize();
                    }
                    const member = await provider.getMember(newVal);
                    if (member) {
                        members.value = [member, ...members.value];
                    }
                } catch (error) {
                    console.warn('[OwnerSelect] 멤버 로드 실패:', error);
                }
            }
        });

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
            getInitials,
            onSearch,
            onSelect
        };
    }
});
</script>
