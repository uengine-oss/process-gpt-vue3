<template>
    <div style="background-color: rgba(255, 255, 255, 0); width: 100%;">
        <!-- 좌우 분할 레이아웃 (/dmn/ 경로) -->
        <AppBaseCard v-if="isStandaloneMode">
            <template v-slot:leftpart>
                <!-- DMN Modeler -->
                <div class="d-flex flex-column h-100 bg-grey-lighten-4">
                    <DmnModeler
                        v-if="isShowDmnModeler"
                        ref="dmnModeler"
                        :dmn="dmnXml"
                        :isViewMode="viewMode === 'view'"
                        :key="dmnRenderKey"
                        @definition="onDmnDefinitionLoaded"
                        @error="onDmnError"
                        @shown="onDmnShown"
                    />
                    <div v-else class="d-flex align-center justify-center h-100 w-100">
                        <v-progress-circular color="primary" indeterminate></v-progress-circular>
                    </div>
                </div>
            </template>

            <template v-slot:rightpart>
                <div class="dmn-chat-right-section">
                    <Chat
                        :messages="messages"
                        :userInfo="userInfo"
                        :chatInfo="chatInfo"
                        @sendMessage="beforeSendMessage"
                        @sendEditedMessage="sendEditedMessage"
                        @stopMessage="stopMessage"
                    >
                        <template v-slot:custom-title>
                            <!-- DMN Header -->
                            <div class="d-flex align-center px-4 py-3 bg-white border-b ga-2">
                                <h6 class="text-subtitle-1 font-weight-semibold">{{ dmnName || 'New DMN Decision' }}</h6>
                                <v-spacer></v-spacer>
                                <div class="d-flex align-center ga-1">
                                    <v-btn 
                                        icon
                                        size="small"
                                        variant="text"
                                        @click="openSaveDialog"
                                        :class="{ 'icon-heartbit': isChanged }"
                                    >
                                        <v-icon size="small">mdi-content-save</v-icon>
                                        <v-tooltip activator="parent">{{ $t('dmn.save') }}</v-tooltip>
                                    </v-btn>
                                    
                                    <v-btn 
                                        v-if="isLoadedDmn"
                                        icon
                                        size="small"
                                        variant="text"
                                        color="error"
                                        @click="openDeleteDialog"
                                    >
                                        <v-icon size="small">mdi-delete</v-icon>
                                        <v-tooltip activator="parent">{{ $t('dmn.deleteDmn') }}</v-tooltip>
                                    </v-btn>
                                </div>
                            </div>
                        </template>
                    </Chat>
                </div>
            </template>

            <template v-slot:mobileLeftContent>
                <div class="dmn-chat-mobile-section">
                    <Chat
                        :messages="messages"
                        :userInfo="userInfo"
                        :chatInfo="chatInfo"
                        @sendMessage="beforeSendMessage"
                        @sendEditedMessage="sendEditedMessage"
                        @stopMessage="stopMessage"
                    >
                        <template v-slot:custom-title>
                            <!-- DMN Header -->
                            <div class="d-flex align-center px-4 py-3 bg-white border-b ga-2">
                                <h6 class="text-subtitle-1 font-weight-semibold">{{ dmnName || 'New DMN Decision' }}</h6>
                                <v-spacer></v-spacer>
                                <div class="d-flex align-center ga-1">
                                    <v-btn 
                                        icon
                                        size="small"
                                        variant="text"
                                        @click="openSaveDialog"
                                        :class="{ 'icon-heartbit': isChanged }"
                                    >
                                        <v-icon size="small">mdi-content-save</v-icon>
                                        <v-tooltip activator="parent">{{ $t('dmn.save') }}</v-tooltip>
                                    </v-btn>
                                    
                                    <v-btn 
                                        v-if="isLoadedDmn"
                                        icon
                                        size="small"
                                        variant="text"
                                        color="error"
                                        @click="openDeleteDialog"
                                    >
                                        <v-icon size="small">mdi-delete</v-icon>
                                        <v-tooltip activator="parent">{{ $t('dmn.deleteDmn') }}</v-tooltip>
                                    </v-btn>
                                </div>
                            </div>
                        </template>
                    </Chat>
                </div>
            </template>
        </AppBaseCard>

        <!-- 상하 분할 레이아웃 (기타 경로) -->
        <div v-else class="d-flex flex-column w-100 dmn-chat-container">
            <!-- DMN Section -->
            <div class="d-flex flex-column flex-grow-1 bg-grey-lighten-4 dmn-section">
                <!-- DMN Header -->
                <div class="d-flex align-center px-4 py-1 bg-white border-b ga-2">
                    <h6 class="text-subtitle-1 font-weight-semibold">{{ dmnName ? dmnName : 'New DMN Decision' }}</h6>
                    <v-spacer></v-spacer>
                    <div class="d-flex align-center ga-1">
                        <v-btn 
                            icon
                            size="small"
                            variant="text"
                            @click="openSaveDialog"
                            :class="{ 'icon-heartbit': isChanged }"
                        >
                            <v-icon size="small">mdi-content-save</v-icon>
                            <v-tooltip activator="parent">{{ $t('dmn.save') }}</v-tooltip>
                        </v-btn>
                        
                        <v-btn 
                            v-if="isLoadedDmn"
                            icon
                            size="small"
                            variant="text"
                            color="error"
                            @click="openDeleteDialog"
                        >
                            <v-icon size="small">mdi-delete</v-icon>
                            <v-tooltip activator="parent">{{ $t('dmn.deleteDmn') }}</v-tooltip>
                        </v-btn>
                    </div>
                </div>
                
                <!-- DMN Modeler -->
                <DmnModeler
                    v-if="isShowDmnModeler"
                    ref="dmnModeler"
                    :dmn="dmnXml"
                    :isViewMode="viewMode === 'view'"
                    :key="dmnRenderKey"
                    @definition="onDmnDefinitionLoaded"
                    @error="onDmnError"
                    @shown="onDmnShown"
                />
                <div v-else class="d-flex align-center justify-center h-100 w-100">
                    <v-progress-circular color="primary" indeterminate></v-progress-circular>
                </div>
            </div>
            
            <!-- Chat Section -->
            <div class="chat-section" :class="{ 'chat-section-empty': messages.length === 0 }">
                <Chat
                    :messages="messages"
                    :userInfo="userInfo"
                    :chatInfo="{ title: 'dmn.explanation' }"
                    @sendMessage="beforeSendMessage"
                    @sendEditedMessage="sendEditedMessage"
                    @stopMessage="stopMessage"
                />
            </div>
        </div>

        <v-dialog v-model="isOpenSaveDialog" max-width="500">
            <v-card>
                <v-card-title class="d-flex justify-space-between align-center">
                    <div>{{ $t('dmn.save') }}</div>
                    <v-btn icon variant="text" @click="isOpenSaveDialog = false">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-card-title>
                <v-card-text>
                    <v-text-field
                        v-model="dmnIdToSave"
                        label="DMN ID"
                        :placeholder="loadDmnId === 'chat' ? '새 DMN ID를 입력하세요' : loadDmnId"
                        variant="outlined"
                        density="comfortable"
                    ></v-text-field>
                    <v-text-field
                        v-model="dmnNameToSave"
                        label="DMN Name"
                        :placeholder="dmnName || '새 DMN 이름을 입력하세요'"
                        variant="outlined"
                        density="comfortable"
                    ></v-text-field>
                </v-card-text>
                <v-card-actions class="d-flex justify-end">
                    <v-btn color="primary" variant="flat" rounded @click="beforeSaveDmn">저장</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <v-dialog v-model="isOpenDeleteDialog" max-width="500">
            <v-card class="pa-0">
                <v-row class="ma-0 pa-4 pb-0 align-center">
                    <v-card-title class="pa-0">
                        {{ $t('dmn.deleteDmnMessage') }}
                    </v-card-title>
                    <v-spacer></v-spacer>
                    <v-btn @click="isOpenDeleteDialog = false"
                        class="ml-auto" 
                        variant="text" 
                        density="compact"
                        icon
                    >
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-row>
                <v-row class="ma-0 pa-4">
                    <v-spacer></v-spacer>
                    <v-btn @click="deleteDmn"
                        color="error"
                        rounded 
                        variant="flat" 
                    >
                        {{ $t('dmn.delete') }}
                    </v-btn>
                </v-row>
            </v-card>
        </v-dialog>
    </div>
