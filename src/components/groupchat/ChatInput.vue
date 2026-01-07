<template>
    <div class="chat-input-wrapper">
      <!-- 이미지 미리보기 -->
      <div v-if="attachedImages.length > 0" class="d-flex flex-wrap image-preview-container">
        <div v-for="(image, index) in attachedImages" :key="index" class="image-preview-item">
          <img 
            :src="image.url" 
            width="56" 
            height="56" 
            class="preview-image"
          />
          <v-btn
            @click="$emit('deleteImage', index)"
            density="compact"
            icon
            size="16"
            class="delete-image-btn"
          >
            <v-icon color="white" size="14">mdi-close</v-icon>
          </v-btn>
        </div>
      </div>
  
      <!-- 입력 폼 -->
      <form class="d-flex flex-column align-center pa-0" @submit.prevent>
        <!-- 멘션 태그 표시 영역 -->
        <div v-if="mentionedUsers.length > 0" class="mention-tags-container">
          <v-chip
            v-for="user in mentionedUsers"
            :key="user.id"
            size="small"
            color="primary"
            variant="tonal"
            closable
            @click:close="$emit('removeMention', user.id)"
            class="mention-chip"
          >
            <v-avatar size="18" class="mr-2">
              <img :src="user.profile || '/images/defaultUser.png'" :alt="user.username" />
            </v-avatar>
            {{ user.username }}
            <v-chip
              v-if="user.is_agent"
              size="x-small"
              color="primary"
              variant="outlined"
              class="ml-2 agent-chip"
            >
              에이전트
            </v-chip>
          </v-chip>
        </div>
  
        <!-- 텍스트 입력 -->
        <v-textarea
          variant="solo"
          hide-details
          :model-value="newMessage"
          @update:model-value="$emit('update:newMessage', $event)"
          color="primary"
          class="shadow-none message-input-box delete-input-details cp-chat"
          density="compact"
          :placeholder="placeholder"
          auto-grow
          rows="1"
          @keypress.enter="handleEnterKey"
          :disabled="disabled"
          @input="$emit('textareaInput', $event)"
          @paste="$emit('paste', $event)"
          @keydown="$emit('keydown', $event)"
        />
  
        <!-- 하단 버튼 영역 -->
        <div class="d-flex justify-space-between align-center w-100 pa-2">
          <!-- 좌측 메뉴 버튼 -->
          <v-row class="ma-0 pa-0 align-center">
            <v-btn
              @click="$emit('toggleMenu')"
              class="mr-1 text-medium-emphasis"
              density="comfortable"
              icon
              variant="outlined"
              size="small"
              style="border-color: #e0e0e0 !important"
            >
              <v-icon v-if="!isOpenedChatMenu">mdi-plus</v-icon>
              <v-icon v-else>mdi-close</v-icon>
            </v-btn>
            <slot name="custom-input-tools" />
          </v-row>
  
          <!-- 우측 버튼들 -->
          <div class="d-flex align-center">
            <!-- 음성 녹음 버튼 -->
            <v-btn
              v-if="!isMicRecording && !isMicRecorderLoading"
              @click="$emit('startVoiceRecording')"
              class="mr-1 text-medium-emphasis"
              density="comfortable"
              icon
              variant="outlined"
              size="small"
              style="border-color: #e0e0e0 !important"
            >
              <Icons icon="sharp-mic" size="16" />
            </v-btn>
            <v-btn
              v-else-if="!isMicRecorderLoading"
              @click="$emit('stopVoiceRecording')"
              class="mr-1 text-medium-emphasis"
              density="comfortable"
              icon
              variant="outlined"
              size="small"
              style="border-color: #e0e0e0 !important"
            >
              <Icons icon="stop" size="16" />
            </v-btn>
            <Icons v-if="isMicRecorderLoading" icon="bubble-loading" />
  
            <!-- 헤드셋 버튼 -->
            <v-tooltip :text="$t('chat.headset')">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  @click="$emit('recordingModeChange')"
                  class="mr-1 text-medium-emphasis"
                  density="comfortable"
                  icon
                  variant="outlined"
                  size="small"
                  style="border-color: #e0e0e0 !important"
                >
                  <Icons icon="voice" size="16" />
                </v-btn>
              </template>
            </v-tooltip>
  
            <!-- 전송/중지 버튼 -->
            <v-btn
              v-if="!isLoading"
              class="cp-send text-medium-emphasis"
              color="primary"
              variant="outlined"
              density="comfortable"
              icon
              size="small"
              style="border-color: rgb(var(--v-theme-primary), 0.3) !important"
              @click="$emit('send')"
              :disabled="sendDisabled"
            >
              <Icons icon="send-outline" size="16" />
            </v-btn>
            <v-btn
              v-else
              class="cp-send text-medium-emphasis"
              color="primary"
              variant="outlined"
              density="comfortable"
              icon
              size="small"
              style="border-color: rgb(var(--v-theme-primary), 0.3) !important"
              @click="$emit('stopLoading')"
            >
              <Icons icon="outline-stop-circle" size="16" />
            </v-btn>
          </div>
        </div>
  
        <!-- 사용자 목록 (멘션) -->
        <div v-if="showUserList" class="user-list">
          <div
            v-for="(user, index) in filteredUserList"
            :key="user.id"
            @click="$emit('selectUser', user)"
            class="user-item"
            :class="{ 'user-item-selected': selectedUserIndex === index }"
            @mouseenter="$emit('update:selectedUserIndex', index)"
            @mouseleave="$emit('update:selectedUserIndex', -1)"
          >
            <img
              :src="user.profile || '/images/defaultUser.png'"
              alt="profile"
              class="user-avatar"
            />
            <div class="user-info">
              <div class="user-name-row">
                <span>{{ user.username }}</span>
                <v-chip
                  v-if="user.is_agent"
                  size="x-small"
                  color="primary"
                  variant="outlined"
                  class="agent-badge"
                >
                  에이전트
                </v-chip>
              </div>
              <div class="user-email">{{ user.email || '에이전트' }}</div>
            </div>
          </div>
        </div>
      </form>
  
      <!-- 숨겨진 파일 입력 -->
      <input 
        type="file" 
        accept="image/*" 
        capture="camera" 
        ref="captureInput" 
        class="d-none" 
        @change="$emit('changeImage', $event)" 
      />
      <input 
        type="file" 
        accept="image/*" 
        ref="uploaderInput" 
        class="d-none" 
        @change="$emit('changeImage', $event)" 
      />
    </div>
  
    <!-- 채팅 메뉴 -->
    <div v-if="isOpenedChatMenu" class="chat-menu-container">
      <div class="chat-menu-background">
        <!-- 이미지 추가 -->
        <v-tooltip :text="$t('chat.addImage')">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              icon
              variant="text"
              class="text-medium-emphasis"
              @click="triggerUpload"
              style="width: 30px; height: 30px; margin-left: 5px"
              :disabled="disabled"
            >
              <Icons icon="add-media-image" size="20" />
            </v-btn>
          </template>
        </v-tooltip>
  
        <!-- Draft Agent -->
        <v-tooltip v-if="showDraftAgent" text="Draft Agent">
          <template #activator="{ props }">
            <v-btn
              v-if="!agentRunning"
              v-bind="props"
              :disabled="!canDraftAgent"
              icon
              variant="text"
              class="text-medium-emphasis"
              @click="$emit('requestDraftAgent')"
              style="width: 30px; height: 30px; margin: 1px 0px 0px 5px"
            >
              <Icons icon="document-sparkle" size="20" />
            </v-btn>
            <v-btn
              v-else
              icon
              variant="text"
              class="text-medium-emphasis"
              style="width: 30px; height: 30px"
            >
              <v-progress-circular size="20" indeterminate color="primary" />
            </v-btn>
          </template>
        </v-tooltip>
  
        <!-- 파일 업로드 -->
        <v-form
          v-if="showFileUpload"
          ref="uploadForm"
          @submit.prevent="$emit('submitFile')"
          style="height: 30px"
          class="chat-selected-file"
        >
          <v-row class="ma-0 pa-0" :style="hasFile ? 'margin:-13px 0px 0px 7px !important;' : ''">
            <v-tooltip :text="$t('chat.fileUpLoad')">
              <template #activator="{ props }">
                <v-btn
                  v-if="hasFile"
                  v-bind="props"
                  type="submit"
                  icon
                  variant="text"
                  class="text-medium-emphasis"
                  style="width: 30px; height: 30px; margin: 12.5px 0px 0px 0px"
                >
                  <Icons icon="upload" />
                </v-btn>
              </template>
            </v-tooltip>
            <v-file-input
              class="chat-file-up-load"
              :class="{ 'chat-file-up-load-display': hasFile }"
              :style="hasFile ? '' : 'padding:5px 0px 0px 8px !important; width:30px !important; height:30px !important;'"
              :model-value="file"
              @update:model-value="$emit('update:file', $event)"
              label="Choose a file"
              prepend-icon="mdi-paperclip"
              outlined
              :disabled="disabled"
            />
  
            <!-- ProcessGPT 토글 -->
            <v-tooltip
              v-if="showProcessGPTToggle"
              :text="processGPTActive ? $t('chat.isDisableProcessGPT') : $t('chat.isEnableProcessGPT')"
            >
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon
                  variant="text"
                  class="text-medium-emphasis"
                  @click="$emit('toggleProcessGPT')"
                  style="width: 30px; height: 30px; margin-left: 12px"
                  :disabled="disabled"
                >
                  <img
                    :style="processGPTActive ? 'opacity:1' : 'opacity:0.5'"
                    src="@/assets/images/chat/chat-icon.png"
                    style="height: 24px"
                  />
                </v-btn>
              </template>
            </v-tooltip>
          </v-row>
        </v-form>
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref, computed } from 'vue';
  import Icons from '@/components/ui-components/Icons.vue';
  
  const props = defineProps({
    newMessage: {
      type: String,
      default: ''
    },
    mentionedUsers: {
      type: Array,
      default: () => []
    },
    attachedImages: {
      type: Array,
      default: () => []
    },
    showUserList: {
      type: Boolean,
      default: false
    },
    filteredUserList: {
      type: Array,
      default: () => []
    },
    selectedUserIndex: {
      type: Number,
      default: -1
    },
    isOpenedChatMenu: {
      type: Boolean,
      default: false
    },
    isLoading: {
      type: Boolean,
      default: false
    },
    isMicRecording: {
      type: Boolean,
      default: false
    },
    isMicRecorderLoading: {
      type: Boolean,
      default: false
    },
    disabled: {
      type: Boolean,
      default: false
    },
    placeholder: {
      type: String,
      default: ''
    },
    // Agent 관련
    showDraftAgent: {
      type: Boolean,
      default: false
    },
    agentRunning: {
      type: Boolean,
      default: false
    },
    canDraftAgent: {
      type: Boolean,
      default: false
    },
    // 파일 관련
    showFileUpload: {
      type: Boolean,
      default: false
    },
    file: {
      type: Array,
      default: null
    },
    // ProcessGPT 관련
    showProcessGPTToggle: {
      type: Boolean,
      default: false
    },
    processGPTActive: {
      type: Boolean,
      default: false
    }
  });
  
  const emit = defineEmits([
    'update:newMessage',
    'update:selectedUserIndex',
    'update:file',
    'send',
    'stopLoading',
    'toggleMenu',
    'textareaInput',
    'paste',
    'keydown',
    'selectUser',
    'removeMention',
    'deleteImage',
    'changeImage',
    'startVoiceRecording',
    'stopVoiceRecording',
    'recordingModeChange',
    'requestDraftAgent',
    'submitFile',
    'toggleProcessGPT'
  ]);
  
  const captureInput = ref(null);
  const uploaderInput = ref(null);
  
  const hasFile = computed(() => props.file && props.file.length > 0);
  
  const sendDisabled = computed(() => {
    if (props.disabled) return true;
    return props.newMessage === '' && props.attachedImages.length === 0;
  });
  
  function handleEnterKey(event) {
    if (!event.shiftKey) {
      event.preventDefault();
      emit('send');
    }
  }
  
  function triggerUpload() {
    if (uploaderInput.value) {
      uploaderInput.value.value = '';
      uploaderInput.value.click();
    }
  }
  
  function triggerCapture() {
    if (captureInput.value) {
      captureInput.value.value = '';
      captureInput.value.click();
    }
  }
  
  defineExpose({
    triggerUpload,
    triggerCapture
  });
  </script>
  
  <style lang="scss" scoped>
  .chat-input-wrapper {
    position: relative;
  }
  
  .image-preview-container {
    z-index: 9999;
  }
  
  .image-preview-item {
    position: relative;
    display: inline-block;
  }
  
  .preview-image {
    border: 1px solid #ccc;
    border-radius: 10px;
    margin: 8px;
  }
  
  .delete-image-btn {
    background-color: black !important;
    margin: 4px 0px 0px -20px !important;
    position: absolute;
    top: 4px;
    right: 4px;
  }
  
  .mention-tags-container {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    padding: 8px;
    width: 100%;
    gap: 8px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    background-color: rgba(25, 118, 210, 0.04);
    border-radius: 4px 4px 0 0;
  }
  
  .mention-chip {
    height: 28px;
    font-size: 13px;
    font-weight: 500;
  }
  
  .agent-chip {
    height: 14px;
    font-size: 9px;
    font-weight: 600;
  }
  
  .user-list {
    position: absolute;
    bottom: 100%;
    left: 0;
    background-color: white;
    z-index: 100;
    max-height: 200px;
    overflow-y: auto;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    width: 100%;
  }
  
  .user-item {
    display: flex;
    align-items: center;
    padding: 10px;
    cursor: pointer;
    border-bottom: 1px solid #f0f0f0;
    background-color: white;
    
    &:hover,
    &.user-item-selected {
      background-color: #e3f2fd;
    }
  }
  
  .user-avatar {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    margin-right: 10px;
  }
  
  .user-info {
    flex: 1;
  }
  
  .user-name-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  
  .user-email {
    font-size: 0.8em;
    color: #666;
  }
  
  .agent-badge {
    height: 18px;
    font-size: 10px;
  }
  
  .chat-menu-container {
    position: absolute;
    bottom: 0;
    left: 0;
    z-index: 9999;
  }
  
  .chat-menu-background {
    background-color: aliceblue !important;
    border-radius: 10px;
    padding: 10px;
    display: flex;
    align-items: center;
    margin-bottom: 10px;
    margin-left: 10px;
  }
  </style>