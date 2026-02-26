<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { formatDistanceToNowStrict, format } from 'date-fns'
import BackendFactory from '@/components/api/BackendFactory'
import BpmnUengineViewer from '@/components/BpmnUengineViewer.vue'
import OwnerSelect from '@/components/ui/OwnerSelect.vue'
import { computeBpmnDiff, type BpmnChange } from '@/utils/bpmnDiff'

const route = useRoute()
const router = useRouter()
const backend = BackendFactory.createBackend() as any

// ── State ──
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

// Snapshot comparison state (Phase 3.4) + 4.3: published/previous/snapshot toggle
const snapshots = ref<any[]>([])
const snapshotCompareMode = ref<'published' | 'previous' | 'snapshot'>('published')
const selectedSnapshotIdx = ref(0)
const snapshotViewerKey = ref(0)

// 4.3: Published / Previous 비교용 XML & 버전 관리
const publishedXml = ref('')
const publishedVersion = ref('')
const previousXml = ref('')
const previousVersion = ref('')

// Current user
const currentUserId = ref('')
const currentUserName = ref('')

// Dialogs
const showReviewerDialog = ref(false)
const selectedReviewerId = ref('')
const selectedReviewerObj = ref<any>(null)

const showReassignDialog = ref(false)
const reassignReviewerId = ref('')
const reassignReviewerObj = ref<any>(null)

const showCancelDialog = ref(false)

// Resolve dialog
const showResolveDialog = ref(false)
const resolveTargetEntry = ref<any>(null)
const resolveActionText = ref('')

// ── Computed ──
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
const modifiedCount = computed(() => changes.value.filter(c => c.type === 'modified').length)

const currentState = computed(() => approvalState.value?.state || 'draft')
const isCompleted = computed(() => currentState.value === 'confirmed' || currentState.value === 'published')
const isRejected = computed(() => currentState.value === 'rejected')
const isCancelled = computed(() => currentState.value === 'cancelled')
const isFinished = computed(() => isCompleted.value || isRejected.value || isCancelled.value)

// 병렬 승인 필드 (HQ / Field)
const hqStatus = computed(() => approvalState.value?.hq_status || 'pending')
const fieldStatus = computed(() => approvalState.value?.field_status || 'pending')
const hqReviewerName = computed(() => approvalState.value?.hq_reviewer_name || '')
const fieldReviewerName = computed(() => approvalState.value?.field_reviewer_name || '')
const hasParallelApproval = computed(() => !!(approvalState.value?.hq_reviewer_name || approvalState.value?.field_reviewer_name || approvalState.value?.hq_status))

// Self-approval block
const isSelfSubmitter = computed(() => {
  const submittedById = approvalState.value?.submitted_by_id || approvalState.value?.owner_id || ''
  return !!currentUserId.value && currentUserId.value === submittedById
})

// 담당자 권한
const assignedReviewerId = computed(() => approvalState.value?.assigned_reviewer_id || '')
const assignedReviewerName = computed(() => approvalState.value?.assigned_reviewer_name || '')
const hasAssignedReviewer = computed(() => !!assignedReviewerId.value)

const canApproveOrReject = computed(() => {
  if (isFinished.value) return false
  if (isSelfSubmitter.value) return false
  if (!hasAssignedReviewer.value) return true
  return currentUserId.value === assignedReviewerId.value
})

const isInReview = computed(() => ['in_review', 'review'].includes(currentState.value))
const canPublishState = computed(() => ['final_edit', 'approved_level2'].includes(currentState.value))
const canApproveHQ = computed(() => isInReview.value && hqStatus.value === 'pending')
const canApproveFieldBtn = computed(() => isInReview.value && fieldStatus.value === 'pending')

// 4.2: Publish 버튼 활성화 조건 (미해결 피드백 0 + 권한 충족)
const canPublish = computed(() => {
    if (!canPublishState.value) return false
    if (!canApproveOrReject.value) return false
    if (unresolvedCount.value > 0) return false
    return true
})
const publishDisabledReason = computed((): string => {
    if (!canApproveOrReject.value) return '승인 권한이 없습니다'
    if (unresolvedCount.value > 0) return `미해결 피드백 ${unresolvedCount.value}건을 해결해야 배포할 수 있습니다`
    return ''
})

// Public feedback D-day 계산
const isPublicFeedback = computed(() => currentState.value === 'public_feedback')
const publicFeedbackEndsAt = computed(() => approvalState.value?.public_feedback_ends_at || null)
const publicFeedbackDaysRemaining = computed((): number | null => {
  if (!publicFeedbackEndsAt.value) return approvalState.value?.public_feedback_days_remaining ?? null
  try {
    const end = new Date(publicFeedbackEndsAt.value)
    const now = new Date()
    return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  } catch {
    return null
  }
})
const publicFeedbackDdayLabel = computed((): string => {
  const d = publicFeedbackDaysRemaining.value
  if (d === null) return ''
  if (d > 0) return `D-${d}`
  if (d === 0) return 'D-Day'
  return `D+${Math.abs(d)}`
})
const publicFeedbackIsUrgent = computed(() => {
  const d = publicFeedbackDaysRemaining.value
  return d !== null && d <= 7
})

// Stage transition toast (스냅샷 저장 후 표시)
const stageToast = ref<{ message: string; color: string } | null>(null)
function showStageToast(message: string, color = 'success') {
  stageToast.value = { message, color }
  setTimeout(() => { stageToast.value = null }, 4000)
}

// Resolution progress (reject 이력 기반)
const rejectEntries = computed(() => history.value.filter(h => h.action === 'reject' && h.comment))
const totalFeedbackCount = computed(() => rejectEntries.value.length)
const resolvedCount = computed(() => rejectEntries.value.filter(h => h.resolved).length)
const unresolvedCount = computed(() => totalFeedbackCount.value - resolvedCount.value)
const resolutionProgress = computed(() => {
  if (totalFeedbackCount.value === 0) return 100
  return Math.round((resolvedCount.value / totalFeedbackCount.value) * 100)
})

// Access type badge
const accessType = computed(() => approvalState.value?.access_type || '')
const accessBadge = computed(() => {
  if (accessType.value === 'Core') return { label: 'Core', color: '#5b21b6', bg: '#ede9fe' }
  if (accessType.value === 'Assurance') return { label: 'Assurance', color: '#92400e', bg: '#fef3c7' }
  if (accessType.value === 'Support') return { label: 'Support', color: '#065f46', bg: '#d1fae5' }
  if (accessType.value === 'Access') return { label: 'Access', color: '#1e40af', bg: '#dbeafe' }
  return null
})

// Snapshot computed (Phase 3.4)
const selectedSnapshot = computed(() => snapshots.value[selectedSnapshotIdx.value] || null)
const snapshotXml = computed(() => selectedSnapshot.value?.bpmn_xml || '')
const snapshotStageLabel = computed((): string => {
  const s = selectedSnapshot.value?.stage || ''
  const map: Record<string, string> = {
    submit: '검토 요청', approve_hq: 'HQ 승인', approve_field: 'Field 승인',
    public_feedback: '전사 공람', final_edit: '최종 편집', publish: '배포'
  }
  return map[s] || s
})

// 4.3: 비교 모드 전환 시 prevXml/compareFromVersion 교체
function switchCompareMode(mode: 'published' | 'previous' | 'snapshot') {
  snapshotCompareMode.value = mode
  if (mode === 'published') {
    prevXml.value = publishedXml.value
    compareFromVersion.value = publishedVersion.value
    if (publishedXml.value && currentXml.value) {
      const diff = computeBpmnDiff(publishedXml.value, currentXml.value)
      changes.value = diff.changes
      diffActivities.value = diff.diffActivitiesA
      diffActivitiesPrev.value = diff.diffActivitiesB
    } else if (!publishedXml.value && currentXml.value) {
      // 최초 제정: 빈 캔버스 대비 전체 추가
      prevXml.value = ''
      changes.value = []
    }
  } else if (mode === 'previous') {
    prevXml.value = previousXml.value
    compareFromVersion.value = previousVersion.value
    if (previousXml.value && currentXml.value) {
      const diff = computeBpmnDiff(previousXml.value, currentXml.value)
      changes.value = diff.changes
      diffActivities.value = diff.diffActivitiesA
      diffActivitiesPrev.value = diff.diffActivitiesB
    }
  }
  viewerKey.value++
  viewerKeyPrev.value++
  snapshotViewerKey.value++
}

