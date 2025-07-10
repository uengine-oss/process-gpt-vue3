<template>
    <v-row class="justify-center">
        <!-- 좌측: 리스트 -->
        <v-col cols="12" lg="6">
            <v-card flat>
                <v-card-item>
                    <h5 class="text-h5 mb-4">MCP Servers</h5>
                    
                    <v-list>
                        <v-list-item
                            v-for="(server, key) in mcpServers"
                            :key="key"
                            class="mb-2"
                            :class="{ 'bg-grey-lighten-4': editingKey === key }"
                        >
                            <template v-slot:prepend>
                                <v-icon
                                    :icon="getServerIcon(server)"
                                    :color="getServerColor(server)"
                                    size="24"
                                ></v-icon>
                            </template>
                            
                            <v-list-item-title class="font-weight-medium">
                                {{ formatServerName(key) }}
                            </v-list-item-title>
                            
                            <v-list-item-subtitle class="text-caption">
                                {{ getServerDescription(server) }}
                            </v-list-item-subtitle>
                            
                            <template v-slot:append>
                                <div class="d-flex align-center">
                                    <v-btn
                                        icon="mdi-pencil"
                                        variant="text"
                                        size="small"
                                        class="mr-2"
                                        @click.stop="editJson(key)"
                                    ></v-btn>
                                    <v-switch
                                        :model-value="server.enabled"
                                        color="primary"
                                        hide-details
                                        density="compact"
                                        @update:model-value="toggleServer(key, server)"
                                    ></v-switch>
                                </div>
                            </template>
                        </v-list-item>
                        
                        <v-list-item class="mt-4" @click="addNewMCP">
                            <template v-slot:prepend>
                                <v-icon icon="mdi-plus" color="primary" size="24"></v-icon>
                            </template>
                            
                            <v-list-item-title class="font-weight-medium text-primary">
                                새 MCP 서버 추가
                            </v-list-item-title>
                        </v-list-item>
                    </v-list>
                </v-card-item>
            </v-card>
        </v-col>

        <!-- 우측: 수정 화면 (데스크톱) -->
        <v-col cols="12" lg="6" class="d-none d-lg-block">
            <v-card v-if="editingKey && !isAddMode" flat>
                <v-card-item>
                    <h5 class="text-h5 mb-3">{{ formatServerName(editingKey) }}</h5>
                    <v-textarea
                        v-model="mcpJsonText"
                        variant="outlined"
                        rows="12"
                        auto-grow
                        class="font-family-monospace"
                    ></v-textarea>

                    <div class="d-flex justify-space-between pb-2">
                        <v-btn
                            color="error"
                            rounded
                            class="mr-auto"
                            @click="deleteServer"
                        >
                            삭제
                        </v-btn>
                        <div class="d-flex align-center">
                            <v-btn
                                color="grey"
                                rounded
                                class="mr-2"
                                @click="closeEdit"
                            >
                                취소
                            </v-btn>
                            <v-btn
                                color="primary"
                                rounded
                                @click="saveServerChanges"
                                :loading="saving"
                            >
                                저장
                            </v-btn>
                        </div>
                    </div>
                </v-card-item>
            </v-card>
            
            <v-card v-else-if="isAddMode && !editingKey" flat>
                <v-card-item>
                    <h5 class="text-h5 mb-3">New MCP</h5>
                    <v-textarea
                        v-model="newJsonText"
                        variant="outlined"
                        rows="12"
                        auto-grow
                        class="font-family-monospace"
                    ></v-textarea>

                    <div class="d-flex justify-end pb-2">
                        <v-btn
                            color="grey"
                            rounded
                            class="mr-2"
                            @click="closeEdit"
                        >
                            취소
                        </v-btn>
                        <v-btn
                            color="primary"
                            rounded
                            @click="saveNewMCP"
                            :loading="adding"
                        >
                            추가
                        </v-btn>
                    </div>
                </v-card-item>
            </v-card>

            <v-card v-else elevation="10" class="d-flex align-center justify-center" style="height: 400px;">
                <div class="text-center">
                    <v-icon size="64" color="grey-lighten-1" class="mb-4">mdi-server</v-icon>
                    <h6 class="text-h6 text-grey">서버를 선택하여 설정을 편집하세요</h6>
                    <p class="text-caption text-grey">좌측 리스트에서 편집 아이콘을 클릭하세요</p>
                </div>
            </v-card>
        </v-col>
    </v-row>

    <!-- 모바일용 수정 다이얼로그 -->
    <v-dialog v-model="editDialog" fullscreen transition="dialog-bottom-transition">
        <v-card>
            <v-toolbar color="primary">
                <v-btn icon @click="closeEdit">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
                <v-toolbar-title>{{ editingKey ? formatServerName(editingKey) : 'New MCP' }}</v-toolbar-title>
                <v-spacer></v-spacer>
                <v-btn v-if="editingKey" color="error" @click="deleteServer">삭제</v-btn>
                <v-btn color="white" @click="editingKey ? saveServerChanges : addCustomServer" :loading="saving || adding">
                    {{ editingKey ? '저장' : '추가' }}
                </v-btn>
            </v-toolbar>
            
            <v-card-text class="pa-4">
                <v-textarea
                    v-if="editingKey"
                    v-model="mcpJsonText"
                    variant="outlined"
                    rows="15"
                    auto-grow
                    class="font-family-monospace"
                ></v-textarea>
                <v-textarea
                    v-else
                    v-model="newJsonText"
                    variant="outlined"
                    rows="15"
                    auto-grow
                    class="font-family-monospace"
                ></v-textarea>
            </v-card-text>
        </v-card>
    </v-dialog>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    data: () => ({
        editingKey: null,
        selectedToolToAdd: null,
        isAddMode: false,
        saving: false,
        adding: false,
        mcpServers: {},
        mcpJsonText: '',
        editDialog: false,
    }),
    async mounted() {
        await this.loadData();
    },
    methods: {
        async loadData() {
            const configuredData = await backend.getMCPByTenant();
            if (configuredData && configuredData.mcpServers) {
                Object.keys(configuredData.mcpServers).forEach(key => {
                    if (configuredData.mcpServers[key].enabled === undefined) {
                        configuredData.mcpServers[key].enabled = true;
                    }
                });
                this.mcpServers = configuredData.mcpServers;
            } else if (configuredData) {
                Object.keys(configuredData).forEach(key => {
                    if (configuredData[key].enabled === undefined) {
                        configuredData[key].enabled = true;
                    }
                });
                this.mcpServers = configuredData;
            }
        },
        editJson(serverKey) {
            this.isAddMode = false;
            this.editingKey = serverKey;
            const server = this.mcpServers[serverKey];
            const jsonData = {
                mcpServers: {
                    [serverKey]: server
                }
            }
            this.mcpJsonText = JSON.stringify(jsonData);

            if (window.innerWidth < 1024) {
                this.editDialog = true;
            }
        },
        addNewMCP() {
            this.editingKey = null;
            this.mcpJsonText = '';
            this.newJsonText = '';
            this.selectedToolToAdd = null;
            this.isAddMode = true;
            
            if (window.innerWidth < 1024) {
                this.editDialog = true;
            }
        },
        closeEdit() {
            this.isAddMode = false;
            this.newJsonText = '';
            this.editingKey = null;
            this.mcpJsonText = '';
            this.editDialog = false;
        },
        async toggleServer(key, newValue) {
            try {
                this.mcpServers[key].enabled = newValue;
                const dataToSave = {
                    mcpServers: JSON.parse(JSON.stringify(this.mcpServers))
                };
                await backend.setMCPByTenant(dataToSave);
            } catch (error) {
                this.mcpServers[key].enabled = !newValue;
                console.error('서버 토글 중 오류:', error);
            }
        },
        async saveServerChanges() {
            if (!this.editingKey) return;
            
            this.saving = true;
            try {
                let parsedJson = {};
                try {
                    parsedJson = JSON.parse(this.mcpJsonText);
                } catch (e) {
                    return;
                }
                
                const updatedServer = {
                    command: parsedJson.command || '',
                    args: parsedJson.args || [],
                    transport: parsedJson.transport || 'stdio',
                    enabled: parsedJson.enabled !== undefined ? parsedJson.enabled : true
                };
                
                if (parsedJson.env) {
                    updatedServer.env = parsedJson.env;
                }
                
                const updatedServers = {
                    ...JSON.parse(JSON.stringify(this.mcpServers)),
                    [this.editingKey]: updatedServer
                };
                
                const dataToSave = {
                    mcpServers: updatedServers
                };
                
                await backend.setMCPByTenant(dataToSave);
                this.mcpServers = updatedServers;
                this.closeEdit();
            } catch (error) {
                console.error('서버 저장 중 오류:', error);
            } finally {
                this.saving = false;
            }
        },
        async deleteServer() {
            if (!this.editingKey) return;
            
            try {
                const updatedServers = { ...this.mcpServers };
                delete updatedServers[this.editingKey];
                const dataToSave = {
                    mcpServers: updatedServers
                };
                await backend.setMCPByTenant(dataToSave);
                this.mcpServers = updatedServers;
                this.closeEdit();
            } catch (error) {
                console.error('서버 삭제 중 오류:', error);
            }
        },
        formatServerName(key) {
            return key.split('-').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ');
        },
        getServerIcon(server) {
            if (server.command === 'npx') return 'mdi-npm';
            if (server.command === 'uvx') return 'mdi-package-variant';
            if (server.command === 'deno') return 'mdi-language-javascript';
            if (server.type === 'url') return 'mdi-web';
            return 'mdi-server';
        },
        getServerColor(server) {
            if (server.command === 'npx') return 'orange';
            if (server.command === 'uvx') return 'blue';
            if (server.command === 'deno') return 'green';
            if (server.type === 'url') return 'purple';
            return 'grey';
        },
        getServerDescription(server) {
            if (server.command === 'npx') return 'Node.js Package';
            if (server.command === 'uvx') return 'Python Package';
            if (server.command === 'deno') return 'Deno Runtime';
            if (server.type === 'url') return 'Web Service';
            return 'Custom Server';
        },
        async saveNewMCP() {
            if (!this.newJsonText.trim()) return;
            
            this.adding = true;
            try {
                let parsedJson = {};
                try {
                    parsedJson = JSON.parse(this.newJsonText);
                } catch (e) {
                    console.error('JSON 파싱 오류:', e);
                    return;
                }

                const mcpServers = parsedJson.mcpServers;
                let serverKey = '';
                if (mcpServers) {
                    serverKey = Object.keys(mcpServers)[0];
                } else {
                    serverKey = `custom-server-${Date.now()}`;
                }
                
                const newServer = {
                    command: mcpServers[serverKey].command || '',
                    args: mcpServers[serverKey].args || [],
                    transport: mcpServers[serverKey].transport || 'stdio',
                    enabled: mcpServers[serverKey].enabled !== undefined ? mcpServers[serverKey].enabled : true
                };
                
                if (mcpServers[serverKey].env) {
                    newServer.env = mcpServers[serverKey].env;
                }
                
                const updatedServers = {
                    ...this.mcpServers,
                    [serverKey]: newServer
                };
                const dataToSave = {
                    mcpServers: updatedServers
                };

                await backend.setMCPByTenant(dataToSave);
                this.mcpServers = updatedServers;
                this.newJsonText = '';
                this.selectedToolToAdd = null;
            } catch (error) {
                console.error('사용자 정의 서버 추가 중 오류:', error);
            } finally {
                this.adding = false;
            }
        }
    }
};
</script>

<style scoped>
.v-list-item {
    transition: background-color 0.2s ease;
}

.v-list-item:hover {
    background-color: rgba(var(--v-theme-primary), 0.1);
}

/* 모바일 다이얼로그 스타일 */
.dialog-bottom-transition-enter-active,
.dialog-bottom-transition-leave-active {
    transition: transform 0.3s ease-in-out;
}

.dialog-bottom-transition-enter-from,
.dialog-bottom-transition-leave-to {
    transform: translateY(100%);
}
</style>
