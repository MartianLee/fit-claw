# fit-claw v1.5-prep — Agent-First Workout Logging Design

- **작성일**: 2026-05-13
- **상태**: Brainstorming 결과
- **관련 피드백**: v1 dog-fooding 2회 사용 후 확인된 입력 품질 개선

## 1. 목적

v1.5의 체크인, 예측, 알람으로 넘어가기 전에 운동 기록 데이터의 품질을 올린다. 실제 사용에서 확인된 문제는 두 가지다.

1. 한손/한발 운동을 자연스럽게 기록할 수 없다.
2. agent가 현재 원자적 tool 흐름을 호출할 때 전송 전 1~2번 실수한다.

이 문서는 v1.5 본기능 전 단계인 **v1.5-prep** 범위를 정의한다.

## 2. 결정 사항

### 2.1 Unilateral 운동 기본값

한손/한발 운동은 기본적으로 `each_side`로 기록한다.

예:

```json
{
  "exercise": "덤벨 로우",
  "sets": [{ "weight_kg": 24, "reps": 10 }]
}
```

`덤벨 로우`가 unilateral 후보 운동이면 agent가 `side_mode`를 생략해도 backend가 `each_side`로 보정한다.

좌우 차이가 있는 날만 개별 기록한다.

```json
{
  "exercise": "덤벨 로우",
  "sets": [
    { "weight_kg": 24, "reps": 10, "side_mode": "single_side", "side": "left" },
    { "weight_kg": 22, "reps": 10, "side_mode": "single_side", "side": "right" }
  ]
}
```

### 2.2 누락 운동명 처리

운동명이 catalog/alias에 없더라도 기록 실패보다 자동 생성을 우선한다.

정책:

- `log_workout`은 운동명 매칭 실패 시 exercise를 자동 생성한다.
- 자동 생성 exercise는 `source = 'auto_created'`, `needs_review = 1`, `body_part = 'unknown'`, `equipment = 'unknown'`로 표시한다.
- 자동 생성 exercise 이름은 입력값을 trim/lowercase 정규화한 값을 canonical name으로 사용한다.
- 이후 catalog 정리 tool 또는 migration으로 body part/equipment/alias를 보강할 수 있게 둔다.

### 2.3 Agent는 `log_workout`을 우선 사용

기존 tool 흐름은 유지하되 agent prompt와 README에서는 `log_workout`을 우선 사용하게 한다.

기존 흐름:

```text
find_or_propose_exercise
confirm_new_exercise
create_workout_entry
```

새 권장 흐름:

```text
log_workout
```

기존 tool은 수동 보정, 상세 편집, backward compatibility 용도로 유지한다.

## 3. 데이터 모델

### 3.1 `exercises` 확장

추가 컬럼:

```sql
ALTER TABLE exercises ADD COLUMN default_side_mode TEXT NOT NULL DEFAULT 'none'
  CHECK(default_side_mode IN ('none', 'each_side'));

ALTER TABLE exercises ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'
  CHECK(source IN ('seed', 'external', 'auto_created', 'manual'));

ALTER TABLE exercises ADD COLUMN needs_review INTEGER NOT NULL DEFAULT 0;
```

의미:

- `default_side_mode = 'each_side'`: dumbbell row, lunge, split squat처럼 기본적으로 좌우/양측을 각각 수행하는 운동.
- `source = 'external'`: 외부 permissive dataset에서 가져온 운동명.
- `source = 'auto_created'`: agent 사용 중 catalog에 없어서 자동 생성된 운동.
- `needs_review = 1`: body part, equipment, alias 보강이 필요한 후보.

### 3.2 `workout_sets` 확장

추가 컬럼:

```sql
ALTER TABLE workout_sets ADD COLUMN side_mode TEXT NOT NULL DEFAULT 'none'
  CHECK(side_mode IN ('none', 'each_side', 'single_side'));

ALTER TABLE workout_sets ADD COLUMN side TEXT
  CHECK(side IS NULL OR side IN ('left', 'right'));
```

검증 규칙:

- `side_mode = 'none'`: `side`는 `NULL`.
- `side_mode = 'each_side'`: `side`는 `NULL`.
- `side_mode = 'single_side'`: `side`는 `left` 또는 `right`.

통계 규칙:

- 추정 1RM은 `weight_kg`와 `reps`를 그대로 사용한다.
- 볼륨 계산은 `each_side`일 때 `weight_kg * reps * 2`로 계산한다.
- `single_side`는 row 단위로 `weight_kg * reps`를 계산하고, 좌우 비교 analytics는 v1.5-prep 범위 밖으로 둔다.

## 4. Tool API

### 4.1 `POST /tools/log_workout`

Agent가 기본적으로 호출할 wrapper tool.

입력:

```json
{
  "exercise": "덤벨 로우",
  "sets": [
    {
      "weight_kg": 24,
      "reps": 10,
      "side_mode": "each_side",
      "rpe": 8,
      "notes": "가볍게"
    }
  ],
  "session_id": 12,
  "started_at": "2026-05-13T10:00:00+09:00",
  "notes": "등 운동"
}
```

필드:

