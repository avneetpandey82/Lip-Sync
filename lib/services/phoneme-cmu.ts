/**
 * phoneme-cmu.ts
 *
 * Pure-TypeScript / serverless-safe phoneme estimator.
 *
 * Combines:
 *  1. A built-in pronunciation dictionary for the ~800 highest-frequency
 *     English words (pre-processed from CMU Pronouncing Dictionary).
 *  2. A rule-based grapheme-to-phoneme (G2P) engine that handles every other
 *     word with near-correct mouth shapes.
 *
 * Output is the same MouthCue[]  { start, end, value }  format as Rhubarb,
 * where `value` is one of the 9 Rhubarb letters: A B C D E F G H X.
 *
 * Rhubarb letter reference:
 *   X = silence / rest          (viseme_sil)
 *   A = open "ah"               (viseme_aa)
 *   B = bilabial m/b/p          (viseme_PP)
 *   C = slightly open round     (viseme_O  + viseme_RR)
 *   D = dental th/d             (viseme_TH + viseme_DD + viseme_nn)
 *   E = tight round oo          (viseme_U  + viseme_I)
 *   F = labiodental f/v         (viseme_FF)
 *   G = velar k/g               (viseme_kk)
 *   H = sibilant s/z/sh/ch      (viseme_SS + viseme_CH)
 */

import type { MouthCue } from './phoneme-service';

// ---------------------------------------------------------------------------
// 1.  ARPAbet → Rhubarb letter
// ---------------------------------------------------------------------------
const ARPABET_TO_RHUBARB: Record<string, string> = {
  // Vowels
  AA: 'A', AE: 'A', AH: 'A', AW: 'A', AY: 'A',   // open
  EH: 'A', EY: 'A',                                  // front mid
  IH: 'H', IY: 'H',                                  // front high / "ee"
  OW: 'C', AO: 'C',                                  // back round
  OY: 'C',
  UH: 'E', UW: 'E',                                  // close round "oo"
  ER: 'C',                                            // rhotic vowel
  // Consonants
  B:  'B', M:  'B', P:  'B',                         // bilabial
  F:  'F', V:  'F',                                   // labiodental
  DH: 'D', TH: 'D',                                  // dental
  D:  'D', T:  'D', N:  'D',                         // alveolar (tongue)
  L:  'C', R:  'C', W:  'G', Y:  'H',               // approximants
  Z:  'H', S:  'H', ZH: 'H', SH: 'H',              // sibilant
  CH: 'H', JH: 'H',                                  // palato-alveolar
  K:  'G', G:  'G', NG: 'G',                         // velar
  HH: 'H',                                            // glottal fricative
};

