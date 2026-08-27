// Shared vanilla-JS "offline brain" for the downloaded static HTML of the
// three inline-expansion templates (Almanac, Pulse, Onyx) — all three use
// the IDENTICAL data-* attribute contract listed below, so one generator
// serves all of them rather than duplicating this logic per template.
// Classic (DashboardClient.tsx) has its own separate, larger version of this
// because it additionally has a serving-size scaler these three don't, but
// shares the same day/slot pattern (kept in sync by hand — see toggleDayExport
// /openSlotExport/closeSlotExport there vs clpToggleDay/clpOpenSlot/clpCloseSlot here).
//
// Contract (all elements must already exist in the DOM, just hidden via
// `display:none` — never conditionally unmounted, or a collapsed section
// would be missing entirely from the downloaded snapshot):
//   data-month-trigger / data-month-body        (value: monthNumber)
//   data-week-trigger  / data-week-body          (value: week_number)
//   data-day-trigger / data-day-body             (value: "week_number-DayName", e.g. "1-Sunday")
//   data-slot-list                               (the meal-slot tile grid, one per week)
//   data-slot-trigger / data-slot-body           (value: "week_number-slot", e.g. "1-breakfast")
//   data-slot-back                               (returns from a slot's recipes to the tile grid)
//   data-recipe-trigger / data-recipe-body       (value: recipe id, composite-keyed per week/slot)
//   data-grocery-month-trigger / data-grocery-month-body   (value: monthNumber)
//   data-grocery-week-trigger  / data-grocery-week-body    (value: week_number)
//   data-meal-trigger / data-meal-body           (value: meal type)
//   data-faq-trigger / data-faq-body             (value: index)
//   data-care-trigger / data-care-body           (value: index)
//   data-toc-trigger / data-toc-panel / data-toc-link   (jump-to-section dropdown)
//   data-founder-trigger / data-founder-body     (round photo, tap to reveal the note)
//   data-coach-trigger / data-coach-body         (round photo, tap to reveal the quote)
//   data-goal-toggle="week:action:date" data-goal-icon-done / data-goal-icon-undone / data-goal-text   (date is that day-tab's own real calendar date — each day tracks independently)
//   data-goal-check-track / data-goal-check-fill / data-goal-check-tick   (animated checkbox, on/off colors read from data-on-color/data-off-color on the track — optional, additive to the icon-done/undone pattern above)
//   data-mascot-idle / data-mascot-mouth  data-plant-stem / data-plant-leaf1 / data-plant-leaf2 / data-plant-flower   (Almanac's mascot+plant hero, continuous with pct — optional)
//   data-streak-flame                     (lit/unlit + pop, path's on/off colors read from data-on-color/data-off-color — optional)
//   data-grocery-item="week:category:item" data-grocery-icon-done / data-grocery-icon-undone / data-grocery-item-text
//   data-stat-pct="monthNumber" data-stat-sub="monthNumber"   (Track your progress per-month numbers)
//   data-stat="streak|days|goals|best" data-stat-label="best"
//   data-track-empty / data-track-content
//   data-trail-fill (path, dash-animated) / data-trail-flag="monthNumber" (circle's on/active/upcoming colors read from data-done-color/data-active-color/data-upcoming-color — optional; shares data-month-trigger with the month pill so a click opens the same month)

type MonthExportData = { monthNumber: number; monthLabel: string; weeks: { week_number: number; totalActions: number }[] }

