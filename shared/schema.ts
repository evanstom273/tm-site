// How tmidb's tables point at each other. The dump has no foreign keys, so this
// is worked out from column names and the column comments in the original
// MySQL schema. Used by the Worker (queries) and the UI (links).

/** Column name -> table it references, for columns that mean the same thing everywhere. */
const REFS: Record<string, string> = {
  show_id: "shows",
  primary_show_id: "shows",
  originating_show_id: "shows",
  adapting_show_ids: "shows",
  season_id: "seasons",
  episode_id: "episodes",
  bonus_episode_id: "episodes",
  task_id: "tasks",
  similar_task_id: "tasks",
  parent_task_id: "tasks",
  child_task_ids: "tasks",
  original_task_ids: "tasks",
  master_task_ids: "master_tasks",
  attempt_id: "attempts",
  contestant_id: "people",
  contestant_ids: "people",
  person_id: "people",
  stand_in_id: "people",
  taskmaster_id: "people",
  assistant_id: "people",
  winner_id: "people",
  winner_ids: "people",
  house_id: "locations",
  studio_id: "locations",
};

/** Per-table overrides for generic names like parent_id. */
const TABLE_REFS: Record<string, Record<string, string>> = {
  location_spaces: { parent_id: "locations" },
};

/** Columns holding several IDs, e.g. "|56|69|" or "56,69". */
export const LIST_COLUMNS = new Set([
  "adapting_show_ids",
  "child_task_ids",
  "original_task_ids",
  "master_task_ids",
  "contestant_ids",
  "winner_ids",
]);

/** Columns whose target table depends on another column in the same row. */
export const POLYMORPHIC: Record<string, Record<string, { typeColumn: string; targets: Record<string, string> }>> = {
  media_embeds: {
    page_id: {
      typeColumn: "page_type",
      targets: {
        episode: "episodes",
        location: "locations",
        person: "people",
        season: "seasons",
        space: "location_spaces",
        task: "tasks",
      },
    },
  },
};

/** Column used as a human-readable name for a row, where a table has one. */
export const LABEL_COLUMNS: Record<string, string> = {
  people: "name",
  shows: "name",
  seasons: "title",
  episodes: "title",
  tasks: "title",
  master_tasks: "title",
  locations: "name",
  location_spaces: "name",
  attempts: "title",
};

export function refTarget(table: string, column: string): string | null {
  return TABLE_REFS[table]?.[column] ?? REFS[column] ?? null;
}

export function polymorphicRef(table: string, column: string) {
  return POLYMORPHIC[table]?.[column] ?? null;
}

export function parseIdList(value: unknown): number[] {
  if (value === null || value === undefined) return [];
  return String(value)
    .split(/[|,\s]+/)
    .filter((s) => /^\d+$/.test(s))
    .map(Number);
}
