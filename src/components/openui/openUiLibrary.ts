import {
    createLibrary,
    defineComponent as defineOpenUiComponent,
    provideFormName,
    useFormName,
    useGetFieldValue,
    useIsStreaming,
    useSetFieldValue,
    useTriggerAction
} from '@openuidev/vue-lang';
import type { ComponentRenderProps } from '@openuidev/vue-lang';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { computed, defineComponent as defineVueComponent, h, ref, watchEffect, type PropType } from 'vue';
import { z } from 'zod/v4';

type RenderFn = ComponentRenderProps['renderNode'];

const renderProps = {
    props: {
        type: Object as PropType<any>,
        required: true
    },
    renderNode: {
        type: Function as PropType<RenderFn>,
        required: true
    }
};

const gapMap: Record<string, string> = {
    none: '0',
    xs: '4px',
    s: '8px',
    m: '12px',
    l: '16px',
    xl: '24px',
    '2xl': '32px'
};

const alignMap: Record<string, string> = {
    start: 'flex-start',
    center: 'center',
    end: 'flex-end',
    stretch: 'stretch',
    baseline: 'baseline'
};

const justifyMap: Record<string, string> = {
    start: 'flex-start',
    center: 'center',
    end: 'flex-end',
    between: 'space-between',
    around: 'space-around',
    evenly: 'space-evenly'
};

const toneNames = ['neutral', 'primary', 'success', 'warning', 'danger', 'error', 'info'] as const;
const chartTypeNames = ['bar', 'line', 'pie', 'donut'] as const;

function toArray(value: any): any[] {
    if (Array.isArray(value)) return value;
    if (value === undefined || value === null) return [];
    return [value];
}

function toDisplayText(value: any): string {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (typeof value === 'object' && value.props?.label !== undefined) return String(value.props.label);
    if (typeof value === 'object' && value.props?.title !== undefined) return String(value.props.title);
    if (typeof value === 'object' && value.props?.text !== undefined) return String(value.props.text);
    if (typeof value === 'object' && value.label !== undefined) return String(value.label);
    if (typeof value === 'object' && value.title !== undefined) return String(value.title);
    if (typeof value === 'object' && value.text !== undefined) return String(value.text);
    return JSON.stringify(value);
}

function normalizeTone(value: any, fallback = 'neutral') {
    const tone = String(value || fallback).toLowerCase();
    return toneNames.includes(tone as any) ? tone : fallback;
}

function normalizeNumber(value: any, fallback = 0) {
    const next = Number(value);
    return Number.isFinite(next) ? next : fallback;
}

function normalizeChildren(value: any) {
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object' && value.type === 'element') return [value];
    return toArray(value);
}

function renderPrimitiveOrNode(value: any, renderNode: RenderFn) {
    if (value && typeof value === 'object' && value.type === 'element') {
        return renderNode(value);
    }
    return toDisplayText(value);
}

function normalizeOptions(options: any) {
    if (Array.isArray(options)) {
        return options.map((option) => {
            if (option && typeof option === 'object') {
                const props = option.props || option;
                return {
                    label: toDisplayText(props.label ?? props.name ?? props.value),
                    value: props.value ?? props.label ?? props.name
                };
            }
            return { label: toDisplayText(option), value: option };
        });
    }

    if (options && typeof options === 'object') {
        return Object.entries(options).map(([value, label]) => ({
            label: toDisplayText(label),
            value
        }));
    }

    return [];
}

function normalizeKeyValueItems(items: any) {
    if (Array.isArray(items)) {
        return items.map((item) => {
            if (item && typeof item === 'object') {
                const props = item.props || item;
                return {
                    label: props.label ?? props.key ?? props.name ?? '',
                    value: props.value ?? props.text ?? props.description ?? ''
                };
            }
            return { label: '', value: item };
        });
    }

    if (items && typeof items === 'object') {
        return Object.entries(items).map(([label, value]) => ({ label, value }));
    }

    return [];
}

function normalizeChartSeries(props: Record<string, any>) {
    const labels = Array.isArray(props.labels) ? props.labels.map(toDisplayText) : [];
    const values = Array.isArray(props.values) ? props.values.map((value: any) => normalizeNumber(value)) : [];
    const data = props.data;

    if (labels.length && values.length) {
        return labels.map((label, index) => ({ label, value: values[index] ?? 0 }));
    }

    if (Array.isArray(data)) {
        return data.map((item, index) => {
            if (item && typeof item === 'object') {
                const source = item.props || item;
                return {
                    label: toDisplayText(source.label ?? source.name ?? source.x ?? source.category ?? index + 1),
                    value: normalizeNumber(source.value ?? source.y ?? source.count ?? source.total)
                };
            }
            return { label: labels[index] || String(index + 1), value: normalizeNumber(item) };
        });
    }

    if (data && typeof data === 'object') {
        return Object.entries(data).map(([label, value]) => ({
            label,
            value: normalizeNumber(value)
        }));
    }

    return [];
}

function resolveChartProps(props: Record<string, any>, fallbackType = 'bar') {
    const first = props.data;
    const second = props.type;
    const third = props.title;
    let type = fallbackType;
    let data = first;
    let title = '';

    if (typeof first === 'string' && chartTypeNames.includes(first.toLowerCase() as any)) {
        type = first.toLowerCase();
        data = second;
        title = typeof third === 'string' ? third : '';
    } else {
        type = typeof second === 'string' && chartTypeNames.includes(second.toLowerCase() as any) ? second.toLowerCase() : fallbackType;
        title = typeof third === 'string' ? third : typeof second === 'string' && !chartTypeNames.includes(second.toLowerCase() as any) ? second : '';
    }

    if (!chartTypeNames.includes(type as any)) type = fallbackType;
    return {
        type,
        data,
        title,
        labels: props.labels,
        values: props.values
    };
}

function renderMarkdown(value: unknown) {
    const html = marked(String(value ?? ''), { breaks: true, gfm: true }) as string;
    return DOMPurify.sanitize(html);
}

const Stack = defineOpenUiComponent({
    name: 'Stack',
    description: 'Flex container for arranging generated UI blocks.',
    props: z.object({
        children: z.array(z.any()).default([]),
        direction: z.enum(['row', 'column']).optional().default('column'),
        gap: z.enum(['none', 'xs', 's', 'm', 'l', 'xl', '2xl']).optional().default('m'),
        align: z.enum(['start', 'center', 'end', 'stretch', 'baseline']).optional().default('stretch'),
        justify: z.enum(['start', 'center', 'end', 'between', 'around', 'evenly']).optional().default('start'),
        wrap: z.boolean().optional().default(false)
    }),
    component: defineVueComponent({
        name: 'OpenUiStack',
        props: renderProps,
        setup(compProps) {
            return () =>
                h(
                    'div',
                    {
                        class: 'openui-stack',
                        style: {
                            display: 'flex',
                            flexDirection: compProps.props.direction || 'column',
                            flexWrap: compProps.props.wrap ? 'wrap' : 'nowrap',
                            alignItems: alignMap[compProps.props.align] || 'stretch',
                            justifyContent: justifyMap[compProps.props.justify] || 'flex-start',
                            gap: gapMap[compProps.props.gap] || gapMap.m
                        }
                    },
                    compProps.renderNode(normalizeChildren(compProps.props.children))
                );
        }
    })
});

