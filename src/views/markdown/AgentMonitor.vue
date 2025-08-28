<template>
  <BrowserAgent v-if="openBrowserAgent" :html="html" :workItem="workItem" :doneWorkItemList="doneWorkItemList" />
  <div v-else class="agent-monitor">
    <div class="task-area" ref="taskArea">
      <div v-if="errorMessage" class="error-banner">{{ errorMessage }}</div>
      
      <div v-if="timeline.length > 0" class="timeline-list">
        <div v-for="(item, index) in timeline" :key="getTimelineKey(item, index)" class="timeline-item">
          <!-- 작업 카드 -->
          <div v-if="item.type === 'task'" class="task-card">
            <!-- 작업 헤더 -->
            <div class="task-header">
              <div class="task-left">
                <div class="task-avatar">
                  <img v-if="item.payload.agentProfile" :src="item.payload.agentProfile" alt="Agent" class="avatar-image"/>
                  <span v-else>{{ index + 1 }}</span>
                </div>
                <div class="task-info">
                  <h3 class="task-title">{{ getDisplayName(item.payload) }}</h3>
                  <p class="task-description">{{ item.payload.goal }}</p>
                </div>
              </div>
              <div class="task-header-right">
                <div :class="getTaskStatusClass(item.payload)">
                  <div class="status-dot"></div>
                  <span>{{ getStatusText(item.payload) }}</span>
                </div>
              </div>
            </div>

            <!-- 작업 메타데이터 -->
            <div class="task-meta">
              <div v-for="meta in getTaskMeta(item.payload)" :key="meta.label" class="meta-item">
                <span class="meta-label">{{ meta.label }}</span>
                <span class="meta-value">{{ meta.value }}</span>
              </div>
              <div v-if="shouldShowSubmitButton(item.payload)" class="meta-submit">
                <button @click="submitTask(item.payload)" class="submit-button-light">채택</button>
              </div>
            </div>

            <!-- Human Asked 응답 영역 -->
            <div v-if="item.payload.isHumanAsked" class="human-query-input">
              <div class="query-header">
                <h4 class="query-title">응답 요청</h4>
                <div class="role-pill">{{ item.payload.role }}</div>
              </div>
              <div class="query-content">
                <p class="query-question">{{ item.payload.humanQueryData.text || '요청 내용이 전송되었습니다.' }}</p>
                <div v-if="!item.payload.isCompleted && item.payload.humanQueryData.type === 'text'" class="input-field">
                  <input 
                    v-model.trim="humanQueryAnswers[item.payload.id]" 
                    class="query-input" 
                    type="text" 
                    placeholder="답변을 입력하세요" 
                  />
                </div>
                <div v-else-if="!item.payload.isCompleted && item.payload.humanQueryData.type === 'select'" class="input-field">
                  <select v-model="humanQueryAnswers[item.payload.id]" class="query-select">
                    <option disabled value="">선택하세요</option>
                    <option v-for="opt in item.payload.humanQueryData.options" :key="opt" :value="opt">{{ opt }}</option>
                  </select>
                </div>
                <div v-else-if="!item.payload.isCompleted && item.payload.humanQueryData.type === 'confirm'" class="confirm-hint">
                  계속 진행하시려면 확인을 눌러주세요.
                </div>
              </div>
              <div v-if="!item.payload.isCompleted" class="query-actions">
                <button 
                  class="query-confirm" 
                  :disabled="item.payload.humanQueryData.type !== 'confirm' && !humanQueryAnswers[item.payload.id]" 
                  @click="onConfirmHumanQuery(item.payload)"
                >
                  확인
                </button>
                <button class="query-cancel" @click="onCancelHumanQuery(item.payload)">취소</button>
              </div>
              <div v-else class="query-completed">
                <span class="completed-pill" :class="getHumanResultClass(item.payload)">{{ getHumanResultText(item.payload) }}</span>
                <span v-if="getHumanResultDetail(item.payload)" class="completed-detail">{{ getHumanResultDetail(item.payload) }}</span>
              </div>
            </div>

            <!-- 작업 결과 -->
            <div v-else-if="item.payload.isCompleted && item.payload.content" class="task-result">
              <div class="result-header">
                <h4 class="result-title">작업 결과</h4>
              </div>
              <div class="result-content">
                <!-- 슬라이드 결과 -->
                <div v-if="item.payload.crewType === 'slide'" class="slides-container">
                  <div class="slides-header">
                    <div class="header-info">
                      <h5>프레젠테이션 모드</h5>
                      <span class="slide-hint">슬라이드를 클릭하여 탐색하세요</span>
                    </div>
                    <div class="slide-navigation">
                      <button @click="previousSlide(item.payload.id)" :disabled="getSlideIndex(item.payload.id) === 0" class="nav-btn">←</button>
                      <span class="slide-counter">{{ getSlideIndex(item.payload.id) + 1 }} / {{ getSlides(item.payload.content).length }}</span>
                      <button @click="nextSlide(item.payload.id)" :disabled="getSlideIndex(item.payload.id) === getSlides(item.payload.content).length - 1" class="nav-btn">→</button>
                    </div>
                  </div>
                  <div class="slide-content">
                      <div v-html="getCurrentSlide(item.payload)" class="slide-inner"></div>
                  </div>
                  <div class="slide-indicators">
                      <span v-for="(slide, index) in getSlides(item.payload.content)" :key="index"
                          :class="['indicator', { active: index === getSlideIndex(item.payload.id) }]"
                          @click="goToSlide(item.payload.id, index)"></span>
                  </div>
                </div>
                
                <!-- 마크다운 결과 -->
                <div v-else-if="isMarkdownType(item.payload.crewType)" 
                    :class="['markdown-container', { 
                      expanded: isTaskExpanded(item.payload.id),
                      'has-expand-controls': shouldShowExpandControls(item.payload)
                    }]"
                    @dblclick="toggleTaskExpansion(item.payload.id)"
                    v-html="getMarkdownContent(item.payload)"
                ></div>
                
                <!-- JSON 결과 -->
                 <div v-else :class="['json-container', { 
                       expanded: isTaskExpanded(item.payload.id),
                       'has-expand-controls': shouldShowExpandControls(item.payload)
                     }]"
                     @dblclick="toggleTaskExpansion(item.payload.id)"
                >
                  <div>{{ formatJsonOutput(item.payload.content) }}</div>
                </div>
              </div>
              <div v-if="shouldShowExpandControls(item.payload)" class="expand-controls">
                <button @click="toggleTaskExpansion(item.payload.id)" class="expand-button">
                  {{ isTaskExpanded(item.payload.id) ? '접기' : '더보기' }}
                  <span class="expand-icon">{{ isTaskExpanded(item.payload.id) ? '▲' : '▼' }}</span>
                </button>
                <span class="expand-hint">
                  더블클릭으로도 {{ isTaskExpanded(item.payload.id) ? '접기' : '펼치기' }}가 가능합니다
                </span>
              </div>
            </div>

            <!-- 진행 상태 -->
            <div v-else-if="!item.payload.isCompleted" class="task-progress">
              <div class="progress-dots">
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
              </div>
              <span>작업을 진행하고 있습니다...</span>
            </div>

            <!-- 도구 사용 상태 -->
            <div v-if="!item.payload.isCompleted && getToolUsageList(item.payload.jobId).length" class="tool-usage-status-list">
              <div v-for="(tool, idx) in getToolUsageList(item.payload.jobId)" :key="`${item.payload.jobId}-${tool.tool_name}-${idx}`" class="tool-usage-status-item">
                <div class="tool-status-indicator">
                  <div v-if="tool.status === 'searching'" class="loading-spinner"></div>
                  <div v-else class="check-mark">✓</div>
                </div>
                <span>{{ getToolStatusText(tool) }}</span>
              </div>
            </div>
          </div>

          <!-- 채팅 메시지 -->
          <div v-else class="chat-message">
            <div class="bubble">{{ item.payload.content }}</div>
          </div>
        </div>
      </div>

      <!-- 빈 상태 -->
      <div v-else class="empty-state">
        <h3>{{ isQueued ? '작업이 대기열에 등록되었습니다' : '진행중인 작업이 없습니다' }}</h3>
        <p>작업이 시작되면 여기에 표시됩니다.</p>
        <div v-if="!isQueued" class="start-controls">
          <v-container>
            <v-row justify="center">
              <v-col cols="12" class="text-center mb-4">
                <h3>연구 방식을 선택하세요</h3>
              </v-col>
            </v-row>
            
            <v-row>
              <v-col v-for="option in orchestrationOptions" :key="option.value" 
                cols="12" sm="12" md="6" class="d-flex"
              >
                <v-card 
                  :class="['method-card-vuetify', { 'selected': selectedOrchestrationMethod === option.value }]"
                  :color="selectedOrchestrationMethod === option.value ? 'primary' : 'white'"
                  :variant="selectedOrchestrationMethod === option.value ? 'elevated' : 'outlined'"
                  @click="selectOrchestrationMethod(option.value)"
                  hover
                  class="flex-fill"
                >
                    <v-card-text class="text-center pa-4">
                      <div class="card-icon-vuetify mb-3">
                        <Icons :icon="option.icon" :color="selectedOrchestrationMethod === option.value ? 'white' : 'black'" :size="50" />
                      </div>
                      <v-card-title class="card-title-vuetify pa-0 mb-2">{{ option.label }}</v-card-title>
                      <v-card-subtitle class="card-description-vuetify pa-0">{{ getMethodDescription(option.value) }}</v-card-subtitle>
                    <v-icon v-if="selectedOrchestrationMethod === option.value" 
                           class="selected-indicator-vuetify" 
                           color="white">mdi-check-circle</v-icon>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
            
            <v-row v-if="showDownloadButton" justify="center" class="ma-0 pa-0">
              <v-col cols="auto">
                <v-alert type="info" variant="tonal" color="gray" class="text-caption">
                  Browser use 기능은 다운로드 후 압축 해제 후 사용 가능합니다. (용량: 114MB)
                </v-alert>
              </v-col>
            </v-row>
          </v-container>
        </div>
      </div>
        <v-row justify="center" class="ma-0 pa-4 pr-2 pb-0">
          <v-spacer></v-spacer>
          <v-btn v-if="showDownloadButton" 
              @click="downloadBrowserAgent" 
              :disabled="!selectedOrchestrationMethod"
              color="primary"
              variant="elevated" 
              class="rounded-pill"
              density="compact"
          >다운로드</v-btn>
          <v-btn v-else 
              @click="startTask" 
              :disabled="!selectedOrchestrationMethod"
              color="primary"
              variant="elevated" 
              class="rounded-pill"
              density="compact"
          >시작하기</v-btn>
        </v-row>

      <!-- 로딩 상태 -->
      <div v-if="isLoading" class="feedback-loading">
        <div class="loading-spinner"></div>
        <span>{{ getLoadingMessage() }}</span>
        <button @click="stopTask" class="stop-button" aria-label="중단">⏹</button>
      </div>
    </div>

    <!-- 채팅 입력 -->
    <div v-if="tasks.length > 0" class="chat-input-wrapper">
      <Chat
        :messages="chatMessages"
        :agentInfo="{ isRunning: isLoading, isConnection: false }"
        :disableChat="isLoading"
        type="chats"
        :userInfo="{ name: '', email: '' }"
        :chatRoomId="getTaskIdFromWorkItem()"
        @sendMessage="submitChat"
        @stopMessage="stopTask"
      >
        <template #custom-input-tools>
          <div class="simple-dropdown" @click="toggleDropdown" ref="dropdown">
            <div class="dropdown-trigger">
              <span class="dropdown-label">연구방식</span>
            </div>
            <div v-if="isDropdownOpen" class="dropdown-menu">
              <div v-for="option in orchestrationOptions" :key="option.value"
                class="dropdown-item" :class="{ active: selectedOrchestrationMethod === option.value }"
                @click.stop="selectOption(option.value)"
              >
                <div class="option-left">
                  <Icons :icon="option.icon"
                    class="option-icon"
                  />
                  <span class="option-label">{{ option.label }}</span>
                </div>
                <span v-if="selectedOrchestrationMethod === option.value" class="check-icon">✓</span>
              </div>
            </div>
          </div>
        </template>
      </Chat>
    </div>


  </div>
