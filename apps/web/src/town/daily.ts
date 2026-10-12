/** The daily one-minute challenge is one predict question from a lesson the learner has finished. */

export function dayNumber(time: number): number {
  const d = new Date(time);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
}

/**
 * @param done finished lesson ids
 * @param built lesson ids that have a playable lesson file, in curriculum order
 */
export function pickDailyLesson(
  done: readonly string[],
  built: readonly string[],
  day: number,
): string | null {
  if (built.length === 0) return null;
  const pool = done.filter((id) => built.includes(id));
  if (pool.length === 0) return built[0]!;
  return pool[((day % pool.length) + pool.length) % pool.length]!;
}
