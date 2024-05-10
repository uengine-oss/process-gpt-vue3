// '/public/snippets/default/snippets.html'을 참조해서 AI 에게 생성시킬 컨테이너, 프롬프트 정보를 알려주기 위해서
const formDesignGeneratorPromptSnipptsData = {
    // AI가 사용할 컨테이너 레이아웃 조합을 전달해주기 위해서 (col-sm-{숫자}의 조합)
    containerSpaceSets: [
        [12],
        [6, 6],
        [4, 8],
        [8, 4],
        [4, 4, 4],
        [3, 6, 3],
        [3, 3, 3, 3]
    ],

    // AI가 사용할 컴포넌트들의 세부 정보를 전달하기 위해서 {tag: "태그", purpose: "목적", limit: "주의사항/제한사항"}
    // * 태그의 속성에 관한 문법
    // 1. 태그에 "<>"로 감싸서 설명을 해줄 경우, AI가 그 값을 적절하게 교채함
    // 2. "<값1|값2>"와 같이 작성할 경우, AI는 그 중 하나의 값을 선택해서 사용함
    // 3. 그냥 속성을 적어주면, 그것이 상수라고 생각하고 그대로 사용함
    componentInfos: [
        {
            tag: `<text-field name='<이 입력창의 고유한 이름>' alias='<이 입력창의 별명>' type='<text|number|email|url|date|datetime-local|month|week|time|password|tel|color>' disabled='<true|false>'></text-field>`,
            purpose: "다양한 유형의 텍스트를 입력받기 위해서",
            limit: "년도와 같이 선택해야 할 항목이 너무 많은 경우에는 text-field를 사용할 것"
        },

        {
            tag: `<textarea-field name='<이 입력창의 고유한 이름>' alias='<이 입력창의 별명>' rows='<입력창의 행 크기>' disabled='<true|false>'></textarea-field>`,
            purpose: "여러 행에 걸쳐서 텍스트를 입력받기 위해서",
            limit: ""
        },

        {
            tag: `<boolean-field name='<이 입력창의 고유한 이름>' alias='<이 입력창의 별명>' disabled='<true|false>'></boolean-field>`,
            purpose: `'true' 또는 'false' 중 하나를 선택하기 위해서`,
            limit: ""
        },

        {
            tag: `<select-field name='<이 선택창의 고유한 이름>' alias='<이 선택창의 별명>' is_dynamic_load='<true|false>' ` + 
                 `items='<is_dynamic_load가 false시에 선택 항목 리스트>' ` + 
                 `dynamic_load_url='<is_dynamic_load가 true시에 JSON 데이터 로드 URL>' ` +
                 `dynamic_load_key_json_path='<is_dynamic_load가 true시에 키 배열을 담을 JSON PATH>' ` + 
                 `dynamic_load_value_json_path='<is_dynamic_load가 true시에 값 배열을 담을 JSON PATH>' ` +
                 `disabled='<true|false>'></select-field>`,
            purpose: "여러개의 옵션 중 하나를 선택하기 위해서",
            limit: `is_dynamic_load가 false인 경우, 선택 항목 리스트를 만들기 위해서 items 필수 작성.` +
                   `items는 '[{"key1": "label1"}, {"key2": "label2"}]'와 같이 작성되어야 함.` +
                   `is_dynamic_load가 true인 경우, dynamic_load_url, dynamic_load_key_json_path, dynamic_load_value_json_path 필수 작성.`
        },

        {
            tag: `<checkbox-field name='<이 선택창의 고유한 이름>' alias='<이 선택창의 별명>' is_dynamic_load='<true|false>' ` + 
                 `items='<is_dynamic_load가 false시에 선택 항목 리스트>' ` + 
                 `dynamic_load_url='<is_dynamic_load가 true시에 JSON 데이터 로드 URL>' ` +
                 `dynamic_load_key_json_path='<is_dynamic_load가 true시에 키 배열을 담을 JSON PATH>' ` + 
                 `dynamic_load_value_json_path='<is_dynamic_load가 true시에 값 배열을 담을 JSON PATH>' ` +
                 `disabled='<true|false>'></checkbox-field>`,
            purpose: "여러개의 선택 사항들 중, 여러개를 선택하기 위해서",
            limit: `is_dynamic_load가 false인 경우, 선택 항목 리스트를 만들기 위해서 items 필수 작성.` +
                   `items는 '[{"key1": "label1"}, {"key2": "label2"}]'와 같이 작성되어야 함.` +
                   `is_dynamic_load가 true인 경우, dynamic_load_url, dynamic_load_key_json_path, dynamic_load_value_json_path 필수 작성.`
        },

        {
            tag: `<radio-field name='<이 선택창의 고유한 이름>' alias='<이 선택창의 별명>' is_dynamic_load='<true|false>' ` + 
                 `items='<is_dynamic_load가 false시에 선택 항목 리스트>' ` + 
                 `dynamic_load_url='<is_dynamic_load가 true시에 JSON 데이터 로드 URL>' ` +
                 `dynamic_load_key_json_path='<is_dynamic_load가 true시에 키 배열을 담을 JSON PATH>' ` + 
                 `dynamic_load_value_json_path='<is_dynamic_load가 true시에 값 배열을 담을 JSON PATH>' ` +
                 `disabled='<true|false>'></radio-field>`,
            purpose: "나열된 여러개의 옵션 중 하나를 선택하기 위해서",
            limit: `is_dynamic_load가 false인 경우, 선택 항목 리스트를 만들기 위해서 items 필수 작성.` +
                   `items는 '[{"key1": "label1"}, {"key2": "label2"}]'와 같이 작성되어야 함.` +
                   `is_dynamic_load가 true인 경우, dynamic_load_url, dynamic_load_key_json_path, dynamic_load_value_json_path 필수 작성.`
        },

        {
            tag: `<user-select-field name='<이 선택창의 고유한 이름>' alias='<이 선택창의 별명>' disabled='<true|false>'></user-select-field>`,
            purpose: "유저들을 선택하기 위해서",
            limit: ""
        },

        {
            tag: `<file-field name='<이 선택창의 고유한 이름>' alias='<이 선택창의 별명>' disabled='<true|false>'></file-field>`,
            purpose: `파일을 입력받기 위해서`,
            limit: ""
        },

        {
            tag: `<label-field label='<입력시킬 라벨 값>'></label-field>`,
            purpose: `특정 컴포넌트를 설명하기 위해서`,
            limit: "name, alias가 있는 경우에는 이미 내부적으로 label이 설정되기 때문에 쓸 필요가 없음"
        },

        {
            tag: `<code-field name='<이 코드의 고유한 이름>' alias='<이 코드의 별명>' event_type='<click|initialize|validate|watch>' watch_name='<event_type이 watch인 경우, 감시할 name 속성>'>실행시킬 Javascript 코드</code-field>`,
            purpose: `지정된 이벤트가 발생하면 코드를 실행하기 위해서`,
            limit: `* event_type에 따라서 코드를 실행하는 방식이 달라짐\n` +
                   `click인 경우, 버튼을 누를 경우, 주어진 코드가 실행됨\n` +
                   `initialize인 경우, 맨 처음 폼이 표시될때 주어진 코드가 실행됨\n` +
                   `validate인 경우, 폼을 제출할시에 주어진 코드가 실행됨\n` +
                   `watch인 경우, watch_name 속성에 정의된 값이 변경될 경우, 주어진 코드가 실행됨\n` +
                   `* 코드 작성 규칙은 다음과 같음\n` +
                   `1. 각각의 코드 작성 줄이 끝나면 ';'를 붙여야 함\n` +
                   `2. 주어진 코드가 실행되기 위해서는 반드시 자바스크립트 코드를 사용해야 함\n` +
                   `3. 현재 유저가 입력한 값은 this.formValues[<name 속성>]에 저장되어 있음\n` +
                   `4. event_type이 watch인 경우, this.oldFormValues[<name 속성>]에 이전 값이 저장되어 있음\n` +
                   `5. event_type이 validate인 경우, 에러가 있을 경우, error 속성에 에러메시지를 저장하고, 없을 경우 아무것도 하지 않으면 됨`
        }
    ],

    // AI에게 참조할만한 예시를 안내해주기 위해서 {input: "유저 입력", output: "AI 결과"}
    examples: [
        {
            input: "도서 정보 입력 폼을 생성해줘. 책 제목이 입력되었는지 제출시 검사하도록 만들어줘.",
            output: `
            \`\`\`
            {
                "htmlOutput": 
                "<div class='row' name='book_info' alias='도서 정보' is_multidata_mode='false'>
                    <div class='col-sm-12'>
                        <text-field name='book_title' alias='책 제목'></text-field>
                        <text-field name='book_author' alias='저자'></text-field>
                        <text-field name='book_price' alias='가격' type='number'></text-field>
                        <text-field name='book_publish_date' alias='발행날짜' type='date'></text-field>
                        <select-field name='book_genre' alias='책 장르' is_dynamic_load='false' items='[{"novel": "소설"}, {"poem": "시"}, {"essay": "에세이"}]'></select-field>
                        <file-field name='book_cover' alias='책 표지 이미지'></file-field>
                    </div>
                    <code-field name="checkBookTitle" alias="책 제목 검사" event_type="validate">
                        if(this.formValues["book_title"] === "") error = "책 제목은 반드시 입력해야 합니다."
                    </code-field>  
                </div>"
            }
            \`\`\``
        },
        {
            input: "도서 정보 입력 폼에서 책 장르에 '공상 과학' 항목을 추가해줘",
            output: `
            \`\`\`
            {
                "modifications":[
                {
                    "action": "replace",
                    "targetCSSSelector": "select-field[name='book_genre']",
                    "tagValue": "<select-field name='book_genre' alias='책 장르' is_dynamic_load='false' items='[{"novel": "소설"}, {"poem": "시"}, {"essay": "에세이"}, {"SF": "공상 과학"}]'></select-field>"
                }
                ]
            }
            \`\`\``
        }
    ]
}

export default formDesignGeneratorPromptSnipptsData;