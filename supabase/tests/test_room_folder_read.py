"""방 작업 폴더 읽기 정책 확인(로컬 Supabase).

python3 supabase/tests/test_room_folder_read.py
마이그레이션을 다시 적용한 뒤, 이 테스트가 만든 방·객체 행만 지운다.

- 방 참여자는 자기 방 폴더(files/skills/{tenant}/{방}/) 목록을 본다. 첫 인계의 첫 커밋이 이 목록으로 방 폴더 전체를 담는다.
- 참여하지 않은 방 폴더, 다른 테넌트 경로, 다른 버킷은 보지 못한다.
"""
from pathlib import Path
import subprocess
import uuid

root = Path(__file__).resolve().parents[2]
migration = (root / 'supabase/migrations/20261027000001_room_folder_read.sql').read_text()
PSQL = ['docker', 'exec', '-i', 'supabase_db_process-gpt-vue3', 'psql', '-U', 'postgres', '-d', 'postgres',
        '-v', 'ON_ERROR_STOP=1', '-At', '-q']


def psql(sql: str, check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(PSQL, input=sql, text=True, capture_output=True, check=check)


def one(sql: str) -> str:
    return psql(sql).stdout.strip().splitlines()[-1]


tag = f'__rf_test_{uuid.uuid4().hex[:8]}'
mine, other = f'{tag}_mine', f'{tag}_other'
user_id = str(uuid.uuid4())

psql(migration)
tenant = one('select id from public.tenants limit 1')
names = [f'skills/{tenant}/{mine}/견적서.md', f'skills/{tenant}/{other}/원가표.md', f'skills/__other/{mine}/메모.md']
psql(f"""
insert into public.chat_rooms (id, tenant_id, name, participants) values
  ('{mine}', '{tenant}', 'rf mine', '[{{"id":"{user_id}","email":"rf@test.dev"}}]'),
  ('{other}', '{tenant}', 'rf other', '[]');
insert into storage.objects (bucket_id, name) values
  {', '.join(f"('files', '{n}')" for n in names)};
""")

as_user = (
    "begin; select set_config('request.jwt.claims', '{\"sub\":\"%s\",\"email\":\"rf@test.dev\","
    "\"role\":\"authenticated\",\"app_metadata\":{\"tenant_id\":\"%s\"}}', true); set local role authenticated; "
)


def visible(tenant_claim: str, where: str) -> str:
    r = psql(as_user % (user_id, tenant_claim) + f"select count(*) from storage.objects where {where}; rollback;")
    return r.stdout.strip().splitlines()[-1]


try:
    assert visible(tenant, f"name = '{names[0]}'") == '1', '참여한 방 폴더는 보인다'
    assert visible(tenant, f"name = '{names[1]}'") == '0', '참여하지 않은 방 폴더는 안 보인다'
    assert visible(tenant, f"name = '{names[2]}'") == '0', '다른 테넌트 경로는 안 보인다'
    assert visible('__other', f"name like 'skills/%/{mine}/%'") == '0', '토큰의 테넌트가 다르면 안 보인다'
    print('PASS: room folder read — 참여한 방 폴더만 보이고, 다른 방·다른 테넌트는 안 보인다')
finally:
    psql(f"begin; set local storage.allow_delete_query = 'true'; delete from storage.objects where name like 'skills/%/{tag}_%'; commit;"
         f"delete from public.chat_rooms where id in ('{mine}', '{other}');", check=False)
