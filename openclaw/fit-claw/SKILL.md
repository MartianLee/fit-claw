---
name: fit-claw
description: 에이전트용 피트니스 백엔드. 운동/세트 기록, 체성분 추적, 종목 관리, 1RM 예측, 임계 알람을 자연어로 다룬다.
metadata: {"openclaw":{"emoji":"💪","requires":{"bins":["curl"],"env":["FIT_CLAW_API_URL","FIT_CLAW_API_KEY"]},"primaryEnv":"FIT_CLAW_API_KEY"}}
---

# fit-claw Skill

운동 기록과 체성분을 관리하는 단일 사용자 피트니스 백엔드(Bun + Hono). 유저가
말로 던지는 운동/측정을 구조화해 저장하고, 추이·예측·알람을 돌려준다.

## 호출 규약 (모든 도구 공통)

- **Base URL**: `$FIT_CLAW_API_URL` (예: `http://127.0.0.1:8473`)
- **인증**: 모든 요청에 헤더 `Authorization: Bearer $FIT_CLAW_API_KEY`
- **도구 호출(`/tools/*`)**: `POST` + `Content-Type: application/json`, 본문은 JSON
- **읽기(`/api/*`)**: `GET`
- **user_id는 토큰에서 자동 결정** — 어떤 도구에도 user_id를 직접 보내지 않는다.

도구 호출 템플릿:
```bash
curl -sS -X POST "$FIT_CLAW_API_URL/tools/<name>" \
  -H "Authorization: Bearer $FIT_CLAW_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```
읽기 템플릿:
```bash
curl -sS "$FIT_CLAW_API_URL/api/summary" -H "Authorization: Bearer $FIT_CLAW_API_KEY"
```

## Tools

### 운동 (Workouts)
- `log_workout` — POST /tools/log_workout — 운동 1종목 기록(종목을 **이름**으로 지정).
  본문: `exercise`(문자열), `sets`(배열, 1개 이상). 선택: `session_id`, `started_at`, `ended_at`, `notes`.
  각 set: `weight_kg`(≥0), `reps`(정수≥0) 필수 / 선택 `side_mode`(`none`|`each_side`|`single_side`), `side`(`left`|`right`, single_side일 때만), `rpe`, `rir`, `rest_sec`(초), `tempo`, `notes`.
- `create_workout_entry` — POST /tools/create_workout_entry — `log_workout`과 동일하나 종목을 **`exercise_id`(정수)** 로 지정(이미 확정된 종목).
- `query_workouts` — POST /tools/query_workouts — 기록 조회. 선택: `date_from`, `date_to`(ISO date), `exercise_id`.
- `recent_workouts` — POST /tools/recent_workouts — 최근 운동. 선택: `days`(1–60).
- `update_set` — POST /tools/update_set — 세트 수정. `set_id` + `patch`(set 필드 일부).
- `delete_set` — POST /tools/delete_set — 세트 삭제. `set_id`.
- `set_workout_detail_mode` — POST /tools/set_workout_detail_mode — 기록 상세도 변경. `mode`(`basic`|`detailed`).

### 체성분 (Body)
- `log_body_measurement` — POST /tools/log_body_measurement — 체성분 기록(아래 중 최소 1개).
  선택: `weight_kg`, `smm_kg`(골격근량), `pbf_pct`(체지방률 0–100), `bmi`, `measured_at`, `source`(`manual`|`inbody_ocr`|`healthkit`).
- `query_body` — POST /tools/query_body — 체성분 추이. 선택: `date_from`, `date_to`.

### 종목 (Exercises)
- `find_or_propose_exercise` — POST /tools/find_or_propose_exercise — 종목명 검색/제안. `query`.
  **새 종목을 만들기 전에 반드시 먼저 호출**해 기존 종목과 매칭한다.
- `confirm_new_exercise` — POST /tools/confirm_new_exercise — 새 종목 확정 등록.
  `canonical_name`, `body_part`, `equipment`. 선택: `is_bodyweight`, `aliases`(배열).

### 예측 (Predictions)
- `predict_performance` — POST /tools/predict_performance — 특정일 예상 수행력(1RM 등). `exercise_id`, `target_date`.
- `predict_series` — POST /tools/predict_series — 기간 예측 시계열. `exercise_id`, `until_date`.
- `refit_prediction_models` — POST /tools/refit_prediction_models — 예측 모델 재학습. 선택: `user_id`.

### 알람 (Alarms)
- `create_alarm_rule` — POST /tools/create_alarm_rule — 임계 알람 규칙 생성.
  `scope`(`exercise`|`global`), `threshold_type`(`1rm_below`|`days_inactive_above`|`smm_below`|`weight_above`|`weight_below`), `threshold_value`. 선택: `exercise_id`.
- `list_alarm_rules` — POST /tools/list_alarm_rules — 규칙 목록. 본문 `{}`.
- `disable_alarm_rule` — POST /tools/disable_alarm_rule — 규칙 비활성화. `id`.

### 읽기 (Read)
- `get_summary` — GET /api/summary — 오늘/이번주 요약(최근 체성분, 최근 운동 수 등). 대화 시작 시 맥락 파악용.

## 사용 원칙

- **종목 먼저 확인**: 운동 기록 전 종목이 모호하면 `find_or_propose_exercise` → 없으면
  `confirm_new_exercise`로 만든 뒤 `create_workout_entry`(또는 이름으로 `log_workout`).
- **자연어 → 세트**: "벤치 60 5개 3세트" 같은 말은 `log_workout`에 `exercise:"벤치프레스"`,
  `sets:[{weight_kg:60,reps:5},{...},{...}]`로 바로 변환한다.
- **user_id 금지**: 토큰이 사용자를 결정하므로 user_id를 본문에 넣지 않는다.
- **날짜/시간은 ISO 8601** (`2026-06-08`, `2026-06-08T19:00:00Z`).
- 401이 나면 토큰/`FIT_CLAW_API_URL` 설정 문제다(스킬 env 확인).
- 응답은 간결하게. 기록 성공이면 핵심(종목·세트·총볼륨 등)만 짚는다.
