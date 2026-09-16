import BpmnViewer from 'bpmn-js/lib/Viewer';
import { create as createElement } from 'diagram-js/lib/model';
import { registerDrilldownHistory } from './drilldownHistory';

const HISTORY_KEY = 'caDrilldown';
const TARGET_TYPES = new Set(['bpmn:CallActivity', 'bpmn:StartEvent', 'bpmn:EndEvent']);

/** Display-only child planes. Never attach their business objects to the host definitions. */
export default class CallActivityDrilldown {
    constructor(eventBus, canvas, elementRegistry, overlays, config) {
        this._eventBus = eventBus;
        this._canvas = canvas;
        this._registry = elementRegistry;
        this._overlays = overlays;
        this._config = config;
        this._trail = [];
        this._planes = new Map();
        this._buttons = new Map();
        this._historyEntries = new Map();
        this._session = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        this._generation = 0;
        this._busy = false;
        this._destroyed = false;
        this._unregisterHistory = registerDrilldownHistory(this._session, (state) => {
            const trail = this._historyEntries.get(state.entry);
            return (
                !this._destroyed && location.href === this._historyUrl && !!trail && !!this._registry.get(trail[trail.length - 1].root.id)
            );
        });

        eventBus.on('import.render.complete', () => {
            this._initBreadcrumbs();
            this._addDrilldownOverlays();
        });
        eventBus.on('root.set', () => this._renderBreadcrumbs());
        eventBus.on('elements.changed', () => this._addDrilldownOverlays());
        eventBus.on('shape.removed', ({ element }) => this._removeOverlay(element.id));
        eventBus.on('element.dblclick', 2000, (event) => {
            if (!this._isTarget(event.element)) return;
            if (!this._config.isViewMode) return;
            event.originalEvent?.preventDefault();
            this.drill(event.element);
            return false;
        });
        // Display-only elements must never be moved, deleted, or edited with modeler tools.
        eventBus.on('commandStack.canExecute', 2000, () => {
            if (this._canvas.getRootElement()?._caDrilldown) return false;
        });
        eventBus.on('diagram.clear', () => this._reset());
        eventBus.on('diagram.destroy', () => {
            this._destroyed = true;
            this._reset();
            this._wrapper?.remove();
            this._unregisterHistory();
            window.removeEventListener('popstate', this._popstate, true);
        });
        this._popstate = (event) => {
            const state = event.state?.[HISTORY_KEY];
            if (state?.session !== this._session || location.href !== this._historyUrl) return;
            const trail = this._historyEntries.get(state.entry);
            if (!trail || !this._registry.get(trail[trail.length - 1].root.id)) return;
            // withCallActivityHistory keeps this plane change out of Vue Router navigation.
            this._goBack(trail);
        };
        window.addEventListener('popstate', this._popstate, true);
    }

    _resolveDefinitionId(element) {
        const bo = element?.businessObject;
        for (const ext of bo?.extensionElements?.values || []) {
            if (ext.$type !== 'uengine:Properties' && ext.$type !== 'uengine:properties') continue;
            try {
                const raw = ext.json || ext.$children?.find((child) => child.$body)?.$body;
                const parsed = raw && JSON.parse(raw);
                // Start 이벤트 다중 연결(definitionIds 배열)은 첫 항목으로 드릴다운한다.
                const multi = Array.isArray(parsed?.definitionIds) ? parsed.definitionIds : [];
                const id = multi.find((v) => typeof v === 'string' && v.trim()) || parsed?.definitionId;
                if (typeof id === 'string' && id.trim()) return id.trim().replace(/\.bpmn$/i, '');
            } catch (_) {
                /* A malformed extension can still use calledElement. */
            }
        }
        return typeof bo?.calledElement === 'string' ? bo.calledElement.trim().replace(/\.bpmn$/i, '') : '';
    }

    _isTarget(element) {
        return (
            this._config.enabled !== false &&
            !element?.labelTarget &&
            TARGET_TYPES.has(element?.type) &&
            !!this._resolveDefinitionId(element)
        );
    }

    _initBreadcrumbs() {
        if (this._wrapper) return;
        const wrapper = document.createElement('div');
        wrapper.className = 'ca-drilldown-breadcrumbs';
        wrapper.setAttribute('aria-label', '호출 프로세스 탐색');
        const trail = document.createElement('div');
        trail.className = 'ca-drilldown-breadcrumbs__trail';
        const actions = document.createElement('div');
        actions.className = 'ca-drilldown-breadcrumbs__actions';
        const back = document.createElement('button');
        back.type = 'button';
        back.className = 'ca-drilldown-btn';
        back.textContent = '← 돌아가기';
        back.addEventListener('click', () => {
            if (this._busy || this._trail.length <= 1) return;
            this._busy = true;
            this._renderBreadcrumbs();
            window.history.back();
        });
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'ca-drilldown-btn';
        edit.textContent = '편집하기 ↗';
        edit.addEventListener('click', () => this._openCurrentInNew());
        actions.append(back, edit);
        wrapper.append(trail, actions);
        this._canvas.getContainer().append(wrapper);
        this._wrapper = wrapper;
        this._trailNode = trail;
        this._backButton = back;
        this._editButton = edit;
    }

