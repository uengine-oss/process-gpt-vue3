<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { differenceInDays } from 'date-fns'
import BackendFactory from '@/components/api/BackendFactory'
import ReviewBoardCard from './ReviewBoardCard.vue'

const backend = BackendFactory.createBackend() as any
const router = useRouter()

const loading = ref(false)
const boardData = ref<any[]>([])
const metricsMap = ref<any>(null)
const selectedItem = ref<any>(null)
const sidebarOpen = ref(false)
const sidebarHistory = ref<any[]>([])
const sidebarLoading = ref(false)

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

// Step flow stats (신규 상태값 기준)
const draftItems = computed(() => enrichedData.value.filter(i => i.state === 'draft' || i.state === 'rejected'))
const reviewItems = computed(() => enrichedData.value.filter(i => i.state === 'in_review' || i.state === 'review'))
const publicFeedbackItems = computed(() => enrichedData.value.filter(i => i.state === 'public_feedback'))
const finalEditItems = computed(() => enrichedData.value.filter(i => i.state === 'final_edit'))
const publishedItems = computed(() => enrichedData.value.filter(i => i.state === 'published' || i.state === 'confirmed'))
const reopenItems = computed(() => enrichedData.value.filter(i => i.state === 'reopen_requested'))
const archivedItems = computed(() => enrichedData.value.filter(i => i.state === 'archived'))

// Critical alerts
const urgentItems = computed(() => {
  const now = new Date()
  return enrichedData.value.filter(item => {
    if (['published', 'confirmed', 'cancelled', 'archived'].includes(item.state)) return false
    // 공람 D-7 이하
    if (item.state === 'public_feedback' && item.public_feedback_ends_at) {
      const daysLeft = differenceInDays(new Date(item.public_feedback_ends_at), now)
      if (daysLeft <= 7 && daysLeft >= 0) return true
    }
    if (item.updated_at) {
      const daysSinceUpdate = differenceInDays(now, new Date(item.updated_at))
      if (daysSinceUpdate >= 7) return true
    }
    return false
  })
})

// Kanban columns
const kanbanColumns = computed(() => [
  {
    key: 'draft',
    label: 'Draft',
    color: '#78909c',
    chipColor: 'grey',
    icon: 'mdi-file-edit-outline',
    items: draftItems.value
  },
  {
    key: 'in_review',
    label: 'Expert Review',
    color: '#f59e0b',
    chipColor: 'warning',
    icon: 'mdi-magnify',
    items: reviewItems.value
  },
  {
    key: 'public_feedback',
    label: 'Public Feedback',
    color: '#8b5cf6',
    chipColor: 'purple',
    icon: 'mdi-account-group-outline',
    items: publicFeedbackItems.value
  },
  {
    key: 'final_edit',
    label: 'Final Edit',
    color: '#3b82f6',
    chipColor: 'info',
    icon: 'mdi-pencil-outline',
    items: finalEditItems.value
  },
  {
    key: 'published',
    label: 'Published',
    color: '#10b981',
    chipColor: 'success',
    icon: 'mdi-rocket-launch-outline',
    items: publishedItems.value
  }
])

// Step flow pipeline steps
const pipelineSteps = computed(() => [
  { label: 'Draft', count: draftItems.value.length, color: '#78909c', active: draftItems.value.length > 0 },
  { label: 'Expert Review', count: reviewItems.value.length, color: '#f59e0b', active: reviewItems.value.length > 0 },
  { label: 'Public Feedback', count: publicFeedbackItems.value.length, color: '#8b5cf6', active: publicFeedbackItems.value.length > 0 },
  { label: 'Final Edit', count: finalEditItems.value.length, color: '#3b82f6', active: finalEditItems.value.length > 0 },
  { label: 'Published', count: publishedItems.value.length, color: '#10b981', active: publishedItems.value.length > 0 }
])


function openDetail(reviewId: string) {
  router.push('/review-board/' + reviewId)
}

async function openSidebar(item: any) {
  selectedItem.value = item
  sidebarOpen.value = true
  sidebarLoading.value = true
  try {
    const procDefId = item.proc_def_id
    if (procDefId) {
      // 2.3: Cross-version timeline (전체 리뷰 사이클 + 이력)
      const timeline = await backend.getCrossVersionTimeline(procDefId)
      sidebarHistory.value = timeline || []
    } else {
      const id = item.review_id || item.id
      if (id) {
        const historyData = await backend.getApprovalHistory(id, true)
        sidebarHistory.value = historyData || []
      }
    }
  } catch (e) {
    sidebarHistory.value = []
  } finally {
    sidebarLoading.value = false
  }
}

