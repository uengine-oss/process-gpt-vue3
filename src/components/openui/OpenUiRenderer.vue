<template>
    <div class="openui-renderer">
        <Renderer
            :response="response"
            :library="activeLibrary"
            :isStreaming="isStreaming"
            :onAction="handleAction"
            :onStateUpdate="handleStateUpdate"
            :onParseResult="handleParseResult"
        />
        <div v-if="unknownComponents.length" class="openui-renderer__warning">
            지원하지 않는 OpenUI 컴포넌트: {{ unknownComponents.join(', ') }}
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { Renderer } from '@openuidev/vue-lang';
import type { ActionEvent, Library, ParseResult } from '@openuidev/vue-lang';
import { openUiLibrary } from './openUiLibrary';

const props = withDefaults(
    defineProps<{
        response: string | null;
        isStreaming?: boolean;
        library?: Library;
    }>(),
    {
        response: null,
        isStreaming: false,
        library: undefined
    }
);

const emit = defineEmits<{
    (event: 'action', value: ActionEvent): void;
    (event: 'state-update', value: Record<string, any>): void;
    (event: 'parse-result', value: ParseResult | null): void;
}>();

const activeLibrary = computed(() => props.library || openUiLibrary);
const parseErrors = ref<any[]>([]);
const unknownComponents = computed(() => {
    const names = parseErrors.value
        .filter((error) => error?.code === 'unknown-component')
        .map((error) => error.component)
        .filter(Boolean);

    return Array.from(new Set(names));
});

function handleAction(event: ActionEvent) {
    emit('action', event);
}

function handleStateUpdate(state: Record<string, any>) {
    emit('state-update', state);
}

function handleParseResult(result: ParseResult | null) {
    parseErrors.value = result?.meta?.errors || [];
    emit('parse-result', result);
}
</script>

<style>
.openui-renderer {
    width: 100%;
    color: rgba(0, 0, 0, 0.84);
}

.openui-stack {
    width: 100%;
    min-width: 0;
}

.openui-card {
    width: 100%;
    min-width: 0;
    border-radius: 8px;
    padding: 14px;
}

.openui-card--card {
    border: 1px solid rgba(0, 0, 0, 0.08);
    background: #ffffff;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.openui-card--sunk {
    border: 1px solid rgba(0, 0, 0, 0.06);
    background: #f7f8fa;
}

.openui-card--clear {
    padding: 0;
    background: transparent;
}

.openui-card-header__title {
    font-size: 15px;
    font-weight: 700;
    line-height: 1.35;
}

.openui-card-header__subtitle {
    margin-top: 2px;
    font-size: 13px;
    color: rgba(0, 0, 0, 0.56);
    line-height: 1.45;
}

.openui-text {
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.55;
}

.openui-text--small {
    font-size: 12px;
}

.openui-text--default {
    font-size: 14px;
}

.openui-text--large {
    font-size: 16px;
}

.openui-text--small-heavy {
    font-size: 12px;
    font-weight: 700;
}

.openui-text--large-heavy {
    font-size: 18px;
    font-weight: 700;
}

.openui-callout {
    border-radius: 8px;
    border: 1px solid transparent;
    padding: 10px 12px;
    font-size: 14px;
}

.openui-callout--info {
    border-color: rgba(25, 118, 210, 0.2);
    background: rgba(25, 118, 210, 0.08);
}

.openui-callout--success {
    border-color: rgba(46, 125, 50, 0.2);
    background: rgba(46, 125, 50, 0.08);
}

.openui-callout--warning {
    border-color: rgba(245, 124, 0, 0.25);
    background: rgba(245, 124, 0, 0.1);
}

.openui-callout--error {
    border-color: rgba(211, 47, 47, 0.2);
    background: rgba(211, 47, 47, 0.08);
}

.openui-callout__title {
    font-weight: 700;
}

.openui-callout__text {
    margin-top: 2px;
}

.openui-table-wrap {
    width: 100%;
    overflow-x: auto;
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 8px;
}

.openui-table {
    width: 100%;
    min-width: 360px;
    border-collapse: collapse;
    font-size: 13px;
}

