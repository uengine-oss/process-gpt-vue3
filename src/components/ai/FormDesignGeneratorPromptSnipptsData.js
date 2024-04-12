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
            tag: `<text-field name='<이 입력창의 고유한 이름>' alias='<이 입력창의 별명>'></text-field>`,
            purpose: "텍스트를 입력받기 위해서",
            limit: "년도와 같이 선택해야 할 항목이 너무 많은 경우에는 text-field를 사용할 것"
        },

        {
            tag: `<select-field name='<이 선택창의 고유한 이름>' alias='<이 선택창의 별명>' items='<선택 항목 리스트>'></select-field>`,
            purpose: "여러개의 옵션 중 하나를 선택하기 위해서",
            limit: `선택 항목 리스트는 '[{"label1": "value1"}, {"label2": "value2"}]'와 같이 작성되어야 함. '...'으로 생략하지 말고 모든 요소를 적어야 함.`
        },

        {
            tag: `<checkbox-field name='<이 선택창의 고유한 이름>' alias='<이 선택창의 별명>' items='<선택 항목 리스트>'></checkbox-field>`,
            purpose: "여러개의 선택 사항들 중, 여러개를 선택하기 위해서",
            limit: `선택 항목 리스트는 '[{"label1": "value1"}, {"label2": "value2"}]'와 같이 작성되어야 함. '...'으로 생략하지 말고 모든 요소를 적어야 함.`
        },

        {
            tag: `<radio-field name='<이 선택창의 고유한 이름>' alias='<이 선택창의 별명>' items='<선택 항목 리스트>'></radio-field>`,
            purpose: "나열된 여러개의 옵션 중 하나를 선택하기 위해서",
            limit: `선택 항목 리스트는 '[{"label1": "value1"}, {"label2": "value2"}]'와 같이 작성되어야 함. '...'으로 생략하지 말고 모든 요소를 적어야 함.`
        },

        {
            tag: `<file-field name='<이 선택창의 고유한 이름>' alias='<이 선택창의 별명>'></file-field>`,
            purpose: `파일을 입력받기 위해서`,
            limit: ""
        },

        {
            tag: `<label-field label='<입력시킬 라벨 값>'></label-field>`,
            purpose: `특정 컴포넌트를 설명하기 위해서`,
            limit: "name, alias가 있는 경우에는 이미 내부적으로 label이 설정되기 때문에 쓸 필요가 없음"
        },

        {
            tag: `<submit-field></submit-field>`,
            purpose: `유저의 입력을 처리하기 위해서`,
            limit: "반드시 포함되어야 하며, 한 번만 사용 가능"
        }
    ],

    // AI에게 참조할만한 예시를 안내해주기 위해서 {title: "제목", description: "설명", result: "결과(Json 객체)"}
    examples: [
        {
            title: "도서 정보 입력 폼",
            description: `먼저, 유효한 레이아웃을 생각해 봐야 해.
            도서 정보 입력 폼은 책 제목, 저자, 책 장르, 책 표지 이미지, 그리고 제출 버튼 정도가 필요하겠네.
            현재 정보가 그리 많지는 않기 때문에 12의 공간을 차지하는 하나의 col-sm-12로 만들어주면 돼.

            책 제목, 저자는 텍스트로 입력 받으면 되니까 text-field를 사용하면 되겠네.

            책 장르는 여러 개의 옵션 중 하나를 선택해야 하니까 select-field를 사용하면 되겠네.
            책 장르인 경우에는 간단하게 '소설', '시', '에세이' 정도로 한다면 '...'으로 생략하지 않고, 모든 요소를 적어야 하니까 items에 들어갈 내용은 '[{"소설": "novel"}, {"시": "poem"}, {"에세이": "essay"}]'로 각각 적으면 되겠네.

            책 표지 이미지는 파일을 입력받아야 하니까 file-field를 사용하면 되겠네.

            제출 버튼은 하나만 추가하라는 제약사항이 있으니까 하나만 마지막에 추가하면 되겠네.
            마지막으로 '\`\`\`'로 감싸진 코드에 JSON 형식으로 "htmlOutput" 속성에 추가만 해주면 되겠네.`,
            result: `
            \`\`\`
            {
                "htmlOutput": 
                "<div class='row'>
                    <div class='col-sm-12'>
                        <text-field name='book_title' alias='책 제목'></text-field>
                        <text-field name='book_author' alias='저자'></text-field>
                        <select-field name='book_genre' alias='책 장르' items='[{"소설": "novel"}, {"시": "poem"}, {"에세이": "essay"}]'></select-field>
                        <file-field name='book_cover' alias='책 표지 이미지'></file-field>
                        <submit-field></submit-field>
                    </div>
                </div>"
            }
            \`\`\``
        }
    ]
}

export default formDesignGeneratorPromptSnipptsData;