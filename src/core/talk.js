// talk(=コンセプト/プリセット)の検証と正規化。
// talk は「どのコンポーネントを、どの順序・サイズ・バリアント・強調で並べるか」だけを持つ。

import { collectBrokenRefs, resolveRefs } from './resolve.js';

export const SIZES = ['s', 'm', 'l', 'full'];

export class TalkValidationError extends Error {
  constructor(errors) {
    super(`talk 定義が不正です:\n- ${errors.join('\n- ')}`);
    this.errors = errors;
  }
}

export function validateTalk(talk, profile, registry) {
  const errors = [];
  if (!talk || typeof talk !== 'object') return { ok: false, errors: ['talk が空です'] };
  if (typeof talk.id !== 'string' || !talk.id) errors.push('id が必要です');
  if (!Array.isArray(talk.sections) || talk.sections.length === 0) {
    errors.push('sections に1つ以上のコンポーネントが必要です');
    return { ok: false, errors };
  }
  const ids = new Set();
  talk.sections.forEach((section, i) => {
    const where = `sections[${i}]`;
    const def = registry.get(section?.component);
    if (!def) {
      errors.push(`${where}: 未登録の component "${section?.component}"`);
      return;
    }
    if (section.variant !== undefined && !def.variants.includes(section.variant)) {
      errors.push(`${where}: ${def.name} に variant "${section.variant}" はありません(${def.variants.join(' / ')})`);
    }
    if (section.size !== undefined && !SIZES.includes(section.size)) {
      errors.push(`${where}: size "${section.size}" は不正です(${SIZES.join(' / ')})`);
    }
    const id = sectionId(section, i);
    if (ids.has(id)) errors.push(`${where}: section id "${id}" が重複しています`);
    ids.add(id);
    const props = { ...def.defaults, ...(section.props ?? {}) };
    for (const ref of collectBrokenRefs(props, profile)) {
      errors.push(`${where}: profile に参照先がありません ${ref}`);
    }
    for (const [key, spec] of Object.entries(def.props)) {
      if (spec.required && (props[key] === undefined || props[key] === null)) {
        errors.push(`${where}: ${def.name} の必須 props "${key}" がありません`);
      }
    }
  });
  return { ok: errors.length === 0, errors };
}

function sectionId(section, i) {
  return section.id ?? `${section.component}-${i + 1}`;
}

export function normalizeTalk(talk, profile, registry) {
  const { ok, errors } = validateTalk(talk, profile, registry);
  if (!ok) throw new TalkValidationError(errors);
  return {
    id: talk.id,
    title: talk.title ?? talk.id,
    theme: talk.theme ?? 'google',
    defaultLang: talk.defaultLang ?? 'ja',
    sections: talk.sections.map((section, i) => {
      const def = registry.get(section.component);
      return {
        id: sectionId(section, i),
        component: def.name,
        variant: section.variant ?? def.variants[0],
        size: section.size ?? 'l',
        emphasis: section.emphasis ?? false,
        notes: section.notes ?? null,
        props: resolveRefs({ ...def.defaults, ...(section.props ?? {}) }, profile),
      };
    }),
  };
}
