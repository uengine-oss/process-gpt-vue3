<script setup lang="ts">
import { computed } from 'vue';
import { formatDistanceToNowStrict, format } from 'date-fns';

interface ReviewItem {
  review_id?: string;
  proc_def_id: string;
  process_name: string;
  description?: string;
  owner: string;
  state: string;
  version?: string;
  domain_id: string;
  domain_name: string;
  domain_color: string;
  comment_count: number;
  updated_at: string;
  submitted_by: string;
  submitted_at: string;
  reviewer_level1_name?: string;
  confirmed_by_name?: string;
  assigned_reviewer_id?: string;
  assigned_reviewer_name?: string;
  reviewer_count?: number;
  access_type?: 'Core' | 'Assurance' | 'Support' | string;
}

const props = defineProps<{
  item: ReviewItem;
  stalledDays?: number;
}>();

const emit = defineEmits<{
  (e: 'click', reviewId: string): void;
  (e: 'sidebar', item: ReviewItem): void;
}>();

const timeAgo = computed(() => {
  if (!props.item.updated_at) return '';
  try {
    return formatDistanceToNowStrict(new Date(props.item.updated_at), { addSuffix: true });
  } catch {
    return '';
  }
});

const exactTime = computed(() => {
  if (!props.item.updated_at) return '';
  try {
    return format(new Date(props.item.updated_at), 'yyyy-MM-dd HH:mm:ss');
  } catch {
    return props.item.updated_at;
  }
});

const displayName = computed(() => {
  const item = props.item;
  if (item.state === 'confirmed' && item.confirmed_by_name) return item.confirmed_by_name;
  if ((item.state === 'approved_level1' || item.state === 'approved_level2') && item.reviewer_level1_name) return item.reviewer_level1_name;
  return item.submitted_by || item.owner || 'Unknown';
});

const initials = computed(() => {
  const name = displayName.value;
  if (!name) return '??';
  // 한글 이름 처리: 첫 글자만 사용
  const firstChar = name.charAt(0);
  const isKorean = /[가-힣]/.test(firstChar);
  if (isKorean) return name.substring(0, 2);
  return name.substring(0, 2).toUpperCase();
});

const version = computed(() => {
  return props.item.version ? `v${props.item.version}` : '';
});

