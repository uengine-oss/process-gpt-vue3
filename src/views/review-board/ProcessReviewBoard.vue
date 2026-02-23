<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import BackendFactory from '@/components/api/BackendFactory'
import ReviewBoardCard from './ReviewBoardCard.vue'

const backend = BackendFactory.createBackend() as any
const router = useRouter()

const loading = ref(false)
const boardData = ref<any[]>([])
const metricsMap = ref<any>(null)
const activeTab = ref('active')

const enrichedData = computed(() => {
  const domains = metricsMap.value?.domains || []
  return boardData.value.map(item => {
    const domain = domains.find((d: any) => d.id === item.domain_id)
    return {
      ...item,
      domain_name: domain?.name || item.domain_id || '',
      domain_color: domain?.color || '#0085db'
    }
  })
})

const activeData = computed(() => enrichedData.value.filter(i => i.state !== 'cancelled'))
const cancelledData = computed(() => enrichedData.value.filter(i => i.state === 'cancelled'))

const reviewItems = computed(() => activeData.value.filter(i => i.state === 'review'))
const approvedItems = computed(() => activeData.value.filter(i => i.state === 'approved_level1' || i.state === 'approved_level2'))
const publishedItems = computed(() => activeData.value.filter(i => i.state === 'confirmed'))
const rejectedItems = computed(() => activeData.value.filter(i => i.state === 'rejected'))

const reviewCount = computed(() => reviewItems.value.length)

const columns = computed(() => [
  { key: 'review', titleKey: 'reviewBoard.review', color: '#ff9800', chipColor: 'warning', items: reviewItems.value },
  { key: 'approved', titleKey: 'reviewBoard.approved', color: '#2196f3', chipColor: 'info', items: approvedItems.value },
  { key: 'published', titleKey: 'reviewBoard.published', color: '#4caf50', chipColor: 'success', items: publishedItems.value },
  { key: 'rejected', titleKey: 'reviewBoard.rejected', color: '#f44336', chipColor: 'error', items: rejectedItems.value }
])

function openDetail(reviewId: string) {
  router.push('/review-board/' + reviewId)
}

async function loadData() {
  loading.value = true
  try {
    const [data, metrics] = await Promise.all([
      backend.getReviewBoardData(),
      backend.getMetricsMap()
    ])
    boardData.value = data || []
    metricsMap.value = metrics
  } catch (e) {
    console.error('Failed to load review board:', e)
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <v-card elevation="0" class="review-board-page" style="overflow: auto; height: 100%;">
    <!-- Header -->
    <div class="d-flex align-center justify-space-between mb-4 px-2">
      <div>
        <h2 class="text-h5 font-weight-bold">{{ $t('reviewBoard.title') }}</h2>
        <p class="text-body-2 text-medium-emphasis mt-1">{{ $t('reviewBoard.subtitle') }}</p>
      </div>
      <div class="d-flex align-center gap-3">
        <v-chip color="warning" variant="tonal" size="small">
          <v-icon start size="16">mdi-clock-outline</v-icon>
          {{ reviewCount }} {{ $t('reviewBoard.inReview') }}
        </v-chip>
      </div>
    </div>

    <!-- Tabs -->
    <v-tabs v-model="activeTab" density="compact" class="mb-4">
      <v-tab value="active">
        {{ $t('reviewBoard.activeTab') || 'Active' }}
        <v-chip size="x-small" variant="tonal" color="primary" class="ml-2">{{ activeData.length }}</v-chip>
      </v-tab>
      <v-tab value="cancelled">
        {{ $t('reviewBoard.cancelledTab') || 'Cancelled' }}
        <v-chip size="x-small" variant="tonal" color="grey" class="ml-2">{{ cancelledData.length }}</v-chip>
      </v-tab>
    </v-tabs>

    <!-- Loading -->
    <div v-if="loading" class="d-flex justify-center py-12">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <!-- Active Board -->
    <div v-else-if="activeTab === 'active'" class="board-columns">
      <div v-for="col in columns" :key="col.key" class="board-column">
        <div class="column-header" :style="{ borderTopColor: col.color }">
          <span class="text-subtitle-2 font-weight-bold">{{ $t(col.titleKey) }}</span>
          <v-chip size="x-small" :color="col.chipColor" variant="tonal">{{ col.items.length }}</v-chip>
        </div>
        <div class="column-body">
          <template v-if="col.items.length > 0">
            <ReviewBoardCard
              v-for="item in col.items"
              :key="item.review_id || item.proc_def_id"
              :item="item"
              @click="openDetail"
            />
          </template>
          <div v-else class="empty-column text-center py-8">
            <v-icon size="32" color="grey-lighten-2">mdi-inbox-outline</v-icon>
            <div class="text-caption text-medium-emphasis mt-2">No processes</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Cancelled List -->
    <div v-else-if="activeTab === 'cancelled'">
      <div v-if="cancelledData.length === 0" class="text-center py-12">
        <v-icon size="48" color="grey-lighten-2">mdi-cancel</v-icon>
        <div class="text-body-2 text-medium-emphasis mt-3">{{ $t('reviewBoard.noCancelled') || 'No cancelled reviews' }}</div>
      </div>
      <div v-else class="cancelled-list">
        <ReviewBoardCard
          v-for="item in cancelledData"
          :key="item.review_id || item.proc_def_id"
          :item="item"
          @click="openDetail"
        />
      </div>
    </div>
  </v-card>
</template>

<style scoped>
.review-board-page {
  padding: 24px;
  background: #fafafa;
}
.board-columns {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  min-height: calc(100vh - 320px);
}
.board-column {
  flex: 1;
  min-width: 280px;
  max-width: 340px;
  background: #f8fafb;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  border: 1px solid #eef1f5;
}
.column-header {
  padding: 14px 16px;
  border-top: 3px solid;
  border-radius: 12px 12px 0 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
}
.column-body {
  padding: 8px 12px;
  flex: 1;
  overflow-y: auto;
}
.empty-column {
  opacity: 0.6;
}
.cancelled-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
  padding: 0 4px;
}
</style>