</template>

<script>
import { useDmnStore } from '@/stores/dmn';

import Chat from './ui/Chat.vue';
import ChatModule from './ChatModule.vue';
import DmnModeler from './DmnModeler.vue';
import ChatGenerator from './ai/DmnGenerator.js';
import AppBaseCard from '@/components/shared/AppBaseCard.vue';

export default {
    mixins: [ChatModule],
    name: 'DmnChat',
    components: {
        Chat,
        DmnModeler,
        AppBaseCard
    },
    props: {
        ownerInfo: Object,
        dmnId: String
    },
    data() {
        return {
            chatInfo: {
                title: 'dmn.cardTitle',
                text: 'dmn.explanation'
            },

            dmnXml: null,
            dmnName: '',
            dmnRenderKey: 0,
            prevDmnOutput: '',
            
            isOpenSaveDialog: false,
            isOpenDeleteDialog: false,
            isShowDmnModeler: false,
            isLoadedDmn: false,
            isChanged: false,
            isAIUpdated: false,
            
            viewMode: 'edit',
            loadDmnId: '',
            dmnIdToSave: '',
            dmnNameToSave: '',
            
            dmnDefinition: null,
            isRoutedWithUnsaved: false,

            owner: ''
        };
    },
    async created() {
        this.generator = new ChatGenerator(this, {
            isStream: true,
            preferredLanguage: 'Korean'
        });
        await this.init();
        
        // dmnId prop이 있으면 초기 로딩
        if (this.dmnId) {
            await this.loadData();
        }
        // 라우트 기반 모드 (/dmn/ 경로)
        else if (this.$route.params.pathMatch) {
            await this.loadData();
        } 
        // 새 DMN 생성 모드
        else {
            this.isShowDmnModeler = true;
        }
    },
    watch: {
        dmnId: {
            handler(newVal, oldVal) {
                // 초기 로딩 시 (oldVal === undefined)는 created에서 처리하므로 스킵
                if (oldVal === undefined) return;
                
                // 값이 실제로 변경되었을 때만 처리
                if (newVal !== oldVal) {
                    if (newVal) {
                        if (this.$refs.dmnModeler) {
                            if (this.isAIUpdated || this.isChanged) {
                                const answer = window.confirm(this.$t('changePath'));
                                if (answer)
                                    this.loadData();
                            } else {
                                this.loadData();
                            }
                        } else {
                            this.loadData();
                        }
                    } else {
                        // dmnId가 null이 되었을 때 (삭제 등)
                        this.loadDmnId = null;
                        this.dmnXml = null;
                        this.dmnName = null;
                        this.isLoadedDmn = false;
                    }
                }
            }
        },
        $route: {
            deep: true,
            handler(newVal, oldVal) {
                if (!newVal.path.startsWith('/dmn')) return;

                if (this.isRoutedWithUnsaved) {
                    this.isRoutedWithUnsaved = false;
                    return;
                }

                if (newVal.path !== oldVal.path) {
                    if (this.$refs.dmnModeler) {
                        if (this.isAIUpdated || this.isChanged) {
                            const answer = window.confirm(this.$t('changePath'));
                            if (answer)
                                this.loadData();
                            else {
                                this.isRoutedWithUnsaved = true;
                                this.$router.push(oldVal.path);
                            }
                        } else {
                            this.loadData();
                        }
                    } else {
                        this.loadData();
                    }
                } else {
                    this.isShowDmnModeler = true;
                }
            }
        }
    },
    computed: {
        isStandaloneMode() {
            // URL이 /dmn/으로 시작하면 좌우 분할 레이아웃 사용
            return this.$route.path.startsWith('/dmn/');
        }
    },
    methods: {
        openSaveDialog() {
            this.dmnIdToSave = this.loadDmnId === 'chat' ? '' : this.loadDmnId;
            this.dmnNameToSave = this.dmnName || '';
            this.isOpenSaveDialog = true;
        },
        
        openDeleteDialog() {
            this.isOpenDeleteDialog = true;
        },
        
        async beforeSaveDmn() {
            const me = this;
            me.$try({
                context: me,
                action: async () => {
                    const xml = await me.$refs.dmnModeler.saveDMN();
                    const id = me.dmnIdToSave || me.loadDmnId;
                    const name = me.dmnNameToSave || me.dmnName;
                    
                    if (!id || id === 'chat') {
                        alert('DMN ID를 입력해주세요.');
                        return;
                    }
                    
                    await me.saveDmn({
                        id: id,
                        name: name,
                        xml: xml
                    });
                    
                    me.isChanged = false;
                    me.isOpenSaveDialog = false;
                    
                    // 새로 저장한 경우 해당 ID로 이동
                    if (me.loadDmnId === 'chat') {
                        await me.$router.push(`/dmn/${id}`);
                    }
                },
                successMsg: this.$t('successMsg.save')
            });
        },
        
        async saveDmn({ id, name, xml }) {
            const putObj = { 
                type: 'dmn',
                name: name
            }
            if (this.owner !== '') putObj.owner = this.owner;
            await this.backend.putRawDefinition(xml, id, putObj);
            
            this.dmnName = name;
            this.loadDmnId = id;
            this.isLoadedDmn = true;
        },
        
        async loadData() {
            // dmnId prop이 있으면 우선 사용, 없으면 라우트에서 가져오기
            if (this.dmnId && this.dmnId !== 'chat') {
                this.loadDmnId = this.dmnId;
            } else {
                this.loadDmnId = this.$route.params.pathMatch ? this.$route.params.pathMatch.join('/') : 'chat';
            }
            
            // null 체크 추가
            if (this.loadDmnId && this.loadDmnId.startsWith('/')) {
                this.loadDmnId = this.loadDmnId.substring(1);
            }
            
            this.isLoadedDmn = (this.loadDmnId && this.loadDmnId !== 'chat');
            this.isAIUpdated = false;
            this.messages = [];
            
            if (this.isLoadedDmn) {
                try {
                    const dmnData = await this.backend.getRawDefinition(this.loadDmnId, { type: 'dmn' });
                    this.dmnXml = dmnData;
                    
                    // DMN 이름 추출 (XML에서)
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(this.dmnXml, 'text/xml');
                    const definitions = xmlDoc.getElementsByTagName('definitions')[0];
                    if (definitions) {
                        this.dmnName = definitions.getAttribute('name') || this.loadDmnId;
                    }
                    
                    this.dmnRenderKey++;
                    this.isShowDmnModeler = true;
                } catch (error) {
                    console.error('DMN 로드 실패:', error);
                    // AgentChat 내 임베디드 모드에서는 라우터 푸시하지 않음
                    if (this.$route.path.startsWith('/dmn/')) {
                        alert(`'${this.loadDmnId}' ID를 가지는 DMN 정보가 없습니다! 새 DMN 만들기 화면으로 이동됩니다.`);
                        this.$router.push('/dmn/chat');
                    } else {
                        // 임베디드 모드에서는 경고만 출력하고 새 DMN 화면으로
                        console.warn(`DMN '${this.loadDmnId}' 로드 실패. 새 DMN 생성 모드로 전환합니다.`);
                    }
                    this.dmnXml = null;
                    this.dmnName = null;
                    this.isShowDmnModeler = true;
                }
            } else {
                this.dmnXml = null;
                this.dmnName = null;
                this.loadDmnId = null;
                this.isShowDmnModeler = true;
            }

            if (this.ownerInfo && this.ownerInfo.id) {   
                this.owner = this.ownerInfo.id
            }
        },
        
        beforeSendMessage(newMessage) {
            const me = this;
            me.$try({
                context: me,
                action: async () => {
                    if (me.$refs.dmnModeler) {
                        me.prevDmnOutput = await me.$refs.dmnModeler.saveDMN();
                    }
                    
                    newMessage.mentionedUsers = null;
                    
                    if (me.prevDmnOutput) {
                        me.generator.sendMessageWithPrevDmnOutput(newMessage);
                    } else {
                        me.generator.sendMessage(newMessage);
                    }
                }
            });
        },
        
        afterModelCreated(response) {
            // console.log('DMN 생성 중:', response);
        },
        
        afterGenerationFinished(response) {
            this.processResponse(response);
        },
        
        processResponse(response) {
            try {
                const messageWriting = this.messages[this.messages.length - 1];
                
                let parsed;
                if (typeof response === 'object' && response.dmnXml) {
                    parsed = response;
                } else {
                    try {
                        const jsonContent = this.extractJSON(response);
                        parsed = JSON.parse(jsonContent);
                    } catch (parseError) {
                        console.error('[DMN] JSON 파싱 실패:', parseError);
                        console.log('[DMN] 파싱 시도한 내용:', jsonContent.substring(0, 500));
                        if (messageWriting) {
                            messageWriting.content = 'AI 응답의 JSON 파싱에 실패했습니다.';
                        }
                        return;
                    }
                }

                // DMN XML 설정
                this.dmnXml = parsed.dmnXml;

                // DMN 이름 추출
                try {
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(this.dmnXml, 'text/xml');
                    
                    // XML 파싱 에러 체크
                    const parserError = xmlDoc.querySelector('parsererror');
                    if (parserError) {
                        console.error('[DMN] XML 파싱 에러:', parserError.textContent);
                        if (messageWriting) {
                            messageWriting.content = 'DMN XML이 유효하지 않습니다. AI에게 다시 요청해주세요.';
                        }
                        return;
                    }
                    
                    const definitions = xmlDoc.getElementsByTagName('definitions')[0];
                    if (definitions) {
                        this.loadDmnId = definitions.getAttribute('id') || this.loadDmnId;
                        this.dmnName = definitions.getAttribute('name') || 'New DMN Decision';
                    }
                } catch (xmlError) {
                    console.error('[DMN] XML 처리 중 오류:', xmlError);
                    this.dmnName = 'New DMN Decision';
                }
                
                this.dmnRenderKey++;
                this.isAIUpdated = true;
                this.isChanged = true;
                
                // 메시지 내용 업데이트
                messageWriting.content = parsed.description;
                
                // 수정 내역이 있으면 표시
                if (parsed.modifications && parsed.modifications.length > 0) {
                    const modDesc = parsed.modifications
                        .map(m => `- ${m.description}`)
                        .join('\n');
                    messageWriting.content += '\n\n수정 내역:\n' + modDesc;
                }
            } catch (error) {
                console.error('[DMN] AI 응답 처리 중 오류 발생:', error);
                const messageWriting = this.messages[this.messages.length - 1];
                if (messageWriting) {
                    messageWriting.content = 'AI 응답 처리 중 오류가 발생했습니다: ' + error.message;
                }
            }
        },
                
        afterModelStopped(response) {
            console.log('DMN 생성 중단:', response);
        },
        
        onDmnDefinitionLoaded(definition) {
            console.log('DMN Definition loaded:', definition);
            this.dmnDefinition = definition;
            
            // Store에 DMN 정의 저장
            const dmnStore = useDmnStore();
            dmnStore.setDecisionDefinition(definition);
        },
        
        onDmnError(error) {
            console.error('DMN Error:', error);
        },
        
        onDmnShown(warnings) {
            if (warnings && warnings.length > 0) {
                console.warn('DMN Warnings:', warnings);
            }
        },
        
        async deleteDmn() {
            const me = this;
            me.$try({
                context: me,
                action: async () => {
                    await this.backend.deleteDefinition(me.loadDmnId, { type: 'dmn' });
                    me.isOpenDeleteDialog = false;
                    if (me.$route.path.startsWith('/dmn/')) {
                        await me.$router.push('/dmn/chat');
                    } else {
                        me.EventBus.emit('dmn-deleted');
                        me.loadDmnId = null;
                        me.loadData();
                    }
                },
                successMsg: this.$t('successMsg.delete')
            });
        }
    },
    
    async beforeRouteLeave(to, from, next) {
        if (!(this.$refs.dmnModeler)) return next();
        
        if (this.isAIUpdated || this.isChanged) {
            const answer = window.confirm(this.$t('changePath'));
            if (answer) {
                next();
            } else {
                next(false);
            }
        } else {
            next();
        }
    }
};
</script>

