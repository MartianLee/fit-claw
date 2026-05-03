# fit-claw — 설계 문서 (PRD)

- **작성일**: 2026-05-03
- **상태**: Brainstorming 결과 (구현 시작 전)
- **1차 사용자**: 본인 (dog-fooding)

## 1. 비전

사용자가 원하는 몸 상태를 **유지하도록 동기부여**하는 개인용 헬스케어 서비스. 1차 도메인은 **헬스(웨이트 트레이닝) 퍼포먼스 추적**이고, 데이터/UX 가 검증되면 점진적으로 건강 관리 전반으로 확장한다. 헬창식이 아닌 일반인 건강 지향.

상호작용은 **셀프호스팅 agent (Telegram/Slack)** 이 채팅으로 거의 모든 기능을 노출하고, 대시보드는 주 1~2회 확인 정도다. 운영 환경은 사용자의 Mac mini M4(전용 Apple ID) 1대.

## 2. 핵심 설계 원칙

1. **백엔드는 LLM-agnostic** — CRUD, 통계, 파생값 계산만 담당. LLM 호출이 필요한 작업(OCR 등)은 단일 provider abstraction 을 통과한다.
2. **OpenAI-호환 인터페이스로 LLM 통일** — 환경변수 `LLM_PROVIDER` 한 줄로 Gemini → 로컬 Gemma → 다른 모델 교체 가능.
3. **Agent 가 다운돼도 핵심 알람은 동작** — 백엔드 cron 이 fallback 정형 메시지로 직접 Telegram 발사.
4. **데이터 모델은 처음부터 v2.5 까지 수용** — 옵셔널 컬럼/테이블을 미리 두되, UX 노출은 단계적.
5. **단일 사용자지만 `user_id` 컬럼은 처음부터** — 향후 다중 사용자 확장 시 데이터 마이그레이션 회피.
6. **YAGNI** — MCP, 전용 모바일 앱, 부위별 둘레, 식단 칼로리 트래킹 등은 명시적으로 v2.5 이후로 미룬다.

## 3. 단계별 스코프

| 버전 | 기간 | 포함 기능 |
|---|---|---|
| **v1** | 2~3주 | 운동 기록 (채팅) · 몸 측정 기록 (채팅) · SSR 대시보드 · 백업 |
| **v1.5** | 1~2주 | 일일 컨디션 체크인 · 개인화 예측 모델 · 임계값 알람 |
| **v2** | 1주 | Apple Health 자동 import (iOS 단축어 → webhook) |
| **v2.5** | 수일 | 인바디 종이/캡처 OCR import |

dog-fooding 시작은 v1 종료 시점. v1.5 의 예측/알람은 최소 4~8주의 v1 데이터 누적 이후 의미가 살아난다.

## 4. 시스템 아키텍처

```
┌─────────────────┐  HTTPS    ┌───────────────────────────┐
│  Telegram /     │ ◀──────▶  │  openclaw agent           │
│  Slack 클라이언트│           │  (Gemini Flash → 로컬 Gemma)│
└─────────────────┘           │                           │
                              │  - tool use 루프          │
                              │  - 자연어 ↔ tool calls    │
                              └───────────┬───────────────┘
                                          │ HTTP + Bearer
                                          ▼
┌────────────────────────────────────────────────────────┐
│  fit-claw backend (Bun + Hono on Mac mini)             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │
│  │  Tools   │ │ Web SSR  │ │   Cron   │ │ LLM adapter│ │
│  │  (agent) │ │Dashboard │ │   Jobs   │ │            │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬───────┘ │
│       └────────────┼────────────┘            │         │
│                    ▼                         │         │
│            ┌─────────────┐                   │         │
│            │ bun:sqlite  │                   │         │
│            └─────────────┘                   │         │
└──────────────────────────────────────────────┼─────────┘
                                               │
              ┌────────────────────────────────┴──┐
              │  OpenAI-호환 endpoint              │
              │  (Gemini / 로컬 Ollama+Gemma / …)  │
              └───────────────────────────────────┘

iPhone (개인 Apple ID)
   └ iOS 단축어 ── HTTPS POST /import/health (Cloudflare Tunnel) → backend
```

### 4.1 네트워크 / Ingress

운영 환경의 핵심 제약: Mac mini 의 Apple ID 와 사용자의 개인 iPhone Apple ID 가 **다른 계정**이라 iCloud 공유 경로(HealthKit 직접 동기화 등)가 막혀 있다.

