import en from './en.json';

/**
 * Interface strings. Every string the interface shows lives in a locale file, so adding a
 * language means adding a file. Lesson text lives in the lesson files.
 */

type Tree = { [key: string]: string | Tree };
export type Translator = (key: string, vars?: Record<string, string | number>) => string;

export function createTranslator(strings: Tree): Translator {
  return (key, vars) => {
    let node: string | Tree | undefined = strings;
    for (const part of key.split('.')) {
      node = typeof node === 'object' ? node[part] : undefined;
      if (node === undefined) break;
    }
    if (typeof node !== 'string') return key;
    if (!vars) return node;
    return node.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in vars ? String(vars[name]) : match,
    );
  };
}

export const t: Translator = createTranslator(en as Tree);
