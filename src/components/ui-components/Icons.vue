<template>
    <div
        v-html="svgContent"
        :icon="`'${icon}'`"
        :style="{
            width: computedWidth + 'px',
            height: computedHeight + 'px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }"
    ></div>
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
            default: 'currentColor'
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
            svgContent: ''
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
            // 같은 오리진 로컬 SVG라 브라우저 HTTP 캐시로 충분하다.
            // (이전엔 crypto.subtle 로 해시 캐싱을 했으나, crypto.subtle 은 secure context
            //  에서만 동작하여 평문 HTTP/내부 IP 접속 환경에서 아이콘이 렌더되지 않는 문제가 있었음)
            try {
                const response = await fetch(`/assets/images/icon/${this.icon}.svg`);
                if (!response.ok) return;
                const svg = await response.text();
                this.updateSvgContent(svg);
            } catch (e) {
                console.warn(`[Icons] failed to load icon: ${this.icon}`, e);
            }
        },
        shouldAddFill(svg) {
            return (
                !svg.match(/fill="currentColor"/) &&
                !svg.match(/stroke="currentColor"/) &&
                !svg.match(/stroke="none"/) &&
                !svg.match(/fill="none"/)
            );
        },
        resolveThemeColor(colorName) {
            if (!colorName || colorName === 'currentColor') return colorName;
            const themeColors = this.$vuetify?.theme?.current?.colors;
            return themeColors?.[colorName] || colorName;
        },
        updateSvgContent(svg) {
            const resolvedColor = this.resolveThemeColor(this.color);
            if (resolvedColor) {
                svg = svg.replace(/stroke="currentColor"/g, `stroke="${resolvedColor}"`);
                svg = svg.replace(/fill="currentColor"/g, `fill="${resolvedColor}"`);

                if (this.shouldAddFill(svg)) {
                    svg = svg.replace(/<path/g, `<path fill="${resolvedColor}"`);
                }
            }

            svg = svg.replace(/<svg/, `<svg width="${this.computedWidth}" height="${this.computedHeight}"`);

            this.svgContent = svg;
        }
    }
};
</script>