| 트래픽 | 경로 | 노출 |
|---|---|---|
| iPhone 단축어 → `/import/health` | **Cloudflare Tunnel** (`cloudflared` outbound) | 포트 0 |
| 외부 webhook (향후 IFTTT 등) | 같은 Cloudflare Tunnel | 포트 0 |
| Telegram → agent (있다면) | agent 자체 ingress (이 프로젝트 범위 외) | — |
| 사용자의 대시보드/SSH/관리 | **Tailscale** (사설망) | 사설 |
| Telegram bot fallback push | outbound only | — |

**보안 레이어:**
- Cloudflare TLS 자동
- 앱 단 Bearer 토큰 (env, rotate 가능)
- 옵셔널: Cloudflare Access (이메일 OTP) 를 `/import/*` 에 추가
- Hono 미들웨어로 경로별 ACL: `/import/*` 는 Cloudflare-origin 헤더 + bearer; 대시보드 경로는 Tailscale CIDR 화이트리스트
- 헬스 데이터는 수면시간/체중 등 저민감도. Cloudflare 경유 부담스러워지면 DNS 만 Tailscale 로 옮기면 됨 (코드 변경 0).

**장애 대응:**
- Cloudflare Tunnel 다운 시에도 outbound (Telegram fallback alarm) 정상
- iPhone 자동화 누락 시 백필: 단축어가 매번 **최근 N=7일** 데이터를 함께 보내도록 설계 → 백엔드는 `(user_id, date)` upsert

### 4.2 책임 경계

| 컴포넌트 | 책임 | 비책임 |
|---|---|---|
| openclaw agent | 자연어 ↔ tool 변환, 자연어 멘트 생성, 컨디션 질의, 메시지 발송 | 데이터 저장, 통계 계산, 스케줄링 |
| backend API | CRUD, 통계 계산, cron, OCR 호출, fallback 메시지, 백업 | 자연어 생성 (멘트 표현) |
| LLM provider | 추론 (자연어 파싱·생성, vision OCR) | 데이터 저장, 도메인 로직 |
| iOS 단축어 | HealthKit → backend webhook | 그 외 |
| 대시보드 (SSR) | 시각화, 가벼운 조회 | 입력 (입력은 항상 채팅) |

대시보드는 의도적으로 **읽기 전용**. 입력 진입점을 채팅 한 곳으로 통일해 dog-fooding 의 마찰을 줄인다.

## 5. 데이터 모델 (SQLite)

### 5.1 테이블

```
users (
  id INTEGER PK,
  name TEXT,
  telegram_chat_id TEXT,
  slack_user_id TEXT,
  workout_detail_mode TEXT CHECK(... IN ('basic','detailed')) DEFAULT 'basic',
  timezone TEXT DEFAULT 'Asia/Seoul',
  created_at TIMESTAMP
)

api_tokens (
  id INTEGER PK,
  user_id INTEGER FK,
  token_hash TEXT,        -- 평문 저장 안 함; 검증은 hash 비교
  label TEXT,             -- 'shortcut', 'agent' 등
  created_at TIMESTAMP,
  last_used_at TIMESTAMP
)

exercises (
  id INTEGER PK,
  canonical_name TEXT UNIQUE,
  body_part TEXT,         -- 'chest','back','leg','core','arm','shoulder','full'
  equipment TEXT,         -- 'barbell','dumbbell','machine','cable','bodyweight','kettlebell'
  is_bodyweight INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP
)

exercise_aliases (
  id INTEGER PK,
  exercise_id INTEGER FK,
  alias TEXT,
  UNIQUE(alias)
)

workout_sessions (
  id INTEGER PK,
  user_id INTEGER FK,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  notes TEXT
)

workout_entries (
  id INTEGER PK,
  session_id INTEGER FK,
  exercise_id INTEGER FK,
  sequence INTEGER        -- 세션 내 순서
)

workout_sets (
  id INTEGER PK,
  entry_id INTEGER FK,
  set_number INTEGER,
  weight_kg REAL,
  reps INTEGER,
  rpe REAL,               -- optional, 0-10
  rir INTEGER,            -- optional
  rest_sec INTEGER,       -- optional
  tempo TEXT,             -- optional, e.g. '3-1-1-0'
  notes TEXT
)

body_measurements (
  id INTEGER PK,
  user_id INTEGER FK,
  measured_at TIMESTAMP,
  weight_kg REAL,
  smm_kg REAL,            -- skeletal muscle mass
  pbf_pct REAL,           -- percent body fat
  bmi REAL,
  source TEXT CHECK(... IN ('manual','inbody_ocr','healthkit'))
)

daily_checkins (
  id INTEGER PK,
  user_id INTEGER FK,
  date DATE,
  sleep_hours REAL,
  condition_score INTEGER,  -- 1-5
  notes TEXT,
  UNIQUE(user_id, date)
)

prediction_models (
  id INTEGER PK,
  user_id INTEGER FK,
  exercise_id INTEGER FK,
  slope_per_week REAL,
  personal_tau_days REAL,
  sample_size INTEGER,
  confidence REAL,          -- 0-1
  fitted_at TIMESTAMP,
  UNIQUE(user_id, exercise_id)
)

alarm_rules (
  id INTEGER PK,
  user_id INTEGER FK,
  scope TEXT CHECK(... IN ('exercise','global')),
  exercise_id INTEGER NULL,
  threshold_type TEXT CHECK(... IN ('1rm_below','days_inactive_above','smm_below','weight_above','weight_below')),
  threshold_value REAL,
  enabled INTEGER DEFAULT 1,
  last_fired_at TIMESTAMP
)

notifications_log (
  id INTEGER PK,
  user_id INTEGER FK,
  channel TEXT,             -- 'telegram','slack'
  sent_at TIMESTAMP,
  kind TEXT,                -- 'alarm','checkin_prompt','prediction_summary'
  body TEXT,
  generated_by TEXT CHECK(... IN ('agent','fallback'))
)
```

