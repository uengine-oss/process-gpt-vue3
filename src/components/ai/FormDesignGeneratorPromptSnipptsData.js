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
            tag: `<input type='text' name='<이 입력창의 이름>'></input>`,
            purpose: `텍스트를 입력받기 위해서`,
            limit: ""
        },

        {
            tag: `<label>Label</label>`,
            purpose: `다른 컴포넌트를 설명하기 위해서`,
            limit: ""
        },

        {
            tag: `<select id="<이 옵션을 설명하는 고유 ID>">
<option name="<첫번째 옵션의 이름>" value="<첫번째 옵션의 이름>">Text</option>
<option name="<두번째 옵션의 이름>" value="<두번째 옵션의 값>">Text</option>
</select>`,
            purpose: `여러개의 옵션 중 하나를 선택하기 위해서`,
            limit: ""
        },

        {
            tag: `<input type="checkbox" id="<첫번째 체크박스를 설명하는 고유 ID>" name="<체크박스의 그룹명>" value="<첫번째 체크박스의 값>">Text</input>
<input type="checkbox" id="<두번째 체크박스를 설명하는 고유 ID>" name="<체크박스의 그룹명>" value="<두번째 체크박스의 값>">Text</input>`,
            purpose: `여러개의 선택 사항들 중, 여러개를 선택하기 위해서`,
            limit: "체크박스가 하나의 그룹에 속할 경우에는 동일한 name 속성을 가져야 함"
        },

        {
            tag: `<input type="radio" id="<첫번째 radio를 설명하는 고유 ID>" name="<radio의 그룹명>" value="<첫번째 radio의 값>">Text</label>
<input type="radio" id="<두번째 radio를 설명하는 고유 ID>" name="<radio의 그룹명>" value="<두번째 radio의 값>">Text</label>`,
            purpose: `나열된 여러개의 옵션 중 하나를 선택하기 위해서`,
            limit: "radio가 하나의 그룹에 속할 경우에는 동일한 name 속성을 가져야 함"
        },

        {
            tag: `<input type="file" name="<이 입력창의 이름>" accept="<video/*|audio/*|image/*>"/>`,
            purpose: `파일을 입력받기 위해서`,
            limit: ""
        },
        
        {
            tag: `<label for="<설명할 대상이 되는 컴포넌트의 ID>">Label</label>`,
            purpose: `ID로 지정된 특정 컴포넌트를 설명하기 위해서`,
            limit: "for 속성에는 반드시 설명할 대상이 되는 컴포넌트의 ID를 넣어야 함"
        },

        {
            tag: `<input type='submit' value='Submit'>`,
            purpose: `유저의 입력을 처리하기 위해서`,
            limit: "반드시 포함되어야 하며, 한 번만 사용 가능"
        }
    ],

    // AI에게 참조할만한 예시를 안내해주기 위해서 {title: "제목", description: "설명", result: "결과(Json 객체)"}
    examples: [
        {
            title: "로그인 폼",
            description: `먼저, 유효한 레이아웃을 생각해 봐야 해.
            로그인은 아이디, 비밀번호, 제출 버튼이 필요한데 크게 나눌 필요는 없기 때문에 12의 공간을 차지하는 하나의 col-sm-12로 만들어주면 돼.
            그리고, 아이디 라벨과 입력창, 비밀번호 라벨과 입력창, 그리고 제출 버튼을 추가해 주면 돼.
            비밀번호는 type='password'로 해야될 것 같지만, 메뉴얼을 보니까 '<>'로 감싸져 있지 않으면 상수라고 하니까 현 상황에서는 그냥 type='text'라고 써야겠네.
            제출 버튼은 하나만 추가하라는 제약사항이 있으니까 하나만 추가하면 되겠네.
            마지막으로 '\`\`\`'로 감싸진 코드에 JSON 형식으로 "htmlOutput" 속성에 추가만 해주면 되겠네.`,
            result: `
            \`\`\`
            {
                "htmlOutput": 
                "<div class='row'>
                    <div class='col-sm-12'>
                        <label>아이디</label><input type='text' name='id'></input>
                        <label>비밀번호</label><input type='text' name='id'></input>
                        <input type='submit' value='Submit'>
                    </div>
                </div>"
            }
            \`\`\``
        }
    ]
}

export default formDesignGeneratorPromptSnipptsData;