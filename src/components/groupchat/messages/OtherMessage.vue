<template>
    <div class="other-message-wrapper">
      <!-- 사용자 정보 표시 -->
      <v-row v-if="shouldDisplayUserInfo && !agentMessage" class="ma-0 pa-0">
        <v-row class="ma-0 pa-0 d-flex align-center mb-2">
          <v-avatar size="40" style="margin-right: 10px">
            <img
              v-if="message.role === 'system'"
              src="@/assets/images/chat/chat-icon.png"
              height="40"
              width="40"
            />
            <v-img v-else :src="userProfile" :alt="message.name" height="40" width="40" />
          </v-avatar>
          <div class="user-name">
            {{ message.role === 'system' ? 'System' : message.name }}
          </div>
        </v-row>
      </v-row>
  
      <!-- HTML 콘텐츠 -->
      <div v-if="message.contentType === 'html'" style="margin-bottom: 15px">
        <DynamicForm
          :formHTML="message.htmlContent"
          v-model="message.jsonContent"
          :readonly="true"
        />
      </div>
  
      <!-- JSON 콘텐츠 (instances) -->
      <div v-else-if="message.contentType === 'json' && type === 'instances'">
        <ProcessWorkResult :message="message" />
      </div>
  
      <!-- 마크다운 콘텐츠 -->
      <div
        v-else-if="message.contentType === 'markdown' || (message.role === 'system' && !message.contentType)"
        :class="agentMessage || message.role === 'system' ? 'agent-message' : 'other-message'"
      >
        <!-- 시스템 메시지 접힌 상태 -->
        <div
          v-if="(message.role === 'system' || message.role === 'agent') && !expandedSystemMessages[index]"
          class="system-message-badge"
          @click.stop="$emit('toggleSystemMessageExpansion', index)"
        >
          <v-icon color="primary" size="16" class="mr-2">mdi-robot</v-icon>
          <span class="font-weight-medium">AI 어시스턴트 응답</span>
          <v-icon size="14" class="ml-2">mdi-chevron-down</v-icon>
        </div>
  
        <!-- 시스템 메시지 펼쳐진 상태 -->
        <div v-else>
          <div
            v-if="(message.role === 'system' || message.role === 'agent') && expandedSystemMessages[index]"
            class="d-flex justify-end mb-1"
          >
            <v-icon
              size="14"
              color="grey"
              style="cursor: pointer"
              @click.stop="$emit('toggleSystemMessageExpansion', index)"
            >
              mdi-chevron-up
            </v-icon>
          </div>
          
          <div
            v-html="renderedMarkdown(message.content, isLastMessageLoading)"
            class="markdown-content pl-3 py-2"
          />
  
          <!-- 프로세스 실행 폼 -->
          <ProcessExecutionForm
            v-if="message.work === 'StartProcessInstance' && message.firstActivityForm"
            :message="message"
            @execute="$emit('executeProcess', $event)"
          />
  
          <!-- 회사 정보 조회 버튼 -->
          <div v-if="message.companyQueryUrl" class="mt-3 pl-3">
            <v-btn
              color="primary"
              variant="elevated"
              size="small"
              @click="$emit('navigateToCompanyQuery', message.companyQueryUrl)"
            >
              <v-icon left small class="mr-1">mdi-open-in-new</v-icon>
              확인하기
            </v-btn>
          </div>
        </div>
      </div>
  
      <!-- 일반 텍스트 콘텐츠 -->
      <div v-else class="w-100 pb-3">
        <!-- 이미지 표시 -->
        <v-sheet v-if="message.image && !message.images" class="mb-1">
          <img :src="message.image" class="rounded-md" alt="image" width="250" />
        </v-sheet>
  
        <div v-if="message.images?.length > 0" class="d-flex flex-wrap mb-1">
          <v-sheet v-for="(image, imgIndex) in message.images" :key="imgIndex" class="ma-1">
            <img :src="image.url || image" class="rounded-md" alt="image" width="250" />
          </v-sheet>
        </div>
  
        <div class="progress-border" :class="{ animate: borderAnimated }">
          <template v-if="message.role === 'system' && isLastMessage">
            <div
              v-for="n in 5"
              :key="n"
              class="progress-border-span"
              :class="{ opacity: !borderAnimated }"
            />
          </template>
  
          <v-sheet
            v-if="message.content"
            class="other-message rounded-md pa-0 chat-message-bubble"
            @mouseover="replyIndex = index"
            @mouseleave="replyIndex = -1"
          >
            <div class="pa-2">
              <!-- 답장 정보 -->
              <pre v-if="message.replyUserName" class="text-body-1">{{ message.replyUserName }}</pre>
              <pre v-if="message.replyContent" class="text-body-1">{{ message.replyContent }}</pre>
              <v-divider v-if="message.replyContent" />
  
              <pre v-if="message.disableMsg" class="text-body-1">...</pre>
              <div v-else-if="message.htmlContent" v-html="message.htmlContent" class="text-body-1" />
              <pre
                v-else
                class="text-body-1"
                v-html="linkifyWithMentions(setMessageForUser(message.content))"
              />
  
              <!-- 개입 정보 표시 -->
              <InterventionBadge
                v-if="hasIntervention && message.role !== 'system'"
                :message="message"
                :index="index"
                :expanded="expandedInterventions[index]"
                :isWaiting="isInterventionPending"
                :responseMessage="interventionResponse"
                @toggle="$emit('toggleInterventionExpansion', index)"
              />
  
              <!-- 팀 추가 버튼 -->
              <div v-if="message.type === 'add_team'" class="mt-2">
                <v-btn
                  style="border: 1px solid #e0e0e0; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1)"
                  color="white"
                  variant="elevated"
                  size="small"
                  class="mr-2"
                  @click="$emit('addTeam', { message, index })"
                  :disabled="message.added || message.adding"
                >
                  <template v-if="message.adding">
                    <v-progress-circular
                      indeterminate
                      color="primary"
                      size="16"
                      width="2"
                      style="margin-right: 5px"
                    />
                  </template>
                  <template v-else-if="message.added">
                    <v-icon style="margin-right: 3px">mdi-check</v-icon>
                    추가됨
                  </template>
                  <template v-else>추가</template>
                </v-btn>
  
                <v-btn
                  v-if="message.added"
                  style="border: 1px solid #e0e0e0; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1)"
                  color="white"
                  variant="elevated"
                  size="small"
                  @click="toggleTeamMemberSelector"
                >
                  <v-icon style="margin-right: 3px">mdi-account-edit</v-icon>
                  팀원 관리({{ selectedTeamMembers.length }})
                </v-btn>
              </div>
  
              <!-- 타임스탬프 -->
              <div v-if="shouldDisplayTimestamp" class="message-timestamp other-timestamp">
                {{ formatTime(message.timeStamp) }}
              </div>
  
              <!-- 액션 버튼 -->
              <v-row class="pa-0 ma-0 message-actions">
                <div v-if="isMobile || replyIndex === index" class="d-flex">
                  <v-btn
                    v-if="type !== 'AssistantChats' && message.specific"
                    @click="viewWork"
                    variant="text"
                    size="x-small"
                    icon
                    class="action-btn"
                  >
                    <Icons icon="document" :size="20" />
                  </v-btn>
                  <v-btn
                    @click="$emit('reply', message)"
                    variant="text"
                    size="x-small"
                    icon
                    class="action-btn"
                  >
                    <Icons icon="reply" :size="20" />
                  </v-btn>
                  <v-btn
                    @click="$emit('viewJSON', index)"
                    variant="text"
                    size="x-small"
                    icon
                    class="action-btn"
                  >
                    <Icons
                      :icon="message.jsonContent && isViewJSON ? 'arrow-up-2' : 'arrow-down-2'"
                      :size="20"
                    />
                  </v-btn>
                </div>
              </v-row>
  
              <!-- 팀원 선택 UI -->
              <TeamMemberSelector
                v-if="showTeamMemberSelector"
                :allUserList="allUserList"
                :selectedMembers="selectedTeamMembers"
                @close="showTeamMemberSelector = false"
                @update:selectedMembers="selectedTeamMembers = $event"
                @confirm="handleTeamMemberConfirm"
              />
            </div>
  
            <!-- 로딩 프로그레스 -->
            <v-progress-linear
              v-if="isLastMessage && isLoading"
              style="margin-top: -4px; border-radius: 0 0 10px 10px; width: 99%"
              indeterminate
              class="my-progress-linear"
            />
          </v-sheet>
        </div>
      </div>
    </div>
  </template>
  
  <script setup>