### 5.2 파생값 / 인덱스

- 종목별 추정 1RM 시계열: Epley 공식(`weight × (1 + reps/30)`) 적용 후 일별 max. 뷰 또는 materialized 테이블로 캐시.
- 인덱스: `workout_sessions(user_id, started_at)`, `body_measurements(user_id, measured_at)`, `daily_checkins(user_id, date)`, `notifications_log(user_id, sent_at)`, `exercise_aliases(alias)`.
- PR 갱신: 새 set 저장 시 트리거 또는 application-level 핸들러로 1RM 캐시 갱신.

### 5.3 입력 모드와 스키마

- **거친 입력 (A 케이스)**: "벤치 80kg 5회" → entry 1개 + set 1개 자동 생성.
- **표준 입력 (B 케이스)**: "벤치 5x5 80kg" → entry 1개 + set 5개.
- **상세 입력 (C 케이스)**: B + RPE/휴식/템포. `users.workout_detail_mode = 'detailed'` 일 때만 agent 가 옵셔널 필드 질문.
- 스키마는 항상 동일. UX 만 모드에 따라 다름.

## 6. 기능 스펙

### 6.1 운동 기록 (v1)

**Agent 가 호출하는 백엔드 tools** (REST + JSON, 백엔드는 항상 구조화 입력만 받음):

| Tool | 입력 | 출력 |
|---|---|---|
| `find_or_propose_exercise` | `query: string` | `{matched: exercise} \| {proposed: {canonical_name, body_part, equipment}}` |
| `confirm_new_exercise` | `{canonical_name, body_part, equipment, aliases?}` | `{exercise}` |
| `create_workout_entry` | `{exercise_id, sets: [{weight_kg, reps, rpe?, rir?, rest_sec?, tempo?, notes?}], session_id?, started_at?, notes?}` | `{session, entry, sets}` |
| `query_workouts` | `{date_from?, date_to?, exercise_id?}` | `{sessions, entries, sets}` |
| `recent_workouts` | `{days?: number = 7}` | `{sessions[]}` |
| `update_set` | `{set_id, ...partial}` | `{set}` |
| `delete_set` | `{set_id}` | `{ok}` |
| `set_workout_detail_mode` | `{mode: 'basic'\|'detailed'}` | `{user}` |

**종목 매칭 흐름 (Hybrid C):**
1. `find_or_propose_exercise(query)` 가 `exercise_aliases` 와 `canonical_name` 에서 fuzzy 매칭.
2. 매칭 성공 → 즉시 사용.
3. 매칭 실패 → LLM(agent 측) 이 후보 정규명/부위/기구 제안. 백엔드는 후보를 검증만 (LLM 호출 안 함).
4. 사용자가 confirm → `confirm_new_exercise` 로 저장 + alias 등록. 다음부턴 1번에서 즉시 매칭.
5. 카탈로그에 주요 헬스 종목 ~50개 seed 적재 (스크립트).

