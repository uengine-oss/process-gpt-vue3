<template>
    <div ref="ganttContainer" style="width: 100%; height: 100%"></div>
  </template>
  
  <script>
  import { onMounted, ref, watch } from 'vue'
  import 'dhtmlx-gantt/codebase/dhtmlxgantt.css'
  import 'dhtmlx-gantt'
  
  export default {
    props: {
        tasks: {
            type: Array,
            required: true
        },
        users: {
            type: Array,
            required: true
        }
    },
    emits: ['task-updated', 'task-added'],
    setup(props, { emit }) {
      const ganttContainer = ref(null)
      const lastClickTime = ref(0)

      onMounted(() => {
            gantt.config.date_format = "%d-%m-%Y"
            
            // 한글 라벨 설정
            gantt.i18n = {
                ...gantt.i18n,
                ko: {
                    date: {
                        month_full: ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"],
                        month_short: ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"],
                        day_full: ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"],
                        day_short: ["일", "월", "화", "수", "목", "금", "토"]
                    },
                    labels: {
                        new_task: "새 업무",
                        icon_save: "저장",
                        icon_cancel: "취소",
                        icon_details: "상세",
                        icon_edit: "수정",
                        icon_delete: "삭제",
                        confirm_closing: "",
                        confirm_deleting: "업무를 삭제하시겠습니까?",
                        section_description: "설명",
                        section_time: "기간",
                        section_업무명: "업무명",
                        section_담당자: "담당자",
                        section_기간: "기간",

                        /* 링크 확인 */
                        link: "연결",
                        link_start: " (시작)",
                        link_end: " (종료)",
                        type_task: "업무",
                        
                        /* 날짜 관련 */
                        minutes: "분",
                        hours: "시간",
                        days: "일",
                        weeks: "주",
                        months: "월",
                        years: "년",

                        /* 버튼 텍스트 */
                        save: "저장",
                        cancel: "취소",
                        delete_task: "삭제",
                        confirm: "확인",

                        /* 라이트박스 삭제 버튼 */
                        buttons_left: ["dhx_delete_btn"],
                        buttons_right: ["dhx_save_btn", "dhx_cancel_btn"],
                        gantt_save_btn: "저장",
                        gantt_delete_btn: "삭제",
                        gantt_cancel_btn: "취소",

                        /* 새 업무 기본값 */
                        new_task_text: "새 업무"
                    }
                }
            };
            
            // 한글 적용
            gantt.locale = gantt.i18n.ko;
            
            // 그리드 컬럼 설정
            gantt.config.columns = [
                {name: "text", label: "업무명", tree: true, width: 200, resize: true},
                {name: "start_date", label: "시작일", align: "center", width: 80, resize: true},
                {name: "duration", label: "기간", align: "center", width: 60, resize: true},
                {
                    name: "assignees", 
                    label: "담당자", 
                    align: "center", 
                    width: 80,
                    resize: true,
                    template: function(task) {
                        if (task.assignees) {
                            const user = props.users.find(u => u.userId === task.assignees);
                            return user ? user.userName : task.assignees;
                        }
                        return "";
                    }
                },
                {name: "add", width: 40}
            ];
            
            // 자동 일정 조정 활성화
            gantt.config.auto_scheduling = true;
            gantt.config.auto_scheduling_strict = true;
            gantt.config.auto_scheduling_compatibility = true;
            
            // Critical Path 활성화
            gantt.config.highlight_critical_path = true;
            
            // 링크 제약조건 설정
            gantt.config.links = {
                "finish_to_start": "0",
                "start_to_start": "1",
                "finish_to_finish": "2",
                "start_to_finish": "3"
            };
            
            gantt.config.lightbox.sections = [
                { 
                    name: "업무명", 
                    height: 70, 
                    map_to: "text", 
                    type: "textarea", 
                    focus: true 
                },
                {
                    name: "담당자", // 담당자 필드
                    height: 40,
                    type: "select", 
                    map_to: "assignees",
                    options: props.users.map(user => ({
                        key: user.email,
                        label: user.email
                    })),
                    default_value: null
                },
                { 
                    name: "기간", 
                    type: "duration", 
                    map_to: "auto",
                    duration_unit: "day" 
                }
            ];
            gantt.templates.task_text = function(start, end, task) {
                let assigneeName = '';
                if (task.assignees) {
                    // users 배열에서 담당자 찾기
                    const user = props.users.find(u => u.userId === task.assignees);
                    assigneeName = user ? user.userName : task.assignees;
                }
                
                return `<div class="gantt-task-content">
                    <span class="task-text">${task.text}</span>
                    ${task.assignees ? `
                        <span class="task-assignee">
                            <i class="fas fa-user"></i> 
                            ${assigneeName}
                        </span>
                    ` : ''}
                </div>`;
            };
            // 작업 바 스타일 커스터마이징
            gantt.templates.task_class = function(start, end, task) {
                let classes = [];
                if (task.assignees) {
                    classes.push('has-assignee');
                }
                if (task.status) {
                    classes.push(`status-${task.status}`);
                }
                return classes.join(' ');
            };
            // 작업 바 오른쪽 끝에 담당자 아이콘 표시
            gantt.templates.rightside_text = function(start, end, task) {
                if (task.assignees) {
                    const user = props.users.find(u => u.userId === task.assignees);
                    return `<div class="task-assignee-icon">
                              <i class="fas fa-user-circle"></i>
                           </div>`;
                }
                return "";
            };
            // 작업 바 스타일 커스터마이징
            gantt.templates.task_cell_class = function(task, date) {
                return "";
            };

            // 작업 바 스타일 설정
            gantt.templates.grid_row_class = function(start, end, task) {
                return "";
            };

            // 작업 바 배경색 설정
            gantt.templates.task_background = function(start, end, task) {
                const colorSet = statusColors[task.status] || statusColors.default;
                return colorSet.background;
            };

            // 작업 진행률 바 스타일 설정
            gantt.templates.progress_text = function(start, end, task) {
                return "";  // 진행률 텍스트 숨김
            };

            gantt.templates.progress_class = function(start, end, task) {
                return `progress-${task.status ? task.status.toLowerCase() : 'default'}`;
            };

            ////////////////////////////////// EVENTS //////////////////////////////////
            // 라이트박스 저장 이벤트
            gantt.attachEvent("onLightboxSave", (id, task, is_new) => {
                if (!task.text) {
                    gantt.message({
                        type: "error",
                        text: "작업명을 입력해주세요"
                    });
                    return false;
                }

                const startDate = new Date(task.start_date);
                const endDate = new Date(task.end_date);
                
                if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                    gantt.message({
                        type: "error",
                        text: "유효한 날짜를 입력해주세요"
                    });
                    return false;
                }

                // 새로운 작업인 경우에만 task-added 이벤트 발생
                if (is_new) {
                    const taskId = uuid();
                    task.id = taskId; // 새로운 ID 할당
                    
                    emit('task-added', {
                        id: taskId,
                        taskId: taskId,
                        text: task.text,
                        startDate: formatDateForBackend(task.start_date),
                        endDate: formatDateForBackend(task.end_date),
                        duration: task.duration,
                        progress: task.progress || 0,
                        parent: task.parent || null,
                        assignees: task.assignees || [],
                        status: 'TODO',
                        adhoc: true
                    });
                }

                return true;
            });

            // 작업 추가 전 이벤트
            gantt.attachEvent("onBeforeTaskAdd", (id, item) => {
                return true; // 기본 작업 추가 허용
            });

            // 라이트박스 취소 시 임시 작업 삭제
            gantt.attachEvent("onLightboxCancel", (id) => {
                if (gantt.isTaskExists(id)) {
                    const task = gantt.getTask(id);
                    if (!task.text || task.text === "새 작업") {
                        gantt.deleteTask(id);
                    }
                }
            });

            gantt.attachEvent("onTaskClick", (id, e) => {
                const currentTime = new Date().getTime();
                if (currentTime - lastClickTime.value < 300) {
                    // 더블 클릭은 무시 (라이트박스가 열림)
                    return true;
                }
                lastClickTime.value = currentTime;
                emit('task-clicked', { id });
                return true;
            });

            // 드래그 이벤트 리스너 추가
            gantt.attachEvent("onAfterTaskDrag", (id, mode) => {
                const task = gantt.getTask(id)

                // 부모 컴포넌트에 업데이트된 태스크 전달
                emit('task-updated',  {
                    id: task.id,
                    text: task.text,
                    startDate: formatDateForBackend(task.start_date),
                    dueDate: formatDateForBackend(task.end_date),
                    duration: task.duration,
                    progress: task.progress,
                    parent: task.parent
                })
            })

            // 크기 조절 이벤트 리스너 추가
            gantt.attachEvent("onTaskDrag", (id, mode, task, original) => {
                if (mode == gantt.config.drag_mode.resize) {
                    // 리사이즈 중일 때의 처리
                    return true
                }
                return true
            })

            gantt.init(ganttContainer.value)
            loadGanttData()
        })
  
        // 백엔드로 보낼 날짜 포맷 함수
        function formatDateForBackend(date) {
            if(!date) return
            const d = new Date(date);
            // 로컬 시간대의 년월일시분초 가져오기
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            
            // ISO 형식으로 반환 (시간은 00:00:00으로 고정)
            return `${year}-${month}-${day}T00:00:00.000Z`;
        }

        function formatGanttDate(date) {
            if(!date) return null;
            const d = new Date(date)
            const day = String(d.getDate()).padStart(2, '0')
            const month = String(d.getMonth() + 1).padStart(2, '0')
            const year = d.getFullYear()
            
            return `${day}-${month}-${year}`
        }

        const createLinksFromReferences = (tasks) => {
            let linkId = 1;
            const links = [];
            
            tasks.filter(task => !task.adhoc).forEach(task => {
                if (task.reference_ids && task.reference_ids.length > 0) {
                    // reference_ids 배열의 각 참조 ID에 대해 링크 생성
                    task.reference_ids.forEach(refId => {
                        // 참조된 작업 찾기
                        const sourceTask = tasks.find(t => t.activity_id === refId);
                        if (sourceTask) {
                            links.push({
                                id: linkId++,
                                source: sourceTask.id, // 참조된 작업의 ID
                                target: task.id,       // 현재 작업의 ID
                                type: "0"              // 기본 링크 타입 (Finish to Start)
                            });
                        }
                    });
                }
            });
            
            return links;
        };

        const uuid = () => {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }

        const loadGanttData = () => {
            gantt.clearAll()

            const formattedTasks = props.tasks.map(task => ({
                id: task.id,
                text: task.text,
                start_date: formatGanttDate(task.startDate),
                end_date: formatGanttDate(task.dueDate),
                    duration: task.duration || 5,
                    progress: task.progress || 0,
                    parent: task.parent || null,
                status: task.status,
                assignees: task.assignees,
                activity_id: task.activity_id,
                reference_ids: task.reference_ids
            }));
            
            const formattedData = {
                data: formattedTasks,
                links: createLinksFromReferences(props.tasks)
            }
            gantt.parse(formattedData)
        }

        watch(() => props.tasks, () => {
            loadGanttData()
        }, { deep: true })


  
      return {
            ganttContainer,
            // getTaskStyle,
            // getProgressStyle
      }
    }
  }
  </script>
  
  <style>
  .gantt-container {
    height: 500px;
    width: 100%;
  }
  .gantt-task-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    height: 100%;
    padding: 0 5px;
}

