<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { differenceInDays } from 'date-fns'
import BackendFactory from '@/components/api/BackendFactory'

const backend = BackendFactory.createBackend() as any
const router = useRouter()

const loading = ref(false)
const boardData = ref<any[]>([])
const metricsMap = ref<any>(null)
const activeTab = ref('approval')
const reopenActionLoading = ref<string | null>(null)

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

// 탭별 데이터
const approvalItems = computed(() => enrichedData.value.filter(i =>
  ['review', 'in_review', 'approved_level1', 'approved_level2', 'public_feedback', 'final_edit'].includes(i.state)
))
const reopenItems = computed(() => enrichedData.value.filter(i => i.state === 'reopen_requested'))
const submissionItems = computed(() => enrichedData.value.filter(i => i.state !== 'cancelled'))

function getStateLabel(state: string): string {
  const map: Record<string, string> = {
    draft: '초안', in_review: '검토중', review: '검토중',
    public_feedback: '공람중', final_edit: '최종편집',
    published: '배포완료', reopen_requested: '개선요청',
    rejected: '반려', archived: '아카이빙', cancelled: '취소',
    approved_level1: '1차승인', approved_level2: '2차승인'
  }
  return map[state] || state
}

function getStateColor(state: string): string {
  const map: Record<string, string> = {
    draft: 'grey', in_review: 'warning', review: 'warning',
    public_feedback: 'deep-purple', final_edit: 'info',
    published: 'success', reopen_requested: 'orange',
    rejected: 'error', archived: 'blue-grey', cancelled: 'grey'
  }
  return map[state] || 'grey'
}

function formatTime(dateStr: string): string {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleString('ko-KR', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  } catch { return dateStr }
}

function getDueAlertLabel(item: any): string | null {
  const now = new Date()
  if (item.public_feedback_ends_at && item.state === 'public_feedback') {
    const daysLeft = differenceInDays(new Date(item.public_feedback_ends_at), now)
    if (daysLeft <= 7 && daysLeft >= 0) return `D-${daysLeft}`
  }
  if (item.updated_at) {
    const daysSinceUpdate = differenceInDays(now, new Date(item.updated_at))
    if (daysSinceUpdate >= 7) return `${daysSinceUpdate}일 정체`
  }
  return null
}

function openDetail(item: any) {
  const id = item.review_id || item.proc_def_id
  router.push('/review-board/' + id)
}

function openInReviewMode(item: any) {
  const procDefId = item.proc_def_id
  const reviewId = item.review_id || item.id
  if (!procDefId) return
  window.open(`/definitions/chat?id=${procDefId}&reviewMode=true&reviewId=${reviewId}&modeling=true`, '_blank')
}

async function handleApproveReopen(item: any) {
  const rid = item.review_id || item.id
  if (!rid) return
  reopenActionLoading.value = rid
  try {
    await backend.approveReopen(rid)
    await loadData()
  } catch (e) {
    console.error('approveReopen error:', e)
  } finally {
    reopenActionLoading.value = null
  }
}

async function handleRejectReopen(item: any) {
  const rid = item.review_id || item.id
  if (!rid) return
  reopenActionLoading.value = rid
  try {
    await backend.rejectReopen(rid)
    await loadData()
  } catch (e) {
    console.error('rejectReopen error:', e)
  } finally {
    reopenActionLoading.value = null
  }
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
    console.error('Failed to load inbox:', e)
  } finally {
    loading.value = false
  }
}

// ── Realtime: 상태 변경 감지 ──
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
}