.openui-table th,
.openui-table td {
    padding: 9px 10px;
    text-align: left;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.openui-table th {
    background: #f7f8fa;
    font-weight: 700;
    color: rgba(0, 0, 0, 0.64);
}

.openui-table tr:last-child td {
    border-bottom: 0;
}

.openui-markdown-renderer {
    min-width: 0;
    font-size: 13px;
    line-height: 1.65;
    color: rgba(0, 0, 0, 0.78);
}

.openui-markdown-renderer--card,
.openui-markdown-renderer--sunk {
    border-radius: 8px;
    padding: 12px;
}

.openui-markdown-renderer--card {
    border: 1px solid rgba(0, 0, 0, 0.08);
    background: #ffffff;
}

.openui-markdown-renderer--sunk {
    border: 1px solid rgba(0, 0, 0, 0.06);
    background: #f7f8fa;
}

.openui-markdown-renderer p {
    margin: 0 0 10px;
}

.openui-markdown-renderer p:last-child {
    margin-bottom: 0;
}

.openui-markdown-renderer table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 10px;
    font-size: 12px;
}

.openui-markdown-renderer th,
.openui-markdown-renderer td {
    padding: 8px 9px;
    text-align: left;
    border: 1px solid rgba(0, 0, 0, 0.08);
}

.openui-markdown-renderer th {
    background: #f7f8fa;
    font-weight: 700;
}

.openui-empty {
    color: rgba(0, 0, 0, 0.52);
    font-size: 13px;
}

.openui-tag {
    display: inline-flex;
    align-items: center;
    min-height: 22px;
    border-radius: 8px;
    padding: 2px 8px;
    font-size: 12px;
    font-weight: 700;
}

.openui-tag--neutral {
    background: #eef0f3;
    color: #3d4451;
}

.openui-tag--primary {
    background: rgba(var(--v-theme-primary), 0.12);
    color: rgb(var(--v-theme-primary));
}

.openui-tag--success {
    background: rgba(46, 125, 50, 0.12);
    color: #2e7d32;
}

.openui-tag--warning {
    background: rgba(245, 124, 0, 0.14);
    color: #9a4f00;
}

.openui-tag--danger {
    background: rgba(211, 47, 47, 0.12);
    color: #b71c1c;
}

.openui-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.openui-button {
    min-height: 34px;
    border-radius: 8px;
    border: 1px solid transparent;
    padding: 0 12px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
}

.openui-button--primary {
    background: rgb(var(--v-theme-primary));
    color: #ffffff;
}

.openui-button--secondary {
    border-color: rgba(0, 0, 0, 0.12);
    background: #ffffff;
    color: rgba(0, 0, 0, 0.72);
}

.openui-button--ghost {
    background: transparent;
    color: rgba(0, 0, 0, 0.72);
}

