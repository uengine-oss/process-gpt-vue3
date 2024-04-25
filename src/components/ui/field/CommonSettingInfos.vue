<script>
/**
 * 사용되는 속성들을 종합적으로 관리하기 위해서
 * dataToUse: 실제로 설정이나 HTML 변수로 반영시킬 data 변수명
 * htmlAttribute: HTML 속성으로 사용되는 이름
 * settingLabel: 변수 값 설정창에서 표시되는 라벨
 * settingType: 설정창에서 입력을 받기 위한 타입
 *     text: 문자열로 입력받는 속성
 *     items: [{"key1":"value1"}, {"key2":"value2"}] 와 같은 형태로 입력받는 속성
 * validCheck: 설정창에서 입력 완료시에 유효성을 확인하는데 사용되는 함수
 */
export const commonSettingInfos = {
    "localName": {
        dataToUse: "localName",
        htmlAttribute: "name",
        settingLabel: "Name",
        settingType: "text",
        validCheck: (value) => {
            if (!value || value.length <= 0) return "Name 속성에 값을 입력해 주세요."
            if (!/^[가-힣a-zA-Z0-9_\-. ]+$/.test(value)) return "Name 속성은 한글, 영문, 숫자, 공백, 밑줄(_), 대시(-), 점(.) 만 입력 가능합니다!"
            return null
        }
    },

    "localAlias": {
        dataToUse: "localAlias",
        htmlAttribute: "alias",
        settingLabel: "Label",
        settingType: "text"
    },

    "localDisabled": {
        dataToUse: "localDisabled",
        htmlAttribute: "disabled",
        settingLabel: "ReadOnly",
        settingType: "checkbox"
    },

    "localItems": {
        dataToUse: "localItems",
        htmlAttribute: "items",
        settingLabel: "Items",
        settingType: "items"
    }
};
</script>