import { ref, computed } from 'vue';
  import Icons from '@/components/ui-components/Icons.vue';
  import DynamicForm from '@/components/designer/DynamicForm.vue';
  import ProcessWorkResult from '@/components/ui/ProcessWorkResult.vue';
  import InterventionBadge from './InterventionBadge.vue';
  import TeamMemberSelector from './TeamMemberSelector.vue';
  import ProcessExecutionForm from './ProcessExecutionForm.vue';
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
    userList: {
      type: Array,
      default: () => []
    },
    agentMessage: {
      type: Boolean,
      default: false
    },
    type: {
      type: String,
      default: ''
    },
    isMobile: {
      type: Boolean,
      default: false
    },
    allUserList: {
      type: Array,
      default: () => []
    },
    expandedInterventions: {
      type: Object,
      default: () => ({})
    },
    expandedSystemMessages: {
      type: Object,
      default: () => ({})
    },
    allMessages: {
      type: Array,
      default: () => []
    }
  });
  
  const emit = defineEmits([
    'toggleInterventionExpansion',
    'toggleSystemMessageExpansion',
    'reply',
    'viewJSON',
    'addTeam',
    'addTeamMembers',
    'executeProcess',
    'navigateToCompanyQuery'
  ]);
  
  const replyIndex = ref(-1);
  const isViewJSON = ref(false);
  const isViewWork = ref(false);
  const showTeamMemberSelector = ref(false);
  const selectedTeamMembers = ref([]);
  const borderAnimated = ref(false);
  
  // Composables
  const { formatTime, linkifyWithMentions, setMessageForUser, renderedMarkdown } = useMessages(ref([]), ref({}));
  
  // Computed
  const isLastMessage = computed(() => props.index === props.messagesLength - 1);
  
  const isLastMessageLoading = computed(() => isLastMessage.value && props.isLoading);
  
  const shouldDisplayUserInfo = computed(() => {
    if (props.index === 0) return true;
    // 간소화된 로직
    return true;
  });
  
  const shouldDisplayTimestamp = computed(() => {
    return true; // 간소화된 로직
  });
  
  const userProfile = computed(() => {
    if (props.message.role === 'agent') {
      return props.message.profile || '/images/chat-icon.png';
    }
    if (!props.userList) return '/images/defaultUser.png';
    const user = props.userList.find((u) => u.email === props.message.email);
    return user?.profile || '/images/defaultUser.png';
  });
  