function closeSidebar() {
  sidebarOpen.value = false
  selectedItem.value = null
}

function getActionColor(action: string): string {
  const colorMap: Record<string, string> = {
    submit: 'warning',
    approve_level1: 'info',
    approve_level2: 'primary',
    approve_hq: 'success',
    approve_field: 'success',
    confirm: 'success',
    publish: 'success',
    reject: 'error',
    reject_hq: 'error',
    reject_field: 'error',
    reopen: 'grey',
    reassign: 'primary',
    cancel: 'warning',
    comment: 'grey',
    end_public_feedback: 'info',
  }
  return colorMap[action] || 'grey'
}

function getActionLabel(action: string): string {
  const labelMap: Record<string, string> = {
    submit: '상신',
    approve_level1: '1차 승인',
    approve_level2: '2차 승인',
    approve_hq: 'HQ 승인',
    approve_field: 'Field 승인',
    confirm: '최종 확정',
    publish: '배포',
    reject: '반려',
    reject_hq: 'HQ 반려',
    reject_field: 'Field 반려',
    reopen: '재상신',
    reassign: '담당자 변경',
    cancel: '취소',
    comment: '코멘트',
    end_public_feedback: '공람 종료',
  }
  return labelMap[action] || action
}

function getStateLabel(state: string): string {
  const map: Record<string, string> = {
    draft: '초안', review: '검토중', in_review: '검토중',
    public_feedback: '전사 공람', final_edit: '최종 편집',
    confirmed: '배포 완료', published: '배포 완료',
    rejected: '반려', cancelled: '취소', archived: '아카이브',
  }
  return map[state] || state
}

function getStateColor(state: string): string {
  const map: Record<string, string> = {
    draft: 'grey', review: 'warning', in_review: 'warning',
    public_feedback: 'purple', final_edit: 'info',
    confirmed: 'success', published: 'success',
    rejected: 'error', cancelled: 'grey',
  }
  return map[state] || 'grey'
}

function formatTime(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    return d.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return dateStr }
}

function getInitials(name: string): string {
  if (!name) return '??'
  return name.substring(0, 2).toUpperCase()
}

function getDaysStalled(updatedAt: string): number {
  if (!updatedAt) return 0
  return differenceInDays(new Date(), new Date(updatedAt))
}

function getDueAlertLabel(item: any): string | null {
  const now = new Date()
  if (item.due_date) {
    const daysLeft = differenceInDays(new Date(item.due_date), now)
    if (daysLeft <= 7 && daysLeft >= 0) return `D-${daysLeft}`
  }
  if (item.updated_at) {
    const daysSinceUpdate = differenceInDays(now, new Date(item.updated_at))
    if (daysSinceUpdate >= 7) return `${daysSinceUpdate}일 정체`
  }
  return null
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

// ── Realtime: 상태 변경 시 Toast + 자동 갱신 ──
let realtimeChannel: any = null
const globalToast = ref<{ message: string; color: string } | null>(null)

function showGlobalToast(message: string, color = 'success') {
  globalToast.value = { message, color }
  setTimeout(() => { globalToast.value = null }, 5000)
}

const stateMessages: Record<string, (name: string) => string> = {
  public_feedback: (n) => `"${n}" 전문가 검토 완료. 전사 30일 공람 기간이 시작되었습니다.`,
  final_edit: (n) => `"${n}" 공람 종료. 최종 편집 단계로 이동했습니다.`,
  published: (n) => `"${n}" 프로세스가 배포 완료되었습니다.`,
  rejected: (n) => `"${n}" 프로세스가 반려되었습니다.`,
  reopen_requested: (n) => `"${n}" 현장 개선 요청이 등록되었습니다.`,
}

function setupRealtime() {
  const supabase = (window as any).$supabase
  if (!supabase) return

  realtimeChannel = supabase
    .channel('review-board-global')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'proc_def_approval_state',
      },
      (payload: any) => {
        const newState = payload.new?.state
        const oldState = payload.old?.state
        const procDefId = payload.new?.proc_def_id
        const oldKeys = Object.keys(payload.old || {})
        const hasOldState = oldKeys.includes('state')
        // REPLICA IDENTITY FULL 미적용 시 boardData에서 로컬 상태 참조
        const localItem = boardData.value.find(i => i.proc_def_id === procDefId)
        const localState = localItem?.state
        const effectiveOldState = hasOldState ? oldState : localState

        console.log('[Realtime Board] UPDATE:', {
          procDefId,
          newState,
          oldState,
          localState,
          effectiveOldState,
          hasOldState,
          oldKeysCount: oldKeys.length,
          stateChanged: newState !== effectiveOldState,
        })

        if (newState && newState !== effectiveOldState) {
          const name = localItem?.process_name || procDefId || ''
          const msgFn = stateMessages[newState]
          if (msgFn) {
            showGlobalToast(msgFn(name), newState === 'rejected' ? 'error' : 'success')
          }
        }
        loadData()
      }
    )
    .subscribe((status: string) => {
      console.log('[Realtime Board] Subscription status:', status)
    })
}

