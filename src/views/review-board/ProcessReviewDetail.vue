<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { formatDistanceToNowStrict, format } from 'date-fns'
import BackendFactory from '@/components/api/BackendFactory'
import BpmnUengineViewer from '@/components/BpmnUengineViewer.vue'
import OwnerSelect from '@/components/ui/OwnerSelect.vue'
import { computeBpmnDiff, type BpmnChange } from '@/utils/bpmnDiff'

const route = useRoute()
const router = useRouter()
const backend = BackendFactory.createBackend() as any

// State
const loading = ref(true)
const actionLoading = ref(false)
const processName = ref('')
const currentXml = ref('')
const prevXml = ref('')
const reviewVersion = ref('')
const compareFromVersion = ref('')
const changes = ref<BpmnChange[]>([])
const diffActivities = ref<Record<string, string>>({})
const diffActivitiesPrev = ref<Record<string, string>>({})
const history = ref<any[]>([])
const approvalState = ref<any>(null)
const metricsMap = ref<any>(null)
const comment = ref('')
const viewerKey = ref(0)
const viewerKeyPrev = ref(0)

// Current user
const currentUserId = ref('')
const currentUserName = ref('')

// Reviewer assignment dialog
const showReviewerDialog = ref(false)
const selectedReviewerId = ref('')
const selectedReviewerObj = ref<any>(null)

// Reassign dialog
const showReassignDialog = ref(false)
const reassignReviewerId = ref('')
const reassignReviewerObj = ref<any>(null)

// Cancel dialog
const showCancelDialog = ref(false)

const reviewId = computed(() => route.params.reviewId as string)

const domainName = computed(() => {
  if (!approvalState.value?.domain_id || !metricsMap.value) return ''
  const domains = metricsMap.value.domains || []
  const domain = domains.find((d: any) => d.id === approvalState.value.domain_id)
  return domain?.name || ''
})

const domainColor = computed(() => {
  if (!approvalState.value?.domain_id || !metricsMap.value) return '#0085db'
  const domains = metricsMap.value.domains || []
  const domain = domains.find((d: any) => d.id === approvalState.value.domain_id)
  return domain?.color || '#0085db'
})

const addedCount = computed(() => changes.value.filter(c => c.type === 'added').length)
const removedCount = computed(() => changes.value.filter(c => c.type === 'removed').length)

const currentState = computed(() => approvalState.value?.state || 'draft')
const isCompleted = computed(() => currentState.value === 'confirmed')
const isRejected = computed(() => currentState.value === 'rejected')
const isCancelled = computed(() => currentState.value === 'cancelled')
const isFinished = computed(() => isCompleted.value || isRejected.value || isCancelled.value)

// 담당자 권한 체크
const assignedReviewerId = computed(() => approvalState.value?.assigned_reviewer_id || '')
const assignedReviewerName = computed(() => approvalState.value?.assigned_reviewer_name || '')
const hasAssignedReviewer = computed(() => !!assignedReviewerId.value)

const canApproveOrReject = computed(() => {
  if (isFinished.value) return false
  // 담당자 미지정 → 누구나 가능
  if (!hasAssignedReviewer.value) return true
  // 담당자 지정 → 본인만 가능
  return currentUserId.value === assignedReviewerId.value
})

const approveButtonLabel = computed(() => {
  const state = currentState.value
  if (state === 'approved_level2') return 'Publish'
  if (state === 'approved_level1') return 'Approve (L2)'
  return 'Approve'
})

function getInitials(name: string): string {
  if (!name) return '??'
  return name.substring(0, 2).toUpperCase()
}

function getActionColor(action: string): string {
  const colorMap: Record<string, string> = {
    submit: 'warning',
    approve_level1: 'info',
    approve_level2: 'primary',
    confirm: 'success',
    reject: 'error',
    reopen: 'grey',
    reassign: 'primary',
    cancel: 'warning',
    comment: 'grey'
  }
  return colorMap[action] || 'grey'
}

function formatTime(dateStr: string): string {
  if (!dateStr) return ''
  try {
    return formatDistanceToNowStrict(new Date(dateStr), { addSuffix: true })
  } catch {
    return dateStr
  }
}

