# Exercise Catalog Sources

fit-claw keeps its runtime catalog small: exercise names, aliases, body part, equipment, and unilateral defaults. It does not import images, GIFs, long instructions, or descriptions.

## Built-In Seed

`scripts/seed-exercises.ts` contains a curated seed list with English and Korean aliases. These entries are stored with `source = 'seed'`.

## External Import Script

Use `scripts/import-external-exercises.ts` for permissively licensed JSON exercise lists:

```bash
bun run scripts/import-external-exercises.ts path/to/exercises.json
```

The importer accepts a top-level JSON array and looks for common fields:

- Name: `name`, `title`, `canonical_name`, `exercise`
- Body part: `body_part`, `bodyPart`, `category`, first `primaryMuscles`, first `muscles`
- Equipment: `equipment`, first `equipments`
- Aliases: `aliases`, `alternative_names`, `alternativeNames`

Imported entries are stored with `source = 'external'`.

## Candidate Sources

Check each repository's current license before importing:

- `yuhonas/free-exercise-db`: https://github.com/yuhonas/free-exercise-db
- `longhaul-fitness/exercises`: https://github.com/longhaul-fitness/exercises
- `wrkout/exercises.json`: https://github.com/wrkout/exercises.json
- `wger`: https://github.com/wger-project/wger
- `exercemus/exercises`: https://github.com/exercemus/exercises

Prefer sources with clear permissive licensing. For sources with Creative Commons or mixed attribution requirements, keep a copy of the license and attribution details next to the imported dataset.