const Card = defineOpenUiComponent({
    name: 'Card',
    description: 'Container for grouping related generated UI content.',
    props: z.object({
        children: z.array(z.any()).default([]),
        variant: z.enum(['card', 'sunk', 'clear']).optional().default('card'),
        direction: z.enum(['row', 'column']).optional().default('column'),
        gap: z.enum(['none', 'xs', 's', 'm', 'l', 'xl', '2xl']).optional().default('m'),
        align: z.enum(['start', 'center', 'end', 'stretch', 'baseline']).optional().default('stretch'),
        justify: z.enum(['start', 'center', 'end', 'between', 'around', 'evenly']).optional().default('start'),
        wrap: z.boolean().optional().default(false)
    }),
    component: defineVueComponent({
        name: 'OpenUiCard',
        props: renderProps,
        setup(compProps) {
            return () =>
                h(
                    'div',
                    {
                        class: ['openui-card', `openui-card--${compProps.props.variant || 'card'}`],
                        style: {
                            display: 'flex',
                            flexDirection: compProps.props.direction || 'column',
                            flexWrap: compProps.props.wrap ? 'wrap' : 'nowrap',
                            alignItems: alignMap[compProps.props.align] || 'stretch',
                            justifyContent: justifyMap[compProps.props.justify] || 'flex-start',
                            gap: gapMap[compProps.props.gap] || gapMap.m
                        }
                    },
                    compProps.renderNode(normalizeChildren(compProps.props.children))
                );
        }
    })
});

const Section = defineOpenUiComponent({
    name: 'Section',
    description: 'Section with optional title, subtitle, and nested content.',
    props: z.object({
        title: z.any().optional(),
        children: z.any().optional(),
        subtitle: z.any().optional(),
        variant: z.enum(['default', 'card', 'sunk', 'clear']).optional().default('default')
    }),
    component: defineVueComponent({
        name: 'OpenUiSection',
        props: renderProps,
        setup(compProps) {
            return () => {
                const titleIsChildren = Array.isArray(compProps.props.title) || compProps.props.title?.type === 'element';
                const title = titleIsChildren ? compProps.props.subtitle : compProps.props.title;
                const subtitle = titleIsChildren ? undefined : compProps.props.subtitle;
                const children = titleIsChildren ? compProps.props.title : compProps.props.children;

                return h('section', { class: ['openui-section', `openui-section--${compProps.props.variant || 'default'}`] }, [
                    title ? h('div', { class: 'openui-section__header' }, [
                        h('div', { class: 'openui-section__title' }, renderPrimitiveOrNode(title, compProps.renderNode)),
                        subtitle ? h('div', { class: 'openui-section__subtitle' }, renderPrimitiveOrNode(subtitle, compProps.renderNode)) : null
                    ]) : null,
                    h('div', { class: 'openui-section__body' }, compProps.renderNode(normalizeChildren(children)))
                ]);
            };
        }
    })
});

const CardHeader = defineOpenUiComponent({
    name: 'CardHeader',
    description: 'Title and optional subtitle for a card or section.',
    props: z.object({
        title: z.any(),
        subtitle: z.any().optional()
    }),
    component: defineVueComponent({
        name: 'OpenUiCardHeader',
        props: renderProps,
        setup(compProps) {
            return () =>
                h('div', { class: 'openui-card-header' }, [
                    h('div', { class: 'openui-card-header__title' }, renderPrimitiveOrNode(compProps.props.title, compProps.renderNode)),
                    compProps.props.subtitle
                        ? h('div', { class: 'openui-card-header__subtitle' }, renderPrimitiveOrNode(compProps.props.subtitle, compProps.renderNode))
                        : null
                ]);
        }
    })
});

const Heading = defineOpenUiComponent({
    name: 'Heading',
    description: 'Heading text. Use Heading("Title", 2).',
    props: z.object({
        text: z.any(),
        level: z.any().optional().default(2),
        align: z.enum(['left', 'center', 'right']).optional().default('left')
    }),
    component: defineVueComponent({
        name: 'OpenUiHeading',
        props: renderProps,
        setup(compProps) {
            return () => {
                const level = Math.min(4, Math.max(1, normalizeNumber(compProps.props.level, 2)));
                return h(
                    `h${level}`,
                    {
                        class: ['openui-heading', `openui-heading--${level}`],
                        style: { textAlign: compProps.props.align || 'left' }
                    },
                    renderPrimitiveOrNode(compProps.props.text, compProps.renderNode)
                );
            };
        }
    })
});

const Paragraph = defineOpenUiComponent({
    name: 'Paragraph',
    description: 'Paragraph text block.',
    props: z.object({
        text: z.any(),
        tone: z.enum(['neutral', 'primary', 'success', 'warning', 'danger', 'error', 'info']).optional().default('neutral')
    }),
    component: defineVueComponent({
        name: 'OpenUiParagraph',
        props: renderProps,
        setup(compProps) {
            return () =>
                h('p', { class: ['openui-paragraph', `openui-paragraph--${normalizeTone(compProps.props.tone)}`] }, [
                    renderPrimitiveOrNode(compProps.props.text, compProps.renderNode)
                ]);
        }
    })
});

const TextContent = defineOpenUiComponent({
    name: 'TextContent',
    description: 'Text block. Supports small/default/large size hints.',
    props: z.object({
        text: z.union([z.string(), z.number(), z.boolean()]),
        size: z.enum(['small', 'default', 'large', 'small-heavy', 'large-heavy']).optional().default('default')
    }),
    component: defineVueComponent({
        name: 'OpenUiTextContent',
        props: renderProps,
        setup(compProps) {
            return () =>
                h(
                    'div',
                    {
                        class: ['openui-text', `openui-text--${compProps.props.size || 'default'}`]
                    },
                    String(compProps.props.text ?? '')
                );
        }
    })
});

const Callout = defineOpenUiComponent({
    name: 'Callout',
    description: 'Highlighted message with type, title, and body.',
    props: z.object({
        type: z.enum(['info', 'success', 'warning', 'error', 'danger']).optional().default('info'),
        title: z.any().optional(),
        text: z.any().optional(),
        visible: z.boolean().optional().default(true)
    }),
    component: defineVueComponent({
        name: 'OpenUiCallout',
        props: renderProps,
        setup(compProps) {
            return () => {
                if (compProps.props.visible === false) return null;
                const type = compProps.props.type === 'danger' ? 'error' : compProps.props.type || 'info';
                return h('div', { class: ['openui-callout', `openui-callout--${type}`] }, [
                    compProps.props.title ? h('div', { class: 'openui-callout__title' }, renderPrimitiveOrNode(compProps.props.title, compProps.renderNode)) : null,
                    compProps.props.text ? h('div', { class: 'openui-callout__text' }, renderPrimitiveOrNode(compProps.props.text, compProps.renderNode)) : null
                ]);
            };
        }
    })
});

const Alert = defineOpenUiComponent({
    name: 'Alert',
    description: 'Alert message. Alias-style component for Callout.',
    props: z.object({
        type: z.enum(['info', 'success', 'warning', 'error', 'danger']).optional().default('info'),
        title: z.any().optional(),
        text: z.any().optional(),
        visible: z.boolean().optional().default(true)
    }),
    component: defineVueComponent({
        name: 'OpenUiAlert',
        props: renderProps,
        setup(compProps) {
            return () => {
                if (compProps.props.visible === false) return null;
                const type = compProps.props.type === 'danger' ? 'error' : compProps.props.type || 'info';
                return h('div', { class: ['openui-alert', `openui-alert--${type}`] }, [
                    compProps.props.title ? h('div', { class: 'openui-alert__title' }, renderPrimitiveOrNode(compProps.props.title, compProps.renderNode)) : null,
                    compProps.props.text ? h('div', { class: 'openui-alert__text' }, renderPrimitiveOrNode(compProps.props.text, compProps.renderNode)) : null
                ]);
            };
        }
    })
});