    _addDrilldownOverlays() {
        if (this._destroyed) return;
        for (const element of this._registry.getAll()) {
            if (this._isTarget(element)) this._addOverlay(element);
            else this._removeOverlay(element.id);
        }
    }

    _removeOverlay(id) {
        const existing = this._buttons.get(id);
        if (!existing) return;
        this._overlays.remove(existing.overlayId);
        this._buttons.delete(id);
    }

    _addOverlay(element) {
        if (this._buttons.has(element.id)) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'bjs-drilldown ca-drilldown';
        button.title = this._config.isViewMode ? '호출 프로세스 펼쳐보기' : '호출 프로세스 새 탭에서 편집';
        button.setAttribute('aria-label', button.title);
        const icon = document.createElement('span');
        icon.className = 'ca-drilldown__icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = '↗';
        button.append(icon);
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            this.drill(element);
        });
        const overlayId = this._overlays.add(element, 'ca-drilldown', { position: { top: -10, right: -10 }, html: button });
        this._buttons.set(element.id, { button, overlayId });
    }

    async drill(element) {
        if (!this._isTarget(element) || this._destroyed || this._busy) return;
        const definitionId = this._resolveDefinitionId(element);
        const label = element.businessObject.name || definitionId;
        if (!this._config.isViewMode) {
            this._config.onOpenInNew?.(definitionId, label);
            return;
        }
        const parentRoot = this._canvas.findRoot(element);
        if (parentRoot !== this._canvas.getRootElement()) return;
        const generation = this._generation;
        const url = location.href;
        const button = this._buttons.get(element.id)?.button;
        this._busy = true;
        button?.classList.add('ca-drilldown--loading');
        if (button) button.disabled = true;
        this._renderBreadcrumbs();
        try {
            const childRoot = await this._buildPlane(element, definitionId, generation);
            if (!childRoot || generation !== this._generation || this._destroyed || location.href !== url) return;
            if (this._canvas.getRootElement() !== parentRoot) return;
            this._enter(parentRoot, childRoot, element);
        } catch (error) {
            if (generation === this._generation && !this._destroyed) this._config.onError?.(error, element);
        } finally {
            if (generation === this._generation) this._busy = false;
            button?.classList.remove('ca-drilldown--loading');
            if (button) button.disabled = false;
            if (!this._destroyed) this._renderBreadcrumbs();
        }
    }

    async _buildPlane(element, definitionId, generation) {
        const cached = this._planes.get(element.id);
        if (cached?.definitionId === definitionId && this._registry.get(cached.root.id)) return cached.root;
        const xml = await this._config.resolveXml(definitionId, element);
        if (generation !== this._generation || this._destroyed) return null;
        if (typeof xml !== 'string' || !xml.trim()) throw new Error(`참조 프로세스 도면을 찾을 수 없습니다: ${definitionId}`);
        const viewer = new BpmnViewer({ moddleExtensions: this._config.moddleExtensions || {} });
        try {
            await viewer.importXML(xml);
            if (generation !== this._generation || this._destroyed) return null;
            if (cached) this._removePlane(cached);
            const result = this._mirrorPlane(viewer, element);
            this._planes.set(element.id, { ...result, definitionId });
            this._addDrilldownOverlays();
            return result.root;
        } finally {
            viewer.destroy();
        }
    }

    _mirrorPlane(viewer, sourceElement) {
        const registry = viewer.get('elementRegistry');
        const childCanvas = viewer.get('canvas');
        const mainRoot = childCanvas.getRootElement();
        const prefix = `${sourceElement.id}::`;
        const copies = new Map();
        const roots = [];
        const added = [];
        const renamed = new Set();
        const attributes = (element) => {
            // These BOs belong solely to the temporary viewer, never to the host definitions.
            const bo = element.businessObject;
            if (bo && !renamed.has(bo)) {
                if (bo.id) bo.id = prefix + bo.id;
                renamed.add(bo);
            }
            return {
                id: prefix + element.id,
                type: element.type,
                businessObject: bo,
                di: element.di,
                x: element.x,
                y: element.y,
                width: element.width,
                height: element.height,
                hidden: element.hidden,
                collapsed: element.collapsed,
                isFrame: element.isFrame,
                _caDrilldown: true
            };
        };
        try {
            for (const original of childCanvas.getRootElements()) {
                const attrs = attributes(original);
                if (original === mainRoot) attrs.id = `${sourceElement.id}_ca_plane`;
                const root = createElement('root', attrs);
                this._canvas.addRootElement(root);
                roots.push(root);
                copies.set(original, root);
            }
            const copyShape = (original) => {
                if (copies.has(original)) return copies.get(original);
                const parent = copyShape(original.parent);
                const shape = createElement('shape', attributes(original));
                // Boundary event hosts must already exist when rendering.
                if (original.host) shape.host = copyShape(original.host);
                this._canvas.addShape(shape, parent);
                added.push(shape);
                copies.set(original, shape);
                return shape;
            };
            const elements = registry.getAll();
            for (const original of elements) {
                if (original.parent && !original.waypoints && !original.labelTarget) copyShape(original);
            }
            for (const original of elements.filter((item) => item.waypoints)) {
                const connection = createElement('connection', {
                    ...attributes(original),
                    source: copies.get(original.source),
                    target: copies.get(original.target),
                    waypoints: original.waypoints.map((point) => ({
                        ...point,
                        ...(point.original ? { original: { ...point.original } } : {})
                    }))
                });
                this._canvas.addConnection(connection, copies.get(original.parent));
                added.push(connection);
                copies.set(original, connection);
            }
            for (const original of elements.filter((item) => item.labelTarget)) {
                const label = createElement('label', { ...attributes(original), labelTarget: copies.get(original.labelTarget) });
                this._canvas.addShape(label, copies.get(original.parent));
                added.push(label);
                copies.set(original, label);
            }
            return { root: copies.get(mainRoot), roots, added };
        } catch (error) {
            this._removePlane({ roots, added });
            throw error;
        }
    }

    _removePlane({ roots, added }) {
        for (const element of [...added].reverse()) {
            this._removeOverlay(element.id);
            if (element.waypoints) this._canvas.removeConnection(element);
            else this._canvas.removeShape(element);
        }
        for (const root of roots) this._canvas.removeRootElement(root);
    }

    _enter(parentRoot, childRoot, element) {
        if (!this._trail.length) {
            this._trail = [
                {
                    root: parentRoot,
                    label: this._config.rootLabel || parentRoot.businessObject?.name || '프로세스',
                    viewbox: { ...this._canvas.viewbox() }
                }
            ];
            this._historyUrl = location.href;
            this._writeHistory(false);
        }
        this._trail[this._trail.length - 1].viewbox = { ...this._canvas.viewbox() };
        const currentEntry = this._historyEntries.get(history.state?.[HISTORY_KEY]?.entry);
        if (currentEntry) currentEntry[currentEntry.length - 1].viewbox = { ...this._canvas.viewbox() };
        this._trail.push({
            root: childRoot,
            definitionId: this._resolveDefinitionId(element),
            label: element.businessObject.name || this._resolveDefinitionId(element)
        });
        this._canvas.setRootElement(childRoot);
        this._canvas.zoom('fit-viewport');
        this._writeHistory(true);
        this._config.onAfterEnter?.(childRoot, element);
    }

    _writeHistory(push) {
        const entry = `${this._session}:${this._historyEntries.size}`;
        this._historyEntries.set(
            entry,
            this._trail.map((item) => ({ ...item }))
        );
        // Preserve Vue Router's back/current/forward/position/scroll fields.
        const state = { ...history.state, [HISTORY_KEY]: { session: this._session, entry, depth: this._trail.length } };
        if (push) history.pushState(state, '');
        else history.replaceState(state, '');
    }

    _goBack(trail = this._trail.slice(0, -1)) {
        if (!trail.length) return;
        this._trail = trail.map((item) => ({ ...item }));
        this._busy = false;
        const current = this._trail[this._trail.length - 1];
        this._canvas.setRootElement(current.root);
        if (current.viewbox) this._canvas.viewbox(current.viewbox);
        else this._canvas.zoom('fit-viewport');
        this._renderBreadcrumbs();
    }

    _renderBreadcrumbs() {
        if (!this._wrapper) return;
        const root = this._canvas.getRootElement();
        const currentIdx = this._trail.findIndex((item) => item.root === root);
        const visible = this._trail.length > 1 && currentIdx > 0;
        this._wrapper.classList.toggle('ca-drilldown-breadcrumbs--visible', visible);
        this._backButton.disabled = this._busy;
        this._editButton.disabled = this._busy || !this._config.onOpenInNew;
        this._trailNode.replaceChildren();
        if (!visible) return;
        this._trail.slice(1, currentIdx + 1).forEach((item, index) => {
            const node = document.createElement('span');
            node.className = 'ca-drilldown-breadcrumbs__item';
            const text = document.createElement('span');
            text.className =
                'ca-drilldown-breadcrumbs__link' + (index === currentIdx - 1 ? ' ca-drilldown-breadcrumbs__link--current' : '');
            text.textContent = item.label;
            text.title = item.label;
            node.append(text);
            this._trailNode.append(node);
        });
    }

    _openCurrentInNew() {
        const current = this._trail.find((item) => item.root === this._canvas.getRootElement());
        if (current?.definitionId) this._config.onOpenInNew?.(current.definitionId, current.label);
    }

    _reset() {
        this._generation++;
        this._busy = false;
        this._trail = [];
        this._planes.clear();
        this._buttons.clear();
        this._historyEntries.clear();
        if (history.state?.[HISTORY_KEY]?.session === this._session) {
            const state = { ...history.state };
            delete state[HISTORY_KEY];
            history.replaceState(state, '');
        }
        this._wrapper?.classList.remove('ca-drilldown-breadcrumbs--visible');
    }
}

CallActivityDrilldown.$inject = ['eventBus', 'canvas', 'elementRegistry', 'overlays', 'callActivityDrilldownConfig'];
