<template>
    <div class="summary-wrapper" 
         :class="isSummaryExpanded ? 'expanded' : ''"
         :style="isSummaryExpanded ? 
             'height: auto; overflow: visible; transition: all 0.3s ease;' : 
             'height: 100px; overflow: hidden; transition: all 0.3s ease;'"
    >
        <div class="summary-button-container" @click.stop="toggleExpanded"
            :style="isSummaryExpanded ? 
                'width: 100%; padding: 0px;' : 
                'padding: 0px 16px 0px 0px;'"
        >
            <div class="summary-document" :class="isSummaryExpanded ? 'expanded' : ''">
                <div class="document-content" :class="isSummaryExpanded ? '' : 'collapsed'">
                    <slot></slot>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    name: 'SummaryButton',
    emits: ['expanded'],
    props: {},
    data() {
        return {
            isSummaryExpanded: false
        }
    },
    methods: {
        toggleExpanded() {
            this.isSummaryExpanded = !this.isSummaryExpanded
            this.$emit('expanded', this.isSummaryExpanded)
        }
    }
}
</script>

<style scoped>
.summary-wrapper {
    width: 100%;
    display: flex;
    justify-content: flex-end;
}

.summary-wrapper.expanded {
    justify-content: flex-start;
}

.summary-button-container {
    cursor: pointer;
}

.summary-document {
    width: 120px;
    height: 120px;
    border-radius: 8px;
    transform: rotate(5deg);
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    transition: all 0.3s ease;
    padding: 8px;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
}

.summary-document:hover {
    transform: rotate(5deg) translateY(-4px);
    box-shadow: 0 6px 16px rgba(0,0,0,0.15);
}

.summary-document.expanded {
    width: 100%;
    height: 100%;
    transform: rotate(0deg);
    overflow-y: auto;
}

.summary-document.expanded .document-content {
    font-size: 14px;
    line-height: 1.6;
    overflow: auto;
}


.document-content {
    width: 100%;
    height: 100%;
    overflow: hidden;
    font-size: 8px;
    line-height: 1.2;
}

.document-content.collapsed {
    overflow: hidden;
    font-size: 6px;
    line-height: 1.1;
}

/* 접힌 모서리 효과 완전 제거 */
</style>
