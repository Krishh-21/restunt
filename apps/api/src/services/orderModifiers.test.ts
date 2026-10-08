import { resolveModifiers } from './orderModifiers';
const menu = [
  {
    name: 'Size',
    type: 'single',
    required: true,
    options: [
      { name: 'Large', priceAdjustment: 50 },
      { name: 'Small', priceAdjustment: 0 },
    ],
  },
];
it('uses server prices even if the client submits a different adjustment', () => {
  expect(
    resolveModifiers(menu, [{ name: 'Size', option: 'Large', priceAdjustment: -100 }])[0]
      .priceAdjustment
  ).toBe(50);
});
it('rejects missing required groups', () => {
  expect(() => resolveModifiers(menu)).toThrow('Required modifier');
});
it('rejects unknown options', () => {
  expect(() =>
    resolveModifiers(menu, [{ name: 'Size', option: 'Free', priceAdjustment: 0 }])
  ).toThrow('Unknown modifier');
});
it('rejects multiple selections from a single-choice group', () => {
  expect(() =>
    resolveModifiers(menu, [
      { name: 'Size', option: 'Large', priceAdjustment: 50 },
      { name: 'Size', option: 'Small', priceAdjustment: 0 },
    ])
  ).toThrow('Choose one');
});
it('rejects duplicates', () => {
  const selection = { name: 'Size', option: 'Large', priceAdjustment: 50 };
  expect(() => resolveModifiers(menu, [selection, selection])).toThrow('Duplicate');
});

test('legacy seeded modifier maps normalize to selectable groups',()=>{expect(resolveModifiers({spiceLevel:{options:[{name:'Mild',priceAdjustment:0}]}},[{name:'spiceLevel',option:'Mild',priceAdjustment:99}])).toEqual([{name:'spiceLevel',option:'Mild',priceAdjustment:0}]);});
