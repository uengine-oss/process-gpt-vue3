<template>

  <v-card elevation="10">
      <AppBaseCard>
          <template v-slot:leftpart>
              <Chat :name="$t(chatInfo.title)"
                  :messages="messages"
                  :chatInfo="chatInfo"
                  :userInfo="userInfo" 
                  :disableChat="disableChat"
                  @sendMessage="beforeSendMessage"
                  @sendEditedMessage="sendEditedMessage"
                  @stopMessage="stopMessage"
              ></Chat>
          </template>

          <template v-slot:rightpart>
            <div class="pa-3 mb-4 d-flex flex-wrap gap-2 justify-end">
                <v-tooltip bottom>
                    <template v-slot:activator="{ props }">
                        <v-btn color="primary" size="30" elevation="2" v-bind="props" @click="addDialog = true">
                            <v-icon size="small">mdi-plus</v-icon>
                        </v-btn>
                    </template>
                    <span>전략 추가</span>
                </v-tooltip>
                <v-tooltip bottom>
                    <template v-slot:activator="{ props }">
                        <v-btn size="30" elevation="2" v-bind="props" @click="editDialog = true">
                            <v-icon size="small">mdi-pencil</v-icon>
                        </v-btn>
                    </template>
                    <span>전략 수정</span>
                </v-tooltip>
                <v-tooltip bottom>
                    <template v-slot:activator="{ props }">
                        <v-btn size="30" elevation="2" v-bind="props" @click="deleteDialog = true">
                            <v-icon size="small">mdi-delete</v-icon>
                        </v-btn>
                    </template>
                    <span>전략 삭제</span>
                </v-tooltip>
                <v-tooltip bottom>
                    <template v-slot:activator="{ props }">
                        <v-btn size="30" elevation="2" v-bind="props" @click="connectionDialog = true">
                            <v-icon size="small">mdi-link</v-icon>
                        </v-btn>
                    </template>
                    <span>연결 추가</span>
                </v-tooltip>
                <!-- <v-btn @click="onZoomIn">확대</v-btn>
              <v-btn @click="onZoomOut">축소</v-btn>
              <v-btn @click="onResetView">초기화</v-btn> -->
            </div>
            <div class="d-flex flex-wrap gap-2" style="width: 100%; height: 100%;">
              <div ref="container" class="strategy-map-container" style="width: 100%; height: 100%;"></div>
            </div>
          </template>

          <template v-slot:mobileLeftContent>
              <Chat :name="$t(chatInfo.title)"
                  :messages="messages"
                  :chatInfo="chatInfo"
                  :userInfo="userInfo" 
                  :disableChat="disableChat"
                  @sendMessage="beforeSendMessage"
                  @sendEditedMessage="sendEditedMessage"
                  @stopMessage="stopMessage"
              ></Chat>
          </template>
      </AppBaseCard>
  </v-card>

  
  <v-dialog v-model="deleteDialog" max-width="400">
    <v-card>
      <v-card-title class="text-h6">전략 삭제</v-card-title>
      <v-card-text>
        <v-select
          v-model="selectedStrategy"
          :items="strategyOptions"
          item-title="name"
          item-value="id"
          label="삭제할 전략을 선택하세요"
          variant="outlined"
          return-object
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn @click="deleteDialog = false" variant="text">취소</v-btn>
        <v-btn @click="confirmDeleteStrategy" color="red" variant="flat" :disabled="!selectedStrategy">
          삭제
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog v-model="addDialog" max-width="500">
    <v-card>
      <v-card-title class="text-h6 text-center">전략 추가</v-card-title>

      <v-card-text>
        <v-text-field
          v-model="strategyForm.name"
          label="전략명:"
          variant="outlined"
          dense
          required
        />

        <v-select
          v-model="strategyForm.perspective"
          :items="lanes"
          label="관점:"
          variant="outlined"
          dense
          required
        />

        <v-textarea
          v-model="strategyForm.description"
          label="설명:"
          variant="outlined"
          auto-grow
          rows="2"
          max-rows="4"
        />
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn @click="addDialog = false" variant="outlined" color="grey">취소</v-btn>
        <v-btn @click="saveStrategy" variant="flat" color="primary" :disabled="!strategyForm.name || !strategyForm.perspective">저장</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog v-model="editDialog" max-width="500">
  <v-card>
    <v-card-title class="text-h6 text-center">전략 수정</v-card-title>

    <v-card-text>
      <v-select
        v-model="selectedStrategy"
        :items="strategyOptions"
        item-title="name"
        item-value="id"
        label="수정할 전략을 선택하세요"
        variant="outlined"
        return-object
      />
      <v-text-field
        v-model="editForm.name"
        label="전략명:"
        variant="outlined"
        dense
      />

      <v-textarea
        v-model="editForm.description"
        label="설명:"
        variant="outlined"
        auto-grow
        rows="2"
        max-rows="4"
      />
    </v-card-text>

    <v-card-actions>
      <v-spacer />
      <v-btn @click="editDialog = false" variant="outlined" color="grey">취소</v-btn>
      <v-btn @click="saveEditedStrategy" variant="flat" color="primary">저장</v-btn>
    </v-card-actions>
  </v-card>
