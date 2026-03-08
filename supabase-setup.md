# Supabase 설정 (모바일·PC 발주서 동기화)

Supabase를 설정하면 **모바일에서 만든 발주서를 PC에서도** 볼 수 있습니다. (로그인/아이디 공유 없이 같은 목록 공유)

---

## 1. Supabase 프로젝트 만들기

1. [https://supabase.com](https://supabase.com) 접속 후 로그인
2. **New Project** → 프로젝트 이름(예: `bubupop-order`), 비밀번호 설정 → **Create**
3. 프로젝트가 준비될 때까지 대기 (약 1~2분)

---

## 2. 테이블 생성 (SQL 에디터 사용법)

### SQL 에디터 여는 방법

1. **Supabase 대시보드**에서 왼쪽 세로 메뉴를 보세요.
2. 아래쪽에 **SQL Editor** 라는 메뉴가 있습니다. (코드 `</>` 모양 아이콘)
3. **SQL Editor** 를 클릭합니다.
4. 오른쪽에 **+ New query** 버튼이 보이면 클릭해서 새 쿼리 창을 엽니다.
5. 그 안에 **아래 SQL 전체를 복사해서 붙여넣기** 합니다.
6. 오른쪽 아래 **Run** 버튼(또는 Ctrl+Enter)을 누릅니다.
7. 아래쪽에 **Success. No rows returned** 같은 메시지가 나오면 성공입니다. (에러가 없으면 완료)

### 실행할 SQL (전체 복사해서 붙여넣기)

```sql
-- 발주서 저장 테이블
create table if not exists public.orders (
  id text primary key,
  date_key text not null,
  order_data jsonb not null,
  created_at timestamptz default now()
);

-- 오늘 목록 조회를 위한 인덱스
create index if not exists orders_date_key_idx on public.orders (date_key);

-- 익명 읽기/쓰기 허용 (앱에서 로그인 없이 사용)
alter table public.orders enable row level security;

create policy "Allow all for orders"
  on public.orders for all
  using (true)
  with check (true);
```

**Run** 실행 후 에러 없으면 완료.

---

## 3. 환경 변수 복사

Supabase 대시보드에서 **Project Settings** (휴지통 아이콘 옆) → **API**:

- **Project URL** → `VITE_SUPABASE_URL` 로 사용
- **anon public** 키 → `VITE_SUPABASE_ANON_KEY` 로 사용

---

## 4. 로컬에서 사용

프로젝트 루트에 `.env` 또는 `.env.local` 파일 생성:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

저장 후 `npm run dev` 로 실행하면 오늘 발주서가 Supabase와 동기화됩니다.

---

## 5. Vercel 배포 시

Vercel 대시보드 → **bubupop-order** 프로젝트 → **Settings** → **Environment Variables**:

| Name | Value |
|------|--------|
| `VITE_SUPABASE_URL` | (3번에서 복사한 Project URL) |
| `VITE_SUPABASE_ANON_KEY` | (3번에서 복사한 anon public 키) |

저장 후 **Redeploy** 한 번 실행.

---

## 동작 요약

- **오늘 날짜(YYYY-MM-DD)** 기준으로 발주서가 저장됩니다.
- 모바일에서 **발주서 생성** → Supabase에 저장 → PC에서 앱을 열면 **오늘 발주서 내역**에 그대로 보입니다.
- **삭제**, **전체 삭제**도 Supabase에 반영되어 모든 기기에서 동일하게 보입니다.
- env를 설정하지 않으면 기존처럼 **해당 기기에서만** 목록이 유지됩니다.
