<template>
    <div class="my-message-wrapper">
      <!-- 이미지 표시 -->
      <v-row class="ma-0 pa-0">
        <v-spacer />
        
        <!-- 단일 이미지 -->
        <v-sheet v-if="message.image && !message.images" class="mb-1">
          <img :src="message.image" class="rounded-md" alt="image" width="250" />
        </v-sheet>
  
        <!-- 다중 이미지 -->
        <div v-if="message.images?.length > 0" class="d-flex flex-wrap mb-1">
          <v-sheet v-for="(image, imgIndex) in message.images" :key="imgIndex" class="ma-1">
            <img :src="image.url || image" class="rounded-md" alt="image" width="250" />
          </v-sheet>
        </div>
      </v-row>
  
      <!-- 수정 모드 -->
      <div v-if="editIndex === index" class="bg-lightprimary edit-container">
        <v-textarea
          v-model="editContent"
          variant="solo"
          hide-details
          bg-color="lightprimary"
          class="shadow-none"
          density="compact"
          auto-grow
          rows="1"
          autofocus
        />
        <v-row class="pa-0 ma-0 mr-2 pb-2">
          <v-spacer />
          <v-btn
            @click="$emit('send')"
            class="text-medium-emphasis"
            icon
            variant="text"
            size="x-small"
            style="background-color: white !important; margin-right: 5px"
          >
            <SendIcon size="20" />
          </v-btn>
          <v-btn
            @click="$emit('cancel')"
            class="text-medium-emphasis"
            icon
            variant="text"
            size="x-small"
            style="background-color: white !important"
          >
            <Icons icon="backspace-bold" :size="20" />
          </v-btn>
        </v-row>
      </div>
  
      <!-- 일반 표시 모드 -->
      <div v-else>
        <!-- 사용자 정보 -->
        <div class="d-flex justify-end align-center mb-1">
          <v-avatar size="32" class="mr-2">
            <v-img :src="currentUserPicture" :alt="currentUserName" />
          </v-avatar>
          <div class="user-name">{{ currentUserName }}</div>
        </div>
  
        <div class="d-flex justify-end">
          <slot name="custom-message-actions" :message="message" />
          
          <v-sheet
            class="chat-message-bubble bg-lightprimary rounded-md px-3 py-3 mb-1"
            :class="{ 'intervention-pending': isInterventionPending }"
            :style="{ position: 'relative', overflow: 'visible' }"
          >
            <!-- 개입 대기 중 펄스 효과 -->
            <div v-if="isInterventionPending" class="intervention-pulse-overlay" />
  
            <div
              @mouseover="$emit('hover', index)"
              @mouseleave="$emit('hover', -1)"
              style="position: relative; z-index: 1; overflow: hidden"
            >
              <!-- 답장 정보 -->
              <pre v-if="message.replyUserName" class="text-body-1">{{ message.replyUserName }}</pre>
              <pre v-if="message.replyContent" class="text-body-1">{{ message.replyContent }}</pre>
              <v-divider v-if="message.replyContent" />
  
              <!-- HTML 콘텐츠 -->
              <div v-if="message.contentType === 'html'" class="w-100">
                <SummaryButton>
                  <DynamicForm
                    :formHTML="message.htmlContent"
                    v-model="message.jsonContent"
                    :readonly="true"
                  />
                </SummaryButton>
              </div>
  
              <!-- 일반 텍스트 콘텐츠 -->
              <pre
                v-if="message.content && message.contentType !== 'html'"
                class="text-body-1"
                v-html="linkifyWithMentions(message.content)"
              />
  
              <!-- 개입 정보 표시 -->
              <InterventionBadge
                v-if="hasIntervention"
                :message="message"
                :index="index"
                :expanded="expandedInterventions[index]"
                :isWaiting="isInterventionPending"
                :responseMessage="interventionResponse"
                @toggle="$emit('toggleInterventionExpansion', index)"
              />
  
              <!-- 타임스탬프 -->
              <div v-if="shouldDisplayTimestamp" class="message-timestamp my-timestamp">
                {{ formatTime(message.timeStamp) }}
              </div>
  
              <!-- JSON 콘텐츠 -->
              <pre
                v-if="message.jsonContent && message.contentType !== 'html' && !message.jsonContent.intervention"
                class="text-body-1"
              >{{ message.jsonContent }}</pre>
  
              <!-- 액션 버튼 -->
              <v-row class="ma-0 pa-0">
                <v-spacer />
                <v-btn
                  v-if="hoverIndex === index && !disableChat"
                  @click="$emit('edit', index)"
                  icon
                  variant="text"
                  size="x-small"
                  class="float-left edit-btn action-btn"
                  style="background-color: white"
                >
                  <Icons icon="pencil" :size="20" />
                </v-btn>
  
                <!-- 생성된 작업 목록 아이콘 -->
                <div
                  v-if="shouldShowWorkListIcon"
                  @click="$emit('toggleWorkList')"
                  class="find-message"
                  :class="generatedWorkList.length > 0 ? 'find-message-on' : 'find-message-off'"
                >
                  <img src="@/assets/images/chat/chat-icon.png" style="height: 30px" />
                </div>
              </v-row>
            </div>
          </v-sheet>
        </div>
      </div>
  
      <!-- 생성된 작업 목록 카드 -->
      <v-card
        v-if="showGeneratedWorkList && shouldShowWorkListIcon && generatedWorkList.length > 0"
        class="mt-3"
      >
        <v-btn
          @click="$emit('deleteAllWorkList')"
          size="small"
          icon
          density="comfortable"
          style="position: absolute; right: 5px; top: 5px; z-index: 1"
        >
          <Icons icon="trash" />
        </v-btn>
        <v-list>
          <v-list-item
            v-for="(work, workIndex) in generatedWorkList"
            :key="workIndex"
            class="d-flex align-items-center"
          >
            <div v-if="work.messageForUser" class="flex-grow-1 d-flex align-items-center">
              <div class="w-100">
                <v-row class="ma-0 pa-3">
                  <template v-if="!workIcons[work.work]">
                    <img :src="defaultWorkIcon" alt="Default Icon" style="width: 20px; height: 20px" />
                  </template>
                  <template v-else>
                    <div style="padding-top: 2px">
                      <Icons :icon="workIcons[work.work]" />
                    </div>
                  </template>
                  <div style="margin-left: 5px; margin-top: 0px">
                    {{ work.messageForUser }}
                  </div>
                  <div>
                    <v-tooltip :text="$t('chat.viewDetails')">
                      <template #activator="{ props }">
                        <v-btn
                          v-bind="props"
                          @click="work.expanded = !work.expanded"
                          class="ml-2"
                          size="small"
                          icon
                          variant="text"
                          density="comfortable"
                        >
                          <Icons :icon="work.expanded ? 'arrow-up-2' : 'arrow-down-2'" />
                        </v-btn>
                      </template>
                    </v-tooltip>
                    <v-tooltip :text="$t('chat.executeProcess')">
                      <template #activator="{ props }">
                        <v-btn
                          v-bind="props"
                          @click="$emit('startProcess', { work, index: workIndex })"
                          class="ml-2"
                          size="small"
                          icon
                          variant="text"
                          density="comfortable"
                        >
                          <Icons icon="play" color="rgb(var(--v-theme-primary))" />
                        </v-btn>
                      </template>
                    </v-tooltip>
                  </div>
                </v-row>
                <v-expand-transition>
                  <div v-if="work.expanded" class="mt-2 w-100">
                    <pre>{{ work }}</pre>
                  </div>
                </v-expand-transition>
              </div>
            </div>
            <v-divider v-if="workIndex < generatedWorkList.length - 1" />
          </v-list-item>
        </v-list>
      </v-card>
    </div>
  </template>
  
  <script setup>
  import { ref, computed } from 'vue';
  import { SendIcon } from 'vue-tabler-icons';
  import Icons from '@/components/ui-components/Icons.vue';
  import SummaryButton from '@/components/ui/SummaryButton.vue';
  import DynamicForm from '@/components/designer/DynamicForm.vue';
  import InterventionBadge from './InterventionBadge.vue';
  import defaultWorkIcon from '@/assets/images/chat/chat-icon.png';
  import { useMessages } from '../composables/useMessages';
  
  const props = defineProps({
    message: {
      type: Object,
      required: true
    },
    index: {
      type: Number,
      required: true
    },
    isLoading: {
      type: Boolean,
      default: false
    },
    messagesLength: {
      type: Number,
      default: 0
    },
    userInfo: {
      type: Object,
      required: true
    },
    currentUserName: {
      type: String,
      default: '사용자'
    },
    currentUserPicture: {
      type: String,
      default: '/images/defaultUser.png'
    },
    editIndex: {
      type: Number,
      default: -1
    },
    hoverIndex: {
      type: Number,
      default: -1
    },
    disableChat: {
      type: Boolean,
      default: false
    },
    type: {
      type: String,
      default: ''
    },
    processGPTActive: {
      type: Boolean,
      default: false
    },
    isSystemChat: {
      type: Boolean,
      default: false
    },
    generatedWorkList: {
      type: Array,
      default: () => []
    },
    showGeneratedWorkList: {
      type: Boolean,
      default: false
    },
    expandedInterventions: {
      type: Object,
      default: () => ({})
    },
    allMessages: {
      type: Array,
      default: () => []
    }
  });
  
  const emit = defineEmits([
    'hover',
    'edit',
    'send',
    'cancel',
    'toggleInterventionExpansion',
    'toggleWorkList',
    'startProcess',
    'deleteWorkList',
    'deleteAllWorkList'
  ]);
  
  const editContent = ref(props.message.content);
  
  const workIcons = {
    ScheduleQuery: 'calendar-line-duotone',
    ScheduleRegistration: 'calendar-line-duotone',
    TodoListRegistration: 'overview',
    StartProcessInstance: 'ibm-process-mining'
  };
  
  // Composables
  const { formatTime, linkifyWithMentions } = useMessages(ref([]), ref({}));
  
  // 개입 관련 computed