function cleanupRealtime() {
  if (realtimeChannel) {
    const supabase = (window as any).$supabase
    if (supabase) supabase.removeChannel(realtimeChannel)
    realtimeChannel = null
  }
}

onMounted(async () => {
  await loadData()
  setupRealtime()
})

onBeforeUnmount(cleanupRealtime)
</script>

<template>
  <div class="review-board-root">
    <!-- ── Page Header (Figma 스타일) ── -->
    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">Process Review &amp; Approval Board</h1>
        <p class="page-subtitle">Manage process lifecycle from draft to publication</p>
      </div>
      <div class="page-header-right">
        <span v-if="reviewItems.length > 0" class="in-review-badge">
          {{ reviewItems.length }} In Review
        </span>
        <v-btn
          variant="tonal"
          color="primary"
          size="small"
          rounded="lg"
          @click="router.push('/my-inbox')"
        >
          <v-icon start size="16">mdi-inbox-multiple-outline</v-icon>
          내 수신함
        </v-btn>
      </div>
    </div>

    <!-- ── Step-flow Pipeline Bar ── -->
    <div class="pipeline-bar">
      <div class="pipeline-inner">
        <div
          v-for="(step, idx) in pipelineSteps"
          :key="step.label"
          class="pipeline-step"
          :class="{ 'pipeline-step--active': step.active }"
        >
          <div class="pipeline-step-content">
            <div class="pipeline-count" :style="{ color: step.color }">
              {{ step.count }}
            </div>
            <div class="pipeline-label">{{ step.label }}</div>
          </div>
          <div v-if="idx < pipelineSteps.length - 1" class="pipeline-arrow">
            <v-icon size="16" color="grey-lighten-1">mdi-chevron-right</v-icon>
          </div>
        </div>
      </div>
      <div class="pipeline-total">
        <span class="text-caption text-medium-emphasis">전체</span>
        <span class="text-subtitle-2 font-weight-bold ml-1">{{ enrichedData.length }}</span>
        <span class="text-caption text-medium-emphasis ml-1">건</span>
      </div>
    </div>

    <!-- ── Critical Alert Bar ── -->
    <div v-if="urgentItems.length > 0" class="alert-bar">
      <v-icon size="16" color="error" class="mr-2">mdi-alert-circle</v-icon>
      <span class="alert-bar-text">주의 필요</span>
      <div class="alert-chips">
        <v-chip
          v-for="item in urgentItems.slice(0, 5)"
          :key="item.review_id || item.proc_def_id"
          size="x-small"
          color="error"
          variant="tonal"
          class="alert-chip"
          @click="openSidebar(item)"
        >
          <v-icon start size="10">mdi-clock-alert-outline</v-icon>
          {{ item.process_name }}
          <span class="ml-1 font-weight-bold">{{ getDueAlertLabel(item) }}</span>
        </v-chip>
        <span v-if="urgentItems.length > 5" class="text-caption text-medium-emphasis ml-1">
          외 {{ urgentItems.length - 5 }}건
        </span>
      </div>
    </div>

    <div class="board-layout">
      <!-- ── Left: Kanban ── -->
      <div class="board-main">
        <!-- Kanban Board -->
        <div v-if="loading" class="d-flex justify-center py-12">
          <v-progress-circular indeterminate color="primary" />
        </div>
        <div v-else class="kanban-board">
          <div
            v-for="col in kanbanColumns"
            :key="col.key"
            class="kanban-column"
          >
            <!-- Column Header -->
            <div class="kanban-col-header" :style="{ borderTopColor: col.color }">
              <div class="d-flex align-center gap-2">
                <v-icon :color="col.color" size="16">{{ col.icon }}</v-icon>
                <span class="kanban-col-title">{{ col.label }}</span>
              </div>
              <v-chip size="x-small" :color="col.chipColor" variant="tonal" class="kanban-col-count">
                {{ col.items.length }}
              </v-chip>
            </div>

            <!-- Column Body -->
            <div class="kanban-col-body">
              <template v-if="col.items.length > 0">
                <ReviewBoardCard
                  v-for="item in col.items"
                  :key="item.review_id || item.proc_def_id"
                  :item="item"
                  :stalled-days="getDaysStalled(item.updated_at)"
                  @click="openDetail"
                  @sidebar="openSidebar"
                />
              </template>
              <div v-else class="kanban-empty">
                <v-icon size="28" color="grey-lighten-2">mdi-inbox-outline</v-icon>
                <div class="text-caption text-medium-emphasis mt-2">항목 없음</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Right: Audit Sidebar ── -->
      <transition name="sidebar-slide">
        <div v-if="sidebarOpen" class="audit-sidebar">
          <div class="audit-sidebar-header">
            <div class="d-flex align-center gap-2 flex-1 min-w-0">
              <v-icon size="18" color="primary">mdi-timeline-clock-outline</v-icon>
              <span class="text-subtitle-2 font-weight-bold text-truncate">
                {{ selectedItem?.process_name }}
              </span>
            </div>
            <v-btn icon size="x-small" variant="text" @click="closeSidebar">
              <v-icon size="16">mdi-close</v-icon>
            </v-btn>
          </div>

          <!-- Item metadata -->
          <div v-if="selectedItem" class="audit-meta">
            <div class="d-flex align-center gap-2 flex-wrap">
              <v-chip size="x-small" :color="selectedItem.domain_color" variant="flat">
                {{ selectedItem.domain_name || 'N/A' }}
              </v-chip>
              <v-chip v-if="selectedItem.version" size="x-small" variant="tonal" color="grey">
                v{{ selectedItem.version }}
              </v-chip>
              <v-chip
                size="x-small"
                :color="selectedItem.state === 'confirmed' ? 'success' : selectedItem.state === 'rejected' ? 'error' : 'warning'"
                variant="tonal"
              >
                {{ selectedItem.state }}
              </v-chip>
            </div>
            <v-btn
              size="small"
              variant="flat"
              color="primary"
              class="mt-3 w-100"
              @click="openDetail(selectedItem.review_id || selectedItem.proc_def_id)"
            >
              <v-icon start size="16">mdi-open-in-new</v-icon>
              상세 보기
            </v-btn>
          </div>

          <!-- Governance Timeline -->
          <div class="audit-timeline-section">
            <div class="text-caption text-medium-emphasis font-weight-medium mb-3 px-1">
              거버넌스 타임라인
            </div>

            <div v-if="sidebarLoading" class="d-flex justify-center py-6">
              <v-progress-circular indeterminate color="primary" size="20" />
            </div>

            <div v-else-if="sidebarHistory.length === 0" class="text-center py-6">
              <v-icon size="32" color="grey-lighten-2">mdi-timeline-outline</v-icon>
              <div class="text-caption text-medium-emphasis mt-2">이력이 없습니다</div>
            </div>

            <!-- 2.3: Cross-version timeline with cycle separators -->
            <div v-else class="audit-timeline-list">
              <template v-for="(entry, idx) in sidebarHistory" :key="idx">
                <!-- Cycle start: 리뷰 사이클 구분선 -->
                <div v-if="entry.type === 'cycle_start'" class="audit-cycle-divider">
                  <div class="audit-cycle-line"></div>
                  <div class="audit-cycle-chip">
                    <v-chip size="x-small" variant="tonal" color="primary" class="mr-1">
                      <v-icon start size="10">mdi-refresh-circle</v-icon>
                      {{ entry.version ? 'v' + entry.version : '리뷰 사이클' }}
                    </v-chip>
                    <v-chip size="x-small" :color="getStateColor(entry.state)" variant="flat">
                      {{ getStateLabel(entry.state) }}
                    </v-chip>
                  </div>
                  <div class="text-caption text-medium-emphasis mt-1 px-1">{{ formatTime(entry.created_at) }}</div>
                </div>

                <!-- Action entry: 개별 이력 -->
                <div v-else class="audit-entry">
                  <div class="audit-entry-dot" :style="{ background: getActionColor(entry.action) === 'grey' ? '#9ca3af' : '' }">
                    <v-icon size="10" color="white">mdi-circle-small</v-icon>
                  </div>
                  <div class="audit-entry-body">
                    <div class="d-flex align-center gap-2 mb-1">
                      <v-avatar size="20" :color="getActionColor(entry.action)">
                        <span class="audit-avatar-text">{{ getInitials(entry.actor_name || entry.actor_id) }}</span>
                      </v-avatar>
                      <span class="text-caption font-weight-medium">{{ entry.actor_name || entry.actor_id }}</span>
                      <v-chip size="x-small" :color="getActionColor(entry.action)" variant="tonal">
                        {{ getActionLabel(entry.action) }}
                      </v-chip>
                    </div>
                    <div v-if="entry.comment" class="audit-comment">{{ entry.comment }}</div>
                    <div v-if="entry.resolved" class="audit-resolved">
                      <v-icon size="10" color="success">mdi-check-circle</v-icon>
                      <span class="text-caption">Resolved</span>
                    </div>
                    <div class="text-caption text-medium-emphasis">{{ formatTime(entry.created_at) }}</div>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>
      </transition>
    </div>

    <!-- ── Global Toast (Realtime 알림) ── -->
    <transition name="toast-slide">
      <div v-if="globalToast" class="global-toast" :class="`global-toast--${globalToast.color}`">
        <v-icon size="16" class="mr-2">
          {{ globalToast.color === 'success' ? 'mdi-check-circle' : globalToast.color === 'error' ? 'mdi-alert-circle' : 'mdi-information' }}
        </v-icon>
        {{ globalToast.message }}
        <button class="global-toast-close" @click="globalToast = null">
          <v-icon size="14">mdi-close</v-icon>
        </button>
      </div>
    </transition>
  </div>
