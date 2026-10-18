/* Safety layer for text that is sent to a model. Student text is always data, never instructions.
 * sanitize() cleans it and flags attempts to steer the model; the flag is shown to the student, not hidden. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});

  // Zero-width and bidirectional control characters can hide text from the reader but not from a model.
  const INVISIBLE = /[​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;
  const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
  const INJECTION = [
    /ignore (all |any |the )?(previous|prior|above|earlier) (instructions|prompts?|rules)/i,
    /disregard (all |any |the )?(previous|prior|above|earlier|your) (instructions|prompts?|rules)/i,
    /(reveal|show|print|repeat) (me )?(your|the) (system )?(prompt|instructions)/i,
    /you are now (a|an|the)?\s*\w+/i,
    /\b(system|developer) (prompt|message|override)\b/i,
    /\bact as (a|an)?\s*\w+/i,
    /<\/?(student_answer|student_working|student_reasoning|question)>/i,
    /\bmark (this|my answer) as (correct|right)\b/i,
    /\bset is_correct\b/i,
  ];
  // Words a diagnosis must never use about a student (spec 18.4).
  const PEJORATIVE = /\b(lazy|stupid|dumb|idiot|careless student|poor student|weak student|failed to understand basic)\b/i;

  function sanitize(text, max) {
    const original = String(text == null ? '' : text);
    let t = original.replace(INVISIBLE, '').replace(CONTROL, ' ');
    t = t.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    const flags = [];
    if (original.length !== original.replace(INVISIBLE, '').length) flags.push('hidden-characters');
    if (INJECTION.some((re) => re.test(t))) flags.push('instruction-like-text');
    if (max && t.length > max) { t = t.slice(0, max); flags.push('truncated'); }
    return { text: t, flags, suspicious: flags.includes('instruction-like-text') || flags.includes('hidden-characters') };
  }

  const isPejorative = (text) => PEJORATIVE.test(String(text || ''));

  /* The evidence quote must be an exact substring of what the student wrote (whitespace-insensitive), or the explicit marker. */
  const NO_WORKING = 'NO_WORKING_PROVIDED';
  function quoteIsGrounded(quote, studentText) {
    const q = String(quote || '').trim();
    if (!q) return false;
    if (q === NO_WORKING) return true;
    const norm = (s) => String(s).replace(/\s+/g, ' ').trim().toLowerCase();
    return norm(studentText).includes(norm(q));
  }

  MT.safety = { sanitize, isPejorative, quoteIsGrounded, NO_WORKING };
  if (typeof module !== 'undefined' && module.exports) module.exports = MT.safety;
})(typeof window !== 'undefined' ? window : globalThis);
