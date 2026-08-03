/**
 * Vue 3.5 의 `useId()` 는 이 프로젝트가 고정한 Vue 3.2.31 에 없다.
 * 라벨 ↔ 입력 연결(`for` / `aria-describedby`)에 쓸 안정적인 고유 id 를 만든다.
 */
let seq = 0;

export function nextFieldId(prefix = 'pg-field'): string {
    seq += 1;
    return `${prefix}-${seq}`;
}
