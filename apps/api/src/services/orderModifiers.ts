import { z } from 'zod';
const configuration = z.array(
  z.object({
    name: z.string(),
    type: z.enum(['single', 'multiple']).optional(),
    required: z.boolean().optional(),
    options: z.array(z.object({ name: z.string(), priceAdjustment: z.number().finite() })),
  })
);
export function normalizeModifierConfiguration(raw:unknown){
 const input=raw&&typeof raw==='object'&&!Array.isArray(raw)?Object.entries(raw).map(([name,value])=>({...value as Record<string,unknown>,name})):raw??[];
 return configuration.parse(input);
}
interface Selection {
  name: string;
  option: string;
  priceAdjustment: number;
}
export function resolveModifiers(raw: unknown, selections: unknown = []): Selection[] {
  const groups = normalizeModifierConfiguration(raw);
  const seen = new Set<string>();
  const selected = z
    .array(z.object({ name: z.string(), option: z.string(), priceAdjustment: z.number().finite() }))
    .parse(selections);
  const resolved = selected.map((selection) => {
    const group = groups.find((g) => g.name === selection.name);
    const option = group?.options.find((o) => o.name === selection.option);
    if (!group || !option) throw new Error('Unknown modifier selection');
    const key = selection.name + ':' + selection.option;
    if (seen.has(key)) throw new Error('Duplicate modifier selection');
    seen.add(key);
    return { name: group.name, option: option.name, priceAdjustment: option.priceAdjustment };
  });
  for (const group of groups) {
    const count = resolved.filter((s) => s.name === group.name).length;
    if (group.required && !count) throw new Error(`Required modifier missing: ${group.name}`);
    if ((group.type ?? 'single') === 'single' && count > 1)
      throw new Error(`Choose one option for ${group.name}`);
  }
  return resolved;
}