const avatarColor = computed(() => {
  const name = displayName.value;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  // Figma 목업의 아바타 색상 팔레트와 유사하게
  const colors = ['#4f46e5', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0284c7', '#0891b2', '#65a30d']
  return colors[Math.abs(hash) % colors.length];
});

// Access type badge — Figma: Core(보라), Assurance(주황), Support(초록), Access(회색-파랑)
const accessBadge = computed(() => {
  const type = props.item.access_type || ''
  if (type === 'Core') return { label: 'Core', color: '#5b21b6', bg: '#ede9fe' }
  if (type === 'Assurance') return { label: 'Assurance', color: '#92400e', bg: '#fef3c7' }
  if (type === 'Support') return { label: 'Support', color: '#065f46', bg: '#d1fae5' }
  if (type === 'Access') return { label: 'Access', color: '#1e40af', bg: '#dbeafe' }
  return null
})

// 편집 권한 상태 뱃지 (한글 '편집' 등 Figma에서 보이는 뱃지)
const editBadge = computed(() => {
  const state = props.item.state
  if (state === 'draft' || state === 'rejected') return { label: '편집', color: '#374151', bg: '#f3f4f6' }
  return null
})

// Is stalled (>= 7 days)
const isStalled = computed(() => (props.stalledDays || 0) >= 7)

function handleClick() {
  const id = props.item.review_id || props.item.proc_def_id;
  emit('click', id);
}

function handleSidebar(e: MouseEvent) {
  e.stopPropagation()
  emit('sidebar', props.item)
}
</script>

<template>
  <div
    class="rbc"
    :class="{ 'rbc--stalled': isStalled }"
    @click="handleClick"
  >
    <!-- Stalled gradient top bar -->
    <div v-if="isStalled" class="rbc-stalled-bar"></div>

    <!-- Row 1: Title + Access/Edit badge -->
    <div class="rbc-row-title">
      <span class="rbc-name">{{ item.process_name }}</span>
      <!-- Access type badge (우상단) -->
      <span
        v-if="accessBadge"
        class="rbc-access-badge"
        :style="{ background: accessBadge.bg, color: accessBadge.color }"
      >{{ accessBadge.label }}</span>
      <span
        v-else-if="editBadge"
        class="rbc-access-badge"
        :style="{ background: editBadge.bg, color: editBadge.color }"
      >{{ editBadge.label }}</span>
    </div>

    <!-- Row 2: Version -->
    <div v-if="version" class="rbc-version">{{ version }}</div>

    <!-- Row 3: Description (optional) -->
    <div v-if="item.description" class="rbc-desc">{{ item.description }}</div>

    <!-- Row 4: Avatar + Name + Time -->
    <div class="rbc-row-meta">
      <div class="d-flex align-center gap-2 flex-1 min-w-0">
        <div
          class="rbc-avatar"
          :style="{ background: avatarColor }"
        >{{ initials }}</div>
        <span class="rbc-owner">{{ displayName }}</span>
      </div>
      <v-tooltip :text="exactTime" location="top">
        <template #activator="{ props: tp }">
          <span v-bind="tp" class="rbc-time">{{ timeAgo }}</span>
        </template>
      </v-tooltip>
    </div>

    <!-- Row 5: Reviewer count + Comment count (Figma 스타일) -->
    <div v-if="(item.reviewer_count && item.reviewer_count > 0) || item.comment_count > 0" class="rbc-row-stats">
      <span v-if="item.reviewer_count && item.reviewer_count > 0" class="rbc-stat">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        {{ item.reviewer_count }} reviewer{{ item.reviewer_count > 1 ? 's' : '' }}
      </span>
      <span v-if="item.comment_count > 0" class="rbc-stat">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        {{ item.comment_count }} comment{{ item.comment_count > 1 ? 's' : '' }}
      </span>
    </div>

    <!-- Assigned reviewer (담당자 지정된 경우) -->
    <div v-if="item.assigned_reviewer_name" class="rbc-reviewer-row">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2">
        <path d="M5 12h14M12 5l7 7-7 7"/>
      </svg>
      <span>{{ item.assigned_reviewer_name }}</span>
    </div>

    <!-- Stalled warning -->
    <div v-if="isStalled" class="rbc-stalled-warning">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
      {{ stalledDays }}일째 정체
    </div>

    <!-- Hover: sidebar trigger -->
    <button class="rbc-sidebar-btn" @click="handleSidebar" title="거버넌스 타임라인">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    </button>
  </div>
</template>

<style scoped>
/* ── Card ── */
.rbc {
  position: relative;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 14px 14px 12px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: box-shadow 0.15s ease, transform 0.12s ease, border-color 0.15s ease;
  overflow: hidden;
}
.rbc:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.09);
  transform: translateY(-1px);
  border-color: #cbd5e1;
}
.rbc--stalled {
  border-color: #fbbf24;
}

/* Stalled indicator */
.rbc-stalled-bar {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, #f59e0b, #ef4444);
}

/* ── Title row ── */
.rbc-row-title {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}
.rbc-name {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  line-height: 1.4;
  flex: 1;
  min-width: 0;
  /* Figma: 2줄 제한 */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Access badge (우상단, Figma 스타일) */
.rbc-access-badge {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 9px;
  border-radius: 20px;
  white-space: nowrap;
  line-height: 1.6;
}

/* ── Version ── */
.rbc-version {
  font-size: 12px;
  color: #64748b;
  font-weight: 500;
  margin-bottom: 4px;
}

/* ── Description ── */
.rbc-desc {
  font-size: 12px;
  color: #64748b;
  line-height: 1.5;
  margin-bottom: 10px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* ── Meta row (avatar + name + time) ── */
.rbc-row-meta {
  display: flex;
  align-items: center;
  gap: 0;
  margin-top: 10px;
}

/* Avatar — Figma: 원형, 색상 있음 */
.rbc-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
  letter-spacing: -0.5px;
}

.rbc-owner {
  font-size: 12px;
  color: #475569;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 90px;
  margin-left: 6px;
}

.rbc-time {
  font-size: 11px;
  color: #94a3b8;
  white-space: nowrap;
  margin-left: auto;
  padding-left: 8px;
}

/* ── Stats row (reviewers + comments) — Figma 스타일 ── */
.rbc-row-stats {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #f1f5f9;
}
.rbc-stat {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #64748b;
}

/* ── Reviewer row ── */
.rbc-reviewer-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  font-size: 11px;
  color: #3b82f6;
  font-weight: 500;
}

/* ── Stalled warning ── */
.rbc-stalled-warning {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  font-size: 11px;
  font-weight: 500;
  color: #d97706;
}

/* ── Sidebar hover button ── */
.rbc-sidebar-btn {
  position: absolute;
  bottom: 10px;
  right: 10px;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #94a3b8;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s;
  padding: 0;
}
.rbc:hover .rbc-sidebar-btn {
  opacity: 1;
}
.rbc-sidebar-btn:hover {
  background: #f1f5f9;
  color: #475569;
}
</style>