</template>

<style scoped>
/* ── Root ── */
.review-board-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f5f7fa;
  overflow: hidden;
}

/* ── Page Header (Figma) ── */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px 14px;
  background: #fff;
  border-bottom: 1px solid #e8ecf0;
  border-radius: 16px 16px 0 0;
  flex-shrink: 0;
}
.page-header-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.page-title {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.3;
  margin: 0;
}
.page-subtitle {
  font-size: 12px;
  color: #64748b;
  margin: 0;
}
.page-header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
/* "2 In Review" badge — Figma 우상단 주황 뱃지 */
.in-review-badge {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 20px;
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fde68a;
  white-space: nowrap;
}

/* ── Pipeline Bar ── */
.pipeline-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background: #fff;
  border-radius: 16px;
  margin: 12px 16px 0;
  flex-shrink: 0;
}
.pipeline-inner {
  display: flex;
  align-items: center;
  gap: 0;
}
.pipeline-step {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pipeline-step-content {
  text-align: center;
  padding: 0 12px;
  opacity: 0.4;
  transition: opacity 0.2s;
}
.pipeline-step--active .pipeline-step-content {
  opacity: 1;
}
.pipeline-count {
  font-size: 20px;
  font-weight: 700;
  line-height: 1;
}
.pipeline-label {
  font-size: 11px;
  color: #666;
  margin-top: 2px;
  white-space: nowrap;
}
.pipeline-arrow {
  opacity: 0.4;
}
.pipeline-total {
  display: flex;
  align-items: center;
}

/* ── Alert Bar ── */
.alert-bar {
  display: flex;
  align-items: center;
  padding: 8px 24px;
  background: #fff3f3;
  border: 1px solid #fecdd3;
  border-radius: 16px;
  margin: 12px 16px 0;
  flex-shrink: 0;
  gap: 8px;
}
.alert-bar-text {
  font-size: 12px;
  font-weight: 600;
  color: #dc2626;
  white-space: nowrap;
}
.alert-chips {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.alert-chip {
  cursor: pointer;
}

/* ── Layout ── */
.board-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
  position: relative;
}
.board-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Kanban Board ── */
.kanban-board {
  display: flex;
  gap: 12px;
  padding: 16px;
  overflow-x: auto;
  overflow-y: hidden;
  flex: 1;
}
.kanban-column {
  flex: 1;
  min-width: 240px;
  max-width: 320px;
  background: #f0f2f5;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.kanban-col-header {
  padding: 12px 14px;
  border-top: 3px solid;
  border-radius: 16px 16px 0 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  flex-shrink: 0;
}
.kanban-col-title {
  font-size: 13px;
  font-weight: 600;
  color: #1a1a2e;
}
.kanban-col-count {
  font-weight: 700;
}
.kanban-col-body {
  padding: 8px;
  flex: 1;
  overflow-y: auto;
}
.kanban-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  opacity: 0.5;
}

