# *p*-document & Configuration Tree Visualizer (Work in progress)

An interactive tool for building, editing and explaining a p-document, the configuration
tree `T` it unfolds into, and the query expressions, with every probability visible.

A symbol-to-code glossary is kept in [`docs/DEFINITIONS.md`](docs/DEFINITIONS.md).

```bash
npm install
npm run dev        # http://localhost:5173
npm test
npm run build      # tsc -b && vite build
```

## The three pages

**`/setup`** builds and edits the p-document: XML source (CodeMirror, a fully equivalent
second editing surface), the skeleton `(N, →)` rendered with `PD(v)` on each vertex, and a
node inspector.

**`/configuration-tree`** shows the unfolding of that p-document, left-to-right by default,
every probability computed on demand and explained on click, updating live as the document
is edited. Clicking a vertex opens the inspector on the right; the canvas has the full
width until then.

**`/query`** evaluates path expressions over that tree. The tree is read-only here; several
named expressions (α, β, γ, …) each carry their own categorical hue and highlight the part
of `T` they reach. The evaluator is support-based throughout, never numeric matrix
multiplication, which over-counts on unions.

The signature surface is the editable factorization strip in the vertex inspector: one
tile per available child, kept vs dropped, each one draggable, with the product
recomputing under your finger.

## Some details about the implementation

A p-document is a plain tree of `PNode`s (label, `PD(v)`, an `ind`/`mux` block type);
`buildSkeleton` stores important information (parent, depth, document order,
disambiguated display labels). A vertex of the configuration tree is not a node but a
whole descent `(S₀,…,S_k)`, keyed by a string such as `r|A,B|C,F`.

That key is the central data-structure: any vertex can be rebuilt from its key alone.

A vertex's children are all possible configurations of existing nodes described by the
p-document, and the child-step probability multiplies one factor per available child,
`PD(v)` if kept and `1 − PD(v)` if dropped (`src/core/probability.ts`).

Because a vertex can have `2^k` children, the tree is never built all at once. It grows
from the root: whatever the user had open is reopened first, then more vertices open on
their own only while the tree stays small (about 200 vertices). The tree never holds
more than 20 000 vertices, and a vertex with more than 4 096 children shows a
placeholder instead of being drawn.

Path expressions are parsed by a Peggy grammar (the chosen library)
(`src/core/paths/grammar.pegjs`, compiled to `grammar.js` by `npm run gen:parser`); the
input may be a path or a bare node expression.

The evaluator (`src/core/paths/evaluate.ts`) works with sets of vertex keys rather than
numeric matrices, which would over-count on unions. Given an expression and a starting
vertex, it first collects the set of vertices the expression can reach. To turn that set
into a probability it drops the vertices whose configuration is empty, keeps only the
highest ones so that no survivor sits below another (the parts of the tree under them
then never overlap), and adds up the probability of reaching each one.