</v-dialog>
<v-dialog v-model="connectionDialog" max-width="500">
  <v-card>
    <v-card-title class="text-h6 text-center">전략 연결 추가</v-card-title>

    <v-card-text>
      <v-select
        v-model="selectedConnectionSource"
        :items="strategyOptions"
        item-title="name"
        item-value="id"
        label="출발 전략"
        variant="outlined"
        return-object
        class="mb-3"
      />

      <v-select
        v-model="selectedConnectionTarget"
        :items="strategyOptions"
        item-title="name"
        item-value="id"
        label="도착 전략"
        variant="outlined"
        return-object
      />
    </v-card-text>

    <v-card-actions>
      <v-spacer />
      <v-btn @click="connectionDialog = false" variant="outlined" color="grey">취소</v-btn>
      <v-btn
        @click="confirmAddConnection"
        variant="flat"
        color="primary"
        :disabled="!selectedConnectionSource || !selectedConnectionTarget || selectedConnectionSource.id === selectedConnectionTarget.id"
      >
        연결 추가
      </v-btn>
    </v-card-actions>
  </v-card>
</v-dialog>


</template>
  
  <script>
  import Diagram from 'diagram-js';
  import 'diagram-js/assets/diagram-js.css';
  import ChatGenerator from '@/components/ai/BSGenerator.js';
  import modelingModule from 'diagram-js/lib/features/modeling';
  import CustomRenderer from '@/components/diagram/CustomRenderer';
  import CustomMoveRules from '@/components/diagram/CustomMoveRules';
  import connectModule from 'diagram-js/lib/features/connect';
  import ChatModule from "@/components/ChatModule.vue";
  import AppBaseCard from '@/components/shared/AppBaseCard.vue';
  import Chat from "@/components/ui/Chat.vue";
  import ZoomScroll from '@/components/customZoomScroll';
  import BpmnModeler from 'bpmn-js/lib/Modeler';
  import BackendFactory from '@/components/api/BackendFactory';

  const backend = BackendFactory.createBackend();
  
  export default {
    name: 'StrategyMap',
    mixins: [ChatModule],
    components: {
      AppBaseCard,
      ChatModule,
      Chat
    },
    computed: {
      strategyOptions() {
        return this.jsonData.strategies.map(strategy => ({
          id: strategy.id,
          name: strategy.name
        }));
      }
    },
    data() {
      return {
        diagram: null,
        elements: [],
        elementId: 1,
        chatInfo: {
            title: "BSCard.cardTitle",
            text: "BSCard.description"
        },
        lanes: ['재무', '고객', '내부 프로세스', '학습 및 성장'] ,
        jsonData: {
          strategies: [
            {
              "id": "s1",
              "name": "매출 20% 성장",
              "description": "전년도 대비 전체 매출을 20% 성장시키는 것이 목표",
              "perspective": "재무",
              "parents": []
            },
            {
              "id": "s2",
              "name": "고객 만족도 90점 이상 달성",
              "description": "NPS 기준 고객 만족도를 90점 이상으로 유지",
              "perspective": "고객",
              "parents": ["s1"]
            },
            {
              "id": "s3",
              "name": "프로세스 자동화율 50% 달성",
              "description": "내부 업무 프로세스 중 50% 이상을 자동화 시스템으로 전환",
              "perspective": "내부 프로세스",
              "parents": ["s2"]
            },
            {
              "id": "s4",
              "name": "직원 역량 강화 프로그램 운영",
              "description": "전 직원 대상 연 2회 이상 역량 강화 교육 진행",
              "perspective": "학습 및 성장",
              "parents": ["s3"]
            }
          ],
        },
        defaultStrategyWidth: 140,
        defaultStrategyHeight: 70,
        strategyScale: 1,
        maxStrategyScale: 2,
        minStrategyScale: 0.5,
        deleteDialog: false,
        selectedStrategy: null,
        addDialog: false,
        strategyForm: {
          name: '',
          perspective: '',
          description: ''
        },
        editDialog: false,
        editForm: {
          id: null,
          name: '',
          description: ''
        },
        connectionDialog: false,
        selectedConnectionSource: null,
        selectedConnectionTarget: null,
        newMessage: null,
        userList: [],
        agentList: [],
      };
    },
    watch: {
      // strategyScale: {
      //   handler(newVal) {
      //     this.init();
      //   },
      //   immediate: true
      // }
    },
    mounted() {
      this.generator = new ChatGenerator(this, {
          isStream: true,
          preferredLanguage: "Korean"
      });
      this.init();
      this.initData();
    },
    methods: {
      init() {
        this.initDiagram();
        
        this.$nextTick(() => {
          const elementFactory = this.diagram.get('elementFactory');
          const root = elementFactory.createRoot({ id: 'root' });
          const eventBus = this.diagram.get('eventBus');
          const canvas = this.diagram.get('canvas');
          
          const lanes = [
            { name: '재무 관점', perspective: '재무' },
            { name: '고객 관점', perspective: '고객' },
            { name: '내부 프로세스', perspective: '내부 프로세스' },
            { name: '학습 및 성장', perspective: '학습 및 성장' }
          ];

          lanes.forEach((lane, index) => {
            this.addStrategyLane(lane.name, lane.perspective, index, lanes.length);
          });
        });
      },
      async initData() {
        const card = await backend.getBSCard();
        if (card) {
          this.jsonData = card.value;
          this.initializeFromData(this.jsonData);
        }
      },
      initDiagram() {
        if (this.diagram)  {
          const canvas = this.diagram.get('canvas');

          this.diagram.destroy();
        }
        const container = this.$refs.container;
        this.diagram = new BpmnModeler({
          container: container,
          modules: [
            modelingModule,
            connectModule,
            {
              __init__: ['customRenderer'],
              customRenderer: ['type', CustomRenderer]
            },
            CustomMoveRules,
            ZoomScroll,
          ]
        });
      },
      initializeFromData(jsonData) {
        try {
          this.resetCanvas();
          console.log(jsonData);
          if (!jsonData || !jsonData.strategies) return;

          jsonData.strategies.forEach((strategy, index) => {
            this.addStrategy(strategy.name, strategy.perspective, strategy.id);
            if(strategy.parents) {
              strategy.parents.forEach(parent => {
                this.addConnection(parent, strategy.id);
              });
            }
          });
        } catch (error) {
          
        }
      },
      addStrategy(name, perspective, id = null) {
        const elementFactory = this.diagram.get('elementFactory');
        const canvas = this.diagram.get('canvas');

        const totalHeight = canvas._container.clientHeight;
        const laneCount = 4;
        const laneHeight = totalHeight / laneCount;

        const perspectiveIndex = this.lanes.indexOf(perspective);

        const strategiesInLane = this.jsonData.strategies.filter(s => s.perspective === perspective);

        const indexInLane = strategiesInLane.findIndex(s => s.id === id || s.name === name);
        const safeIndex = indexInLane >= 0 ? indexInLane : strategiesInLane.length;

        const x = 150 + safeIndex * 180;
        const y = perspectiveIndex * laneHeight + laneHeight / 2;

        const shape = elementFactory.createShape({
          id: id || 'strategy_' + this.elementId++,
          width: this.defaultStrategyWidth * this.strategyScale,
          height: this.defaultStrategyHeight * this.strategyScale,
          x,
          y,
          name,
          perspective,
          type: 'custom:strategy',
          di: {
            bounds: {
              x,
              y,
              width: this.defaultStrategyWidth * this.strategyScale,
              height: this.defaultStrategyHeight * this.strategyScale
            }
          }
        });

        canvas.addShape(shape);
      },
      resetCanvas() {
        if(!this.diagram) return;
        const canvas = this.diagram.get('canvas');
        const rootElement = canvas.getRootElement();

        if (rootElement) {
          const modeling = this.diagram.get('modeling');
          const elementRegistry = this.diagram.get('elementRegistry');

          const allElements = elementRegistry.getAll().filter(e => e !== rootElement && e.type !== 'custom:strategyLane');
          modeling.removeElements(allElements);
        }
      },
      removeStrategy(id) {
        const elementRegistry = this.diagram.get('elementRegistry');
        const modeling = this.diagram.get('modeling');

        const target = elementRegistry.get(id);

        if (!target) {
          console.warn(`삭제할 strategy (${id}) 없음`);
          return;
        }

        if (target.type !== 'custom:strategy') {
          console.warn(`id ${id}는 strategy가 아님`);
          return;
        }

        modeling.removeElements([target]);
      },
      addStrategyLane(name, perspective, index, totalLanes) {
        const elementFactory = this.diagram.get('elementFactory');
        const canvas = this.diagram.get('canvas');
        const elementRegistry = this.diagram.get('elementRegistry');

        const existing = elementRegistry.get(`lane_${perspective}`);
        if (existing) {
          console.warn(`Lane for ${perspective} already exists.`);
          return; // 중복 방지
        }

        const container = this.$refs.container;
        const totalHeight = container?.clientHeight || 600;

        const spacing = 20;
        const laneHeight = (totalHeight - spacing * (totalLanes - 1)) / totalLanes;
        const y = index * (laneHeight + spacing);

        const shape = elementFactory.createShape({
          id: `lane_${perspective}`,
          x: 0,
          y,
          width: 100,
          height: 40,
          name,
          perspective,
          type: 'custom:strategyLane',
          di: {
            bounds: { x: 0, y, width: 120, height: laneHeight }
          }
        });

        canvas.addShape(shape);
      },
      addConnection(sourceId, targetId) {
        const elementRegistry = this.diagram.get('elementRegistry');
        const modeling = this.diagram.get('modeling');

        const source = elementRegistry.get(sourceId);
        const target = elementRegistry.get(targetId);

        if (!source || !target) return;

        const srcCenter = {
          x: source.x + source.width / 2,
          y: source.y + source.height / 2
        };
        const tgtCenter = {
          x: target.x + target.width / 2,
          y: target.y + target.height / 2
        };

        const dx = tgtCenter.x - srcCenter.x;
        const dy = tgtCenter.y - srcCenter.y;

        let sourcePoint, targetPoint;

        if (Math.abs(dx) > Math.abs(dy)) {
          // 좌우 연결
          if (dx > 0) {
            // 오른쪽
            sourcePoint = {
              x: source.x + source.width,
              y: srcCenter.y
            };
            targetPoint = {
              x: target.x,
              y: tgtCenter.y
            };
          } else {
            // 왼쪽
            sourcePoint = {
              x: source.x,
              y: srcCenter.y
            };
            targetPoint = {
              x: target.x + target.width,
              y: tgtCenter.y
            };
          }
        } else {
          // 상하 연결
          if (dy > 0) {
            // 아래
            sourcePoint = {
              x: srcCenter.x,
              y: source.y + source.height
            };
            targetPoint = {
              x: tgtCenter.x,
              y: target.y
            };
          } else {
            // 위
            sourcePoint = {
              x: srcCenter.x,
              y: source.y
            };
            targetPoint = {
              x: tgtCenter.x,
              y: target.y + target.height
            };
          }
        }

        modeling.connect(source, target, {
          type: 'custom:connection',
          waypoints: [sourcePoint, targetPoint]
        });
      },
      onZoomIn() {
        this.strategyScale = Math.min(this.strategyScale + 0.1, this.maxStrategyScale);
        const zoomScroll = this.diagram.get('zoomScroll');
        zoomScroll.stepZoom(1);
      },
      onZoomOut() {
        this.strategyScale = Math.max(this.strategyScale - 0.1, this.minStrategyScale);
        const zoomScroll = this.diagram.get('zoomScroll');
        zoomScroll.stepZoom(-1);
      },
      onResetView() {
        this.strategyScale = 1;
        const zoomScroll = this.diagram.get('zoomScroll');
        zoomScroll.reset();
      },
      confirmDeleteStrategy() {
        this.removeStrategy(this.selectedStrategy.id);
        this.deleteDialog = false;
        this.selectedStrategy = null;
      },
      saveStrategy() {
        const { name, perspective, description } = this.strategyForm;
        if (!name || !perspective) return;

        // ID 생성
        const newId = 's_' + Date.now();

        // 🔍 현재 관점 내에서 사용된 index 목록
        const usedIndexes = this.jsonData.strategies
          .filter(s => s.perspective === perspective)
          .map(s => s.index ?? 0);

        // ✅ 겹치지 않는 최소 인덱스 찾기 (0부터 순차적으로)
        let newIndex = 0;
        while (usedIndexes.includes(newIndex)) {
          newIndex++;
        }

        // 1. jsonData에 push
        this.jsonData.strategies.push({
          id: newId,
          name,
          perspective,
          description,
          index: newIndex
        });

        // 2. 다이어그램에 반영
        this.addStrategy(name, perspective, newId);

        // 3. 폼 리셋 & 닫기
        this.addDialog = false;
        this.strategyForm = { name: '', perspective: '', description: '' };
      },
      saveEditedStrategy() {
        const { name, description } = this.editForm;
        const { id } = this.selectedStrategy;
        const strategy = this.jsonData.strategies.find(s => s.id === id);
        if (!strategy) return;

        // 업데이트
        strategy.name = name;
        strategy.description = description;

        // 뷰어 업데이트는 생략 (name만 변경이면 별도 적용 필요 시 구현)
        const elementRegistry = this.diagram.get('elementRegistry');
        const eventBus = this.diagram.get('eventBus');
        const element = elementRegistry.get(id);
        if (element) {
          element.di.name = name;
          eventBus.fire('element.changed', { element });
        }

        this.editDialog = false;
        this.editForm = { id: null, name: '', description: '' };
        this.selectedStrategy = null;
      },
      confirmAddConnection() {
        this.addConnection(this.selectedConnectionSource.id, this.selectedConnectionTarget.id);
        this.connectionDialog = false;
        this.selectedConnectionSource = null;
        this.selectedConnectionTarget = null;
      },
      uuid() {
            function s4() {
                return Math.floor((1 + Math.random()) * 0x10000)
                    .toString(16)
                    .substring(1);
            }

            return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
      },
      async loadData(path) {
          this.chatRoomId = 'bscard_chat';
          await this.getChatList(this.chatRoomId);

          this.userList = await this.backend.getUserList();
          this.agentList = await this.backend.getAgentList();
      },
      beforeSendMessage(newMessage) {
          this.sendMessage(newMessage);
          const msgObj = this.createMessageObj(newMessage);
          const putObj =  {
              id: 'bscard_chat',
              uuid: this.uuid(),
              messages: msgObj,
          };
          this.putObject("chats", putObj);
      },
      afterModelCreated(response) {
          let messageWriting = this.messages[this.messages.length - 1];

          // if (messageWriting.jsonContent) {
          //     let unknown
          //     try {
          //         unknown = partialParse(messageWriting.jsonContent);
          //     } catch(e) {
          //         console.log(e)
          //         unknown = JSON.parse(messageWriting.jsonContent)
          //     }

          //     if (unknown && !unknown.modifications) {
          //     }
          // }
      },
      async afterGenerationFinished(response) {try {
                let messageWriting = this.messages[this.messages.length - 1];
                if (messageWriting.jsonContent) {
                    let unknown;
                    try {
                        unknown = JSON.parse(messageWriting.jsonContent)
                    } catch(e) {
                        try {
                            unknown = partialParse(messageWriting.jsonContent);
                        } catch(e) {
                            console.log(e)
                            return;
                        }
                    }

                    if (unknown && unknown.modifications) {
                        unknown.modifications.forEach(modification => {
                            if (modification.action == "replace") {
                                this.jsonPathReplace(this, modification.targetJsonPath, modification.value)
                            } else if (modification.action == "add") {
                                this.jsonPathAdd(this, modification.targetJsonPath, modification.value)
                            } else if (modification.action == "delete") {
                                this.jsonPathDelete(this, modification.targetJsonPath)
                            }
                        });
                    }
                    
                    this.initializeFromData(unknown);

                    await backend.putBSCard(unknown);
                    
                }

                const newMessage = this.messages[this.messages.length - 1];
                var putObj =  {
                    id: 'bscard_chat',
                    uuid: this.uuid(),
                    messages: newMessage,
                };
                this.putObject("chats", putObj);
            } catch(e) {
                console.log(e);
            }
      },
      afterModelStopped(response) {
          const newMessage = this.messages[this.messages.length - 1];
          const putObj =  {
              id: 'bscard_chat',
              uuid: this.uuid(),
              messages: newMessage,
          };
          this.putObject("chats", putObj);
      },
    }
  };
  </script>
  
  <style>
  .bjs-powered-by {
    display: none !important;
  }
  </style>
  