### 6.2 몸 측정 기록 (v1)

| Tool | 입력 |
|---|---|
| `log_body_measurement` | `{weight_kg?, smm_kg?, pbf_pct?, bmi?, measured_at?, source?}` (모두 옵셔널, 들어온 것만 저장) |
| `query_body` | `{date_from?, date_to?}` |

거친 케이스: 매일 체중만 → `log_body_measurement(weight_kg=72.3)` 한 줄.
인바디 결과 통째: 4개 필드 모두 채움 (수동 v1, OCR v2.5).

### 6.3 SSR 대시보드 (v1)

페이지 1개. Hono JSX SSR + htmx + 차트 라이브러리 (uPlot 우선, fallback Chart.js).

레이아웃:
- 상단 카드 4개: 현재 체중, SMM, PBF, "최근 7일 운동 횟수"
- 그래프 1: 체중 / SMM / PBF 시계열 (라인 3개)
- 그래프 2: 사용자 선택 종목의 추정 1RM 추세 + (v1.5 부터) 예측선
- 캘린더 히트맵: 최근 12주, 운동한 날 (heat = 그날 총 볼륨)
- 최근 7일 활동 리스트

대시보드는 Tailscale 망에서만 접근. 입력 UI 없음.

### 6.4 일일 컨디션 체크인 (v1.5)

- 매일 사용자 시간대 기준 정해진 시각(예: 기상 후로 추정되는 시간) cron → agent webhook 호출 → agent 가 자연어로 질문 ("어제 잠 몇 시간? 오늘 컨디션 1~5?") → 사용자 답 → `log_checkin` tool 호출.
- 답을 안 하면 그날 NULL. 강제 안 함.
- 단축어가 sleep_hours 자동 import 하면 (v2) 그 값을 prefill 로 보여주고 condition_score 만 묻도록 agent 룰 조정.

| Tool | 입력 |
|---|---|
| `log_checkin` | `{date?, sleep_hours?, condition_score?, notes?}` |
| `query_checkins` | `{date_from?, date_to?}` |

### 6.5 개인화 예측 (v1.5)

**백엔드 결정론적 계산:**
- 종목별 추정 1RM 시계열 윈도우(예: 최근 12주) → 단순 선형회귀 → `slope_per_week`.
- 휴식 → 복귀 사이클 분석:
  - 7일+ 무운동 후 첫 세트 → "드롭 상대치" 측정.
  - 누적되면 본인 `personal_tau_days` 학습 (`weight × exp(-Δ/τ)`).
  - 사이클 sample_size < 3 일 땐 인구 평균 fallback (`τ ≈ 21d` 대근육, `≈ 14d` 소근육).
- 캐시: `prediction_models` 테이블에 종목별 1행. 새 운동 기록 시 백그라운드 재적합 (job).

| Tool | 입력 | 출력 |
|---|---|---|
| `predict_performance` | `{exercise_id, target_date}` | `{predicted_1rm_kg, confidence, basis: {slope_per_week, personal_tau_days, sample_size, last_workout_at}}` |
| `predict_series` | `{exercise_id, until_date}` | `{points: [{date, predicted_1rm}]}` (차트용) |

**자연어 멘트 (agent 측):**
- 위 구조화 결과 + 최근 컨디션/수면 데이터 + 운동 빈도 통계를 시스템 프롬프트로 전달.
- 시스템 룰: **"데이터 없는 변수는 '모른다' 고 말하라. 인과 추정은 'X와 상관관계' 수준으로만."**
- 멘트 예시:
  > "최근 3주 1RM 둔화 (+0.1kg/주, 본인 평균 +0.5kg/주 대비). 같은 기간 평균 수면 5.8h (본인 평균 7.1h 대비 -1.3h). 수면 부족이 가장 유력한 상관 요인. 영양 데이터는 없어 평가 불가. 다음주 잠 7h+ 회복 후 같은 무게 재시도 권장."

### 6.6 임계값 알람 (v1.5)

| Tool | 입력 |
|---|---|
| `create_alarm_rule` | `{scope, exercise_id?, threshold_type, threshold_value}` |
| `list_alarm_rules` | `-` |
| `disable_alarm_rule` | `{id}` |

