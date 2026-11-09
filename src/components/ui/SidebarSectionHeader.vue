<template>
    <!--
        사이드바 구역 머리 — 이름 옆에는 🔍 검색과 ＋ 추가 두 단추만 둔다.
        구역마다 단추가 달라(완료 목록 · 조직도 · 설정 아이콘 …) 무엇이 목록이고 무엇이 관리인지
        알기 어렵다는 지적이 있었다. 관리 화면은 상단의 「관리」 메뉴로 모았다.
    -->
    <div class="d-flex align-center mt-3 ml-2 sidebar-section-header" :data-testid="testid">
        <div style="font-size: 14px" class="text-medium-emphasis cp-menu">{{ title }}</div>
        <v-tooltip v-if="searchable" location="bottom" :text="searchLabel">
            <template v-slot:activator="{ props }">
                <div
                    v-bind="props"
                    class="sidebar-title-icon"
                    role="button"
                    :aria-label="searchLabel"
                    :data-testid="testid ? `${testid}-search` : undefined"
                    @click.stop="$emit('search')"
                >
                    <Icons :icon="searchOpen ? 'close' : 'search'" :size="14" :color="'#808080'" style="width: 14px; height: 14px" />
                </div>
            </template>
        </v-tooltip>
        <v-tooltip v-if="addable" location="bottom" :text="addLabel">
            <template v-slot:activator="{ props }">
                <div
                    v-bind="props"
                    class="sidebar-title-icon"
                    role="button"
                    :aria-label="addLabel"
                    :data-testid="testid ? `${testid}-add` : undefined"
                    @click.stop="$emit('add')"
                >
                    <Icons :icon="'plus'" :size="14" :color="'#808080'" style="width: 14px; height: 14px" />
                </div>
            </template>
        </v-tooltip>
    </div>
</template>

<script>
export default {
    name: 'SidebarSectionHeader',
    props: {
        title: { type: String, required: true },
        searchable: { type: Boolean, default: true },
        searchOpen: { type: Boolean, default: false },
        searchLabel: { type: String, default: '' },
        addable: { type: Boolean, default: true },
        addLabel: { type: String, default: '' },
        testid: { type: String, default: '' }
    },
    emits: ['search', 'add']
};
</script>
