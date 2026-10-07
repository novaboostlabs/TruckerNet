import { describe, expect, it } from 'vitest';
import en from '../src/translations/en.json';
import es from '../src/translations/es.json';
import pa from '../src/translations/pa.json';
import zh from '../src/translations/zh.json';

type Tree = { [k: string]: string | Tree };

function flatten(t: Tree, prefix = '', out: Record<string, string> = {}) {
  for (const [k, v] of Object.entries(t)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else flatten(v, key, out);
  }
  return out;
}
const vars = (s: string) => [...s.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort();

const base = flatten(en as Tree);

describe.each([['es', es], ['pa', pa], ['zh', zh]])('%s translation', (_lang, tree) => {
  const other = flatten(tree as Tree);

  it('has exactly the English keys', () => {
    expect(Object.keys(other).sort()).toEqual(Object.keys(base).sort());
  });

  it('uses the same {{interpolation}} variables as English', () => {
    const mismatched = Object.keys(base).filter(
      (k) => k in other && vars(other[k]).join() !== vars(base[k]).join(),
    );
    expect(mismatched).toEqual([]);
  });
});
