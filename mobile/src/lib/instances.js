/**
 * 진행 현황에 무엇을 보여 줄 것인가.
 *
 * 포털의 인스턴스 목록은 조직 전체를 보여 준다. 넓은 화면에서 관리자가 훑는
 * 용도라 그것이 맞다. 그런데 휴대폰에서 같은 목록을 열면 수백에서 수천 건이
 * 나오고, 정작 사용자가 보려던 "내가 낸 그 건" 은 한참 아래에 있다.
 *
 * 그래서 **내가 관련된 건만** 보여 준다. 관련 여부는 인스턴스에 이미 적혀 있는
 * 참여자와 역할 배정에서 읽는다 — 따로 물어볼 필요가 없다.
 */

/** 값 안에 들어 있는 사람 식별자들을 모두 끌어모은다. */
function idsIn(value, out = []) {
    if (value === null || value === undefined) return out;

    if (typeof value === 'string') {
        const v = value.trim();
        if (v) out.push(v);
        return out;
    }
    if (Array.isArray(value)) {
        for (const item of value) idsIn(item, out);
        return out;
    }
    if (typeof value === 'object') {
        // 역할 배정은 { name, endpoint, default } 모양이고, endpoint 가 배열일 때도 있다.
        idsIn(value.endpoint, out);
        idsIn(value.default, out);
        idsIn(value.userId, out);
        idsIn(value.user_id, out);
    }
    return out;
}

/**
 * 이 건에 내가 관련돼 있는가.
 *
 * 식별자로도 이메일로도 적힐 수 있어 둘 다 본다. 한쪽만 보면 어떤 건은
 * 관련이 있는데도 목록에서 사라진다.
 */
export function involvesMe(instance, me = {}) {
    const mine = [me.uid, me.email].map((v) => (v || '').toString().trim()).filter(Boolean);
    if (!mine.length) return false;

    const ids = [...idsIn(instance?.participants), ...idsIn(instance?.roleBindings)];
    return ids.some((id) => mine.includes(id));
}

/** 이 건에 참여자 정보가 적혀 있는가. */
export function hasParticipantInfo(instance) {
    return idsIn(instance?.participants).length > 0 || idsIn(instance?.roleBindings).length > 0;
}

/**
 * 화면에 보여 줄 목록.
 *
 * 두 경우를 구분한다.
 *   - 참여자 정보가 있는데 내가 없다  → 내 건이 아니다. 빈 목록이 맞다.
 *   - 참여자 정보 자체가 없다        → 알 수 없다. 전부 보여 준다.
 *
 * 구분하지 않으면 둘 중 하나가 반드시 나빠진다. 전부 보여 주면 관련 없는
 * 사람에게 조직의 수천 건이 뜨고, 전부 감추면 정보가 비어 있는 건을 가진
 * 사람은 자기 건이 사라졌다고 느낀다.
 */
export function visibleInstances(instances, me = {}) {
    const list = Array.isArray(instances) ? instances : [];
    if (!list.some(hasParticipantInfo)) return list;
    return list.filter((inst) => involvesMe(inst, me));
}
