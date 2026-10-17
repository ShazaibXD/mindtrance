/* Plain-English descriptions of learning events, shared by the dashboard and analytics. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});
  const ui = MT.ui;

  function conceptName(trackId, conceptId) {
    const t = MT.data.track(trackId);
    const c = t && t.concepts.find((x) => x.id === conceptId);
    return c ? c.name : conceptId || 'a concept';
  }

  /* Returns { text, tone } for an event. */
  ui.describeEvent = function (ev) {
    const c = conceptName(ev.trackId, ev.conceptId);
    const d = (a, b) => ' (' + ui.f2(a) + ' to ' + ui.f2(b) + ')';
    switch (ev.type) {
      case 'ATTEMPT': {
        const label = MT.diagnose.CATEGORIES[ev.category] ? MT.diagnose.CATEGORIES[ev.category].label : ev.category;
        return { text: ev.correct ? 'Solved a problem' : 'Attempt classified as ' + label.toLowerCase(), tone: ev.correct ? 'mastered' : 'verify' };
      }
      case 'OBSERVATION': {
        const what = { probe: 'probe', practice: 'practice question', verification: 'verification problem', 'verification-transfer': 'verification (target concept)', attempt: 'attempt' }[ev.source] || 'answer';
        return { text: (ev.correct ? 'Passed' : 'Missed') + ' a ' + what + ' on ' + c + d(ev.before, ev.after), tone: ev.correct ? 'mastered' : 'gap' };
      }
      case 'LEARNING': return { text: 'Completed a lesson on ' + c + d(ev.before, ev.after), tone: 'sage' };
      case 'RECOVERY_STARTED': return { text: 'Started recovery for ' + c, tone: 'sage' };
      case 'MASTERY_VERIFIED': return { text: 'Verified mastery of ' + c + d(ev.before, ev.after), tone: 'mastered' };
      case 'VERIFICATION_FAILED': return { text: 'Verification on ' + c + ' showed the gap remains', tone: 'gap' };
      default: return { text: ev.type, tone: '' };
    }
  };
  ui.conceptName = conceptName;
  if (typeof module !== 'undefined' && module.exports) module.exports = ui.describeEvent;
})(typeof window !== 'undefined' ? window : globalThis);
