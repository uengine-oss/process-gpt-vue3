<template>
    <!--
      에이전트 도구 호출 결과를 **도구별로** 그린다.
      이전에는 결과를 평문 하나로만 보여 줘서, 엔티티 해소의 후보·점수나 스키마의 가상/물질화 구분 같은
      판단 근거가 JSON 덩어리 속에 묻혔다. 도구 이름으로 렌더러를 고르고, 모르는 도구는 예전처럼 평문.
    -->
    <div class="trv">
        <div v-if="argsText" class="trv-args"><span class="trv-k">인자</span> {{ argsText }}</div>

        <!-- 엔티티 해소: 판정 + 후보 점수 -->
        <template v-if="kind === 'resolve'">
            <div class="trv-banner" :class="'st-' + res.resolution.status">
                {{ statusLabel(res.resolution.status) }}
                <small>
                    1위 {{ fmt(res.resolution.top_score) }} · 2위 {{ fmt(res.resolution.second_score) }}
                    · 확정 임계 {{ res.resolution.threshold }} · 기권 {{ res.resolution.abstain_below }}
                    · {{ res.resolution.reranker }}
                </small>
            </div>
            <div v-if="res.context" class="trv-dim">맥락 「{{ res.context }}」</div>
            <div v-for="(m, i) in candidates" :key="i" class="trv-cand">
                <div class="trv-lab">
                    <span class="trv-cls">{{ m.class_name }}</span>{{ m.label || labelOf(m) }}
                    <span v-for="s in (m.retrieved_by || [])" :key="s" class="trv-src" :class="'src-' + s">{{ s }}</span>
                    <span v-if="m.key" class="trv-key">{{ keyText(m.key) }}</span>
                </div>
                <div class="trv-bar" :class="{ top: i === 0 && res.resolution.status === 'resolved' }">
                    <i :style="{ width: ((m.score || 0) * 100).toFixed(1) + '%' }"></i>
                    <span class="t" :style="{ left: res.resolution.threshold * 100 + '%' }"></span>
                    <em>{{ fmt(m.score) }}</em>
                </div>
            </div>
        </template>

        <!-- 스키마: 가상(원천 DB) / 물질화(그래프 노드) -->
        <table v-else-if="kind === 'schema'" class="trv-table">
            <tr><th>클래스</th><th>종류</th></tr>
            <tr v-for="c in res.classes" :key="c.class_name">
                <td>{{ c.class_name }}</td>
                <td :class="c.binding_kind === 'virtual' ? 'vk' : 'mk'">
                    {{ c.binding_kind === 'virtual' ? '가상 · 조회 시점에 원천 DB' : '물질화 · 그래프 노드' }}
                </td>
            </tr>
        </table>

        <!-- 행 결과 (SQL · Cypher) -->
        <template v-else-if="kind === 'rows'">
            <div class="trv-dim">{{ res.rows.length }}행<span v-if="res.source"> · {{ res.source.datasource }}</span></div>
            <table v-if="res.rows.length" class="trv-table">
                <tr><th v-for="c in columns" :key="c">{{ c }}</th></tr>
                <tr v-for="(r, i) in res.rows.slice(0, 8)" :key="i">
                    <td v-for="c in columns" :key="c">{{ cell(r[c]) }}</td>
                </tr>
            </table>
        </template>

        <div v-else class="trv-text">{{ rawText }}</div>
    </div>
</template>

