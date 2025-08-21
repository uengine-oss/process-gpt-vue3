<template>
    <div ref="ganttContainer" style="width: 100%; height: 100%"></div>
  </template>
  
  <script>
  import { onMounted, ref, watch, onUnmounted } from 'vue'
  import 'dhtmlx-gantt/codebase/dhtmlxgantt.css'
  import 'dhtmlx-gantt'

  export default {
    props: {
        tasks: {
            type: Array,
            required: true
        },
        dependencies: {
            type: Array,
            required: true
        },
        users: {
            type: Array,
            required: true
        }
    },
    emits: ['task-updated', 'task-added', 'link-event'],
    setup(props, { emit }) {
        const ganttContainer = ref(null)
        const lastClickTime = ref(0)
        const originalTaskData = ref(null) // 원본 태스크 데이터 저장용
        
        const loadGanttData = () => {

            // 1. 현재 열린 트리 상태 저장
            const openedTasks = [];
            gantt.eachTask(function(task){
                if (task.$open) {
                    openedTasks.push(task.id);
                }
            });
        
            gantt.clearAll()

            const formattedTasks = props.tasks.map(task => ({
                ...task,
                id: task.taskId || task.instId,
                text: task.name || task.title,
                origin_end_date: task.endDate,
                start_date: formatGanttDate(task.startDate),
                end_date: formatGanttDate(task.dueDate, true), // 의존성은 납기일정(듀데이트)과 연결
            }));
            

            formattedTasks.sort((a, b) => {
                return new Date(a.startDate)- new Date(b.startDate);
            });
            const formattedData = {
                data: formattedTasks,
                links: createLinksFromReferences(props.dependencies)
            }
            gantt.parse(formattedData)

            // 2. 트리 상태 복원
            openedTasks.forEach(id => {
                gantt.open(id);
            });
        }

        onMounted(() => {
            gantt.config.date_format = "%Y-%m-%d"
            
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
            
            gantt.config.scales = [
                { unit: "month", step: 1, format: date => `${date.getMonth() + 1}월` }, // 5월
                { unit: "day", step: 1, format: date => `${date.getDate()}일` }     // 21일, 22일, ...
            ];

            // 그리드 컬럼 설정
            gantt.config.columns = [
                {name: "name", label: "업무명", tree: true, width: 200, resize: true},
                {name: "start_date", label: "시작일", align: "center", width: 100, resize: true},
                {   
                    name: "end_date", 
                    label: "만료일", 
                    align: "center", 
                    width: 100, 
                    resize: true,
                    template: function(task) {
                        if (!task.end_date) return "";
                        const date = new Date(task.end_date);
                        date.setDate(date.getDate());
                        return date.toISOString().split('T')[0];
                    }
                },
                { name: "duration", label: "기간", align: "center", width: 60, resize: true},
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
                    map_to: "name", 
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
                    <span class="task-text">${task.name}</span>
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
                if (!task.name) {
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

                // 새로운 작업인 경우
                if (is_new) {
                    try {
                        // 부모 컴포넌트에 이벤트 발생
                        emit('task-added', {
                            name: task.name,
                            startDate: dateToTimestamp(task.start_date),
                            dueDate: dateToTimestamp(task.end_date, true),
                            endDate: null,
                            duration: task.duration || 1,
                            progress: 0,
                            parent: task.parent || 0,
                            assignees: task.assignees || [],
                            status: 'NEW',
                            adhoc: true
                        });
                        //새 작업 추가
                        gantt.addTask(task); 
                        // 라이트박스 수동으로 닫기
                        gantt.hideLightbox();
                        // 차트 다시 그리기
                        gantt.render();
                        return false; // 기본 저장 동작 방지
                    } catch (error) {
                        console.error('작업 추가 중 오류 발생:', error);
                        gantt.message({
                            type: "error",
                            text: "작업 추가 중 오류가 발생했습니다"
                        });
                        return false;
                    }
                } else {
                    // update
                    emit('task-updated', task)
                }

                return true;
            });


            // 라이트박스가 열릴 때 이벤트
            gantt.attachEvent("onLightbox", (taskId) => {
                const task = gantt.getTask(taskId);
                if (!task.type) {
                    task.type = "task";
                }
                return true;
            });

            // 라이트박스가 닫힐 때 이벤트
            gantt.attachEvent("onAfterLightbox", () => {
                gantt.render();
                return true;
            });

             // 트리 확장(펼침) 이벤트
            gantt.attachEvent("onTaskOpened", function(id) {
                emit('task-tree-opened', id);
            });

            // 태스크 클릭
            gantt.attachEvent("onTaskClick", (id, e) => {
                emit('task-clicked', gantt.getTask(id));
                return true;
            });
            gantt.attachEvent("onTaskDblClick", function(id,e){
                //any custom logic here
                return false;
            });

            gantt.attachEvent("onLinkClick", (id, e) => {
                let link = gantt.getLink(id)
                let source = gantt.getTask(link.source)
                let target = gantt.getTask(link.target)
                emit('link-clicked', link, source, target);
                return true;
            });
            gantt.attachEvent("onLinkDblClick", function(id,e){
                //any custom logic here
                return false;
            });


            ////////////////////////// TaskDrag 기간 이동 //////////////////////////
            gantt.attachEvent("onBeforeTaskDrag", function(id, mode, event){
                let task = gantt.getTask(id);
                task.startDate = dateToTimestamp(task.start_date);
                task.dueDate = dateToTimestamp(task.end_date, true);
                task.endDate = dateToTimestamp(task.origin_end_date, true);

                // 드래그 시작 시 원본 데이터 저장
                originalTaskData.value = JSON.parse(JSON.stringify(task));
                
                // 조건 검사 함수
                const validateDrag = () => {
                    let incommingLinks = task.$target
                    let outgoingLinks = task.$source

                    // 조건 검사 로직
                if(incommingLinks && incommingLinks.length > 0) {
                        for(let linkId of incommingLinks) {
                            let link = gantt.getLink(linkId)
                        let source = gantt.getTask(link.source)
                        let target = gantt.getTask(link.target)

                            return validateTaskConstraint(source, target);
                        } 
                }

                if(outgoingLinks && outgoingLinks.length > 0) {
                        for(let linkId of outgoingLinks) {
                            let link = gantt.getLink(linkId)
                        let source = gantt.getTask(link.source)
                        let target = gantt.getTask(link.target)

                            return validateTaskConstraint(source, target);
                        }
                    }
                    return true;
                };

                if(mode == 'resize' || mode == 'move') {
                    // 조건 검사
                    if (!validateDrag()) {
                        return false;
                    }
                }

                return true;
            });

            gantt.attachEvent("onAfterTaskDrag", (id, mode) => {
                if(mode == 'resize' || mode == 'move') {
                    let task = gantt.getTask(id)
                    let incommingLinks = task.$target
                    let outgoingLinks = task.$source

                    task.startDate = dateToTimestamp(task.start_date);
                    task.dueDate = dateToTimestamp(task.end_date, true);
                    task.endDate = dateToTimestamp(task.origin_end_date, true);

                    // 최종 검증
                    let isValid = true;
                    if(incommingLinks && incommingLinks.length > 0) {
                        for(let linkId of incommingLinks) {
                            let link = gantt.getLink(linkId)
                            let source = gantt.getTask(link.source)
                            let target = gantt.getTask(link.target)

                            if(!validateTaskConstraint(source, target)){
                                isValid = false;
                                break;
                            }
                        }
                    }

                    if(isValid && outgoingLinks && outgoingLinks.length > 0) {
                        for(let linkId of outgoingLinks) {
                            let link = gantt.getLink(linkId)
                            let source = gantt.getTask(link.source)
                            let target = gantt.getTask(link.target)

                            if(!validateTaskConstraint(source, target)){
                                isValid = false;
                                break;
                            }
                        }
                    }

                    if (isValid) {
                    // 부모 컴포넌트에 업데이트된 태스크 전달
                    emit('task-updated', task)
                    } else {
                        // 조건에 맞지 않으면 원상복구
                        if (originalTaskData.value && originalTaskData.value.id == id) {
                            // 개별 속성을 복원
                            task.start_date = originalTaskData.value.start_date;
                            task.end_date = originalTaskData.value.end_date;
                            task.startDate = originalTaskData.value.startDate;
                            task.dueDate = originalTaskData.value.dueDate;
                            task.endDate = originalTaskData.value.endDate;
                            
                            // gantt 업데이트
                            gantt.refreshTask(id);
                            gantt.render();
                        }
                    }
                    originalTaskData.value = null;
                } 
            })

            ////////////////////////// 선연결 이전 이벤트 처리 //////////////////////////
            gantt.attachEvent("onBeforeLinkAdd", function(id, link) {
                // 상위 컴포넌트에 이벤트 발생
                let source = gantt.getTask(link.source)
                let target = gantt.getTask(link.target)

                if(target.status == 'DONE') {
                    emit('message', {
                        color: "error",
                        text: `"${target.name}"태스크는 완료된 태스크입니다.`
                    });
                    return false;
                }
                return validateTaskConstraint(source, target);
            });
            gantt.attachEvent("onAfterLinkAdd", function(id, link) {
                const typeMap = {
                    "FS": "0", // Finish to Start (기본)
                    "FF": "2", // Finish to Finish
                    "SF": "3", // Start to Finishaa
                    "SS": "1"  // Start to Start
                };

                let copyLink = JSON.parse(JSON.stringify(link));
                copyLink.type = Object.keys(typeMap).find(key => typeMap[key] == link.type);
                
                emit('link-event', {type: 'add', link: copyLink});
                return true;
            });
            // 선 삭제 이전 이벤트 처리
            gantt.attachEvent("onBeforeLinkDelete", function(id, link) {
                // BPM태스크간 선 삭제 제한 
                let source = gantt.getTask(link.source)
                let target = gantt.getTask(link.target)

                if(!source.adhoc && !target.adhoc) {
                    emit('message', {
                            color: "error",
                            text: `태스크[BPM] 선은 삭제 할 수 없습니다.`
                        });
                        return false;
                }

                return true;
            });
            // 선 삭제 이후 이벤트 처리
            gantt.attachEvent("onAfterLinkDelete", function(id, link) {
                // link: { id, source, target, type }
                // 여기서 원하는 동작 수행 (예: 부모 컴포넌트로 emit)
                emit('link-event', {type: 'delete', link: link});
                return true;
            });
            ///////////////////////////////////////////////////////////////////////////////
            gantt.init(ganttContainer.value)
            loadGanttData()
        })
  
        function validateTaskConstraint(source, target){
            // BPM <> BPM X
            if(!source.adhoc && !target.adhoc) {
                emit('message', {
                    color: "error",
                    text: "태스크[BPM]간 선 연결은 할 수 없습니다."
                });
                return false;
            } 
            // BPM > ADHOC 0 / BPM 이후 날짜
            else if(!source.adhoc && target.adhoc) {
                if(source.start_date > target.start_date) {
                    emit('message', {
                        color: "error",
                        text: `"${source.name}"태스크[BPM]는 이전 태스크 업무에 연결 할 수 없습니다.`
                    });
                    return false;
                } 
            }
            // ADHOC > BPM 0 / BPM 이전 날짜
            else if(source.adhoc && !target.adhoc) {
                if(source.end_date <= target.start_date) {
                    emit('message', {
                        color: "error",
                        text: `"${source.name}"태스크의 시작일은 "${target.name}"태스크[BPM] 만기일 이후여야 합니다.`
                    });
                    return false;
                }
            }

            // 나머지 가능 
            return true;
        }
       
        function formatGanttDate(date, isEndDate) {
            if (!date) return;
            let year, month, day;
            if (typeof date === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(date)) {
                const [d, m, y] = date.split('-');
                year = y;
                month = m.padStart(2, '0');
                day = d.padStart(2, '0');
            } else {
                // 여기서 "2025-04-29T00:00:00" 같은 문자열도 Date로 파싱됨
                const d = new Date(date);
                year = d.getFullYear();
                month = String(d.getMonth() + 1).padStart(2, '0');
                day = String(d.getDate()).padStart(2, '0');
            }

            // isEndDate면 하루를 더해서 00:00:00으로 반환
            if (isEndDate) {
                const end = new Date(`${year}-${month}-${day}`);
                end.setUTCDate(end.getUTCDate() + 1);
                return end.toISOString().split('T')[0];
            }

            // 여기서 "YYYY-MM-DD"만 리턴
            return `${year}-${month}-${day}`;
        }

        function dateToTimestamp(date, isEnd) {
            if(!date) return null;
            const d = new Date(date);

            // pad 함수
            const pad = (n, z = 2) => ('00' + n).slice(-z);
            if(isEnd) {
                d.setUTCDate(d.getUTCDate() - 1); // 하루 빼기
                d.setHours(23, 59, 59, 0); // 23:59:59로 세팅
            }
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T` +
                `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
        }

        const createLinksFromReferences = (dependencies) => {
            const links = [];
            if(!dependencies) return links;
            const typeMap = {
                "FS": "0", // Finish to Start (기본)
                "FF": "2", // Finish to Finish
                "SF": "3", // Start to Finish
                "SS": "1"  // Start to Start
            };
          
            dependencies.forEach(dependeny => {
                if (dependeny) {
                    links.push({
                        id: dependeny.id,
                        source: dependeny.dependsId, // 참조된 작업의 ID
                        target: dependeny.taskId,       // 현재 작업의 ID
                        type: typeMap[dependeny.type] || "0"              // 기본 링크 타입 (Finish to Start)
                    });
                }
            });
            
            return links;
        };


        // 태스크 삭제 메서드
        function deleteTaskById(taskId) {
            gantt.deleteTask(taskId);
        }

        watch(() => props.tasks, () => {
            loadGanttData();
        }, { deep: true })

        onUnmounted(() => {
            if (gantt) {
                gantt.clearAll();
                gantt.detachAllEvents && gantt.detachAllEvents();
            }
        });




  
      return {
            ganttContainer,
            deleteTaskById,
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

.status-NEW .gantt_task_content {
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

/* NEW 상태 */
.status-NEW .gantt_task_progress {
    background-color: #616161 !important;
}
.status-NEW.gantt_task_line {
    background-color: #9E9E9E !important;
}

/* PENDING 상태 */
.status-PENDING .gantt_task_progress {
    background-color: #C62828 !important;
}
.status-PENDING.gantt_task_line {
    background-color: #F44336 !important;
}

/* 기본 상태 */
.gantt_task_line:not(.status-DONE):not(.status-IN_PROGRESS):not(.status-NEW):not(.status-PENDING) {
    background-color: #9E9E9E !important;
}
.gantt_task_line:not(.status-DONE):not(.status-IN_PROGRESS):not(.status-NEW):not(.status-PENDING) .gantt_task_progress {
    background-color: #616161 !important;
}

/* 작업 텍스트 스타일 */
.gantt_task_content {
    color: #FFFFFF !important;
    font-weight: 500;
  }
.gantt_message {
    z-index: 10000 !important;
    position: fixed !important;
    top: 50px !important;
    right: 20px !important;
}
</style>