<style scoped>
/* 상하 분할 레이아웃 (기본) */
.dmn-chat-container {
    height: calc(100vh - 111px); /* 75px (헤더) + 36px (padding) */
    overflow: hidden;
}

.dmn-section {
    flex: 1;
    border-bottom: 2px solid #e0e0e0;
}

.dmn-section :deep(.vue-dmn-diagram-container) {
    flex: 1;
    height: 100%;
}

.chat-section {
    flex: 1;
    overflow: auto;
    border-top: 1px solid #e0e0e0;
    transition: flex 0.3s ease;
}

.chat-section-empty {
    flex: 0 0 auto;
    min-height: 150px;
}

/* 좌우 분할 레이아웃 (/dmn/ 경로) */
:deep(.left-part) {
    width: 75%;
    /* DMN Modeler 영역 */
}

.dmn-chat-right-section {
    height: 100%;
    overflow: auto;
}

.dmn-chat-mobile-section {
    height: 100%;
    overflow: auto;
}

.icon-heartbit {
    animation: icon-pulse 1.5s ease-in-out infinite;
    transform-origin: center;
}

@keyframes icon-pulse {
    0% {
        transform: scale(1);
        opacity: 1;
    }
    50% {
        transform: scale(1.2);
        opacity: 0.8;
    }
    100% {
        transform: scale(1);
        opacity: 1;
    }
}

/* 반응형 레이아웃 */
@media (max-width: 768px) {
    .dmn-chat-container {
        height: 100vh; /* 모바일에서는 헤더가 사이드바에 있으므로 전체 높이 사용 */
    }

    .dmn-section {
        flex: 1;
    }

    .chat-section {
        flex: 1;
    }
    
    .chat-section-empty {
        flex: 0 0 auto;
        min-height: 150px;
    }
}
</style>

