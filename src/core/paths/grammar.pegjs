// Concrete syntax of the path fragment; `npm run gen:parser` regenerates
// grammar.js. Unicode and ASCII spellings are both accepted; a path is tried
// before a bare node expression, and `error()` rejections are definitive.

{{
import { RESERVED } from './ast';
import { isValidLabel } from '../parse';

const AXIS_MESSAGE = 'only the child step ↓ is defined in this fragment';
const DATA_MESSAGE = 'data comparison is not yet defined for this logic';
}}

Query
  = _ ast:Path _ !. { return { kind: 'path', ast }; }
  / _ ast:Node _ !. { return { kind: 'node', ast }; }

// ----- paths; union is the loosest operator, composition is juxtaposition --

Path "a path expression"
  = head:Comp tail:(_ UnionOp _ c:Comp { return c; })*
    { return tail.reduce((left, right) => ({ k: 'union', left, right }), head); }

Comp
  = head:PathAtom tail:(_ a:PathAtom { return a; })*
    { return tail.reduce((left, right) => ({ k: 'comp', left, right }), head); }

PathAtom "a path step"
  = atom:PathAtomCore star:(_ '*')? {
      if (star) error(AXIS_MESSAGE);
      return atom;
    }

PathAtomCore
  = Down { return { k: 'down' }; }
  / Eps { return { k: 'eps' }; }
  / '[' _ phi:Node _ ']' { return { k: 'test', phi }; }
  / '(' _ p:Path _ ')' { return p; }
  / Up { error(AXIS_MESSAGE); }

Down = '↓' / 'down' !IdentRest
Eps = 'ε' / 'eps' !IdentRest
Up = '↑' / 'up' !IdentRest
UnionOp = '∪' / '|'

// ----- node expressions; precedence: not, then and, then or ---------------

Node "a node expression"
  = head:AndExpr tail:(_ OrOp _ r:AndExpr { return r; })*
    { return tail.reduce((left, right) => ({ k: 'or', left, right }), head); }

AndExpr
  = head:NotExpr tail:(_ AndOp _ r:NotExpr { return r; })*
    { return tail.reduce((left, right) => ({ k: 'and', left, right }), head); }

NotExpr
  = NotOp _ sub:NotExpr { return { k: 'not', sub }; }
  / NodeAtom

OrOp = '∨' / 'or' !IdentRest
AndOp = '∧' / '&' / 'and' !IdentRest
NotOp = '¬' / '!' / 'not' !IdentRest

NodeAtom "a node expression"
  = '(' _ inner:Node _ ')' { return inner; }
  / Modality
  / QuotedLabel
  / name:Ident {
      if (RESERVED.has(name)) {
        error(`"${name}" is a reserved word; write '${name}' in quotes to use it as a label`);
      }
      return { k: 'label', label: name };
    }

// Comparisons between paths are rejected, not guessed at: the first
// alternative matches up to the comparison operator and aborts.
Modality
  = LAngle _ Path _ CompareOp { error(DATA_MESSAGE); }
  / LAngle _ path:Path _ RAngle _ '_' q:Threshold
    { return { k: 'modality', path, q }; }

LAngle = '⟨' / '<'
RAngle = '⟩' / '>'
CompareOp = '=' / '≠'

// A threshold is a decimal or a fraction n/m, and must land in [0,1].
Threshold "a threshold between 0 and 1"
  = text:$([0-9] [0-9./]* / '.' [0-9] [0-9./]*) {
      let value;
      if (text.includes('/')) {
        const [n, d] = text.split('/');
        const num = Number(n);
        const den = Number(d);
        if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) {
          error(`"${text}" is not a valid threshold`);
        }
        value = num / den;
      } else {
        value = Number(text);
      }
      if (!Number.isFinite(value)) error(`"${text}" is not a valid threshold`);
      if (value < 0 || value > 1) error(`threshold ${text} is outside [0,1]`);
      return value;
    }

QuotedLabel
  = "'" chars:$[^']* "'" {
      if (!isValidLabel(chars) && !RESERVED.has(chars)) {
        error(`"${chars}" is not a valid label`);
      }
      return { k: 'label', label: chars };
    }
  / '"' chars:$[^"]* '"' {
      if (!isValidLabel(chars) && !RESERVED.has(chars)) {
        error(`"${chars}" is not a valid label`);
      }
      return { k: 'label', label: chars };
    }

Ident "a label"
  = $([A-Za-z_] IdentRest*)

IdentRest = [A-Za-z0-9._·-]

_ = [ \t\r\n]*