.openui-follow-up-block {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.openui-follow-up-block__title {
    font-size: 12px;
    font-weight: 700;
    color: rgba(0, 0, 0, 0.56);
}

.openui-follow-up-block__items {
    display: flex;
    flex-direction: column;
    gap: 7px;
}

.openui-follow-up-item {
    width: 100%;
    min-height: 34px;
    border: 1px solid rgba(var(--v-theme-primary), 0.24);
    border-radius: 8px;
    background: rgba(var(--v-theme-primary), 0.06);
    color: rgb(var(--v-theme-primary));
    padding: 7px 10px;
    text-align: left;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
}

.openui-follow-up-item:hover {
    background: rgba(var(--v-theme-primary), 0.1);
}

.openui-renderer__warning {
    margin-top: 10px;
    border: 1px solid rgba(245, 124, 0, 0.24);
    border-radius: 8px;
    background: rgba(245, 124, 0, 0.08);
    color: #8a4700;
    padding: 8px 10px;
    font-size: 12px;
    line-height: 1.45;
}

.openui-section {
    width: 100%;
    min-width: 0;
}

.openui-section--card,
.openui-section--sunk {
    border-radius: 8px;
    padding: 14px;
}

.openui-section--card {
    border: 1px solid rgba(0, 0, 0, 0.08);
    background: #ffffff;
}

.openui-section--sunk {
    border: 1px solid rgba(0, 0, 0, 0.06);
    background: #f7f8fa;
}

.openui-section__header {
    margin-bottom: 10px;
}

.openui-section__title {
    font-size: 15px;
    font-weight: 700;
    line-height: 1.35;
}

.openui-section__subtitle {
    margin-top: 2px;
    font-size: 13px;
    color: rgba(0, 0, 0, 0.56);
    line-height: 1.45;
}

.openui-section__body {
    min-width: 0;
}

.openui-heading {
    margin: 0;
    color: rgba(0, 0, 0, 0.84);
    font-weight: 700;
    letter-spacing: 0;
    word-break: break-word;
}

.openui-heading--1 {
    font-size: 22px;
    line-height: 1.25;
}

.openui-heading--2 {
    font-size: 18px;
    line-height: 1.32;
}

.openui-heading--3 {
    font-size: 16px;
    line-height: 1.38;
}

.openui-heading--4 {
    font-size: 14px;
    line-height: 1.42;
}

.openui-paragraph {
    margin: 0;
    font-size: 14px;
    line-height: 1.65;
    white-space: pre-wrap;
    word-break: break-word;
}

.openui-paragraph--neutral {
    color: rgba(0, 0, 0, 0.74);
}

.openui-paragraph--primary {
    color: rgb(var(--v-theme-primary));
}

.openui-paragraph--success {
    color: #2e7d32;
}

.openui-paragraph--warning {
    color: #9a4f00;
}

.openui-paragraph--danger,
.openui-paragraph--error {
    color: #b71c1c;
}

.openui-paragraph--info {
    color: #1976d2;
}

.openui-alert {
    border-radius: 8px;
    border: 1px solid transparent;
    padding: 10px 12px;
    font-size: 14px;
}

.openui-alert--info {
    border-color: rgba(25, 118, 210, 0.2);
    background: rgba(25, 118, 210, 0.08);
}

.openui-alert--success {
    border-color: rgba(46, 125, 50, 0.2);
    background: rgba(46, 125, 50, 0.08);
}

.openui-alert--warning {
    border-color: rgba(245, 124, 0, 0.25);
    background: rgba(245, 124, 0, 0.1);
}

.openui-alert--error,
.openui-alert--danger {
    border-color: rgba(211, 47, 47, 0.2);
    background: rgba(211, 47, 47, 0.08);
}

.openui-alert__title {
    font-weight: 700;
}

.openui-alert__text {
    margin-top: 2px;
}

.openui-divider {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    color: rgba(0, 0, 0, 0.48);
    font-size: 12px;
    font-weight: 700;
}

.openui-divider__line {
    flex: 1;
    height: 1px;
    background: rgba(0, 0, 0, 0.08);
}

.openui-divider__label {
    white-space: nowrap;
}

.openui-list-wrap {
    min-width: 0;
}

.openui-list__title {
    margin-bottom: 6px;
    font-size: 13px;
    font-weight: 700;
}

.openui-list {
    display: flex;
    flex-direction: column;
    gap: 7px;
    margin: 0;
    padding-left: 18px;
}

.openui-list-item {
    padding-left: 2px;
    font-size: 13px;
    line-height: 1.5;
    word-break: break-word;
}

.openui-list-item__label {
    color: rgba(0, 0, 0, 0.78);
}

.openui-list-item__description {
    margin-top: 2px;
    color: rgba(0, 0, 0, 0.52);
    font-size: 12px;
}

.openui-key-value-list {
    min-width: 0;
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 8px;
    background: #ffffff;
    overflow: hidden;
}

.openui-key-value-list__title {
    padding: 9px 10px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    background: #f7f8fa;
    font-size: 13px;
    font-weight: 700;
}

.openui-key-value-list__body {
    display: grid;
    grid-template-columns: minmax(96px, 0.42fr) minmax(0, 1fr);
    margin: 0;
}

.openui-key-value-list__key,
.openui-key-value-list__value {
    min-width: 0;
    margin: 0;
    padding: 8px 10px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    font-size: 13px;
    line-height: 1.5;
    word-break: break-word;
}

.openui-key-value-list__key {
    color: rgba(0, 0, 0, 0.56);
    font-weight: 700;
    background: #fafbfc;
}

.openui-key-value-list__value {
    color: rgba(0, 0, 0, 0.78);
}

.openui-key-value-list__key:nth-last-child(2),
.openui-key-value-list__value:last-child {
    border-bottom: 0;
}

.openui-metric-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(136px, 1fr));
    gap: 10px;
}