.task-text {
    flex-grow: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.task-assignee {
    margin-left: 10px;
    font-size: 0.9em;
    display: flex;
    align-items: center;
}

.task-assignee i {
    margin-right: 4px;
    font-size: 12px;
}

.task-assignee-icon {
    position: absolute;
    right: -20px;
    top: 50%;
    transform: translateY(-50%);
    background: white;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.task-assignee-icon i {
    font-size: 16px;
    color: #666;
}

/* 담당자가 있는 작업 바 스타일 */
.gantt_task_line.has-assignee {
    border-radius: 20px;
}

/* 작업 진행률 바 스타일 */
.has-assignee .gantt_task_progress {
    border-radius: 20px 0 0 20px;
}
/* 줌 컨트롤 스타일링 */
.gantt_zoom_bar {
    padding: 10px;
    background-color: #f5f5f5;
    border-top: 1px solid #cecece;
}

.gantt_zoom_bar button {
    margin: 0 5px;
    padding: 5px 10px;
    border: 1px solid #cecece;
    border-radius: 4px;
    background: white;
    cursor: pointer;
}

.gantt_zoom_bar button:hover {
    background: #e6e6e6;
}

.gantt_zoom_bar button.active {
    background: #4a90e2;
    color: white;
    border-color: #357abd;
}
/* 상태별 스타일 */
.status-todo .gantt_task_progress {
    background-color: #1976D2;
}

.status-IN_PROGRESS .gantt_task_progress {
    background-color: #388E3C;
}

.status-DONE .gantt_task_progress {
    background-color: #FFA000;
}

.status-TODO .gantt_task_content {
    color: #FFFFFF;
}

.status-IN_PROGRESS .gantt_task_content {
    color: #FFFFFF;
}

.status-done .gantt_task_content {
    color: #000000;
}

/* 작업 바 스타일 */
.gantt_task_line {
    border-radius: 4px;
}

.gantt_task_progress {
    border-radius: 4px 0 0 4px;
}

/* 상태별 작업 바 스타일 */
.gantt_task_line {
    border-radius: 20px !important;
    border: none !important;
}

.gantt_task_progress {
    border-radius: 20px 0 0 20px !important;
}

/* DONE 상태 */
.status-DONE .gantt_task_progress {
    background-color: #2E7D32 !important;
}
.status-DONE.gantt_task_line {
    background-color: #4CAF50 !important;
}

/* IN_PROGRESS 상태 */
.status-IN_PROGRESS .gantt_task_progress {
    background-color: #1565C0 !important;
}
.status-IN_PROGRESS.gantt_task_line {
    background-color: #2196F3 !important;
}

/* TODO 상태 */
.status-TODO .gantt_task_progress {
    background-color: #F57C00 !important;
}
.status-TODO.gantt_task_line {
    background-color: #FFA726 !important;
}

/* PENDING 상태 */
.status-PENDING .gantt_task_progress {
    background-color: #C62828 !important;
}
.status-PENDING.gantt_task_line {
    background-color: #F44336 !important;
}

/* 기본 상태 */
.gantt_task_line:not(.status-DONE):not(.status-IN_PROGRESS):not(.status-TODO):not(.status-PENDING) {
    background-color: #9E9E9E !important;
}
.gantt_task_line:not(.status-DONE):not(.status-IN_PROGRESS):not(.status-TODO):not(.status-PENDING) .gantt_task_progress {
    background-color: #616161 !important;
}

/* 작업 텍스트 스타일 */
.gantt_task_content {
    color: #FFFFFF !important;
    font-weight: 500;
  }
  </style>