// 개입 관련 (id 기반)
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

const currentMessageUuid = computed(() => props.message?.id);

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

    // 1) user_message_id로 직접 매핑 (우선)
    const currentMessageId = props.message?.id;
    if (currentMessageId) {
      const found = all.find((msg) => {
        if (!msg) return false;
        const roleOk = ['system', 'agent', 'assistant'].includes(msg.role);
        if (!roleOk) return false;
        const json = parseJsonContent(msg.jsonContent || msg.jsonData);
        return json?.user_message_id === currentMessageId;
      });
      if (found) return found;
    }
    
    // 2) 바로 다음 메시지에서 찾는 기존 로직 (후방 호환)
    if (props.index < all.length - 1) {
      const nextMessage = all[props.index + 1];
      if (nextMessage?.role === 'system' || nextMessage?.role === 'agent' || nextMessage?.role === 'assistant') {
        return nextMessage;
      }
    }
    return null;
  });
  
  // Methods
  function viewWork() {
    isViewWork.value = !isViewWork.value;
  }
  
  function toggleTeamMemberSelector() {
    showTeamMemberSelector.value = !showTeamMemberSelector.value;
  }
  
  function handleTeamMemberConfirm() {
    emit('addTeamMembers', {
      selectedTeamMembers: selectedTeamMembers.value,
      selectedTeamInfo: props.message.newTeamInfo
    });
    showTeamMemberSelector.value = false;
  }
  </script>
  
  <style lang="scss" scoped>
  .other-message-wrapper {
    width: 100%;
  }
  
  .user-name {
    font-weight: 500;
    font-size: 14px;
    color: rgba(0, 0, 0, 0.87);
  }
  
  .chat-message-bubble {
    max-width: 70%;
    position: relative;
  }
  
  .other-message {
    margin-right: auto;
    border-radius: 8px !important;
    background-color: #f5f5f5 !important;
  }
  
  .agent-message {
    margin-right: auto;
    background-color: transparent !important;
    border-radius: 8px !important;
  }
  
  .message-timestamp {
    font-size: 11px;
    color: rgba(0, 0, 0, 0.5);
    margin-top: 4px;
    display: inline-block;
    position: absolute;
    bottom: 5px;
  }
  
  .other-timestamp {
    right: -35px;
    bottom: 1px;
  }
  
  .message-actions {
    position: relative;
    top: 17px;
    transform: translateY(-50%);
    display: none;
  }
  
  .chat-message-bubble:hover .message-actions {
    display: flex;
  }
  
  .action-btn {
    background-color: white !important;
    margin: 0 2px !important;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }
  
  .system-message-badge {
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    padding: 6px 12px;
    border-radius: 16px;
    font-size: 0.75rem;
    transition: all 0.2s ease;
    margin: 8px 0;
    background-color: rgba(25, 118, 210, 0.1);
    border: 1px solid rgba(25, 118, 210, 0.3);
    color: #1565c0;
  
    &:hover {
      opacity: 0.8;
      transform: translateY(-1px);
      background-color: rgba(25, 118, 210, 0.15) !important;
    }
  }
  
  pre {
    width: 100%;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
  </style>