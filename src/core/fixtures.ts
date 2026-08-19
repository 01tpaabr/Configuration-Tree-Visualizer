// The worked example: 29 vertices, 25 leaves. Loaded on first run.
export const FIXTURE_W = `<r>
  <ind>
    <A prob="0.8">
      <ind>
        <C prob="0.5"/>
        <D prob="0.9"/>
      </ind>
    </A>
    <B prob="0.5">
      <ind>
        <E prob="0.1"/>
        <F prob="0.7"/>
      </ind>
    </B>
  </ind>
</r>
`;

// Duplicate labels, a probability of exactly 1, leaves at mixed depths.
export const FIXTURE_X = `<r>
  <ind>
    <A prob="0.5">
      <ind>
        <A prob="0.2"/>
      </ind>
    </A>
    <B prob="1"/>
  </ind>
</r>
`;

const FIXTURE_EMPTY = `<r/>
`;

export interface Example {
  id: string;
  name: string;
  note: string;
  xml: string;
}

export const EXAMPLES: Example[] = [
  {
    id: 'W',
    name: 'Worked example',
    note: '29 vertices, 25 leaves',
    xml: FIXTURE_W,
  },
  {
    id: 'X',
    name: 'Duplicate labels',
    note: '9 vertices, 6 leaves, zero-probability vertices',
    xml: FIXTURE_X,
  },
  {
    id: 'E',
    name: 'Empty document',
    note: 'just the root, build from scratch',
    xml: FIXTURE_EMPTY,
  },
];