function formatExactTime(dateStr: string): string {
  if (!dateStr) return ''
  try {
    return format(new Date(dateStr), 'yyyy-MM-dd HH:mm:ss')
  } catch {
    return dateStr
  }
}

async function loadCurrentUser() {
  const supabase = (window as any).$supabase
  if (!supabase) return
  try {
    const { data: authData } = await supabase.auth.getUser()
    if (authData?.user) {
      currentUserId.value = authData.user.id
      const { data: userData } = await supabase
        .from('users')
        .select('username, email')
        .eq('id', authData.user.id)
        .limit(1)
        .maybeSingle()
      currentUserName.value = userData?.username || authData.user.email || 'Anonymous'
    }
  } catch (e) {
    console.warn('Failed to get current user:', e)
  }
}

async function loadData() {
  loading.value = true
  try {
    const id = reviewId.value
    if (!id) return

    // 현재 사용자 정보 로드
    if (!currentUserId.value) {
      await loadCurrentUser()
    }

    // reviewId(UUID)로 리뷰 건 조회
    const state = await backend.getApprovalStateById(id)
    if (!state) {
      // 하위호환: proc_def_id로 최신 리뷰 조회
      const fallbackState = await backend.getApprovalState(id)
      approvalState.value = fallbackState
    } else {
      approvalState.value = state
    }

    // 리뷰 건의 이력 + 메트릭 조회
    const reviewStateId = approvalState.value?.id
    const procDefId = approvalState.value?.proc_def_id

    const [historyData, metrics] = await Promise.all([
      reviewStateId ? backend.getApprovalHistory(reviewStateId, true) : backend.getApprovalHistory(id),
      backend.getMetricsMap()
    ])

    history.value = historyData || []
    metricsMap.value = metrics
    reviewVersion.value = approvalState.value?.version || ''

    // Load BPMN data
    if (procDefId) {
      await loadBpmnData(procDefId)
    }
  } catch (e) {
    console.error('loadData error:', e)
  } finally {
    loading.value = false
  }
}

async function loadBpmnData(procDefId: string) {
  try {
    const supabase = (window as any).$supabase
    if (!supabase) return

    const { data: procDef, error: procDefError } = await supabase
      .from('proc_def')
      .select('*')
      .eq('id', procDefId)
      .maybeSingle()

    if (procDefError) throw procDefError

    currentXml.value = procDef?.bpmn || ''
    prevXml.value = ''
    processName.value = procDef?.name || procDefId

    // proc_def_version 전체 목록 조회 (timeStamp 내림차순)
    const { data: versions, error: versionsError } = await supabase
      .from('proc_def_version')
      .select('*')
      .eq('proc_def_id', procDefId)
      .eq('tenant_id', (window as any).$tenantName)
      .order('timeStamp', { ascending: false })
      .limit(10)

    if (versionsError) {
      console.warn('proc_def_version query error:', versionsError)
    }

    if (versions && versions.length > 0) {
      const version = reviewVersion.value

      // 현재 리뷰 버전 찾기 (문자열/숫자 모두 대응)
      let currentVer: any = null
      let currentVerIdx = -1

      if (version) {
        currentVerIdx = versions.findIndex((v: any) => String(v.version) === String(version))
        currentVer = currentVerIdx >= 0 ? versions[currentVerIdx] : null
      }

      // 버전 매칭 실패 시 최신 버전 사용
      if (!currentVer) {
        currentVer = versions[0]
        currentVerIdx = 0
        reviewVersion.value = currentVer.version
      }

      // 현재 버전 XML 로드
      if (currentVer?.snapshot) {
        currentXml.value = currentVer.snapshot
      }

      // 이전 버전 찾기 (현재 버전 바로 다음 = 더 오래된 버전)
      const prevVer = currentVerIdx < versions.length - 1 ? versions[currentVerIdx + 1] : null

      if (prevVer?.snapshot && currentXml.value) {
        compareFromVersion.value = prevVer.version
        prevXml.value = prevVer.snapshot
        const diff = computeBpmnDiff(prevVer.snapshot, currentXml.value)
        console.log('[ReviewDetail] BPMN diff result:', {
          changesCount: diff.changes.length,
          changes: diff.changes,
          diffActivitiesA: diff.diffActivitiesA,
          diffActivitiesB: diff.diffActivitiesB,
          prevVersion: prevVer.version,
          currentVersion: currentVer.version
        })
        changes.value = diff.changes
        diffActivities.value = diff.diffActivitiesA
        diffActivitiesPrev.value = diff.diffActivitiesB
      }
    }

    viewerKey.value++
    viewerKeyPrev.value++
  } catch (e) {
    console.error('loadBpmnData error:', e)
  }
}