.openui-metric-card {
    min-width: 0;
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 8px;
    background: #ffffff;
    padding: 12px;
}

.openui-metric-card__label {
    color: rgba(0, 0, 0, 0.56);
    font-size: 12px;
    font-weight: 700;
    line-height: 1.35;
}

.openui-metric-card__value {
    margin-top: 5px;
    color: rgba(0, 0, 0, 0.84);
    font-size: 22px;
    font-weight: 800;
    line-height: 1.15;
    word-break: break-word;
}

.openui-metric-card__delta,
.openui-metric-card__description {
    margin-top: 5px;
    font-size: 12px;
    line-height: 1.4;
}

.openui-metric-card__delta {
    font-weight: 700;
}

.openui-metric-card__description {
    color: rgba(0, 0, 0, 0.54);
}

.openui-metric-card--primary .openui-metric-card__delta {
    color: rgb(var(--v-theme-primary));
}

.openui-metric-card--success .openui-metric-card__delta {
    color: #2e7d32;
}

.openui-metric-card--warning .openui-metric-card__delta {
    color: #9a4f00;
}

.openui-metric-card--danger .openui-metric-card__delta,
.openui-metric-card--error .openui-metric-card__delta {
    color: #b71c1c;
}

.openui-timeline {
    min-width: 0;
}

.openui-timeline__title {
    margin-bottom: 8px;
    font-size: 13px;
    font-weight: 700;
}

.openui-timeline__items {
    display: flex;
    flex-direction: column;
}

.openui-timeline-item {
    position: relative;
    display: grid;
    grid-template-columns: 18px minmax(0, 1fr);
    gap: 8px;
    padding-bottom: 12px;
}

.openui-timeline-item::before {
    content: '';
    position: absolute;
    top: 16px;
    bottom: 0;
    left: 6px;
    width: 1px;
    background: rgba(0, 0, 0, 0.1);
}

.openui-timeline-item:last-child {
    padding-bottom: 0;
}

.openui-timeline-item:last-child::before {
    display: none;
}

.openui-timeline-item__marker {
    width: 13px;
    height: 13px;
    margin-top: 3px;
    border-radius: 50%;
    background: #eef0f3;
    border: 2px solid #ffffff;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.16);
}

.openui-timeline-item--primary .openui-timeline-item__marker {
    background: rgb(var(--v-theme-primary));
}

.openui-timeline-item--success .openui-timeline-item__marker {
    background: #2e7d32;
}

.openui-timeline-item--warning .openui-timeline-item__marker {
    background: #f57c00;
}

.openui-timeline-item--danger .openui-timeline-item__marker,
.openui-timeline-item--error .openui-timeline-item__marker {
    background: #c62828;
}

.openui-timeline-item__content {
    min-width: 0;
}

.openui-timeline-item__title {
    color: rgba(0, 0, 0, 0.8);
    font-size: 13px;
    font-weight: 700;
    line-height: 1.4;
}

.openui-timeline-item__time,
.openui-timeline-item__description {
    margin-top: 2px;
    font-size: 12px;
    line-height: 1.45;
}

.openui-timeline-item__time {
    color: rgba(0, 0, 0, 0.46);
}

.openui-timeline-item__description {
    color: rgba(0, 0, 0, 0.62);
}

.openui-tabs {
    min-width: 0;
}

