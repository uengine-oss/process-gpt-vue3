<template>
    <div v-html="svgContent" :style="{ width: width + 'px', height: height + 'px' }"></div>
</template>

<script>
export default {
    name: 'icons',
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
            default: 24
        },
        height: {
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
    watch: {
        icon: 'loadSvg',
        color: 'loadSvg',
        width: 'loadSvg',
        height: 'loadSvg'
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
            svg = svg.replace(/fill="[^"]*"/g, `fill="${this.color}"`);
            svg = svg.replace(/width="[^"]*"/g, `width="${this.width}px"`);
            svg = svg.replace(/height="[^"]*"/g, `height="${this.height}px"`);
            this.svgContent = svg;
        }
    }
};
</script>