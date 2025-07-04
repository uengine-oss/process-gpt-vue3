<template>
  <div class="agent-monitor">
    <div v-if="errorMessage" class="error-banner">
      {{ errorMessage }}
    </div>
    <div v-if="tasks.length > 0" class="task-list">
      <div v-for="(task, index) in tasks" :key="task.id" class="task-card">
        <div class="task-header">
          <div class="task-left">
            <div class="task-avatar">
              <img v-if="task.agentProfile" :src="task.agentProfile" alt="Agent" class="avatar-image" />
              <span v-else>{{ index + 1 }}</span>
            </div>
            <div class="task-info">
              <h3 class="task-title">{{ task.role }}</h3>
              <p class="task-description">{{ task.goal }}</p>
            </div>
          </div>
          <div class="task-header-right">
            <div :class="['task-status', task.isCompleted ? (task.isCrewCompleted ? 'crew-completed' : 'completed') : 'running']">
              <div class="status-dot"></div>
              <span>{{ getStatusText(task) }}</span>
            </div>
          </div>
        </div>

        <div class="task-meta">
          <div class="meta-item">
            <span class="meta-label">시작시간</span>
            <span class="meta-value">{{ formatTime(task.startTime) }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">유형</span>
            <span class="meta-value">{{ task.crewType }}</span>
          </div>
          <div v-if="task.isCompleted && isTaskCompleted(task)" class="meta-submit">
            <button @click="submitTask(task)" class="submit-button-light">
              채택
            </button>
          </div>
        </div>

        <div v-if="task.isCompleted && task.output" class="task-result">
          <div class="result-header">
            <h4 class="result-title">작업 결과</h4>
            <div class="result-type-badge">
              <span class="type-label">{{ getOutputTypeLabel(task.crewType, task.output) }}</span>
            </div>
          </div>
          <div class="result-content">
            <!-- JSON 출력 -->
            <div v-if="isJsonOutput(task.crewType, task.output)" class="json-output">
              <div 
                :class="['json-container', { expanded: isTaskExpanded(task.id) }]"
                @dblclick="toggleTaskExpansion(task.id)"
              >
              <pre>{{ formatJsonOutput(task.output) }}</pre>
              </div>
              <div v-if="isContentLong(formatJsonOutput(task.output))" class="expand-controls">
                <button @click="toggleTaskExpansion(task.id)" class="expand-button">
                  {{ isTaskExpanded(task.id) ? '접기' : '더보기' }} 
                  <span class="expand-icon">{{ isTaskExpanded(task.id) ? '▲' : '▼' }}</span>
                </button>
                <span class="expand-hint">더블클릭으로도 {{ isTaskExpanded(task.id) ? '접기' : '펼치기' }}가 가능합니다</span>
              </div>
            </div>
            <!-- 슬라이드 출력 -->
            <div v-else-if="isSlideOutput(task.crewType, task.output)" class="slides-container">
              <div class="slides-header">
                <div class="header-info">
                  <h5>프레젠테이션 모드</h5>
                  <span class="slide-hint">슬라이드를 클릭하여 탐색하세요</span>
                </div>
                <div class="slide-navigation">
                  <button 
                    @click="previousSlide(task.id)" 
                    :disabled="getCurrentSlideIndex(task.id) === 0"
                    class="nav-btn"
                  >
                    ←
                  </button>
                  <span class="slide-counter">
                    {{ getCurrentSlideIndex(task.id) + 1 }} / {{ getSlides(task.output).length }}
                  </span>
                  <button 
                    @click="nextSlide(task.id)" 
                    :disabled="getCurrentSlideIndex(task.id) === getSlides(task.output).length - 1"
                    class="nav-btn"
                  >
                    →
                  </button>
                </div>
              </div>
              <div class="slide-content">
                <div v-html="getCurrentSlide(task)" class="slide-inner"></div>
              </div>
              <div class="slide-indicators">
                <span 
                  v-for="(slide, index) in getSlides(task.output)" 
                  :key="index"
                  :class="['indicator', { active: index === getCurrentSlideIndex(task.id) }]"
                  @click="goToSlide(task.id, index)"
                ></span>
              </div>
            </div>
            <!-- 마크다운 출력 -->
            <div v-else class="markdown-output">
              <div 
                :class="['markdown-container', { expanded: isTaskExpanded(task.id) }]"
                @dblclick="toggleTaskExpansion(task.id)"
                v-html="formatMarkdownOutput(task.output)"
              ></div>
              <div v-if="isContentLong(task.output)" class="expand-controls">
                <button @click="toggleTaskExpansion(task.id)" class="expand-button">
                  {{ isTaskExpanded(task.id) ? '접기' : '더보기' }}
                  <span class="expand-icon">{{ isTaskExpanded(task.id) ? '▲' : '▼' }}</span>
                </button>
                <span class="expand-hint">더블클릭으로도 {{ isTaskExpanded(task.id) ? '접기' : '펼치기' }}가 가능합니다</span>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="!task.isCompleted" class="task-progress">
          <div class="progress-dots">
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
          </div>
          <span>작업을 진행하고 있습니다...</span>
        </div>
        <div v-if="!task.isCompleted && toolUsageStatusByTask[task.jobId] && toolUsageStatusByTask[task.jobId].length" class="tool-usage-status-list">
          <div
            v-for="tool in toolUsageStatusByTask[task.jobId]"
            :key="tool.tool_name + tool.query"
            class="tool-usage-status-item"
          >
            <div class="tool-status-indicator">
              <div v-if="tool.status === 'searching'" class="loading-spinner"></div>
              <div v-else class="check-mark">✓</div>
            </div>
            <span v-if="tool.tool_name && tool.tool_name.includes('mem0')">
              {{ tool.tool_name }}로 {{ tool.query }} 정보{{ tool.status === 'done' ? ' 검색 완료' : '를 찾는중' }}
            </span>
            <span v-else-if="tool.tool_name && tool.tool_name.includes('perplexity')">
              {{ tool.tool_name }}로 {{ tool.query }}를 {{ tool.status === 'done' ? '검색 완료' : '검색중' }}
            </span>
            <span v-else>
              {{ tool.tool_name }}({{ tool.query }}) {{ tool.status === 'done' ? '작업 완료' : '작업중' }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="tasks.length === 0" class="empty-state">
      <div class="empty-icon">📋</div>
      <h3>{{ isQueued ? '작업이 대기열에 등록되었습니다' : '진행중인 작업이 없습니다' }}</h3>
      <p>작업이 시작되면 여기에 표시됩니다.</p>
      <button v-if="!isQueued" @click="startTask" class="start-button">시작하기</button>
    </div>

    <!-- Chat UI -->
    <div class="chat-container">
      <div class="chat-messages">
        <div v-for="(message, index) in chatMessages" :key="index" class="chat-message">
          <div class="bubble">{{ message.content }}</div>
        </div>
      </div>
      <!-- 피드백 처리 로딩 표시 -->
      <div v-if="isFeedbackLoading" class="feedback-loading">
        <div class="loading-spinner"></div>
        <span>피드백 처리 중입니다. 잠시만 기다려주세요...</span>
      </div>
      <!-- 채팅 입력창 -->
      <div v-else class="chat-input-wrapper">
        <input v-model="chatInput" :disabled="!isCancelled" placeholder="메시지를 입력하세요..." />
        <button @click="submitChat" :disabled="!isCancelled || !chatInput">전송</button>
        <button class="stop-button" @click="stopTask" v-if="!isCancelled">중단</button>
      </div>
    </div>
  </div>
</template>

<script>
import { marked } from 'marked'
import BackendFactory from '@/components/api/BackendFactory'

const backend = BackendFactory.createBackend()

export default {
  name: 'AgentMonitor',
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
      slideIndexes: {}, // task별 현재 슬라이드 인덱스 관리
      expandedTasks: {}, // task별 확장/축소 상태 관리
      errorMessage: null, // 에러 메시지 상태 추가
      todoStatus: null, // todolist의 상태 저장
      chatInput: '',        // Chat 입력값
      chatMessages: [],     // Chat 메시지 리스트
      isCancelled: false,    // 채팅 활성화 상태 (중단 시 true로 변경)
      isFeedbackLoading: false  // 피드백 처리 중 로딩 상태
    }
  },
  computed: {
    tasks() {
      const sorted = [...this.events].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      const filtered = sorted.filter(e => e.event_type === 'task_started' || e.event_type === 'task_completed' || e.event_type === 'crew_completed')
      
      const tasks = []
      const taskMap = new Map()
      const crewCompletedTypes = new Set()
      
      // crew_completed 이벤트 먼저 처리
      filtered.forEach(event => {
        if (event.event_type === 'crew_completed') {
          crewCompletedTypes.add(event.crew_type)
        }
      })
      
      filtered.forEach(event => {
        const data = this.parseData(event)
        const jobId = event.job_id || data?.job_id || event.id
        
        if (event.event_type === 'task_started') {
          const task = {
            id: event.id,
            jobId,
            goal: data?.goal || 'Task',
            role: data?.role || 'Agent',
            crewType: event.crew_type || 'default',
            startTime: event.timestamp,
            isCompleted: false,
            output: null,
            isCrewCompleted: false,
            agentProfile: data?.agent_profile
          }
          tasks.push(task)
          taskMap.set(jobId, task)
        } else if (event.event_type === 'task_completed') {
          if (taskMap.has(jobId)) {
            const task = taskMap.get(jobId)
            task.isCompleted = true
            
            // final_result 받자마자 바로 출력 (리포트 통합 전문가)
            if (task.role === '리포트 통합 전문가' && data?.final_result) {
              console.log('🔥 final_result 받자마자 출력:', data.final_result);
              console.log('🔥 final_result 타입:', typeof data.final_result);
              console.log('🔥 final_result 길이:', data.final_result?.length);
            }
            
            task.output = data?.final_result || null
          }
        }
      })
      
      // 각 crew_type별로 마지막 완료된 작업에 crew_completed 표시
      crewCompletedTypes.forEach(crewType => {
        const completedTasksOfType = tasks
          .filter(task => task.crewType === crewType && task.isCompleted)
          .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
        
        if (completedTasksOfType.length > 0) {
          completedTasksOfType[0].isCrewCompleted = true
        }
      })
      
      return tasks
    },
    toolUsageStatusByTask() {
      // jobId별로 [{tool_name, query, status: 'searching'|'done'}] 배열
      const started = {};
      const finished = {};
      this.events.forEach(e => {
        if (e.event_type === 'tool_usage_started') {
          const data = this.parseData(e);
          const jobId = e.job_id || data?.job_id || e.id;
          if (!started[jobId]) started[jobId] = [];
          started[jobId].push({ tool_name: data.tool_name, query: data.query });
        }
        if (e.event_type === 'tool_usage_finished') {
          const data = this.parseData(e);
          const jobId = e.job_id || data?.job_id || e.id;
          if (!finished[jobId]) finished[jobId] = [];
          finished[jobId].push({ tool_name: data.tool_name, query: data.query });
        }
      });
      
      
      // 매칭해서 상태 부여 (tool_name과 jobId만으로 매칭, query는 finished에서 null이 올 수 있음)
      const result = {};
      Object.keys(started).forEach(jobId => {
        result[jobId] = started[jobId].map(s => {
          const isDone = (finished[jobId] || []).some(f => f.tool_name === s.tool_name);
          return { ...s, status: isDone ? 'done' : 'searching' };
        });
      });
      
      return result;
    },
    isQueued() {
      return this.todoStatus &&
        (this.todoStatus.status === 'IN_PROGRESS' && this.todoStatus.agent_mode === 'DRAFT')
    },
  },
  methods: {
    getTaskIdFromWorkItem() {
      if (this.workItem && this.workItem.worklist) {
        return this.workItem.worklist.taskId
      }
      return null
    },

    parseData(event) {
      try {
        return typeof event.data === 'string' ? JSON.parse(event.data) : event.data
      } catch {
        return null
      }
    },

    formatTime(timestamp) {
      return new Date(timestamp).toLocaleString('ko-KR', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    },
    
    // 출력 타입 판별 메서드들
    isJsonOutput(crewType, output) {
      // 특정 crewType은 무조건 JSON
      if (crewType === 'text' || crewType === 'planning') {
        return true
      }
      
      // output 내용 분석해서 JSON인지 판별
      return this.detectJsonContent(output)
    },
    
    isSlideOutput(crewType, output) {
      // crew_type이 'slide'일 때만 슬라이드로 표시
      return crewType === 'slide'
    },

    // 문자열 정리 유틸리티
    cleanString(str) {
      return str.replace(/\\n/g, '\n').replace(/\\r/g, '').replace(/\\t/g, '  ').replace(/\\\\/g, '\\')
    },

    // JSON 내용 감지
    detectJsonContent(output) {
      if (!output) return false
      if (typeof output === 'object') return true
      
      if (typeof output === 'string') {
        const trimmed = output.trim()
        return ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
                (trimmed.startsWith('[') && trimmed.endsWith(']')))
      }
      return false
    },

    getOutputTypeLabel(crewType, output) {
      if (this.isJsonOutput(crewType, output)) {
        return crewType === 'planning' ? 'JSON 계획' 
             : crewType === 'text' ? 'JSON 데이터' 
             : 'JSON 객체'
      }
      
      return this.isSlideOutput(crewType, output) ? '프레젠테이션' : 'Markdown 문서'
    },

    // JSON 출력 포맷팅
    formatJsonOutput(output) {
      if (!output) return ''
      
      try {
        if (typeof output === 'object') {
          return JSON.stringify(output, null, 2)
        }
        
        if (typeof output === 'string') {
          const cleaned = this.cleanString(output)
          try {
            return JSON.stringify(JSON.parse(cleaned), null, 2)
          } catch {
            return cleaned
          }
        }
        
        return String(output)
      } catch {
        return String(output)
      }
    },

    // 마크다운 출력 포맷팅 - 코드블록 완전 제거
    sanitizeMarkdownOutput(output) {
      if (typeof output === 'string') {
        let trimmed = output.trim();
        // 여러 번 감싸진 경우도 반복적으로 제거
        let loopCount = 0;
        while (true) {
          const beforeTrim = trimmed;
          loopCount++;
          // ``` 또는 ~~~ 또는 """로 감싸진 코드블록 전체 제거 (언어명 포함 가능)
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

    // 슬라이드 관련 메서드들
    getSlides(output) {
      if (!output) return [];
      const sanitized = this.sanitizeMarkdownOutput(output);
      return String(sanitized)
        .split(/^---$/gm)
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
      // task_completed 이벤트가 실제로 존재하는지 확인
      return this.events.some(event => 
        event.event_type === 'task_completed' && 
        (event.job_id === task.jobId || event.id === task.id)
      )
    },

    submitTask(task) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(this.html, 'text/html');
      const fields = Array.from(doc.querySelectorAll('text-field, textarea-field, report-field, slide-field'))
        .map(field => ({
          name: field.getAttribute('name'),
          tag: field.tagName.toLowerCase()
        }))
        .filter(field => field.name);

      const formValues = {};

      // text 타입 output 파싱 함수 (재귀적 JSON 파싱 + key:value 파싱)
      function deepParseJson(str) {
        let result = str;
        let count = 0;
        while (typeof result === 'string' && count < 5) {
          try {
            const parsed = JSON.parse(result);
            if (typeof parsed === 'object' && parsed !== null) {
              result = parsed;
            } else {
              break;
            }
          } catch {
            break;
          }
          count++;
        }
        return result;
      }

      if (task.crewType === 'text') {
        let parsed = deepParseJson(task.output);
        if (typeof parsed === 'object' && parsed !== null) {
          // row-layout 요소 name으로 그룹핑 매핑
          const rowLayouts = Array.from(doc.querySelectorAll('row-layout[name]'));
          rowLayouts.forEach(rl => {
            const groupName = rl.getAttribute('name');
            const isMulti = rl.getAttribute('is_multidata_mode') === 'true';
            if (isMulti) {
              // 해당 그룹의 필드들 추출 후 단일 아이템 배열로 설정
              const fieldEls = Array.from(
                rl.querySelectorAll('text-field[name], textarea-field[name]')
              );
              const item = {};
              fieldEls.forEach(el => {
                const fname = el.getAttribute('name');
                item[fname] = parsed[fname] !== undefined ? parsed[fname] : '';
              });
              formValues[groupName] = [item];
            } else {
              // 단일 필드 매핑
              const fieldEls = Array.from(
                rl.querySelectorAll('text-field[name], textarea-field[name], select-field[name]')
              );
              fieldEls.forEach(el => {
                const fname = el.getAttribute('name');
                if (parsed[fname] !== undefined) {
                  formValues[fname] = parsed[fname];
                }
              });
            }
          });
        } else {
          parsed = {};
          const lines = String(task.output).split('\n');
          lines.forEach(line => {
            const match = line.match(/^([\w\-]+)\s*:\s*(.+)$/);
            if (match) {
              parsed[match[1]] = match[2];
            }
          });
          // 필드 매핑 (매칭된 경우에만 설정)
          fields.forEach(field => {
            if (parsed[field.name] !== undefined) {
              formValues[field.name] = parsed[field.name];
            }
          });
        }
      } else {
        // report/slide 그룹 값 매핑 (기존 값은 초기화하지 않음)
        fields.forEach(field => {
          if (
            (task.crewType === 'report' && field.tag === 'report-field') ||
            (task.crewType === 'slide' && field.tag === 'slide-field')
          ) {
            formValues[field.name] = task.output;
          }
        });
      }

      this.EventBus.emit('form-values-updated', formValues);
    },

    // Supabase 로직 (건드리지 않음)
    async loadData() {
      try {
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
          // 최초 로드 중 crew_completed 이벤트가 있으면 로딩 해제 및 채팅 활성화
          if (this.events.some(e => e.event_type === 'crew_completed')) {
            this.isCancelled = true;
            this.isFeedbackLoading = false;
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
              // 실시간 crew_completed 이벤트 처리: 채팅 활성화 및 로딩 해제
              if (row.event_type === 'crew_completed') {
                this.isCancelled = true;
                this.isFeedbackLoading = false;
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
      
      // 폰트 렌더링 문제 해결을 위해 다른 텍스트 사용
      return '작업완료'
    },
    async startTask() {
      const taskId = this.getTaskIdFromWorkItem();
      if (!taskId) {
        this.errorMessage = 'taskId를 찾을 수 없습니다.';
        return;
      }
      try {
        // agent_mode 와 status 필드를 업데이트
        await backend.putWorkItem(taskId, { agent_mode: 'DRAFT', status: 'IN_PROGRESS' });
        // 즉시 UI 반영을 위해 todoStatus 업데이트
        this.todoStatus = { ...this.todoStatus, agent_mode: 'DRAFT', status: 'IN_PROGRESS' };
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
          .select('status, agent_mode, draft_status')
          .eq('id', taskId)
          .single();
        if (error) {
          throw error;
        }
        this.todoStatus = data;
        if (data.draft_status === 'CANCELLED') {
          this.isCancelled = true;
        }
      } catch (e) {
        console.error('todolist 상태 조회 실패:', e);
        this.errorMessage = 'todolist 상태 조회 실패: ' + (e.message || e);
      }
    },
    // 작업 중단: draft_status를 CANCELLED로 변경하고 채팅 활성화
    async stopTask() {
      const taskId = this.getTaskIdFromWorkItem();
      if (!taskId) {
        this.errorMessage = 'taskId를 찾을 수 없습니다.';
        return;
      }
      try {
        await backend.putWorkItem(taskId, { draft_status: 'CANCELLED' });
        this.isCancelled = true;
      } catch (error) {
        console.error('중단 중 오류:', error);
        this.errorMessage = '중단 중 오류가 발생했습니다.';
      }
    },
    // 채팅 전송: feedback 필드에 저장하고 로컬에 메시지 추가
    async submitChat() {
      const taskId = this.getTaskIdFromWorkItem();
      if (!taskId) {
        this.errorMessage = 'taskId를 찾을 수 없습니다.';
        return;
      }
      if (!this.chatInput) return;
      // 채팅 전송 시 로딩 활성화 및 입력 비활성화
      this.isCancelled = false;
      this.isFeedbackLoading = true;
      try {
        await backend.putWorkItem(taskId, { feedback: this.chatInput, draft_status: 'FB_REQUESTED' });
        this.chatMessages.push({ content: this.chatInput });
        this.chatInput = '';
      } catch (error) {
        console.error('채팅 전송 중 오류:', error);
        this.errorMessage = '채팅 전송 중 오류가 발생했습니다.';
        this.isFeedbackLoading = false;
      }
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
  padding: 24px 16px;
  background: #fafbfc;
  min-height: auto;
  max-height: 70vh;
  overflow-y: auto;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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

.result-type-badge {
  display: flex;
  align-items: center;
}

.type-label {
  font-size: 11px;
  font-weight: 500;
  color: #606770;
  background: #e4e6ea;
  padding: 4px 8px;
  border-radius: 12px;
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
  background: linear-gradient(transparent, #1e1e1e);
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

/* 채팅 UI 스타일 */
.chat-container { margin-top: 20px; border-top: 1px solid #e1e8ed; padding-top: 16px; }
.chat-messages { max-height: 150px; overflow-y: auto; margin-bottom: 12px; }
.chat-message { display: flex; justify-content: flex-start; margin-bottom: 8px; }
.bubble { background: #e5e5ea; border-radius: 12px; padding: 8px 12px; max-width: 70%; }
.chat-input-wrapper { display: flex; align-items: center; gap: 8px; }
.stop-button { margin-left: auto; background: transparent; border: none; color: #f44336; cursor: pointer; }
input:disabled { opacity: 0.6; cursor: not-allowed; }

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
</style>