// Broad IPA for Spanish of Spain from the spelling: distinción (c/z as θ),
// yeísmo (ll and y as ʝ), stress from the written-accent rules. Allophones
// (β ð ɣ, nasal assimilation) are left out on purpose, this is for learners.
const ONSETS = new Set([
  'pɾ',
  'bɾ',
  'tɾ',
  'dɾ',
  'kɾ',
  'gɾ',
  'fɾ',
  'pl',
  'bl',
  'kl',
  'gl',
  'fl',
]);
const VOWELS = 'aeiouáéíóúü';
const WEAK = 'iuü';
// ''.includes('') is true, so an end-of-word neighbour must not match anything
const has = (set, ch) => ch !== '' && set.includes(ch);

function letters(word) {
  const w = word.toLowerCase();
  const out = [];
  for (let i = 0; i < w.length; i++) {
    const c = w[i],
      n = w[i + 1] ?? '',
      p = w[i - 1] ?? '';
    const frontVowel = (ch) => has('eiéí', ch);
    const next = (s) => {
      out.push(s);
    };
    if (c === 'c' && n === 'h') {
      next('tʃ');
      i++;
    } else if (c === 'l' && n === 'l') {
      next('ʝ');
      i++;
    } else if (c === 'r' && n === 'r') {
      next('r');
      i++;
    } else if (c === 'q' && n === 'u') {
      next('k');
      i++;
    } else if (c === 'g' && n === 'u' && frontVowel(w[i + 2] ?? '')) {
      next('g');
      i++;
    } else if (c === 'g' && n === 'ü') {
      next('gw');
      i++;
    } else if (c === 'g' && frontVowel(n)) next('x');
    else if (c === 'c' && frontVowel(n)) next('θ');
    else if (c === 'c') next('k');
    else if (c === 'z') next('θ');
    else if (c === 'j') next('x');
    else if (c === 'ñ') next('ɲ');
    else if (c === 'v') next('b');
    else if (c === 'h') continue;
    else if (c === 'x') {
      next('k');
      next('s');
    } else if (c === 'y')
      next(has(VOWELS, n) ? 'ʝ' : has(VOWELS, p) ? 'j' : 'i');
    else if (c === 'r') next(i === 0 || 'nls'.includes(p) ? 'r' : 'ɾ');
    else if (c === 'ü') next('u');
    else next(c);
  }
  return out;
}

const ACCENT = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' };

export function ipa(word) {
  const segs = letters(word);
  // syllable nuclei: runs of vowels, split when two strong vowels meet
  const nuclei = [];
  for (let i = 0; i < segs.length; i++) {
    if (!VOWELS.includes(segs[i])) continue;
    const prev = nuclei[nuclei.length - 1];
    const joins =
      prev &&
      prev.end === i - 1 &&
      (WEAK.includes(segs[i]) || WEAK.includes(segs[i - 1])) &&
      !(ACCENT[segs[i]] && WEAK.includes(ACCENT[segs[i]])) &&
      !(ACCENT[segs[i - 1]] && WEAK.includes(ACCENT[segs[i - 1]]));
    if (joins) prev.end = i;
    else nuclei.push({ start: i, end: i, accented: false });
    if (ACCENT[segs[i]]) nuclei[nuclei.length - 1].accented = true;
  }
  if (nuclei.length === 0) return segs.join('');
  let stressed = nuclei.findIndex((n) => n.accented);
  if (stressed === -1) {
    const last = segs[segs.length - 1];
    const endsOpen = VOWELS.includes(last) || last === 'n' || last === 's';
    stressed = endsOpen ? Math.max(0, nuclei.length - 2) : nuclei.length - 1;
  }
  // the stressed syllable starts after the previous nucleus, at the onset
  let start = 0;
  if (stressed > 0) {
    const gapStart = nuclei[stressed - 1].end + 1;
    const cluster = segs.slice(gapStart, nuclei[stressed].start);
    const tail = cluster.slice(-2).join('');
    const onsetLen = cluster.length === 0 ? 0 : ONSETS.has(tail) ? 2 : 1;
    start = nuclei[stressed].start - onsetLen;
  }
  const plain = segs.map((s) => ACCENT[s] ?? s);
  // an unstressed weak vowel next to another vowel is a glide: bueno ˈbweno,
  // seis sejs; when both are weak only the first glides: muy mwi
  for (const n of nuclei) {
    for (let i = n.start; i <= n.end; i++) {
      if (n.start === n.end || ACCENT[segs[i]] || !WEAK.includes(plain[i]))
        continue;
      if (i > n.start && WEAK.includes(segs[i - 1])) continue;
      plain[i] = plain[i] === 'i' ? 'j' : 'w';
    }
  }
  // monosyllables carry no stress mark
  if (nuclei.length === 1) return plain.join('');
  return plain.slice(0, start).join('') + 'ˈ' + plain.slice(start).join('');
}

export const ipaPhrase = (text) =>
  text
    .split(/\s+/)
    .map((token) => token.split('/').map(ipa).join('/'))
    .join(' ');