const MarkDownRenderer = defineOpenUiComponent({
    name: 'MarkDownRenderer',
    description: 'Markdown content block. Use for tables, lists, and formatted analysis text.',
    props: z.object({
        text: z.string(),
        variant: z.enum(['card', 'sunk', 'clear']).optional().default('clear')
    }),
    component: defineVueComponent({
        name: 'OpenUiMarkDownRenderer',
        props: renderProps,
        setup(compProps) {
            return () =>
                h('div', {
                    class: ['openui-markdown-renderer', `openui-markdown-renderer--${compProps.props.variant || 'clear'}`],
                    innerHTML: renderMarkdown(compProps.props.text)
                });
        }
    })
});

const MarkdownRenderer = defineOpenUiComponent({
    name: 'MarkdownRenderer',
    description: 'Markdown content block. Alias for MarkDownRenderer.',
    props: z.object({
        text: z.string(),
        variant: z.enum(['card', 'sunk', 'clear']).optional().default('clear')
    }),
    component: defineVueComponent({
        name: 'OpenUiMarkdownRenderer',
        props: renderProps,
        setup(compProps) {
            return () =>
                h('div', {
                    class: ['openui-markdown-renderer', `openui-markdown-renderer--${compProps.props.variant || 'clear'}`],
                    innerHTML: renderMarkdown(compProps.props.text)
                });
        }
    })
});

const Divider = defineOpenUiComponent({
    name: 'Divider',
    description: 'Horizontal divider with optional label.',
    props: z.object({
        label: z.any().optional()
    }),
    component: defineVueComponent({
        name: 'OpenUiDivider',
        props: renderProps,
        setup(compProps) {
            return () =>
                h('div', { class: 'openui-divider' }, [
                    h('div', { class: 'openui-divider__line' }),
                    compProps.props.label ? h('span', { class: 'openui-divider__label' }, renderPrimitiveOrNode(compProps.props.label, compProps.renderNode)) : null,
                    compProps.props.label ? h('div', { class: 'openui-divider__line' }) : null
                ]);
        }
    })
});

const ListItem = defineOpenUiComponent({
    name: 'ListItem',
    description: 'List item with optional description and tone.',
    props: z.object({
        label: z.any(),
        description: z.any().optional(),
        tone: z.enum(['neutral', 'primary', 'success', 'warning', 'danger', 'error', 'info']).optional().default('neutral')
    }),
    component: defineVueComponent({
        name: 'OpenUiListItem',
        props: renderProps,
        setup(compProps) {
            return () =>
                h('li', { class: ['openui-list-item', `openui-list-item--${normalizeTone(compProps.props.tone)}`] }, [
                    h('div', { class: 'openui-list-item__label' }, renderPrimitiveOrNode(compProps.props.label, compProps.renderNode)),
                    compProps.props.description
                        ? h('div', { class: 'openui-list-item__description' }, renderPrimitiveOrNode(compProps.props.description, compProps.renderNode))
                        : null
                ]);
        }
    })
});

const List = defineOpenUiComponent({
    name: 'List',
    description: 'Ordered or unordered list. Use List([ListItem("A"), ListItem("B")]).',
    props: z.object({
        items: z.any().optional(),
        ordered: z.boolean().optional().default(false),
        title: z.any().optional()
    }),
    component: defineVueComponent({
        name: 'OpenUiList',
        props: renderProps,
        setup(compProps) {
            return () => {
                const tag = compProps.props.ordered ? 'ol' : 'ul';
                const items = normalizeChildren(compProps.props.items);
                return h('div', { class: 'openui-list-wrap' }, [
                    compProps.props.title ? h('div', { class: 'openui-list__title' }, renderPrimitiveOrNode(compProps.props.title, compProps.renderNode)) : null,
                    h(
                        tag,
                        { class: ['openui-list', compProps.props.ordered ? 'openui-list--ordered' : 'openui-list--unordered'] },
                        items.map((item) =>
                            item && typeof item === 'object' && item.type === 'element'
                                ? compProps.renderNode(item)
                                : h('li', { class: 'openui-list-item' }, h('div', { class: 'openui-list-item__label' }, toDisplayText(item)))
                        )
                    )
                ]);
            };
        }
    })
});

const KeyValueItem = defineOpenUiComponent({
    name: 'KeyValueItem',
    description: 'Key/value item for KeyValueList.',
    props: z.object({
        label: z.any(),
        value: z.any()
    }),
    component: defineVueComponent({
        name: 'OpenUiKeyValueItem',
        props: renderProps,
        setup() {
            return () => null;
        }
    })
});

const KeyValueList = defineOpenUiComponent({
    name: 'KeyValueList',
    description: 'Compact key/value list. Accepts KeyValueItem children or an object map.',
    props: z.object({
        items: z.any(),
        title: z.any().optional()
    }),
    component: defineVueComponent({
        name: 'OpenUiKeyValueList',
        props: renderProps,
        setup(compProps) {
            return () => {
                const items = normalizeKeyValueItems(compProps.props.items);

                if (!items.length) {
                    return h('div', { class: 'openui-empty' }, '데이터가 없습니다.');
                }

                return h('div', { class: 'openui-key-value-list' }, [
                    compProps.props.title
                        ? h('div', { class: 'openui-key-value-list__title' }, renderPrimitiveOrNode(compProps.props.title, compProps.renderNode))
                        : null,
                    h(
                        'dl',
                        { class: 'openui-key-value-list__body' },
                        items.flatMap((item) => [
                            h('dt', { class: 'openui-key-value-list__key' }, renderPrimitiveOrNode(item.label, compProps.renderNode)),
                            h('dd', { class: 'openui-key-value-list__value' }, renderPrimitiveOrNode(item.value, compProps.renderNode))
                        ])
                    )
                ]);
            };
        }
    })
});

const MetricCard = defineOpenUiComponent({
    name: 'MetricCard',
    description: 'Single metric card with label, value, optional delta, and description.',
    props: z.object({
        label: z.any(),
        value: z.any(),
        delta: z.any().optional(),
        tone: z.enum(['neutral', 'primary', 'success', 'warning', 'danger', 'error', 'info']).optional().default('neutral'),
        description: z.any().optional()
    }),
    component: defineVueComponent({
        name: 'OpenUiMetricCard',
        props: renderProps,
        setup(compProps) {
            return () =>
                h('div', { class: ['openui-metric-card', `openui-metric-card--${normalizeTone(compProps.props.tone)}`] }, [
                    h('div', { class: 'openui-metric-card__label' }, renderPrimitiveOrNode(compProps.props.label, compProps.renderNode)),
                    h('div', { class: 'openui-metric-card__value' }, renderPrimitiveOrNode(compProps.props.value, compProps.renderNode)),
                    compProps.props.delta ? h('div', { class: 'openui-metric-card__delta' }, renderPrimitiveOrNode(compProps.props.delta, compProps.renderNode)) : null,
                    compProps.props.description
                        ? h('div', { class: 'openui-metric-card__description' }, renderPrimitiveOrNode(compProps.props.description, compProps.renderNode))
                        : null
                ]);
        }
    })
});

