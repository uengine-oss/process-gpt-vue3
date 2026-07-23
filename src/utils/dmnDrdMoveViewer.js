import Manager from 'dmn-js-shared/lib/base/Manager';
import DrdModeler from 'dmn-js-drd/lib/Modeler';
import DecisionTableViewer from 'dmn-js-decision-table/lib/Viewer';
import LiteralExpressionViewer from 'dmn-js-literal-expression/lib/Viewer';
import { Viewer as BoxedExpressionViewer } from 'dmn-js-boxed-expression';
import { is, getBoxedExpression } from 'dmn-js-shared/lib/util/ModelUtil';
import { containsDi } from 'dmn-js-shared/lib/util/DiUtil';

// DRD 캔버스에서 편집(라벨 변경, 연결선 생성/리라우팅, 리사이즈, 팔레트/컨텍스트 패드 조작)은
// 막되, 요소 이동과 화면 드래그/줌은 그대로 동작시키기 위한 가드.
// connect/resize/bendpoint 이벤트의 '.start'만 막으면 diagram-js dragging 서비스가
// 해당 드래그만 중단시키고, 다른 prefix(shape.move 등)의 드래그는 영향받지 않는다.
function EditingGuard(eventBus) {
    const block = (event) => event.preventDefault();
    eventBus.on('connect.start', block);
    eventBus.on('resize.start', block);
    eventBus.on('bendpoint.move.start', block);
    eventBus.on('connectionSegment.move.start', block);
}
EditingGuard.$inject = ['eventBus'];

// contextPadProvider / paletteProvider / labelEditingProvider / definitionPropertiesEdit 는
// __init__ 시점에 생성자가 실행되며 그 안에서 이벤트 리스너 및 UI를 등록한다.
// 값을 빈 객체로 덮어써서 생성자 자체가 실행되지 않도록 하여 팔레트, 컨텍스트 패드,
// 더블클릭 라벨 편집, 상단 정의 이름 인라인 편집을 모두 비활성화한다.
const disableEditingModule = {
    __init__: ['editingGuard'],
    editingGuard: ['type', EditingGuard],
    contextPadProvider: ['value', {}],
    paletteProvider: ['value', {}],
    labelEditingProvider: ['value', {}],
    definitionPropertiesEdit: ['value', {}]
};

/**
 * DRD 뷰는 이동/화면 드래그/줌은 가능하지만 편집은 불가능한 모델러(DrdModeler 기반)를 사용하고,
 * 디시전 테이블/리터럴 표현식 뷰는 기존 dmn-js Viewer와 동일하게 읽기 전용으로 유지하는 매니저.
 */
class DmnDrdMoveViewer extends Manager {
    _getViewProviders() {
        return [
            {
                id: 'drd',
                constructor: DrdModeler,
                opens(element) {
                    return is(element, 'dmn:Definitions') && containsDi(element);
                }
            },
            {
                id: 'decisionTable',
                constructor: DecisionTableViewer,
                opens(element) {
                    return is(element, 'dmn:Decision') && is(element.decisionLogic, 'dmn:DecisionTable');
                }
            },
            {
                id: 'literalExpression',
                constructor: LiteralExpressionViewer,
                opens(element) {
                    return is(element, 'dmn:Decision') && is(element.decisionLogic, 'dmn:LiteralExpression');
                }
            },
            {
                id: 'boxedExpression',
                constructor: BoxedExpressionViewer,
                opens(element) {
                    return is(element, 'dmn:BusinessKnowledgeModel') && getBoxedExpression(element);
                }
            }
        ];
    }
}

export default DmnDrdMoveViewer;
export { disableEditingModule };