function setupRealtime() {
  const supabase = (window as any).$supabase
  if (!supabase) return
  realtimeChannel = supabase
    .channel('inbox-realtime')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'proc_def_approval_state' },
      (payload: any) => {
        const newState = payload.new?.state
        const oldState = payload.old?.state
        const procDefId = payload.new?.proc_def_id
        const oldKeys = Object.keys(payload.old || {})
        const hasOldState = oldKeys.includes('state')
        const localItem = boardData.value.find(i => i.proc_def_id === procDefId)
        const localState = localItem?.state
        const effectiveOldState = hasOldState ? oldState : localState

        console.log('[Realtime Inbox] UPDATE:', { newState, effectiveOldState, hasOldState, procDefId })

        if (newState && newState !== effectiveOldState) {
          const name = localItem?.process_name || procDefId || ''
          const msgFn = stateMessages[newState]
          if (msgFn) showGlobalToast(msgFn(name), newState === 'rejected' ? 'error' : 'success')
        }
        loadData()
      }
    )
    .subscribe()
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
  <div class="inbox-root">
    <!-- Header -->
    <div class="inbox-header">
      <div class="inbox-header-left">
        <v-btn icon size="small" variant="text" @click="router.push('/review-board')" class="mr-2">
          <v-icon>mdi-arrow-left</v-icon>
        </v-btn>
        <div>
          <h1 class="inbox-title">내 수신함</h1>
          <p class="inbox-subtitle">승인 요청, 개선 요청, 내 상신 현황을 관리합니다</p>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="inbox-tabs-wrap">
      <v-tabs v-model="activeTab" color="primary" density="compact" class="inbox-tabs">
        <v-tab value="approval" class="inbox-tab-item">
          <v-icon start size="16">mdi-inbox-arrow-down-outline</v-icon>
          내 승인함
          <v-chip size="x-small" :color="approvalItems.length > 0 ? 'warning' : 'grey'" variant="flat" class="ml-2">
            {{ approvalItems.length }}
          </v-chip>
        </v-tab>
        <v-tab value="reopen" class="inbox-tab-item">
          <v-icon start size="16">mdi-refresh-circle</v-icon>
          개선 요청함
          <v-chip size="x-small" :color="reopenItems.length > 0 ? 'error' : 'grey'" variant="flat" class="ml-2">
            {{ reopenItems.length }}
          </v-chip>
        </v-tab>
        <v-tab value="submissions" class="inbox-tab-item">
          <v-icon start size="16">mdi-send-outline</v-icon>
          내 상신함
          <v-chip size="x-small" color="grey" variant="flat" class="ml-2">
            {{ submissionItems.length }}
          </v-chip>
        </v-tab>
      </v-tabs>
    </div>

    <!-- Content -->
    <div class="inbox-content">
      <div v-if="loading" class="d-flex justify-center py-12">
        <v-progress-circular indeterminate color="primary" />
      </div>

      <template v-else>
        <!-- ── 승인함 탭 ── -->
        <div v-if="activeTab === 'approval'">
          <div v-if="approvalItems.length === 0" class="inbox-empty">
            <v-icon size="48" color="grey-lighten-2">mdi-inbox-outline</v-icon>
            <div class="text-body-2 text-medium-emphasis mt-3">승인 대기 항목이 없습니다</div>
          </div>
          <div v-else class="inbox-list">
            <div
              v-for="item in approvalItems"
              :key="item.review_id || item.proc_def_id"
              class="inbox-card"
              @click="openDetail(item)"
            >
              <div class="inbox-card-top">
                <div class="inbox-card-left">
                  <v-chip size="x-small" :color="item.domain_color" variant="flat" class="inbox-domain">
                    {{ item.domain_name || 'N/A' }}
                  </v-chip>
                  <span class="inbox-proc-name">{{ item.process_name }}</span>
                  <v-chip v-if="item.version_label || item.version" size="x-small" variant="tonal" color="grey" class="ml-1">
                    {{ item.version_label || ('v' + item.version) }}
                  </v-chip>
                  <v-chip v-if="getDueAlertLabel(item)" size="x-small" color="error" variant="tonal" class="ml-1">
                    {{ getDueAlertLabel(item) }}
                  </v-chip>
                </div>
                <div class="inbox-card-right">
                  <v-chip size="x-small" :color="getStateColor(item.state)" variant="tonal">
                    {{ getStateLabel(item.state) }}
                  </v-chip>
                </div>
              </div>
              <div class="inbox-card-meta">
                <span v-if="item.submitted_by" class="meta-item">
                  <v-icon size="12" class="mr-1">mdi-account-outline</v-icon>{{ item.submitted_by }}
                </span>
                <span v-if="item.submitted_at" class="meta-item">
                  <v-icon size="12" class="mr-1">mdi-clock-outline</v-icon>{{ formatTime(item.submitted_at) }}
                </span>
              </div>
              <div class="inbox-card-actions" @click.stop>
                <v-btn size="x-small" variant="flat" color="primary" @click="openInReviewMode(item)">
                  <v-icon start size="12">mdi-magnify</v-icon>
                  Review
                </v-btn>
                <v-btn size="x-small" variant="tonal" color="grey" @click="openDetail(item)">상세</v-btn>
              </div>
            </div>
          </div>
        </div>

        <!-- ── 개선 요청함 탭 ── -->
        <div v-if="activeTab === 'reopen'">
          <div v-if="reopenItems.length === 0" class="inbox-empty">
            <v-icon size="48" color="grey-lighten-2">mdi-refresh-circle</v-icon>
            <div class="text-body-2 text-medium-emphasis mt-3">개선 요청 항목이 없습니다</div>
          </div>
          <div v-else class="inbox-list">
            <div
              v-for="item in reopenItems"
              :key="item.review_id || item.proc_def_id"
              class="inbox-card inbox-card--reopen"
              @click="openDetail(item)"
            >
              <div class="inbox-card-top">
                <div class="inbox-card-left">
                  <v-chip size="x-small" :color="item.domain_color" variant="flat" class="inbox-domain">
                    {{ item.domain_name || 'N/A' }}
                  </v-chip>
                  <span class="inbox-proc-name">{{ item.process_name }}</span>
                </div>
                <v-chip size="x-small" color="warning" variant="tonal">개선 요청</v-chip>
              </div>
              <div v-if="item.reopen_reason" class="inbox-reopen-reason">
                <v-icon size="12" class="mr-1" color="grey">mdi-comment-outline</v-icon>
                {{ item.reopen_reason }}
              </div>
              <div class="inbox-card-meta">
                <span v-if="item.reopen_requested_by" class="meta-item">
                  <v-icon size="12" class="mr-1">mdi-account-outline</v-icon>{{ item.reopen_requested_by }}
                </span>
                <span v-if="item.reopen_requested_at" class="meta-item">
                  <v-icon size="12" class="mr-1">mdi-clock-outline</v-icon>{{ formatTime(item.reopen_requested_at) }}
                </span>
              </div>
              <div class="inbox-card-actions" @click.stop>
                <v-btn
                  size="x-small" color="success" variant="flat"
                  :loading="reopenActionLoading === (item.review_id || item.id)"
                  @click="handleApproveReopen(item)"
                >
                  <v-icon start size="12">mdi-check</v-icon>승인
                </v-btn>
                <v-btn
                  size="x-small" color="error" variant="tonal"
                  :loading="reopenActionLoading === (item.review_id || item.id)"
                  @click="handleRejectReopen(item)"
                >
                  <v-icon start size="12">mdi-close</v-icon>반려
                </v-btn>
                <v-btn size="x-small" variant="tonal" color="grey" @click="openDetail(item)">상세</v-btn>
              </div>
            </div>
          </div>
        </div>

        <!-- ── 내 상신함 탭 ── -->
        <div v-if="activeTab === 'submissions'">
          <div v-if="submissionItems.length === 0" class="inbox-empty">
            <v-icon size="48" color="grey-lighten-2">mdi-send-outline</v-icon>
            <div class="text-body-2 text-medium-emphasis mt-3">상신 항목이 없습니다</div>
          </div>
          <div v-else class="inbox-list">
            <div
              v-for="item in submissionItems"
              :key="item.review_id || item.proc_def_id"
              class="inbox-card"
              @click="openDetail(item)"
            >
              <div class="inbox-card-top">
                <div class="inbox-card-left">
                  <v-chip size="x-small" :color="item.domain_color" variant="flat" class="inbox-domain">
                    {{ item.domain_name || 'N/A' }}
                  </v-chip>
                  <span class="inbox-proc-name">{{ item.process_name }}</span>
                  <v-chip v-if="item.version_label || item.version" size="x-small" variant="tonal" color="grey" class="ml-1">
                    {{ item.version_label || ('v' + item.version) }}
                  </v-chip>
                </div>
                <v-chip size="x-small" :color="getStateColor(item.state)" variant="tonal">
                  {{ getStateLabel(item.state) }}
                </v-chip>
              </div>
              <div class="inbox-card-meta">
                <span v-if="item.submitted_at" class="meta-item">
                  <v-icon size="12" class="mr-1">mdi-clock-outline</v-icon>상신: {{ formatTime(item.submitted_at) }}
                </span>
                <span v-if="item.hq_status" class="meta-item">
                  HQ: <v-chip size="x-small" :color="item.hq_status === 'approved' ? 'success' : item.hq_status === 'rejected' ? 'error' : 'grey'" variant="tonal" class="mx-1">{{ item.hq_status }}</v-chip>
                </span>
                <span v-if="item.field_status" class="meta-item">
                  Field: <v-chip size="x-small" :color="item.field_status === 'approved' ? 'success' : item.field_status === 'rejected' ? 'error' : 'grey'" variant="tonal" class="mx-1">{{ item.field_status }}</v-chip>
                </span>
                <span v-if="item.reject_comment && item.state === 'rejected'" class="meta-item meta-item--error">
                  <v-icon size="12" class="mr-1" color="error">mdi-alert-circle-outline</v-icon>{{ item.reject_comment }}
                </span>
              </div>
              <div class="inbox-card-actions" @click.stop>
                <v-btn
                  v-if="['in_review', 'public_feedback', 'final_edit'].includes(item.state)"
                  size="x-small" variant="flat" color="primary"
                  @click="openInReviewMode(item)"
                >
                  <v-icon start size="12">mdi-magnify</v-icon>Review
                </v-btn>
                <v-btn size="x-small" variant="tonal" color="grey" @click="openDetail(item)">상세</v-btn>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Global Toast -->
    <transition name="toast-slide">
      <div v-if="globalToast" class="global-toast" :class="`global-toast--${globalToast.color}`">
        <v-icon size="16" class="mr-2">
          {{ globalToast.color === 'success' ? 'mdi-check-circle' : 'mdi-alert-circle' }}
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
.inbox-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f5f7fa;
  overflow: hidden;
}

