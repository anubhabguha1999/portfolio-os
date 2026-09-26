import { SCHEMA_VERSION } from '@/config/brand';

/**
 * Schema migrations. Each step upgrades one major version.
 *
 * v1 (legacy) shape:
 *   { version: "1.x", profile: { name, headline, bio, email, avatar },
 *     theme: "<theme-id>", sections: [{ id, type, visible, content }] }
 * v2 (current): see types/portfolio.ts.
 */
type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

export function majorOf(version: unknown): number {
  const m = /^(\d+)/.exec(String(version ?? ''));
  return m ? Number(m[1]) : 1;
}

function v1ToV2(v1: Json): Json {
  const profile = isObj(v1.profile) ? v1.profile : {};
  const legacySections = Array.isArray(v1.sections) ? v1.sections.filter(isObj) : [];
  const sections: Json[] = legacySections.map((s, i) => ({
    id: typeof s.id === 'string' ? s.id : `sec_legacy_${i}`,
    type: s.type,
    name: typeof s.title === 'string' ? s.title : undefined,
    enabled: s.visible !== false,
    locked: false,
    order: i,
    data: isObj(s.content) ? s.content : {},
  }));
  const hasHero = sections.some((s) => s.type === 'hero');
  if (!hasHero && (profile.name || profile.headline)) {
    sections.unshift({
      id: 'sec_legacy_hero',
      type: 'hero',
      enabled: true,
      order: -1,
      data: {
        name: profile.name ?? '',
        title: profile.headline ?? '',
        description: profile.bio ?? '',
        image: typeof profile.avatar === 'string' ? { src: profile.avatar, alt: `Portrait of ${String(profile.name ?? '')}` } : undefined,
      },
    });
  }
  if (profile.email && !sections.some((s) => s.type === 'contact')) {
    sections.push({ id: 'sec_legacy_contact', type: 'contact', enabled: true, order: 999, data: { email: profile.email } });
  }
  return {
    id: typeof v1.id === 'string' ? v1.id : `pf_legacy_${Date.now().toString(36)}`,
    version: '2.0.0',
    metadata: { title: typeof v1.title === 'string' ? v1.title : `${String(profile.name ?? 'My')} Portfolio`, author: profile.name ?? '' },
    theme: { id: typeof v1.theme === 'string' ? v1.theme : 'minimal-developer' },
    sections,
    settings: {},
  };
}

const STEPS: Record<number, (v: Json) => Json> = { 1: v1ToV2 };

export function migrate(input: unknown): { value: unknown; from: string | null } {
  if (!isObj(input)) return { value: input, from: null };
  let value: Json = input;
  const original = String(input.version ?? '1.0.0');
  const target = majorOf(SCHEMA_VERSION);
  let major = majorOf(original);
  if (major > target) throw new Error(`This project was created with a newer version (${original}). Please update the app.`);
  let migrated = false;
  while (major < target) {
    const step = STEPS[major];
    if (!step) throw new Error(`No migration available from schema v${major}.`);
    value = step(value);
    major = majorOf(value.version);
    migrated = true;
  }
  return { value, from: migrated ? original : null };
}
