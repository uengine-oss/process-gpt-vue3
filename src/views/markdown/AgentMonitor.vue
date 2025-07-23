<template>
  <BrowserAgent v-if="openBrowserAgent" :html="html" :workItem="workItem" :doneWorkItemList="doneWorkItemList" />
  <div v-else class="agent-monitor">
    <div class="task-area" ref="taskArea">
      <div v-if="errorMessage" class="error-banner">
        {{ errorMessage }}
      </div>
      <div v-if="timeline.length > 0" class="timeline-list">
        <div
          v-for="(item, index) in timeline"
          :key="item.type + '-' + (item.type === 'task' ? item.payload.id : 'chat-' + index)"
          class="timeline-item"
        >
          <div v-if="item.type === 'task'" class="task-card">
            <div class="task-header">
              <div class="task-left">
                <div class="task-avatar">
                  <img v-if="item.payload.agentProfile"
                       :src="item.payload.agentProfile"
                       alt="Agent"
                       class="avatar-image"/>
                  <span v-else>{{ index + 1 }}</span>
                </div>
                <div class="task-info">
                  <h3 class="task-title">{{ getDisplayName(item.payload) }}</h3>
                  <p class="task-description">{{ item.payload.goal }}</p>
                </div>
              </div>
              <div class="task-header-right">
                <div :class="['task-status', item.payload.isCompleted ? (item.payload.isCrewCompleted ? 'crew-completed' : 'completed') : 'running']">
                  <div class="status-dot"></div>
                  <span>{{ getStatusText(item.payload) }}</span>
                </div>
              </div>
            </div>

            <div class="task-meta">
              <div class="meta-item">
                <span class="meta-label">시작시간</span>
                <span class="meta-value">{{ formatTime(item.payload.startTime) }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">유형</span>
                <span class="meta-value">{{ item.payload.crewType }}</span>
              </div>
              <div
                v-if="
                  item.payload.isCompleted && isTaskCompleted(item.payload) && (
                    (item.payload.crewType === 'report' && item.payload.jobId.includes('final_report_merge')) ||
                    item.payload.crewType === 'slide' ||
                    item.payload.crewType === 'text' ||
                    (item.payload.crewType === 'action' && isLastCompletedActionTask(item.payload))
                  )
                "
                class="meta-submit"
              >
                <button @click="submitTask(item.payload)" class="submit-button-light">
                  채택
                </button>
              </div>
            </div>

            <div v-if="item.payload.isCompleted && item.payload.output" class="task-result">
              <div class="result-header">
                <h4 class="result-title">작업 결과</h4>
              </div>
              <div class="result-content">
                <template v-if="item.payload.crewType === 'slide'">
                  <div class="slides-container">
                    <div class="slides-header">
                      <div class="header-info">
                        <h5>프레젠테이션 모드</h5>
                        <span class="slide-hint">슬라이드를 클릭하여 탐색하세요</span>
                      </div>
                      <div class="slide-navigation">
                        <button 
                          @click="previousSlide(item.payload.id)" 
                          :disabled="getCurrentSlideIndex(item.payload.id) === 0"
                          class="nav-btn"
                        >
                          ←
                        </button>
                        <span class="slide-counter">
                          {{ getCurrentSlideIndex(item.payload.id) + 1 }} / {{ getSlides(item.payload.output).length }}
                        </span>
                        <button 
                          @click="nextSlide(item.payload.id)" 
                          :disabled="getCurrentSlideIndex(item.payload.id) === getSlides(item.payload.output).length - 1"
                          class="nav-btn"
                        >
                          →
                        </button>
                      </div>
                    </div>
                    <div class="slide-content">
                      <div v-html="getCurrentSlide(item.payload)" class="slide-inner"></div>
                    </div>
                    <div class="slide-indicators">
                      <span 
                        v-for="(slide, index) in getSlides(item.payload.output)" 
                        :key="index"
                        :class="['indicator', { active: index === getCurrentSlideIndex(item.payload.id) }]"
                        @click="goToSlide(item.payload.id, index)"
                      ></span>
                    </div>
                  </div>
                </template>
                <template v-else-if="item.payload.crewType === 'report'">
                  <div
                    :class="['markdown-container', { expanded: isTaskExpanded(item.payload.id) }]"
                    @dblclick="toggleTaskExpansion(item.payload.id)"
                    v-html="formatMarkdownOutput(Object.values(item.payload.output)[0] || '')"
                  ></div>
                </template>
                <template v-else>
                  <div
                    :class="['json-container', { expanded: isTaskExpanded(item.payload.id) }]"
                    @dblclick="toggleTaskExpansion(item.payload.id)"
                  >
                    <pre>{{ formatJsonOutput(item.payload.output) }}</pre>
                  </div>
                </template>
              </div>
              <div
                v-if="(item.payload.crewType === 'report' && isContentLong(formatMarkdownOutput(Object.values(item.payload.output)[0] || '')))
                    || (item.payload.crewType !== 'slide' && item.payload.crewType !== 'report' && isContentLong(formatJsonOutput(item.payload.output)))"
                class="expand-controls"
              >
                <button @click="toggleTaskExpansion(item.payload.id)" class="expand-button">
                  {{ isTaskExpanded(item.payload.id) ? '접기' : '더보기' }}
                  <span class="expand-icon">
                    {{ isTaskExpanded(item.payload.id) ? '▲' : '▼' }}
                  </span>
                </button>
                <span class="expand-hint">
                  더블클릭으로도 {{ isTaskExpanded(item.payload.id) ? '접기' : '펼치기' }}가 가능합니다
                </span>
              </div>
            </div>
            <div v-else-if="!item.payload.isCompleted" class="task-progress">
              <div class="progress-dots">
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
              </div>
              <span>작업을 진행하고 있습니다...</span>
            </div>
            <div v-if="!item.payload.isCompleted && toolUsageStatusByTask[item.payload.jobId] && toolUsageStatusByTask[item.payload.jobId].length" class="tool-usage-status-list">
              <div
                v-for="(tool, idx) in toolUsageStatusByTask[item.payload.jobId]"
                :key="item.payload.jobId + '-' + tool.tool_name + '-' + idx"
                class="tool-usage-status-item"
              >
                <div class="tool-status-indicator">
                  <div v-if="tool.status === 'searching'" class="loading-spinner"></div>
                  <div v-else class="check-mark">✓</div>
                </div>
                <span>
                  {{ tool.tool_name }} 도구 {{ tool.status === 'done' ? '사용 완료' : '사용 중입니다' }}<span v-if="tool.query || tool.info">: {{ tool.query || tool.info }}</span>
                </span>
              </div>
            </div>
          </div>
          <div v-else class="chat-message">
            <div class="bubble">{{ item.payload.content }}</div>
          </div>
        </div>
      </div>
      <div v-else class="empty-state">
        <div class="empty-icon">📋</div>
        <h3>{{ isQueued ? '작업이 대기열에 등록되었습니다' : '진행중인 작업이 없습니다' }}</h3>
        <p>작업이 시작되면 여기에 표시됩니다.</p>
        <div v-if="!isQueued" class="start-controls">
          <div class="method-selector">
            <label for="research-method" class="method-label">연구 방식:</label>
            <select 
              id="research-method" 
              v-model="selectedResearchMethod" 
              class="method-dropdown"
            >
              <option value="crewai">CrewAI Deep Research</option>
              <option value="crewai-action">CrewAI Action</option>
              <option value="openai">OpenAI Deep Research</option>
              <option value="brower-use">Browser Use</option>
            </select>
          </div>
          <button v-if="selectedResearchMethod === 'brower-use' && !downloadedBrowserAgent" @click="downloadBrowserAgent" class="start-button">다운로드</button>
          <div v-if="selectedResearchMethod === 'brower-use' && !downloadedBrowserAgent" style="margin-top: 8px; color: #888; font-size: 0.95em;">
            Browser use 기능은 다운로드 후 압축 해제 후 사용 가능합니다. (용량: 114MB)
          </div>
          <button v-else @click="startTask" class="start-button">시작하기</button>
        </div>
      </div>
      <div v-if="isLoading && timeline.length > 0" class="feedback-loading">
        <div class="loading-spinner"></div>
        <span v-if="todoStatus.draft_status === 'STARTED' && todoStatus.agent_mode === 'COMPLETE'">액션 실행 작업을 진행중입니다...</span>
        <span v-else-if="todoStatus.draft_status === 'STARTED'">초안 생성 작업을 진행중입니다...</span>
        <span v-else-if="todoStatus.draft_status === 'FB_REQUESTED' && todoStatus.agent_mode === 'COMPLETE'">피드백을 반영하여 액션을 다시 실행하고 있습니다...</span>
        <span v-else-if="todoStatus.draft_status === 'FB_REQUESTED'">피드백을 반영하여 초안을 다시 생성하고 있습니다...</span>
        <button @click="stopTask" class="stop-button" aria-label="중단">
          ⏹
        </button>
      </div>
    </div>
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
        <template #custom-tools v-if="isLoading">
          <button @click="stopTask" class="stop-button">⏹</button>
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
      selectedResearchMethod: 'crewai',
      openBrowserAgent: false,
      downloadedBrowserAgent: false,
      doneWorkItemList: []
    }
  },
  computed: {
    tasks() {
      const taskMap = new Map()
      const crewCompleted = new Set()
      // 단일 루프로 이벤트 처리
      this.events.forEach(e => {
        const { event_type, crew_type, data, job_id, id, timestamp } = e
        const jobId = job_id || data?.job_id || id
        if (event_type === 'crew_completed') {
          crewCompleted.add(crew_type)
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
            output: null,
            isCrewCompleted: false,
            agentProfile: data?.agent_profile
          })
        } else if (event_type === 'task_completed' && taskMap.has(jobId)) {
          const task = taskMap.get(jobId)
          task.isCompleted = true
          task.output = data?.final_result || null
        }
      })
      // crew_completed 마킹
      crewCompleted.forEach(type => {
        const tasksOfType = Array.from(taskMap.values())
          .filter(t => t.crewType === type && t.isCompleted)
          .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
        if (tasksOfType[0]) tasksOfType[0].isCrewCompleted = true
      })
      // 시작시간 기준 오름차순 반환
      return Array.from(taskMap.values()).sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
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
      return this.todoStatus &&
        (this.todoStatus.status === 'IN_PROGRESS' && (this.todoStatus.agent_mode === 'DRAFT' || this.todoStatus.agent_mode === 'COMPLETE') && this.todoStatus.agent_orch)
    },
    timeline() {
      const taskItems = this.tasks.map(task => ({ type: 'task', time: task.startTime, payload: task }));
      const chatItems = this.chatMessages.map(msg => ({ type: 'chat', time: msg.time, payload: msg }));
      return [...taskItems, ...chatItems].sort((a, b) => new Date(a.time) - new Date(b.time));
    },
  },
  methods: {
    downloadBrowserAgent() {
      const url = 'https://drive.google.com/uc?export=download&id=1-yFl3h8hzoxOPqc0vZbawLAlKAVmdEyY';
      window.open(url, '_blank');
      localStorage.setItem('downloadedBrowserAgent', 'true');
      this.downloadedBrowserAgent = true;
    },
    extractContent(content) {
      return (typeof content === 'object' && content.text !== undefined)
        ? content.text
        : content
    },
    getTaskIdFromWorkItem() {
      if (this.workItem && this.workItem.worklist) {
        return this.workItem.worklist.taskId
      }
      return null
    },

    formatTime(timestamp) {
      return new Date(timestamp).toLocaleString('ko-KR', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    },
    
    cleanString(str) {
      return str.replace(/\\n/g, '\n').replace(/\\r/g, '').replace(/\\t/g, '  ').replace(/\\\\/g, '\\')
    },

    formatJsonOutput(output) {
      if (!output) return '';

      // 1) 문자열로 넘어올 때—펜스 제거
      if (typeof output === 'string') {
        // 이스케이프 복원
        let str = this.cleanString(output).trim();
        // ```json … ``` 펜스 제거
        str = str.replace(/^```json\s*/, '').replace(/```$/, '').trim();
        try {
          // 2) JS 객체로 파싱
          const obj = JSON.parse(str);
          // 3) 예쁘게 직렬화
          return JSON.stringify(obj, null, 2);
        } catch {
          // 파싱 실패 시, 펜스 없는 원본 문자열 그대로 반환
          return str;
        }
      }

      // 객체로 넘어올 때
      try {
        return JSON.stringify(output, null, 2);
      } catch {
        return String(output);
      }
    },

    sanitizeMarkdownOutput(output) {
      if (typeof output === 'string') {
        let trimmed = output.trim();
        let loopCount = 0;
        while (true) {
          const beforeTrim = trimmed;
          loopCount++;
          trimmed = trimmed.replace(/^(```|~~~|""")[a-zA-Z0-9]*\s*\n([\s\S]*?)\n\1\s*$/gm, '$2').trim();
          if (beforeTrim === trimmed || loopCount > 10) break;
        }
        return trimmed;
      }
      return output;
    },

    formatMarkdownOutput(output) {
      if (!output) return '';
      const sanitized = this.sanitizeMarkdownOutput(output);
      const outputStr = typeof sanitized === 'object'
        ? JSON.stringify(sanitized, null, 2)
        : String(sanitized);
      const clean = this.cleanString(outputStr);
      try {
        return marked(clean, { breaks: true, gfm: true });
      } catch {
        return clean.replace(/\n/g, '<br>');
      }
    },

    getSlides(output) {
      if (!output) return [];
      // 객체 형태일 경우 첫 번째 값(슬라이드 마크다운) 사용
      const source = (typeof output === 'object' && !Array.isArray(output))
        ? Object.values(output)[0]
        : output;
      const sanitized = this.sanitizeMarkdownOutput(source);
      return String(sanitized)
        .split(/^\s*---\s*$/gm)
        .filter(slide => slide.trim().length > 0)
        .map(slide => {
          const clean = this.cleanString(slide.trim());
          try {
            return marked(clean, { breaks: true, gfm: true });
          } catch {
            return clean.replace(/\n/g, '<br>');
          }
        });
    },

    getCurrentSlideIndex(taskId) {
      return this.slideIndexes[taskId] || 0
    },

    getCurrentSlide(task) {
      const slides = this.getSlides(task.output)
      const index = this.getCurrentSlideIndex(task.id)
      return slides[index] || ''
    },

    previousSlide(taskId) {
      const currentIndex = this.getCurrentSlideIndex(taskId)
      if (currentIndex > 0) {
        this.slideIndexes = { ...this.slideIndexes, [taskId]: currentIndex - 1 }
      }
    },

    nextSlide(taskId) {
      const slides = this.getSlides(this.tasks.find(t => t.id === taskId)?.output)
      const currentIndex = this.getCurrentSlideIndex(taskId)
      if (currentIndex < slides.length - 1) {
        this.slideIndexes = { ...this.slideIndexes, [taskId]: currentIndex + 1 }
      }
    },

    goToSlide(taskId, index) {
      const slides = this.getSlides(this.tasks.find(t => t.id === taskId)?.output)
      if (index >= 0 && index < slides.length) {
        this.slideIndexes = { ...this.slideIndexes, [taskId]: index }
      }
    },

    isTaskCompleted(task) {
      return this.events.some(event => 
        event.event_type === 'task_completed' && 
        (event.job_id === task.jobId || event.id === task.id)
      )
    },

    submitTask(task) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(this.html, 'text/html');
      // task.output이 문자열인 경우 JSON 파싱
      let parsed;
      try {
        parsed = typeof task.output === 'string' ? JSON.parse(task.output) : task.output;
      } catch {
        parsed = {};
      }
      const formValues = {};
      // 각 row-layout 그룹별 필드 이름과 값을 매핑
      const rowLayouts = Array.from(doc.querySelectorAll('row-layout[name]'));
      rowLayouts.forEach(rl => {
        const groupName = rl.getAttribute('name');
        const isMulti = rl.getAttribute('is_multidata_mode') === 'true';
        // 그룹 내 모든 입력 필드 선택
        const selector = 'text-field[name], textarea-field[name], report-field[name], slide-field[name], select-field[name]';
        const fieldEls = Array.from(rl.querySelectorAll(selector));
        if (isMulti) {
          // 다중 모드: 배열로 전달
          const item = {};
          fieldEls.forEach(el => {
            const fname = el.getAttribute('name');
            item[fname] = parsed[fname] !== undefined ? parsed[fname] : '';
          });
          formValues[groupName] = [item];
        } else {
          // 단일 모드: 개별 키-값으로 전달
          fieldEls.forEach(el => {
            const fname = el.getAttribute('name');
            if (parsed[fname] !== undefined) {
              formValues[fname] = parsed[fname];
            }
          });
        }
      });
      // 이벤트 발행
      this.EventBus.emit('form-values-updated', formValues);
    },

    async loadData() {
      try {
        if(localStorage.getItem('downloadedBrowserAgent') === 'true') {
          this.downloadedBrowserAgent = true;
        }
        this.errorMessage = null;
        this.events = [];
        const taskId = this.getTaskIdFromWorkItem();
        if (!taskId) {
          this.errorMessage = 'taskId를 찾을 수 없습니다.';
          return;
        }
        const { data, error } = await window.$supabase
          .from('events')
          .select('*')
          .eq('todo_id', taskId)
          .in('event_type', ['task_started', 'task_completed', 'crew_completed', 'tool_usage_started', 'tool_usage_finished'])
          .order('timestamp', { ascending: true })
        if (error) {
          this.errorMessage = '이벤트 데이터를 불러오는 중 오류가 발생했습니다: ' + error.message;
          throw error
        }
        if (data) {
          this.events = data
          if (this.events.some(e => e.event_type === 'crew_completed')) {
            this.isCancelled = true;
          }
        }
      } catch (error) {
        this.errorMessage = '이벤트 데이터를 불러오는 중 오류가 발생했습니다: ' + (error.message || error);
        console.error('Failed to load data from Supabase:', error)
      }
    },
    setupRealtimeSubscription() {
      try {
        this.channel = window.$supabase
          .channel('events')
          .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'events'
          }, ({ new: row }) => {
            const taskId = this.getTaskIdFromWorkItem();
            const todoId = row.todo_id;
            const exists = this.events.some(e => e.id === row.id);

            if (!exists && ['task_started', 'task_completed', 'crew_completed', 'tool_usage_started', 'tool_usage_finished'].includes(row.event_type) && todoId === taskId) {
              this.events = [...this.events, row];
              // crew_completed 수신 시 로딩 상태 해제
              if (row.event_type === 'crew_completed') {
                this.isLoading = false;
              }
            } else {
              if (todoId !== taskId) {
                console.warn('[ID 불일치] 이벤트 todo_id:', todoId, 'vs 현재 taskId:', taskId, '이벤트 전체:', row);
              }
            }
          })
          .subscribe((status) => {
            if (status === 'SUBSCRIPTION_ERROR') {
              this.errorMessage = '실시간 이벤트 구독에 실패했습니다.';
            }
          });
      } catch (error) {
        this.errorMessage = '실시간 구독 중 오류가 발생했습니다: ' + (error.message || error);
      }
    },
    cleanup() {
      if (this.channel) {
          window.$supabase.removeChannel(this.channel)
      }
    },
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

    getStatusText(task) {
      if (!task.isCompleted) {
        return '진행중'
      }
      
      if (task.isCrewCompleted) {
        return '전체완료'
      }
      
      return '작업완료'
    },
    async startTask() {
      if(this.selectedResearchMethod === 'brower-use') {
        const workItemList = await backend.getWorkListByInstId(this.workItem.worklist.instId);
        if(workItemList) {
          let doneWorkItemList = workItemList.filter(item => item.status === 'DONE' && item.task && item.task.output);
          if(doneWorkItemList.length > 0) {
            this.doneWorkItemList = doneWorkItemList.map(item => ({
              name: item.name,
              output: item.task.output
            }));
          }
        }
        this.openBrowserAgent = true;
        return;
      }
      const taskId = this.getTaskIdFromWorkItem();
      if (!taskId) {
        this.errorMessage = 'taskId를 찾을 수 없습니다.';
        return;
      }
      // 로딩 상태 활성화 및 draft_status 설정
      this.isLoading = true;
      const agentMode = this.selectedResearchMethod === 'crewai-action' ? 'COMPLETE' : 'DRAFT';
      
      // 선택된 연구 방식에 따라 agent_orch 값 결정
      let agentOrch;
      if (this.selectedResearchMethod === 'openai') {
        agentOrch = 'openai';
      } else if (this.selectedResearchMethod === 'crewai-action') {
        agentOrch = 'crewai-action';
      } else {
        agentOrch = 'crewai'; // crewai 기본값
      }
      
      this.todoStatus = { ...this.todoStatus, agent_mode: agentMode, status: 'IN_PROGRESS', draft_status: 'STARTED', agent_orch: agentOrch };
      try {
        
        await backend.putWorkItem(taskId, { 
          agent_mode: agentMode, 
          status: 'IN_PROGRESS',
          agent_orch: agentOrch
        });
      } catch (error) {
        console.error('작업 시작 중 오류:', error);
        this.errorMessage = '작업 시작 중 오류가 발생했습니다.';
      }
    },
    async fetchTodoStatus() {
      const taskId = this.getTaskIdFromWorkItem();
      if (!taskId) return;
      try {
        const { data, error } = await window.$supabase
          .from('todolist')
          .select('status, agent_mode, draft_status, feedback, agent_orch')
          .eq('id', taskId)
          .single();
        if (error) {
          throw error;
        }
        this.todoStatus = data;
        this.isLoading = ['STARTED', 'FB_REQUESTED'].includes(data.draft_status);
        this.isCancelled = data.draft_status === 'CANCELLED';
        
        let feedbackArr = [];
        if (data.feedback) {
          try {
            feedbackArr = typeof data.feedback === 'string'
              ? JSON.parse(data.feedback)
              : data.feedback;
          } catch {
            feedbackArr = [];
          }
        }
        this.chatMessages = feedbackArr.map(item => ({
          time: item.time,
          content: this.extractContent(item.content)
        }));
        this.chatMessages.sort((a, b) => new Date(a.time) - new Date(b.time));
      } catch (e) {
        console.error('todolist 상태 조회 실패:', e);
        this.errorMessage = 'todolist 상태 조회 실패: ' + (e.message || e);
      }
    },
    async stopTask() {
      const taskId = this.getTaskIdFromWorkItem();
      if (!taskId) {
        this.errorMessage = 'taskId를 찾을 수 없습니다.';
        return;
      }
      try {
        await backend.putWorkItem(taskId, { draft_status: 'CANCELLED' });
        // 중단 시 상태 초기화
        this.isCancelled = true;
        this.isLoading = false;
        if (this.todoStatus) this.todoStatus.draft_status = 'CANCELLED';
      } catch (error) {
        console.error('중단 중 오류:', error);
        this.errorMessage = '중단 중 오류가 발생했습니다.';
      }
    },
    async submitChat(content) {
      const taskId = this.getTaskIdFromWorkItem();
      if (!taskId) {
        this.errorMessage = 'taskId를 찾을 수 없습니다.';
        return;
      }
      if (!content) return;
      try {
        const existing = this.todoStatus.feedback;
        let arr = [];
        try {
          arr = existing
            ? (typeof existing === 'string' ? JSON.parse(existing) : existing)
            : [];
        } catch {
          arr = [];
        }
        const now = new Date().toISOString();
        const text = this.extractContent(content);
        arr.push({ time: now, content: text });
        const updatedFeedback = arr;
        await backend.putWorkItem(taskId, {
          feedback: updatedFeedback,
          draft_status: 'FB_REQUESTED'
        });
        if (this.todoStatus) this.todoStatus.draft_status = 'FB_REQUESTED';
        this.isLoading = true;
        this.todoStatus.feedback = updatedFeedback;
        this.chatMessages.push({ time: now, content: text });
        this.chatMessages = [...this.chatMessages];
        this.$nextTick(() => {
          if (this.$refs.taskArea) {
            this.$refs.taskArea.scrollTop = this.$refs.taskArea.scrollHeight;
          }
        });
      } catch (error) {
        console.error('채팅 전송 중 오류:', error);
        this.errorMessage = '채팅 전송 중 오류가 발생했습니다.';
      }
    },
    getDisplayName(task) {
      const name = task.name || '';
      // name이 없거나 'unknown'일 경우 role 사용
      if (!name.trim() || name.trim().toLowerCase() === 'unknown') {
        return task.role;
      }
      return task.name;
    },
    
    isLastCompletedActionTask(task) {
      if (task.crewType !== 'action') return false;
      
      // action 타입 중에서 완료된 task들만 필터링
      const actionTasks = this.tasks.filter(t => 
        t.crewType === 'action' && t.isCompleted && this.isTaskCompleted(t)
      );
      
      if (actionTasks.length === 0) return false;
      
      // 시작시간 기준으로 정렬하여 가장 마지막 task 찾기
      const lastActionTask = actionTasks.sort((a, b) => 
        new Date(b.startTime) - new Date(a.startTime)
      )[0];
      
      return task.id === lastActionTask.id;
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
  beforeUnmount() {
    this.cleanup()
  }
}
</script>

<style scoped>
.agent-monitor {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px 16px 0px;
  width: 100%;
  height: 67vh;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
.task-area {
  flex: 1;
  overflow-y: auto;
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

.task-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
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

/* JSON 출력 스타일 */
.json-output {
  background: #f8fafb;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e4e6ea;
  min-height: 400px;
  display: flex;
  flex-direction: column;
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

.json-container.expanded {
  max-height: none;
}

.json-container:not(.expanded)::after {
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
  .agent-monitor { padding: 16px 12px; }
  .task-card { padding: 16px; }
  .task-header { flex-direction: column; gap: 12px; align-items: stretch; }
  .task-header-right { justify-content: flex-start; }
  .task-status { align-self: flex-start; }
  .task-meta { flex-direction: column; gap: 12px; }
  .result-content { padding: 12px; }
  
  .slides-header {
    padding: 12px 16px;
    flex-direction: column;
    gap: 12px;
    text-align: center;
  }
  
  .slide-content {
    padding: 20px;
  }
  
  .slide-inner :deep(h1) {
    font-size: 1.8rem;
  }
  
  .slide-inner :deep(h2) {
    font-size: 1.4rem;
  }
  
  .slide-inner :deep(p) {
    font-size: 1rem;
  }
  
  .json-output pre {
    padding: 16px;
    font-size: 12px;
  }
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

@keyframes completedPulse {
  0% { transform: scale(1); box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3); }
  50% { transform: scale(1.05); box-shadow: 0 4px 16px rgba(76, 175, 80, 0.5); }
  100% { transform: scale(1); box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3); }
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  background: white;
  border-radius: 12px;
  border: 1px solid #e1e8ed;
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

.markdown-container:not(.expanded)::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 40px;
  background: linear-gradient(transparent, white);
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

/* 시작 컨트롤 스타일 */
.start-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  margin-top: 16px;
}

.method-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f8f9fa;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid #e9ecef;
}

.method-label {
  font-size: 13px;
  font-weight: 500;
  color: #495057;
  white-space: nowrap;
}

.method-dropdown {
  background: white;
  border: 1px solid #ced4da;
  border-radius: 4px;
  padding: 6px 8px;
  font-size: 13px;
  color: #495057;
  cursor: pointer;
  min-width: 200px;
  transition: border-color 0.2s ease;
}

.method-dropdown:focus {
  outline: none;
  border-color: #60A5FA;
  box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.2);
}

.method-dropdown:hover {
  border-color: #adb5bd;
}

/* 반응형 디자인 */
@media (max-width: 768px) {
  .method-selector {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
  }
  
  .method-dropdown {
    min-width: auto;
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
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 0;
  margin-top: 16px;
}
.chat-textarea {
  flex: 1;
  resize: none;
  overflow-y: auto;
  max-height: 72px;
  font-size: 14px;
  line-height: 1.4;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 8px;
}
.chat-textarea:focus { outline: none; box-shadow: none; }
.chat-toggle-button {
  margin-left: 8px;
  background: transparent;
  border: none;
  font-size: 18px;
  color: #0066cc;
  cursor: pointer;
}
.chat-toggle-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
  margin-bottom: 12px;
  font-size: 14px;
  color: #606770;
}

/* 채팅 영역 전체 너비 고정 */
.chat-input-wrapper {
  width: 100%;
  display: flex;
}
/* Chat.vue 루트 컨테이너도 너비 100% 적용 */
.chat-input-wrapper ::v-deep .chat-info-view-wrapper {
  width: 100% !important;
}

/* Chat 컴포넌트의 아바타 아이콘 숨기기 */
.chat-input-wrapper ::v-deep .v-avatar {
  display: none !important;
}
/* Chat 컴포넌트의 사용자 이름 숨기기 */
.chat-input-wrapper ::v-deep .user-name {
  display: none !important;
}

.chat-input-wrapper ::v-deep .chat-view-box {
  display: none !important;
}

.chat-input-wrapper ::v-deep .pa-4,
.chat-input-wrapper ::v-deep .v-divider {
  display: none !important;
}

.feedback-loading .stop-button {
  margin-left: auto;
  background: transparent;
  border: none;
  color: #f57c00;
  font-size: 24px;
  cursor: pointer;
}
.feedback-loading .stop-button:hover {
  text-decoration: underline;
}
</style>