const MetricGrid = defineOpenUiComponent({
    name: 'MetricGrid',
    description: 'Responsive grid container for MetricCard components.',
    props: z.object({
        children: z.any().optional(),
        columns: z.any().optional().default('auto')
    }),
    component: defineVueComponent({
        name: 'OpenUiMetricGrid',
        props: renderProps,
        setup(compProps) {
            return () =>
                h(
                    'div',
                    {
                        class: 'openui-metric-grid',
                        style:
                            compProps.props.columns && compProps.props.columns !== 'auto'
                                ? { gridTemplateColumns: `repeat(${Math.max(1, normalizeNumber(compProps.props.columns, 3))}, minmax(0, 1fr))` }
                                : undefined
                    },
                    compProps.renderNode(normalizeChildren(compProps.props.children))
                );
        }
    })
});

const TimelineItem = defineOpenUiComponent({
    name: 'TimelineItem',
    description: 'Timeline event with title, optional time, description, and status.',
    props: z.object({
        title: z.any(),
        time: z.any().optional(),
        description: z.any().optional(),
        status: z.enum(['neutral', 'primary', 'success', 'warning', 'danger', 'error', 'info']).optional().default('neutral')
    }),
    component: defineVueComponent({
        name: 'OpenUiTimelineItem',
        props: renderProps,
        setup(compProps) {
            return () =>
                h('div', { class: ['openui-timeline-item', `openui-timeline-item--${normalizeTone(compProps.props.status)}`] }, [
                    h('div', { class: 'openui-timeline-item__marker' }),
                    h('div', { class: 'openui-timeline-item__content' }, [
                        h('div', { class: 'openui-timeline-item__title' }, renderPrimitiveOrNode(compProps.props.title, compProps.renderNode)),
                        compProps.props.time ? h('div', { class: 'openui-timeline-item__time' }, renderPrimitiveOrNode(compProps.props.time, compProps.renderNode)) : null,
                        compProps.props.description
                            ? h('div', { class: 'openui-timeline-item__description' }, renderPrimitiveOrNode(compProps.props.description, compProps.renderNode))
                            : null
                    ])
                ]);
        }
    })
});

const Timeline = defineOpenUiComponent({
    name: 'Timeline',
    description: 'Vertical timeline for process steps or events.',
    props: z.object({
        items: z.any().optional(),
        title: z.any().optional()
    }),
    component: defineVueComponent({
        name: 'OpenUiTimeline',
        props: renderProps,
        setup(compProps) {
            return () =>
                h('div', { class: 'openui-timeline' }, [
                    compProps.props.title ? h('div', { class: 'openui-timeline__title' }, renderPrimitiveOrNode(compProps.props.title, compProps.renderNode)) : null,
                    h('div', { class: 'openui-timeline__items' }, compProps.renderNode(normalizeChildren(compProps.props.items)))
                ]);
        }
    })
});

const TabItem = defineOpenUiComponent({
    name: 'TabItem',
    description: 'Tab panel with label and content.',
    props: z.object({
        label: z.any(),
        children: z.any().optional(),
        value: z.any().optional()
    }),
    component: defineVueComponent({
        name: 'OpenUiTabItem',
        props: renderProps,
        setup() {
            return () => null;
        }
    })
});

const Tabs = defineOpenUiComponent({
    name: 'Tabs',
    description: 'Tabbed content container. Use Tabs([TabItem("Summary", [...]), TabItem("Details", [...])]).',
    props: z.object({
        children: z.any().optional(),
        defaultValue: z.any().optional()
    }),
    component: defineVueComponent({
        name: 'OpenUiTabs',
        props: renderProps,
        setup(compProps) {
            const activeIndex = ref(0);

            return () => {
                const items = normalizeChildren(compProps.props.children);
                const selectedIndex = Math.min(activeIndex.value, Math.max(0, items.length - 1));
                const selected = items[selectedIndex];
                const selectedChildren = selected?.props?.children;

                return h('div', { class: 'openui-tabs' }, [
                    h(
                        'div',
                        { class: 'openui-tabs__list', role: 'tablist' },
                        items.map((item, index) =>
                            h(
                                'button',
                                {
                                    class: ['openui-tabs__tab', index === selectedIndex ? 'openui-tabs__tab--active' : ''],
                                    type: 'button',
                                    role: 'tab',
                                    'aria-selected': index === selectedIndex,
                                    onClick: () => {
                                        activeIndex.value = index;
                                    }
                                },
                                toDisplayText(item?.props?.label ?? item?.props?.title ?? `Tab ${index + 1}`)
                            )
                        )
                    ),
                    h('div', { class: 'openui-tabs__panel', role: 'tabpanel' }, compProps.renderNode(normalizeChildren(selectedChildren)))
                ]);
            };
        }
    })
});

const AccordionItem = defineOpenUiComponent({
    name: 'AccordionItem',
    description: 'Accordion item with label and content.',
    props: z.object({
        label: z.any(),
        children: z.any().optional(),
        open: z.boolean().optional().default(false)
    }),
    component: defineVueComponent({
        name: 'OpenUiAccordionItem',
        props: renderProps,
        setup() {
            return () => null;
        }
    })
});

const Accordion = defineOpenUiComponent({
    name: 'Accordion',
    description: 'Accordion container. Use Accordion([AccordionItem("Question", [...])]).',
    props: z.object({
        children: z.any().optional(),
        allowMultiple: z.boolean().optional().default(false)
    }),
    component: defineVueComponent({
        name: 'OpenUiAccordion',
        props: renderProps,
        setup(compProps) {
            const openIndexes = ref<number[]>(
                normalizeChildren(compProps.props.children)
                    .map((item, index) => (item?.props?.open ? index : -1))
                    .filter((index) => index >= 0)
            );

            function toggle(index: number) {
                const isOpen = openIndexes.value.includes(index);
                if (compProps.props.allowMultiple) {
                    openIndexes.value = isOpen ? openIndexes.value.filter((value) => value !== index) : [...openIndexes.value, index];
                    return;
                }
                openIndexes.value = isOpen ? [] : [index];
            }

            return () => {
                const items = normalizeChildren(compProps.props.children);

                return h(
                    'div',
                    { class: 'openui-accordion' },
                    items.map((item, index) => {
                        const isOpen = openIndexes.value.includes(index);
                        return h('div', { class: ['openui-accordion__item', isOpen ? 'openui-accordion__item--open' : ''] }, [
                            h(
                                'button',
                                {
                                    class: 'openui-accordion__trigger',
                                    type: 'button',
                                    'aria-expanded': isOpen,
                                    onClick: () => toggle(index)
                                },
                                [
                                    h('span', toDisplayText(item?.props?.label ?? item?.props?.title ?? `Item ${index + 1}`)),
                                    h('span', { class: 'openui-accordion__icon' }, isOpen ? '-' : '+')
                                ]
                            ),
                            isOpen ? h('div', { class: 'openui-accordion__panel' }, compProps.renderNode(normalizeChildren(item?.props?.children))) : null
                        ]);
                    })
                );
            };
        }
    })
});

const Progress = defineOpenUiComponent({
    name: 'Progress',
    description: 'Progress bar with optional label.',
    props: z.object({
        value: z.any().optional().default(0),
        max: z.any().optional().default(100),
        label: z.any().optional(),
        tone: z.enum(['neutral', 'primary', 'success', 'warning', 'danger', 'error', 'info']).optional().default('primary')
    }),
    component: defineVueComponent({
        name: 'OpenUiProgress',
        props: renderProps,
        setup(compProps) {
            return () => {
                const maxIsLabel = typeof compProps.props.max === 'string' && compProps.props.label === undefined;
                const max = Math.max(1, normalizeNumber(maxIsLabel ? 100 : compProps.props.max, 100));
                const value = Math.min(max, Math.max(0, normalizeNumber(compProps.props.value, 0)));
                const percent = Math.round((value / max) * 100);
                const label = maxIsLabel ? compProps.props.max : compProps.props.label;

                return h('div', { class: ['openui-progress', `openui-progress--${normalizeTone(compProps.props.tone, 'primary')}`] }, [
                    h('div', { class: 'openui-progress__header' }, [
                        label ? h('span', { class: 'openui-progress__label' }, renderPrimitiveOrNode(label, compProps.renderNode)) : null,
                        h('span', { class: 'openui-progress__value' }, `${percent}%`)
                    ]),
                    h('div', { class: 'openui-progress__track' }, h('div', { class: 'openui-progress__bar', style: { width: `${percent}%` } }))
                ]);
            };
        }
    })
});