- `exercise`: 필수. canonical name 또는 alias.
- `sets`: 필수. 기존 set 필드 + `side_mode?` + `side?`.
- `session_id`: 선택. 있으면 기존 세션에 이어 붙임.
- `started_at`, `ended_at`, `notes`: 기존 `create_workout_entry`와 동일.

동작:

1. `exercise`를 catalog/alias에서 case-insensitive 검색한다.
2. 매칭 실패 시 exercise를 자동 생성한다.
3. set의 `side_mode`가 없으면 exercise의 `default_side_mode`를 사용한다.
4. `side_mode`/`side` 조합을 검증한다.
5. 내부적으로 `createWorkoutEntry`를 호출한다.
6. 응답에 `exercise_created`, `needs_review`, `applied_defaults`를 포함한다.

응답 예:

```json
{
  "status": "logged",
  "exercise_created": false,
  "needs_review": false,
  "applied_defaults": {
    "side_mode": "each_side"
  },
  "session": {},
  "entry": {},
  "sets": []
}
```

자동 생성 예:

```json
{
  "status": "logged",
  "exercise_created": true,
  "needs_review": true,
  "created_exercise": {
    "canonical_name": "single arm cable row",
    "body_part": "unknown",
    "equipment": "unknown"
  },
  "session": {},
  "entry": {},
  "sets": []
}
```

## 5. Exercise Catalog 확장

목표는 agent가 운동명을 잘못 맞춰서 멈추는 빈도를 줄이는 것이다. 런타임 웹 검색은 하지 않는다. 대신 seed/import 시점에 공개 dataset을 정규화해서 catalog와 alias를 보강한다.

우선순위:

1. 기존 수동 seed 유지.
2. permissive dataset에서 이름, 장비, 주요 부위, alias만 가져온다.
3. image, gif, 긴 instruction, description은 가져오지 않는다.
4. license attribution 문서를 추가한다.
5. 라이선스가 복잡한 source는 참고만 하고 bulk import하지 않는다.

후보 source:

- `yuhonas/free-exercise-db`: Unlicense/public-domain 계열. 대량 이름 보강에 적합.
- `longhaul-fitness/exercises`: MIT license. 이름/근육/장비 보강에 적합.
- `wrkout/exercises.json`: public-domain exercise dataset 계열.
- `wger`: exercise wiki와 API가 강점이지만 데이터별 Creative Commons 조건이 있어 bulk import는 attribution/라이선스 확인 후 제한적으로 사용.
- `exercemus/exercises`: wger/exercises.json 등을 조합한 open source list로 참고 가치가 있음.

구현 방식:

- `scripts/import-external-exercises.ts`를 추가한다.
- source별 adapter는 작은 함수로 분리한다.
- importer는 canonical name 중복 시 update하지 않고 alias만 추가한다.
- imported exercise는 `source = 'external'`, `needs_review = 0`으로 넣는다.
- unilateral 후보는 이름 기반 heuristic으로 `default_side_mode = 'each_side'`를 설정한다.

Heuristic 예:

- `single arm`, `single-arm`, `one arm`, `one-arm`
- `single leg`, `single-leg`, `one leg`, `one-leg`
- `unilateral`
- `dumbbell row`
- `lunge`
- `split squat`
- `bulgarian`

Heuristic은 완벽하지 않아도 된다. agent는 명시적 `side_mode`로 항상 override할 수 있다.

## 6. Error Handling

`log_workout`은 agent가 회복 가능한 오류와 회복 불가능한 오류를 구분할 수 있어야 한다.

400 오류:

- `sets`가 비어 있음.
- `side_mode = 'single_side'`인데 `side`가 없음.
- `side_mode != 'single_side'`인데 `side`가 있음.
- `weight_kg` 또는 `reps`가 음수.

자동 생성은 오류가 아니다.

## 7. Testing

필수 테스트:

- migration 후 기존 데이터가 깨지지 않는다.
- `createWorkoutEntry`가 `each_side`와 `single_side` set을 저장한다.
- `log_workout`이 alias 매칭 후 기록한다.
- `log_workout`이 미등록 운동을 자동 생성하고 `needs_review = 1`로 표시한다.
- unilateral exercise에서 set `side_mode` 생략 시 `each_side`가 적용된다.
- bilateral exercise에서 set `side_mode` 생략 시 `none`이 적용된다.
- invalid `side_mode`/`side` 조합은 400을 반환한다.
- catalog import는 중복 canonical name을 만들지 않는다.

## 8. Out of Scope

- v1.5 예측 모델 구현.
- alarm engine 구현.
- daily checkin 구현.
- runtime web search.
- 운동 설명/이미지/GIF import.
- exercise review UI.

이 범위는 v1.5 본기능 전에 데이터 입력 안정성을 확보하기 위한 선행 작업이다.

## 9. Implementation Order

1. Schema migration for exercise/set side metadata.
2. Domain model/test update for side metadata.
3. `log_workout` tool wrapper.
4. Exercise catalog import script and attribution doc.
5. Agent/README guidance update.

## 10. References

- yuhonas/free-exercise-db: https://github.com/yuhonas/free-exercise-db
- longhaul-fitness/exercises: https://github.com/longhaul-fitness/exercises
- wrkout/exercises.json: https://github.com/wrkout/exercises.json
- wger: https://github.com/wger-project/wger
- exercemus/exercises: https://github.com/exercemus/exercises
