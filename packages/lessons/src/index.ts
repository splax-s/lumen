import type { Lesson } from '@lumen/engine';
import catalogJson from '../dist/catalog.json';
import type { Catalog, CatalogObject, CatalogThread } from '../scripts/compile';

export type { Catalog, CatalogObject, CatalogThread };

/** The town's objects, threads and places, with which lessons are playable. */
export const catalog = catalogJson as Catalog;

const loaders = import.meta.glob<Lesson>('../dist/lessons/*.json', { import: 'default' });

export function lessonExists(id: string): boolean {
  return `../dist/lessons/${id}.json` in loaders;
}

/** Loads one compiled lesson. Each lesson is its own chunk, fetched when first played. */
export async function loadLesson(id: string): Promise<Lesson> {
  const loader = loaders[`../dist/lessons/${id}.json`];
  if (!loader) throw new Error(`Unknown lesson "${id}"`);
  return loader();
}

export function objectForLesson(lessonId: string): CatalogObject | undefined {
  return catalog.objects.find((object) => object.lesson === lessonId);
}

export function objectById(id: string): CatalogObject | undefined {
  return catalog.objects.find((object) => object.id === id);
}
