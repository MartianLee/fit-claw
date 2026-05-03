import { loadConfig } from '../src/config'
import { getDb } from '../src/db/client'

type Seed = {
  canonical: string
  body_part: string
  equipment: string
  is_bodyweight?: boolean
  aliases: string[]
}

const SEEDS: Seed[] = [
  { canonical: 'bench press', body_part: 'chest', equipment: 'barbell', aliases: ['bench', '벤치', '벤치프레스', 'barbell bench press'] },
  { canonical: 'incline bench press', body_part: 'chest', equipment: 'barbell', aliases: ['incline bench', '인클라인 벤치', '인클라인'] },
  { canonical: 'decline bench press', body_part: 'chest', equipment: 'barbell', aliases: ['decline bench', '디클라인'] },
  { canonical: 'dumbbell bench press', body_part: 'chest', equipment: 'dumbbell', aliases: ['db bench', '덤벨 벤치', '덤벨벤치'] },
  { canonical: 'incline dumbbell press', body_part: 'chest', equipment: 'dumbbell', aliases: ['incline db press', '인클라인 덤벨'] },
  { canonical: 'dumbbell fly', body_part: 'chest', equipment: 'dumbbell', aliases: ['fly', '덤벨 플라이', '플라이'] },
  { canonical: 'cable crossover', body_part: 'chest', equipment: 'cable', aliases: ['크로스오버', '케이블 크로스오버'] },
  { canonical: 'push up', body_part: 'chest', equipment: 'bodyweight', is_bodyweight: true, aliases: ['pushup', '푸쉬업', '팔굽혀펴기'] },
  { canonical: 'deadlift', body_part: 'back', equipment: 'barbell', aliases: ['dl', '데드', '데드리프트'] },
  { canonical: 'romanian deadlift', body_part: 'back', equipment: 'barbell', aliases: ['rdl', '루마니안', '루마니안 데드'] },
  { canonical: 'barbell row', body_part: 'back', equipment: 'barbell', aliases: ['bb row', '바벨 로우', '로우'] },
  { canonical: 'pendlay row', body_part: 'back', equipment: 'barbell', aliases: ['펜들리 로우'] },
  { canonical: 'dumbbell row', body_part: 'back', equipment: 'dumbbell', aliases: ['db row', '덤벨 로우'] },
  { canonical: 'lat pulldown', body_part: 'back', equipment: 'cable', aliases: ['pulldown', '랫풀다운', '풀다운'] },
  { canonical: 'seated cable row', body_part: 'back', equipment: 'cable', aliases: ['cable row', '케이블 로우', '시티드 로우'] },
  { canonical: 'pull up', body_part: 'back', equipment: 'bodyweight', is_bodyweight: true, aliases: ['pullup', '풀업', '턱걸이'] },
  { canonical: 'chin up', body_part: 'back', equipment: 'bodyweight', is_bodyweight: true, aliases: ['chinup', '친업'] },
  { canonical: 'overhead press', body_part: 'shoulder', equipment: 'barbell', aliases: ['ohp', 'overhead press', '밀리터리 프레스', '오버헤드 프레스'] },
  { canonical: 'dumbbell shoulder press', body_part: 'shoulder', equipment: 'dumbbell', aliases: ['db shoulder press', '덤벨 숄더 프레스'] },
  { canonical: 'lateral raise', body_part: 'shoulder', equipment: 'dumbbell', aliases: ['side raise', '사이드 레터럴', '레터럴 레이즈'] },
  { canonical: 'rear delt fly', body_part: 'shoulder', equipment: 'dumbbell', aliases: ['리어 델트', '리어 델트 플라이'] },
  { canonical: 'face pull', body_part: 'shoulder', equipment: 'cable', aliases: ['페이스 풀'] },
  { canonical: 'barbell curl', body_part: 'arm', equipment: 'barbell', aliases: ['바벨 컬'] },
  { canonical: 'dumbbell curl', body_part: 'arm', equipment: 'dumbbell', aliases: ['db curl', '덤벨 컬'] },
  { canonical: 'hammer curl', body_part: 'arm', equipment: 'dumbbell', aliases: ['해머 컬'] },
  { canonical: 'preacher curl', body_part: 'arm', equipment: 'barbell', aliases: ['프리처 컬'] },
  { canonical: 'tricep pushdown', body_part: 'arm', equipment: 'cable', aliases: ['pushdown', '트라이셉 푸쉬다운', '푸쉬다운'] },
  { canonical: 'skull crusher', body_part: 'arm', equipment: 'barbell', aliases: ['lying tricep extension', '스컬크러셔'] },
  { canonical: 'dip', body_part: 'arm', equipment: 'bodyweight', is_bodyweight: true, aliases: ['dips', '딥스'] },
  { canonical: 'back squat', body_part: 'leg', equipment: 'barbell', aliases: ['squat', '스쿼트', '백 스쿼트'] },
  { canonical: 'front squat', body_part: 'leg', equipment: 'barbell', aliases: ['프론트 스쿼트'] },
  { canonical: 'hack squat', body_part: 'leg', equipment: 'machine', aliases: ['핵 스쿼트', '핵스쿼트'] },
  { canonical: 'leg press', body_part: 'leg', equipment: 'machine', aliases: ['레그 프레스'] },
  { canonical: 'lunge', body_part: 'leg', equipment: 'dumbbell', aliases: ['런지'] },
  { canonical: 'bulgarian split squat', body_part: 'leg', equipment: 'dumbbell', aliases: ['bss', '불가리안 스플릿 스쿼트'] },
  { canonical: 'leg extension', body_part: 'leg', equipment: 'machine', aliases: ['레그 익스텐션'] },
  { canonical: 'leg curl', body_part: 'leg', equipment: 'machine', aliases: ['레그 컬'] },
  { canonical: 'hip thrust', body_part: 'leg', equipment: 'barbell', aliases: ['힙 쓰러스트'] },
  { canonical: 'calf raise', body_part: 'leg', equipment: 'machine', aliases: ['카프 레이즈'] },
  { canonical: 'plank', body_part: 'core', equipment: 'bodyweight', is_bodyweight: true, aliases: ['플랭크'] },
  { canonical: 'crunch', body_part: 'core', equipment: 'bodyweight', is_bodyweight: true, aliases: ['크런치'] },
  { canonical: 'hanging leg raise', body_part: 'core', equipment: 'bodyweight', is_bodyweight: true, aliases: ['행잉 레그 레이즈'] },
  { canonical: 'ab wheel rollout', body_part: 'core', equipment: 'bodyweight', is_bodyweight: true, aliases: ['ab roller', '앱 롤러'] },
  { canonical: 'kettlebell swing', body_part: 'full', equipment: 'kettlebell', aliases: ['kb swing', '케틀벨 스윙'] },
  { canonical: 'farmers walk', body_part: 'full', equipment: 'dumbbell', aliases: ['파머스 워크'] },
]

const cfg = loadConfig()
const db = getDb(cfg.databasePath)

const insertExercise = db.prepare(
  'INSERT INTO exercises(canonical_name, body_part, equipment, is_bodyweight) VALUES (?, ?, ?, ?) ON CONFLICT(canonical_name) DO UPDATE SET body_part = excluded.body_part, equipment = excluded.equipment, is_bodyweight = excluded.is_bodyweight RETURNING id',
)
const findAlias = db.prepare('SELECT id FROM exercise_aliases WHERE alias = ?')
const insertAlias = db.prepare(
  'INSERT INTO exercise_aliases(exercise_id, alias) VALUES (?, ?) ON CONFLICT DO NOTHING',
)

let added = 0
let aliases = 0

for (const seed of SEEDS) {
  const row = insertExercise.get(
    seed.canonical,
    seed.body_part,
    seed.equipment,
    seed.is_bodyweight ? 1 : 0,
  ) as { id: number }
  added++

  for (const alias of seed.aliases) {
    if (!findAlias.get(alias)) {
      insertAlias.run(row.id, alias)
      aliases++
    }
  }
}

console.log(`exercises upserted: ${added}, aliases inserted: ${aliases}`)
