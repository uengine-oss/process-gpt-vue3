<template>
    <v-card elevation="10" style="height: calc(100vh - 143px);">
        <div class="d-flex">
            <div class="px-3 py-3 pb-2 pl-4 align-center">
                <div class="d-flex">
                    <h5 class="text-h5 font-weight-semibold">
                        {{ title }}
                    </h5>
                </div>
            </div>
        </div>
        <v-divider></v-divider>

        <v-card-text class="pa-4">
            <perfect-scrollbar class="h-100" ref="scrollContainer" @scroll="handleScroll">
                <div class="d-flex w-100 chat-view-box">
                    <v-col>
                        <div class="px-1 py-1">
                            <div style="margin-top: -20px;">
                                <v-row class="ma-0 pa-0">
                                    <v-row class="ma-0 pa-0 d-flex align-center mb-2">
                                        <v-avatar size="40" style="margin-right:10px;">
                                            <img src="@/assets/images/chat/chat-icon.png" height="40" width="40" />
                                        </v-avatar>
                                        <div class="user-name">System</div>
                                    </v-row>
                                </v-row>
                                <div class="w-100 pb-3">
                                    <div class="progress-border">
                                        <v-sheet class="chat-message-bubble rounded-md px-3 py-2" :class="'other-message'">
                                            <pre class="text-body-1">{{ streamingText }}</pre>
                                        </v-sheet>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </v-col>
                </div>
            </perfect-scrollbar>
        </v-card-text>
    </v-card>
</template>

<script>
import BackendFactory from "@/components/api/BackendFactory";
const backend = BackendFactory.createBackend();

export default {
    props: {
        instance: Object,
    },
    data() {
        return {
            processDefinition: null,
            title: '',
            streamingText: '...',
        }
    },
    computed: {
        isNewInstance() {
            if (this.$route.fullPath.includes('instancelist/running')) {
                return true;
            }
            return false;
        },
        procDefId() {
            return this.$route.query.proc_def_id;
        }
    },
    async created() {
        if (this.isNewInstance) {
            this.processDefinition = await backend.getRawDefinition(this.procDefId);
            this.title = this.processDefinition.name + this.$t('runningInstance.running');
        } else {
            this.title = this.instance.name;
        }
    },
    mounted() {
        this.EventBus.on('process-instance-streaming', (text) => {
            this.streamingText = this.title + '\n' + text;
        });
    }
}
</script>

<style scoped>
.chat-view-box {
    height: calc(100vh - 220px);
    overflow: auto;
}

.chat-message-bubble {
  position: relative;
  max-width: 70%;
  margin-bottom: 4px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1) !important;
}

.other-message {
  margin-right: auto;
  background-color: #f1f1f1 !important;
  border-radius: 3px 15px 15px 15px !important;
}
</style>