// ── Helpers ──
function getInitials(name: string): string {
  if (!name) return '??'
  const firstChar = name.charAt(0)
  if (/[가-힣]/.test(firstChar)) return name.substring(0, 2)
  return name.substring(0, 2).toUpperCase()
}

function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const colors = ['#4f46e5', '#7c3aed', '#059669', '#d97706', '#0284c7', '#0891b2', '#65a30d', '#dc2626']
  return colors[Math.abs(hash) % colors.length]
}

function getActionColorHex(action: string): string {
  const map: Record<string, string> = {
    submit: '#f59e0b',
    approve_level1: '#3b82f6',
    approve_level2: '#8b5cf6',
    confirm: '#10b981',
    reject: '#ef4444',
    reopen: '#6b7280',
    reassign: '#3b82f6',
    cancel: '#f59e0b',
    comment: '#9ca3af',
    approveHQ: '#10b981',
    approveField: '#10b981',
    rejectHQ: '#ef4444',
    rejectField: '#ef4444',
    publish: '#10b981',
  }
  return map[action] || '#9ca3af'
}

function getActionIcon(action: string): string {
  const map: Record<string, string> = {
    submit: 'mdi-send-outline',
    approve_level1: 'mdi-check-circle-outline',
    approve_level2: 'mdi-check-circle',
    confirm: 'mdi-check-decagram',
    reject: 'mdi-close-circle-outline',
    reopen: 'mdi-refresh-circle',
    reassign: 'mdi-account-switch',
    cancel: 'mdi-cancel',
    comment: 'mdi-comment-outline',
    approveHQ: 'mdi-check-circle',
    approveField: 'mdi-check-circle',
    rejectHQ: 'mdi-close-circle',
    rejectField: 'mdi-close-circle',
    publish: 'mdi-rocket-launch-outline',
  }
  return map[action] || 'mdi-circle-outline'
}

function getActionLabel(action: string): string {
  const map: Record<string, string> = {
    submit: 'Submitted',
    approve_level1: 'Approved version',
    approve_level2: 'Approved (L2)',
    confirm: 'Published',
    reject: 'Requested changes',
    reopen: 'Re-opened',
    reassign: 'Reassigned',
    cancel: 'Cancelled',
    comment: 'Added comment',
    approveHQ: 'Approved (HQ)',
    approveField: 'Approved (Field)',
    rejectHQ: 'Rejected (HQ)',
    rejectField: 'Rejected (Field)',
    publish: 'Published',
  }
  return map[action] || action
}

function getActorRole(entry: any): string {
  return entry.actor_role || entry.actor_title || ''
}

