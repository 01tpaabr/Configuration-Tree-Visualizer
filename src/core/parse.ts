import { XMLParser, XMLValidator } from 'fast-xml-parser';
import type {
  DistType,
  ParseError,
  ParseResult,
  PDocument,
  PNode,
} from './types';
import { newId, reserveIds } from './ids';

const ATTRS = ':@';
const TEXT = '#text';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Fxp = Record<string, any>;

const parser = new XMLParser({
  preserveOrder: true, // the skeleton is an ordered tree; order must survive a round trip
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: true,
  allowBooleanAttributes: true,
  processEntities: true,
});

const XML_NAME_RE =
  /^[A-Za-z_][A-Za-z0-9._\-·À-˿Ͱ-῿‌-‍⁰-↏]*$/;

export function isValidLabel(label: string): boolean {
  return (
    label.length > 0 &&
    XML_NAME_RE.test(label) &&
    label !== 'ind' &&
    label !== 'mux'
  );
}

function offsetOf(src: string, line: number, col: number): number {
  const lines = src.split('\n');
  let off = 0;
  for (let i = 0; i < line - 1 && i < lines.length; i++) off += lines[i].length + 1;
  return off + Math.max(0, col - 1);
}

// The position of a tag in the source text, so the XML pane can mark it.
function spanOfTag(src: string, tag: string, occurrence: number): Partial<ParseError> {
  const re = new RegExp(`<${tag}(?=[\\s/>])`, 'g');
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(src)) !== null) {
    if (n === occurrence) {
      return { from: m.index, to: m.index + tag.length + 1 };
    }
    n++;
  }
  return {};
}

function tagNameOf(el: Fxp): string | null {
  for (const k of Object.keys(el)) if (k !== ATTRS) return k;
  return null;
}

// Strip whitespace-only text nodes; any other text is a grammar error.
function elementChildren(
  raw: Fxp[],
  errors: ParseError[],
  ownerTag: string,
): Fxp[] {
  const out: Fxp[] = [];
  for (const child of raw ?? []) {
    const name = tagNameOf(child);
    if (name === TEXT) {
      const t = String(child[TEXT] ?? '').trim();
      if (t !== '') {
        errors.push({
          message: `<${ownerTag}> contains text content "${t}"; only elements are allowed`,
        });
      }
      continue;
    }
    if (name == null) continue;
    out.push(child);
  }
  return out;
}

function readProb(
  attrs: Record<string, string>,
  tag: string,
  errors: ParseError[],
  src: string,
  occurrence: number,
): number {
  if (!('prob' in attrs)) return 1;
  const raw = attrs.prob;
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    errors.push({
      message: `<${tag} prob="${raw}">: prob must be a number in [0,1]`,
      ...spanOfTag(src, tag, occurrence),
    });
    return 1;
  }
  if (n < 0 || n > 1) {
    errors.push({
      message: `<${tag} prob="${raw}">: prob must lie in [0,1]`,
      ...spanOfTag(src, tag, occurrence),
    });
    return Math.min(1, Math.max(0, n));
  }
  return n;
}