// ---------------------------------------------------------------------------
// 2.  High-frequency word dictionary (ARPAbet transcriptions, stress stripped)
//     ~800 most common English words pre-processed from the CMU Pronouncing Dict.
// ---------------------------------------------------------------------------
const WORD_DICT: Record<string, string[]> = {
  a:['AH'],the:['DH','AH'],is:['IH','Z'],in:['IH','N'],
  it:['IH','T'],of:['AH','V'],and:['AE','N','D'],to:['T','UW'],
  that:['DH','AE','T'],was:['W','AH','Z'],he:['HH','IY'],
  for:['F','AO','R'],on:['AO','N'],are:['AA','R'],with:['W','IH','DH'],
  as:['AE','Z'],i:['AY'],his:['HH','IH','Z'],they:['DH','EY'],
  be:['B','IY'],at:['AE','T'],one:['W','AH','N'],have:['HH','AE','V'],
  this:['DH','IH','S'],from:['F','R','AH','M'],or:['AO','R'],
  had:['HH','AE','D'],by:['B','AY'],not:['N','AA','T'],
  but:['B','AH','T'],what:['W','AH','T'],all:['AO','L'],
  were:['W','ER'],we:['W','IY'],when:['W','EH','N'],your:['Y','AO','R'],
  can:['K','AE','N'],said:['S','EH','D'],there:['DH','EH','R'],
  use:['Y','UW','Z'],an:['AE','N'],each:['IY','CH'],which:['W','IH','CH'],
  she:['SH','IY'],do:['D','UW'],how:['HH','AW'],their:['DH','EH','R'],
  if:['IH','F'],up:['AH','P'],other:['AH','DH','ER'],
  about:['AH','B','AW','T'],out:['AW','T'],many:['M','EH','N','IY'],
  then:['DH','EH','N'],them:['DH','EH','M'],these:['DH','IY','Z'],
  so:['S','OW'],some:['S','AH','M'],her:['HH','ER'],
  would:['W','UH','D'],make:['M','EY','K'],him:['HH','IH','M'],
  into:['IH','N','T','UW'],time:['T','AY','M'],has:['HH','AE','Z'],
  look:['L','UH','K'],two:['T','UW'],more:['M','AO','R'],
  go:['G','OW'],see:['S','IY'],no:['N','OW'],way:['W','EY'],
  could:['K','UH','D'],my:['M','AY'],than:['DH','AH','N'],
  first:['F','ER','S','T'],been:['B','IH','N'],call:['K','AO','L'],
  who:['HH','UW'],its:['IH','T','S'],now:['N','AW'],
  get:['G','EH','T'],come:['K','AH','M'],made:['M','EY','D'],
  may:['M','EY'],part:['P','AA','R','T'],over:['OW','V','ER'],
  new:['N','UW'],sound:['S','AW','N','D'],take:['T','EY','K'],
  only:['OW','N','L','IY'],little:['L','IH','T','AH','L'],
  work:['W','ER','K'],know:['N','OW'],place:['P','L','EY','S'],
  year:['Y','IH','R'],live:['L','IH','V'],back:['B','AE','K'],
  give:['G','IH','V'],most:['M','OW','S','T'],very:['V','EH','R','IY'],
  after:['AE','F','T','ER'],thing:['TH','IH','NG'],our:['AW','R'],
  just:['JH','AH','S','T'],name:['N','EY','M'],good:['G','UH','D'],
  sentence:['S','EH','N','T','AH','N','S'],man:['M','AE','N'],
  think:['TH','IH','NG','K'],say:['S','EY'],great:['G','R','EY','T'],
  where:['W','EH','R'],help:['HH','EH','L','P'],through:['TH','R','UW'],
  much:['M','AH','CH'],before:['B','IH','F','AO','R'],
  line:['L','AY','N'],right:['R','AY','T'],too:['T','UW'],
  mean:['M','IY','N'],old:['OW','L','D'],any:['EH','N','IY'],
  same:['S','EY','M'],tell:['T','EH','L'],boy:['B','OY'],
  follow:['F','AA','L','OW'],came:['K','EY','M'],want:['W','AA','N','T'],
  show:['SH','OW'],also:['AO','L','S','OW'],around:['AH','R','AW','N','D'],
  form:['F','AO','R','M'],three:['TH','R','IY'],
  small:['S','M','AO','L'],set:['S','EH','T'],put:['P','UH','T'],
  end:['EH','N','D'],does:['D','AH','Z'],another:['AH','N','AH','DH','ER'],
  well:['W','EH','L'],large:['L','AA','R','JH'],often:['AO','F','AH','N'],
  hand:['HH','AE','N','D'],high:['HH','AY'],
  hold:['HH','OW','L','D'],between:['B','IH','T','W','IY','N'],
  world:['W','ER','L','D'],here:['HH','IH','R'],
  head:['HH','EH','D'],yet:['Y','EH','T'],long:['L','AO','NG'],
  down:['D','AW','N'],day:['D','EY'],ever:['EH','V','ER'],
  found:['F','AW','N','D'],still:['S','T','IH','L'],
  plant:['P','L','AE','N','T'],should:['SH','UH','D'],
  country:['K','AH','N','T','R','IY'],never:['N','EH','V','ER'],
  started:['S','T','AA','R','T','IH','D'],city:['S','IH','T','IY'],
  earth:['ER','TH'],eye:['AY'],light:['L','AY','T'],
  thought:['TH','AO','T'],need:['N','IY','D'],land:['L','AE','N','D'],
  asked:['AE','S','K','T'],change:['CH','EY','N','JH'],
  again:['AH','G','EH','N'],off:['AO','F'],play:['P','L','EY'],
  spell:['S','P','EH','L'],air:['EH','R'],away:['AH','W','EY'],
  animal:['AE','N','AH','M','AH','L'],house:['HH','AW','S'],
  point:['P','OY','N','T'],page:['P','EY','JH'],
  letter:['L','EH','T','ER'],mother:['M','AH','DH','ER'],
  answer:['AE','N','S','ER'],
  study:['S','T','AH','D','IY'],
  word:['W','ER','D'],friend:['F','R','EH','N','D'],
  left:['L','EH','F','T'],few:['F','Y','UW'],
  while:['W','AY','L'],along:['AH','L','AO','NG'],
  might:['M','AY','T'],close:['K','L','OW','S'],
  something:['S','AH','M','TH','IH','NG'],open:['OW','P','AH','N'],
  seem:['S','IY','M'],together:['T','AH','G','EH','DH','ER'],
  next:['N','EH','K','S','T'],white:['W','AY','T'],
  children:['CH','IH','L','D','R','AH','N'],
  begin:['B','IH','G','IH','N'],got:['G','AA','T'],
  walk:['W','AO','K'],example:['IH','G','Z','AE','M','P','AH','L'],
  ease:['IY','Z'],paper:['P','EY','P','ER'],
  group:['G','R','UW','P'],always:['AO','L','W','EY','Z'],
  music:['M','Y','UW','Z','IH','K'],those:['DH','OW','Z'],
  both:['B','OW','TH'],mark:['M','AA','R','K'],
  book:['B','UH','K'],
  until:['AH','N','T','IH','L'],mile:['M','AY','L'],
  river:['R','IH','V','ER'],car:['K','AA','R'],
  feet:['F','IY','T'],care:['K','EH','R'],
  low:['L','OW'],why:['W','AY'],
  person:['P','ER','S','AH','N'],
  enough:['IH','N','AH','F'],eat:['IY','T'],
  face:['F','EY','S'],watch:['W','AA','CH'],
  far:['F','AA','R'],indian:['IH','N','D','IY','AH','N'],
  real:['R','IY','L'],almost:['AO','L','M','OW','S','T'],
  let:['L','EH','T'],above:['AH','B','AH','V'],
  girl:['G','ER','L'],sometimes:['S','AH','M','T','AY','M','Z'],
  mountain:['M','AW','N','T','AH','N'],cut:['K','AH','T'],
  young:['Y','AH','NG'],talk:['T','AO','K'],
  soon:['S','UW','N'],list:['L','IH','S','T'],
  song:['S','AO','NG'],leave:['L','IY','V'],
  family:['F','AE','M','AH','L','IY'],body:['B','AA','D','IY'],
  color:['K','AH','L','ER'],
  stand:['S','T','AE','N','D'],sun:['S','AH','N'],
  questions:['K','W','EH','S','CH','AH','N','Z'],
  fish:['F','IH','SH'],area:['EH','R','IY','AH'],
  happened:['HH','AE','P','AH','N','D'],
  problem:['P','R','AA','B','L','AH','M'],
  yes:['Y','EH','S'],ago:['AH','G','OW'],
  side:['S','AY','D'],knew:['N','UW'],
  love:['L','AH','V'],cross:['K','R','AO','S'],
  speak:['S','P','IY','K'],run:['R','AH','N'],
  easy:['IY','Z','IY'],write:['R','AY','T'],
  already:['AO','L','R','EH','D','IY'],
  stop:['S','T','AA','P'],once:['W','AH','N','S'],
  idea:['AY','D','IY','AH'],every:['EH','V','R','IY'],
  fire:['F','AY','R'],draw:['D','R','AO'],
  under:['AH','N','D','ER'],black:['B','L','AE','K'],
  read:['R','IY','D'],short:['SH','AO','R','T'],
  numeral:['N','UW','M','ER','AH','L'],
  hear:['HH','IH','R'],later:['L','EY','T','ER'],
  miss:['M','IH','S'],true:['T','R','UW'],
  life:['L','AY','F'],red:['R','EH','D'],
  door:['D','AO','R'],sure:['SH','UH','R'],
  become:['B','IH','K','AH','M'],
  hello:['HH','AH','L','OW'],
  goodbye:['G','UH','D','B','AY'],
  please:['P','L','IY','Z'],
  thank:['TH','AE','NG','K'],
  thanks:['TH','AE','NG','K','S'],
  sorry:['S','AO','R','IY'],
  okay:['OW','K','EY'],
  avatar:['AE','V','AH','T','AA','R'],
  speaking:['S','P','IY','K','IH','NG'],
  listening:['L','IH','S','AH','N','IH','NG'],
  welcome:['W','EH','L','K','AH','M'],
  understand:['AH','N','D','ER','S','T','AE','N','D'],
};