function handleApprove() {
  const state = approvalState.value?.state || 'draft'
  if (state === 'approved_level2') {
    // 최종 확정은 다음 담당자 지정 불필요 - 바로 처리
    doApprove()
  } else {
    // 1차/2차 승인은 다음 담당자 지정 다이얼로그
    selectedReviewerId.value = ''
    selectedReviewerObj.value = null
    showReviewerDialog.value = true
  }
}

async function doApprove(assignedReviewer?: { id: string; name: string }) {
  actionLoading.value = true
  try {
    const id = approvalState.value?.id || reviewId.value
    const state = approvalState.value?.state || 'draft'
    const c = comment.value || undefined

    if (state === 'review') {
      await backend.approveLevel1(id, c, assignedReviewer)
    } else if (state === 'approved_level1') {
      await backend.approveLevel2(id, c, assignedReviewer)
    } else if (state === 'approved_level2') {
      await backend.confirmDefinition(id, c)
    } else {
      return
    }

    comment.value = ''
    showReviewerDialog.value = false
    await loadData()
  } catch (e) {
    console.error('handleApprove error:', e)
  } finally {
    actionLoading.value = false
  }
}

function confirmReviewerAndApprove() {
  const reviewer = selectedReviewerObj.value
    ? { id: selectedReviewerObj.value.id, name: selectedReviewerObj.value.name }
    : undefined
  doApprove(reviewer)
}

function onReviewerSelect(member: any) {
  selectedReviewerObj.value = member
}

// 권한 위임 (Reassign)
function openReassignDialog() {
  reassignReviewerId.value = ''
  reassignReviewerObj.value = null
  showReassignDialog.value = true
}

function onReassignSelect(member: any) {
  reassignReviewerObj.value = member
}

async function confirmReassign() {
  if (!reassignReviewerObj.value) return
  actionLoading.value = true
  try {
    const rid = approvalState.value?.id
    if (!rid) return
    const supabase = (window as any).$supabase
    if (!supabase) return

    const newReviewer = {
      id: reassignReviewerObj.value.id,
      name: reassignReviewerObj.value.name
    }

    // assigned_reviewer 업데이트
    const { error } = await supabase
      .from('proc_def_approval_state')
      .update({
        assigned_reviewer_id: newReviewer.id,
        assigned_reviewer_name: newReviewer.name,
        updated_at: new Date().toISOString()
      })
      .eq('id', rid)

    if (error) throw error

    // 이력 기록
    await supabase.from('proc_def_approval_history').insert({
      proc_def_id: approvalState.value?.proc_def_id,
      review_id: rid,
      action: 'reassign',
      from_state: approvalState.value?.state,
      to_state: approvalState.value?.state,
      actor_id: currentUserId.value,
      actor_name: currentUserName.value,
      comment: `Reassigned to ${newReviewer.name}`,
      tenant_id: (window as any).$tenantName
    })

    showReassignDialog.value = false
    await loadData()
  } catch (e) {
    console.error('reassign error:', e)
  } finally {
    actionLoading.value = false
  }
}

async function handleReject() {
  if (!comment.value) return
  actionLoading.value = true
  try {
    const id = approvalState.value?.id || reviewId.value
    await backend.rejectDefinition(id, comment.value)
    comment.value = ''
    await loadData()
  } catch (e) {
    console.error('handleReject error:', e)
  } finally {
    actionLoading.value = false
  }
}

