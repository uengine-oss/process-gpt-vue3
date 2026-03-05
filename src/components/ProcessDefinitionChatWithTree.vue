<template>
    <div>
        <v-row class="ma-0 pa-0 process-definition-chat-tree-box">
            <!-- 왼쪽: TreeView -->
            <v-col cols="12" md="3" class="pa-0">
                <v-card elevation="10" class="pa-3 tree-view-card">
                    <v-row class="ma-0 pa-0">
                        <v-card-title class="pa-2 mb-2">
                            <v-icon class="mr-2">mdi-file-tree</v-icon>
                            {{ $t('processDefinitionTree.title') || '프로세스 체계도' }}
                        </v-card-title>
                        <v-spacer></v-spacer>

                        <div class="d-flex ga-2">
                            <v-btn color="grey" variant="flat" size="small">{{ $t('common.add') || '추가' }}</v-btn>
                            <v-btn color="grey" variant="flat" size="small">{{ $t('common.delete') || '삭제' }}</v-btn>
                        </div>
                    </v-row>

                    <!-- 도메인 필터 탭 -->
                    <div v-if="domains && domains.length > 0" class="domain-filter-tabs mb-3">
                        <v-chip-group v-model="selectedDomainFilter" selected-class="bg-primary text-white" mandatory>
                            <v-chip :value="null" size="small" variant="outlined" filter>
                                {{ $t('processDefinitionTree.allDomains') || '전체' }}
                            </v-chip>
                            <v-chip
                                v-for="domain in domains"
                                :key="domain.id"
                                :value="domain.id"
                                size="small"
                                variant="outlined"
                                filter
                                :style="domain.color ? { '--chip-color': domain.color } : {}"
                                :class="{ 'domain-colored-chip': domain.color && selectedDomainFilter === domain.id }"
                            >
                                {{ domain.name }}
                            </v-chip>
                        </v-chip-group>
                    </div>

                    <!-- TreeView -->
                    <v-treeview v-if="Object.keys(nodes).length > 0" :config="config" :nodes="nodes" class="process-tree">
                        <template #text="{ node }">
                            <div @click="handleNodeClick(node)" :class="['tree-node-text', { 'is-sub': node.id.startsWith('sub_') }]">
                                <v-icon size="small" class="mr-2">
                                    <template v-if="node.id.startsWith('mega_')">mdi-folder-network</template>
                                    <template v-else-if="node.id.startsWith('major_')">mdi-folder</template>
                                    <template v-else>mdi-file-document</template>
                                </v-icon>
                                {{ node.text }}
                                <v-chip v-if="node.data?.new" size="x-small" color="success" class="ml-2">NEW</v-chip>
                            </div>
                        </template>
                    </v-treeview>

                    <v-alert v-else type="info" variant="tonal" class="mt-3"> 프로세스 정의가 없습니다. </v-alert>
                </v-card>
            </v-col>

            <!-- 오른쪽: ProcessDefinitionChat -->
            <v-col cols="12" md="9" class="pa-0 chat-container">
                <v-card flat class="pa-3">
                    <div class="ma-0 pa-0 align-center d-flex">
                        <!-- 검색창 -->
                        <v-row class="align-center flex-fill border border-borderColor header-search rounded-pill px-5 ma-0 pa-0">
                            <Icons :icon="'magnifer-linear'" :size="22" />
                            <v-text-field
                                v-model="searchValue"
                                variant="plain"
                                density="compact"
                                class="position-relative pt-0 ml-3 custom-placeholer-color"
                                :placeholder="$t('chatListing.search')"
                                single-line
                                hide-details
                                @keyup.enter="handleSearch"
                            ></v-text-field>
                            <v-btn v-if="searchValue" icon variant="text" size="small" @click="handleSearch" class="ml-2">
                                <v-icon>mdi-magnify</v-icon>
                            </v-btn>
                        </v-row>
                        <v-spacer></v-spacer>

                        <!-- 버튼들 -->
                        <div class="d-flex ga-2">
                            <v-btn color="success" variant="flat" @click="openFileDialog" :loading="isParsingExcel">
                                <v-icon class="mr-2">mdi-file-excel</v-icon>
                                {{ uploadedFileName || $t('processDefinitionTree.uploadExcel') }}
                            </v-btn>
                            <v-btn color="primary" variant="flat" @click="handleCreateMap" :disabled="!parsedExcelData">
                                {{ $t('processDefinitionTree.createMap') }}
                            </v-btn>
                            <v-btn color="info" variant="flat" @click="handleDownloadExcel">
                                <v-icon class="mr-2">mdi-download</v-icon>
                                엑셀 다운로드
                            </v-btn>
                        </div>

                        <!-- 숨겨진 파일 입력 -->
                        <input ref="fileInput" type="file" accept=".xlsx,.xls" style="display: none" @change="handleFileSelect" />
                    </div>
                </v-card>

                <ProcessDefinitionChat ref="processDefinitionChat" :chatMode="chatMode" :key="$route.fullPath" />
            </v-col>
        </v-row>
    </div>
