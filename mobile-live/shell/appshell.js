/**
 * 모바일 껍데기 — 탭과 경로 제한.
 *
 * 무엇을 하려는 것인가
 *   화면은 포털 것을 그대로 쓰되(그래야 이중 작업이 없다), **앱에서 지원하기로
 *   한 곳에만 갈 수 있게** 한다. 그냥 웹앱으로 감싸면 포털 전체가 열려서,
 *   작은 화면에서 쓸 수 없는 화면(BPMN 편집기·프로세스 맵·관리자 콘솔)에
 *   사용자가 빠진다. 그 차이를 만드는 것이 이 파일이다.
 *
 * 세 가지를 한다
 *   1. 하단 탭을 두른다 (채팅 · 할 일 · 내 정보)
 *   2. 포털이 스스로 그리는 길잡이를 감춘다 (appshell.css)
 *   3. 허용한 곳 밖으로 나가면 되돌린다
 *
 * 포털 코드는 건드리지 않는다. 네이티브가 페이지마다 이 파일을 얹어 준다.
 */
(function () {
    'use strict';

    var TABS = [
        { name: 'chat', label: '채팅', path: '/definition-map', alt: '/chats', icon: 'M21 11.5a8.4 8.4 0 0 1-9 8.4 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.4 8.4 0 0 1 8.4-8.4h.5a8.4 8.4 0 0 1 8.1 8.1z' },
        { name: 'tasks', label: '할 일', path: '/todolist', icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
        { name: 'me', label: '내 정보', path: '/account-settings', icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' }
    ];

    /**
     * 갈 수 있는 곳.
     *
     * 탭이 가리키는 곳과, 거기서 자연스럽게 이어지는 곳(업무 하나 열기 등)만
     * 연다. 로그인·조직 선택은 열어 두어야 한다 — 막으면 처음 들어올 수가 없다.
     */
    var ALLOWED = [
        // 첫 탭이 닿는 곳. 간소화 화면에서는 빈 입력창 하나라 작은 화면에도 맞는다.
        '/definition-map',
        '/chats',
        // 대화 하나를 여는 화면. 목록에서 고르면 이리로 온다.
        '/chat',
        '/todolist',
        // 전용 UI 의 /instances/:id 에 해당한다. 이것을 닫아 두면 할 일에서
        // 진행 중인 인스턴스로 들어갈 수 없다.
        '/instancelist',
        '/instance-viewer',
        '/account-settings',
        '/auth',
        '/tenant',
        '/login'
    ];

    /** 어디로도 못 갈 때 돌아갈 곳. */
    var HOME = '/definition-map';

    function path() {
        return location.pathname || '/';
    }

    function allowed(p) {
        // 루트는 막지 않는다. 로그인 전이라면 포털이 로그인·조직으로 보낸다.
        // 로그인 뒤에는 guard 가 첫 화면으로 옮긴다.
        if (p === '/' || p === '') return true;
        for (var i = 0; i < ALLOWED.length; i++) {
            if (p === ALLOWED[i] || p.indexOf(ALLOWED[i] + '/') === 0) return true;
        }
        return false;
    }

    /** 로그인 전에는 탭을 두지 않는다. 누를 수 있는 곳이 없기 때문이다. */
    function signedIn() {
        try {
            for (var i = 0; i < localStorage.length; i++) {
                var k = localStorage.key(i);
                if (k && k.indexOf('sb-') === 0 && k.indexOf('-auth-token') > 0) return true;
            }
        } catch (e) {}
        return false;
    }

    /**
     * 화면을 옮긴다.
     *
     * 통째로 다시 여는 대신 포털의 라우터를 깨운다. 다시 열면 포털이 처음부터
     * 뜨느라 몇 초씩 걸려서, 탭을 누를 때마다 앱이 멈춘 것처럼 보인다.
     * 그래도 안 바뀌면 그때 통째로 연다.
     */
    function go(to) {
        if (path() === to) return;
        try {
            history.pushState({}, '', to);
            window.dispatchEvent(new PopStateEvent('popstate'));
            setTimeout(function () {
                if (path() !== to) location.assign(to);
            }, 900);
        } catch (e) {
            location.assign(to);
        }
    }

    /** 이 탭이 맡는 자리에 지금 있는가. 채팅 탭은 새 대화와 목록 둘을 맡는다. */
    function onTab(tab, p) {
        var spots = tab.alt ? [tab.path, tab.alt] : [tab.path];
        for (var i = 0; i < spots.length; i++) {
            if (p === spots[i] || p.indexOf(spots[i] + '/') === 0) return true;
        }
        return false;
    }

    /**
     * 지금 어느 화면인지를 body 에 적어 둔다.
     *
     * CSS 는 경로를 모른다. 그런데 고쳐야 할 것은 화면마다 다르다 —
     * 할 일 카드의 설명만 줄이고 싶지, 대화 글을 줄이고 싶지는 않다.
     * 이 표시가 있어야 규칙을 그 화면에만 묶을 수 있다.
     */
    function markPath() {
        var seg = path().split('/')[1] || 'root';
        if (document.body.getAttribute('data-pg') !== seg) {
            document.body.setAttribute('data-pg', seg);
        }
    }

    function render() {
        document.body.classList.add('pg-shell');

        // 포털이 스스로 아래 탭을 그리면(작은 화면 규칙) 껍데기는 손을 뗀다.
        // 둘 다 그리면 탭이 두 줄로 겹쳐 화면을 갉아먹는다. 탭이 사라지는 것이
        // 아니라 **그리는 쪽이 하나로 정해지는** 것이다.
        if (document.querySelector('.pg-tabbar')) {
            hideBar();
            return;
        }

        var bar = document.getElementById('pg-tabs');
        if (!bar) {
            bar = document.createElement('nav');
            bar.id = 'pg-tabs';
            bar.className = 'pg-tabs';
            bar.setAttribute('aria-label', '주요 화면');
            document.body.appendChild(bar);

            TABS.forEach(function (tab) {
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'pg-tab';
                btn.dataset.name = tab.name;
                btn.innerHTML =
                    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + tab.icon + '"/></svg>' +
                    '<span></span>';
                btn.querySelector('span').textContent = tab.label;
                btn.addEventListener('click', function () {
                    // 채팅 탭은 자리가 둘이다 — 새 대화(/chat)와 대화 목록(/chats).
                    //
                    // 왜 둘인가
                    //   포털의 /chat 화면(ChatRoomPage)에는 대화 목록이 없다. 단일
                    //   대화만 그리는 화면이다. 그래서 새 대화로 시작하면 다른 대화로
                    //   옮길 길이 사라진다. 탭을 다시 누르면 목록으로 가게 해서 그
                    //   길을 만든다 — 전용 UI 의 /chat/history 가 있던 자리다.
                    if (tab.alt && onTab(tab, path())) {
                        go(path() === tab.alt ? tab.path : tab.alt);
                        return;
                    }
                    go(tab.path);
                });
                bar.appendChild(btn);
            });
        }

        // 지금 어느 탭에 있는지 표시한다.
        var here = path();
        TABS.forEach(function (tab) {
            var btn = bar.querySelector('[data-name="' + tab.name + '"]');
            if (!btn) return;
            var on = onTab(tab, here);
            btn.classList.toggle('pg-tab--on', on);
        });
    }

    function hideBar() {
        var bar = document.getElementById('pg-tabs');
        if (bar) bar.remove();
        document.body.classList.remove('pg-shell');
    }

    /** 허용하지 않은 곳이면 되돌린다. */
    function guard() {
        // 로그인한 뒤의 루트는 홍보 페이지다. 앱을 켜는 사람은 그것을 보려는 게
        // 아니므로 첫 화면을 채팅 자리로 옮긴다 — 아래 탭의 첫 칸을 누른 것과 같다.
        // (로그인 전에는 여기까지 오지 않는다. sync 가 먼저 돌려보낸다.)
        var here = path();
        if (here === '/' || here === '') {
            go(HOME);
            return true;
        }
        if (allowed(here)) return false;
        go(HOME);
        return true;
    }

    /**
     * 갈 수 없는 곳으로 가는 링크를 지운다.
     *
     * 왜 주소로 판단하는가
     *   메뉴의 생김새(클래스 이름·순서)는 포털이 바뀌면 함께 바뀐다. 그것에
     *   기대면 어느 날 조용히 새어 나간다. 링크가 **어디로 가는지**는 잘 바뀌지
     *   않으므로 그것만 본다.
     *
     * 대화 목록처럼 앱이 지원하는 곳으로 가는 링크는 그대로 둔다 — 포털의
     * 사이드바가 채팅 목록 노릇을 한다.
     */
    function pruneLinks() {
        var links = document.querySelectorAll('a[href]');
        for (var i = 0; i < links.length; i++) {
            var a = links[i];
            var href = a.getAttribute('href') || '';
            // 바깥 주소나 앵커는 건드리지 않는다.
            if (!href || href.charAt(0) !== '/') continue;

            var to = href.split('?')[0].split('#')[0];
            var block = !allowed(to);
            // 클래스로 숨기면 포털이 나중에 넣는 스타일에 밀린다 — 표시는
            // 붙는데 화면에는 그대로 보였다. 인라인 !important 는 밀리지 않는다.
            if (block) a.style.setProperty('display', 'none', 'important');
        }
    }

    /**
     * 설정 화면의 관리자 갈래를 지운다.
     *
     * /account-settings 한 곳에 계정·테마뿐 아니라 사용자 관리·환경변수·코드
     * 편집·테넌트 관리까지 모여 있다. 주소가 같아서 링크로는 못 거른다.
     *
     * 생김새(클래스 이름)에 기대지 않고 **이름으로** 찾는다. 포털이 화면을
     * 다시 짜면 클래스는 바뀌지만 메뉴 이름은 잘 바뀌지 않는다. 지울 것을
     * 하나하나 적어 두는 쪽이 남길 것을 적는 것보다 안전하다 — 새 갈래가
     * 생겼을 때 조용히 사라지는 대신 조용히 보이는 편이 덜 위험하다.
     */
    var SETTINGS_BLOCK = [
        '사용자 관리', 'MCP 서버', '환경변수', '코드 편집', '데이터소스',
        'Git 설정', '용어집 관리', '카탈로그', '조직 그룹', '테넌트 관리'
    ];

    /** 눌러서 움직이는 것 중 가장 가까운 것. 라벨만 숨기면 버튼 자리가 남는다. */
    function clickableOf(el) {
        var cur = el;
        for (var d = 0; d < 5 && cur; d++) {
            var tag = (cur.tagName || '').toLowerCase();
            if (tag === 'button' || tag === 'a' || cur.getAttribute('role') === 'tab') return cur;
            if (cur.className && String(cur.className).indexOf('v-btn') >= 0) return cur;
            if (cur.className && String(cur.className).indexOf('v-slide-group-item') >= 0) return cur;
            cur = cur.parentElement;
        }
        return el;
    }

    function pruneSettings() {
        if (path().indexOf('/account-settings') !== 0) return;

        var all = document.querySelectorAll('button, a, [role="tab"], .v-btn, span, div');
        for (var i = 0; i < all.length; i++) {
            var el = all[i];
            // 자식이 있는 큰 상자는 건드리지 않는다. 라벨만 본다.
            if (el.children.length > 1) continue;

            var label = (el.textContent || '').replace(/\s+/g, ' ').trim();
            if (!label || label.length > 12) continue;
            if (SETTINGS_BLOCK.indexOf(label) < 0) continue;

            clickableOf(el).style.setProperty('display', 'none', 'important');
        }
    }

    function sync() {
        if (!document.body) return;

        if (!signedIn()) {
            // 로그인 화면에서는 껍데기를 씌우지 않는다.
            hideBar();
            return;
        }
        if (guard()) return;
        markPath();
        render();
        pruneLinks();
        pruneSettings();
    }

    // 포털은 화면을 갈아 끼우는 방식이라 주소가 바뀌어도 페이지는 그대로다.
    // 그래서 주소를 지켜보며 따라간다.
    var last = null;
    setInterval(function () {
        var now = path() + location.search;
        if (now !== last) {
            last = now;
            sync();
        }
    }, 400);

    // 포털이 화면을 다시 그리면 지웠던 링크가 되살아난다. 짧게 되풀이한다.
    setInterval(function () {
        if (!signedIn()) return;
        // 포털의 아래 탭은 Vue 가 올라온 뒤에야 생긴다. 내가 먼저 그렸다면
        // 그때는 없었던 것이므로, 나중에 나타나는지를 계속 살핀다 —
        // 한 번만 보고 말면 탭이 두 줄로 겹쳐 화면을 갉아먹는다.
        if (document.querySelector('.pg-tabbar')) hideBar();
        else render();
        pruneLinks();
        pruneSettings();
    }, 1200);

    window.addEventListener('popstate', sync);
    sync();
})();