/* ── Audit Sidebar ── */
.audit-sidebar {
  width: 320px;
  flex-shrink: 0;
  background: #fff;
  border-left: 1px solid #e8ecf0;
  border-radius: 16px;
  margin: 12px 12px 12px 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.audit-sidebar-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  border-bottom: 1px solid #e8ecf0;
  flex-shrink: 0;
}
.audit-meta {
  padding: 12px 16px;
  border-bottom: 1px solid #f0f2f5;
  flex-shrink: 0;
}
.audit-timeline-section {
  flex: 1;
  overflow-y: auto;
  padding: 12px 8px;
}
.audit-avatar-text {
  font-size: 9px;
  font-weight: 700;
  color: white;
}
.audit-comment {
  font-size: 11px;
  color: #555;
  background: #f8fafb;
  border-radius: 6px;
  padding: 4px 8px;
  margin: 4px 0;
  border-left: 2px solid #e0e0e0;
}

/* 2.3: Cross-version timeline styles */
.audit-timeline-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.audit-cycle-divider {
  padding: 10px 4px 6px;
  margin-top: 4px;
}
.audit-cycle-divider:first-child {
  margin-top: 0;
}
.audit-cycle-line {
  height: 1px;
  background: linear-gradient(90deg, transparent, #cbd5e1, transparent);
  margin-bottom: 8px;
}
.audit-cycle-divider:first-child .audit-cycle-line {
  display: none;
}
.audit-cycle-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.audit-entry {
  display: flex;
  gap: 8px;
  padding: 6px 4px;
  position: relative;
}
.audit-entry-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #94a3b8;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 3px;
}
.audit-entry-body {
  flex: 1;
  min-width: 0;
}
.audit-resolved {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-top: 2px;
  color: #059669;
}