const Col = defineOpenUiComponent({
    name: 'Col',
    description: 'Column definition for Table(label, data).',
    props: z.object({
        label: z.string(),
        data: z.array(z.any()).default([]),
        type: z.string().optional()
    }),
    component: defineVueComponent({
        name: 'OpenUiCol',
        props: renderProps,
        setup() {
            return () => null;
        }
    })
});

const Table = defineOpenUiComponent({
    name: 'Table',
    description: 'Column-oriented data table. Use Table([Col("Name", names), Col("Count", counts)]).',
    props: z.object({
        columns: z.array(Col.ref)
    }),
    component: defineVueComponent({
        name: 'OpenUiTable',
        props: renderProps,
        setup(compProps) {
            return () => {
                const columns = (compProps.props.columns || []).map((column: any) => ({
                    label: column?.props?.label || '',
                    data: Array.isArray(column?.props?.data) ? column.props.data : []
                }));
                const rowCount = Math.max(0, ...columns.map((column: any) => column.data.length));

                if (!columns.length || rowCount === 0) {
                    return h('div', { class: 'openui-empty' }, '데이터가 없습니다.');
                }

                return h('div', { class: 'openui-table-wrap' }, [
                    h('table', { class: 'openui-table' }, [
                        h(
                            'thead',
                            h(
                                'tr',
                                columns.map((column: any) => h('th', column.label))
                            )
                        ),
                        h(
                            'tbody',
                            Array.from({ length: rowCount }, (_, rowIndex) =>
                                h(
                                    'tr',
                                    columns.map((column: any) => {
                                        const value = column.data[rowIndex];
                                        return h(
                                            'td',
                                            typeof value === 'object' && value !== null
                                                ? compProps.renderNode(value)
                                                : String(value ?? '')
                                        );
                                    })
                                )
                            )
                        )
                    ])
                ]);
            };
        }
    })
});

const Tag = defineOpenUiComponent({
    name: 'Tag',
    description: 'Small status label.',
    props: z.object({
        label: z.union([z.string(), z.number(), z.boolean()]),
        tone: z.enum(['neutral', 'primary', 'success', 'warning', 'danger', 'error', 'info']).optional().default('neutral')
    }),
    component: defineVueComponent({
        name: 'OpenUiTag',
        props: renderProps,
        setup(compProps) {
            return () =>
                h('span', { class: ['openui-tag', `openui-tag--${normalizeTone(compProps.props.tone)}`] }, String(compProps.props.label ?? ''));
        }
    })
});

const Badge = defineOpenUiComponent({
    name: 'Badge',
    description: 'Small badge label. Similar to Tag.',
    props: z.object({
        label: z.union([z.string(), z.number(), z.boolean()]),
        tone: z.enum(['neutral', 'primary', 'success', 'warning', 'danger', 'error', 'info']).optional().default('neutral')
    }),
    component: defineVueComponent({
        name: 'OpenUiBadge',
        props: renderProps,
        setup(compProps) {
            return () =>
                h('span', { class: ['openui-badge', `openui-badge--${normalizeTone(compProps.props.tone)}`] }, String(compProps.props.label ?? ''));
        }
    })
});

const Button = defineOpenUiComponent({
    name: 'Button',
    description: 'Clickable action button.',
    props: z.object({
        label: z.string(),
        action: z.any().optional(),
        variant: z.enum(['primary', 'secondary', 'ghost']).optional().default('secondary')
    }),
    component: defineVueComponent({
        name: 'OpenUiButton',
        props: renderProps,
        setup(compProps) {
            const triggerAction = useTriggerAction();
            return () =>
                h(
                    'button',
                    {
                        class: ['openui-button', `openui-button--${compProps.props.variant || 'secondary'}`],
                        type: 'button',
                        onClick: () => triggerAction(compProps.props.label, undefined, compProps.props.action)
                    },
                    compProps.props.label
                );
        }
    })
});

const Buttons = defineOpenUiComponent({
    name: 'Buttons',
    description: 'Horizontal group of Button components.',
    props: z.object({
        children: z.array(Button.ref).default([])
    }),
    component: defineVueComponent({
        name: 'OpenUiButtons',
        props: renderProps,
        setup(compProps) {
            return () => h('div', { class: 'openui-buttons' }, compProps.renderNode(normalizeChildren(compProps.props.children)));
        }
    })
});

const FollowUpItem = defineOpenUiComponent({
    name: 'FollowUpItem',
    description: 'Suggested follow-up question. Clicking it continues the conversation with the label text.',
    props: z.object({
        label: z.string(),
        action: z.any().optional()
    }),
    component: defineVueComponent({
        name: 'OpenUiFollowUpItem',
        props: renderProps,
        setup(compProps) {
            const triggerAction = useTriggerAction();
            return () =>
                h(
                    'button',
                    {
                        class: 'openui-follow-up-item',
                        type: 'button',
                        onClick: () => triggerAction(compProps.props.label, undefined, compProps.props.action)
                    },
                    compProps.props.label
                );
        }
    })
});

const FollowUpBlock = defineOpenUiComponent({
    name: 'FollowUpBlock',
    description: 'Container for suggested follow-up questions.',
    props: z.object({
        children: z.array(FollowUpItem.ref).default([]),
        title: z.string().optional().default('이어서 물어볼 수 있어요')
    }),
    component: defineVueComponent({
        name: 'OpenUiFollowUpBlock',
        props: renderProps,
        setup(compProps) {
            return () =>
                h('div', { class: 'openui-follow-up-block' }, [
                    compProps.props.title ? h('div', { class: 'openui-follow-up-block__title' }, compProps.props.title) : null,
                    h('div', { class: 'openui-follow-up-block__items' }, compProps.renderNode(normalizeChildren(compProps.props.children)))
                ]);
        }
    })
});

const Form = defineOpenUiComponent({
    name: 'Form',
    description: 'Form container for generated inputs, select boxes, checkboxes, and submit actions.',
    props: z.object({
        name: z.any().optional(),
        children: z.any().optional(),
        submitLabel: z.any().optional().default('제출'),
        action: z.any().optional(),
        title: z.any().optional()
    }),
    component: defineVueComponent({
        name: 'OpenUiForm',
        props: renderProps,
        setup(compProps) {
            const triggerAction = useTriggerAction();
            const formName = computed(() => {
                if (Array.isArray(compProps.props.name) || compProps.props.name?.type === 'element') return 'openui-form';
                return String(compProps.props.name || 'openui-form');
            });
            provideFormName(formName);

            return () => {
                const nameIsChildren = Array.isArray(compProps.props.name) || compProps.props.name?.type === 'element';
                const children = nameIsChildren ? compProps.props.name : compProps.props.children;
                const title = nameIsChildren ? compProps.props.children : compProps.props.title;
                const submitLabel = toDisplayText(compProps.props.submitLabel || '제출');

                return h(
                    'form',
                    {
                        class: 'openui-form',
                        onSubmit: (event: Event) => {
                            event.preventDefault();
                            triggerAction(submitLabel, formName.value, compProps.props.action);
                        }
                    },
                    [
                        title ? h('div', { class: 'openui-form__title' }, renderPrimitiveOrNode(title, compProps.renderNode)) : null,
                        h('div', { class: 'openui-form__fields' }, compProps.renderNode(normalizeChildren(children))),
                        h('div', { class: 'openui-form__actions' }, [
                            h('button', { class: 'openui-button openui-button--primary', type: 'submit' }, submitLabel)
                        ])
                    ]
                );
            };
        }
    })
});

