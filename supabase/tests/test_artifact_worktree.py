"""인계 산출물 워크트리 DB 확인(로컬 Supabase).

python3 supabase/tests/test_artifact_worktree.py
마이그레이션을 다시 적용한 뒤, 이 테스트가 만든 저장소만 지운다.

- 같은 head 로 두 세션이 동시에 커밋하면 하나만 성공하고 다른 하나는 40001 을 받는다.
- 바뀐 것이 없으면 커밋하지 않는다. 커밋은 고칠 수 없다.
- 인계 분기: 고른 것만 넘기면 받는 방에 새 커밋, 다 넘기면 base 를 그대로 head 로 쓴다.
- 로그인 사용자는 참여하지 않은 방 브랜치에 쓸 수 없고, 다른 테넌트 저장소는 보지 못한다.
"""
from pathlib import Path
import subprocess
import threading
import time
import uuid

root = Path(__file__).resolve().parents[2]
migration = (root / 'supabase/migrations/20261026000001_artifact_worktree.sql').read_text()
PSQL = ['docker', 'exec', '-i', 'supabase_db_process-gpt-vue3', 'psql', '-U', 'postgres', '-d', 'postgres',
        '-v', 'ON_ERROR_STOP=1', '-At', '-q']


def psql(sql: str, check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(PSQL, input=sql, text=True, capture_output=True, check=check)


def one(sql: str) -> str:
    return psql(sql).stdout.strip().splitlines()[-1]


origin = f'__wt_test_{uuid.uuid4().hex[:8]}'
room_a, room_b, room_c = f'{origin}_a', f'{origin}_b', f'{origin}_c'
user_id = str(uuid.uuid4())
blob = lambda h: '{"sha256":"%s","size":1,"content_type":"text/plain"}' % h

psql(migration)
tenant = one('select id from public.tenants limit 1')
psql(f"""
insert into public.chat_rooms (id, tenant_id, name, participants) values
  ('{origin}', '{tenant}', 'wt test', '[{{"id":"{user_id}","email":"wt@test.dev"}}]'),
  ('{room_a}', '{tenant}', 'wt a', '[]'), ('{room_b}', '{tenant}', 'wt b', '[]'), ('{room_c}', '{tenant}', 'wt c', '[]');
""")

try:
    repo = one(f"select public.ensure_artifact_repo('{origin}', '{tenant}')")
    assert one(f"select public.ensure_artifact_repo('{origin}', '{tenant}')") == repo, '저장소는 스레드에 하나'
    tree0 = '{"견적서.docx":%s,"원가표.xlsx":%s}' % (blob('a' * 64), blob('b' * 64))
    root_branch = one(f"select public.create_branch('{repo}', '{origin}', null, '{tree0}')")
    head0 = one(f"select head_commit_id from public.artifact_branches where room_id = '{origin}'")

    # 바뀐 것 없음 → 커밋 없음
    r = one(f"select public.commit_branch('{origin}', '{head0}', '{tree0}', 'agent_turn')")
    assert '"created": false' in r, r
    assert one(f"select count(*) from public.artifact_commits where repo_id = '{repo}'") == '1'

    # 동시에 같은 head 로 두 번 커밋 → 하나만 성공, 다른 하나는 40001
    tree1 = '{"견적서.docx":%s}' % blob('c' * 64)
    tree2 = '{"견적서.docx":%s}' % blob('d' * 64)
    results: dict = {}

    def run(name: str, tree: str, delay: float):
        time.sleep(delay)
        results[name] = psql(
            f"begin; select public.commit_branch('{origin}', '{head0}', '{tree}', 'agent_turn'); "
            "select pg_sleep(1); commit;",
            check=False,
        )

    threads = [threading.Thread(target=run, args=('first', tree1, 0)),
               threading.Thread(target=run, args=('second', tree2, 0.3))]
    [t.start() for t in threads]
    [t.join() for t in threads]
    assert results['first'].returncode == 0, results['first'].stderr
    assert results['second'].returncode != 0, '두 번째 커밋이 통과하면 안 된다'
    assert 'head 가 바뀌었습니다' in results['second'].stderr, results['second'].stderr
    sqlstate = psql(
        f"do $$ begin perform public.commit_branch('{origin}', '{head0}', '{tree2}', 'agent_turn'); "
        "exception when serialization_failure then raise notice 'RETRY'; end $$;"
    )
    assert 'RETRY' in sqlstate.stderr, '재시도 신호는 SQLSTATE 40001'
    head1 = one(f"select head_commit_id from public.artifact_branches where room_id = '{origin}'")
    assert one(f"select tree->'견적서.docx'->>'sha256' from public.artifact_commits where id = '{head1}'") == 'c' * 64

    # 커밋은 불변
    upd = psql(f"update public.artifact_commits set reason = 'merge' where id = '{head0}'", check=False)
    assert upd.returncode != 0 and '바뀌지 않습니다' in upd.stderr, upd.stderr

    # 인계 분기: 전부 넘기면 base 가 head, 일부만 넘기면 받는 방에 새 커밋
    b = one(f"select public.create_branch('{repo}', '{room_a}', '{head1}', null)")
    assert one(f"select head_commit_id = base_commit_id from public.artifact_branches where room_id = '{room_a}'") == 't', b
    psql(f"select public.create_branch('{repo}', '{room_b}', '{head1}', '{{}}')")
    assert one(f"select head_commit_id <> base_commit_id from public.artifact_branches where room_id = '{room_b}'") == 't'
    assert one(f"select base_commit_id from public.artifact_branches where room_id = '{room_b}'") == head1

    # 로그인 사용자: 참여한 방(origin)은 쓰고, 참여하지 않은 방(room_a)은 못 쓴다. 다른 테넌트는 못 본다.
    as_user = (
        "begin; select set_config('request.jwt.claims', '{\"sub\":\"%s\",\"email\":\"wt@test.dev\","
        "\"role\":\"authenticated\",\"app_metadata\":{\"tenant_id\":\"%s\"}}', true); set local role authenticated; "
    )
    ok = psql(as_user % (user_id, tenant) + f"select public.commit_branch('{origin}', '{head1}', '{tree2}', 'task_done'); rollback;", check=False)
    assert ok.returncode == 0, ok.stderr
    denied = psql(as_user % (user_id, tenant) + f"select public.commit_branch('{room_a}', '{head1}', '{tree2}', 'task_done'); rollback;", check=False)
    assert denied.returncode != 0 and '참여하지 않은 방' in denied.stderr, denied.stderr
    direct = psql(as_user % (user_id, tenant) + f"update public.artifact_branches set head_commit_id = '{head0}' where room_id = '{origin}' returning 1; rollback;", check=False)
    assert direct.stdout.strip().splitlines()[-1:] != ['1'], '브랜치를 직접 고칠 수 없다'
    seen = psql(as_user % (user_id, tenant) + f"select count(*) from public.artifact_branches where repo_id = '{repo}'; rollback;")
    assert seen.stdout.strip().splitlines()[-1] == '3', seen.stdout
    other = psql(as_user % (user_id, '__other') + f"select count(*) from public.artifact_branches where repo_id = '{repo}'; rollback;")
    assert other.stdout.strip().splitlines()[-1] == '0', other.stdout

    # 받은 방에서 넘겨받은 그대로 다시 넘긴다: head 는 앞 방 소속 커밋이지만 head 로 둔 방(room_a)의 참여자면 된다
    lee_id = str(uuid.uuid4())
    psql(f"""update public.chat_rooms set participants = '[{{"id":"{lee_id}","email":"lee@test.dev"}}]' where id = '{room_a}'""")
    as_lee = as_user.replace('wt@test.dev', 'lee@test.dev')
    onward = psql(as_lee % (lee_id, tenant) + f"select public.create_branch('{repo}', '{room_c}', '{head1}', null); rollback;", check=False)
    assert onward.returncode == 0, onward.stderr
    stranger = psql(as_lee.replace('lee@test.dev', 'x@test.dev') % (str(uuid.uuid4()), tenant)
                    + f"select public.create_branch('{repo}', '{room_c}', '{head1}', null); rollback;", check=False)
    assert stranger.returncode != 0 and '기준 커밋을 가진 방에 참여하지' in stranger.stderr, stranger.stderr

    print('PASS: artifact worktree — 동시 커밋 1건만 성공(40001), 무변경 커밋 없음, 불변, 분기, 받은 방에서 이어 넘기기, 쓰기·읽기 권한')
finally:
    psql(f"delete from public.artifact_repos where origin_room_id = '{origin}'; "
         f"delete from public.chat_rooms where id in ('{origin}', '{room_a}', '{room_b}', '{room_c}');")