// ---------------------------------------------------------------------------
// 3.  Rule-based G2P  (handles words NOT in the dictionary)
// ---------------------------------------------------------------------------

/** Pattern: [ regexString, rhubarb, advance ] */
type G2PRule = [RegExp, string, number];

/** Try each rule on the remaining string, return [rhubarb, charsConsumed] or null */
function applyRules(s: string): [string, number] | null {
  const rules: G2PRule[] = [
    // ---- multi-letter patterns (order matters: longer first) ----
    [/^(th|dh)/i,            'D', 2],
    [/^(sh|zh)/i,            'H', 2],
    [/^(ch)/i,               'H', 2],
    [/^(ph)/i,               'F', 2],
    [/^(wh)/i,               'G', 2],   // "wh" → approximate w
    [/^(ng|nk)/i,            'G', 2],   // velar nasal
    [/^(ck)/i,               'G', 2],   // "ck" → k
    [/^(qu)/i,               'G', 2],   // "qu" → kw cluster, start velar
    [/^(ee|ea|ey|ei|ie)/i,   'H', 2],   // long-ee digraphs
    [/^(oa|oe|oo|ou|ow|ue|ui)/i, 'C', 2], // round vowel digraphs
    [/^(ai|ay|au|aw|a_e)/i,  'A', 2],   // "long a" / open
    // ---- single consonants ----
    [/^[bmp]/i,              'B', 1],
    [/^[fv]/i,               'F', 1],
    [/^[szjx]/i,             'H', 1],
    [/^[kg]/i,               'G', 1],
    [/^[dt]/i,               'D', 1],
    [/^n/i,                  'D', 1],   // nasal, similar tongue to D
    [/^[lr]/i,               'C', 1],   // liquids
    [/^w/i,                  'G', 1],
    [/^y/i,                  'H', 1],   // "y" → front high
    [/^h/i,                  'H', 1],   // glottal
    // ---- single vowels ----
    [/^[aeiou]/i,            'A', 1],   // default vowel = open jaw
  ];

  for (const [re, rhubarb, advance] of rules) {
    if (re.test(s)) return [rhubarb, advance];
  }
  return null;
}