function formatTimeAgo(dateStr: string): string {
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

function getStateLabel(state: string): string {
  const map: Record<string, string> = {
    draft: '초안', review: '검토중', in_review: '검토중',
    approved_level1: '1차 승인', approved_level2: '2차 승인',
    public_feedback: '전사 공람', final_edit: '최종 편집',
    confirmed: '배포 완료', published: '배포 완료',
    rejected: '반려', cancelled: '취소', archived: '아카이브'
  }
  return map[state] || state
}

function getStateColor(state: string): string {
  const map: Record<string, string> = {
    draft: 'grey', review: 'warning', in_review: 'warning',
    approved_level1: 'info', approved_level2: 'primary',
    public_feedback: 'secondary', final_edit: 'purple',
    confirmed: 'success', published: 'success',
    rejected: 'error', cancelled: 'grey'
  }
  return map[state] || 'grey'
}

// ── Data Loading ──
async function loadCurrentUser() {
  const supabase = (window as any).$supabase
  if (!supabase) return
  try {
    const { data: authData } = await supabase.auth.getUser()
    if (authData?.user) {
      currentUserId.value = authData.user.id
      const { data: userData } = await supabase
        .from('users').select('username, email')
        .eq('id', authData.user.id).limit(1).maybeSingle()
      currentUserName.value = userData?.username || authData.user.email || 'Anonymous'
    }
  } catch (e) {
    console.warn('Failed to get current user:', e)
  }
}

async function loadData(silent = false) {
  if (!silent) loading.value = true
  try {
    const id = reviewId.value
    if (!id) return

    if (!currentUserId.value) await loadCurrentUser()

    const state = await backend.getApprovalStateById(id)
    approvalState.value = state || await backend.getApprovalState(id)

    const reviewStateId = approvalState.value?.id
    const procDefId = approvalState.value?.proc_def_id

    const [historyData, metrics] = await Promise.all([
      reviewStateId ? backend.getApprovalHistory(reviewStateId, true) : backend.getApprovalHistory(id),
      backend.getMetricsMap()
    ])

    history.value = historyData || []
    metricsMap.value = metrics
    reviewVersion.value = approvalState.value?.version || approvalState.value?.version_label || ''

    if (procDefId) await loadBpmnData(procDefId)

    // Load snapshots for Phase 3.4
    const rid = approvalState.value?.id
    if (rid) {
      try {
        const snaps = await backend.getSnapshots(rid)
        snapshots.value = snaps || []
      } catch { /* ignore */ }
    }
  } catch (e) {
    console.error('loadData error:', e)
  } finally {
    if (!silent) loading.value = false
  }
}

async function loadBpmnData(procDefId: string) {
  try {
    const supabase = (window as any).$supabase
    if (!supabase) return

    const { data: procDef } = await supabase
      .from('proc_def').select('*').eq('id', procDefId).maybeSingle()

    currentXml.value = procDef?.bpmn || ''
    prevXml.value = ''
    processName.value = procDef?.name || procDefId

    const { data: versions } = await supabase
      .from('proc_def_version').select('*')
      .eq('proc_def_id', procDefId)
      .eq('tenant_id', (window as any).$tenantName)
      .order('timeStamp', { ascending: false }).limit(10)

    if (versions && versions.length > 0) {
      const version = reviewVersion.value
      let currentVerIdx = version
        ? versions.findIndex((v: any) => String(v.version) === String(version))
        : -1

      const currentVer = currentVerIdx >= 0 ? versions[currentVerIdx] : versions[0]
      if (currentVerIdx < 0) {
        currentVerIdx = 0
        reviewVersion.value = currentVer.version
      }

      if (currentVer?.snapshot) currentXml.value = currentVer.snapshot

      // 4.3: Published 버전 찾기 (version_tag === 'published')
      const publishedVer = versions.find((v: any) => v.version_tag === 'published')
      if (publishedVer?.snapshot) {
        publishedXml.value = publishedVer.snapshot
        publishedVersion.value = publishedVer.version + ' (Published)'
      } else {
        // 최초 제정: Published 버전 없음
        publishedXml.value = ''
        publishedVersion.value = '(없음)'
      }

      // 4.3: 직전 버전 저장
      const prevVer = currentVerIdx < versions.length - 1 ? versions[currentVerIdx + 1] : null
      if (prevVer?.snapshot) {
        previousXml.value = prevVer.snapshot
        previousVersion.value = prevVer.version
      } else {
        previousXml.value = ''
        previousVersion.value = ''
      }

      // 기본 비교: Published baseline 모드
      if (publishedXml.value && currentXml.value) {
        compareFromVersion.value = publishedVersion.value
        prevXml.value = publishedXml.value
        const diff = computeBpmnDiff(publishedXml.value, currentXml.value)
        changes.value = diff.changes
        diffActivities.value = diff.diffActivitiesA
        diffActivitiesPrev.value = diff.diffActivitiesB
        snapshotCompareMode.value = 'published'
      } else if (prevVer?.snapshot && currentXml.value) {
        // Published 없으면 직전 버전으로 fallback
        compareFromVersion.value = prevVer.version
        prevXml.value = prevVer.snapshot
        const diff = computeBpmnDiff(prevVer.snapshot, currentXml.value)
        changes.value = diff.changes
        diffActivities.value = diff.diffActivitiesA
        diffActivitiesPrev.value = diff.diffActivitiesB
        snapshotCompareMode.value = 'previous'
      }
    }
    viewerKey.value++
    viewerKeyPrev.value++
  } catch (e) {
    console.error('loadBpmnData error:', e)
  }
}

// ── Actions ──
async function handleApproveHQ() {
  actionLoading.value = true
  try {
    const id = approvalState.value?.id || reviewId.value
    const c = comment.value || undefined
    await backend.approveHQ(id, c)
    comment.value = ''
    await loadData(true)
    const newState = approvalState.value?.state || ''
    if (newState === 'public_feedback') showStageToast('전사 공람 단계로 이동했습니다', 'success')
    else showStageToast('HQ 승인 완료', 'success')
  } catch (e: any) {
    console.error('approveHQ error:', e)
  } finally {
    actionLoading.value = false
  }
}

async function handleApproveField() {
  actionLoading.value = true
  try {
    const id = approvalState.value?.id || reviewId.value
    const c = comment.value || undefined
    await backend.approveField(id, c)
    comment.value = ''
    await loadData(true)
    const newState = approvalState.value?.state || ''
    if (newState === 'public_feedback') showStageToast('전사 공람 단계로 이동했습니다', 'success')
    else showStageToast('Field 승인 완료', 'success')
  } catch (e: any) {
    console.error('approveField error:', e)
  } finally {
    actionLoading.value = false
  }
}

async function handleEndPublicFeedback() {
  actionLoading.value = true
  try {
    const id = approvalState.value?.id || reviewId.value
    const c = comment.value || '공람 조기 종료'
    await backend.endPublicFeedback(id, c)
    comment.value = ''
    await loadData(true)
    showStageToast('최종 편집 단계로 이동했습니다', 'success')
  } catch (e: any) {
    console.error('endPublicFeedback error:', e)
  } finally {
    actionLoading.value = false
  }
}

async function handlePublish() {
  actionLoading.value = true
  try {
    const id = approvalState.value?.id || reviewId.value
    const c = comment.value || undefined
    await backend.publishDefinition(id, c)
    comment.value = ''
    await loadData(true)
    showStageToast('배포 완료되었습니다', 'success')
  } catch (e: any) {
    console.error('publish error:', e)
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
    await loadData(true)
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
    let actorId = 'anonymous', actorName = 'Anonymous'
    try {
      const { data: authData } = await supabase.auth.getUser()
      if (authData?.user) {
        actorId = authData.user.id
        const { data: userData } = await supabase
          .from('users').select('username, email')
          .eq('id', authData.user.id).limit(1).maybeSingle()
        actorName = userData?.username || authData.user.email || 'Anonymous'
      }
    } catch { /* ignore */ }

    await supabase.from('proc_def_approval_history').insert({
      proc_def_id: approvalState.value?.proc_def_id || reviewId.value,
      review_id: approvalState.value?.id || null,
      action: 'comment',
      from_state: approvalState.value?.state || 'draft',
      to_state: approvalState.value?.state || 'draft',
      actor_id: actorId, actor_name: actorName,
      comment: comment.value,
      tenant_id: (window as any).$tenantName
    })
    comment.value = ''
    await loadData(true)
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
    await loadData(true)
  } catch (e) {
    console.error('handleCancel error:', e)
  } finally {
    actionLoading.value = false
  }
}

function openReassignDialog() {
  reassignReviewerId.value = ''
  reassignReviewerObj.value = null
  showReassignDialog.value = true
}

async function confirmReassign() {
  if (!reassignReviewerObj.value) return
  actionLoading.value = true
  try {
    const rid = approvalState.value?.id
    if (!rid) return
    const supabase = (window as any).$supabase
    if (!supabase) return
    const newReviewer = { id: reassignReviewerObj.value.id, name: reassignReviewerObj.value.name }
    await supabase.from('proc_def_approval_state').update({
      assigned_reviewer_id: newReviewer.id,
      assigned_reviewer_name: newReviewer.name,
      updated_at: new Date().toISOString()
    }).eq('id', rid)
    await supabase.from('proc_def_approval_history').insert({
      proc_def_id: approvalState.value?.proc_def_id,
      review_id: rid, action: 'reassign',
      from_state: approvalState.value?.state, to_state: approvalState.value?.state,
      actor_id: currentUserId.value, actor_name: currentUserName.value,
      comment: `Reassigned to ${newReviewer.name}`,
      tenant_id: (window as any).$tenantName
    })
    showReassignDialog.value = false
    await loadData(true)
  } catch (e) {
    console.error('reassign error:', e)
  } finally {
    actionLoading.value = false
  }
}

// Resolve feedback (조치 내용 필수)
function openResolveDialog(entry: any) {
  resolveTargetEntry.value = entry
  resolveActionText.value = ''
  showResolveDialog.value = true
}

async function confirmResolve() {
  if (!resolveActionText.value.trim()) return
  actionLoading.value = true
  try {
    const supabase = (window as any).$supabase
    if (!supabase) return
    await supabase.from('proc_def_approval_history').update({
      resolved: true,
      resolve_action_text: resolveActionText.value.trim(),
      resolved_at: new Date().toISOString(),
      resolved_by: currentUserName.value
    }).eq('id', resolveTargetEntry.value.id)
    showResolveDialog.value = false
    resolveActionText.value = ''
    await loadData(true)
  } catch (e) {
    console.error('resolve error:', e)
  } finally {
    actionLoading.value = false
  }
}

// ── Supabase Realtime: 상태 변경 감지 ──
let realtimeChannel: any = null

const stateTransitionMessages: Record<string, string> = {
  public_feedback: '전문가 검토 완료. 전사 30일 공람 기간이 시작되었습니다.',
  final_edit: '공람 기간이 종료되어 최종 편집 단계로 이동했습니다.',
  published: '프로세스가 배포 완료되었습니다.',
  rejected: '프로세스가 반려되었습니다.',
  reopen_requested: '현장 개선 요청이 등록되었습니다.',
  draft: '새 버전 초안이 생성되었습니다.',
}

function setupRealtimeSubscription() {
  const supabase = (window as any).$supabase
  if (!supabase) {
    console.warn('[Realtime] supabase not found on window.$supabase')
    return
  }

  const initialTargetId = approvalState.value?.id || reviewId.value
  console.log('[Realtime] Subscribing to proc_def_approval_state, initialTargetId:', initialTargetId, 'approvalState.id:', approvalState.value?.id, 'reviewId:', reviewId.value)

  realtimeChannel = supabase
    .channel(`review-detail-${Date.now()}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'proc_def_approval_state',
      },
      (payload: any) => {
        const payloadId = payload.new?.id
        // 항상 최신 approvalState에서 targetId를 가져옴 (reactive)
        const targetId = approvalState.value?.id || reviewId.value
        const newState = payload.new?.state
        const oldState = payload.old?.state
        // 로컬에서 기억하고 있는 현재 상태 (REPLICA IDENTITY 미적용 시 fallback)
        const localState = approvalState.value?.state
        const oldKeys = Object.keys(payload.old || {})
        const hasOldState = oldKeys.includes('state')

        console.log('[Realtime] UPDATE received:', {
          payloadId,
          targetId,
          match: payloadId === targetId,
          newState,
          oldState,
          localState,
          hasOldState,
          stateChanged: newState !== oldState,
          oldKeysCount: oldKeys.length,
          oldKeys: oldKeys.join(','),
        })

        // 이 리뷰 건에 해당하는 이벤트만 처리
        if (payloadId !== targetId) {
          console.log('[Realtime] Skipping - ID mismatch')
          return
        }

        // 상태 변경 감지: old.state가 있으면 사용, 없으면 로컬 상태와 비교
        const effectiveOldState = hasOldState ? oldState : localState
        if (newState && newState !== effectiveOldState) {
          const msg = stateTransitionMessages[newState]
          console.log('[Realtime] State transition:', effectiveOldState, '→', newState, 'msg:', msg)
          if (msg) {
            showStageToast(msg, newState === 'rejected' ? 'info' : 'success')
          }
        }

        // 병렬 승인 개별 완료 감지 (상태는 아직 in_review이지만 hq/field_status 변경)
        if (newState === 'in_review') {
          const newHq = payload.new?.hq_status
          const oldHq = hasOldState ? payload.old?.hq_status : approvalState.value?.hq_status
          const newField = payload.new?.field_status
          const oldField = hasOldState ? payload.old?.field_status : approvalState.value?.field_status
          if (newHq === 'approved' && oldHq !== 'approved') {
            showStageToast('HQ(본사) 검토가 승인되었습니다.', 'success')
          }
          if (newField === 'approved' && oldField !== 'approved') {
            showStageToast('Field(현업) 검토가 승인되었습니다.', 'success')
          }
          if (newHq === 'rejected' && oldHq !== 'rejected') {
            showStageToast('HQ(본사) 검토가 반려되었습니다.', 'info')
          }
          if (newField === 'rejected' && oldField !== 'rejected') {
            showStageToast('Field(현업) 검토가 반려되었습니다.', 'info')
          }
        }

        // 조용히 데이터 갱신
        loadData(true)
      }
    )
    .subscribe((status: string) => {
      console.log('[Realtime] Subscription status:', status)
    })
}

function cleanupRealtime() {
  if (realtimeChannel) {
    const supabase = (window as any).$supabase
    if (supabase) {
      supabase.removeChannel(realtimeChannel)
    }
    realtimeChannel = null
  }
}

onMounted(async () => {
  await loadData()
  // 초기 데이터 로드 후 Realtime 구독 (approvalState.id 필요)
  setupRealtimeSubscription()
})

onBeforeUnmount(cleanupRealtime)
</script>

<template>
  <div class="rd-root">
    <!-- Loading -->
    <div v-if="loading" class="rd-loading">
      <v-progress-circular indeterminate color="primary" size="40" />
    </div>

    <template v-else>
      <!-- ── Header (Figma 스타일) ── -->
      <div class="rd-header">
        <div class="rd-header-left">
          <button class="rd-back-btn" @click="router.push('/review-board')">
            <v-icon size="16">mdi-arrow-left</v-icon>
            Back to Board
          </button>
          <div class="rd-title-row">
            <h2 class="rd-title">
              {{ processName }}
              <span v-if="reviewVersion" class="rd-title-version">v{{ reviewVersion }}</span>
            </h2>
            <span
              v-if="accessBadge"
              class="rd-access-badge"
              :style="{ background: accessBadge.bg, color: accessBadge.color }"
            >{{ accessBadge.label }}</span>
          </div>
        </div>
        <div class="rd-header-right">
          <v-chip size="small" :color="getStateColor(currentState)" variant="tonal">
            {{ getStateLabel(currentState) }}
          </v-chip>
          <v-btn v-if="!isFinished" size="small" variant="tonal" color="grey" @click="openReassignDialog">
            <v-icon start size="14">mdi-account-switch</v-icon>
            Reassign
          </v-btn>
          <v-btn v-if="!isFinished" size="small" variant="text" color="grey" @click="showCancelDialog = true">
            Cancel Review
          </v-btn>
        </div>
      </div>

      <!-- ── Diff Indicator Bar (Figma: "Comparing v1.9 → v2.0 · Added · Removed") ── -->
      <div v-if="prevXml || changes.length > 0" class="rd-diff-bar">
        <div class="rd-diff-comparing">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2">
            <polyline points="16 3 21 8 16 13"/><line x1="3" y1="8" x2="21" y2="8"/>
            <polyline points="8 21 3 16 8 11"/><line x1="21" y1="16" x2="3" y2="16"/>
          </svg>
          <span>Comparing
            <strong>v{{ compareFromVersion }}</strong>
            <v-icon size="12" color="grey" style="margin: 0 2px">mdi-arrow-right</v-icon>
            <strong>v{{ reviewVersion }}</strong>
          </span>
        </div>
        <div class="rd-diff-legend">
          <span v-if="addedCount > 0" class="rd-diff-pill rd-diff-pill--added">
            <span class="rd-diff-dot rd-diff-dot--added"></span>Added ({{ addedCount }})
          </span>
          <span v-if="removedCount > 0" class="rd-diff-pill rd-diff-pill--removed">
            <span class="rd-diff-dot rd-diff-dot--removed"></span>Removed ({{ removedCount }})
          </span>
          <span v-if="modifiedCount > 0" class="rd-diff-pill rd-diff-pill--modified">
            <span class="rd-diff-dot rd-diff-dot--modified"></span>Modified ({{ modifiedCount }})
          </span>
        </div>
      </div>

      <!-- ── Parallel Approval Status (HQ / Field) ── -->
      <div v-if="hasParallelApproval" class="rd-parallel-bar">
        <span class="rd-parallel-label">병렬 승인:</span>
        <div class="rd-parallel-item" :class="`rd-parallel--${hqStatus}`">
          <v-icon size="14" :color="hqStatus === 'approved' ? 'success' : hqStatus === 'rejected' ? 'error' : 'grey'">
            {{ hqStatus === 'approved' ? 'mdi-check-circle' : hqStatus === 'rejected' ? 'mdi-close-circle' : 'mdi-clock-outline' }}
          </v-icon>
          <span>HQ</span>
          <span v-if="hqReviewerName" class="rd-parallel-name">{{ hqReviewerName }}</span>
        </div>
        <div class="rd-parallel-item" :class="`rd-parallel--${fieldStatus}`">
          <v-icon size="14" :color="fieldStatus === 'approved' ? 'success' : fieldStatus === 'rejected' ? 'error' : 'grey'">
            {{ fieldStatus === 'approved' ? 'mdi-check-circle' : fieldStatus === 'rejected' ? 'mdi-close-circle' : 'mdi-clock-outline' }}
          </v-icon>
          <span>Field</span>
          <span v-if="fieldReviewerName" class="rd-parallel-name">{{ fieldReviewerName }}</span>
        </div>
      </div>

      <!-- ── Public Feedback D-day Banner ── -->
      <div v-if="isPublicFeedback" class="rd-public-banner" :class="{ 'rd-public-banner--urgent': publicFeedbackIsUrgent }">
        <div class="rd-public-banner-left">
          <v-icon size="16" :color="publicFeedbackIsUrgent ? '#dc2626' : '#0284c7'" class="mr-2">mdi-bullhorn-outline</v-icon>
          <span class="rd-public-banner-text">전사 공람 중</span>
          <span v-if="publicFeedbackEndsAt" class="rd-public-banner-end">
            · 종료일 {{ formatExactTime(publicFeedbackEndsAt).substring(0, 10) }}
          </span>
        </div>
        <div class="rd-public-banner-dday" :class="{ 'rd-dday--urgent': publicFeedbackIsUrgent }">
          {{ publicFeedbackDdayLabel }}
        </div>
      </div>


      <!-- ── Resolution Progress Bar ── -->
      <div v-if="totalFeedbackCount > 0 && !isFinished" class="rd-resolution-bar">
        <div class="rd-resolution-text">
          <v-icon size="14" :color="unresolvedCount > 0 ? 'warning' : 'success'">
            {{ unresolvedCount > 0 ? 'mdi-alert-circle-outline' : 'mdi-check-circle-outline' }}
          </v-icon>
          미해결 피드백
          <strong :style="{ color: unresolvedCount > 0 ? '#d97706' : '#059669' }">{{ unresolvedCount }}건</strong>
          / 전체 {{ totalFeedbackCount }}건
        </div>
        <v-progress-linear
          :model-value="resolutionProgress"
          :color="unresolvedCount > 0 ? 'warning' : 'success'"
          bg-color="grey-lighten-3"
          height="6"
          rounded
          class="rd-resolution-progress"
        />
      </div>

      <!-- ── Main Body ── -->
      <div class="rd-body">
        <!-- ── Left: BPMN Diff ── -->
        <div class="rd-left">
          <!-- 4.3: Comparison Toggle Bar (Published / Previous / Snapshot) -->
          <div v-if="snapshots.length > 0 || prevXml || publishedXml || previousXml" class="rd-snap-bar">
            <div class="rd-snap-toggle">
              <button
                v-if="publishedXml"
                class="rd-snap-btn"
                :class="{ 'rd-snap-btn--active': snapshotCompareMode === 'published' }"
                @click="switchCompareMode('published')"
              >
                <v-icon size="13" class="mr-1">mdi-publish</v-icon>
                As-Is (Published) vs Draft
              </button>
              <button
                v-if="previousXml"
                class="rd-snap-btn"
                :class="{ 'rd-snap-btn--active': snapshotCompareMode === 'previous' }"
                @click="switchCompareMode('previous')"
              >
                <v-icon size="13" class="mr-1">mdi-compare</v-icon>
                직전 버전 vs Draft
              </button>
              <button
                v-if="snapshots.length > 0"
                class="rd-snap-btn"
                :class="{ 'rd-snap-btn--active': snapshotCompareMode === 'snapshot' }"
                @click="switchCompareMode('snapshot')"
              >
                <v-icon size="13" class="mr-1">mdi-camera</v-icon>
                스냅샷 비교
                <span class="rd-snap-count">{{ snapshots.length }}</span>
              </button>
            </div>

            <!-- 스냅샷 시점 선택 (snapshot 모드) -->
            <div v-if="snapshotCompareMode === 'snapshot' && snapshots.length > 1" class="rd-snap-select">
              <button
                v-for="(snap, idx) in snapshots"
                :key="snap.id"
                class="rd-snap-chip"
                :class="{ 'rd-snap-chip--active': selectedSnapshotIdx === idx }"
                @click="selectedSnapshotIdx = idx; snapshotViewerKey++"
              >
                {{ snap.stage || `Stage ${idx + 1}` }}
                <span v-if="snap.major_version || snap.minor_version" class="rd-snap-ver">
                  v{{ snap.major_version || 0 }}.{{ snap.minor_version || 0 }}
                </span>
              </button>
            </div>
          </div>

          <!-- Snapshot 뷰어 모드 -->
          <div v-if="snapshotCompareMode === 'snapshot' && snapshotXml" class="rd-bpmn-single rd-snap-viewer">
            <div class="rd-bpmn-bar rd-bpmn-bar--snapshot">
              <span class="rd-bpmn-badge rd-bpmn-badge--snapshot">{{ snapshotStageLabel }}</span>
              <span v-if="selectedSnapshot?.major_version" class="rd-bpmn-ver">
                v{{ selectedSnapshot.major_version }}.{{ selectedSnapshot.minor_version || 0 }}
              </span>
              <span v-if="selectedSnapshot?.created_at" class="rd-bpmn-ver ml-2">
                {{ formatExactTime(selectedSnapshot.created_at).substring(0, 10) }}
              </span>
            </div>
            <div class="rd-bpmn-canvas" style="height: 380px;">
              <BpmnUengineViewer :key="'snap-' + snapshotViewerKey" :bpmn="snapshotXml" />
            </div>
          </div>

          <!-- Before / After viewers (2컬럼 그리드) -->
          <div v-else-if="(snapshotCompareMode === 'published' || snapshotCompareMode === 'previous') && prevXml" class="rd-bpmn-compare">
            <div class="rd-bpmn-panel">
              <div class="rd-bpmn-bar rd-bpmn-bar--before">
                <span class="rd-bpmn-badge rd-bpmn-badge--before">Before</span>
                <span class="rd-bpmn-ver">v{{ compareFromVersion }}</span>
              </div>
              <div class="rd-bpmn-canvas">
                <BpmnUengineViewer :key="'prev-' + viewerKeyPrev" :bpmn="prevXml" :diffActivities="diffActivitiesPrev" />
              </div>
            </div>
            <div class="rd-bpmn-panel">
              <div class="rd-bpmn-bar rd-bpmn-bar--after">
                <span class="rd-bpmn-badge rd-bpmn-badge--after">After</span>
                <span class="rd-bpmn-ver">v{{ reviewVersion }}</span>
              </div>
              <div class="rd-bpmn-canvas">
                <BpmnUengineViewer :key="'curr-' + viewerKey" :bpmn="currentXml" :diffActivities="diffActivities" />
              </div>
            </div>
          </div>

          <!-- Single viewer -->
          <div v-else-if="snapshotCompareMode === 'published' || snapshotCompareMode === 'previous'" class="rd-bpmn-single">
            <BpmnUengineViewer v-if="currentXml" :key="viewerKey" :bpmn="currentXml" :diffActivities="diffActivities" />
            <div v-else class="rd-bpmn-empty">
              <v-icon size="40" color="grey-lighten-2">mdi-file-cancel-outline</v-icon>
              <div class="text-body-2 text-medium-emphasis mt-2">BPMN 데이터가 없습니다</div>
            </div>
          </div>

          <!-- Change Summary (Figma 좌하단 박스) -->
          <div v-if="changes.length > 0" class="rd-change-summary">
            <div class="rd-change-summary-title">Change Summary</div>
            <div class="rd-change-list">
              <div v-for="change in changes" :key="change.id" class="rd-change-item">
                <span class="rd-change-icon">
                  <v-icon
                    size="14"
                    :color="change.type === 'added' ? 'success' : change.type === 'removed' ? 'error' : 'warning'"
                  >{{ change.type === 'added' ? 'mdi-check-circle' : change.type === 'removed' ? 'mdi-minus-circle' : 'mdi-pencil-circle' }}</v-icon>
                </span>
                <span class="rd-change-text" :class="{ 'rd-change-text--removed': change.type === 'removed' }">
                  <span class="rd-change-type">{{ change.type === 'added' ? 'Added:' : change.type === 'removed' ? 'Removed:' : 'Modified:' }}</span>
                  {{ change.description }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Right: Approval History ── -->
        <div class="rd-right">
          <div class="rd-right-inner">
            <!-- Panel header (Figma) -->
            <div class="rd-panel-header">
              <div class="rd-panel-title">Approval History</div>
              <div class="rd-panel-subtitle">Review timeline and add your feedback</div>
            </div>

            <!-- Status banners -->
            <div v-if="isCompleted" class="rd-banner rd-banner--success">
              <v-icon size="16" color="success" class="mr-2">mdi-check-decagram</v-icon>
              배포 완료되었습니다.
            </div>
            <div v-else-if="isRejected" class="rd-banner rd-banner--error">
              <v-icon size="16" color="error" class="mr-2">mdi-close-circle</v-icon>
              반려 처리되었습니다.
            </div>
            <div v-else-if="isCancelled" class="rd-banner rd-banner--warning">
              <v-icon size="16" color="warning" class="mr-2">mdi-cancel</v-icon>
              취소되었습니다.
            </div>

            <!-- Notices -->
            <div v-if="isSelfSubmitter && !isFinished" class="rd-notice rd-notice--error">
              <v-icon size="14" class="mr-1">mdi-account-cancel-outline</v-icon>
              본인이 기안한 프로세스는 직접 승인할 수 없습니다
            </div>
            <div v-else-if="hasAssignedReviewer && !canApproveOrReject && !isFinished" class="rd-notice rd-notice--warning">
              <v-icon size="14" class="mr-1">mdi-lock-outline</v-icon>
              담당자: <strong class="ml-1">{{ assignedReviewerName }}</strong>
            </div>
            <div v-else-if="approvalState?.assigned_reviewer_name && !isCompleted" class="rd-notice rd-notice--info">
              <v-icon size="14" class="mr-1">mdi-account-arrow-right</v-icon>
              다음 담당자: <strong class="ml-1">{{ approvalState.assigned_reviewer_name }}</strong>
            </div>

            <!-- History list (Figma 카드형) -->
            <div class="rd-history-list">
              <div v-if="history.length === 0" class="rd-history-empty">
                <v-icon size="32" color="grey-lighten-2">mdi-timeline-outline</v-icon>
                <div class="text-caption text-medium-emphasis mt-2">아직 이력이 없습니다</div>
              </div>

              <div
                v-for="(entry, idx) in history"
                :key="idx"
                class="rd-history-entry"
                :class="{ 'rd-history-entry--comment': entry.action === 'comment' }"
              >
                <div class="rd-he-line">
                  <div class="rd-he-dot" :style="{ background: getActionColorHex(entry.action) }">
                    <v-icon size="11" color="white">{{ getActionIcon(entry.action) }}</v-icon>
                  </div>
                  <div v-if="idx < history.length - 1" class="rd-he-connector"></div>
                </div>

                <div class="rd-he-card">
                  <div class="rd-he-top">
                    <div class="rd-he-avatar" :style="{ background: getAvatarColor(entry.actor_name || entry.actor_id) }">
                      {{ getInitials(entry.actor_name || entry.actor_id) }}
                    </div>
                    <div class="rd-he-actor">
                      <div class="rd-he-name">{{ entry.actor_name || entry.actor_id }}</div>
                      <div v-if="getActorRole(entry)" class="rd-he-role">{{ getActorRole(entry) }}</div>
                    </div>
                    <v-tooltip :text="formatExactTime(entry.created_at)" location="top">
                      <template #activator="{ props: tp }">
                        <span v-bind="tp" class="rd-he-time">{{ formatTimeAgo(entry.created_at) }}</span>
                      </template>
                    </v-tooltip>
                  </div>

                  <div class="rd-he-action" :style="{ color: getActionColorHex(entry.action) }">
                    {{ getActionLabel(entry.action) }}
                    <span v-if="entry.action === 'approve_level1' && entry.version" class="rd-he-version-ref">
                      {{ entry.version }}
                    </span>
                  </div>

                  <div v-if="entry.comment" class="rd-he-comment">{{ entry.comment }}</div>

                  <div v-if="entry.resolved" class="rd-he-resolved">
                    <v-icon size="12" color="success">mdi-check-circle</v-icon>
                    Resolved: {{ entry.resolve_action_text }}
                  </div>
                  <div v-else-if="entry.action === 'reject' && entry.comment && !entry.resolved && !isFinished" class="rd-he-resolve-row">
                    <button class="rd-resolve-btn" @click="openResolveDialog(entry)">
                      <v-icon size="12">mdi-check</v-icon>
                      Resolve
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- ── Add Comment + Action Buttons (Figma 하단) ── -->
            <div class="rd-action-area">
              <div class="rd-action-label">Add Comment</div>
              <textarea
                v-model="comment"
                placeholder="Share your feedback or approval decision..."
                class="rd-comment-textarea"
                rows="3"
              ></textarea>

              <div v-if="isSelfSubmitter && !isFinished" class="rd-selfblock-hint">
                <v-icon size="12" color="error">mdi-information-outline</v-icon>
                본인 기안 건은 승인 버튼이 비활성화됩니다
              </div>

              <div v-if="!isFinished" class="rd-action-buttons">
                <!-- HQ 승인 (in_review 상태, hq pending) -->
                <button
                  v-if="canApproveHQ"
                  class="rd-btn rd-btn--approve-hq"
                  :class="{ 'rd-btn--disabled': actionLoading || !canApproveOrReject }"
                  :disabled="actionLoading || !canApproveOrReject"
                  @click="handleApproveHQ"
                >
                  <v-icon size="15" color="white">mdi-domain</v-icon>
                  Approve (HQ)
                </button>
                <!-- Field 승인 (in_review 상태, field pending) -->
                <button
                  v-if="canApproveFieldBtn"
                  class="rd-btn rd-btn--approve-field"
                  :class="{ 'rd-btn--disabled': actionLoading || !canApproveOrReject }"
                  :disabled="actionLoading || !canApproveOrReject"
                  @click="handleApproveField"
                >
                  <v-icon size="15" color="white">mdi-account-hard-hat</v-icon>
                  Approve (Field)
                </button>
                <!-- 공람 조기 종료 (public_feedback 상태) -->
                <button
                  v-if="isPublicFeedback"
                  class="rd-btn rd-btn--end-feedback"
                  :class="{ 'rd-btn--disabled': actionLoading }"
                  :disabled="actionLoading"
                  @click="handleEndPublicFeedback"
                >
                  <v-icon size="15" color="white">mdi-fast-forward</v-icon>
                  공람 조기 종료
                </button>
                <!-- Publish (final_edit 상태) - 4.2: 미해결 피드백 시 비활성화 + tooltip -->
                <v-tooltip v-if="canPublishState" :text="publishDisabledReason" :disabled="!publishDisabledReason" location="top">
                  <template #activator="{ props: tp }">
                    <button
                      v-bind="tp"
                      class="rd-btn rd-btn--approve"
                      :class="{ 'rd-btn--disabled': actionLoading || !canPublish }"
                      :disabled="actionLoading || !canPublish"
                      @click="handlePublish"
                    >
                      <v-icon size="15" color="white">mdi-rocket-launch</v-icon>
                      Publish
                    </button>
                  </template>
                </v-tooltip>
                <!-- Request Changes: 빨강 outline -->
                <button
                  class="rd-btn rd-btn--reject"
                  :class="{ 'rd-btn--disabled': actionLoading || !comment || !canApproveOrReject }"
                  :disabled="actionLoading || !comment || !canApproveOrReject"
                  @click="handleReject"
                >
                  <v-icon size="15" color="#ef4444">mdi-alert-circle-outline</v-icon>
                  Request Changes
                </button>
                <!-- Comment: 회색 outline -->
                <button
                  class="rd-btn rd-btn--comment"
                  :class="{ 'rd-btn--disabled': actionLoading || !comment }"
                  :disabled="actionLoading || !comment"
                  @click="handleComment"
                >
                  <v-icon size="15" color="#475569">mdi-send-outline</v-icon>
                  Comment
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ── Stage Transition Toast (loading 밖에 위치) ── -->
    <transition name="rd-toast-slide">
      <div v-if="stageToast" class="rd-stage-toast" :class="`rd-stage-toast--${stageToast.color}`">
        <v-icon size="16" class="mr-2">{{ stageToast.color === 'success' ? 'mdi-check-circle' : 'mdi-information' }}</v-icon>
        {{ stageToast.message }}
      </div>
    </transition>

    <!-- ── Reassign Dialog ── -->
    <v-dialog v-model="showReassignDialog" max-width="440" persistent>
      <v-card rounded="lg" elevation="8">
        <div class="dlg-header">
          <v-icon size="20" color="primary" class="mr-2">mdi-account-switch</v-icon>
          <span class="text-subtitle-1 font-weight-bold">담당자 변경</span>
        </div>
        <v-card-text class="pt-3">
          <p class="text-body-2 text-medium-emphasis mb-3">승인/반려 권한을 다른 사람에게 위임합니다.</p>
          <OwnerSelect v-model="reassignReviewerId" placeholder="담당자를 선택하세요"
            density="compact" hide-details @select="(m: any) => reassignReviewerObj = m" />
        </v-card-text>
        <v-card-actions class="px-4 pb-4">
          <v-spacer />
          <v-btn variant="text" size="small" @click="showReassignDialog = false">취소</v-btn>
          <v-btn color="primary" variant="flat" size="small" :loading="actionLoading"
            :disabled="!reassignReviewerObj" @click="confirmReassign">확인</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ── Cancel Dialog ── -->
    <v-dialog v-model="showCancelDialog" max-width="440" persistent>
      <v-card rounded="lg" elevation="8">
        <div class="dlg-header">
          <v-icon size="20" color="warning" class="mr-2">mdi-cancel</v-icon>
          <span class="text-subtitle-1 font-weight-bold">승인 취소</span>
        </div>
        <v-card-text class="pt-3">
          <p class="text-body-2 text-medium-emphasis mb-3">이 리뷰를 취소합니다. 사유를 입력해 주세요.</p>
          <v-textarea v-model="comment" placeholder="취소 사유를 입력하세요..." rows="2"
            variant="outlined" density="compact" hide-details />
        </v-card-text>
        <v-card-actions class="px-4 pb-4">
          <v-spacer />
          <v-btn variant="text" size="small" @click="showCancelDialog = false">닫기</v-btn>
          <v-btn color="warning" variant="flat" size="small" :loading="actionLoading" @click="handleCancel">
            취소 확인
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ── Resolve Dialog (조치 내용 필수 입력) ── -->
    <v-dialog v-model="showResolveDialog" max-width="480" persistent>
      <v-card rounded="lg" elevation="8">
        <div class="dlg-header">
          <v-icon size="20" color="success" class="mr-2">mdi-check-circle-outline</v-icon>
          <span class="text-subtitle-1 font-weight-bold">피드백 Resolve</span>
        </div>
        <v-card-text class="pt-3">
          <div v-if="resolveTargetEntry" class="rd-resolve-original">
            <div class="rd-resolve-original-label">원본 피드백</div>
            <div class="rd-resolve-original-text">{{ resolveTargetEntry.comment }}</div>
          </div>
          <p class="text-body-2 text-medium-emphasis mt-3 mb-2">
            조치 내용을 입력하세요 <span class="text-error">*</span>
          </p>
          <v-textarea
            v-model="resolveActionText"
            placeholder="어떻게 조치했는지 구체적으로 입력하세요 (필수)..."
            rows="3" variant="outlined" density="compact" hide-details
          />
        </v-card-text>
        <v-card-actions class="px-4 pb-4">
          <v-spacer />
          <v-btn variant="text" size="small" @click="showResolveDialog = false">취소</v-btn>
          <v-btn color="success" variant="flat" size="small" :loading="actionLoading"
            :disabled="!resolveActionText.trim()" @click="confirmResolve">
            <v-icon start size="16">mdi-check</v-icon>Resolve 완료
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.rd-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f8fafc;
  overflow: hidden;
}
.rd-loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 60vh;
}

/* ── Header ── */
.rd-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
  gap: 16px;
}
.rd-header-left {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 0;
}
.rd-back-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #64748b;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  width: fit-content;
  transition: color 0.15s;
}
.rd-back-btn:hover { color: #1e293b; }
.rd-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.rd-title {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
  line-height: 1.3;
}
.rd-title-version {
  font-size: 16px;
  font-weight: 400;
  color: #64748b;
  margin-left: 4px;
}
.rd-access-badge {
  display: inline-block;
  font-size: 12px;
  font-weight: 600;
  padding: 3px 12px;
  border-radius: 20px;
  white-space: nowrap;
  flex-shrink: 0;
}
.rd-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* ── Diff Bar ── */
.rd-diff-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 24px;
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
  gap: 16px;
}
.rd-diff-comparing {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #475569;
}
.rd-diff-comparing strong { color: #1e293b; }
.rd-diff-legend {
  display: flex;
  align-items: center;
  gap: 12px;
}
.rd-diff-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 500;
}
.rd-diff-pill--added { color: #059669; }
.rd-diff-pill--removed { color: #dc2626; }
.rd-diff-pill--modified { color: #d97706; }
.rd-diff-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.rd-diff-dot--added { background: #10b981; }
.rd-diff-dot--removed { background: #ef4444; }
.rd-diff-dot--modified { background: #f59e0b; }

/* ── Parallel Bar ── */
.rd-parallel-bar {
  display: flex;
  align-items: center;
  padding: 8px 24px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  gap: 12px;
  flex-shrink: 0;
}
.rd-parallel-label {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
}
.rd-parallel-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
  padding: 3px 10px;
  border-radius: 20px;
  border: 1px solid;
}
.rd-parallel--approved { background: #d1fae5; border-color: #a7f3d0; color: #065f46; }
.rd-parallel--rejected { background: #fee2e2; border-color: #fca5a5; color: #991b1b; }
.rd-parallel--pending  { background: #f1f5f9; border-color: #e2e8f0; color: #64748b; }
.rd-parallel-name { opacity: 0.75; font-weight: 400; }

/* ── Resolution Bar ── */
.rd-resolution-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 24px;
  background: #fffbeb;
  border-bottom: 1px solid #fde68a;
  flex-shrink: 0;
}
.rd-resolution-text {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: #555;
  white-space: nowrap;
  flex-shrink: 0;
}
.rd-resolution-progress { flex: 1; max-width: 280px; }

/* ── Body ── */
.rd-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* ── Left ── */
.rd-left {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 20px;
  gap: 16px;
}
.rd-bpmn-compare {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.rd-bpmn-panel {
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  overflow: hidden;
  background: #fff;
  display: flex;
  flex-direction: column;
}
.rd-bpmn-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;
}
.rd-bpmn-bar--before { background: #fff5f5; }
.rd-bpmn-bar--after  { background: #f0fdf4; }
.rd-bpmn-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 10px;
  border-radius: 12px;
}
.rd-bpmn-badge--before { background: #fce4ec; color: #c62828; }
.rd-bpmn-badge--after  { background: #e8f5e9; color: #2e7d32; }
.rd-bpmn-ver { font-size: 11px; color: #94a3b8; }
.rd-bpmn-canvas {
  height: 350px;
  position: relative;
  overflow: hidden;
  background: #fafafa;
  flex: 1;
}
.rd-bpmn-single {
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  overflow: hidden;
  background: #fff;
  height: 420px;
  position: relative;
}
.rd-bpmn-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
}

/* Change Summary */
.rd-change-summary {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
}
.rd-change-summary-title {
  font-size: 13px;
  font-weight: 700;
  color: #1e293b;
  padding: 12px 16px 10px;
  border-bottom: 1px solid #f1f5f9;
}
.rd-change-list {
  padding: 10px 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
}
.rd-change-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.rd-change-icon { flex-shrink: 0; margin-top: 1px; }
.rd-change-text { font-size: 13px; color: #374151; line-height: 1.5; }
.rd-change-text--removed { text-decoration: line-through; color: #ef4444; opacity: 0.8; }
.rd-change-type { font-weight: 600; margin-right: 4px; }

/* ── Right ── */
.rd-right {
  width: 420px;
  flex-shrink: 0;
  background: #fff;
  border-left: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.rd-right-inner {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
.rd-panel-header {
  padding: 16px 20px 12px;
  border-bottom: 1px solid #f1f5f9;
  flex-shrink: 0;
}
.rd-panel-title { font-size: 16px; font-weight: 700; color: #0f172a; }
.rd-panel-subtitle { font-size: 12px; color: #94a3b8; margin-top: 2px; }

/* Banners */
.rd-banner {
  display: flex;
  align-items: center;
  padding: 10px 20px;
  font-size: 13px;
  font-weight: 500;
  flex-shrink: 0;
}
.rd-banner--success { background: #d1fae5; color: #065f46; border-bottom: 1px solid #a7f3d0; }
.rd-banner--error   { background: #fee2e2; color: #991b1b; border-bottom: 1px solid #fca5a5; }
.rd-banner--warning { background: #fef3c7; color: #92400e; border-bottom: 1px solid #fde68a; }

/* Notices */
.rd-notice {
  display: flex;
  align-items: center;
  padding: 8px 20px;
  font-size: 12px;
  flex-shrink: 0;
}
.rd-notice--error   { background: #fff1f2; color: #be123c; border-bottom: 1px solid #fecdd3; }
.rd-notice--warning { background: #fffbeb; color: #b45309; border-bottom: 1px solid #fde68a; }
.rd-notice--info    { background: #eff6ff; color: #1d4ed8; border-bottom: 1px solid #bfdbfe; }

/* History */
.rd-history-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}
.rd-history-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  opacity: 0.6;
}
.rd-history-entry {
  display: flex;
  gap: 12px;
  position: relative;
}
.rd-he-line {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  width: 26px;
}
.rd-he-dot {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  z-index: 1;
}
.rd-he-connector {
  width: 2px;
  flex: 1;
  background: #e2e8f0;
  margin: 3px 0;
  min-height: 12px;
}
.rd-he-card {
  flex: 1;
  min-width: 0;
  padding-bottom: 16px;
}
.rd-he-top {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 4px;
}
.rd-he-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}
.rd-he-actor { flex: 1; min-width: 0; }
.rd-he-name {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
  line-height: 1.3;
}
.rd-he-role {
  font-size: 11px;
  color: #94a3b8;
  line-height: 1.3;
}
.rd-he-time {
  font-size: 11px;
  color: #94a3b8;
  white-space: nowrap;
  margin-left: auto;
  flex-shrink: 0;
  cursor: default;
}
.rd-he-action {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 4px;
}
.rd-he-version-ref {
  font-weight: 400;
  opacity: 0.7;
  margin-left: 4px;
}
.rd-he-comment {
  font-size: 13px;
  color: #475569;
  background: #f8fafc;
  border-radius: 8px;
  padding: 8px 12px;
  line-height: 1.6;
  border-left: 3px solid #e2e8f0;
  margin-top: 4px;
}
.rd-he-resolved {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #059669;
  margin-top: 6px;
}
.rd-he-resolve-row { margin-top: 6px; }
.rd-resolve-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  color: #059669;
  background: #d1fae5;
  border: 1px solid #a7f3d0;
  border-radius: 6px;
  padding: 3px 10px;
  cursor: pointer;
  transition: background 0.15s;
}
.rd-resolve-btn:hover { background: #a7f3d0; }

/* ── Action Area (Figma 하단) ── */
.rd-action-area {
  padding: 16px 20px;
  border-top: 1px solid #e2e8f0;
  background: #fff;
  flex-shrink: 0;
}
.rd-action-label {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
}
.rd-comment-textarea {
  width: 100%;
  min-height: 72px;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 13px;
  color: #374151;
  resize: none;
  outline: none;
  transition: border-color 0.15s;
  font-family: inherit;
  line-height: 1.5;
  box-sizing: border-box;
}
.rd-comment-textarea:focus { border-color: #94a3b8; }
.rd-comment-textarea::placeholder { color: #94a3b8; }
.rd-selfblock-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #dc2626;
  margin: 6px 0;
}

/* Figma 3버튼 */
.rd-action-buttons {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  flex-wrap: wrap;
}
.rd-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  transition: opacity 0.15s, background 0.15s;
  white-space: nowrap;
}
.rd-btn--disabled { opacity: 0.4; cursor: not-allowed; }
/* Approve HQ: 파랑 solid */
.rd-btn--approve-hq {
  flex: 1;
  background: #3b82f6;
  color: #fff;
  border-color: #2563eb;
}
.rd-btn--approve-hq:not(.rd-btn--disabled):hover { background: #2563eb; }
/* Approve Field: 초록 solid */
.rd-btn--approve-field {
  flex: 1;
  background: #10b981;
  color: #fff;
  border-color: #059669;
}
.rd-btn--approve-field:not(.rd-btn--disabled):hover { background: #059669; }
/* 공람 조기 종료: 보라 solid */
.rd-btn--end-feedback {
  flex: 1;
  background: #8b5cf6;
  color: #fff;
  border-color: #7c3aed;
}
.rd-btn--end-feedback:not(.rd-btn--disabled):hover { background: #7c3aed; }
/* Publish: 초록 solid */
.rd-btn--approve {
  flex: 1;
  background: #10b981;
  color: #fff;
  border-color: #059669;
}
.rd-btn--approve:not(.rd-btn--disabled):hover { background: #059669; }
/* Request Changes: 빨강 outline */
.rd-btn--reject {
  flex: 1;
  background: #fff;
  color: #ef4444;
  border-color: #fca5a5;
}
.rd-btn--reject:not(.rd-btn--disabled):hover { background: #fff1f2; }
/* Comment: 회색 outline */
.rd-btn--comment {
  background: #fff;
  color: #475569;
  border-color: #e2e8f0;
  padding: 9px 14px;
}
.rd-btn--comment:not(.rd-btn--disabled):hover { background: #f8fafc; }

/* ── Dialog ── */
.dlg-header {
  display: flex;
  align-items: center;
  padding: 16px 20px 0;
}

/* Resolve dialog */
.rd-resolve-original {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 12px;
}
.rd-resolve-original-label {
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.rd-resolve-original-text {
  font-size: 13px;
  color: #374151;
  line-height: 1.5;
}

/* Scrollbars */
.rd-left::-webkit-scrollbar,
.rd-history-list::-webkit-scrollbar,
.rd-change-list::-webkit-scrollbar { width: 4px; }
.rd-left::-webkit-scrollbar-thumb,
.rd-history-list::-webkit-scrollbar-thumb,
.rd-change-list::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }

/* ── Snapshot Toggle Bar (Phase 3.4) ── */
.rd-snap-bar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}
.rd-snap-toggle {
  display: flex;
  gap: 4px;
  background: #f1f5f9;
  padding: 3px;
  border-radius: 8px;
  width: fit-content;
}
.rd-snap-btn {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
  background: transparent;
  border: none;
  padding: 5px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.rd-snap-btn--active {
  background: #fff;
  color: #1e293b;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}
.rd-snap-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  background: #e2e8f0;
  color: #475569;
  border-radius: 50%;
  font-size: 10px;
  font-weight: 700;
  margin-left: 5px;
}
.rd-snap-select {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.rd-snap-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  padding: 3px 10px;
  border-radius: 20px;
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s;
}
.rd-snap-chip--active {
  background: #eff6ff;
  border-color: #bfdbfe;
  color: #1d4ed8;
}
.rd-snap-ver { font-weight: 400; opacity: 0.7; }
.rd-snap-viewer { min-height: 420px; }
.rd-bpmn-bar--snapshot { background: #ede9fe; }
.rd-bpmn-badge--snapshot { background: #ddd6fe; color: #5b21b6; }

/* ── Public Feedback Banner ── */
.rd-public-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 24px;
  background: #eff6ff;
  border-bottom: 1px solid #bfdbfe;
  flex-shrink: 0;
}
.rd-public-banner--urgent {
  background: #fff1f2;
  border-bottom-color: #fecdd3;
}
.rd-public-banner-left {
  display: flex;
  align-items: center;
  font-size: 13px;
  color: #1e40af;
}
.rd-public-banner--urgent .rd-public-banner-left { color: #be123c; }
.rd-public-banner-text { font-weight: 600; }
.rd-public-banner-end {
  font-weight: 400;
  opacity: 0.75;
  margin-left: 4px;
}
.rd-public-banner-dday {
  font-size: 15px;
  font-weight: 800;
  color: #1d4ed8;
  background: #dbeafe;
  padding: 3px 14px;
  border-radius: 20px;
  letter-spacing: -0.5px;
}
.rd-dday--urgent {
  color: #dc2626;
  background: #fee2e2;
}

/* ── Stage Transition Toast ── */
.rd-stage-toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  padding: 10px 20px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  z-index: 9999;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  white-space: nowrap;
}
.rd-stage-toast--success { background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }
.rd-stage-toast--info    { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
.rd-toast-slide-enter-active, .rd-toast-slide-leave-active { transition: all 0.3s ease; }
.rd-toast-slide-enter-from, .rd-toast-slide-leave-to { opacity: 0; transform: translateX(-50%) translateY(12px); }

/* Responsive */
@media (max-width: 1024px) {
  .rd-body { flex-direction: column; overflow-y: auto; }
  .rd-left { overflow-y: visible; }
  .rd-right { width: 100%; border-left: none; border-top: 1px solid #e2e8f0; }
  .rd-bpmn-compare { grid-template-columns: 1fr; }
}
</style>
