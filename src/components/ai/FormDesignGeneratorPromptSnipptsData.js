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
            tag: `<select-field name='<이 선택창의 고유한 이름>' alias='<이 선택창의 별명>' items='<선택 항목 리스트>' disabled='<true|false>'></select-field>`,
            purpose: "여러개의 옵션 중 하나를 선택하기 위해서",
            limit: `선택 항목 리스트는 '[{"label1": "value1"}, {"label2": "value2"}]'와 같이 작성되어야 함.`
        },

        {
            tag: `<checkbox-field name='<이 선택창의 고유한 이름>' alias='<이 선택창의 별명>' items='<선택 항목 리스트>' disabled='<true|false>'></checkbox-field>`,
            purpose: "여러개의 선택 사항들 중, 여러개를 선택하기 위해서",
            limit: `선택 항목 리스트는 '[{"label1": "value1"}, {"label2": "value2"}]'와 같이 작성되어야 함.`
        },

        {
            tag: `<radio-field name='<이 선택창의 고유한 이름>' alias='<이 선택창의 별명>' items='<선택 항목 리스트>' disabled='<true|false>'></radio-field>`,
            purpose: "나열된 여러개의 옵션 중 하나를 선택하기 위해서",
            limit: `선택 항목 리스트는 '[{"label1": "value1"}, {"label2": "value2"}]'와 같이 작성되어야 함.`
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
        }
    ],

    // AI에게 참조할만한 예시를 안내해주기 위해서 {input: "유저 입력", output: "AI 결과"}
    examples: [
        {
            input: "도서 정보 입력 폼을 생성해줘.",
            output: `
            \`\`\`
            {
                "htmlOutput": 
                "<div class='row'>
                    <div class='col-sm-12'>
                        <text-field name='book_title' alias='책 제목'></text-field>
                        <text-field name='book_author' alias='저자'></text-field>
                        <select-field name='book_genre' alias='책 장르' items='[{"소설": "novel"}, {"시": "poem"}, {"에세이": "essay"}]'></select-field>
                        <file-field name='book_cover' alias='책 표지 이미지'></file-field>
                    </div>
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
                    "tagValue": "<select-field name='book_genre' alias='책 장르' items='[{"소설": "novel"}, {"시": "poem"}, {"에세이": "essay"}, {"공상 과학": "SF"}]'></select-field>"
                }
                ]
            }
            \`\`\``
        }
    ]
}

export default formDesignGeneratorPromptSnipptsData;