// Accepted grammar:
//   document  ::= ordinary
//   ordinary  ::= '<' Label attr* '>' distblock? '</' Label '>' | '<' Label attr* '/>'
//   distblock ::= '<ind>' ordinary+ '</ind>' | '<mux>' ordinary+ '</mux>'
//   attr      ::= 'prob' '=' Number | 'data' '=' String
export function parsePDocument(xml: string): ParseResult {
  const errors: ParseError[] = [];

  const validity = XMLValidator.validate(xml, { allowBooleanAttributes: true });
  if (validity !== true) {
    const e = validity.err;
    return {
      ok: false,
      errors: [
        {
          message: `${e.msg} (line ${e.line})`,
          from: offsetOf(xml, e.line, e.col),
          to: offsetOf(xml, e.line, e.col) + 1,
        },
      ],
    };
  }

  let tree: Fxp[];
  try {
    tree = parser.parse(xml) as Fxp[];
  } catch (err) {
    return {
      ok: false,
      errors: [{ message: err instanceof Error ? err.message : String(err) }],
    };
  }

  const tops = elementChildren(tree, errors, 'document').filter(
    (el) => tagNameOf(el) !== '?xml',
  );
  if (tops.length === 0) {
    return { ok: false, errors: [{ message: 'empty document: expected a root element' }] };
  }
  if (tops.length > 1) {
    errors.push({ message: 'a p-document has exactly one root element' });
  }

  // Count occurrences per tag as we walk, so spanOfTag points at the right one.
  const seen = new Map<string, number>();
  const nextOccurrence = (tag: string): number => {
    const n = seen.get(tag) ?? 0;
    seen.set(tag, n + 1);
    return n;
  };

  const parseOrdinary = (el: Fxp, isRoot: boolean): PNode | null => {
    const tag = tagNameOf(el);
    if (tag == null) return null;
    const occurrence = nextOccurrence(tag);

    if (tag === 'ind' || tag === 'mux') {
      errors.push({
        message: `<${tag}> is a distributional block, not an ordinary node; it may not appear here`,
        ...spanOfTag(xml, tag, occurrence),
      });
      return null;
    }
    if (!isValidLabel(tag)) {
      errors.push({ message: `"${tag}" is not a valid element name` });
      return null;
    }

    const attrs: Record<string, string> = (el[ATTRS] ?? {}) as Record<string, string>;
    for (const a of Object.keys(attrs)) {
      if (a !== 'prob' && a !== 'data') {
        errors.push({
          message: `<${tag} ${a}>: only prob and data are allowed`,
          ...spanOfTag(xml, tag, occurrence),
        });
      }
    }

    let prob = readProb(attrs, tag, errors, xml, occurrence);
    if (isRoot) {
      if ('prob' in attrs && Math.abs(prob - 1) > 1e-12) {
        errors.push({
          message: 'the root exists with probability 1; drop its prob or set prob="1"',
          ...spanOfTag(xml, tag, occurrence),
        });
      }
      prob = 1;
    }

    const node: PNode = {
      id: newId(),
      label: tag,
      prob,
      distType: null,
      children: [],
    };
    if ('data' in attrs) node.data = attrs.data;

    const kids = elementChildren(el[tag] as Fxp[], errors, tag);
    if (kids.length === 0) return node;

    const blocks = kids.filter((k) => {
      const n = tagNameOf(k);
      return n === 'ind' || n === 'mux';
    });
    const strays = kids.filter((k) => !blocks.includes(k));
    for (const s of strays) {
      const n = tagNameOf(s) ?? '?';
      errors.push({
        message: `<${n}> sits directly inside <${tag}>; children of an ordinary node must sit inside an \`ind\` or \`mux\` block`,
        ...spanOfTag(xml, n, seen.get(n) ?? 0),
      });
    }
    if (blocks.length > 1) {
      errors.push({
        message: `<${tag}> has ${blocks.length} distributional blocks; an ordinary node has children through exactly one`,
        ...spanOfTag(xml, tag, occurrence),
      });
    }
    const block = blocks[0];
    if (block == null) return node;

    const blockName = tagNameOf(block) as DistType;
    nextOccurrence(blockName);
    node.distType = blockName;
    const blockKids = elementChildren(block[blockName] as Fxp[], errors, blockName);
    if (blockKids.length === 0) {
      errors.push({
        message: `<${blockName}> is empty; a distributional block governs one or more ordinary nodes`,
        ...spanOfTag(xml, blockName, (seen.get(blockName) ?? 1) - 1),
      });
      node.distType = null;
      return node;
    }
    for (const k of blockKids) {
      const child = parseOrdinary(k, false);
      if (child) node.children.push(child);
    }
    if (node.children.length === 0) node.distType = null;
    return node;
  };

  const root = parseOrdinary(tops[0], true);
  if (root == null) {
    if (errors.length === 0) errors.push({ message: 'could not read the root element' });
    return { ok: false, errors };
  }
  if (errors.length > 0) return { ok: false, errors };

  const doc: PDocument = { root };
  reserveIds(collectIds(doc));
  return { ok: true, doc };
}

function collectIds(doc: PDocument): string[] {
  const out: string[] = [];
  const walk = (n: PNode): void => {
    out.push(n.id);
    n.children.forEach(walk);
  };
  walk(doc.root);
  return out;
}

// Preserve node ids wherever the tree shape and position match, so expansion
// state and selection survive edits made in the XML pane. Only genuinely new
// nodes get fresh ids.
export function reconcileIds(oldDoc: PDocument, fresh: PDocument): PDocument {
  const walk = (prev: PNode | undefined, next: PNode): PNode => {
    const id = prev ? prev.id : next.id;
    return {
      ...next,
      id,
      children: next.children.map((c, i) => walk(prev?.children[i], c)),
    };
  };
  return { root: walk(oldDoc.root, fresh.root) };
}