**평가 cron** (매일):
1. 모든 `enabled = 1` rule 평가.
2. 위반 + `last_fired_at` 가 오늘 아님 → fire.
3. fire 흐름:
   - agent webhook POST (5s timeout) — 자연어 메시지 생성/발송 위임.
   - 실패/timeout → backend 가 직접 Telegram bot 으로 정형 메시지 push.
4. `notifications_log` 에 audit, `alarm_rules.last_fired_at` 갱신.

**Fallback 메시지 템플릿 예:**
- `1rm_below`: "⚠️ {exercise} 추정 1RM 이 {value}kg 이하로 내려갔습니다. 가볍게라도 시작해보세요."
- `days_inactive_above`: "⚠️ {N}일째 운동 기록 없음. 오늘 한 세트라도 어떠세요?"

### 6.7 Apple Health Import (v2)

| Endpoint | 용도 |
|---|---|
| `POST /import/health` | iOS 단축어 webhook. Bearer 인증. |

Body 예:
```json
{
  "samples": [
    {"date": "2026-05-02", "sleep_hours": 7.1, "weight_kg": 72.3, "steps": 8421},
    {"date": "2026-05-01", "sleep_hours": 6.4, "weight_kg": 72.5, "steps": 6210}
  ]
}
```
- `(user_id, date)` 기준 upsert.
- 단축어가 매번 최근 7일을 보내 누락 자동 백필.
- 3일 연속 데이터 없음 감지 → agent 가 "단축어 동기화 끊긴 듯" 알림.
- `body_measurements.source = 'healthkit'` (체중 한정), `daily_checkins` 의 `sleep_hours` 채움.

`shortcuts/` 폴더에 `.shortcut` 파일과 셋업 가이드 `.md` 동봉.

### 6.8 인바디 OCR Import (v2.5)

| Endpoint | 용도 |
|---|---|
| `POST /import/inbody-image` | multipart 이미지 업로드. Bearer 인증. |

흐름:
1. 백엔드가 `llm.vision_extract(image, schema)` 호출 (provider abstraction).
2. 추출 결과를 agent 에 보내 사용자 확인 ("체중 72.3, SMM 33.1, PBF 17.8 — 맞아요?").
3. 사용자 confirm → `body_measurements.source = 'inbody_ocr'` 로 저장.
4. `notes` 에 원본 이미지 경로 (선택).

종이 인바디 결과지와 앱 캡처 양쪽 모두 동일 흐름.

## 7. LLM Provider Abstraction

```
src/llm/
  index.ts          # interface: chat(), vision_extract(), embed()? (미사용)
  openai-compat.ts  # OpenAI-호환 클라이언트 (Gemini, Ollama, OpenAI 모두 동일 SDK)
  schema.ts         # zod/typebox 스키마 (vision_extract 응답 검증)
```

env:
```
LLM_PROVIDER=gemini
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
LLM_API_KEY=...
LLM_MODEL=gemini-2.5-flash
LLM_MODEL_VISION=gemini-2.5-flash
```

로컬 Gemma 전환 시:
```
LLM_PROVIDER=local
LLM_BASE_URL=http://localhost:11434/v1
LLM_API_KEY=ollama
LLM_MODEL=gemma3:12b
```

백엔드의 LLM 직접 호출은 **OCR 한 곳**이 유일. 그 외 모든 자연어 처리는 agent 측.

## 8. 기술 스택 / 배포

| 레이어 | 선택 | 비고 |
|---|---|---|
| Runtime | Bun | 단일 바이너리에 가깝게, 메모리 ~50MB |
| HTTP | Hono | 코드량 적음, JSX SSR 내장 |
| DB | bun:sqlite | 의존성 0, 단일 파일 |
| Migration | drizzle-kit (또는 `*.sql` + version 테이블) | 결정 보류 — 구현 시 확정 |
| Dashboard | Hono JSX SSR + htmx + uPlot | SPA 미사용 |
| Cron | Bun 내장 setInterval 또는 `Bun.cron` | 외부 cron 의존성 회피 |
| LLM | OpenAI-호환 SDK 1개 | provider 교체는 env |
| 공개 ingress | Cloudflare Tunnel (`cloudflared`) | 포트 0 |
| 관리 ingress | Tailscale | 사설망 |
| Reverse proxy | Caddy (선택, Cloudflare Tunnel 으로 대체 가능) | 단일화 가능 |
| 백업 | 매일 `VACUUM INTO` → tar.gz → rclone → Google Drive | 30일 보관 |
| 프로세스 | launchd | macOS 표준 |

