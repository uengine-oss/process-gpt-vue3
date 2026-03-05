<template>
    <div class="expandable-list">
        <!-- 기본 아이템들 표시 -->
        <slot name="items" :displayedItems="displayedItems"></slot>
        
        <!-- 더보기/접기 버튼 -->
        <div v-if="showMoreVisible || showLessVisible" class="mt-2">
            <v-card
                v-if="showMoreVisible"
                @click="showMore"
                class="text-center cursor-pointer pa-2"
                elevation="10"
                rounded="10"
            >
                <v-card-text class="pa-0">
                    <span class="text-caption text-primary">
                        {{ $t('VerticalSidebar.showMore') }} ({{ remainingCount }})
                    </span>
                    <v-icon size="small" class="ml-1" color="primary">mdi-chevron-down</v-icon>
                </v-card-text>
            </v-card>
            <v-card
                v-if="showLessVisible"
                @click="showLess"
                class="text-center cursor-pointer pa-2"
                elevation="10"
                rounded="10"
            >
                <v-card-text class="pa-0">
                    <span class="text-caption text-primary">
                        {{ $t('VerticalSidebar.showLess') }}
                    </span>
                    <v-icon size="small" class="ml-1" color="primary">mdi-chevron-up</v-icon>
                </v-card-text>
            </v-card>
        </div>
    </div>
</template>

<script>
export default {
    name: 'ExpandableList',
    props: {
        items: {
            type: Array,
            default: () => []
        },
        limit: {
            type: Number,
            default: 10
        },
        // true면 "더보기" 클릭 시 전체 펼침이 아니라 step만큼 추가 노출
        incremental: {
            type: Boolean,
            default: false
        },
        // incremental 모드에서 한 번에 늘릴 개수
        step: {
            type: Number,
            default: 10
        }
    },
    data() {
        return {
            showAll: false,
            visibleCount: this.limit
        }
    },
    computed: {
        isExpanded() {
            if (this.incremental) {
                return (this.items?.length || 0) <= this.visibleCount;
            }
            return this.showAll;
        },
        showMoreVisible() {
            // incremental: 남은 게 있으면 항상 더보기 표시
            // default: showAll이 아닐 때만 더보기 표시
            if (this.incremental) return this.hasMoreItems;
            return this.hasMoreItems && !this.showAll;
        },
        showLessVisible() {
            // incremental: 한 번이라도 더 보여준 상태(visibleCount > limit)면 접기 표시
            // default: showAll일 때만 접기 표시
            if (this.incremental) return (this.visibleCount || this.limit) > this.limit;
            return this.showAll;
        },
        displayedItems() {
            if (!this.items || this.items.length === 0) return [];
            if (this.incremental) {
                const count = Math.max(this.limit, this.visibleCount || this.limit);
                return this.items.slice(0, count);
            }
            if (this.showAll || this.items.length <= this.limit) return this.items;
            return this.items.slice(0, this.limit);
        },
        hasMoreItems() {
            if (!this.items) return false;
            if (this.incremental) {
                return this.items.length > Math.max(this.limit, this.visibleCount || this.limit);
            }
            return this.items.length > this.limit;
        },
        remainingCount() {
            if (!this.items) return 0;
            if (this.incremental) {
                const count = Math.max(this.limit, this.visibleCount || this.limit);
                return Math.max(this.items.length - count, 0);
            }
            return Math.max(this.items.length - this.limit, 0);
        }
    },
    watch: {
        items: {
            handler(newItems) {
                if (!this.incremental) return;
                const len = newItems?.length || 0;
                const next = Math.min(Math.max(this.limit, this.visibleCount || this.limit), len);
                this.visibleCount = next || this.limit;
            },
            deep: false
        },
        limit(newLimit) {
            if (!this.incremental) return;
            if (typeof newLimit === 'number' && newLimit > 0) {
                this.visibleCount = Math.max(newLimit, this.visibleCount || newLimit);
            }
        }
    },
    methods: {
        showMore() {
            if (this.incremental) {
                const len = this.items?.length || 0;
                const step = this.step || this.limit || 10;
                const next = Math.min((this.visibleCount || this.limit) + step, len);
                this.visibleCount = next;
            } else {
                this.showAll = true;
            }
            this.$emit('expanded');
        },
        showLess() {
            if (this.incremental) {
                this.visibleCount = this.limit;
            } else {
                this.showAll = false;
            }
            this.$emit('collapsed');
        }
    }
}
</script>

<style scoped>
.cursor-pointer {
    cursor: pointer;
}

.cursor-pointer:hover {
    transform: translateY(-1px);
    transition: transform 0.2s ease;
}
</style>