export function buildInlineExportScript(opts: {
  shareToken: string
  monthsData: MonthExportData[]
  colors: { ink: string; inkSoft: string; muted: string; accent: string; accentSoft: string; border: string; onAccent: string }
}): string {
  const { shareToken, monthsData, colors: C } = opts
  const monthsJson = JSON.stringify(monthsData).replace(/</g, '\\u003c')
  return `
var CLP_ROADMAP_ID = '${shareToken}';
// Every download is its own fresh copy — a per-download id (not just the
// roadmap id) namespaces localStorage so re-downloading the plan (which
// commonly overwrites the same filename, and can land on the same
// file:// origin) never inherits progress from a previous download that
// happened to share a browser profile. Re-opening THIS same downloaded
// file later still remembers its own progress correctly, since this id is
// baked in once at download time and stays fixed for that file.
var CLP_DOWNLOAD_ID = '${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}';
var CLP_STORAGE_KEY = 'clp-checkins-' + CLP_ROADMAP_ID + '-' + CLP_DOWNLOAD_ID;
var CLP_GROCERY_KEY = 'clp-grocery-' + CLP_ROADMAP_ID + '-' + CLP_DOWNLOAD_ID;
var CLP_BASE_CHECKINS = [];
var CLP_MONTHS = ${monthsJson};
function clpGetCheckins(){
  try {
    var raw = localStorage.getItem(CLP_STORAGE_KEY);
    if (raw === null) { localStorage.setItem(CLP_STORAGE_KEY, JSON.stringify(CLP_BASE_CHECKINS)); return CLP_BASE_CHECKINS.slice(); }
    return JSON.parse(raw);
  } catch(e) { return CLP_BASE_CHECKINS.slice(); }
}
function clpSetCheckins(list){ try { localStorage.setItem(CLP_STORAGE_KEY, JSON.stringify(list)); } catch(e){} }
function clpShiftISO(dateISO, delta){
  var d = new Date(dateISO + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
function clpTodayISO(){ return new Date().toISOString().slice(0, 10); }
function clpSetText(sel, val){ var el = document.querySelector(sel); if (el) el.textContent = val; }

// ── table-of-contents dropdown ──
function clpToggleToc(){
  var panel = document.querySelector('[data-toc-panel]');
  if (!panel) return;
  panel.style.display = (panel.style.display === 'grid') ? 'none' : 'grid';
}
function clpCloseToc(){
  var panel = document.querySelector('[data-toc-panel]');
  if (panel) panel.style.display = 'none';
}

// ── founder's note / coach quote — round photo, tap to reveal (only one
// of each on the page, so no id parameter needed) ──
function clpToggleFounder(){
  var body = document.querySelector('[data-founder-body]');
  if (body) body.style.display = (body.style.display === 'block') ? 'none' : 'block';
}
function clpToggleCoach(){
  var body = document.querySelector('[data-coach-body]');
  if (body) body.style.display = (body.style.display === 'block') ? 'none' : 'block';
}

// ── single-open-at-a-time groups (month/week/recipe/grocery-month/grocery-week) ──
function clpSetPillActive(el, active){
  if (!el) return;
  el.style.border = active ? '1px solid ${C.accent}' : '1px solid ${C.border}';
  el.style.background = active ? '${C.accentSoft}' : 'transparent';
}
function clpToggleGroup(triggerAttr, bodyAttr, id, onOpen){
  var body = document.querySelector('[' + bodyAttr + '="' + id + '"]');
  var isOpen = body && body.style.display === 'block';
  document.querySelectorAll('[' + bodyAttr + ']').forEach(function(el){ el.style.display = 'none'; });
  document.querySelectorAll('[' + triggerAttr + ']').forEach(function(el){ clpSetPillActive(el, false); });
  if (!isOpen && body) {
    body.style.display = 'block';
    // A month can have two triggers pointing at it (the pill button and the
    // roadmap trail's flag) — restyle every match, not just the first.
    document.querySelectorAll('[' + triggerAttr + '="' + id + '"]').forEach(function(el){ clpSetPillActive(el, true); });
  }
  if (onOpen) onOpen(!isOpen);
}
function clpCloseGroup(bodyAttr, triggerAttr){
  document.querySelectorAll('[' + bodyAttr + ']').forEach(function(el){ el.style.display = 'none'; });
  if (triggerAttr) document.querySelectorAll('[' + triggerAttr + ']').forEach(function(el){ clpSetPillActive(el, false); });
}
function clpToggleMonth(id){ clpToggleGroup('data-month-trigger', 'data-month-body', id, function(){ clpCloseGroup('data-week-body', 'data-week-trigger'); clpCloseGroup('data-recipe-body'); clpCloseGroup('data-day-body'); clpCloseSlot(); }); }
function clpToggleWeek(id){ clpToggleGroup('data-week-trigger', 'data-week-body', id, function(){ clpCloseGroup('data-recipe-body'); clpCloseGroup('data-day-body'); clpCloseSlot(); }); }
function clpToggleRecipe(id){ clpToggleGroup('data-recipe-trigger', 'data-recipe-body', id); }
function clpToggleGroceryMonth(id){ clpToggleGroup('data-grocery-month-trigger', 'data-grocery-month-body', id, function(){ clpCloseGroup('data-grocery-week-body', 'data-grocery-week-trigger'); }); }
function clpToggleGroceryWeek(id){ clpToggleGroup('data-grocery-week-trigger', 'data-grocery-week-body', id); }

// ── day accordion (Sunday–Saturday, same week content per day) — rotates
// whichever chevron the trigger already rendered rather than swapping it,
// same trick used everywhere else a static icon needs to flip open/closed
// without React to re-render it ──
function clpToggleDay(id, btn){
  var body = document.querySelector('[data-day-body="' + id + '"]');
  if (!body) return;
  var isOpen = body.style.display === 'block';
  document.querySelectorAll('[data-day-body]').forEach(function(el){ el.style.display = 'none'; });
  document.querySelectorAll('[data-day-trigger] svg').forEach(function(el){ el.style.transform = ''; });
  if (!isOpen) {
    body.style.display = 'block';
    if (btn) { var icon = btn.querySelector('svg'); if (icon) icon.style.transform = 'rotate(90deg)'; }
  }
}
// ── meal-slot tiles → recipe grid for that slot, with a back button (not
// an accordion — the tile grid is replaced by the slot's detail, not
// expanded alongside it) ──
function clpOpenSlot(id){
  document.querySelectorAll('[data-slot-list]').forEach(function(el){ el.style.display = 'none'; });
  document.querySelectorAll('[data-slot-body]').forEach(function(el){ el.style.display = (el.getAttribute('data-slot-body') === id) ? 'block' : 'none'; });
}
function clpCloseSlot(){
  document.querySelectorAll('[data-slot-list]').forEach(function(el){ el.style.display = 'grid'; });
  document.querySelectorAll('[data-slot-body]').forEach(function(el){ el.style.display = 'none'; });
}

// ── accordion groups (faq/care) — same single-open-at-a-time behavior, no pill restyle ──
function clpToggleAccordion(triggerAttr, bodyAttr, id){
  var body = document.querySelector('[' + bodyAttr + '="' + id + '"]');
  var isOpen = body && body.style.display === 'block';
  document.querySelectorAll('[' + bodyAttr + ']').forEach(function(el){ el.style.display = 'none'; });
  document.querySelectorAll('[' + triggerAttr + '] svg').forEach(function(el){ el.style.transform = ''; });
  if (!isOpen && body) {
    body.style.display = 'block';
    var trig = document.querySelector('[' + triggerAttr + '="' + id + '"] svg');
    if (trig) trig.style.transform = 'rotate(90deg)';
  }
}
function clpToggleFaq(id){ clpToggleAccordion('data-faq-trigger', 'data-faq-body', id); }
function clpToggleCare(id){ clpToggleAccordion('data-care-trigger', 'data-care-body', id); }

// ── meal tab (always 3-way, one active) ──
function clpSetMealTab(meal){
  document.querySelectorAll('[data-meal-body]').forEach(function(el){
    el.style.display = (el.getAttribute('data-meal-body') === meal) ? 'block' : 'none';
  });
  document.querySelectorAll('[data-meal-trigger]').forEach(function(el){
    var active = el.getAttribute('data-meal-trigger') === meal;
    el.style.background = active ? '${C.accent}' : 'transparent';
    el.style.color = active ? '${C.onAccent}' : '${C.ink}';
    el.style.border = active ? 'none' : '1px solid ${C.border}';
  });
}

// ── grocery "bought" checklist — personal, localStorage only, same key/shape as the live page ──
function clpGetBought(){
  try { return JSON.parse(localStorage.getItem(CLP_GROCERY_KEY) || '[]'); } catch(e) { return []; }
}
function clpSetGroceryVisual(el, bought){
  var doneIcon = el.querySelector('[data-grocery-icon-done]');
  var undoneIcon = el.querySelector('[data-grocery-icon-undone]');
  var text = el.querySelector('[data-grocery-item-text]');
  if (doneIcon) doneIcon.style.display = bought ? 'inline-flex' : 'none';
  if (undoneIcon) undoneIcon.style.display = bought ? 'none' : 'inline-flex';
  if (text) { text.style.textDecoration = bought ? 'line-through' : 'none'; text.style.color = bought ? '${C.muted}' : '${C.inkSoft}'; }
}
function toggleGroceryItemExport(key, el){
  var list = clpGetBought();
  var idx = list.indexOf(key);
  var bought;
  if (idx >= 0) { list.splice(idx, 1); bought = false; }
  else { list.push(key); bought = true; }
  try { localStorage.setItem(CLP_GROCERY_KEY, JSON.stringify(list)); } catch(e){}
  clpSetGroceryVisual(el, bought);
}
function initGroceryExport(){
  var bought = clpGetBought();
  document.querySelectorAll('[data-grocery-item]').forEach(function(el){
    var key = el.getAttribute('data-grocery-item');
    clpSetGroceryVisual(el, bought.indexOf(key) !== -1);
  });
}

// Restarts a one-shot CSS keyframe animation reliably even on rapid repeat
// triggers — set the animation, force a reflow, browsers replay it cleanly
// from there. Used for the streak flame pop, which has no idle animation
// to return to afterward.
function clpPulse(el, animationCss){
  if (!el) return;
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = animationCss;
}
// The mascot's cheer is the same one-shot restart trick, but it has to
// hand control back to its own infinite idle bob once the cheer finishes —
// left alone, the one-shot keyframe would just hold at its end frame and
// the mascot would stop bobbing after the very first cheer.
function clpMascotCheer(){
  var el = document.querySelector('[data-mascot-idle]');
  if (!el) return;
  clpPulse(el, 'clpMascotCheer 0.7s ease');
  setTimeout(function(){ el.style.animation = 'clpMascotBob 3.2s ease-in-out infinite'; }, 700);
}

// ── goal check-off — personal, localStorage only, never synced back to the app ──
function clpSetGoalVisual(el, done){
  var doneIcon = el.querySelector('[data-goal-icon-done]');
  var undoneIcon = el.querySelector('[data-goal-icon-undone]');
  var text = el.querySelector('[data-goal-text]');
  if (doneIcon) doneIcon.style.display = done ? 'inline-flex' : 'none';
  if (undoneIcon) undoneIcon.style.display = done ? 'none' : 'inline-flex';
  if (text) { text.style.textDecoration = done ? 'line-through' : 'none'; text.style.color = done ? '${C.muted}' : '${C.inkSoft}'; }
  // Animated checkbox (draw-in tick), additive — no-ops for templates that
  // don't render these hooks.
  var checkTrack = el.querySelector('[data-goal-check-track]');
  var checkFill = el.querySelector('[data-goal-check-fill]');
  var checkTick = el.querySelector('[data-goal-check-tick]');
  if (checkTrack) checkTrack.style.stroke = checkTrack.getAttribute(done ? 'data-on-color' : 'data-off-color') || checkTrack.style.stroke;
  if (checkFill) checkFill.style.opacity = done ? '1' : '0';
  if (checkTick) checkTick.style.strokeDashoffset = done ? '0' : '16';
}
// key is "week:action:date" — date is that specific day-tab's own real
// calendar date (baked in at render time), not always today, so each day
// tracks independently instead of every day-row sharing one checkin.
function toggleGoalExport(key, el){
  var parts = key.split(':');
  var week = parseInt(parts[0], 10), action = parseInt(parts[1], 10), dateStr = parts[2];
  var list = clpGetCheckins();
  var idx = -1;
  for (var i = 0; i < list.length; i++) {
    if (list[i].week_number === week && list[i].action_index === action && list[i].checkin_date === dateStr) { idx = i; break; }
  }
  var done;
  if (idx >= 0) { list.splice(idx, 1); done = false; }
  else { list.push({ week_number: week, action_index: action, checkin_date: dateStr }); done = true; }
  clpSetCheckins(list);
  document.querySelectorAll('[data-goal-toggle="' + key + '"]').forEach(function(row){ clpSetGoalVisual(row, done); });
  // Brief mascot cheer + flame pop on a fresh check-off, never on uncheck —
  // no-ops for templates without these hooks.
  if (done) {
    clpMascotCheer();
    clpPulse(document.querySelector('[data-streak-flame]'), 'clpFlamePop 0.5s ease');
  }
  renderProgressExport();
}
function initGoalsExport(){
  var list = clpGetCheckins();
  var doneSet = {};
  list.forEach(function(c){ doneSet[c.week_number + ':' + c.action_index + ':' + c.checkin_date] = true; });
  document.querySelectorAll('[data-goal-toggle]').forEach(function(el){
    clpSetGoalVisual(el, !!doneSet[el.getAttribute('data-goal-toggle')]);
  });
}

// Re-drives the roadmap trail (fill length + each flag's color) from the
// same real per-month pct renderProgressExport just computed — a no-op if
// this template doesn't have the trail hooks. Colors are read back off each
// flag's own data-*-color attributes so this stays template-agnostic.
function clpUpdateTrail(monthPctList){
  var n = monthPctList.length;
  if (n < 1) return;
  var fillPath = document.querySelector('[data-trail-fill]');
  if (fillPath) {
    var len = fillPath.getTotalLength ? fillPath.getTotalLength() : 400;
    var avg = monthPctList.reduce(function(s, m){ return s + m.pct; }, 0) / (n * 100);
    fillPath.style.strokeDasharray = String(len);
    fillPath.style.strokeDashoffset = String(len - len * avg);
  }
  var activeIdx = -1;
  monthPctList.forEach(function(m, i){ if (activeIdx === -1 && m.pct < 100) activeIdx = i; });
  if (activeIdx === -1) activeIdx = n - 1;
  monthPctList.forEach(function(m, i){
    var flag = document.querySelector('[data-trail-flag="' + m.monthNumber + '"]');
    var circle = flag && flag.querySelector('circle');
    if (!flag || !circle) return;
    var done = m.pct >= 100;
    var isActive = i === activeIdx;
    var color = flag.getAttribute(done ? 'data-done-color' : isActive ? 'data-active-color' : 'data-upcoming-color');
    if (color) circle.style.fill = color;
  });
}

// Recomputes every number in "Track your progress" straight from the
// current checkin list — same derivation the live React page does, so a
// toggle anywhere in the downloaded file is reflected everywhere else in
// that same file, not just on the row that was clicked.
function renderProgressExport(){
  var list = clpGetCheckins();
  var dateSet = {};
  list.forEach(function(c){ dateSet[c.checkin_date] = true; });
  var streak = 0;
  var cursor = clpTodayISO();
  if (!dateSet[cursor]) cursor = clpShiftISO(cursor, -1);
  while (dateSet[cursor]) { streak++; cursor = clpShiftISO(cursor, -1); }
  var totalDaysLogged = Object.keys(dateSet).length;
  var doneKeySet = {};
  list.forEach(function(c){ doneKeySet[c.week_number + ':' + c.action_index] = true; });
  var goalsDone = Object.keys(doneKeySet).length;
  var totalActionsInPlan = 0;
  CLP_MONTHS.forEach(function(m){ m.weeks.forEach(function(w){ totalActionsInPlan += w.totalActions; }); });

  var bestPct = -1, bestLabel = '';
  var monthPctList = [];
  CLP_MONTHS.forEach(function(m){
    var total = 0, done = 0;
    m.weeks.forEach(function(w){
      total += w.totalActions;
      var wDone = 0;
      for (var i = 0; i < w.totalActions; i++) { if (doneKeySet[w.week_number + ':' + i]) wDone++; }
      done += wDone;
    });
    var pct = total > 0 ? Math.round((done / total) * 100) : 0;
    clpSetText('[data-stat-pct="' + m.monthNumber + '"]', pct + '%');
    clpSetText('[data-stat-sub="' + m.monthNumber + '"]', done + '/' + total + ' goals');
    if (done > 0 && pct > bestPct) { bestPct = pct; bestLabel = m.monthLabel; }
    monthPctList.push({ monthNumber: m.monthNumber, pct: pct });
  });
  clpUpdateTrail(monthPctList);

  clpSetText('[data-stat="streak"]', streak);
  // Streak flame lights up once there's a real streak — reads its own
  // on/off colors so the shared script never hardcodes a template's palette.
  var flame = document.querySelector('[data-streak-flame] path');
  if (flame) flame.style.fill = flame.getAttribute(streak > 0 ? 'data-on-color' : 'data-off-color') || flame.style.fill;
  clpSetText('[data-stat="days"]', totalDaysLogged);
  clpSetText('[data-stat="goals"]', goalsDone + '/' + totalActionsInPlan);
  clpSetText('[data-stat="best"]', bestPct >= 0 ? bestPct + '%' : '0%');
  clpSetText('[data-stat-label="best"]', bestPct >= 0 ? 'best month · ' + bestLabel : 'best month');
  var emptyEl = document.querySelector('[data-track-empty]');
  var contentEl = document.querySelector('[data-track-content]');
  if (emptyEl) emptyEl.style.display = totalDaysLogged === 0 ? 'block' : 'none';
  if (contentEl) contentEl.style.display = totalDaysLogged === 0 ? 'none' : 'block';

  var adherencePct = totalActionsInPlan > 0 ? Math.round((goalsDone / totalActionsInPlan) * 100) : 0;
  clpUpdateHero(adherencePct, goalsDone, totalActionsInPlan);
}

// Updates whichever hero centerpiece is present in this template's DOM
// (Almanac's growing tree, Pulse's adherence ring, or Onyx's signature bar)
// so it reflects the same real numbers "Track your progress" just did.
// Every selector is null-checked because only one of these three hooks
// exists in any given downloaded file — the other two are simply absent.
var CLP_GROWTH_LABELS = ['Just planted', 'First sprout', 'Taking root', 'Growing strong', 'In full bloom'];
function clpStageForPct(pct){ return pct >= 85 ? 4 : pct >= 60 ? 3 : pct >= 35 ? 2 : pct >= 10 ? 1 : 0; }
function clpUpdateHero(pct, goalsDone, totalActionsInPlan){
  document.querySelectorAll('[data-goals-done]').forEach(function(el){ el.textContent = goalsDone; });

  // Almanac: mascot's companion plant grows continuously with pct — same
  // stroke-dashoffset/opacity/scale transitions the live page uses, this
  // just re-drives them with the new value after an offline check-in.
  var stem = document.querySelector('[data-plant-stem]');
  if (stem) {
    var clamped = Math.max(0, Math.min(100, pct));
    var stemLen = 70;
    stem.style.strokeDashoffset = String(stemLen - (stemLen * clamped) / 100);
    var leaf1 = document.querySelector('[data-plant-leaf1]');
    var leaf2 = document.querySelector('[data-plant-leaf2]');
    var flowerEl = document.querySelector('[data-plant-flower]');
    if (leaf1) { var on1 = clamped >= 20; leaf1.style.opacity = on1 ? '1' : '0'; leaf1.style.transform = on1 ? 'scale(1)' : 'scale(0.4)'; }
    if (leaf2) { var on2 = clamped >= 50; leaf2.style.opacity = on2 ? '1' : '0'; leaf2.style.transform = on2 ? 'scale(1)' : 'scale(0.4)'; }
    if (flowerEl) { var on3 = clamped >= 85; flowerEl.style.opacity = on3 ? '1' : '0'; flowerEl.style.transform = on3 ? 'scale(1)' : 'scale(0.3)'; }
    var mouth = document.querySelector('[data-mascot-mouth]');
    if (mouth) mouth.setAttribute('d', clamped >= 85 ? 'M45 65 Q56 76 67 65' : (clamped > 0 ? 'M46 67 Q56 73 66 67' : 'M46 66 Q56 72 66 66'));
    var caption = document.querySelector('[data-growth-caption]');
    if (caption && totalActionsInPlan > 0) {
      caption.textContent = CLP_GROWTH_LABELS[clpStageForPct(pct)] + ' · ' + goalsDone + '/' + totalActionsInPlan + ' goals tracked';
    }
  }

  // Pulse: circular ring — read its own radius so the math always matches
  // however the circle was actually drawn, rather than hardcoding size.
  var ringFill = document.querySelector('[data-ring-fill]');
  if (ringFill) {
    var r = parseFloat(ringFill.getAttribute('r'));
    var circumference = 2 * Math.PI * r;
    ringFill.setAttribute('stroke-dasharray', String(circumference));
    ringFill.setAttribute('stroke-dashoffset', String(circumference * (1 - pct / 100)));
    var ringText = document.querySelector('[data-ring-pct-text]');
    if (ringText) ringText.textContent = pct + '%';
  }

  // Onyx: thin fill bar + position dot + large percentage
  var barFill = document.querySelector('[data-bar-fill]');
  if (barFill) {
    barFill.style.width = pct + '%';
    var barDot = document.querySelector('[data-bar-dot]');
    if (barDot) barDot.style.left = pct + '%';
    var pctText = document.querySelector('[data-pct-text]');
    if (pctText) pctText.textContent = pct;
  }
}

initGroceryExport();
initGoalsExport();
renderProgressExport();
`
}