.inbox-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px 14px;
  background: #fff;
  border-radius: 16px 16px 0 0;
  flex-shrink: 0;
}
.inbox-header-left {
  display: flex;
  align-items: center;
}
.inbox-title {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}
.inbox-subtitle {
  font-size: 12px;
  color: #64748b;
  margin: 0;
}

.inbox-tabs-wrap {
  background: #fff;
  border-bottom: 1px solid #e8ecf0;
  flex-shrink: 0;
  padding: 0 16px;
}
.inbox-tabs {
  /* inherits */
}
.inbox-tab-item {
  font-size: 13px;
  text-transform: none;
  min-width: auto;
  letter-spacing: 0;
}

.inbox-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px;
}

.inbox-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px;
  opacity: 0.6;
}

.inbox-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.inbox-card {
  background: #fff;
  border-radius: 12px;
  padding: 14px 16px;
  cursor: pointer;
  transition: box-shadow 0.15s, transform 0.1s;
  border: 1px solid #e8ecf0;
}
.inbox-card:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  transform: translateY(-1px);
}
.inbox-card--reopen {
  border-left: 3px solid #f59e0b;
}

.inbox-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.inbox-card-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}
.inbox-card-right {
  flex-shrink: 0;
}
.inbox-domain {
  flex-shrink: 0;
}
.inbox-proc-name {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a2e;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inbox-reopen-reason {
  font-size: 12px;
  color: #475569;
  padding: 6px 10px;
  background: #fffbeb;
  border-radius: 8px;
  margin-top: 8px;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.inbox-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #f0f2f5;
}
.meta-item {
  display: flex;
  align-items: center;
  font-size: 11px;
  color: #64748b;
}
.meta-item--error {
  color: #dc2626;
}

.inbox-card-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  justify-content: flex-end;
}

.inbox-content::-webkit-scrollbar {
  width: 4px;
}
.inbox-content::-webkit-scrollbar-thumb {
  background: #d0d7de;
  border-radius: 4px;
}

/* Global Toast */
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
.global-toast-close {
  background: none; border: none; cursor: pointer;
  margin-left: 12px; opacity: 0.6; padding: 2px;
}
.global-toast-close:hover { opacity: 1; }
.toast-slide-enter-active, .toast-slide-leave-active { transition: all 0.3s ease; }
.toast-slide-enter-from, .toast-slide-leave-to { opacity: 0; transform: translateX(-50%) translateY(12px); }
</style>