<script>
export default {
    name: 'ToolResultView',
    props: {
        toolName: { type: String, default: '' },
        info: { type: [String, Object, Array], default: null },
        args: { type: [Object, String], default: null }
    },
    computed: {
        rawText() {
            if (this.info == null) return '';
            if (typeof this.info === 'string') return this.info;
            const t = this.textOf(this.info);
            return t != null ? t : JSON.stringify(this.info, null, 1);
        },
        res() {
            // deepagents 는 결과를 [{type:'text', text:'<JSON>'}] 로 남기고, MCP 어댑터는 {"result": "<JSON>"} 로 한 번 더 감싼다.
            let v = this.info;
            for (let i = 0; i < 4; i++) {
                if (typeof v === 'string') {
                    try { v = JSON.parse(v); } catch (e) { return null; }
                } else if (Array.isArray(v) && v.length && v[0] && v[0].text !== undefined) {
                    v = v.map((x) => x.text).join('');
                } else if (v && typeof v === 'object' && typeof v.result === 'string' && Object.keys(v).length <= 2) {
                    v = v.result;
                } else break;
            }
            return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
        },
        kind() {
            const r = this.res;
            if (!r) return 'text';
            if (r.resolution && Array.isArray(r.matches)) return 'resolve';
            if (Array.isArray(r.classes) && r.classes.length && r.classes[0].class_name) return 'schema';
            if (Array.isArray(r.rows)) return 'rows';
            return 'text';
        },
        candidates() {
            const r = this.res;
            if (r.matches && r.matches.length) return r.matches;
            return (r.nearest || []).map((n) => ({ ...n, retrieved_by: [] }));
        },
        columns() {
            const r = this.res;
            if (r.columns && r.columns.length) return r.columns;
            return Object.keys(r.rows[0] || {}).filter((k) => !k.startsWith('_'));
        },
        argsText() {
            const a = this.args;
            if (!a) return '';
            const o = typeof a === 'string' ? a : JSON.stringify(a);
            return o.length > 220 ? o.slice(0, 220) + '…' : o;
        }
    },
    methods: {
        textOf(v) {
            if (Array.isArray(v) && v.length && v[0] && v[0].text !== undefined) return v.map((x) => x.text).join('');
            return null;
        },
        fmt(x) { return typeof x === 'number' ? x.toFixed(3) : x == null ? '-' : x; },
        statusLabel(s) {
            return { resolved: '확정 (resolved)', ambiguous: '후보가 여럿 (ambiguous) — 되묻기', no_match: '해당 없음 (no_match) — 추측하지 않음', unranked: '재순위 없이 (unranked)' }[s] || s;
        },
        labelOf(m) {
            const p = m.properties || {};
            return p.name || p.title || p.product_name || p.underlying_name || '';
        },
        keyText(k) { return Object.entries(k || {}).map(([a, b]) => `${a}=${b}`).join(' · '); },
        cell(v) {
            if (v == null) return '';
            const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
            return s.length > 60 ? s.slice(0, 60) + '…' : s;
        }
    }
};
</script>

<style scoped>
.trv { font-size: 12.5px; line-height: 1.45; padding: 6px 2px; }
.trv-args { font-family: Menlo, monospace; color: #5b6b80; margin-bottom: 6px; word-break: break-all; }
.trv-k { font-family: inherit; font-weight: 700; color: #3a4a60; margin-right: 4px; }
.trv-banner { border-radius: 8px; padding: 8px 10px; font-weight: 700; margin-bottom: 6px; }
.trv-banner small { display: block; font-weight: 400; opacity: .85; margin-top: 2px; }
.st-resolved { background: #e3f7ee; color: #127a52; border: 1px solid #9fe0c3; }
.st-ambiguous { background: #fff4e0; color: #95600a; border: 1px solid #f2cf8c; }
.st-no_match, .st-unranked { background: #fde8ec; color: #9b2340; border: 1px solid #f1b3c1; }
.trv-dim { color: #6b7a90; margin: 2px 0 6px; }
.trv-cand { display: grid; grid-template-columns: 1fr 180px; gap: 8px; align-items: center; padding: 4px 0; border-bottom: 1px dashed #e3e8ef; }
.trv-cls { font-family: Menlo, monospace; font-size: 11px; color: #7a4fd0; margin-right: 6px; }
.trv-src { font-size: 10.5px; border-radius: 4px; padding: 0 4px; margin-left: 4px; border: 1px solid; }
.src-lexical { color: #2d6aa0; border-color: #9cc3e6; } .src-vector { color: #7a4fd0; border-color: #c9b3f0; } .src-sql { color: #1d8a5d; border-color: #9fe0c3; }
.trv-key { font-family: Menlo, monospace; font-size: 11px; color: #1d8a5d; margin-left: 6px; }
.trv-bar { position: relative; height: 14px; background: #eef2f7; border-radius: 4px; overflow: hidden; }
.trv-bar i { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(90deg, #6d9be8, #9cc0f5); }
.trv-bar.top i { background: linear-gradient(90deg, #2fbf86, #6fdcae); }
.trv-bar .t { position: absolute; top: 0; bottom: 0; width: 2px; background: #e7a03a; }
.trv-bar em { position: absolute; right: 4px; top: -1px; font-style: normal; font-size: 11px; font-family: Menlo, monospace; color: #223; }
.trv-table { border-collapse: collapse; width: 100%; font-size: 12px; }
.trv-table td, .trv-table th { border-bottom: 1px solid #e6ebf2; padding: 3px 6px; text-align: left; }
.trv-table th { color: #6b7a90; font-weight: 600; }
.vk { color: #1d8a5d; } .mk { color: #2d6aa0; }
.trv-text { white-space: pre-wrap; word-break: break-all; }
</style>