.openui-tabs__list {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.openui-tabs__tab {
    min-height: 32px;
    border: 0;
    border-bottom: 2px solid transparent;
    background: transparent;
    color: rgba(0, 0, 0, 0.58);
    padding: 0 8px;
    font-size: 13px;
    font-weight: 700;
    white-space: nowrap;
    cursor: pointer;
}

.openui-tabs__tab--active {
    color: rgb(var(--v-theme-primary));
    border-bottom-color: rgb(var(--v-theme-primary));
}

.openui-tabs__panel {
    padding-top: 10px;
    min-width: 0;
}

.openui-accordion {
    min-width: 0;
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 8px;
    background: #ffffff;
    overflow: hidden;
}

.openui-accordion__item + .openui-accordion__item {
    border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.openui-accordion__trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    min-height: 38px;
    border: 0;
    background: #ffffff;
    color: rgba(0, 0, 0, 0.76);
    padding: 8px 10px;
    text-align: left;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
}

.openui-accordion__icon {
    flex: 0 0 auto;
    color: rgba(0, 0, 0, 0.48);
}

.openui-accordion__panel {
    padding: 0 10px 10px;
    font-size: 13px;
    line-height: 1.55;
}

.openui-progress {
    min-width: 0;
}

.openui-progress__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
    font-size: 12px;
    font-weight: 700;
}

.openui-progress__label {
    min-width: 0;
    color: rgba(0, 0, 0, 0.64);
    word-break: break-word;
}

.openui-progress__value {
    flex: 0 0 auto;
    color: rgba(0, 0, 0, 0.54);
}

.openui-progress__track {
    height: 8px;
    border-radius: 8px;
    background: #eef0f3;
    overflow: hidden;
}

.openui-progress__bar {
    height: 100%;
    border-radius: 8px;
    background: rgb(var(--v-theme-primary));
}

.openui-progress--success .openui-progress__bar {
    background: #2e7d32;
}

.openui-progress--warning .openui-progress__bar {
    background: #f57c00;
}

.openui-progress--danger .openui-progress__bar,
.openui-progress--error .openui-progress__bar {
    background: #c62828;
}

.openui-badge {
    display: inline-flex;
    align-items: center;
    min-height: 20px;
    border-radius: 8px;
    padding: 1px 7px;
    font-size: 11px;
    font-weight: 700;
    line-height: 1.3;
}

.openui-badge--neutral,
.openui-badge--info {
    background: #eef0f3;
    color: #3d4451;
}

.openui-badge--primary {
    background: rgba(var(--v-theme-primary), 0.12);
    color: rgb(var(--v-theme-primary));
}

.openui-badge--success {
    background: rgba(46, 125, 50, 0.12);
    color: #2e7d32;
}

.openui-badge--warning {
    background: rgba(245, 124, 0, 0.14);
    color: #9a4f00;
}

.openui-badge--danger,
.openui-badge--error {
    background: rgba(211, 47, 47, 0.12);
    color: #b71c1c;
}

.openui-tag--info {
    background: rgba(25, 118, 210, 0.12);
    color: #1976d2;
}

.openui-tag--error {
    background: rgba(211, 47, 47, 0.12);
    color: #b71c1c;
}

.openui-form {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
}

.openui-form__title {
    font-size: 14px;
    font-weight: 700;
}

.openui-form__fields {
    display: flex;
    flex-direction: column;
    gap: 9px;
}

.openui-form__actions {
    display: flex;
    justify-content: flex-end;
}

.openui-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
}

.openui-field__label {
    color: rgba(0, 0, 0, 0.62);
    font-size: 12px;
    font-weight: 700;
    line-height: 1.35;
}

.openui-input,
.openui-select {
    width: 100%;
    min-height: 36px;
    border: 1px solid rgba(0, 0, 0, 0.14);
    border-radius: 8px;
    background: #ffffff;
    color: rgba(0, 0, 0, 0.82);
    padding: 0 10px;
    font-size: 13px;
    outline: none;
}

.openui-input:focus,
.openui-select:focus {
    border-color: rgba(var(--v-theme-primary), 0.6);
    box-shadow: 0 0 0 2px rgba(var(--v-theme-primary), 0.1);
}

