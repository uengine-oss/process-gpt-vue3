<script setup lang="ts">
import { computed } from 'vue';
import { formatDistanceToNowStrict, format } from 'date-fns';

interface ReviewItem {
  review_id?: string;
  proc_def_id: string;
  process_name: string;
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
}

const props = defineProps<{
  item: ReviewItem;
}>();

const emit = defineEmits<{
  (e: 'click', reviewId: string): void;
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
  const colors = ['primary', 'secondary', 'success', 'info', 'warning', 'error', 'indigo', 'teal', 'deep-purple', 'cyan'];
  const index = Math.abs(hash) % colors.length;
  return colors[index];
});

function handleClick() {
  const id = props.item.review_id || props.item.proc_def_id;
  emit('click', id);
}
</script>

<template>
  <v-card
    class="review-board-card mb-3"
    variant="outlined"
    rounded="lg"
    @click="handleClick"
    hover
  >
    <v-card-text class="pa-3">
      <!-- Title row -->
      <div class="d-flex align-center justify-space-between mb-2">
        <span class="text-subtitle-2 font-weight-bold text-truncate" style="max-width: 200px">
          {{ item.process_name }}
        </span>
        <v-chip v-if="item.state === 'rejected'" size="x-small" color="error" variant="flat">
          Rejected
        </v-chip>
      </div>

      <!-- Domain badge + Version -->
      <div class="d-flex align-center gap-2 mb-2">
        <v-chip size="x-small" :color="item.domain_color || 'primary'" variant="tonal">
          {{ item.domain_name || 'No Domain' }}
        </v-chip>
        <v-chip v-if="version" size="x-small" variant="tonal" color="primary">{{ version }}</v-chip>
      </div>

      <!-- Owner + Time -->
      <div class="d-flex align-center justify-space-between mt-2">
        <div class="d-flex align-center">
          <v-avatar size="24" :color="avatarColor" class="mr-2">
            <span class="text-caption text-white">{{ initials }}</span>
          </v-avatar>
          <span class="text-caption">{{ displayName }}</span>
        </div>
        <v-tooltip :text="exactTime" location="top">
          <template #activator="{ props: tooltipProps }">
            <span v-bind="tooltipProps" class="text-caption text-medium-emphasis">{{ timeAgo }}</span>
          </template>
        </v-tooltip>
      </div>

      <!-- Assigned reviewer -->
      <div v-if="item.assigned_reviewer_name" class="d-flex align-center mt-2">
        <v-icon size="14" class="mr-1" color="primary">mdi-account-arrow-right</v-icon>
        <span class="text-caption text-medium-emphasis">{{ item.assigned_reviewer_name }}</span>
      </div>

      <!-- Comment count -->
      <div v-if="item.comment_count > 0" class="d-flex align-center mt-2">
        <v-icon size="14" class="mr-1" color="grey">mdi-comment-outline</v-icon>
        <span class="text-caption text-medium-emphasis">{{ item.comment_count }}</span>
      </div>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.review-board-card {
  cursor: pointer;
  transition: box-shadow 0.2s, transform 0.15s, border-color 0.2s;
  border-color: #e8ecf0 !important;
  background: #fff;
}
.review-board-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
  border-color: #d0d7de !important;
}
</style>
