// CustomRenderer.js 내부에 추가
import BaseRenderer from 'diagram-js/lib/draw/BaseRenderer';
import { create as svgCreate, attr as svgAttr, append as svgAppend } from 'tiny-svg';

const HIGH_PRIORITY = 1500;

class CustomRenderer extends BaseRenderer {
  constructor(eventBus, styles) {
    super(eventBus, HIGH_PRIORITY);
    this.styles = styles;
  }

  canRender(element) {
    return ['custom:strategy', 'custom:strategyLane', 'custom:connection'].includes(element.type);
  }
  
  createLinePathFromWaypoints(waypoints) {
    if (!Array.isArray(waypoints) || waypoints.length === 0) return '';
  
    const [start, ...rest] = waypoints;
    const pathParts = [`M ${start.x} ${start.y}`];
  
    for (const point of rest) {
      pathParts.push(`L ${point.x} ${point.y}`);
    }
  
    return pathParts.join(' ');
  }

  drawConnection(parentNode, element) {
    const waypoints = element.waypoints;
  
    const pathData = this.createLinePathFromWaypoints(waypoints);
  
    const path = svgCreate('path');
    svgAttr(path, {
      d: pathData,
      stroke: '#777',
      strokeWidth: 3,
      fill: 'none'
    });
  
    svgAppend(parentNode, path);
  
    return path;
  }

  drawShape(parentNode, element) {
    if (element.type === 'custom:strategyLane') {
      const rect = svgCreate('rect');
      svgAttr(rect, {
        x: 0,
        y: 0,
        width: element.width,
        height: element.height,
        fill: 'transparent',
        rx: 10,
        ry: 10
      });
      svgAppend(parentNode, rect);

      const label = svgCreate('text');
      svgAttr(label, {
        x: element.width / 2,
        y: element.height / 2 + 5, // 높이 중앙 기준
        'text-anchor': 'middle',
        'font-size': '14',
        fill: this._getLaneColor(element.perspective),
      });
      
      label.textContent = element.name;
      svgAppend(parentNode, label);

      return rect;
    }

    if (element.type === 'custom:strategy') {
      const group = svgCreate('g');
    
      // ✅ 이 부분 추가
      svgAttr(group, { 'data-element-id': element.id });
    
      const ellipse = svgCreate('rect');
      svgAttr(ellipse, {
        x: 0,
        y: 0,
        width: element.width,
        height: element.height,
        rx: 10,
        ry: 10,
        fill: this._getLaneColor(element.perspective),
        stroke: 'transparent',
        'stroke-width': 2
      });
      svgAppend(group, ellipse);
    
      const label = svgCreate('text');
      svgAttr(label, {
        x: element.width / 2,
        y: element.height / 2 + 5,
        'text-anchor': 'middle',
        'font-size': '12',
        fill: '#fff'
      });
      label.textContent = element.name;
      svgAppend(group, label);
    
      svgAppend(parentNode, group);
      return group;
    }
  }

  _getLaneColor(perspective) {
    switch (perspective) {
      case '재무': return '#FA896B';
      case '고객': return '#0074BA';
      case '내부 프로세스': return '#01C0C8';
      case '학습 및 성장': return '#763EBD';
      default: return '#757575';
    }
  }

  getShapePath(shape) {
    if (shape.type === 'custom:strategyLane') {
      return `M0,0h${shape.width}v${shape.height}h-${shape.width}Z`;
    }
    return super.getShapePath(shape);
  }
}

CustomRenderer.$inject = ['eventBus', 'styles'];

export default CustomRenderer;
