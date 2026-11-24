const kinds = [
  { kind: "animal", many: "animals" },
  { kind: "tent", many: "tents" },
  { kind: "fight", many: "fights" },
];

const counted = (names: string[]) =>
  Object.entries(Object.groupBy(names, (name) => name))
    .map(([name, all]) => ({ name, count: all?.length ?? 0 }))
    .toSorted((a, b) => b.count - a.count);

export const intelSummary = (done: { colour: string; kind: string }[]) => {
  const groups = kinds.flatMap(({ kind, many }) => {
    const colours = done.filter((d) => d.kind === kind).map((d) => d.colour);
    return colours.length ? [{ label: colours.length === 1 ? kind : many, many, colours }] : [];
  });
  if (!groups.length) return [];
  return [
    `intel done: ${done.length} (${groups.map((g) => `${g.colours.length} ${g.label}`).join(", ")})`,
    ...groups.map((g) => `  ${g.many}: ${counted(g.colours).map((c) => `${c.count} ${c.name}`).join(", ")}`),
  ];
};
