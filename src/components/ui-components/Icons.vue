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
            const storageKey = `icons-${this.icon}`;
            const hashKey = `icons-hash-${this.icon}`;

            const response = await fetch(`/assets/images/icon/${this.icon}.svg`);
            let svg = await response.text();

            // 없는 아이콘을 부르면 SPA 서버가 index.html 을 돌려준다. 그대로 v-html 로 넣으면 그 안의
            // <meta name="viewport"> 까지 문서에 들어가 휴대폰 화면 폭이 기기 폭으로 돌아간다(2026-11-11).
            // SVG 가 아니면 그리지도, 캐시에 남기지도 않는다(예전에 남은 것도 지운다).
            if (!response.ok || !/<svg[\s>]/i.test(svg) || /<html[\s>]/i.test(svg)) {
                localStorage.removeItem(storageKey);
                localStorage.removeItem(hashKey);
                this.svgContent = '';
                return;
            }

            // 해시 값 계산
            const hash = await this.calculateHash(svg);

            const cachedHash = localStorage.getItem(hashKey);

            if (cachedHash !== hash) {
                // 해시 값이 다르면 업데이트
                localStorage.setItem(storageKey, svg);
                localStorage.setItem(hashKey, hash);
                this.updateSvgContent(svg);
            } else {
                // 해시 값이 같으면 캐시된 SVG 사용
                const cachedSvg = localStorage.getItem(storageKey);
                if (cachedSvg) {
                    this.updateSvgContent(cachedSvg);
                }
            }
        },
        async calculateHash(content) {
            // Web Crypto의 subtle API는 HTTPS 또는 localhost 같은 secure context에서만
            // 제공된다. 아이콘 캐시 무효화 용도이므로 HTTP 환경에서는 결정적인
            // 비암호화 해시로 대체해도 충분하다.
            if (!globalThis.crypto?.subtle) {
                let hash = 0x811c9dc5;
                for (let i = 0; i < content.length; i += 1) {
                    hash ^= content.charCodeAt(i);
                    hash = Math.imul(hash, 0x01000193);
                }
                return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
            }

            const encoder = new TextEncoder();
            const data = encoder.encode(content);
            const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
            return hashHex;
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
