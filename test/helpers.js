import { createDefaultRegistry } from '../src/components/index.js';

export const registry = () => createDefaultRegistry();

export const profile = {
  name: { ja: '山田 太郎', en: 'Taro Yamada' },
  affiliation: { ja: '例社', en: 'Example Inc.' },
  role: { ja: 'エンジニア', en: 'Engineer' },
  tagline: { ja: '作って届ける', en: 'Build and ship' },
  timeline: [
    { id: 'a', period: '2001', org: { ja: '大学', en: 'University' }, items: [{ ja: '研究', en: 'Research' }] },
    { id: 'b', period: '2010–', org: { ja: '例社', en: 'Example' }, highlight: true, items: [] },
  ],
  highlights: { n: { label: { ja: '毎週', en: 'Weekly' }, value: '2T', unit: { ja: 'トークン', en: 'tokens' }, notes: [{ ja: '注', en: 'note' }] } },
  messages: { cta: { headline: { ja: '話そう', en: "Let's talk" }, button: { ja: '声かけて', en: 'Say hi' } } },
  narration: { ja: 'こんにちは', en: 'Hello' },
};

export const talk = {
  id: 't',
  sections: [
    { component: 'title', props: { music: 'theme', narration: 'narration' } },
    { component: 'career-timeline', variant: 'cards' },
    { component: 'big-number', props: { highlight: '$.highlights.n', background: 'bg' } },
    { component: 'cta', props: { message: '$.messages.cta' } },
  ],
};
