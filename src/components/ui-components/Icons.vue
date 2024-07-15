<template>
    <div v-html="svgContent" :icon="`'${icon}'`" :style="{ width: computedWidth + 'px', height: computedHeight + 'px' }"></div>
</template>

<script>
export default {
    name: 'Icons',
    props: {
        icon: {
            type: String,
            required: true
        },
        color: {
            type: String,
            default: '#666666'
        },
        width: {
            type: [String, Number],
            default: null
        },
        height: {
            type: [String, Number],
            default: null
        },
        size: {
            type: [String, Number],
            default: 24
        }
    },
    data() {
        return {
            svgContent: '',
            svgCache: {}
        };
    },
    computed: {
        // width와 height가 지정되지 않은 경우 size를 사용
        computedWidth() {
            return this.width || this.size;
        },
        computedHeight() {
            return this.height || this.size;
        }
    },
    watch: {
        icon: 'loadSvg',
        color: 'loadSvg',
        width: 'loadSvg',
        height: 'loadSvg',
        size: 'loadSvg'
    },
    mounted() {
        this.loadSvg();
    },
    methods: {
        async loadSvg() {
            if (this.svgCache[this.icon]) {
                this.updateSvgContent(this.svgCache[this.icon]);
            } else {
                const response = await fetch(`/assets/images/icon/${this.icon}.svg`);
                let svg = await response.text();
                this.svgCache[this.icon] = svg;
                this.updateSvgContent(svg);
            }
        },
        updateSvgContent(svg) {
            // 기존 fill 속성을 모두 제거
            svg = svg.replace(/fill="[^"]*"/g, '');
            // 모든 path 요소에 fill 속성 추가
            svg = svg.replace(/<path/g, `<path fill="${this.color}"`);
            // 루트 SVG 요소에 width와 height 속성 설정
            svg = svg.replace(/<svg/, `<svg width="${this.computedWidth}" height="${this.computedHeight}"`);
            this.svgContent = svg;
        }
    }
};
</script>