const hasIntervention = computed(() => {
  const status = props.message.interventionStatus || props.message.jsonContent?.intervention?.status;
  return !!status && status !== 'not_intervening';
});
  
const isInterventionPending = computed(() => {
  if (!hasIntervention.value) return false;
  
  const status = props.message.interventionStatus || props.message.jsonContent?.intervention?.status;
  if (status === 'completed') return false;
  if (status === 'checking' || status === 'intervening') return true;
  
  return !interventionResponse.value;
});
  
  function parseJsonContent(content) {
    if (!content) return null;
    if (typeof content === 'object') return content;
    try {
      return JSON.parse(content);
    } catch (e) {
      return null;
    }
  }

const interventionResponse = computed(() => {
  const all = props.allMessages || [];

  console.log('🔵 [interventionResponse] computed 실행', {
    index: props.index,
    currentMessageId: props.message?.id,
    allMessagesCount: all.length,
    messageContent: props.message?.content?.substring(0, 30)
  });

  // 1) user_message_id로 직접 매핑 (그룹채팅은 id 기반)
  const currentMessageId = props.message?.id;
  if (currentMessageId) {
    const found = all.find((msg) => {
      if (!msg) return false;
      const roleOk = ['system', 'agent', 'assistant'].includes(msg.role);
      if (!roleOk) return false;
      const json = parseJsonContent(msg.jsonContent || msg.jsonData);
      const matches = json?.user_message_id === currentMessageId;

      if (matches) {
        console.log('✅ [interventionResponse] user_message_id 매칭 성공', {
          userMessageId: currentMessageId,
          foundMessageId: msg.id,
          foundMessageRole: msg.role,
          foundMessageContent: msg.content?.substring(0, 50)
        });
      }

      return matches;
    });
    if (found) {
      console.log('✅ [interventionResponse] 응답 반환 (user_message_id)', found);
      return found;
    }
  }

  // 2) 바로 다음 메시지에서 찾는 기존 로직 (후방 호환)
    if (props.index < all.length - 1) {
      const nextMessage = all[props.index + 1];
      if (nextMessage?.role === 'system' || nextMessage?.role === 'agent' || nextMessage?.role === 'assistant') {
        console.log('✅ [interventionResponse] 응답 반환 (다음 메시지)', {
          nextMessageRole: nextMessage.role,
          nextMessageContent: nextMessage.content?.substring(0, 50)
        });
        return nextMessage;
      }
    }
  
  console.log('❌ [interventionResponse] 응답을 찾지 못함', {
    currentMessageId: currentMessageId,
    allMessagesRoles: all.map(m => m?.role).slice(-5),
    allMessagesIds: all.map(m => m?.id).slice(-5)
  });
  return null;
});
  
  // 타임스탬프 표시 여부
  const shouldDisplayTimestamp = computed(() => {
    // 마지막 메시지이거나 다음 메시지와 보낸 사람이 다르면 표시
    if (props.index === props.messagesLength - 1) return true;
    return true; // 간소화된 로직
  });
  
  // 작업 목록 아이콘 표시 여부
  const shouldShowWorkListIcon = computed(() => {
    if (props.type !== 'chats') return false;
    if (!props.processGPTActive) return false;
    if (props.isSystemChat) return false;
    
    // 마지막 내 메시지인지 확인
    return props.index === props.messagesLength - 1;
  });
  </script>
  
  <style lang="scss" scoped>
  .my-message-wrapper {
    width: 100%;
  }
  
  .user-name {
    font-weight: 500;
    font-size: 14px;
    color: rgba(0, 0, 0, 0.87);
  }
  
  .edit-container {
    border-radius: 10px;
  }
  
  .chat-message-bubble {
    max-width: 70%;
    position: relative;
  }
  
  .message-timestamp {
    font-size: 11px;
    color: rgba(0, 0, 0, 0.5);
    margin-top: 4px;
    display: inline-block;
    position: absolute;
    bottom: 5px;
  }
  
  .my-timestamp {
    bottom: 1px;
    left: -35px;
  }
  
  .action-btn {
    background-color: white !important;
    margin: 0 2px !important;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }
  
  .intervention-pending {
    border: 2px solid rgba(76, 175, 80, 0.5) !important;
    box-shadow: 0 0 10px rgba(76, 175, 80, 0.3) !important;
    animation: intervention-glow 2s ease-in-out infinite;
  }
  
  .intervention-pulse-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(90deg, transparent, rgba(76, 175, 80, 0.15), transparent);
    animation: pulse-sweep 2s ease-in-out infinite;
    pointer-events: none;
    z-index: 0;
  }
  
  @keyframes intervention-glow {
    0%, 100% {
      box-shadow: 0 0 10px rgba(76, 175, 80, 0.3);
    }
    50% {
      box-shadow: 0 0 20px rgba(76, 175, 80, 0.5);
    }
  }
  
  @keyframes pulse-sweep {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
  }
  
  .find-message {
    animation: breathe 1.5s infinite ease-in-out;
  }
  
  .find-message-on {
    opacity: 1;
    cursor: pointer;
  }
  
  .find-message-off {
    opacity: 0.4;
  }
  
  @keyframes breathe {
    0%, 100% {
      transform: scale(0.9);
    }
    50% {
      transform: scale(1.1);
    }
  }
  
  pre {
    width: 100%;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
  </style>