.openui-input:disabled,
.openui-select:disabled {
    background: #f7f8fa;
    color: rgba(0, 0, 0, 0.42);
}

.openui-checkbox {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    cursor: pointer;
}

.openui-checkbox input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
}

.openui-checkbox__box {
    position: relative;
    width: 18px;
    height: 18px;
    flex: 0 0 18px;
    border: 1px solid rgba(0, 0, 0, 0.2);
    border-radius: 5px;
    background: #ffffff;
}

.openui-checkbox input:checked + .openui-checkbox__box {
    border-color: rgb(var(--v-theme-primary));
    background: rgb(var(--v-theme-primary));
}

.openui-checkbox input:checked + .openui-checkbox__box::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 5px;
    width: 5px;
    height: 10px;
    border: solid #ffffff;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
}

.openui-checkbox__label {
    min-width: 0;
    color: rgba(0, 0, 0, 0.74);
    font-size: 13px;
    line-height: 1.45;
    word-break: break-word;
}

.openui-chart {
    min-width: 0;
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 8px;
    background: #ffffff;
    padding: 12px;
}

.openui-chart__title {
    margin-bottom: 10px;
    font-size: 13px;
    font-weight: 700;
    line-height: 1.35;
}

.openui-chart__bars {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.openui-chart__bar-row {
    display: grid;
    grid-template-columns: minmax(70px, 0.34fr) minmax(70px, 1fr) auto;
    align-items: center;
    gap: 8px;
    min-width: 0;
}

.openui-chart__bar-label,
.openui-chart__bar-value {
    color: rgba(0, 0, 0, 0.62);
    font-size: 12px;
    line-height: 1.35;
    word-break: break-word;
}

.openui-chart__bar-value {
    min-width: 28px;
    text-align: right;
    font-weight: 700;
}

.openui-chart__bar-track {
    height: 12px;
    border-radius: 8px;
    background: #eef0f3;
    overflow: hidden;
}

.openui-chart__bar {
    height: 100%;
    min-width: 2px;
    border-radius: 8px;
}

.openui-chart__line-svg {
    width: 100%;
    height: 150px;
    border-radius: 8px;
    background: #f7f8fa;
}

.openui-chart__line {
    stroke: rgb(var(--v-theme-primary));
    stroke-width: 3;
    vector-effect: non-scaling-stroke;
}

.openui-chart__point {
    fill: #ffffff;
    stroke: rgb(var(--v-theme-primary));
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
}

.openui-chart__axis {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin-top: 6px;
    color: rgba(0, 0, 0, 0.5);
    font-size: 11px;
}

.openui-chart__axis span {
    min-width: 0;
    word-break: break-word;
}

.openui-chart__pie-row {
    display: grid;
    grid-template-columns: 112px minmax(0, 1fr);
    gap: 14px;
    align-items: center;
}

.openui-chart__pie {
    width: 112px;
    height: 112px;
    border-radius: 50%;
}

.openui-chart__pie--donut {
    position: relative;
}

.openui-chart__pie--donut::after {
    content: '';
    position: absolute;
    inset: 28px;
    border-radius: 50%;
    background: #ffffff;
}

.openui-chart__legend {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
}

.openui-chart__legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    color: rgba(0, 0, 0, 0.68);
    font-size: 12px;
    line-height: 1.35;
    word-break: break-word;
}

.openui-chart__legend-color {
    width: 9px;
    height: 9px;
    flex: 0 0 9px;
    border-radius: 50%;
}

@media (max-width: 520px) {
    .openui-key-value-list__body {
        grid-template-columns: 1fr;
    }

    .openui-key-value-list__key {
        padding-bottom: 2px;
        border-bottom: 0;
    }

    .openui-key-value-list__value {
        padding-top: 2px;
    }

    .openui-chart__bar-row {
        grid-template-columns: 1fr;
        gap: 4px;
    }

    .openui-chart__bar-value {
        text-align: left;
    }

    .openui-chart__pie-row {
        grid-template-columns: 1fr;
    }
}
</style>
