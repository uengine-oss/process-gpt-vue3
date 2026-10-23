<template>
    <v-dialog v-model="open" fullscreen transition="dialog-bottom-transition" :scrim="false">
        <v-card class="n8n-studio">
            <v-toolbar density="comfortable" flat color="transparent" class="n8n-studio__bar">
                <Icons :icon="'flowchart'" :size="18" class="ml-4 mr-2" />
                <v-toolbar-title class="text-body-1 font-weight-medium">
                    {{ agentName || $t('n8nStudio.title') }}
                </v-toolbar-title>
                <v-spacer />
                <span class="n8n-studio__hint mr-3">{{ $t('n8nStudio.saveHint') }}</span>
                <v-btn variant="text" density="comfortable" @click="close">
                    <Icons :icon="'close'" :size="16" />
                </v-btn>
            </v-toolbar>

            <div class="n8n-studio__frame">
                <v-progress-linear v-if="loading" indeterminate color="primary" absolute />
                <iframe
                    v-if="workflowId"
                    ref="frame"
                    :src="src"
                    class="n8n-studio__iframe"
                    @load="onFrameLoad"
                />
                <div v-else class="n8n-studio__empty">
                    {{ $t('n8nStudio.noWorkflow') }}
                </div>
            </div>
        </v-card>
    </v-dialog>
</template>

<script>
/**
 * The n8n canvas, opened in place.
 *
 * n8n owns the editing experience — reimplementing a node canvas would be a
 * second product — so the studio is embedded rather than rebuilt. What this
 * component owns is the *seam*: the frame gets ProcessGPT's current appearance
 * pushed into it so the canvas is not a bright rectangle inside a dark app, and
 * a save inside the frame is reported back so the caller can refresh the
 * agent's summary without the user closing and reopening the dialog.
 *
 * The forked editor-ui reads these messages (see services/n8n-editor-ui);
 * against an unforked n8n they are simply ignored, and the studio still works.
 */
import { getAppearance } from '@/ds/appearance';
import { studioUrl } from '@/utils/n8nApi';

export default {
    name: 'N8nStudioDialog',
    props: {
        modelValue: { type: Boolean, default: false },
        workflowId: { type: String, default: '' },
        agentName: { type: String, default: '' }
    },
    emits: ['update:modelValue', 'saved'],
    data: () => ({
        loading: true
    }),
    computed: {
        open: {
            get() {
                return this.modelValue;
            },
            set(value) {
                this.$emit('update:modelValue', value);
            }
        },
        src() {
            return studioUrl(this.workflowId);
        }
    },
    watch: {
        modelValue(value) {
            if (value) this.loading = true;
        }
    },
    mounted() {
        window.addEventListener('message', this.onMessage);
        // The app's own theme switch has to reach the frame too, or changing
        // appearance with the studio open leaves half the screen behind.
        window.addEventListener('pg:appearance-changed', this.pushAppearance);
    },
    beforeUnmount() {
        window.removeEventListener('message', this.onMessage);
        window.removeEventListener('pg:appearance-changed', this.pushAppearance);
    },
    methods: {
        onFrameLoad() {
            this.loading = false;
            this.pushAppearance();
        },
        pushAppearance() {
            const frame = this.$refs.frame;
            if (!frame?.contentWindow) return;
            frame.contentWindow.postMessage(
                { source: 'processgpt', type: 'appearance', appearance: getAppearance() },
                window.location.origin
            );
        },
        onMessage(event) {
            // Same-origin only: the studio is served through our own gateway
            // path, so anything from elsewhere is not the studio.
            if (event.origin !== window.location.origin) return;
            const payload = event.data;
            if (payload?.source !== 'n8n-studio') return;

            if (payload.type === 'workflow-saved') {
                this.$emit('saved', { workflowId: this.workflowId, name: payload.name });
            } else if (payload.type === 'close') {
                this.close();
            }
        },
        close() {
            this.open = false;
        }
    }
};
</script>

<style scoped>
.n8n-studio {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--cds-surface-1, #fff);
}

.n8n-studio__bar {
    /* The bar is a frame around the canvas, not a banner. Vuetify's default
       toolbar colour is the theme primary, which would put a solid orange
       block above an editor whose own accent is that same orange. */
    border-bottom: 1px solid var(--cds-border);
    background: var(--cds-surface-1, var(--cds-surface-2, #fff)) !important;
    color: var(--cds-text-primary) !important;
}

/* The app paints `.v-toolbar__content` with the brand colour globally, and that
   inner element is what actually shows — `color="transparent"` only clears the
   toolbar root. :deep() because the element belongs to Vuetify, not to us. */
.n8n-studio__bar :deep(.v-toolbar__content) {
    background: transparent !important;
    color: var(--cds-text-primary) !important;
}

.n8n-studio__hint {
    font-size: 12px;
    color: var(--cds-text-secondary);
}

.n8n-studio__frame {
    position: relative;
    flex: 1 1 auto;
    min-height: 0;
}

.n8n-studio__iframe {
    width: 100%;
    height: 100%;
    border: 0;
    display: block;
}

.n8n-studio__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--cds-text-secondary);
}
</style>
