<template>
    <div class="chat-messages-wrapper">
      <!-- 스크롤 상하단 이동 아이콘 -->
      <div v-if="showScrollButtons" class="scroll-controls">
        <v-icon 
          @click="$emit('scrollToTop')" 
          color="primary" 
          size="28" 
          class="scroll-btn"
        >
          mdi-arrow-up-circle
          <v-tooltip activator="parent" location="left">{{ $t('chat.moveTop') }}</v-tooltip>
        </v-icon>
        <v-icon 
          @click="$emit('scrollToBottom')" 
          color="primary" 
          size="28" 
          class="scroll-btn"
        >
          mdi-arrow-down-circle
          <v-tooltip activator="parent" location="left">{{ $t('chat.moveBottom') }}</v-tooltip>
        </v-icon>
      </div>
  
      <perfect-scrollbar
        class="h-100 chat-view-box"
        ref="scrollContainer"
        @scroll="$emit('scroll', $event)"
      >
        <!-- 프로세스 생성 hover 영역 -->
        <div
          v-if="type === 'chats' && !isSystemChat"
          class="process-create-hover-area"
          @mouseenter="showProcessButton = true"
          @mouseleave="showProcessButton = false"
        >
          <transition name="slide-down">
            <div v-if="showProcessButton" class="process-create-button-container">
              <v-btn
                @click="$emit('checkProcessFromChat')"
                color="primary"
                variant="flat"
                size="small"
                :loading="isAnalyzingChat"
                class="process-create-btn"
              >
                <v-icon size="small" class="mr-1">mdi-file-document-edit</v-icon>
                프로세스 생성
              </v-btn>
            </div>
          </transition>
        </div>
  
        <div class="d-flex w-100" :style="isRightZoomed ? 'height:100vh;' : ''">
          <v-col class="chat-view-box-col pa-0">
            <slot name="custom-content" />
  
            <!-- 참여자 현황 -->
            <div v-if="participantUsers.length > 0" class="pa-4 chat-participants-box">
              <h6 class="text-subtitle-1 font-weight-bold mb-2" style="color: #333">
                {{ $t('chat.participants') }}
              </h6>
              <v-row class="ma-0 pa-0">
                <div 
                  v-for="participant in participantUsers" 
                  :key="participant.id" 
                  class="mr-4"
                >
                  <div class="d-flex align-center">
                    <v-avatar size="24" class="mr-2">
                      <v-img
                        :src="participant.profile || '/images/defaultUser.png'"
                        :alt="participant.username"
                        cover
                      >
                        <template #error>
                          <v-img src="/images/defaultUser.png" cover>
                            <template #error>
                              <v-icon size="small" style="color: #666">mdi-account</v-icon>
                            </template>
                          </v-img>
                        </template>
                      </v-img>
                    </v-avatar>
                    <div class="flex-grow-1">
                      <div class="text-body-2 font-weight-medium" style="color: #444">
                        {{ participant.username || '이름 없음' }}
                      </div>
                      <div class="text-caption" style="color: #666">
                        {{ participant.email || 'ID: ' + participant.id }}
                      </div>
                    </div>
                  </div>
                </div>
              </v-row>
            </div>
  
            <!-- 메시지 목록 -->
            <div 
              v-for="(message, index) in messages" 
              :key="index" 
              class="py-1 px-3"
            >
              <!-- 날짜 구분선 -->
              <div 
                v-if="shouldDisplayDateSeparator(message, index)" 
                class="date-separator-container"
              >
                <v-divider class="date-separator-line" />
                <div class="date-separator-text">
                  {{ formatDateSeparator(message.timeStamp) }}
                </div>
                <v-divider class="date-separator-line" />
              </div>
  
              <!-- Agent 메시지 -->
              <AgentsChat
                v-if="message && message._template === 'agent'"
                :message="message"
                :agentInfo="agentInfo"
                :totalSize="messages.length"
                :currentIndex="index"
              />
  
              <!-- 일반 메시지 -->
              <template v-else>
                <!-- 내 메시지 -->
                <div v-if="message.email === userInfo.email && message.role !== 'system'">
                  <MyMessage
                    :message="message"
                    :index="index"
                    :isLoading="isLoading"
                    :messagesLength="messages.length"
                    :allMessages="originalMessagesRef"
                    :userInfo="userInfo"
                    :currentUserName="currentUserName"
                    :currentUserPicture="currentUserPicture"
                    :editIndex="editIndex"
                    :hoverIndex="hoverIndex"
                    :disableChat="disableChat"
                    :type="type"
                    :processGPTActive="processGPTActive"
                    :isSystemChat="isSystemChat"
                    :generatedWorkList="generatedWorkList"
                    :showGeneratedWorkList="showGeneratedWorkList"
                    :expandedInterventions="expandedInterventions"
                    @hover="hoverIndex = $event"
                    @edit="$emit('editMessage', $event)"
                    @send="$emit('send')"
                    @cancel="$emit('cancelEdit')"
                    @toggleInterventionExpansion="toggleInterventionExpansion"
                    @toggleWorkList="showGeneratedWorkList = !showGeneratedWorkList"
                    @startProcess="$emit('startProcess', $event)"
                    @deleteWorkList="$emit('deleteWorkList', $event)"
                    @deleteAllWorkList="$emit('deleteAllWorkList')"
                  />
                </div>
  
                <!-- 상대방/시스템 메시지 -->
                <div v-else-if="!message.disableMsg || message.isLoading">
                  <OtherMessage
                    :message="message"
                    :index="index"
                    :isLoading="isLoading"
                    :messagesLength="messages.length"
                    :allMessages="originalMessagesRef"
                    :userInfo="userInfo"
                    :userList="userList"
                    :agentMessage="agentMessage"
                    :type="type"
                    :isMobile="isMobile"
                    :allUserList="allUserList"
                    :expandedInterventions="expandedInterventions"
                    :expandedSystemMessages="expandedSystemMessages"
                    @toggleInterventionExpansion="toggleInterventionExpansion"
                    @toggleSystemMessageExpansion="toggleSystemMessageExpansion"
                    @reply="$emit('beforeReply', $event)"
                    @viewJSON="$emit('viewJSON', $event)"
                    @addTeam="$emit('addTeam', $event)"
                    @addTeamMembers="$emit('addTeamMembers', $event)"
                    @executeProcess="$emit('executeProcess', $event)"
                    @navigateToCompanyQuery="$emit('navigateToCompanyQuery', $event)"
                  />
                </div>
              </template>
            </div>
  
            <!-- Agent 로딩 중 -->
            <AgentsChat
              v-if="type === 'instances' && agentInfo?.isRunning && messages.length === 0"
              class="px-5 py-1"
              :agentInfo="agentInfo"
              :totalSize="messages.length"
              :currentIndex="-1"
            />
  
            <slot name="custom-chat" />
          </v-col>
        </div>
      </perfect-scrollbar>
    </div>
  </template>
  
  <script setup>
  import { ref, computed, getCurrentInstance } from 'vue';
  import AgentsChat from '@/components/ui/AgentsChat.vue';
  import MyMessage from './messages/MyMessage.vue';
  import OtherMessage from './messages/OtherMessage.vue';
  import { useMessages } from './composables/useMessages';
  
  const instance = getCurrentInstance();
  const $t = (key, params) => instance?.proxy?.$t(key, params) || key;
  
  const props = defineProps({
    messages: {
      type: Array,
      default: () => []
    },
  originalMessages: {
    // 필터링되지 않은 전체 메시지 목록 (개입 응답 매핑용)
    type: Array,
    default: () => []
  },
    userInfo: {
      type: Object,
      required: true
    },
    userList: {
      type: Array,
      default: () => []
    },
    participantUsers: {
      type: Array,
      default: () => []
    },
    type: {
      type: String,
      default: ''
    },
    agentInfo: {
      type: Object,
      default: null
    },
    isLoading: {
      type: Boolean,
      default: false
    },
    disableChat: {
      type: Boolean,
      default: false
    },
    isSystemChat: {
      type: Boolean,
      default: false
    },
    processGPTActive: {
      type: Boolean,
      default: false
    },
    generatedWorkList: {
      type: Array,
      default: () => []
    },
    isAnalyzingChat: {
      type: Boolean,
      default: false
    },
    showScrollButtons: {
      type: Boolean,
      default: false
    },
    isMobile: {
      type: Boolean,
      default: false
    },
    isRightZoomed: {
      type: Boolean,
      default: false
    },
    agentMessage: {
      type: Boolean,
      default: false
    },
    allUserList: {
      type: Array,
      default: () => []
    }
  });
  
  const emit = defineEmits([
    'scroll',
    'scrollToTop',
    'scrollToBottom',
    'checkProcessFromChat',
    'editMessage',
    'send',
    'cancelEdit',
    'beforeReply',
    'viewJSON',
    'startProcess',
    'deleteWorkList',
    'deleteAllWorkList',
    'addTeam',
    'addTeamMembers',
    'executeProcess',
    'navigateToCompanyQuery'
  ]);
  
  const scrollContainer = ref(null);
  const showProcessButton = ref(false);
  const hoverIndex = ref(-1);
  const editIndex = ref(-1);
  const showGeneratedWorkList = ref(false);
  const expandedInterventions = ref({});
  const expandedSystemMessages = ref({});
  
  const currentUserName = localStorage.getItem('userName') || '사용자';
  const currentUserPicture = localStorage.getItem('picture') || '/images/defaultUser.png';
  
