#!/usr/bin/env node
// Finds values in the theme's own CSS that aren't design tokens: raw colours, lengths and durations.
// CLAUDE.md promises "every value in wp.css is a token"; this checks it.
//
//   node bin/lint-tokens.mjs                 checks assets/css/wp.css
//   node bin/lint-tokens.mjs path/to/a.css   checks other files
//   node bin/lint-tokens.mjs --json          machine-readable
//
// Each finding names the nearest token when there is a close one. A line that needs a raw value on
// purpose can say so with /* raw: reason */ and is skipped. Exit code 1 when anything is found.

import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const THEME = join(ROOT, 'wp-content/themes/jb-toybox');
const args = process.argv.slice(2);
const asJson = args.includes('--json');
const files = args.filter(a => !a.startsWith('--'));
if (!files.length) files.push(join(THEME, 'assets/css/wp.css'));

// What the tokens are worth, from theme.json, so a finding can suggest the nearest one.
const theme = JSON.parse(readFileSync(join(THEME, 'theme.json'), 'utf8')).settings;
const toPx = v => {
  const m = String(v).trim().match(/^(-?[\d.]+)(px|rem|em)$/);
  return m ? parseFloat(m[1]) * (m[2] === 'px' ? 1 : 16) : null;
};
const lengths = [];
for (const s of theme.spacing?.spacingSizes || []) lengths.push({ token: `--space-${s.slug}`, px: toPx(s.size) });
for (const [k, v] of Object.entries(theme.custom?.radius || {})) lengths.push({ token: `--radius-${k}`, px: toPx(v) });
for (const [k, v] of Object.entries(theme.custom?.outline || {})) lengths.push({ token: `--outline-${k}`, px: toPx(v) });
for (const s of theme.typography?.fontSizes || []) lengths.push({ token: `--text-${s.slug}`, px: toPx(s.size), type: true });

const hex = h => {
  h = h.replace('#', '');
  if (h.length === 3) h = [...h].map(c => c + c).join('');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
};
const colours = [];
for (const c of theme.color?.palette || []) {
  const light = (c.color.match(/#[0-9a-fA-F]{3,8}/) || [])[0];
  if (light) colours.push({ token: `--${c.slug}`, rgb: hex(light) });
}

function nearestColour(raw) {
  const rgb = hex(raw);
  let best = null;
  for (const c of colours) {
    const d = Math.hypot(...rgb.map((v, i) => v - c.rgb[i]));
    if (!best || d < best.d) best = { ...c, d };
  }
  return best && best.d < 40 ? (best.d === 0 ? `var(${best.token})` : `var(${best.token}) is close`) : null;
}
function nearestLength(raw, prop) {
  if (/letter-spacing/.test(prop)) return 'a --track-* token';
  if (/line-height/.test(prop)) return 'a --leading-* token';
  if (/em$/.test(raw) && !/rem$/.test(raw)) return null; // relative to the text; no fixed token fits
  const px = toPx(raw);
  if (px === null) return null;
  // Only suggest from the family that fits the property.
  const family = /font-size/.test(prop) ? l => l.type
    : /radius/.test(prop) ? l => l.token.startsWith('--radius')
    : /^(?:border|outline)(?:-width)?$|border-.*width/.test(prop) ? l => l.token.startsWith('--outline')
    : l => l.token.startsWith('--space');
  const pool = lengths.filter(l => l.px !== null && family(l));
  let best = null;
  for (const l of pool) {
    const d = Math.abs(l.px - Math.abs(px));
    if (!best || d < best.d) best = { ...l, d };
  }
  if (!best || best.d > Math.max(1, Math.abs(px) * 0.1)) return null;
  const sign = px < 0 ? 'calc(-1 * var(' + best.token + '))' : 'var(' + best.token + ')';
  return best.d === 0 ? sign : sign + ' is close';
}

const RULES = [
  { kind: 'colour', re: /#[0-9a-fA-F]{3,8}\b/g, suggest: nearestColour },
  { kind: 'colour', re: /\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\([^)]*\)/g, suggest: () => null },
  { kind: 'colour', re: /(?<![\w-])(?:white|black|red|blue|green|gray|grey|orange|yellow|purple|pink)(?![\w-])/g, suggest: () => null },
  { kind: 'length', re: /(?<![\w.-])-?\d*\.?\d+(?:px|rem|em|vh|vw|vmin|vmax|ch)\b/g, suggest: nearestLength },
  { kind: 'duration', re: /(?<![\w.-])\d*\.?\d+m?s\b/g, suggest: () => 'a --dur-* token' }
];
// Properties where a bare value is the language, not a design decision.
const SKIP_PROPS = /^(?:--|content$|grid-template-areas$|font-family$|src$|unicode-range$|counter-|quotes$)/;

const findings = [];
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  // Blank out comments but keep line numbers.
  const code = text.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).split('\n');
  code.forEach((line, i) => {
    if (/\/\*\s*raw:/.test(lines[i])) return;
    for (const decl of line.matchAll(/([a-z-]+)\s*:\s*([^;{}]+)/g)) {
      const [, prop, rawValue] = decl;
      if (SKIP_PROPS.test(prop)) continue;
      // A fallback inside var() is a guard, not a design value.
      const value = rawValue.replace(/var\(\s*--[\w-]+\s*,[^()]*(?:\([^()]*\)[^()]*)*\)/g, 'var()');
      if (/\b(?:url|attr)\(/.test(value)) continue;
      for (const rule of RULES) {
        for (const m of value.matchAll(rule.re)) {
          const raw = m[0];
          if (rule.kind === 'length' && /^-?0*\.?0+[a-z]+$/.test(raw)) continue; // zero is zero
          // Inside @media / @container conditions a breakpoint is a number on purpose.
          if (/@(?:media|container|supports)/.test(line.slice(0, decl.index))) continue;
          findings.push({ file: relative(ROOT, file), line: i + 1, property: prop, raw, kind: rule.kind, suggest: rule.suggest(raw, prop) });
        }
      }
    }
  });
}

if (asJson) {
  console.log(JSON.stringify(findings, null, 2));
} else if (!findings.length) {
  console.log(`No raw values in ${files.map(f => relative(ROOT, f)).join(', ')}.`);
} else {
  for (const f of findings) {
    console.log(`${f.file}:${f.line}  ${f.property}: ${f.raw}  (${f.kind})${f.suggest ? '  → ' + f.suggest : ''}`);
  }
  const by = findings.reduce((a, f) => ((a[f.kind] = (a[f.kind] || 0) + 1), a), {});
  console.log(`\n${findings.length} raw values: ` + Object.entries(by).map(([k, n]) => `${n} ${k}`).join(', ') + '.');
  console.log('Mark one that is raw on purpose with /* raw: reason */ on its line.');
}
process.exitCode = findings.length ? 1 : 0;