const Input = defineOpenUiComponent({
    name: 'Input',
    description: 'Text input field for generated forms. Use Input("fieldName", "Label", "default").',
    props: z.object({
        name: z.string(),
        label: z.any().optional(),
        value: z.any().optional(),
        placeholder: z.any().optional(),
        type: z.enum(['text', 'email', 'number', 'password', 'search', 'tel', 'url']).optional().default('text')
    }),
    component: defineVueComponent({
        name: 'OpenUiInput',
        props: renderProps,
        setup(compProps) {
            const formName = useFormName();
            const getFieldValue = useGetFieldValue();
            const setFieldValue = useSetFieldValue();
            const isStreaming = useIsStreaming();
            const name = computed(() => compProps.props.name);
            const value = computed(() => getFieldValue(formName?.value, name.value) ?? compProps.props.value ?? '');

            watchEffect(() => {
                const fn = formName?.value;
                const fieldName = name.value;
                if (!fn || !fieldName) return;
                const existing = getFieldValue(fn, fieldName);
                if (existing !== undefined) return;
                // props.value가 undefined가 아니라면(빈 문자열 포함) 초기값을 state에 주입
                if (compProps.props.value === undefined) return;
                setFieldValue(fn, 'Input', fieldName, compProps.props.value, true);
            });

            return () =>
                h('label', { class: 'openui-field' }, [
                    compProps.props.label
                        ? h('span', { class: 'openui-field__label' }, renderPrimitiveOrNode(compProps.props.label, compProps.renderNode))
                        : null,
                    h('input', {
                        class: 'openui-input',
                        name: name.value,
                        type: compProps.props.type || 'text',
                        value: value.value,
                        placeholder: toDisplayText(compProps.props.placeholder),
                        disabled: isStreaming.value,
                        onInput: (event: Event) => {
                            setFieldValue(formName?.value, 'Input', name.value, (event.target as HTMLInputElement).value, false);
                        },
                        onBlur: (event: Event) => {
                            setFieldValue(formName?.value, 'Input', name.value, (event.target as HTMLInputElement).value, true);
                        }
                    })
                ]);
        }
    })
});

const Select = defineOpenUiComponent({
    name: 'Select',
    description: 'Select field for generated forms. Options can be strings, objects, or a value-label map.',
    props: z.object({
        name: z.string(),
        label: z.any().optional(),
        options: z.any().optional(),
        value: z.any().optional(),
        placeholder: z.any().optional()
    }),
    component: defineVueComponent({
        name: 'OpenUiSelect',
        props: renderProps,
        setup(compProps) {
            const formName = useFormName();
            const getFieldValue = useGetFieldValue();
            const setFieldValue = useSetFieldValue();
            const isStreaming = useIsStreaming();
            const name = computed(() => compProps.props.name);
            const value = computed(() => getFieldValue(formName?.value, name.value) ?? compProps.props.value ?? '');

            watchEffect(() => {
                const fn = formName?.value;
                const fieldName = name.value;
                if (!fn || !fieldName) return;
                const existing = getFieldValue(fn, fieldName);
                if (existing !== undefined) return;
                const initial = compProps.props.value;
                if (initial === undefined) return;
                setFieldValue(fn, 'Select', fieldName, initial, true);
            });

            return () => {
                const options = normalizeOptions(compProps.props.options);

                return h('label', { class: 'openui-field' }, [
                    compProps.props.label
                        ? h('span', { class: 'openui-field__label' }, renderPrimitiveOrNode(compProps.props.label, compProps.renderNode))
                        : null,
                    h(
                        'select',
                        {
                            class: 'openui-select',
                            name: name.value,
                            value: value.value,
                            disabled: isStreaming.value,
                            onChange: (event: Event) => {
                                setFieldValue(formName?.value, 'Select', name.value, (event.target as HTMLSelectElement).value, true);
                            }
                        },
                        [
                            compProps.props.placeholder
                                ? h('option', { value: '', disabled: true }, toDisplayText(compProps.props.placeholder))
                                : null,
                            ...options.map((option) => h('option', { value: option.value }, option.label))
                        ]
                    )
                ]);
            };
        }
    })
});

const Checkbox = defineOpenUiComponent({
    name: 'Checkbox',
    description: 'Checkbox field for generated forms.',
    props: z.object({
        name: z.string(),
        label: z.any().optional(),
        checked: z.boolean().optional().default(false),
        value: z.any().optional().default(true)
    }),
    component: defineVueComponent({
        name: 'OpenUiCheckbox',
        props: renderProps,
        setup(compProps) {
            const formName = useFormName();
            const getFieldValue = useGetFieldValue();
            const setFieldValue = useSetFieldValue();
            const isStreaming = useIsStreaming();
            const name = computed(() => compProps.props.name);
            const checked = computed(() => {
                const fieldValue = getFieldValue(formName?.value, name.value);
                return fieldValue === undefined ? compProps.props.checked : Boolean(fieldValue);
            });

            watchEffect(() => {
                const fn = formName?.value;
                const fieldName = name.value;
                if (!fn || !fieldName) return;
                const existing = getFieldValue(fn, fieldName);
                if (existing !== undefined) return;
                // Checkbox는 기본 checked(false 포함)를 초기 state에 주입
                setFieldValue(fn, 'Checkbox', fieldName, Boolean(compProps.props.checked), true);
            });

            return () =>
                h('label', { class: 'openui-checkbox' }, [
                    h('input', {
                        name: name.value,
                        type: 'checkbox',
                        checked: checked.value,
                        disabled: isStreaming.value,
                        onChange: (event: Event) => {
                            setFieldValue(formName?.value, 'Checkbox', name.value, (event.target as HTMLInputElement).checked, true);
                        }
                    }),
                    h('span', { class: 'openui-checkbox__box' }),
                    h('span', { class: 'openui-checkbox__label' }, renderPrimitiveOrNode(compProps.props.label ?? compProps.props.value, compProps.renderNode))
                ]);
        }
    })
});