/* ── Sidebar Transition ── */
.sidebar-slide-enter-active,
.sidebar-slide-leave-active {
  transition: width 0.25s ease, opacity 0.2s ease;
  overflow: hidden;
}
.sidebar-slide-enter-from,
.sidebar-slide-leave-to {
  width: 0;
  opacity: 0;
}
.sidebar-slide-enter-to,
.sidebar-slide-leave-from {
  width: 320px;
  opacity: 1;
}

/* ── Scrollbar ── */
.kanban-board::-webkit-scrollbar,
.kanban-col-body::-webkit-scrollbar,
.audit-timeline-section::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}
.kanban-board::-webkit-scrollbar-thumb,
.kanban-col-body::-webkit-scrollbar-thumb,
.audit-timeline-section::-webkit-scrollbar-thumb {
  background: #d0d7de;
  border-radius: 4px;
}

/* ── Global Toast ── */
.global-toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  padding: 12px 20px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  z-index: 9999;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  white-space: nowrap;
  max-width: 90vw;
}
.global-toast--success { background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }
.global-toast--error   { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
.global-toast--info    { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
.global-toast-close {
  background: none;
  border: none;
  cursor: pointer;
  margin-left: 12px;
  opacity: 0.6;
  padding: 2px;
}
.global-toast-close:hover { opacity: 1; }
.toast-slide-enter-active, .toast-slide-leave-active { transition: all 0.3s ease; }
.toast-slide-enter-from, .toast-slide-leave-to { opacity: 0; transform: translateX(-50%) translateY(12px); }
</style>