</template>

<script>
import ProcessDefinitionChat from '@/components/ProcessDefinitionChat.vue';
import BackendFactory from '@/components/api/BackendFactory';
import VTreeview from 'vue3-treeview';
import 'vue3-treeview/dist/style.css';
import * as XLSX from 'xlsx';

const backend = BackendFactory.createBackend();

export default {
    name: 'ProcessDefinitionChatWithTree',
    components: {
        ProcessDefinitionChat,
        VTreeview
    },
    props: {},
    data: () => ({
        nodes: {},
        config: {
            roots: []
        },
        chatMode: 'tree',
        processDefinitionMap: null,
        selectedNodeId: null,
        search: '',
        searchValue: '',
        // 엑셀 파일 업로드 관련
        uploadedFileName: null,
        isParsingExcel: false,
        parsedExcelData: null,
        // 도메인 필터 관련
        domains: [],
        selectedDomainFilter: null,
        metricsMap: null
    }),
    async created() {
        await this.loadProcessDefinitionMap();
        await this.loadMetricsMap();
        // await this.loadFirstSubProcess();
    },
    watch: {
        // 라우트 변경 감지 - 프로세스 정의 체계도 새로고침
        $route: {
            deep: true,
            async handler(newVal, oldVal) {
                // definitions 페이지 내에서 이동할 때만 체계도 새로고침
                if (newVal.path.startsWith('/definitions') && oldVal.path.startsWith('/definitions')) {
                    await this.loadProcessDefinitionMap();
                }
            }
        },
        // 도메인 필터 변경 시 트리 다시 생성
        selectedDomainFilter() {
            if (this.processDefinitionMap && this.processDefinitionMap.mega_proc_list) {
                this.convertToVue3TreeviewFormat(this.processDefinitionMap.mega_proc_list);
            }
        }
    },
    methods: {
        /**
         * 프로세스 정의 체계도를 Supabase에서 로드
         */
        async loadProcessDefinitionMap() {
            try {
                this.processDefinitionMap = await backend.getProcessDefinitionMap();

                if (this.processDefinitionMap && this.processDefinitionMap.mega_proc_list) {
                    this.convertToVue3TreeviewFormat(this.processDefinitionMap.mega_proc_list);
                    console.log('🌲 Nodes loaded:', this.nodes);
                    console.log('🌲 Config:', this.config);
                }
            } catch (error) {
                console.error('프로세스 정의 체계도 로드 실패:', error);
                this.$try({
                    context: this,
                    action: () => {
                        throw error;
                    },
                    errorMsg: '프로세스 정의 체계도를 불러오는데 실패했습니다.'
                });
            }
        },

        /**
         * 메트릭스 맵에서 도메인 정보 로드
         */
        async loadMetricsMap() {
            try {
                this.metricsMap = await backend.getMetricsMap();
                if (this.metricsMap && this.metricsMap.domains) {
                    this.domains = this.metricsMap.domains;
                }
            } catch (error) {
                console.error('메트릭스 맵 로드 실패:', error);
            }
        },

        /**
         * 도메인 ID로 도메인 정보 조회
         */
        getDomainById(domainId) {
            return this.domains.find((d) => d.id === domainId);
        },

        /**
         * Major 프로세스의 도메인 ID 조회
         */
        getMajorDomainId(majorId) {
            if (!this.metricsMap || !this.metricsMap.processes) return null;
            const proc = this.metricsMap.processes.find((p) => p.id === majorId);
            return proc ? proc.domain_id : null;
        },

        /**
         * 프로세스 정의 체계도를 vue3-treeview 형식으로 변환
         * @param {Array} megaProcList - mega_proc_list 배열
         */
        convertToVue3TreeviewFormat(megaProcList) {
            if (!megaProcList || !Array.isArray(megaProcList)) {
                return;
            }

            this.nodes = {};
            this.config.roots = [];

            // 도메인 필터가 선택된 경우 필터링 적용
            const selectedDomain = this.selectedDomainFilter;

            megaProcList.forEach((mega) => {
                const megaId = `mega_${mega.id}`;
                let hasMajorInDomain = false;

                // 임시로 mega 노드 생성
                const megaNode = {
                    id: megaId,
                    text: mega.name,
                    children: [],
                    data: { type: 'mega', originalId: mega.id }
                };

                if (mega.major_proc_list && Array.isArray(mega.major_proc_list)) {
                    mega.major_proc_list.forEach((major) => {
                        // 도메인 필터링: 선택된 도메인과 major의 도메인이 일치하는지 확인
                        const majorDomainId = this.getMajorDomainId(major.id);

                        // 필터가 없거나, 필터가 일치하는 경우에만 추가
                        if (selectedDomain === null || majorDomainId === selectedDomain) {
                            hasMajorInDomain = true;

                            const majorId = `major_${major.id}`;
                            megaNode.children.push(majorId);

                            // 도메인 정보 조회
                            const domainInfo = majorDomainId ? this.getDomainById(majorDomainId) : null;

                            this.nodes[majorId] = {
                                id: majorId,
                                text: major.name,
                                children: [],
                                data: {
                                    type: 'major',
                                    originalId: major.id,
                                    domain: major.domain,
                                    domainId: majorDomainId,
                                    domainColor: domainInfo?.color
                                }
                            };

                            if (major.sub_proc_list && Array.isArray(major.sub_proc_list)) {
                                major.sub_proc_list.forEach((sub) => {
                                    const subId = `sub_${sub.id}`;
                                    this.nodes[majorId].children.push(subId);

                                    this.nodes[subId] = {
                                        id: subId,
                                        text: sub.name,
                                        children: [],
                                        data: {
                                            type: 'sub',
                                            originalId: sub.id,
                                            processDefinitionId: sub.id,
                                            new: sub.new || false
                                        }
                                    };
                                });
                            }
                        }
                    });
                }

                // 도메인 필터링 후 major가 있는 경우에만 mega 노드 추가
                if (selectedDomain === null || hasMajorInDomain) {
                    this.config.roots.push(megaId);
                    this.nodes[megaId] = megaNode;
                }
            });
        },

        /**
         * 트리 노드 클릭 핸들러
         * @param {Object} node - 클릭된 노드 객체
         */
        handleNodeClick(node) {
            console.log('🖱️ 노드 클릭:', node);

            if (!node || !node.id) {
                return;
            }

            const nodeId = node.id;
            this.selectedNodeId = nodeId;

            // sub 프로세스만 클릭 가능 (실제 프로세스 정의)
            if (typeof nodeId === 'string' && nodeId.startsWith('sub_')) {
                const processId = nodeId.replace('sub_', '');
                console.log('✅ Sub 프로세스 선택:', processId);
                this.navigateToProcess(processId);
            } else {
                console.log('ℹ️ Mega 또는 Major 프로세스 (클릭만 됨)');
            }
        },

        /**
         * 선택된 프로세스 정의로 이동
         * @param {String} processId - 프로세스 정의 ID
         */
        navigateToProcess(processId) {
            console.log('📍 navigateToProcess 실행');
            console.log('📍 Process ID:', processId);

            // ProcessDefinitionChat 컴포넌트가 라우팅을 통해 로드되도록 함
            const currentPath = this.$route.path;
            const newPath = `/definitions-tree/${processId}`;

            console.log('📍 Current Path:', currentPath);
            console.log('📍 New Path:', newPath);

            // 이미 해당 경로에 있으면 강제 새로고침
            if (currentPath === newPath) {
                console.log('🔄 같은 경로 - 강제 새로고침');
                this.$router.go(0);
            } else {
                console.log('➡️ 새 경로로 이동');
                this.$router.push(newPath);
            }
        },

        /**
         * 트리 새로고침 (외부에서 호출 가능)
         */
        async refreshTree() {
            await this.loadProcessDefinitionMap();
        },

        /**
         * 첫 번째 서브프로세스 자동 로드
         */
        async loadFirstSubProcess() {
            // 이미 특정 프로세스 경로에 있으면 스킵
            const currentPath = this.$route.path;
            if (currentPath !== '/definitions-tree' && currentPath !== '/definitions-tree/chat' && !currentPath.endsWith('/')) {
                return;
            }

            try {
                let firstSubProcessId = null;

                // nodes에서 첫 번째 서브프로세스 찾기
                for (const nodeId in this.nodes) {
                    if (nodeId.startsWith('sub_')) {
                        const node = this.nodes[nodeId];
                        if (node.data && node.data.processDefinitionId) {
                            firstSubProcessId = node.data.processDefinitionId;
                            this.selectedNodeId = nodeId;
                            break;
                        }
                    }
                }

                // 첫 번째 서브프로세스로 이동
                if (firstSubProcessId) {
                    const targetPath = `/definitions-tree/${firstSubProcessId}`;
                    console.log('🎯 첫 번째 서브프로세스로 이동:', targetPath);
                    // replace를 사용해서 뒤로가기 시 history에 남지 않도록 함
                    this.$router.replace(targetPath);
                }
            } catch (error) {
                console.error('첫 번째 서브프로세스 로드 실패:', error);
            }
        },

        /**
         * 파일 다이얼로그 열기
         */
        openFileDialog() {
            this.$refs.fileInput.click();
        },

        /**
         * 파일 선택 핸들러
         */
        async handleFileSelect(event) {
            const file = event.target.files?.[0];
            if (!file) return;

            await this.processExcelFile(file);

            // 파일 입력 초기화 (같은 파일을 다시 선택할 수 있도록)
            event.target.value = '';
        },

        /**
         * 엑셀 파일 처리
         */
        async processExcelFile(file) {
            console.log('📄 엑셀 파일 처리 시작:', file.name);

            this.isParsingExcel = true;
            this.uploadedFileName = null;

            try {
                // XLSX 라이브러리로 파싱
                const result = await this.parseWithXLSX(file);

                if (result.success) {
                    this.uploadedFileName = file.name;
                    this.parsedExcelData = result;

                    console.log('✅ 엑셀 파싱 성공:', result);
                    console.log('📊 시트 목록:', result.sheetNames);
                    console.log('📊 시트 수:', result.sheetCount);

                    // 파싱된 데이터 출력 (디버깅용)
                    result.sheetNames.forEach((sheetName) => {
                        console.log(`📋 시트 "${sheetName}":`, result.data[sheetName]);
                    });

                    console.log(`엑셀 파일이 성공적으로 파싱되었습니다. (${result.sheetCount}개 시트)`);
                } else {
                    console.error('❌ 엑셀 파싱 실패:', result.error);
                    console.log(`엑셀 파일 파싱에 실패했습니다: ${result.error}`);
                }
            } catch (error) {
                console.error('❌ 엑셀 파일 처리 중 오류:', error);
            } finally {
                this.isParsingExcel = false;
            }
        },

        /**
         * XLSX 라이브러리를 사용하여 엑셀 파싱
         */
        parseWithXLSX(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();

                reader.onload = (e) => {
                    try {
                        const data = e.target.result;
                        const startTime = Date.now();

                        // 엑셀 파일 파싱
                        const workbook = XLSX.read(data, { type: 'array' });

                        const elapsed = (Date.now() - startTime) / 1000;
                        console.log(`⏱️ XLSX 파싱 시간: ${elapsed.toFixed(2)}초`);

                        // 모든 시트의 데이터를 추출
                        const result = {};

                        workbook.SheetNames.forEach((sheetName) => {
                            const worksheet = workbook.Sheets[sheetName];
                            // 시트를 JSON으로 변환 (두 가지 형태로)
                            const jsonArray = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                            const jsonObjects = XLSX.utils.sheet_to_json(worksheet);

                            result[sheetName] = {
                                array: jsonArray, // 배열 형태
                                objects: jsonObjects // 객체 배열 형태
                            };
                        });

                        resolve({
                            success: true,
                            data: result,
                            sheetNames: workbook.SheetNames,
                            sheetCount: workbook.SheetNames.length,
                            workbook: workbook
                        });
                    } catch (parseError) {
                        console.error('❌ XLSX 파싱 중 오류:', parseError);
                        resolve({
                            success: false,
                            error: parseError.message
                        });
                    }
                };

                reader.onerror = (error) => {
                    console.error('❌ 파일 읽기 중 오류:', error);
                    resolve({
                        success: false,
                        error: '파일 읽기 실패'
                    });
                };

                reader.readAsArrayBuffer(file);
            });
        },

        /**
         * 맵 생성 버튼 클릭 핸들러
         */
        async handleCreateMap() {
            if (!this.parsedExcelData) {
                console.error('파싱된 엑셀 데이터가 없습니다.');
                return;
            }

            try {
                console.log('🚀 프로세스 맵 생성 시작');

                // 파싱된 엑셀 데이터를 문자열로 변환
                let excelContent = '';
                this.parsedExcelData.sheetNames.forEach((sheetName) => {
                    const sheetData = this.parsedExcelData.data[sheetName];
                    excelContent += `\n\n[시트: ${sheetName}]\n`;
                    excelContent += JSON.stringify(sheetData.objects, null, 2);
                });

                console.log('📋 엑셀 내용:', excelContent);

                // 메시지 생성
                const message = {
                    text: excelContent + '\n\n위 내용을 보고 프로세스를 생성해줘',
                    images: [],
                    mentionedUsers: []
                };

                // 자식 컴포넌트(ProcessDefinitionChat)의 beforeSendMessage 메서드 호출
                const chatComponent = this.$refs.processDefinitionChat;
                if (chatComponent && chatComponent.beforeSendMessage) {
                    await chatComponent.beforeSendMessage(message);
                } else {
                    console.error('ProcessDefinitionChat 컴포넌트를 찾을 수 없습니다.');
                }
            } catch (error) {
                console.error('❌ 프로세스 맵 생성 실패:', error);
            }
        },

        /**
         * 검색 버튼 클릭 또는 엔터 키 입력 핸들러
         */
        handleSearch() {
            if (!this.searchValue || this.searchValue.trim() === '') {
                console.log('검색어를 입력해주세요.');
                return;
            }

            console.log('🔍 액티비티 검색:', this.searchValue);

            // 자식 컴포넌트(ProcessDefinitionChat)의 searchAndFocusActivity 메서드 호출
            const chatComponent = this.$refs.processDefinitionChat;
            if (chatComponent && chatComponent.searchAndFocusActivity) {
                const found = chatComponent.searchAndFocusActivity(this.searchValue);

                if (found) {
                    console.log('✅ 액티비티를 찾아 포커싱했습니다.');
                } else {
                    console.log('❌ 일치하는 액티비티를 찾을 수 없습니다.');
                    // 사용자에게 알림 (선택적)
                    // alert(`"${this.searchValue}"와 일치하는 액티비티를 찾을 수 없습니다.`);
                }
            } else {
                console.error('ProcessDefinitionChat 컴포넌트를 찾을 수 없습니다.');
            }
        },

        /**
         * 프로세스 정의를 엑셀 파일로 다운로드
         */
        async handleDownloadExcel() {
            try {
                console.log('📥 엑셀 다운로드 시작');

                const chatComponent = this.$refs.processDefinitionChat;
                if (!chatComponent || !chatComponent.processDefinition) {
                    console.error('프로세스 정의를 찾을 수 없습니다.');
                    alert('다운로드할 프로세스 정의가 없습니다.');
                    return;
                }

                const processDefinition = chatComponent.processDefinition;
                console.log('📋 프로세스 정의:', processDefinition);

                // 워크북 생성
                const workbook = XLSX.utils.book_new();

                // 1. 프로세스 기본 정보 시트
                const processInfoData = [
                    ['항목', '내용'],
                    ['Mega Process ID', processDefinition.megaProcessId || ''],
                    ['Major Process ID', processDefinition.majorProcessId || ''],
                    ['프로세스 ID', processDefinition.processDefinitionId || ''],
                    ['프로세스 이름', processDefinition.processDefinitionName || ''],
                    ['설명', processDefinition.description || ''],
                    ['수평 레이아웃', processDefinition.isHorizontal ? '예' : '아니오'],
                    ['자동 레이아웃', processDefinition.isAutoLayout ? '예' : '아니오'],
                    ['생성일', new Date().toLocaleDateString('ko-KR')]
                ];
                const processInfoSheet = XLSX.utils.aoa_to_sheet(processInfoData);
                processInfoSheet['!cols'] = [{ wch: 20 }, { wch: 50 }];
                XLSX.utils.book_append_sheet(workbook, processInfoSheet, '1.프로세스정보');

                // 2. 프로세스 변수(Data) 시트
                if (processDefinition.data && processDefinition.data.length > 0) {
                    const dataSheetData = [['변수명', '설명', '타입']];

                    processDefinition.data.forEach((variable) => {
                        dataSheetData.push([variable.name || '', variable.description || '', variable.type || '']);
                    });

                    const dataSheet = XLSX.utils.aoa_to_sheet(dataSheetData);
                    dataSheet['!cols'] = [
                        { wch: 20 }, // 변수명
                        { wch: 50 }, // 설명
                        { wch: 15 } // 타입
                    ];
                    XLSX.utils.book_append_sheet(workbook, dataSheet, '2.프로세스변수');
                }

                // 3. Roles(역할/Lane) 시트
                if (processDefinition.roles && processDefinition.roles.length > 0) {
                    const rolesData = [['역할 이름', 'Endpoint', '담당 업무', 'X좌표', 'Y좌표', '너비', '높이']];

                    processDefinition.roles.forEach((role) => {
                        rolesData.push([
                            role.name || '',
                            role.endpoint || '',
                            role.resolutionRule || '',
                            role.boundary?.minX || '',
                            role.boundary?.minY || '',
                            role.boundary?.width || '',
                            role.boundary?.height || ''
                        ]);
                    });

                    const rolesSheet = XLSX.utils.aoa_to_sheet(rolesData);
                    rolesSheet['!cols'] = [
                        { wch: 20 }, // 역할 이름
                        { wch: 25 }, // Endpoint
                        { wch: 40 }, // 담당 업무
                        { wch: 10 }, // X좌표
                        { wch: 10 }, // Y좌표
                        { wch: 10 }, // 너비
                        { wch: 10 } // 높이
                    ];
                    XLSX.utils.book_append_sheet(workbook, rolesSheet, '3.역할(Lane)');
                }

                // 4. Elements에서 Activity만 추출
                if (processDefinition.elements && processDefinition.elements.length > 0) {
                    const activities = processDefinition.elements.filter((el) => el.elementType === 'Activity');

                    if (activities.length > 0) {
                        const activitiesData = [
                            [
                                'ID',
                                '이름',
                                '타입',
                                '역할',
                                '설명',
                                '지시사항',
                                '소요시간(일)',
                                '체크포인트',
                                '입력데이터',
                                '출력데이터',
                                '도구',
                                'Layer',
                                'Order',
                                'X좌표',
                                'Y좌표',
                                '너비',
                                '높이'
                            ]
                        ];

                        activities.forEach((activity) => {
                            activitiesData.push([
                                activity.id || '',
                                activity.name || '',
                                activity.type || '',
                                activity.role || '',
                                activity.description || '',
                                activity.instruction || '',
                                activity.duration || '',
                                Array.isArray(activity.checkpoints) ? activity.checkpoints.join(', ') : '',
                                Array.isArray(activity.inputData) ? activity.inputData.join(', ') : '',
                                Array.isArray(activity.outputData) ? activity.outputData.join(', ') : '',
                                activity.tool || '',
                                activity.layer || '',
                                activity.order || '',
                                activity.x || '',
                                activity.y || '',
                                activity.width || '',
                                activity.height || ''
                            ]);
                        });

                        const activitiesSheet = XLSX.utils.aoa_to_sheet(activitiesData);
                        activitiesSheet['!cols'] = [
                            { wch: 30 }, // ID
                            { wch: 25 }, // 이름
                            { wch: 15 }, // 타입
                            { wch: 15 }, // 역할
                            { wch: 40 }, // 설명
                            { wch: 40 }, // 지시사항
                            { wch: 12 }, // 소요시간
                            { wch: 30 }, // 체크포인트
                            { wch: 30 }, // 입력데이터
                            { wch: 30 }, // 출력데이터
                            { wch: 35 }, // 도구
                            { wch: 8 }, // Layer
                            { wch: 8 }, // Order
                            { wch: 8 }, // X좌표
                            { wch: 8 }, // Y좌표
                            { wch: 8 }, // 너비
                            { wch: 8 } // 높이
                        ];
                        XLSX.utils.book_append_sheet(workbook, activitiesSheet, '4.액티비티');
                    }
                }

                // 5. Elements에서 Event만 추출
                if (processDefinition.elements && processDefinition.elements.length > 0) {
                    const events = processDefinition.elements.filter((el) => el.elementType === 'Event');

                    if (events.length > 0) {
                        const eventsData = [
                            ['ID', '이름', '타입', '역할', '설명', '트리거', 'BPMN타입', 'Layer', 'Order', 'X좌표', 'Y좌표', '너비', '높이']
                        ];

                        events.forEach((event) => {
                            eventsData.push([
                                event.id || '',
                                event.name || '',
                                event.type || '',
                                event.role || '',
                                event.description || '',
                                event.trigger || '',
                                event.bpmnType || '',
                                event.layer || '',
                                event.order || '',
                                event.x || '',
                                event.y || '',
                                event.width || '',
                                event.height || ''
                            ]);
                        });

                        const eventsSheet = XLSX.utils.aoa_to_sheet(eventsData);
                        eventsSheet['!cols'] = [
                            { wch: 30 }, // ID
                            { wch: 25 }, // 이름
                            { wch: 15 }, // 타입
                            { wch: 15 }, // 역할
                            { wch: 40 }, // 설명
                            { wch: 30 }, // 트리거
                            { wch: 20 }, // BPMN타입
                            { wch: 8 }, // Layer
                            { wch: 8 }, // Order
                            { wch: 8 }, // X좌표
                            { wch: 8 }, // Y좌표
                            { wch: 8 }, // 너비
                            { wch: 8 } // 높이
                        ];
                        XLSX.utils.book_append_sheet(workbook, eventsSheet, '5.이벤트');
                    }
                }

                // 6. Elements에서 Gateway만 추출
                if (processDefinition.elements && processDefinition.elements.length > 0) {
                    const gateways = processDefinition.elements.filter((el) => el.elementType === 'Gateway');

                    if (gateways.length > 0) {
                        const gatewaysData = [
                            ['ID', '이름', '타입', '역할', '설명', '조건', 'BPMN타입', 'Layer', 'Order', 'X좌표', 'Y좌표', '너비', '높이']
                        ];

                        gateways.forEach((gateway) => {
                            gatewaysData.push([
                                gateway.id || '',
                                gateway.name || '',
                                gateway.type || '',
                                gateway.role || '',
                                gateway.description || '',
                                gateway.condition || '',
                                gateway.bpmnType || '',
                                gateway.layer || '',
                                gateway.order || '',
                                gateway.x || '',
                                gateway.y || '',
                                gateway.width || '',
                                gateway.height || ''
                            ]);
                        });

                        const gatewaysSheet = XLSX.utils.aoa_to_sheet(gatewaysData);
                        gatewaysSheet['!cols'] = [
                            { wch: 30 }, // ID
                            { wch: 25 }, // 이름
                            { wch: 15 }, // 타입
                            { wch: 15 }, // 역할
                            { wch: 40 }, // 설명
                            { wch: 30 }, // 조건
                            { wch: 20 }, // BPMN타입
                            { wch: 8 }, // Layer
                            { wch: 8 }, // Order
                            { wch: 8 }, // X좌표
                            { wch: 8 }, // Y좌표
                            { wch: 8 }, // 너비
                            { wch: 8 } // 높이
                        ];
                        XLSX.utils.book_append_sheet(workbook, gatewaysSheet, '6.게이트웨이');
                    }
                }

                // 7. Elements에서 Sequence만 추출 (순서/흐름)
                if (processDefinition.elements && processDefinition.elements.length > 0) {
                    const sequences = processDefinition.elements.filter((el) => el.elementType === 'Sequence');

                    if (sequences.length > 0) {
                        const sequencesData = [['ID', '이름', '시작(Source)', '종료(Target)', '조건', 'Waypoints']];

                        sequences.forEach((seq) => {
                            const waypoints =
                                seq.waypoints && Array.isArray(seq.waypoints)
                                    ? seq.waypoints.map((wp) => `(${wp.x},${wp.y})`).join(' → ')
                                    : '';

                            sequencesData.push([
                                seq.id || '',
                                seq.name || '',
                                seq.source || '',
                                seq.target || '',
                                seq.condition || '',
                                waypoints
                            ]);
                        });

                        const sequencesSheet = XLSX.utils.aoa_to_sheet(sequencesData);
                        sequencesSheet['!cols'] = [
                            { wch: 30 }, // ID
                            { wch: 30 }, // 이름
                            { wch: 30 }, // 시작
                            { wch: 30 }, // 종료
                            { wch: 40 }, // 조건
                            { wch: 50 } // Waypoints
                        ];
                        XLSX.utils.book_append_sheet(workbook, sequencesSheet, '7.시퀀스(흐름)');
                    }
                }

                // 8. SubProcesses 시트
                if (processDefinition.subProcesses && processDefinition.subProcesses.length > 0) {
                    const subProcessesData = [['ID', '이름', '설명', '타입']];

                    processDefinition.subProcesses.forEach((subProc) => {
                        subProcessesData.push([subProc.id || '', subProc.name || '', subProc.description || '', subProc.type || '']);
                    });

                    const subProcessesSheet = XLSX.utils.aoa_to_sheet(subProcessesData);
                    subProcessesSheet['!cols'] = [
                        { wch: 30 }, // ID
                        { wch: 30 }, // 이름
                        { wch: 50 }, // 설명
                        { wch: 20 } // 타입
                    ];
                    XLSX.utils.book_append_sheet(workbook, subProcessesSheet, '8.서브프로세스');
                }

                // 파일 이름 생성
                const fileName = `${processDefinition.processDefinitionName || 'process'}_${new Date().getTime()}.xlsx`;

                // 엑셀 파일 생성 및 다운로드
                XLSX.writeFile(workbook, fileName);

                console.log('✅ 엑셀 파일 다운로드 완료:', fileName);
            } catch (error) {
                console.error('❌ 엑셀 다운로드 실패:', error);
                alert('엑셀 파일 다운로드에 실패했습니다.');
            }
        }
    }
};
</script>