const Radio = defineOpenUiComponent({
    name: 'Radio',
    description:
        'Radio group for forms: one string value among options. Use Radio("fieldName", "Group label", {"val": "Label"}, "defaultValue"). Options accept the same shapes as Select.',
    props: z.object({
        name: z.string(),
        label: z.any().optional(),
        options: z.any().optional(),
        value: z.any().optional()
    }),
    component: defineVueComponent({
        name: 'OpenUiRadio',
        props: renderProps,
        setup(compProps) {
            const formName = useFormName();
            const getFieldValue = useGetFieldValue();
            const setFieldValue = useSetFieldValue();
            const isStreaming = useIsStreaming();
            const name = computed(() => compProps.props.name);
            const selected = computed(() => {
                const fieldValue = getFieldValue(formName?.value, name.value);
                if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
                    return String(fieldValue);
                }
                const initial = compProps.props.value;
                return initial !== undefined && initial !== null ? String(initial) : '';
            });

            watchEffect(() => {
                const fn = formName?.value;
                const fieldName = name.value;
                if (!fn || !fieldName) return;
                const existing = getFieldValue(fn, fieldName);
                if (existing !== undefined) return;
                const initial = compProps.props.value;
                if (initial === undefined) return;
                setFieldValue(fn, 'Radio', fieldName, initial, true);
            });

            return () => {
                const options = normalizeOptions(compProps.props.options);

                return h('div', { class: 'openui-field openui-field--radio' }, [
                    compProps.props.label
                        ? h('span', { class: 'openui-field__label' }, renderPrimitiveOrNode(compProps.props.label, compProps.renderNode))
                        : null,
                    h(
                        'div',
                        { class: 'openui-radio-group', role: 'radiogroup', 'aria-label': toDisplayText(compProps.props.label) || name.value },
                        options.map((option) =>
                            h('label', { class: 'openui-radio-option' }, [
                                h('input', {
                                    class: 'openui-radio-option__input',
                                    type: 'radio',
                                    name: name.value,
                                    value: String(option.value),
                                    checked: selected.value === String(option.value),
                                    disabled: isStreaming.value,
                                    onChange: () => {
                                        setFieldValue(formName?.value, 'Radio', name.value, option.value, true);
                                    }
                                }),
                                h('span', { class: 'openui-radio-option__label' }, option.label)
                            ])
                        )
                    )
                ]);
            };
        }
    })
});

const Textarea = defineOpenUiComponent({
    name: 'Textarea',
    description: 'Multi-line text field for forms. Use Textarea("fieldName", "Label", "default", "placeholder", rows).',
    props: z.object({
        name: z.string(),
        label: z.any().optional(),
        value: z.any().optional(),
        placeholder: z.any().optional(),
        rows: z.number().optional().default(4)
    }),
    component: defineVueComponent({
        name: 'OpenUiTextarea',
        props: renderProps,
        setup(compProps) {
            const formName = useFormName();
            const getFieldValue = useGetFieldValue();
            const setFieldValue = useSetFieldValue();
            const isStreaming = useIsStreaming();
            const name = computed(() => compProps.props.name);
            const text = computed(() => getFieldValue(formName?.value, name.value) ?? compProps.props.value ?? '');

            watchEffect(() => {
                const fn = formName?.value;
                const fieldName = name.value;
                if (!fn || !fieldName) return;
                const existing = getFieldValue(fn, fieldName);
                if (existing !== undefined) return;
                if (compProps.props.value === undefined) return;
                setFieldValue(fn, 'Textarea', fieldName, compProps.props.value, true);
            });

            return () =>
                h('label', { class: 'openui-field' }, [
                    compProps.props.label
                        ? h('span', { class: 'openui-field__label' }, renderPrimitiveOrNode(compProps.props.label, compProps.renderNode))
                        : null,
                    h('textarea', {
                        class: 'openui-textarea',
                        name: name.value,
                        rows: compProps.props.rows ?? 4,
                        value: text.value,
                        placeholder: toDisplayText(compProps.props.placeholder),
                        disabled: isStreaming.value,
                        onInput: (event: Event) => {
                            setFieldValue(
                                formName?.value,
                                'Textarea',
                                name.value,
                                (event.target as HTMLTextAreaElement).value,
                                false
                            );
                        },
                        onBlur: (event: Event) => {
                            setFieldValue(
                                formName?.value,
                                'Textarea',
                                name.value,
                                (event.target as HTMLTextAreaElement).value,
                                true
                            );
                        }
                    })
                ]);
        }
    })
});

const Chart = defineOpenUiComponent({
    name: 'Chart',
    description: 'Simple chart renderer. Use Chart(data, "bar", "Title"), Chart(data, "line"), Chart(data, "pie"), or Chart(data, "donut").',
    props: z.object({
        data: z.any().optional(),
        type: z.any().optional().default('bar'),
        title: z.any().optional(),
        labels: z.array(z.any()).optional(),
        values: z.array(z.any()).optional()
    }),
    component: defineVueComponent({
        name: 'OpenUiChart',
        props: renderProps,
        setup(compProps) {
            return () => renderChart(compProps.props);
        }
    })
});

const BarChart = defineOpenUiComponent({
    name: 'BarChart',
    description: 'Bar chart shortcut. Use BarChart(data, "Title").',
    props: z.object({
        data: z.any().optional(),
        title: z.any().optional(),
        labels: z.array(z.any()).optional(),
        values: z.array(z.any()).optional()
    }),
    component: defineVueComponent({
        name: 'OpenUiBarChart',
        props: renderProps,
        setup(compProps) {
            return () => renderChart({ ...compProps.props, type: 'bar' });
        }
    })
});

const LineChart = defineOpenUiComponent({
    name: 'LineChart',
    description: 'Line chart shortcut. Use LineChart(data, "Title").',
    props: z.object({
        data: z.any().optional(),
        title: z.any().optional(),
        labels: z.array(z.any()).optional(),
        values: z.array(z.any()).optional()
    }),
    component: defineVueComponent({
        name: 'OpenUiLineChart',
        props: renderProps,
        setup(compProps) {
            return () => renderChart({ ...compProps.props, type: 'line' });
        }
    })
});

const PieChart = defineOpenUiComponent({
    name: 'PieChart',
    description: 'Pie chart shortcut. Use PieChart(data, "Title").',
    props: z.object({
        data: z.any().optional(),
        title: z.any().optional(),
        labels: z.array(z.any()).optional(),
        values: z.array(z.any()).optional(),
        donut: z.boolean().optional().default(false)
    }),
    component: defineVueComponent({
        name: 'OpenUiPieChart',
        props: renderProps,
        setup(compProps) {
            return () => renderChart({ ...compProps.props, type: compProps.props.donut ? 'donut' : 'pie' });
        }
    })
});