</template>

<script>
import ChatModule from '@/components/ChatModule.vue'
import Chat from '@/components/ui/Chat.vue'
import { marked } from 'marked'
import BackendFactory from '@/components/api/BackendFactory'
import BrowserAgent from '@/components/BrowserAgent.vue'

const backend = BackendFactory.createBackend()

export default {
  name: 'AgentMonitor',
  mixins: [ChatModule],
  components: { Chat, BrowserAgent },
  props: {
    html: {
      type: String,
      required: true
    },
    workItem: {
      type: Object,
    }
  },
  data() {
    return {
      events: [],
      channel: null,
      slideIndexes: {},
      expandedTasks: {},
      errorMessage: null,
      todoStatus: null,
      chatMessages: [],
      isCancelled: false,
      isLoading: false,
      selectedOrchestrationMethod: null, // 통합된 오케스트레이션 방식
      isDropdownOpen: false, // 드롭다운 열림 상태
      openBrowserAgent: false,
      downloadedBrowserAgent: false,
      doneWorkItemList: [],
      // 이벤트 기반 즉시 표시 및 1회 동기화 플래그
      hasReceivedEvent: false,
      hasSyncedTodoStatusOnce: false,
      // human_asked 응답 관리
      humanQueryAnswers: {},
      // 공통 옵션 배열
      orchestrationOptions: [
        { value: 'crewai-deep-research', label: 'CrewAI 심층 연구', startLabel: 'CrewAI Deep Research', icon: 'playoff' },
        { value: 'crewai-action', label: 'CrewAI 액션', startLabel: 'CrewAI Action', icon: 'flowchart' },
        { value: 'openai-deep-research', label: 'OpenAI 심층 연구', startLabel: 'OpenAI Deep Research', icon: 'playoff' },
        { value: 'langchain-react', label: 'LangChain 연구', startLabel: 'LangChain Research', icon: 'playoff' },
        { value: 'browser-use', label: 'Browser Use', startLabel: 'Browser Use', icon: 'browser' }
      ]
    }
  },
  computed: {
    tasks() {
      const taskMap = new Map()
      const crewCompletedJobIds = new Set()
      const humanAskedTasks = []
      const humanRespondedJobIds = new Set()
      const humanResponseByJobId = {}
      
      // 단일 루프로 이벤트 처리
      this.events.forEach(e => {
        const { event_type, crew_type, data, job_id, id, timestamp } = e
        const jobId = job_id || data?.job_id || id
        
        if (event_type === 'crew_completed') {
          crewCompletedJobIds.add(jobId)
        } else if (event_type === 'human_response') {
          humanRespondedJobIds.add(jobId)
          humanResponseByJobId[jobId] = e
        } else if (event_type === 'task_started') {
          taskMap.set(jobId, {
            id,
            jobId,
            goal: data?.goal || 'Task',
            name: data?.name || '',
            role: data?.role || 'Agent',
            crewType: crew_type || 'default',
            startTime: timestamp,
            isCompleted: false,
            outputRaw: null,
            content: null,
            isCrewCompleted: false,
            agentProfile: data?.agent_profile,
            isHumanAsked: false
          })
        } else if (event_type === 'task_completed' && taskMap.has(jobId)) {
          const task = taskMap.get(jobId)
          task.isCompleted = true
          task.outputRaw = data || null
          task.content = this.resolvePrimaryValue(data || null, task.crewType)
        } else if (event_type === 'human_asked') {
          // human_asked 이벤트를 별도 작업으로 추가 (블루톤 카드용 텍스트 구성)
          const baseDescription = '사용자의 승인 및 추가 정보가 필요합니다. 아래 작업 계획대로 진행해도 괜찮다면 확인을 눌러주세요. 필요한 경우 입력 또는 선택 항목을 작성해 주세요.'

          const response = humanResponseByJobId[jobId] || null
          humanAskedTasks.push({
            id,
            jobId,
            goal: baseDescription,
            name: '사용자 승인 및 추가 정보 요청',
            role: data?.role || 'System',
            crewType: 'human_asked',
            startTime: timestamp,
            isCompleted: Boolean(response),
            outputRaw: null,
            content: null,
            isCrewCompleted: false,
            agentProfile: data?.agent_profile || null,
            isHumanAsked: true,
            humanQueryData: {
              type: data?.type || 'text',
              options: Array.isArray(data?.options) ? data.options : [],
              text: data?.text || ''
            },
            humanResponse: response,
            eventRow: e
          })
        }
      })
      
      // crew_completed 마킹 - job_id 기준으로 처리
      crewCompletedJobIds.forEach(jobId => {
        if (taskMap.has(jobId)) {
          taskMap.get(jobId).isCrewCompleted = true
        }
      })

      // human_response 존재 시 해당 human_asked 카드를 완료 처리
      humanAskedTasks.forEach(task => {
        if (humanRespondedJobIds.has(task.jobId)) {
          task.isCompleted = true
          task.humanResponse = task.humanResponse || humanResponseByJobId[task.jobId] || null
        }
      })
      
      // 일반 작업과 human_asked 작업을 합치고 시간 순으로 정렬
      const allTasks = [...Array.from(taskMap.values()), ...humanAskedTasks]
      return allTasks.sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
    },
    showDownloadButton() {
      return this.selectedOrchestrationMethod === 'browser-use' && !this.downloadedBrowserAgent
    },
    toolUsageStatusByTask() {
      const usageMap = {}
      // 이벤트를 시간 순으로 처리하고, 도구 시작-완료 매칭을 스택(LIFO) 방식으로 처리
      this.events
        .slice()
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
        .forEach(e => {
          const { event_type, data, job_id, id } = e
          const jobId = job_id || data?.job_id || id
          if (!usageMap[jobId]) usageMap[jobId] = []

          if (event_type === 'tool_usage_started') {
            usageMap[jobId].push({
              tool_name: data.tool_name,
              query: data.query,
              info: null,
              status: 'searching'
            })
          } else if (event_type === 'tool_usage_finished') {
            const list = usageMap[jobId]
            // LIFO 방식으로 마지막 시작 이벤트를 먼저 처리
            for (let i = list.length - 1; i >= 0; i--) {
              if (list[i].tool_name === data.tool_name && list[i].status === 'searching') {
                list[i].status = 'done'
                list[i].info = data.info
                break
              }
            }
          }
        })
      return usageMap
    },
    isQueued() {
      // 유효한 orchestration 값 목록 생성
      const validOrchs = this.orchestrationOptions.map(o => o.value)
      // 시작 직후(첫 이벤트 이전)에도 대기 문구가 뜨도록 hasReceivedEvent 조건 제거
      return this.todoStatus &&
        this.todoStatus.status === 'IN_PROGRESS' &&
        (this.todoStatus.agent_mode === 'DRAFT' || this.todoStatus.agent_mode === 'COMPLETE') &&
        validOrchs.includes(this.todoStatus.agent_orch)
    },
    timeline() {
      const taskItems = this.tasks.map(task => ({ type: 'task', time: task.startTime, payload: task }));
      const chatItems = this.chatMessages.map(msg => ({ type: 'chat', time: msg.time, payload: msg }));
      return [...taskItems, ...chatItems].sort((a, b) => new Date(a.time) - new Date(b.time));
    },
  },
  methods: {
    // ========================================
    // 🔧 공통 유틸리티 메서드들
    // ========================================
    handleError(error, defaultMessage = '오류가 발생했습니다') {
      const message = error?.message || error || defaultMessage;
      this.errorMessage = message;
      console.error(message, error);
    },

    validateTaskId() {
      const taskId = this.getTaskIdFromWorkItem();
      if (!taskId) {
        this.handleError(null, 'taskId를 찾을 수 없습니다.');
        return null;
      }
      return taskId;
    },

    parseJson(data, fallback = {}) {
      if (!data) return fallback;
      try {
        return typeof data === 'string' ? JSON.parse(data) : data;
      } catch {
        return fallback;
      }
    },

    safeArrayParse(data) {
      const parsed = this.parseJson(data, []);
      return Array.isArray(parsed) ? parsed : [];
    },

    // HTML 태그를 제거하고 순수 텍스트만 추출
    stripHtmlTags(html) {
      if (!html) return '';
      // HTML 태그 제거 및 HTML 엔티티 디코딩
      return html
        .replace(/<[^>]*>/g, '') // HTML 태그 제거
        .replace(/&nbsp;/g, ' ') // &nbsp; → 공백
        .replace(/&lt;/g, '<')   // &lt; → <
        .replace(/&gt;/g, '>')   // &gt; → >
        .replace(/&amp;/g, '&')  // &amp; → &
        .replace(/&quot;/g, '"') // &quot; → "
        .trim();
    },

    getTaskIdFromWorkItem() {
      if (this.workItem && this.workItem.worklist) {
        return this.workItem.worklist.taskId
      }
      return null
    },

    // ========================================
    // 🎨 템플릿 헬퍼 메서드들 (화면 표시용)
    // ========================================
    getTimelineKey(item, index) {
      return item.type + '-' + (item.type === 'task' ? item.payload.id : 'chat-' + index)
    },

    getTaskStatusClass(payload) {
      const baseClass = 'task-status'
      if (!payload.isCompleted) return [baseClass, 'running']
      return [baseClass, payload.isCrewCompleted ? 'crew-completed' : 'completed']
    },

    getTaskMeta(payload) {
      const typeLabel = payload.isHumanAsked
        ? 'human asked'
        : payload.crewType
      return [
        { label: '시작시간', value: this.formatTime(payload.startTime) },
        { label: '요청 유형', value: typeLabel }
      ]
    },

    isSubmittableTask(task) {
      console.log('isSubmittableTask');
      return (
        (task.crewType === 'report' && task.jobId.includes('final_report_merge')) ||
        task.crewType === 'slide' ||
        task.crewType === 'text' ||
        (task.crewType === 'result' && task.jobId.includes('action'))
      )
    },

    shouldShowSubmitButton(payload) {
      return payload.isCompleted && 
             this.isSubmittableTask(payload) &&
             this.todoStatus?.agent_mode === 'DRAFT'
    },

    isMarkdownType(crewType) {
      return crewType === 'report' || crewType === 'action' || crewType === 'planning' || crewType === 'react'
    },

    shouldShowExpandControls(payload) {
        if (payload.crewType === 'slide') return false
        if (payload.crewType === 'report' || payload.crewType === 'action' || payload.crewType === 'planning') {
          return this.isContentLong(payload.content);
        }
        // JSON의 경우 표시용 컨텐츠를 문자열화해서 판단
        const rawJson = typeof payload.content === 'string' 
          ? payload.content 
          : JSON.stringify(payload.content, null, 2);
        return this.isContentLong(rawJson);
      },

    getToolUsageList(jobId) {
      return (!jobId || !this.toolUsageStatusByTask[jobId]) ? [] : this.toolUsageStatusByTask[jobId]
    },

    getToolStatusText(tool) {
      const status = tool.status === 'done' ? '사용 완료' : '사용 중입니다'
      const detail = tool.query || tool.info
      return `${tool.tool_name} 도구 ${status}${detail ? ': ' + detail : ''}`
    },

    // 완료된 HUMAN ASKED 카드 표시 텍스트/스타일
    getHumanResultText(payload) {
      const status = String(payload?.humanResponse?.status || '').toUpperCase()
      if (status === 'APPROVED' || status === 'APPROVE') return '승인됨'
      if (status === 'REJECTED') return '거절됨'
      return '처리됨'
    },
    getHumanResultClass(payload) {
      const status = String(payload?.humanResponse?.status || '').toUpperCase()
      if (status === 'APPROVED' || status === 'APPROVE') return 'pill-approved'
      if (status === 'REJECTED') return 'pill-rejected'
      return 'pill-neutral'
    },
    getHumanResultDetail(payload) {
      const answer = payload?.humanResponse?.data?.answer
      const type = payload?.humanQueryData?.type
      if (!answer) return ''
      if (type === 'text' || type === 'select') return String(answer)
      return ''
    },

    getLoadingMessage() {
      const draftStatus = this.todoStatus?.draft_status;
      if (draftStatus === 'STARTED') {
        return '작업을 진행중입니다...'
      }
      if (draftStatus === 'FB_REQUESTED') {
        return '피드백을 반영하여 초안을 다시 생성하고 있습니다...'
      }
      return ''
    },



    // ========================================
    // 🔽 브라우저 에이전트 다운로드
    // ========================================
    downloadBrowserAgent() {
      // 플랫폼 감지
      const userAgent = navigator.userAgent.toLowerCase();
      const baseUrl = 'https://github.com/jhyg/browser-use-electron/releases/download/v1.0.0/';
      let downloadUrl;
      
      if (userAgent.includes('mac')) {
        downloadUrl = baseUrl + 'browser-use-agent.dmg';
      } else if (userAgent.includes('linux')) {
        downloadUrl = baseUrl + 'Process-GPT-App-1.0.0.AppImage';
      } else {
        downloadUrl = baseUrl + 'browser-use-agent-setup.exe';
      }
      
      window.open(downloadUrl, '_blank');
      localStorage.setItem('downloadedBrowserAgent', 'true');
      this.downloadedBrowserAgent = true;
    },

    // ========================================
    // ⏰ 시간 및 문자열 포맷팅
    // ========================================
    formatTime(timestamp) {
      return new Date(timestamp).toLocaleString('ko-KR', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    },
    
    // === 출력 포맧팅 메서드들 ===
    cleanString(str) {
      return str.replace(/\\n/g, '\n').replace(/\\r/g, '').replace(/\\t/g, '  ').replace(/\\\\/g, '\\')
    },

    removeFences(str) {
      return str.replace(/^```[a-zA-Z0-9]*\s*/, '').replace(/```$/, '').trim();
    },

    sanitizeOutput(output) {
      if (typeof output !== 'string') return output;
      let trimmed = output.trim();
      let loopCount = 0;
      while (loopCount < 10) {
        const beforeTrim = trimmed;
        trimmed = trimmed.replace(/^(```|~~~|""")[a-zA-Z0-9]*\s*\n([\s\S]*?)\n\1\s*$/gm, '$2').trim();
        if (beforeTrim === trimmed) break;
        loopCount++;
      }
      return trimmed;
    },

    formatOutput(output, type = 'json') {
      if (!output) return '';
      
      const isString = typeof output === 'string';
      
      if (type === 'json') {
        if (isString) {
          const cleaned = this.cleanString(this.removeFences(output));
          const parsed = this.parseJson(cleaned, cleaned);
          return typeof parsed === 'object' ? JSON.stringify(parsed, null, 2) : cleaned;
        }
        return this.parseJson(output, JSON.stringify(output, null, 2));
      }
      
      if (type === 'markdown') {
        const sanitized = this.sanitizeOutput(output);
        const outputStr = typeof sanitized === 'object' ? JSON.stringify(sanitized, null, 2) : String(sanitized);
        const clean = this.cleanString(outputStr);
        try {
          return marked(clean, { breaks: true, gfm: true });
        } catch {
          return clean.replace(/\n/g, '<br>');
        }
      }
      
      return String(output);
    },

    // JSON을 key : value 형태의 텍스트로 변환 (중첩 객체도 펼쳐서 표시)
    convertJsonToKeyValue(data, indent = '') {
      if (!data) return '';
      
      let obj = data;
      if (typeof data === 'string') {
        try {
          obj = JSON.parse(data);
        } catch (e) {
          return data;
        }
      }
      
      if (typeof obj !== 'object' || Array.isArray(obj)) {
        return JSON.stringify(obj, null, 2);
      }
      
      const lines = [];
      Object.keys(obj).forEach(key => {
        const value = obj[key];
        
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // 중첩 객체인 경우
          lines.push(`${indent}${key} :`);
          Object.keys(value).forEach(subKey => {
            const subValue = value[subKey];
            lines.push(`${indent}- ${subKey} : ${String(subValue)}`);
          });
        } else {
          // 일반 값인 경우
          lines.push(`${indent}${key} : ${String(value)}`);
        }
      });
      
      return lines.join('\n');
    },

    formatJsonOutput(output) {
      const keyValueText = this.convertJsonToKeyValue(output);
      return keyValueText || this.formatOutput(output, 'json');
    },

    formatMarkdownOutput(output) {
      return this.formatOutput(output, 'markdown');
    },

    // 객체면 첫번째 키의 값을 반환, 배열/문자열 등은 그대로 반환
    resolvePrimaryValue(output, crewType) {
      const type = crewType ? String(crewType).toLowerCase() : '';
      // planning 타입: 객체(JSON 포함)이고 explanation_text 키가 있으면 그 값만 표시
      if (type === 'planning') {
        let obj = output;
        if (typeof obj === 'string') {
          const cleaned = this.cleanString(this.removeFences(obj));
          const parsed = this.parseJson(cleaned, null);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            obj = parsed;
          }
        }
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
          if (Object.prototype.hasOwnProperty.call(obj, 'explanation_text')) {
            return obj.explanation_text;
          }
        }
        // 키가 없으면 원래 로직대로 원본 유지
        return output;
      }
      // result 타입은 원본 그대로 사용
      if (type === 'result') {
        return output;
      }
      if (output && typeof output === 'object' && !Array.isArray(output)) {
        const keys = Object.keys(output);
        if (keys.length > 0) return output[keys[0]];
      }
      return output;
    },

    // ========================================
    // 🎬 슬라이드 관리 메서드들
    // ========================================
    getSlides(output) {
      if (!output) return [];
      const source = output;
      const sanitized = this.sanitizeOutput(source);
      return String(sanitized)
        .split(/^\s*---\s*$/gm)
        .filter(slide => slide.trim())
        .map(slide => this.formatOutput(slide.trim(), 'markdown'));
    },

    getSlideIndex(taskId) {
      return this.slideIndexes[taskId] || 0;
    },

    setSlideIndex(taskId, index) {
      const task = this.tasks.find(t => t.id === taskId);
      if (!task) return;
      const slides = this.getSlides(task.content);
      if (index >= 0 && index < slides.length) {
        this.slideIndexes = { ...this.slideIndexes, [taskId]: index };
      }
    },

    getCurrentSlide(task) {
      const slides = this.getSlides(task.content);
      return slides[this.getSlideIndex(task.id)] || '';
    },

    previousSlide(taskId) {
      const currentIndex = this.getSlideIndex(taskId);
      if (currentIndex > 0) this.setSlideIndex(taskId, currentIndex - 1);
    },

    nextSlide(taskId) {
      const currentIndex = this.getSlideIndex(taskId);
      this.setSlideIndex(taskId, currentIndex + 1);
    },

    goToSlide(taskId, index) {
      this.setSlideIndex(taskId, index);
    },

    // ========================================
    // ✅ 작업 제출 및 완료 처리
    // ========================================
    submitTask(task) {
      const original = task.outputRaw;
      const payloadForSubmit = (task.crewType === 'text')
        ? (task.content ?? this.resolvePrimaryValue(original, 'text'))
        : original;
      const normalized = this.normalizeFormValues(payloadForSubmit);
      console.log('[AgentMonitor] submitTask!!', normalized);
      this.EventBus.emit('form-values-updated', normalized);
    },

    normalizeFormValues(payload) {
      let obj = payload;
      if (typeof obj === 'string') {
        try { obj = JSON.parse(obj); } catch (e) { return payload; }
      }
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return payload;

      const result = {};
      Object.keys(obj).forEach((key) => {
        const value = obj[key];
        // 숫자만 문자열로 변환. 불리언/배열/객체는 그대로 유지
        result[key] = (typeof value === 'number') ? String(value) : value;
      });
      return result;
    },

    // ========================================
    // 💾 데이터 로딩 및 상태 관리
    // ========================================
    async loadData() {
      const taskId = this.validateTaskId();
      if (!taskId) return;

      try {
        this.downloadedBrowserAgent = localStorage.getItem('downloadedBrowserAgent') === 'true';
        this.errorMessage = null;
        this.events = [];

        const { data, error } = await window.$supabase
          .from('events')
          .select('*')
          .eq('todo_id', taskId)
          .in('event_type', ['task_started', 'task_completed', 'crew_completed', 'tool_usage_started', 'tool_usage_finished', 'human_asked', 'human_response'])
          .order('timestamp', { ascending: true });

        if (error) throw error;
        
        if (data) {
          // final_report_merge가 포함된 job_id에 대한 상세 로그 (DB에서 가져온 데이터)
          data.forEach(row => {
            if (row.job_id && row.job_id.includes('final_report_merge')) {
              console.log('[DB Load] final_report_merge 이벤트:', row);
            }
          });
          
          this.events = data;
          this.isCancelled = data.some(e => e.event_type === 'crew_completed');
        }
      } catch (error) {
        this.handleError(error, '이벤트 데이터를 불러오는 중 오류가 발생했습니다');
      }
    },
    // ========================================
    // 📡 실시간 구독 및 이벤트 처리
    // ========================================
    setupRealtimeSubscription() {
      try {
        const validEventTypes = [
          'task_started',
          'task_completed',
          'crew_completed',
          'tool_usage_started',
          'tool_usage_finished',
          'human_asked'
        ];

        this.channel = window.$supabase
          .channel('events')
          .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'events'
          }, ({ new: row }) => {
            const taskId = this.getTaskIdFromWorkItem();
            const { todo_id: todoId, event_type, job_id, id } = row;

            if (job_id && job_id.includes('final_report_merge')) {
              console.log('[Realtime] final_report_merge 이벤트 수신:', row);
            }

            const isValidEvent = !this.events.some(e => e.id === id) &&
                                validEventTypes.includes(event_type) &&
                                todoId === taskId;

            console.log('todostatus', this.todoStatus);

            if (isValidEvent) {
              // === task_completed인 경우 data 없을 때 fallback 재조회 ===
              if (event_type === 'task_completed' && (!row.data || Object.keys(row.data).length === 0)) {
                window.$supabase
                  .from('events')
                  .select('*')
                  .eq('id', id)
                  .single()
                  .then(({ data: full, error }) => {
                    console.log("[RealTime Failed] fallback DB")
                    this.pushEventAndMaybeSubmit(!error && full ? full : row);
                  });
              } else {
                this.pushEventAndMaybeSubmit(row);
              }

              // 첫 이벤트 수신시 상태 동기화
              if (!this.hasReceivedEvent) {
                this.hasReceivedEvent = true;
                if (!this.hasSyncedTodoStatusOnce) {
                  this.hasSyncedTodoStatusOnce = true;
                  setTimeout(async () => {
                    await this.fetchTodoStatus();
                    if (!this.isCancelled) {
                      const draft = this.todoStatus?.draft_status;
                      this.isLoading = ['STARTED', 'FB_REQUESTED'].includes(draft);
                    }
                  }, 300);
                }
              }

              if (event_type === 'crew_completed') {
                this.isLoading = false;
              }

            } else if (todoId !== taskId) {
              console.warn('[ID 불일치]', { eventTodoId: todoId, currentTaskId: taskId, event: row });
            }
          })
          .subscribe((status) => {
            if (status === 'SUBSCRIPTION_ERROR') {
              this.handleError(null, '실시간 이벤트 구독에 실패했습니다');
            }
          });
      } catch (error) {
        this.handleError(error, '실시간 구독 중 오류가 발생했습니다');
      }
    },

    pushEventAndMaybeSubmit(row) {
      // 중복 방지는 isValidEvent에서 이미 처리
      this.events = [...this.events, row];

      if (row.event_type !== 'task_completed') return;

      const jobId = row.job_id || row.id;

      this.$nextTick(() => {
        const task = this.tasks.find(t => t.jobId === jobId || t.id === row.id);
        console.log('tasks', task);
        if (task && task.isCompleted && this.isSubmittableTask(task)) {
          console.log('[AgentMonitor] submitTask 감지', task);
          this.submitTask(task);
        }
      });
    },


    // human_asked 응답 처리 (status 비사용: 응답 레코드만 저장)
    async onConfirmHumanQuery(task) {
      if (!task || !task.isHumanAsked) return;
      
      try {
        const answer = this.humanQueryAnswers[task.id] || 'confirmed';
        const base = { ...(task.eventRow || {}) };
        const newId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
          ? crypto.randomUUID() 
          : `${base.job_id || task.jobId || 'human'}-${Date.now()}`
        const eventPayload = {
          ...base,
          id: newId,
          event_type: 'human_response',
          data: { answer },
          status: 'APPROVED'
        };
        // 낙관적 UI 업데이트: 즉시 완료 표시 + 로그
        console.log('[HUMAN CONFIRM] sending response', eventPayload)
        this.events = [...this.events, { ...eventPayload, timestamp: new Date().toISOString() }]
        // REST upsert에는 PK(id)가 필요하므로 id를 명시적으로 생성
        await backend.putEvent(eventPayload);
        
        // 응답 후 입력값 초기화 (Vue3에서는 $delete 없음)
        delete this.humanQueryAnswers[task.id]
      } catch (error) {
        this.handleError(error, '응답 저장 중 오류가 발생했습니다');
      }
    },
    
    async onCancelHumanQuery(task) {
      if (!task || !task.isHumanAsked) return;
      
      try {
        const answer = this.humanQueryAnswers[task.id] || 'rejected';
        const base = { ...(task.eventRow || {}) };
        const newId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
          ? crypto.randomUUID() 
          : `${base.job_id || task.jobId || 'human'}-${Date.now()}`
        const eventPayload = {
          ...base,
          id: newId,
          event_type: 'human_response',
          data: { answer },
          status: 'REJECTED'
        };
        // 낙관적 UI 업데이트: 즉시 완료 표시 + 로그
        console.log('[HUMAN REJECT] sending response', eventPayload)
        this.events = [...this.events, { ...eventPayload, timestamp: new Date().toISOString() }]
        // REST upsert에는 PK(id)가 필요하므로 id를 명시적으로 생성
        await backend.putEvent(eventPayload);
        
        // 응답 후 입력값 초기화 (Vue3에서는 $delete 없음)
        delete this.humanQueryAnswers[task.id]
      } catch (error) {
        this.handleError(error, '응답 저장 중 오류가 발생했습니다');
      }
    },
    // status가 ASKED일 때만 모달 표시
    isHumanQueryAsked(row) {
      if (!row) return false;
      return String(row.status || '').toUpperCase() === 'ASKED';
    },
    cleanup() {
      if (this.channel) {
          window.$supabase.removeChannel(this.channel)
      }
    },

    // ========================================
    // 🎛️ UI 상태 관리 및 인터랙션
    // ========================================
    isTaskExpanded(taskId) {
      return this.expandedTasks[taskId] || false
    },
    toggleTaskExpansion(taskId) {
      this.expandedTasks = { ...this.expandedTasks, [taskId]: !this.isTaskExpanded(taskId) }
    },
    isContentLong(content) {
      if (!content) return false
      const contentStr = String(content)
      return contentStr.length > 500 || contentStr.split('\n').length > 8
    },


    // ========================================
    // 🚀 작업 실행 관련 메서드들
    // ========================================
    async startTask() {
      // Browser Use 특별 처리
      if (this.selectedOrchestrationMethod === 'browser-use') {
        try {
          const workItemList = await backend.getWorkListByInstId(this.workItem.worklist.instId);
          if (workItemList) {
            this.doneWorkItemList = workItemList
              .filter(item => item.status === 'DONE' && item.task?.content)
              .map(item => ({ name: item.name, output: item.task.content }));
          }
          this.openBrowserAgent = true;
        } catch (error) {
          this.handleError(error, 'Browser Agent 준비 중 오류가 발생했습니다');
        }
        return;
      }

      const taskId = this.validateTaskId();
      if (!taskId) return;

      try {
        // isLoading은 첫 이벤트 수신 후 상태 동기화 결과로 결정
        
        // agent_mode 처리
        const currentAgentMode = this.todoStatus?.agent_mode;
        const agentMode = ['DRAFT', 'COMPLETE'].includes(currentAgentMode) ? currentAgentMode : 'DRAFT';
        const agentOrch = this.selectedOrchestrationMethod;
        
        this.todoStatus = { 
          ...(this.todoStatus || {}), 
          agent_mode: agentMode, 
          status: 'IN_PROGRESS', 
          agent_orch: agentOrch 
        };

        await backend.putWorkItem(taskId, { 
          agent_mode: agentMode, 
          status: 'IN_PROGRESS',
          agent_orch: agentOrch
        });
      } catch (error) {
        this.handleError(error, '작업 시작 중 오류가 발생했습니다');
      }
    },
    async fetchTodoStatus() {
      const taskId = this.validateTaskId();
      if (!taskId) return;

      try {
        const { data, error } = await window.$supabase
          .from('todolist')
          .select('status, agent_mode, draft_status, feedback, agent_orch')
          .eq('id', taskId)
          .single();

        if (error) throw error;

        this.todoStatus = data;
        this.isLoading = ['STARTED', 'FB_REQUESTED'].includes(data.draft_status);
        this.isCancelled = data.draft_status === 'CANCELLED';

        // 피드백 데이터 처리
        const feedbackArr = this.safeArrayParse(data.feedback);
        this.chatMessages = feedbackArr
          .map(item => ({
            time: item.time,
            content: this.extractContent(item.content)
          }))
          .sort((a, b) => new Date(a.time) - new Date(b.time));

        // agent_orch 동기화
        const validOrchs = this.orchestrationOptions.map(o => o.value);
        if (data.agent_orch && validOrchs.includes(data.agent_orch)) {
          this.selectedOrchestrationMethod = data.agent_orch;
        }
      } catch (error) {
        this.handleError(error, 'todolist 상태 조회 실패');
      }
    },
    async stopTask() {
      const taskId = this.validateTaskId();
      if (!taskId) return;

      try {
        await backend.putWorkItem(taskId, { draft_status: 'CANCELLED' });
        this.isCancelled = true;
        this.isLoading = false;
        if (this.todoStatus) this.todoStatus.draft_status = 'CANCELLED';
      } catch (error) {
        this.handleError(error, '작업 중단 중 오류가 발생했습니다');
      }
    },
    async submitChat(content) {
      const taskId = this.validateTaskId();
      if (!taskId || !content) return;

      try {
        const existingFeedback = this.safeArrayParse(this.todoStatus.feedback);
        const now = new Date().toISOString();
        const text = this.extractContent(content);
        
        const updatedFeedback = [...existingFeedback, { time: now, content: text }];
        const agentOrch = this.selectedOrchestrationMethod;

        await backend.putWorkItem(taskId, {
          feedback: updatedFeedback,
          draft_status: 'FB_REQUESTED',
          status: 'IN_PROGRESS',
          agent_orch: agentOrch
        });

        // 상태 업데이트
        Object.assign(this.todoStatus, {
          draft_status: 'FB_REQUESTED',
          status: 'IN_PROGRESS',
          agent_orch: agentOrch,
          feedback: updatedFeedback
        });
        
        this.isLoading = true;
        this.chatMessages.push({ time: now, content: text });
        
        // 스크롤 조정
        this.$nextTick(() => {
          const taskArea = this.$refs.taskArea;
          if (taskArea) taskArea.scrollTop = taskArea.scrollHeight;
        });
      } catch (error) {
        this.handleError(error, '채팅 전송 중 오류가 발생했습니다');
      }
    },

    
    // ========================================
    // 🎮 UI 인터랙션 및 이벤트 핸들러
    // ========================================
    toggleDropdown() {
      this.isDropdownOpen = !this.isDropdownOpen;
    },

    selectOption(value) {
      this.selectedOrchestrationMethod = value;
      this.isDropdownOpen = false;
    },

    handleOutsideClick(event) {
      const dropdown = this.$refs.dropdown;
      if (dropdown && !dropdown.contains(event.target)) {
        this.isDropdownOpen = false;
      }
    },


    // ========================================
    // 🛠️ 기타 헬퍼 메서드들
    // ========================================
    extractContent(content) {
      return (typeof content === 'object' && content.text !== undefined) ? content.text : content;
    },

    getDisplayName(task) {
      // human_asked는 항상 고정 타이틀 사용
      if (task.isHumanAsked) {
        return '사용자 승인 및 추가 정보 요청'
      }
      const name = task.name?.trim()
      return (!name || name.toLowerCase() === 'unknown') ? task.role : task.name
    },

    getStatusText(task) {
      if (!task.isCompleted) return '진행중';
      return task.isCrewCompleted ? '전체완료' : '작업완료';
    },

    getMarkdownContent(task) {
      // JSON 형태의 데이터인지 확인하고 key : value 형태로 변환
      if (task.content && typeof task.content === 'object') {
        const keyValueText = this.convertJsonToKeyValue(task.content);
        console.log('객체에서 변환된 텍스트:', keyValueText);
        if (keyValueText) {
          return keyValueText.replace(/\n/g, '<br>');
        }
      }
      
      // 문자열 형태의 JSON 데이터 처리
      if (typeof task.content === 'string') {
        try {
          const parsed = JSON.parse(task.content);
          if (typeof parsed === 'object' && parsed !== null) {
            const keyValueText = this.convertJsonToKeyValue(parsed);
            console.log('문자열에서 파싱 후 변환된 텍스트:', keyValueText);
            if (keyValueText) {
              return keyValueText.replace(/\n/g, '<br>');
            }
          }
        } catch {
        }
      }
      
      return this.formatMarkdownOutput(task.content);
    },

    // ========================================
    // 🎯 오케스트레이션 방식 관련 메서드들
    // ========================================
    selectOrchestrationMethod(value) {
      this.selectedOrchestrationMethod = value;
    },

    getMethodDescription(method) {
      const descriptions = {
        'crewai-deep-research': '다중 에이전트가 협업하여 심층적인 연구와 분석을 진행. ex) 문서 분석, 데이터 수집, 보고서 작성 | 5~15분 소요',
        'crewai-action': '최적경로로 다양한 도구를 호출해서 목적을 달성함. ex) MCP, A2A | 1~5분 소요',
        'openai-deep-research': 'GPT-4 기반의 고급 추론과 체계적 분석을 통한 연구. ex) 논리적 사고, 창의적 문제해결 | 3~10분 소요',
        'langchain-react': 'LangChain 연구 방식을 활용하여, 다양한 도구를 호출해서 목적을 달성함. ex) 이미지 생성, 코드 실행 및 분석 | 3~5분 소요',
        'browser-use': '실제 브라우저를 조작하여 실시간 웹 정보 수집 및 작업 수행. ex) 검색, 폼 작성, 스크래핑 | 2~8분 소요'
      };
      return descriptions[method] || '';
    },
  },
  async created() {
      try {
        this.supabase = await window.$supabase.auth.getSession();
      } catch (error) {
        console.error('Supabase 세션 오류:', error);
      }
      
      await this.loadData()
      await this.fetchTodoStatus()
      this.setupRealtimeSubscription()
  },
  mounted() {
    // 외부 클릭 감지를 위한 이벤트 리스너 추가
    document.addEventListener('click', this.handleOutsideClick);
  },
  beforeUnmount() {
    this.cleanup()
    // 이벤트 리스너 제거
    document.removeEventListener('click', this.handleOutsideClick);
  }
}
</script>

<style scoped>
.agent-monitor {
  max-width: 800px;
  margin: 0 auto;
  padding: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  box-sizing: border-box;
}
.task-area {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding: 0;
}
.error-banner {
  background: #ffe0e0;
  color: #b71c1c;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  font-weight: 600;
  text-align: center;
  border: 1px solid #ffbdbd;
}

/* 타임라인 스타일 */
.timeline-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.timeline-item {
  position: relative;
}


.task-card {
  background: white;
  border-radius: 12px;
  border: 1px solid #e1e8ed;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: all 0.2s ease;
  margin-bottom: 16px;
}

.task-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border-color: #d1d9e0;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.task-left {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex: 1;
}

.task-avatar {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: linear-gradient(135deg, #60A5FA 0%, #3B82F6 100%);
  color: white;
  font-weight: 600;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 8px;
}

.task-info {
  flex: 1;
  min-width: 0;
}

.task-title {
  font-size: 16px;
  font-weight: 600;
  color: #1d2129;
  margin: 0 0 4px 0;
  line-height: 1.3;
}

.task-description {
  font-size: 14px;
  color: #606770;
  margin: 0;
  line-height: 1.4;
  word-break: break-word;
}

.task-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.task-status {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  flex-shrink: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Malgun Gothic', '맑은 고딕', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.task-status.completed {
  background: #e8f5e8;
  color: #2d7d32;
}

.task-status.crew-completed {
  background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%);
  color: white;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
  animation: completedPulse 2s ease-in-out;
}

.task-status.running {
  background: #fff3e0;
  color: #f57c00;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.task-meta {
  display: flex;
  gap: 24px;
  margin-bottom: 16px;
  padding: 12px 0;
  border-top: 1px solid #f0f2f5;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.meta-label {
  font-size: 11px;
  font-weight: 500;
  color: #8a8d91;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.meta-value {
  font-size: 13px;
  font-weight: 500;
  color: #1d2129;
}

.meta-submit {
  margin-left: auto;
  display: flex;
  align-items: flex-end;
  padding-bottom: 2px;
}

.submit-button-light {
  background: #e7f3ff;
  color: #0066cc;
  border: 1px solid #b3d9ff;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: none;
}

.submit-button-light:hover {
  background: #cce7ff;
  border-color: #99ccff;
  transform: none;
}

.submit-button-light:active {
  background: #b3d9ff;
  transform: none;
}

.task-result {
  background: #f8fafb;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e4e6ea;
}

.result-header {
  padding: 12px 16px;
  background: #f0f2f5;
  border-bottom: 1px solid #e4e6ea;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.result-title {
  font-size: 13px;
  font-weight: 600;
  color: #1d2129;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.result-content {
  padding: 16px;
}



.json-container {
  max-height: 400px;
  overflow: hidden;
  transition: max-height 0.3s ease;
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.json-container > div {
  white-space: pre-line;
}

.json-container.expanded {
  max-height: none;
}

.json-container:not(.expanded).has-expand-controls::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 40px;
  background: linear-gradient(transparent, #f8fafb);
  pointer-events: none;
}

.json-output pre {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 20px;
  margin: 0;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  overflow-x: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
  flex: 1;
  min-height: 360px;
}

/* 슬라이드 컨테이너 스타일 */
.slides-container {
  background: #ffffff;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e4e6ea;
  min-height: 400px;
  display: flex;
  flex-direction: column;
}

.slides-header {
  background: linear-gradient(135deg, #60A5FA 0%, #3B82F6 100%);
  color: white;
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.header-info h5 {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
}

.slide-hint {
  font-size: 12px;
  opacity: 0.8;
  font-weight: 400;
}

.slide-navigation {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nav-btn {
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  font-weight: bold;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.05);
}

.nav-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.slide-counter {
  font-size: 14px;
  font-weight: 500;
  min-width: 60px;
  text-align: center;
}

.slide-content {
  flex: 1;
  padding: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
  min-height: 300px;
  position: relative;
}

.slide-inner {
  width: 100%;
  text-align: center;
  animation: slideIn 0.4s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.slide-inner :deep(h1) {
  font-size: 2.2rem;
  color: #2c3e50;
  margin-bottom: 1.2rem;
  font-weight: 700;
  background: linear-gradient(135deg, #60A5FA 0%, #3B82F6 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.slide-inner :deep(h2) {
  font-size: 1.8rem;
  color: #34495e;
  margin-bottom: 1rem;
  font-weight: 600;
  border-bottom: 3px solid #60A5FA;
  padding-bottom: 0.5rem;
  display: inline-block;
}

.slide-inner :deep(h3) {
  font-size: 1.4rem;
  color: #7f8c8d;
  margin-bottom: 0.8rem;
  font-weight: 500;
}

.slide-inner :deep(p) {
  font-size: 1.1rem;
  line-height: 1.8;
  color: #2c3e50;
  margin-bottom: 1rem;
  max-width: 700px;
  margin-left: auto;
  margin-right: auto;
}

.slide-inner :deep(ul) {
  text-align: left;
  max-width: 600px;
  margin: 1.5rem auto;
  font-size: 1.1rem;
  line-height: 1.8;
}

.slide-inner :deep(li) {
  margin-bottom: 0.8rem;
  color: #34495e;
  position: relative;
  padding-left: 1.5rem;
}

.slide-inner :deep(li::before) {
  content: '•';
  color: #60A5FA;
  font-weight: bold;
  position: absolute;
  left: 0;
}

.slide-inner :deep(strong) {
  color: #e74c3c;
  font-weight: 600;
}

.slide-indicators {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 16px;
  background: #ffffff;
  border-top: 1px solid #e9ecef;
  gap: 8px;
}

.indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #dee2e6;
  cursor: pointer;
  transition: all 0.3s ease;
}

.indicator:hover {
  background: #adb5bd;
  transform: scale(1.2);
}

.indicator.active {
  background: #60A5FA;
  transform: scale(1.3);
  box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.2);
}

/* 반응형 디자인 */
@media (max-width: 768px) {
  .agent-monitor { padding: 0; height: 100%; }
  .task-area { padding: 16px 12px 0px; }
  .task-card { padding: 16px; }
  .task-header { flex-direction: column; gap: 12px; align-items: stretch; }
  .task-header-right { justify-content: flex-start; }
  .task-status { align-self: flex-start; }
  .task-meta { flex-direction: column; gap: 12px; }
  .result-content { padding: 12px; }
  .slides-header { padding: 12px 16px; flex-direction: column; gap: 12px; text-align: center; }
  .slide-content { padding: 20px; }
  .slide-inner :deep(h1) { font-size: 1.8rem; }
  .slide-inner :deep(h2) { font-size: 1.4rem; }
  .slide-inner :deep(p) { font-size: 1rem; }
}

.task-progress {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: linear-gradient(90deg, #f8f9ff 0%, #f0f2ff 100%);
  border-radius: 8px;
  border: 1px solid #e1e8ff;
  font-size: 14px;
  color: #60A5FA;
  font-weight: 500;
}

.progress-dots {
  display: flex;
  gap: 4px;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #60A5FA;
  animation: pulse 1.4s ease-in-out infinite both;
}

.dot:nth-child(2) { animation-delay: 0.2s; }
.dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes pulse {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1); }
}


.empty-state {
  text-align: center;
  padding: 16px;
  background: white;
  margin-top: 12px;
  height: calc(100vh - 340px);
  overflow: auto;
}

.empty-state .empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-state h3 {
  font-size: 18px;
  font-weight: 600;
  color: #1d2129;
  margin: 0 0 8px 0;
}

.empty-state p {
  font-size: 14px;
  color: #606770;
  margin: 0;
}

/* 마크다운 출력 스타일 */
.markdown-output {
  position: relative;
  min-height: 400px;
  display: flex;
  flex-direction: column;
}

.markdown-container {
  max-height: 400px;
  overflow: hidden;
  transition: max-height 0.3s ease;
  position: relative;
  flex: 1;
  padding: 16px;
  min-height: 360px;
  font-size: 14px;
  line-height: 1.6;
  color: #1d2129;
}

.markdown-container.expanded {
  max-height: none;
}

.markdown-container:not(.expanded).has-expand-controls::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 40px;
  background: linear-gradient(transparent, #f8fafb);
  pointer-events: none;
}

/* markdown-container 스타일과 하위 요소들 */
.markdown-container :deep(h1), .markdown-container :deep(h2), .markdown-container :deep(h3) {
  font-weight: 600;
  color: #1d2129;
  margin: 16px 0 8px 0;
  line-height: 1.3;
}

.markdown-container :deep(h1) { font-size: 20px; }
.markdown-container :deep(h2) { font-size: 18px; }
.markdown-container :deep(h3) { font-size: 16px; }

.markdown-container :deep(p) { margin: 8px 0; }
.markdown-container :deep(ul), .markdown-container :deep(ol) { margin: 8px 0; padding-left: 20px; }
.markdown-container :deep(li) { margin: 4px 0; }

.markdown-container :deep(pre) {
  background: #282c34;
  color: #abb2bf;
  padding: 16px;
  border-radius: 6px;
  overflow-x: auto;
  font-size: 13px;
  margin: 12px 0;
}

.markdown-container :deep(code) {
  background: #f1f3f4;
  color: #d73a49;
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 13px;
  font-family: 'SF Mono', Monaco, monospace;
}

.markdown-container :deep(pre code) {
  background: transparent;
  color: inherit;
  padding: 0;
}

/* 더보기 컨트롤 스타일 */
.expand-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #f8f9fa;
  border-top: 1px solid #e9ecef;
}

.expand-button {
  background: #ffffff;
  color: #6c757d;
  border: 1px solid #dee2e6;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 4px;
}

.expand-button:hover {
  background: #f8f9fa;
  color: #495057;
  border-color: #adb5bd;
}

.expand-icon {
  font-size: 10px;
  transition: transform 0.2s ease;
}

.expand-hint {
  font-size: 10px;
  color: #adb5bd;
  font-style: italic;
}

.tool-usage-status-list {
  margin-top: 8px;
  padding-left: 20px;
  border-left: 2px solid #e9ecef;
  max-height: 120px;
  overflow-y: auto;
}
.tool-usage-status-item {
  display: flex;
  align-items: center;
  font-size: 12px;
  color: #adb5bd;
  font-weight: 400;
  margin-bottom: 4px;
  padding-left: 8px;
  letter-spacing: -0.2px;
  position: relative;
}
.tool-usage-status-item::before {
  content: '—';
  position: absolute;
  left: -6px;
  color: #dee2e6;
  font-weight: bold;
}

.tool-status-indicator {
  width: 12px;
  height: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 8px;
  flex-shrink: 0;
}

.loading-spinner {
  width: 10px;
  height: 10px;
  border: 1.5px solid #e9ecef;
  border-top-color: #60A5FA;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.check-mark {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: #4caf50;
  color: white;
  font-size: 8px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
}

.start-button {
  background: #0066cc;
  color: #ffffff;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  margin-top: 16px;
}

.start-button:hover {
  background: #005bb5;
}

/* Vuetify 카드 스타일 */
.start-controls {
  margin-top: 24px;
  width: 100%;
}

.method-title {
  font-size: 20px;
  font-weight: 600;
  color: #1d2129;
  margin-bottom: 0;
}

.method-card-vuetify {
  cursor: pointer;
  transition: all 0.3s ease;
  min-height: 240px;
  position: relative;
}

.method-card-vuetify:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15) !important;
}

.method-card-vuetify.selected {
  transform: translateY(-6px);
  box-shadow: 0 12px 30px rgba(25, 118, 210, 0.3) !important;
}

.card-icon-vuetify {
  font-size: 48px;
  line-height: 1;
  filter: grayscale(30%);
  transition: filter 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 60px;
}

.method-card-vuetify.selected .card-icon-vuetify {
  filter: none;
}

.card-title-vuetify {
  font-size: 16px !important;
  font-weight: 600 !important;
  line-height: 1.3 !important;
  color: #1d2129 !important;
}

.method-card-vuetify.selected .card-title-vuetify {
  color: white !important;
}

.card-description-vuetify {
  font-size: 12px !important;
  line-height: 1.5 !important;
  opacity: 0.85;
  word-break: keep-all;
  white-space: pre-line;
  text-align: left;
  color: #606770 !important;
}

.method-card-vuetify.selected .card-description-vuetify {
  color: rgba(255, 255, 255, 0.9) !important;
}

.selected-indicator-vuetify {
  position: absolute;
  top: 12px;
  right: 12px;
  animation: scaleIn 0.3s ease;
}

@keyframes scaleIn {
  from {
    transform: scale(0);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

/* 반응형 디자인 */
@media (max-width: 768px) {
  .method-title {
    font-size: 18px;
  }
  
  .method-card-vuetify {
    min-height: 220px;
  }
  
  .card-icon-vuetify {
    font-size: 40px;
  }
  
  .card-title-vuetify {
    font-size: 15px !important;
  }
  
  .card-description-vuetify {
    font-size: 11px !important;
    line-height: 1.4 !important;
  }
}

/* 채팅 UI 스타일 */
.chat-messages {
  max-height: 150px;
  overflow-y: auto;
  margin: 16px 0;
}
.chat-message { display: flex; justify-content: flex-end; margin: 16px 0; }
.bubble { background: #e5e5ea; border-radius: 12px; padding: 8px 12px; max-width: 70%; }
.chat-input-wrapper {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  padding: 0;
  flex-shrink: 0;
  background: white;
  border-top: 1px solid #e1e8ed;
}



/* 피드백 처리 로딩 스타일 */
.feedback-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #f8fafb;
  border: 1px solid #e4e6ea;
  border-radius: 8px;
  margin: 12px 0 12px; /* 상단 간격 추가로 위 요소와 붙는 현상 완화 */
  font-size: 14px;
  color: #606770;
}


/* Chat 컴포넌트 숨기기 */
.chat-input-wrapper ::v-deep .chat-info-view-wrapper { width: 100% !important; }
.chat-input-wrapper ::v-deep .v-avatar,
.chat-input-wrapper ::v-deep .user-name,
.chat-input-wrapper ::v-deep .chat-view-box,
.chat-input-wrapper ::v-deep .pa-4,
.chat-input-wrapper ::v-deep .v-divider { display: none !important; }

.feedback-loading .stop-button {
  margin-left: auto;
  background: transparent;
  border: none;
  color: #f57c00;
  font-size: 24px;
  cursor: pointer;
}
.feedback-loading .stop-button:hover { text-decoration: underline; }

/* ChatGPT 스타일 심플 드롭다운 */
.simple-dropdown {
  position: relative;
  margin-left: 8px;
  user-select: none;
}

.dropdown-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 20px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 400;
  color: #1f2937;
  transition: all 0.2s ease;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}
.dropdown-trigger:hover {
  background: #f9fafb;
  border-color: #9ca3af;
  color: #000000;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.dropdown-label { flex: 1; white-space: nowrap; }

.dropdown-menu {
  position: absolute;
  bottom: 100%;
  left: 0;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  margin-bottom: 4px;
  min-width: 180px;
  max-width: 220px;
  padding: 4px 0;
}

.dropdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 13px;
  color: #374151;
  transition: background-color 0.1s ease;
  margin: 0;
}
.dropdown-item:hover { background: #f3f4f6; }
.dropdown-item.active {
  background: #f3f4f6;
  color: #000;
  font-weight: 500;
}

.option-left { display: flex; align-items: center; gap: 8px; }
.option-icon { font-size: 16px; width: 16px; text-align: center; }
.option-label { font-size: 13px; }
.check-icon { color: #10b981; font-weight: 600; font-size: 12px; }

/* 모바일 드롭다운 최적화 */
@media (max-width: 768px) {
  .dropdown-trigger { padding: 5px 10px; font-size: 12px; }
  .dropdown-menu { min-width: 160px; }
  .dropdown-item { padding: 6px 12px; }
  .option-label { font-size: 12px; }
  .option-icon { font-size: 14px; }
}

/* human_asked 카드 스타일 (블루톤, 가독성 향상) */
.human-query-input {
  background: #f8fbff; /* lighter than blue-50 */
  border: 1px solid #bfdbfe; /* blue-200 */
  border-radius: 10px;
  padding: 16px 16px 14px;
  margin-top: 12px;
}

.query-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.query-title {
  font-size: 15px;
  font-weight: 700;
  color: #1e3a8a; /* blue-800 */
  margin: 0;
}

.role-pill {
  font-size: 12px;
  color: #1e40af; /* blue-700 */
  background: #dbeafe; /* blue-100 */
  padding: 4px 10px;
  border-radius: 999px;
}

.query-content {
  margin-bottom: 14px;
}

.query-question {
  margin: 0 0 10px 0;
  line-height: 1.5;
  font-size: 14px;
  color: #1e3a8a; /* blue-800 */
  font-weight: 500;
}

.input-field { margin-top: 8px; }

.query-input, .query-select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #bfdbfe; /* blue-200 */
  border-radius: 8px;
  font-size: 14px;
  color: #1f2937; /* gray-800 */
  background: #ffffff;
}

.query-input:focus, .query-select:focus {
  outline: none;
  border-color: #60a5fa; /* blue-400 */
  box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.18);
}

.confirm-hint {
  font-size: 13px;
  color: #1d4ed8; /* blue-700 */
  font-style: italic;
}

/* 요청 내용 블록 */
.request-block {
  background: #ffffff;
  border: 1px dashed #93c5fd; /* blue-300 */
  border-radius: 8px;
  padding: 10px 12px;
  margin: 10px 0 2px;
}
.request-title {
  font-size: 12px;
  font-weight: 700;
  color: #2563eb; /* blue-600 */
  margin-bottom: 6px;
}
.request-body {
  font-size: 13px;
  color: #1f2937; /* gray-800 */
  line-height: 1.55;
  white-space: pre-wrap;
}

.query-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.query-completed {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-top: 6px;
}

.completed-pill {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}
.pill-approved { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
.pill-rejected { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
.pill-neutral { background: #e5e7eb; color: #374151; border: 1px solid #d1d5db; }

.completed-detail {
  font-size: 13px;
  color: #1f2937;
}

.query-cancel, .query-confirm {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.query-cancel {
  background: #ffffff;
  border: 1px solid #e5e7eb; /* gray-300 */
  color: #374151; /* gray-700 */
}

.query-cancel:hover { background: #f9fafb; }

.query-confirm {
  background: #60a5fa; /* blue-400 */
  border: 1px solid #3b82f6; /* blue-500 */
  color: #ffffff;
}

.query-confirm:hover:not(:disabled) { background: #3b82f6; }

.query-confirm:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>