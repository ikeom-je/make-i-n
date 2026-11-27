// 標準コンポーネントを登録したレジストリ。独自パーツは createDefaultRegistry().register(def) で追加する。

import { createRegistry } from '../core/registry.js';
import title from './title.js';
import careerTimeline from './career-timeline.js';
import bigNumber from './big-number.js';
import quote from './quote.js';
import mediaHero from './media-hero.js';
import genmediaStudio from './genmedia-studio.js';
import cta from './cta.js';
import links from './links.js';

export const BUILTIN_COMPONENTS = [title, careerTimeline, bigNumber, quote, mediaHero, genmediaStudio, cta, links];

export function createDefaultRegistry() {
  const registry = createRegistry();
  BUILTIN_COMPONENTS.forEach((c) => registry.register(c));
  return registry;
}