### 8.1 환경변수

```
# server
PORT=3000
DATABASE_PATH=./data/fit-claw.db
DEFAULT_USER_ID=1

# auth
API_BEARER_TOKEN=<long-random>

# llm
LLM_PROVIDER=gemini
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
LLM_API_KEY=...
LLM_MODEL=gemini-2.5-flash
LLM_MODEL_VISION=gemini-2.5-flash

# notifications
TELEGRAM_BOT_TOKEN=<for fallback>
TELEGRAM_CHAT_ID=<owner>
AGENT_WEBHOOK_URL=<openclaw alarm/checkin trigger>
AGENT_WEBHOOK_TIMEOUT_MS=5000

# backup
BACKUP_RCLONE_REMOTE=gdrive:fit-claw/backups
BACKUP_RETENTION_DAYS=30
```

### 8.2 백업 정책

- 매일 03:00 (사용자 시간대) `VACUUM INTO` 로 오프라인 dump 생성.
- gzip 압축 → `rclone copy` 로 Google Drive 업로드.
- 30일 이전 파일은 rclone delete.
- 실패 시 agent 채널로 통보.

## 9. 프로젝트 구조

```
fit-claw/
├── src/
│   ├── api/              # Hono routes (tools, import, dashboard)
│   ├── web/              # SSR 페이지, 컴포넌트
│   ├── db/               # schema, migrations, queries
│   ├── llm/              # provider abstraction
│   ├── stats/            # Epley, 회귀, 감쇠 적합
│   ├── jobs/             # cron: alarms, checkin_prompt, model_refit, backup
│   ├── tools/            # agent 노출 tool 스키마/핸들러
│   ├── auth/             # bearer 미들웨어
│   ├── telegram/         # fallback bot 클라이언트
│   └── server.ts
├── shortcuts/
│   ├── apple-health-import.shortcut
│   └── README.md
├── scripts/
│   ├── seed-exercises.ts
│   └── backup.ts
├── data/                 # SQLite (gitignored)
├── docs/
│   └── superpowers/specs/
└── README.md
```

테스트:
- 단위: `stats/` (Epley, 회귀, 감쇠 적합), `jobs/alarm_evaluator`, `tools/exercise_matcher`.
- Integration: 핵심 tool 핸들러 happy path + bearer 검증.
- E2E 는 v2 까지는 미루고 dog-fooding 으로 대체.

## 10. 구현 순서 (v1)

대략적 마일스톤 (Plan 단계에서 step 으로 분해):

1. 프로젝트 스캐폴딩 + Hono + bun:sqlite + bearer 미들웨어
2. 스키마 + 마이그레이션 + 종목 카탈로그 seed
3. 운동 기록 tools (`find_or_propose_exercise`, `create_workout_entry`, `query_workouts`)
4. 몸 측정 tools (`log_body_measurement`, `query_body`)
5. 1RM 계산/캐시
6. SSR 대시보드 (카드 + 그래프 + 캘린더)
7. 백업 스크립트 + launchd
8. Cloudflare Tunnel 설정 + 배포 가이드
9. dog-fooding 시작 → 1주 후 v1.5 착수

## 11. 명시적 비범위 (Out of Scope)

- MCP 서버 (필요해지면 v3+ 에 thin wrapper 추가).
- 모바일 네이티브 앱 (단축어로 대체).
- 부위별 둘레 측정 / 변화 사진.
- 영양·식단 입력 (수면+컨디션 한 줄 체크인까지만).
- 다중 사용자 인증/권한 (스키마는 준비, 기능은 미구현).
- 소셜/공유 기능.
- 운동 추천/프로그래밍 (v3+ 검토).

## 12. 미해결 / 나중 결정

- 마이그레이션 도구 최종 선택 (drizzle-kit vs 단순 SQL): 구현 1단계에서 결정.
- 차트 라이브러리 최종 (uPlot vs Chart.js): 6단계에서 결정.
- 일일 체크인 시각: 사용자 패턴 학습 후 v1.5 운영 중 조정.
- 인바디 OCR vision 모델 (Gemini Flash vs Pro): 정확도 측정 후 v2.5 구현 시 결정.
