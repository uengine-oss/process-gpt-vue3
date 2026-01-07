<template>
    <v-card class="mt-3" outlined>
      <v-card-title class="pb-2">
        <div class="d-flex align-center justify-space-between">
          <span>팀원 선택</span>
          <v-btn @click="$emit('close')" variant="text" size="small" icon>
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </div>
      </v-card-title>
  
      <v-card-text>
        <v-text-field
          v-model="searchText"
          label="팀원 검색"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          density="compact"
          hide-details
          class="mb-3"
        />
  
        <div class="team-member-list" style="max-height: 200px; overflow-y: auto">
          <v-list density="compact">
            <v-list-item
              v-for="user in filteredMembers"
              :key="user.id"
              @click="toggleSelection(user)"
              class="team-member-item"
              :class="{ selected: isSelected(user.id) }"
            >
              <template #prepend>
                <v-avatar size="32">
                  <img :src="user.profile || '/images/defaultUser.png'" />
                </v-avatar>
              </template>
  
              <v-list-item-title>{{ user.username }}</v-list-item-title>
              <v-list-item-subtitle>{{ user.email }}</v-list-item-subtitle>
  
              <template #append>
                <v-checkbox
                  :model-value="isSelected(user.id)"
                  @update:model-value="toggleSelection(user)"
                  hide-details
                />
              </template>
            </v-list-item>
          </v-list>
        </div>
      </v-card-text>
  
      <v-card-actions>
        <v-spacer />
        <v-btn @click="$emit('close')" variant="text" size="small">닫기</v-btn>
        <v-btn
          @click="$emit('confirm')"
          color="primary"
          variant="elevated"
          size="small"
          :disabled="selectedMembers.length === 0"
        >
          확인 ({{ selectedMembers.length }})
        </v-btn>
      </v-card-actions>
    </v-card>
  </template>
  
  <script setup>
  import { ref, computed } from 'vue';
  
  const props = defineProps({
    allUserList: {
      type: Array,
      default: () => []
    },
    selectedMembers: {
      type: Array,
      default: () => []
    }
  });
  
  const emit = defineEmits(['close', 'confirm', 'update:selectedMembers']);
  
  const searchText = ref('');
  
  const filteredMembers = computed(() => {
    if (!props.allUserList) return [];
  
    let users = props.allUserList;
  
    if (searchText.value) {
      const search = searchText.value.toLowerCase();
      users = users.filter(
        (user) =>
          user.username.toLowerCase().includes(search) ||
          user.email.toLowerCase().includes(search)
      );
    }
  
    return users;
  });
  
  function isSelected(userId) {
    return props.selectedMembers.includes(userId);
  }
  
  function toggleSelection(user) {
    const newSelection = [...props.selectedMembers];
    const index = newSelection.indexOf(user.id);
  
    if (index > -1) {
      newSelection.splice(index, 1);
    } else {
      newSelection.push(user.id);
    }
  
    emit('update:selectedMembers', newSelection);
  }
  </script>
  
  <style lang="scss" scoped>
  .team-member-item {
    cursor: pointer;
    transition: background-color 0.2s ease;
  
    &:hover {
      background-color: rgba(0, 0, 0, 0.04);
    }
  
    &.selected {
      background-color: rgba(var(--v-theme-primary), 0.1);
    }
  }
  </style>