function renderChart(props: Record<string, any>) {
    const chartProps = resolveChartProps(props);
    const series = normalizeChartSeries(chartProps);
    const max = Math.max(1, ...series.map((item) => item.value));
    const total = series.reduce((sum, item) => sum + item.value, 0);
    const palette = ['#1976d2', '#2e7d32', '#6a4bbc', '#00838f', '#c62828', '#455a64'];

    if (!series.length) {
        return h('div', { class: 'openui-chart openui-chart--empty' }, [
            chartProps.title ? h('div', { class: 'openui-chart__title' }, chartProps.title) : null,
            h('div', { class: 'openui-empty' }, '차트 데이터가 없습니다.')
        ]);
    }

    if (chartProps.type === 'line') {
        const points = series
            .map((item, index) => {
                const x = series.length === 1 ? 50 : (index / (series.length - 1)) * 100;
                const y = 100 - (item.value / max) * 82 - 8;
                return `${x},${y}`;
            })
            .join(' ');

        return h('div', { class: 'openui-chart openui-chart--line' }, [
            chartProps.title ? h('div', { class: 'openui-chart__title' }, chartProps.title) : null,
            h('svg', { class: 'openui-chart__line-svg', viewBox: '0 0 100 100', preserveAspectRatio: 'none' }, [
                h('polyline', { class: 'openui-chart__line', points, fill: 'none' }),
                ...series.map((item, index) => {
                    const x = series.length === 1 ? 50 : (index / (series.length - 1)) * 100;
                    const y = 100 - (item.value / max) * 82 - 8;
                    return h('circle', { class: 'openui-chart__point', cx: x, cy: y, r: 2.2 });
                })
            ]),
            h(
                'div',
                { class: 'openui-chart__axis' },
                series.map((item) => h('span', item.label))
            )
        ]);
    }

    if (chartProps.type === 'pie' || chartProps.type === 'donut') {
        let cursor = 0;
        const slices = total
            ? series
                  .map((item, index) => {
                      const start = cursor;
                      cursor += (item.value / total) * 100;
                      return `${palette[index % palette.length]} ${start}% ${cursor}%`;
                  })
                  .join(', ')
            : '#eef0f3 0% 100%';

        return h('div', { class: ['openui-chart', `openui-chart--${chartProps.type}`] }, [
            chartProps.title ? h('div', { class: 'openui-chart__title' }, chartProps.title) : null,
            h('div', { class: 'openui-chart__pie-row' }, [
                h('div', {
                    class: ['openui-chart__pie', chartProps.type === 'donut' ? 'openui-chart__pie--donut' : ''],
                    style: { background: `conic-gradient(${slices})` }
                }),
                h(
                    'div',
                    { class: 'openui-chart__legend' },
                    series.map((item, index) =>
                        h('div', { class: 'openui-chart__legend-item' }, [
                            h('span', { class: 'openui-chart__legend-color', style: { background: palette[index % palette.length] } }),
                            h('span', `${item.label}: ${item.value}`)
                        ])
                    )
                )
            ])
        ]);
    }

    return h('div', { class: 'openui-chart openui-chart--bar' }, [
        chartProps.title ? h('div', { class: 'openui-chart__title' }, chartProps.title) : null,
        h(
            'div',
            { class: 'openui-chart__bars' },
            series.map((item, index) => {
                const percent = Math.round((item.value / max) * 100);
                return h('div', { class: 'openui-chart__bar-row' }, [
                    h('div', { class: 'openui-chart__bar-label' }, item.label),
                    h('div', { class: 'openui-chart__bar-track' }, [
                        h('div', {
                            class: 'openui-chart__bar',
                            style: { width: `${percent}%`, background: palette[index % palette.length] }
                        })
                    ]),
                    h('div', { class: 'openui-chart__bar-value' }, String(item.value))
                ]);
            })
        )
    ]);
}

export const openUiComponentGroups = [
    {
        name: 'Layout',
        components: ['Stack', 'Section', 'Card', 'CardHeader', 'Divider']
    },
    {
        name: 'Content',
        components: ['Heading', 'Paragraph', 'TextContent', 'Callout', 'Alert', 'Badge', 'Tag', 'MarkDownRenderer', 'MarkdownRenderer']
    },
    {
        name: 'Lists',
        components: ['List', 'ListItem', 'KeyValueList', 'KeyValueItem', 'Timeline', 'TimelineItem']
    },
    {
        name: 'Data',
        components: ['Table', 'Col', 'MetricCard', 'MetricGrid', 'Progress', 'Chart', 'BarChart', 'LineChart', 'PieChart']
    },
    {
        name: 'Disclosure',
        components: ['Tabs', 'TabItem', 'Accordion', 'AccordionItem']
    },
    {
        name: 'Forms',
        components: ['Form', 'Input', 'Textarea', 'Select', 'Checkbox', 'Radio']
    },
    {
        name: 'Actions',
        components: ['Button', 'Buttons', 'FollowUpBlock', 'FollowUpItem']
    }
];

export const openUiExamples = [
    `root = Stack([title, card])
title = TextContent("업무 현황", "large-heavy")
card = Card([header, table])
header = CardHeader("진행 중인 작업", "우선순위별 처리 현황")
table = Table([Col("상태", ["대기", "진행", "완료"]), Col("건수", [4, 7, 12])])`,
    `root = Card([header, summary, followUps])
header = CardHeader("프로세스 목적 분석", "[I.3.2.3] 인수인계")
summary = MarkDownRenderer("현재 확인 가능한 프로세스 정보입니다.\\n\\n| 항목 | 값 |\\n|------|----|\\n| 프로세스 ID | i_3_2_3 |\\n| 활동 수 | 0 |", "card")
followUps = FollowUpBlock([fu1, fu2])
fu1 = FollowUpItem("이 프로세스의 활동 목록을 보여줘")
fu2 = FollowUpItem("이 프로세스에서 어떤 역할이 필요해?")`,
    `root = Section("운영 지표", [metrics, chart])
metrics = MetricGrid([m1, m2, m3])
m1 = MetricCard("처리율", "82%", "+5%", "success")
m2 = MetricCard("대기", 7, "전일 대비 -2", "warning")
m3 = MetricCard("오류", 1, "즉시 확인 필요", "danger")
chart = BarChart({"대기": 7, "진행": 12, "완료": 31}, "상태별 건수")`,
    `root = Tabs([tab1, tab2])
tab1 = TabItem("요약", [Paragraph("핵심 분석 결과입니다."), Progress(72, "완료율")])
tab2 = TabItem("상세", [KeyValueList({"프로세스 ID": "i_3_2_3", "역할": "없음"}), Timeline([step1, step2])])
step1 = TimelineItem("컨텍스트 확인", "1단계", "BPMN에서 기본 정보를 수집합니다.", "success")
step2 = TimelineItem("세부 분석", "2단계", "활동과 역할 정보가 필요합니다.", "warning")`,
    `root = Card([header, formBlock])
header = CardHeader("요청 접수", "Form 필드(Input, Textarea, Select, Radio, Checkbox) 예시")
formBlock = Form([nameField, detailField, roleField, priorityField, urgentField], "아래 양식을 작성한 뒤 제출하세요.", "접수 등록")
nameField = Input("requestTitle", "제목", "")
detailField = Textarea("requestBody", "상세 내용", "", "재현 단계·기대 동작 등을 적어주세요.", 4)
roleField = Select("requestType", "유형", {"support": "지원 요청", "improvement": "개선 제안"}, "support", "유형을 선택하세요")
priorityField = Radio("priority", "우선순위", {"low": "일반", "normal": "보통", "high": "긴급"}, "normal")
urgentField = Checkbox("urgent", "긴급 처리 요청", false)`
];

export const openUiPromptOptions = {
    examples: openUiExamples,
    additionalRules: [
        'Use Stack as the root component unless a single Card or Section is enough.',
        'Use only registered OpenUI components from this library.',
        'Use Table with Col children for tabular data.',
        'Use KeyValueList for compact facts and MetricCard or MetricGrid for numeric summaries.',
        'Use Chart, BarChart, LineChart, or PieChart for small visual summaries.',
        'Use Tabs or Accordion only when the answer has distinct sections.',
        'Use Form with Input, Textarea, Select, Radio, and Checkbox only when the user needs to submit structured input.',
        'Use MarkDownRenderer or MarkdownRenderer for markdown tables or formatted long text.',
        'Use FollowUpBlock with FollowUpItem for suggested next questions.',
        'Keep generated UI concise and task-focused.'
    ]
};

export const openUiLibrary = createLibrary({
    root: 'Stack',
    componentGroups: openUiComponentGroups,
    components: [
        Stack,
        Section,
        Card,
        CardHeader,
        Heading,
        Paragraph,
        TextContent,
        Callout,
        Alert,
        MarkDownRenderer,
        MarkdownRenderer,
        Divider,
        List,
        ListItem,
        KeyValueItem,
        KeyValueList,
        MetricCard,
        MetricGrid,
        TimelineItem,
        Timeline,
        TabItem,
        Tabs,
        AccordionItem,
        Accordion,
        Progress,
        Col,
        Table,
        Tag,
        Badge,
        Button,
        Buttons,
        FollowUpItem,
        FollowUpBlock,
        Form,
        Input,
        Textarea,
        Select,
        Checkbox,
        Radio,
        Chart,
        BarChart,
        LineChart,
        PieChart
    ]
});