<style scoped>
/* 트리뷰 카드 스타일 */
.tree-view-card {
    height: 100%;
    overflow-y: auto;
    border-right: 1px solid #e0e0e0;
}

/* 채팅 컨테이너 스타일 */
.chat-container {
    height: 100%;
}

/* 프로세스 트리 스타일 */
.process-tree {
    user-select: none;
}

/* 트리 노드 텍스트 스타일 */
.tree-node-text {
    padding: 8px 12px;
    border-radius: 4px;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    width: 100%;
}

/* Sub 프로세스는 클릭 가능 */
.tree-node-text.is-sub {
    cursor: pointer;
}

.tree-node-text.is-sub:hover {
    background-color: rgba(25, 118, 210, 0.08);
    color: #1976d2;
}

/* 스크롤바 스타일 */
.tree-view-card::-webkit-scrollbar {
    width: 6px;
}

.tree-view-card::-webkit-scrollbar-track {
    background: transparent;
}

.tree-view-card::-webkit-scrollbar-thumb {
    background: #c0c0c0;
    border-radius: 3px;
}

.tree-view-card::-webkit-scrollbar-thumb:hover {
    background: #a0a0a0;
}

/* 도메인 필터 탭 스타일 */
.domain-filter-tabs {
    border-bottom: 1px solid #e0e0e0;
    padding-bottom: 8px;
}

.domain-filter-tabs :deep(.v-chip-group) {
    flex-wrap: wrap;
    gap: 4px;
}

.domain-filter-tabs :deep(.v-chip) {
    margin: 2px;
}

.domain-colored-chip {
    background-color: var(--chip-color) !important;
    color: white !important;
    border-color: var(--chip-color) !important;
}
</style>