// Composables
const messagesRef = computed(() => props.messages);
const originalMessagesRef = computed(() =>
  props.originalMessages && props.originalMessages.length ? props.originalMessages : props.messages
);
const userInfoRef = computed(() => props.userInfo);
  const { shouldDisplayDateSeparator: checkDateSeparator, formatDateSeparator: formatDate } = useMessages(messagesRef, userInfoRef);
  
  function shouldDisplayDateSeparator(message, index) {
    return checkDateSeparator(message, index, props.messages, $t);
  }
  
  function formatDateSeparator(timeStamp) {
    return formatDate(timeStamp, $t);
  }
  
  function toggleInterventionExpansion(index) {
    expandedInterventions.value[index] = !expandedInterventions.value[index];
  }
  
  function toggleSystemMessageExpansion(index) {
    expandedSystemMessages.value[index] = !expandedSystemMessages.value[index];
  }
  
  defineExpose({
    scrollContainer
  });
  </script>
  
  <style lang="scss" scoped>
  .chat-messages-wrapper {
    position: relative;
    height: 100%;
  }
  
  .scroll-controls {
    position: absolute;
    bottom: 8px;
    right: 8px;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: 8px;
    pointer-events: auto;
  }
  
  .scroll-btn {
    cursor: pointer;
    border-radius: 50%;
    padding: 4px;
  }
  
  .process-create-hover-area {
    position: sticky;
    top: 0;
    width: 100%;
    height: 50px;
    z-index: 100;
    pointer-events: auto;
    margin-bottom: -50px;
  }
  
  .process-create-button-container {
    position: sticky;
    top: 0;
    width: 100%;
    display: flex;
    justify-content: flex-end;
    padding: 8px 16px;
    background: linear-gradient(to bottom, rgba(255, 255, 255, 0.98), rgba(255, 255, 255, 0.85));
    backdrop-filter: blur(10px);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
    z-index: 101;
    pointer-events: none;
  }
  
  .process-create-btn {
    pointer-events: auto;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    transition: transform 0.2s ease;
  
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }
  }
  
  .chat-participants-box {
    background-color: #f8f9fa;
    border-radius: 8px;
    margin: 8px;
    border: 1px solid #e9ecef;
  }
  
  .date-separator-container {
    display: flex;
    align-items: center;
    margin: 20px 0;
    padding: 0 16px;
  }
  
  .date-separator-line {
    flex: 1;
    opacity: 0.3;
  }
  
  .date-separator-text {
    margin: 0 16px;
    font-size: 12px;
    color: rgba(0, 0, 0, 0.6);
    background-color: rgba(255, 255, 255, 0.9);
    padding: 4px 12px;
    border-radius: 12px;
    font-weight: 500;
    white-space: nowrap;
    text-align: center;
    min-width: fit-content;
  }
  
  // 애니메이션
  .slide-down-enter-active {
    transition: all 0.3s ease-out;
  }
  
  .slide-down-leave-active {
    transition: all 0.2s ease-in;
  }
  
  .slide-down-enter-from {
    opacity: 0;
    transform: translateY(-20px);
  }
  
  .slide-down-leave-to {
    opacity: 0;
    transform: translateY(-10px);
  }
  </style>