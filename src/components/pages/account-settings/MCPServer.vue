<template>
    <v-row class="justify-center ma-0 pa-0">
        <!-- 좌측: 리스트 -->
        <v-col cols="12" lg="6" style="overflow: auto;"
            :style="!isMobile ? 'height: calc(100vh - 205px);' : 'height: calc(100vh - 80px);'"
        >
            <v-card flat class="pa-1">
                <v-card-item class="pa-0">
                    <!-- <h5 class="text-h5 mb-4">MCP Servers</h5> -->

                    <v-list>
                        <v-list-item
                            v-for="(server, key) in mcpServers"
                            :key="key"
                            class="mb-2"
                            :class="{ 'bg-grey-lighten-4': editingKey === key }"
                        >
                            <template v-slot:prepend>
                                <v-icon :icon="getServerIcon(server)" :color="getServerColor(server)" size="24"></v-icon>
                            </template>

                            <v-list-item-title class="font-weight-medium">
                                {{ formatServerName(key) }}
                            </v-list-item-title>

                            <v-list-item-subtitle class="text-caption">
                                {{ getServerDescription(server) }}
                            </v-list-item-subtitle>

                            <template v-slot:append>
                                <div class="d-flex align-center">
                                    <v-btn icon="mdi-pencil" variant="text" size="small" class="mr-2" @click.stop="editJson(key)"></v-btn>
                                    <v-switch
                                        :model-value="server.enabled"
                                        color="primary"
                                        hide-details
                                        density="compact"
                                        @update:model-value="toggleServer(key, server.enabled)"
                                    ></v-switch>
                                </div>
                            </template>
                        </v-list-item>

                        <!-- <v-list-item class="mt-4" @click="addNewMCP">
                            <template v-slot:prepend>
                                <v-icon icon="mdi-plus" color="primary" size="24"></v-icon>
                            </template>

                            <v-list-item-title class="font-weight-medium text-primary"> 새 MCP 서버 추가 </v-list-item-title>
                        </v-list-item> -->
                    </v-list>
                </v-card-item>
            </v-card>
        </v-col>

        <!-- 우측: 수정 화면 (데스크톱) -->
        <v-col cols="12" lg="6" class="d-none d-lg-block pa-4">
            <v-card v-if="editingKey && !isAddMode" flat>
                <v-card-item class="pt-0">
                    <h5 class="text-h5 mb-3">{{ formatServerName(editingKey) }}</h5>
                    <div style="height: 40vh">
                        <!-- <vue-monaco-editor
                            v-model:value="mcpJsonText"
                            language="json"
                            :options="MONACO_EDITOR_OPTIONS"
                            @mount="handleMount"
                        /> -->
                        <v-textarea v-model="mcpJsonText" label="MCP JSON" rows="10" />
                    </div>

                    <div class="d-flex justify-space-between pb-2">
                        <v-btn color="grey" variant="flat" rounded class="mr-auto" @click="deleteServer">{{ $t('accountTab.delete') }}</v-btn>
                        <div class="d-flex align-center">
                            <v-btn color="grey" variant="flat" rounded class="mr-2" @click="closeEdit">{{ $t('accountTab.cancel') }}</v-btn>
                            <v-btn color="primary" variant="flat" rounded @click="saveServerChanges" :loading="saving">{{ $t('accountTab.save') }}</v-btn>
                        </div>
                    </div>
                </v-card-item>
            </v-card>

            <v-card v-else-if="isAddMode && !editingKey" flat>
                <v-card-item class="pt-0">
                    <h5 class="text-h5 mb-3">New MCP</h5>
                    <div style="height: 40vh">
                        <!-- <vue-monaco-editor
                            v-model:value="newJsonText"
                            language="json"
                            :options="MONACO_EDITOR_OPTIONS"
                            @mount="handleMount"
                        /> -->
                        <v-textarea v-model="newJsonText" label="MCP JSON" rows="10" />
                    </div>

                    <div class="d-flex justify-end pb-2">
                        <v-btn color="grey" variant="flat" rounded class="mr-2" @click="closeEdit">{{ $t('accountTab.cancel') }}</v-btn>
                        <v-btn color="primary" variant="flat" rounded @click="saveNewMCP" :loading="adding">{{ $t('accountTab.add') }}</v-btn>
                    </div>
                </v-card-item>
            </v-card>

            <v-card v-else elevation="10" class="d-flex align-center justify-center add-mcp-server" @click="addNewMCP">
                <div class="text-center">
                    <v-icon size="64" color="gray" class="mb-4 server-icon">mdi-server</v-icon>
                    <v-list-item class="mt-4 add-mcp-server-item">
                        
                        <v-row class="pa-0 ma-0 align-center">
                            <v-icon icon="mdi-plus" color="gray" size="24" class="plus-icon" style="padding-top: 1px;"></v-icon>
                            <v-list-item-title class="font-weight-medium text-gray ml-2 server-title">{{ $t('accountTab.addMCPServer') }}</v-list-item-title>
                        </v-row>
                    </v-list-item>
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
                <v-btn v-if="editingKey" color="error" @click="deleteServer">{{ $t('accountTab.delete') }}</v-btn>
                <v-btn color="white" @click="editingKey ? saveServerChanges : addCustomServer" :loading="saving || adding">
                    {{ editingKey ? $t('accountTab.save') : $t('accountTab.add') }}
                </v-btn>
            </v-toolbar>

            <v-card-text class="pa-4">
                <div style="height: 40vh">
                    <!-- <vue-monaco-editor
                        v-if="editingKey"
                        v-model:value="mcpJsonText"
                        language="json"
                        :options="MONACO_EDITOR_OPTIONS"
                        @mount="handleMount"
                    />
                    <vue-monaco-editor
                        v-else
                        v-model:value="newJsonText"
                        language="json"
                        :options="MONACO_EDITOR_OPTIONS"
                        @mount="handleMount"
                    /> -->
                    <v-textarea v-if="editingKey" v-model="mcpJsonText" label="MCP JSON" rows="10" />
                    <v-textarea v-else v-model="newJsonText" label="MCP JSON" rows="10" />
                </div>
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
        MONACO_EDITOR_OPTIONS: {
            automaticLayout: true,
            formatOnType: true,
            formatOnPaste: true
        }
    }),
    async mounted() {
        await this.loadData();
    },
    methods: {
        async getMCPLists() {
            console.log('getMCPLists');
            const mcpLists = await backend.getMCPLists();
            this.mcpLists = mcpLists;
        },
        async loadData() {
            const configuredData = await backend.getMCPByTenant();
            if (configuredData && configuredData.mcpServers) {
                Object.keys(configuredData.mcpServers).forEach((key) => {
                    if (configuredData.mcpServers[key].enabled === undefined) {
                        configuredData.mcpServers[key].enabled = true;
                    }
                });
                this.mcpServers = configuredData.mcpServers;
            } else if (configuredData) {
                Object.keys(configuredData).forEach((key) => {
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
            };
            this.mcpJsonText = JSON.stringify(jsonData);

            if (window.innerWidth < 1024) {
                this.editDialog = true;
            }
        },
        addNewMCP() {
            this.editingKey = null;
            this.mcpJsonText = '';
            this.selectedToolToAdd = null;
            this.isAddMode = true;

            const newJson = { mcpServers: {} };
            this.newJsonText = JSON.stringify(newJson);

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
        async toggleServer(key, value) {
            try {
                this.mcpServers[key].enabled = !value;
                await backend.setMCPByTenant(this.mcpServers);
            } catch (error) {
                this.mcpServers[key].enabled = !value;
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
                
                let updatedServer = {};
                
                if (parsedJson.mcpServers && parsedJson.mcpServers[this.editingKey]) {
                    // mcpServers 구조에서 해당 서버 정보 추출
                    const serverData = parsedJson.mcpServers[this.editingKey];
                    updatedServer = {
                        command: serverData.command || '',
                        args: serverData.args || [],
                        transport: serverData.transport || 'stdio',
                        enabled: serverData.enabled !== undefined ? serverData.enabled : true
                    };

                    if (serverData.env) {
                        updatedServer.env = serverData.env;
                    }
                } else {
                    // 직접 서버 설정인 경우
                    updatedServer = {
                        command: parsedJson.command || '',
                        args: parsedJson.args || [],
                        transport: parsedJson.transport || 'stdio',
                        enabled: parsedJson.enabled !== undefined ? parsedJson.enabled : true
                    };

                    if (parsedJson.env) {
                        updatedServer.env = parsedJson.env;
                    }
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
            return key
                .split('-')
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
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

                // mcpServers 구조가 있는 경우와 없는 경우를 구분하여 처리
                let serverKey = '';
                let newServer = {};

                if (parsedJson.mcpServers) {
                    // mcpServers 구조가 있는 경우
                    const mcpServers = parsedJson.mcpServers;
                    serverKey = Object.keys(mcpServers)[0];
                    if (!serverKey) {
                        serverKey = `custom-server-${Date.now()}`;
                    }
                    
                    newServer = {
                        command: mcpServers[serverKey].command || '',
                        args: mcpServers[serverKey].args || [],
                        transport: mcpServers[serverKey].transport || 'stdio',
                        enabled: mcpServers[serverKey].enabled !== undefined ? mcpServers[serverKey].enabled : true
                    };

                    if (mcpServers[serverKey].env) {
                        newServer.env = mcpServers[serverKey].env;
                    }
                } else {
                    // mcpServers 구조가 없는 경우 (직접 서버 설정)
                    serverKey = `custom-server-${Date.now()}`;
                    newServer = {
                        command: parsedJson.command || '',
                        args: parsedJson.args || [],
                        transport: parsedJson.transport || 'stdio',
                        enabled: parsedJson.enabled !== undefined ? parsedJson.enabled : true
                    };

                    if (parsedJson.env) {
                        newServer.env = parsedJson.env;
                    }
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
                this.closeEdit();
            } catch (error) {
                console.error('사용자 정의 서버 추가 중 오류:', error);
            } finally {
                this.adding = false;
            }
        }
    },
    computed: {
        isMobile() {
            return window.innerWidth <= 768;
        }
    }
};
</script>

<style scoped>
.add-mcp-server {
    height: 400px; 
    border: 3px dashed rgba(128, 128, 128, 0.5);
}
.add-mcp-server:hover {
    border: 3px dashed rgba(var(--v-theme-primary), 1);
    background-color: rgba(var(--v-theme-primary), 0.1);
}
.add-mcp-server:hover .server-icon {
    color: rgb(var(--v-theme-primary)) !important;
}
.add-mcp-server:hover .plus-icon {
    color: rgb(var(--v-theme-primary)) !important;
}
.add-mcp-server:hover .server-title {
    color: rgb(var(--v-theme-primary)) !important;
}
.v-list-item {
    transition: background-color 0.2s ease;
}
.v-list-item:hover {
    background-color: rgba(var(--v-theme-primary), 0.1);
}
.v-list-item.add-mcp-server-item:hover {
    background-color: rgba(var(--v-theme-primary), 0);
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