async function handleComment() {
  if (!comment.value) return
  actionLoading.value = true
  try {
    const supabase = (window as any).$supabase
    if (!supabase) return

    let actorId = 'anonymous'
    let actorName = 'Anonymous'
    try {
      const { data: authData } = await supabase.auth.getUser()
      if (authData?.user) {
        actorId = authData.user.id
        const { data: userData } = await supabase
          .from('users')
          .select('username, email')
          .eq('id', authData.user.id)
          .limit(1)
          .maybeSingle()
        actorName = userData?.username || authData.user.email || 'Anonymous'
      }
    } catch (e) { /* fallback to anonymous */ }

    await supabase.from('proc_def_approval_history').insert({
      proc_def_id: approvalState.value?.proc_def_id || reviewId.value,
      review_id: approvalState.value?.id || null,
      action: 'comment',
      from_state: approvalState.value?.state || 'draft',
      to_state: approvalState.value?.state || 'draft',
      actor_id: actorId,
      actor_name: actorName,
      comment: comment.value,
      tenant_id: (window as any).$tenantName
    })

    comment.value = ''
    await loadData()
  } catch (e) {
    console.error('handleComment error:', e)
  } finally {
    actionLoading.value = false
  }
}

async function handleCancel() {
  actionLoading.value = true
  try {
    const id = approvalState.value?.id || reviewId.value
    await backend.cancelApproval(id, comment.value || undefined)
    comment.value = ''
    showCancelDialog.value = false
    await loadData()
  } catch (e) {
    console.error('handleCancel error:', e)
  } finally {
    actionLoading.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <v-card elevation="0" class="review-detail-page" style="overflow: auto; height: 100%;">
    <!-- Loading -->
    <div v-if="loading" class="d-flex justify-center align-center" style="height: 60vh">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <template v-else>
      <!-- Header -->
      <div class="detail-header d-flex align-center mb-4">
        <v-btn variant="text" size="small" @click="router.push('/review-board')">
          <v-icon start>mdi-arrow-left</v-icon>
          {{ $t('reviewBoard.backToBoard') }}
        </v-btn>
      </div>

      <div class="detail-body">
        <!-- Left Panel -->
        <div class="detail-left">
          <!-- Process Info -->
          <div class="d-flex align-center gap-2 mb-3">
            <h3 class="text-h6 font-weight-bold">{{ processName }}</h3>
            <v-chip v-if="reviewVersion" size="small" variant="tonal" color="primary">v{{ reviewVersion }}</v-chip>
            <v-chip v-if="domainName" size="small" :color="domainColor" variant="tonal">{{ domainName }}</v-chip>
          </div>

          <!-- Version comparison info -->
          <div v-if="changes.length > 0" class="d-flex align-center gap-2 mb-3">
            <span class="text-body-2 text-medium-emphasis">
              {{ $t('reviewBoard.comparing') }} v{{ compareFromVersion }} → v{{ reviewVersion }}
            </span>
            <v-chip size="x-small" color="success" variant="flat">{{ addedCount }} {{ $t('reviewBoard.added') }}</v-chip>
            <v-chip size="x-small" color="error" variant="flat">{{ removedCount }} {{ $t('reviewBoard.removed') }}</v-chip>
            <span v-if="changes.filter(c => c.type === 'modified').length > 0">
              <v-chip size="x-small" color="warning" variant="flat">{{ changes.filter(c => c.type === 'modified').length }} {{ $t('reviewBoard.modified') || 'Modified' }}</v-chip>
            </span>
          </div>

          <!-- Before / After BPMN Viewers -->
          <div v-if="prevXml" class="bpmn-compare-container mb-4">
            <!-- Before (Old Version) -->
            <v-card variant="outlined" rounded="lg" class="bpmn-compare-panel">
              <div class="bpmn-compare-bar">
                <span class="bpmn-compare-badge badge-before">{{ $t('reviewBoard.before') || 'Before' }}</span>
                <span v-if="compareFromVersion" class="text-caption text-medium-emphasis ml-2">v{{ compareFromVersion }}</span>
              </div>
              <div class="bpmn-compare-canvas">
                <BpmnUengineViewer
                  :key="'prev-' + viewerKeyPrev"
                  :bpmn="prevXml"
                  :diffActivities="diffActivitiesPrev"
                />
              </div>
            </v-card>
            <!-- After (New Version) -->
            <v-card variant="outlined" rounded="lg" class="bpmn-compare-panel">
              <div class="bpmn-compare-bar">
                <span class="bpmn-compare-badge badge-after">{{ $t('reviewBoard.after') || 'After' }}</span>
                <span v-if="reviewVersion" class="text-caption text-medium-emphasis ml-2">v{{ reviewVersion }}</span>
              </div>
              <div class="bpmn-compare-canvas">
                <BpmnUengineViewer
                  :key="'curr-' + viewerKey"
                  :bpmn="currentXml"
                  :diffActivities="diffActivities"
                />
              </div>
            </v-card>
          </div>

          <!-- Single BPMN Viewer (이전 버전 없는 경우) -->
          <v-card v-else variant="outlined" rounded="lg" class="mb-4">
            <div style="height: 400px; position: relative">
              <BpmnUengineViewer
                v-if="currentXml"
                :key="viewerKey"
                :bpmn="currentXml"
                :diffActivities="diffActivities"
              />
              <div v-else class="d-flex justify-center align-center" style="height: 100%">
                <span class="text-medium-emphasis">No BPMN data available</span>
              </div>
            </div>
          </v-card>

          <!-- Diff Legend -->
          <div v-if="changes.length > 0" class="diff-legend mb-3">
            <span class="legend-item">
              <span class="legend-dot dot-added"></span>
              {{ $t('reviewBoard.added') }}
            </span>
            <span class="legend-item">
              <span class="legend-dot dot-modified"></span>
              {{ $t('reviewBoard.modified') || 'Modified' }}
            </span>
            <span class="legend-item">
              <span class="legend-dot dot-removed"></span>
              {{ $t('reviewBoard.removed') }}
            </span>
          </div>

          <!-- Change Summary -->
          <v-card v-if="changes.length > 0" variant="outlined" rounded="lg">
            <v-card-title class="text-subtitle-2">
              <v-icon start size="18">mdi-format-list-checks</v-icon>
              {{ $t('reviewBoard.changeSummary') }}
            </v-card-title>
            <v-card-text>
              <div v-for="change in changes" :key="change.id" class="d-flex align-center py-1">
                <v-icon
                  size="16"
                  class="mr-2"
                  :color="change.type === 'added' ? 'success' : change.type === 'removed' ? 'error' : 'warning'"
                >
                  {{ change.type === 'added' ? 'mdi-plus-circle' : change.type === 'removed' ? 'mdi-minus-circle' : 'mdi-pencil-circle' }}
                </v-icon>
                <span class="text-body-2">{{ change.description }}</span>
              </div>
            </v-card-text>
          </v-card>
        </div>

        <!-- Right Panel -->
        <div class="detail-right">
          <v-card variant="outlined" rounded="lg" class="h-100">
            <v-card-title class="text-subtitle-1 font-weight-bold">
              {{ $t('reviewBoard.approvalHistory') }}
            </v-card-title>
            <v-card-text class="timeline-container">
              <!-- Assigned Reviewer -->
              <v-alert
                v-if="approvalState?.assigned_reviewer_name && !isCompleted"
                variant="tonal"
                density="compact"
                color="primary"
                class="mb-3"
              >
                <div class="d-flex align-center">
                  <v-icon size="16" class="mr-2">mdi-account-arrow-right</v-icon>
                  <span class="text-body-2">
                    {{ $t('reviewBoard.assignNextReviewer') }}: <strong>{{ approvalState.assigned_reviewer_name }}</strong>
                  </span>
                </div>
              </v-alert>

              <!-- Timeline -->
              <v-timeline density="compact" side="end" class="mb-4">
                <v-timeline-item
                  v-for="(entry, idx) in history"
                  :key="idx"
                  :dot-color="getActionColor(entry.action)"
                  size="small"
                >
                  <div class="d-flex align-center mb-1">
                    <v-avatar size="24" :color="getActionColor(entry.action)" class="mr-2">
                      <span class="text-caption text-white">{{ getInitials(entry.actor_name || entry.actor_id) }}</span>
                    </v-avatar>
                    <span class="text-body-2 font-weight-medium">{{ entry.actor_name || entry.actor_id }}</span>
                    <v-chip size="x-small" :color="getActionColor(entry.action)" variant="tonal" class="ml-2">
                      {{ entry.action }}
                    </v-chip>
                  </div>
                  <div v-if="entry.comment" class="text-body-2 text-medium-emphasis ml-8">
                    {{ entry.comment }}
                  </div>
                  <v-tooltip :text="formatExactTime(entry.created_at)" location="top">
                    <template #activator="{ props: tooltipProps }">
                      <div v-bind="tooltipProps" class="text-caption text-medium-emphasis ml-8" style="cursor: default;">
                        {{ formatTime(entry.created_at) }}
                      </div>
                    </template>
                  </v-tooltip>
                </v-timeline-item>
              </v-timeline>

              <div v-if="history.length === 0" class="text-center py-4">
                <span class="text-medium-emphasis text-body-2">No approval history yet</span>
              </div>
            </v-card-text>

            <!-- Published Banner -->
            <v-alert
              v-if="isCompleted"
              type="success"
              variant="tonal"
              density="compact"
              class="mx-4 mb-2"
              icon="mdi-check-decagram"
            >
              {{ $t('reviewBoard.publishedComplete') || '이 프로세스는 배포 완료되었습니다.' }}
            </v-alert>

            <!-- Cancelled Banner -->
            <v-alert
              v-if="isCancelled"
              type="warning"
              variant="tonal"
              density="compact"
              class="mx-4 mb-2"
              icon="mdi-cancel"
            >
              {{ $t('reviewBoard.cancelledMessage') || '이 리뷰는 취소되었습니다.' }}
            </v-alert>

            <!-- Permission notice -->
            <v-alert
              v-if="hasAssignedReviewer && !canApproveOrReject && !isFinished"
              variant="tonal"
              density="compact"
              color="warning"
              class="mx-4 mb-2"
            >
              <div class="d-flex align-center">
                <v-icon size="16" class="mr-2">mdi-lock-outline</v-icon>
                <span class="text-body-2">
                  {{ $t('reviewBoard.assignedTo') }} <strong>{{ assignedReviewerName }}</strong>
                </span>
              </div>
            </v-alert>

            <!-- Comment + Actions -->
            <v-card-actions class="flex-column pa-4">
              <v-textarea
                v-model="comment"
                :placeholder="$t('reviewBoard.addComment')"
                rows="3"
                variant="outlined"
                density="compact"
                hide-details
                class="mb-3 w-100"
              />
              <div class="d-flex gap-2 w-100 flex-wrap">
                <v-btn
                  v-if="!isFinished"
                  color="success"
                  variant="flat"
                  size="small"
                  :disabled="actionLoading || !canApproveOrReject"
                  @click="handleApprove"
                >
                  <v-icon start size="16">mdi-check</v-icon>
                  {{ approveButtonLabel }}
                </v-btn>
                <v-btn
                  v-if="!isFinished"
                  color="error"
                  variant="flat"
                  size="small"
                  :disabled="actionLoading || !comment || !canApproveOrReject"
                  @click="handleReject"
                >
                  <v-icon start size="16">mdi-close</v-icon>
                  {{ $t('reviewBoard.requestChanges') }}
                </v-btn>
                <v-btn
                  v-if="!isFinished"
                  variant="tonal"
                  color="primary"
                  size="small"
                  :disabled="actionLoading"
                  @click="openReassignDialog"
                >
                  <v-icon start size="16">mdi-account-switch</v-icon>
                  {{ $t('reviewBoard.reassign') }}
                </v-btn>
                <v-btn
                  v-if="!isFinished"
                  variant="tonal"
                  color="grey"
                  size="small"
                  :disabled="actionLoading"
                  @click="showCancelDialog = true"
                >
                  <v-icon start size="16">mdi-cancel</v-icon>
                  {{ $t('reviewBoard.cancelApproval') }}
                </v-btn>
                <v-btn
                  variant="outlined"
                  size="small"
                  :disabled="actionLoading || !comment"
                  @click="handleComment"
                >
                  <v-icon start size="16">mdi-comment-outline</v-icon>
                  {{ $t('reviewBoard.comment') }}
                </v-btn>
              </div>
            </v-card-actions>
          </v-card>
        </div>
      </div>
    </template>

    <!-- Reviewer Assignment Dialog -->
    <v-dialog v-model="showReviewerDialog" max-width="440" persistent>
      <v-card rounded="lg">
        <v-card-title class="text-subtitle-1 font-weight-bold">
          <v-icon start size="20" color="primary">mdi-account-arrow-right</v-icon>
          {{ $t('reviewBoard.assignNextReviewer') }}
        </v-card-title>
        <v-card-text>
          <p class="text-body-2 text-medium-emphasis mb-3">{{ $t('reviewBoard.selectReviewer') }}</p>
          <OwnerSelect
            v-model="selectedReviewerId"
            :placeholder="$t('reviewBoard.selectReviewer')"
            density="compact"
            hide-details
            @select="onReviewerSelect"
          />
        </v-card-text>
        <v-card-actions class="px-4 pb-4">
          <v-spacer />
          <v-btn variant="text" size="small" @click="showReviewerDialog = false">
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn
            color="success"
            variant="flat"
            size="small"
            :loading="actionLoading"
            @click="confirmReviewerAndApprove"
          >
            <v-icon start size="16">mdi-check</v-icon>
            {{ approveButtonLabel }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Reassign Dialog -->
    <v-dialog v-model="showReassignDialog" max-width="440" persistent>
      <v-card rounded="lg">
        <v-card-title class="text-subtitle-1 font-weight-bold">
          <v-icon start size="20" color="primary">mdi-account-switch</v-icon>
          {{ $t('reviewBoard.reassign') }}
        </v-card-title>
        <v-card-text>
          <p class="text-body-2 text-medium-emphasis mb-3">{{ $t('reviewBoard.reassignDesc') }}</p>
          <OwnerSelect
            v-model="reassignReviewerId"
            :placeholder="$t('reviewBoard.selectReviewer')"
            density="compact"
            hide-details
            @select="onReassignSelect"
          />
        </v-card-text>
        <v-card-actions class="px-4 pb-4">
          <v-spacer />
          <v-btn variant="text" size="small" @click="showReassignDialog = false">
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            size="small"
            :loading="actionLoading"
            :disabled="!reassignReviewerObj"
            @click="confirmReassign"
          >
            <v-icon start size="16">mdi-check</v-icon>
            {{ $t('common.confirm') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Cancel Approval Dialog -->
    <v-dialog v-model="showCancelDialog" max-width="440" persistent>
      <v-card rounded="lg">
        <v-card-title class="text-subtitle-1 font-weight-bold">
          <v-icon start size="20" color="warning">mdi-cancel</v-icon>
          {{ $t('reviewBoard.cancelApproval') }}
        </v-card-title>
        <v-card-text>
          <p class="text-body-2 text-medium-emphasis mb-3">
            {{ $t('reviewBoard.cancelApprovalDesc') }}
          </p>
          <v-textarea
            v-model="comment"
            :placeholder="$t('reviewBoard.cancelReason')"
            rows="2"
            variant="outlined"
            density="compact"
            hide-details
          />
        </v-card-text>
        <v-card-actions class="px-4 pb-4">
          <v-spacer />
          <v-btn variant="text" size="small" @click="showCancelDialog = false">
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn
            color="warning"
            variant="flat"
            size="small"
            :loading="actionLoading"
            @click="handleCancel"
          >
            <v-icon start size="16">mdi-cancel</v-icon>
            {{ $t('reviewBoard.confirmCancel') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<style scoped>
.review-detail-page {
  padding: 24px;
  background: #fafafa;
}
.detail-body {
  display: flex;
  gap: 24px;
}
.detail-left {
  flex: 1;
  min-width: 0;
}
.detail-right {
  width: 380px;
  flex-shrink: 0;
}
.timeline-container {
  max-height: calc(100vh - 400px);
  overflow-y: auto;
}
/* Before / After comparison */
.bpmn-compare-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.bpmn-compare-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.bpmn-compare-bar {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #eee;
  flex-shrink: 0;
}
.bpmn-compare-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 12px;
  white-space: nowrap;
}
.badge-before {
  background: #fce4ec;
  color: #c62828;
}
.badge-after {
  background: #e8f5e9;
  color: #2e7d32;
}
.bpmn-compare-canvas {
  height: 320px;
  position: relative;
  overflow: hidden;
  background: #fafafa;
}
/* Diff legend */
.diff-legend {
  display: flex;
  gap: 16px;
  font-size: 12px;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #666;
}
.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.dot-added { background: #4caf50; }
.dot-modified { background: #ff9800; }
.dot-removed { background: #f44336; }

@media (max-width: 1024px) {
  .detail-body {
    flex-direction: column;
  }
  .detail-right {
    width: 100%;
  }
}
</style>
