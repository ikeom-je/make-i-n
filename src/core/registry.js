// コンポーネント(パーツ)のレジストリ。新しいパーツは register() するだけで talk から使える。

export function createRegistry() {
  const components = new Map();
  return {
    register(def) {
      for (const key of ['name', 'render', 'pptx']) {
        if (!def?.[key]) throw new Error(`component 定義に ${key} がありません: ${def?.name ?? '(no name)'}`);
      }
      if (components.has(def.name)) throw new Error(`component が重複登録されました: ${def.name}`);
      components.set(def.name, {
        variants: ['default'],
        props: {},
        defaults: {},
        ...def,
      });
      return this;
    },
    get(name) {
      return components.get(name);
    },
    has(name) {
      return components.has(name);
    },
    list() {
      return [...components.values()].map(({ name, description, variants, props }) => ({
        name, description, variants, props,
      }));
    },
  };
}
