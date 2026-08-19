// Categorical hues for path expressions. Assigned in fixed order, never
// cycled; past the fifth an expression is created disabled instead. The
// selection blue #2B5CE6 is deliberately absent so it always reads as
// "selected", never as an expression's colour.
const PATH_PALETTE = [
  { name: 'aqua', hex: '#1BAF7A' },
  { name: 'violet', hex: '#4A3AA7' },
  { name: 'yellow', hex: '#EDA100' },
  { name: 'magenta', hex: '#E87BA4' },
  { name: 'green', hex: '#008300' },
] as const;

export const MAX_ACTIVE_PATHS = PATH_PALETTE.length;

// Default names. ε, μ, π, σ and τ already mean something in the logic, so
// those slots carry a hat.
const GREEK = [
  'α', 'β', 'γ', 'δ', 'ε̂', 'ζ', 'η', 'θ', 'ι', 'κ',
  'λ', 'μ̂', 'ν', 'ξ', 'ο', 'π̂', 'ρ', 'σ̂', 'τ̂', 'υ',
] as const;

export function greekName(index: number): string {
  return GREEK[index] ?? `q${index + 1}`;
}

export function paletteColor(index: number): string {
  return PATH_PALETTE[index % PATH_PALETTE.length].hex;
}