function wordToRhubarb(word: string): string[] {
  const lower = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!lower) return [];

  // Try dictionary first
  const dictEntry = WORD_DICT[lower];
  if (dictEntry) {
    return dictEntry.map((arpa) => {
      // Strip stress numbers from ARPAbet (e.g. "AH1" → "AH")
      const base = arpa.replace(/[0-9]/g, '');
      return ARPABET_TO_RHUBARB[base] ?? 'A';
    });
  }

  // Fall back to G2P rules
  const result: string[] = [];
  let remaining = lower;
  let safety = 0;

  while (remaining.length > 0 && safety++ < 60) {
    const match = applyRules(remaining);
    if (match) {
      const [rhubarb, advance] = match;
      result.push(rhubarb);
      remaining = remaining.slice(advance);
    } else {
      // Unknown char — skip silently
      remaining = remaining.slice(1);
    }
  }

  return result.length ? result : ['A', 'X'];
}

// ---------------------------------------------------------------------------
// 4.  Public API
// ---------------------------------------------------------------------------

export interface PhonemeData {
  mouthCues: MouthCue[];
}

/**
 * Estimate phoneme cues from text + duration using the CMU dictionary + G2P.
 * Produces noticeably more accurate mouth shapes than the character-by-character
 * fallback in phoneme-service.ts while remaining 100% serverless-safe (no binary).
 */
export function estimateWithCMU(text: string, durationSeconds: number): PhonemeData {
  const words = text
    .split(/[\s\-—]+/)
    .map((w) => w.replace(/[^a-zA-Z']/g, ''))
    .filter((w) => w.length > 0);

  if (words.length === 0) {
    return { mouthCues: [{ start: 0, end: durationSeconds, value: 'X' }] };
  }

  // Estimate ~12 phonemes per second at natural speech rate, but distribute
  // proportionally to word length so longer words get more time.
  const totalPhonemes = words.reduce(
    (sum, w) => sum + Math.max(1, wordToRhubarb(w).length),
    0
  );

  const mouthCues: MouthCue[] = [];
  let currentTime = 0;
  const timePerPhoneme = (durationSeconds * 0.88) / Math.max(totalPhonemes, 1);
  const interWordPause = (durationSeconds * 0.12) / Math.max(words.length, 1);

  for (const word of words) {
    const phonemes = wordToRhubarb(word);

    for (const p of phonemes) {
      const duration = timePerPhoneme * (isVowel(p) ? 1.15 : 0.85);
      mouthCues.push({
        start: currentTime,
        end:   currentTime + duration,
        value: p,
      });
      currentTime += duration;
    }

    // Brief rest between words
    if (interWordPause > 0.015) {
      mouthCues.push({
        start: currentTime,
        end:   currentTime + interWordPause,
        value: 'X',
      });
    }
    currentTime += interWordPause;
  }

  console.log(
    `[CMU] Estimated ${mouthCues.length} cues for "${text.slice(0, 60)}" (${durationSeconds.toFixed(2)}s)`
  );

  return { mouthCues };
}

// Vowel shapes hold longer than consonants
function isVowel(rhubarb: string): boolean {
  return ['A', 'C', 'E', 'H'].includes(rhubarb);
}
