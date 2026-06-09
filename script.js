// ======================== State ========================
let state = {};

function defaultInnings() {
  return {
    runs: 0,
    wickets: 0,
    ballsInOver: 0,
    completedOvers: 0,
    extras: { wide: 0, noball: 0, bye: 0, legbye: 0 },
    ballHistory: [],
    batsmen: [],
    bowlers: [],
    strikerIdx: -1,
    nonStrikerIdx: -1,
    currentBowlerName: null,
    nextBatsmanOrder: 0,
  };
}

// ======================== Init ========================
function getPlayerNames(containerId) {
  const container = document.getElementById(containerId);
  const inputs = container.querySelectorAll('.player-name-input');
  return Array.from(inputs).map((input, i) => input.value.trim() || `Player ${i + 1}`);
}

function generatePlayerInputs() {
  const size = parseInt(document.getElementById('team-size').value);

  ['teamA-players-container', 'teamB-players-container'].forEach(containerId => {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    for (let i = 1; i <= size; i++) {
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = `Player ${i}`;
      input.value = `Player ${i}`;
      input.className = 'player-name-input';
      input.dataset.index = i - 1;
      container.appendChild(input);
    }
  });
}

function startMatch() {
  const tA = document.getElementById('teamA-name').value.trim() || 'Team A';
  const tB = document.getElementById('teamB-name').value.trim() || 'Team B';
  const overs = parseInt(document.getElementById('overs-limit').value);
  const teamSize = parseInt(document.getElementById('team-size').value);
  const wicketsLimit = teamSize - 1;

  const pA = getPlayerNames('teamA-players-container').slice(0, teamSize);
  const pB = getPlayerNames('teamB-players-container').slice(0, teamSize);

  if (pA.length < teamSize) { alert(`Team A needs ${teamSize} players for ${teamSize} vs ${teamSize}`); return; }
  if (pB.length < teamSize) { alert(`Team B needs ${teamSize} players for ${teamSize} vs ${teamSize}`); return; }

  state = {
    teamAName: tA,
    teamBName: tB,
    teamAPlayers: pA,
    teamBPlayers: pB,
    oversLimit: overs,
    teamSize: teamSize,
    wicketsLimit: wicketsLimit,
    tossWinner: null,
    battingFirst: null,
    currentInnings: 0,
    isInningsOver: false,
    innings: [null, null],
    undoStack: [],
    lastBallType: null,
  };

  document.getElementById('setup-screen').classList.add('hidden');
  showToss();
}

document.addEventListener('DOMContentLoaded', generatePlayerInputs);

function showToss() {
  document.getElementById('toss-info').textContent = 'Who won the toss?';
  document.getElementById('toss-teamA-btn').textContent = `${state.teamAName} won`;
  document.getElementById('toss-teamB-btn').textContent = `${state.teamBName} won`;
  document.getElementById('toss-screen').classList.remove('hidden');
}

function tossWon(teamIdx) {
  state.tossWinner = teamIdx;
  document.getElementById('toss-screen').classList.add('hidden');

  const winnerName = teamIdx === 0 ? state.teamAName : state.teamBName;
  document.getElementById('choose-title').textContent = `${winnerName} won the toss`;
  document.getElementById('choose-innings-screen').classList.remove('hidden');
}

function chooseBat() {
  const winner = state.tossWinner;
  state.battingFirst = winner;
  document.getElementById('choose-innings-screen').classList.add('hidden');
  initInnings();
}

function chooseBowl() {
  const winner = state.tossWinner;
  state.battingFirst = winner === 0 ? 1 : 0;
  document.getElementById('choose-innings-screen').classList.add('hidden');
  initInnings();
}

// ======================== Innings Setup ========================
function initInnings() {
  const idx = state.currentInnings;
  const inn = defaultInnings();
  const battingTeamIdx = idx === 0 ? state.battingFirst : (state.battingFirst === 0 ? 1 : 0);
  const bowlingTeamIdx = battingTeamIdx === 0 ? 1 : 0;

  const playerNames = battingTeamIdx === 0 ? state.teamAPlayers : state.teamBPlayers;
  const bowlerNames = bowlingTeamIdx === 0 ? state.teamAPlayers : state.teamBPlayers;

  inn.batsmen = playerNames.map((name, i) => ({
    name,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    dismissal: null,
    isOut: false,
    battingOrder: i,
  }));

  // First two batsmen are in
  inn.strikerIdx = 0;
  inn.nonStrikerIdx = 1;
  inn.nextBatsmanOrder = 2;

  // Set first bowler as first player from bowling team
  inn.currentBowlerName = bowlerNames[0];
  inn.bowlers = bowlerNames.map(name => ({
    name,
    balls: 0,
    runsConceded: 0,
    wickets: 0,
    extras: 0,
  }));

  state.innings[idx] = inn;
  state.isInningsOver = false;
  document.getElementById('scoring-screen').classList.remove('hidden');
  updateUI();
}

// ======================== Helpers ========================
function inn() { return state.innings[state.currentInnings]; }
function batTeamIdx() { return state.currentInnings === 0 ? state.battingFirst : (state.battingFirst === 0 ? 1 : 0); }
function bowlTeamIdx() { return batTeamIdx() === 0 ? 1 : 0; }

function getStriker() { const i = inn(); return i.batsmen[i.strikerIdx]; }
function getCurrentBowler() {
  const i = inn();
  return i.bowlers.find(b => b.name === i.currentBowlerName);
}

function getOversDisplay() {
  const i = inn();
  return `${i.completedOvers}.${i.ballsInOver}`;
}

function getRunRate(runs, totalBalls) {
  if (totalBalls === 0) return '0.00';
  return (runs / totalBalls * 6).toFixed(2);
}

function getTotalBalls() {
  const i = inn();
  return i.completedOvers * 6 + i.ballsInOver;
}

function getExtrasTotal() {
  const e = inn().extras;
  return e.wide + e.noball + e.bye + e.legbye;
}

function swapStrike() {
  const i = inn();
  [i.strikerIdx, i.nonStrikerIdx] = [i.nonStrikerIdx, i.strikerIdx];
  updateUI();
}

// Called by button
function switchStrike() {
  if (state.isInningsOver) return;
  swapStrike();
}

// ======================== Scoring ========================
function scoreRuns(runs) {
  if (state.isInningsOver) return;
  const i = inn();
  const bowler = getCurrentBowler();
  if (!bowler) { alert('Select a bowler first'); return; }

  saveUndoState();

  const striker = getStriker();
  striker.runs += runs;
  striker.balls++;
  if (runs === 4) striker.fours++;
  if (runs === 6) striker.sixes++;

  // Bowler stats
  bowler.runsConceded += runs;
  bowler.balls++;

  i.runs += runs;
  i.ballsInOver++;
  checkOverComplete();

  const isDot = runs === 0;
  const type = runs === 4 ? 'four' : runs === 6 ? 'six' : 'runs';
  const label = isDot ? 'Dot ball' : `${runs} run${runs > 1 ? 's' : ''}`;
  const ball = { type, label, runs, isExtra: false, batsman: striker.name, bowler: bowler.name };
  i.ballHistory.push(ball);
  state.lastBallType = type;

  showLastBall(ball);
  updateUI();

  // Swap strike on odd runs
  if (runs % 2 === 1) swapStrikeSilent();

  checkInningsEnd();
}

function scoreExtra(type) {
  if (state.isInningsOver) return;
  const i = inn();
  const bowler = getCurrentBowler();
  if (!bowler) { alert('Select a bowler first'); return; }

  saveUndoState();

  const labels = {
    wide: 'Wide ball',
    noball: 'No ball',
    bye: 'Bye',
    legbye: 'Leg bye',
  };

  const countsAsBall = type === 'bye' || type === 'legbye';
  const runsAdded = 1;

  i.extras[type] += runsAdded;
  i.runs += runsAdded;

  if (countsAsBall) {
    i.ballsInOver++;
    // Bye/Leg bye count as a ball for the bowler
    bowler.balls++;
    checkOverComplete();
  } else {
    // Wide/No ball: ball is not counted, but bowler concedes the run
    bowler.runsConceded += runsAdded;
    bowler.extras++;
  }

  const ball = {
    type,
    label: `${labels[type]} (+${runsAdded})`,
    runs: runsAdded,
    isExtra: true,
    batsman: getStriker().name,
    bowler: bowler.name,
  };
  i.ballHistory.push(ball);
  state.lastBallType = type;

  showLastBall(ball);
  updateUI();
  checkInningsEnd();
}

// Called by the wicket modal
function confirmWicket(outIdx, nextIdx) {
  wicketOutIdx = null;
  document.getElementById('wicket-modal').classList.add('hidden');

  if (state.isInningsOver) return;
  const i = inn();
  const bowler = getCurrentBowler();
  if (!bowler) return;

  saveUndoState();

  const outBatsman = i.batsmen[outIdx];
  outBatsman.isOut = true;
  outBatsman.dismissal = `b ${bowler.name}`;
  i.wickets++;
  bowler.wickets++;
  bowler.balls++;
  i.ballsInOver++;
  checkOverComplete();

  // New batsman comes in at the out batsman's position
  if (outIdx === i.strikerIdx) {
    i.strikerIdx = nextIdx;
  } else {
    i.nonStrikerIdx = nextIdx;
  }

  // Move nextBatsmanOrder past the new guy
  i.nextBatsmanOrder = Math.max(i.nextBatsmanOrder, nextIdx + 1);
  // Ensure nextBatsmanOrder is at least the next unused player
  while (i.nextBatsmanOrder < i.batsmen.length && i.batsmen[i.nextBatsmanOrder].isOut) {
    i.nextBatsmanOrder++;
  }

  const ball = {
    type: 'wicket',
    label: `WICKET! ${outBatsman.name} b ${bowler.name}`,
    runs: 0,
    isExtra: false,
    batsman: outBatsman.name,
    bowler: bowler.name,
  };
  i.ballHistory.push(ball);
  state.lastBallType = 'wicket';

  showLastBall(ball);
  updateUI();
  checkInningsEnd();
}

function selectWicketBatsman() {
  if (state.isInningsOver) return;
  const i = inn();
  if (!getCurrentBowler()) { alert('Select a bowler first'); return; }
  wicketOutIdx = null;

  const modal = document.getElementById('wicket-modal');

  // Who is out?
  const outChoices = document.getElementById('wicket-choices');
  outChoices.innerHTML = '';
  const candidates = [i.strikerIdx, i.nonStrikerIdx].filter(idx =>
    idx >= 0 && !i.batsmen[idx].isOut
  );
  candidates.forEach(idx => {
    const b = i.batsmen[idx];
    const btn = document.createElement('button');
    btn.className = 'modal-choice';
    btn.innerHTML = `<span>${b.name}</span><span class="mc-runs">${b.runs} (${b.balls})</span>`;
    btn.onclick = () => showNextBatsmanChoices(idx);
    outChoices.appendChild(btn);
  });

  document.getElementById('next-batsman-choices').innerHTML = '<p style="color:#64748b;">Select who is out first...</p>';

  modal.classList.remove('hidden');
}

let wicketOutIdx = null;

function showNextBatsmanChoices(outIdx) {
  wicketOutIdx = outIdx;
  const i = inn();
  const choices = document.getElementById('next-batsman-choices');
  choices.innerHTML = '<h3 style="margin-bottom:8px;">Next batsman</h3>';

  const available = i.batsmen.filter(b => !b.isOut && b !== i.batsmen[outIdx] && b !== i.batsmen[i.strikerIdx === outIdx ? i.nonStrikerIdx : i.strikerIdx]);

  if (available.length === 0) {
    choices.innerHTML = '<p style="color:#ef4444;">No more batsmen available! Innings ending.</p>';
    setTimeout(() => {
      document.getElementById('wicket-modal').classList.add('hidden');
      endInnings();
    }, 1500);
    return;
  }

  const backBtn = document.createElement('button');
  backBtn.className = 'btn-secondary';
  backBtn.textContent = 'Back';
  backBtn.style.marginBottom = '8px';
  backBtn.onclick = () => { wicketOutIdx = null; selectWicketBatsman(); };
  choices.appendChild(backBtn);

  available.forEach(b => {
    const btn = document.createElement('button');
    btn.className = 'modal-choice';
    btn.innerHTML = `<span>${b.name}</span><span class="mc-status">Order: ${b.battingOrder + 1}</span>`;
    btn.onclick = () => confirmWicket(outIdx, i.batsmen.indexOf(b));
    choices.appendChild(btn);
  });
}

// ======================== Over Logic ========================
function checkOverComplete() {
  const i = inn();
  if (i.ballsInOver >= 6) {
    i.completedOvers += Math.floor(i.ballsInOver / 6);
    i.ballsInOver = i.ballsInOver % 6;
    // Swap strike at end of over (if ballsInOver is now 0, over is complete)
    if (i.ballsInOver === 0 && i.strikerIdx >= 0 && i.nonStrikerIdx >= 0) {
      swapStrikeSilent();
    }
  }
}

function swapStrikeSilent() {
  const i = inn();
  [i.strikerIdx, i.nonStrikerIdx] = [i.nonStrikerIdx, i.strikerIdx];
}

// ======================== Bowler Select ========================
function showBowlerSelect() {
  if (state.isInningsOver) return;
  const i = inn();
  const modal = document.getElementById('bowler-modal');
  const choices = document.getElementById('bowler-choices');
  choices.innerHTML = '';

  i.bowlers.forEach(b => {
    const btn = document.createElement('button');
    btn.className = 'modal-choice';
    const figs = `${b.balls > 0 ? Math.floor(b.balls/6)+'.'+b.balls%6 : '0.0'}-${b.runsConceded}-${b.wickets}`;
    const isCurrent = b.name === i.currentBowlerName;
    btn.innerHTML = `<span>${b.name}${isCurrent ? ' ★' : ''}</span><span class="mc-runs">${figs}</span>`;
    btn.onclick = () => { i.currentBowlerName = b.name; closeBowlerSelect(); updateUI(); };
    choices.appendChild(btn);
  });

  modal.classList.remove('hidden');
}

function closeBowlerSelect() {
  document.getElementById('bowler-modal').classList.add('hidden');
}

function closeWicketModal() {
  wicketOutIdx = null;
  document.getElementById('wicket-modal').classList.add('hidden');
}

// ======================== Undo ========================
function saveUndoState() {
  const i = inn();
  state.undoStack.push({
    runs: i.runs,
    wickets: i.wickets,
    ballsInOver: i.ballsInOver,
    completedOvers: i.completedOvers,
    extras: { ...i.extras },
    strikerIdx: i.strikerIdx,
    nonStrikerIdx: i.nonStrikerIdx,
    currentBowlerName: i.currentBowlerName,
    nextBatsmanOrder: i.nextBatsmanOrder,
    batsmen: i.batsmen.map(b => ({ ...b })),
    bowlers: i.bowlers.map(b => ({ ...b })),
    ballHistory: [...i.ballHistory],
    lastBallType: state.lastBallType,
  });
  document.getElementById('undo-btn').disabled = false;
}

function undoLastBall() {
  if (state.undoStack.length === 0) return;

  document.getElementById('wicket-modal').classList.add('hidden');
  document.getElementById('bowler-modal').classList.add('hidden');

  const prev = state.undoStack.pop();
  const i = inn();

  i.runs = prev.runs;
  i.wickets = prev.wickets;
  i.ballsInOver = prev.ballsInOver;
  i.completedOvers = prev.completedOvers;
  i.extras = prev.extras;
  i.strikerIdx = prev.strikerIdx;
  i.nonStrikerIdx = prev.nonStrikerIdx;
  i.currentBowlerName = prev.currentBowlerName;
  i.nextBatsmanOrder = prev.nextBatsmanOrder;
  i.batsmen = prev.batsmen;
  i.bowlers = prev.bowlers;
  i.ballHistory = prev.ballHistory;
  state.lastBallType = prev.lastBallType;

  state.isInningsOver = false;

  document.getElementById('last-ball').classList.add('hidden');
  document.getElementById('last-ball').className = 'last-ball hidden';
  document.getElementById('undo-btn').disabled = state.undoStack.length === 0;
  document.getElementById('scoring-screen').classList.remove('hidden');
  document.getElementById('innings-switch-screen').classList.add('hidden');
  document.getElementById('result-screen').classList.add('hidden');
  updateUI();
}

// ======================== Innings End ========================
function checkInningsEnd() {
  const i = inn();
  const limit = state.oversLimit;
  if (i.wickets >= state.wicketsLimit || (i.completedOvers >= limit && limit < 999)) {
    endInnings();
  }
}

function confirmEndInnings() {
  if (state.isInningsOver) return;
  if (!confirm('End this innings?')) return;
  endInnings();
}

function endInnings() {
  if (state.isInningsOver) return;
  state.isInningsOver = true;
  updateUI();

  document.getElementById('wicket-modal').classList.add('hidden');
  document.getElementById('bowler-modal').classList.add('hidden');

  if (state.currentInnings === 0) {
    showInningsSwitch();
  } else {
    showMatchResult();
  }
}

function battingScorecardHTML(batsmen, extras) {
  let html = `<div class="scorecard-table">
    <div class="sc-header"><span>Batter</span><span>R</span><span>B</span><span>4s</span><span>6s</span><span>SR</span></div>`;
  batsmen.forEach(b => {
    const sr = b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '-';
    const dismiss = b.isOut && b.dismissal ? b.dismissal : b.isOut ? 'out' : null;
    const notOutMark = !b.isOut && (b.runs > 0 || b.balls > 0) ? '*' : '';
    html += `<div class="sc-row">
      <span class="sc-name">${b.name}${notOutMark}<span class="sc-dismiss">${dismiss ? ' ' + dismiss : ''}</span></span>
      <span class="sc-num">${b.runs}</span>
      <span class="sc-num">${b.balls}</span>
      <span class="sc-num">${b.fours}</span>
      <span class="sc-num">${b.sixes}</span>
      <span class="sc-num">${sr}</span>
    </div>`;
  });
  const extTotal = extras.wide + extras.noball + extras.bye + extras.legbye;
  html += `<div class="sc-extras-row">
    <span>Extras</span>
    <span class="sc-num">${extTotal}</span>
    <span class="sc-extra-detail">W:${extras.wide} NB:${extras.noball} B:${extras.bye} LB:${extras.legbye}</span>
  </div>`;
  html += '</div>';
  return html;
}

function bowlingScorecardHTML(bowlers) {
  let html = `<div class="scorecard-table">
    <div class="sc-header"><span>Bowler</span><span>O</span><span>R</span><span>W</span><span>Econ</span></div>`;
  const used = bowlers.filter(b => b.balls > 0);
  if (used.length === 0) {
    html += `<div class="sc-row"><span style="color:#64748b;">No bowling data</span></div>`;
  } else {
    used.forEach(b => {
      const ov = `${Math.floor(b.balls/6)}.${b.balls%6}`;
      const econ = b.balls > 0 ? (b.runsConceded / b.balls * 6).toFixed(2) : '0.00';
      html += `<div class="sc-row">
        <span class="sc-name">${b.name}</span>
        <span class="sc-num">${ov}</span>
        <span class="sc-num">${b.runsConceded}</span>
        <span class="sc-num">${b.wickets}</span>
        <span class="sc-num">${econ}</span>
      </div>`;
    });
  }
  html += '</div>';
  return html;
}

function showInningsSwitch() {
  document.getElementById('scoring-screen').classList.add('hidden');
  document.getElementById('innings-switch-screen').classList.remove('hidden');

  const i = inn();
  const batName = batTeamIdx() === 0 ? state.teamAName : state.teamBName;
  const overs = getOversDisplay();
  const rr = getRunRate(i.runs, getTotalBalls());
  const fours = i.ballHistory.filter(b => b.type === 'four').length;
  const sixes = i.ballHistory.filter(b => b.type === 'six').length;

  document.getElementById('innings-summary').innerHTML = `
    <div style="font-size:20px;font-weight:700;color:#4ade80;">${batName}</div>
    <div style="font-size:36px;font-weight:800;color:#e2e8f0;margin:8px 0;">${i.runs}/${i.wickets}</div>
    <div style="color:#94a3b8;">Overs: ${overs} | Run Rate: ${rr}</div>
    <div style="color:#94a3b8;font-size:13px;margin-top:4px;">${fours} fours, ${sixes} sixes, Extras: ${getExtrasTotal()}</div>
    <hr style="margin:16px 0;border-color:#334155;">
    <div style="text-align:left;margin-bottom:12px;">
      <div style="font-size:14px;font-weight:600;color:#94a3b8;margin-bottom:8px;">Batting Scorecard</div>
      ${battingScorecardHTML(i.batsmen, i.extras)}
    </div>
    <div style="text-align:left;margin-bottom:12px;">
      <div style="font-size:14px;font-weight:600;color:#94a3b8;margin-bottom:8px;">Bowling Figures</div>
      ${bowlingScorecardHTML(i.bowlers)}
    </div>
    <hr style="margin:16px 0;border-color:#334155;">
    <div style="color:#fbbf24;font-size:16px;font-weight:600;">Target: ${i.runs + 1} runs to win</div>
  `;
}

function startSecondInnings() {
  document.getElementById('innings-switch-screen').classList.add('hidden');
  state.currentInnings = 1;
  initInnings();
  updateUI();
}

// ======================== Match Result ========================
function showMatchResult() {
  document.getElementById('scoring-screen').classList.add('hidden');

  const inn0 = state.innings[0];
  const inn1 = state.innings[1];
  const team0 = state.battingFirst === 0 ? state.teamAName : state.teamBName;
  const team1 = state.battingFirst === 0 ? state.teamBName : state.teamAName;

  let winnerText = '';
  if (inn1.runs > inn0.runs) {
    const wktsLeft = state.wicketsLimit - inn1.wickets;
    winnerText = wktsLeft > 0 ? `${team1} won by ${wktsLeft} wicket${wktsLeft > 1 ? 's' : ''}` : `${team1} won (all out, but target chased)`;
  } else if (inn1.runs < inn0.runs) {
    const by = inn0.runs - inn1.runs;
    winnerText = `${team0} won by ${by} run${by > 1 ? 's' : ''}`;
  } else {
    winnerText = 'Match Tied';
  }

  const inn0Overs = `${inn0.completedOvers}.${inn0.ballsInOver}`;
  const inn1Overs = `${inn1.completedOvers}.${inn1.ballsInOver}`;
  const inn0RR = getRunRate(inn0.runs, inn0.completedOvers*6+inn0.ballsInOver);
  const inn1RR = getRunRate(inn1.runs, inn1.completedOvers*6+inn1.ballsInOver);

  document.getElementById('result-content').innerHTML = `
    <div class="winner">${winnerText}</div>

    <div class="inns-result-block">
      <div style="font-weight:700;color:#4ade80;">${team0} — 1st Innings</div>
      <div style="font-size:26px;font-weight:800;color:#e2e8f0;margin:4px 0;">${inn0.runs}/${inn0.wickets}</div>
      <div style="font-size:12px;color:#94a3b8;margin-bottom:8px;">Overs: ${inn0Overs} | RR: ${inn0RR}</div>
      ${battingScorecardHTML(inn0.batsmen, inn0.extras)}
      ${bowlingScorecardHTML(inn0.bowlers)}
    </div>

    <div class="inns-result-block">
      <div style="font-weight:700;color:#fbbf24;">${team1} — 2nd Innings</div>
      <div style="font-size:26px;font-weight:800;color:#e2e8f0;margin:4px 0;">${inn1.runs}/${inn1.wickets}</div>
      <div style="font-size:12px;color:#94a3b8;margin-bottom:8px;">Overs: ${inn1Overs} | RR: ${inn1RR}</div>
      ${battingScorecardHTML(inn1.batsmen, inn1.extras)}
      ${bowlingScorecardHTML(inn1.bowlers)}
    </div>
  `;

  document.getElementById('result-screen').classList.remove('hidden');
  saveToHistory();
}

// ======================== Last Ball Animation ========================
function showLastBall(ball) {
  const el = document.getElementById('last-ball');
  el.className = 'last-ball';

  if (ball.type === 'wicket') {
    el.classList.add('wicket');
    el.textContent = ball.label;
  } else if (ball.type === 'four') {
    el.classList.add('four');
    el.textContent = 'FOUR! ' + ball.label;
  } else if (ball.type === 'six') {
    el.classList.add('six');
    el.textContent = 'SIX! ' + ball.label;
  } else if (ball.isExtra) {
    el.classList.add(ball.type);
    el.textContent = ball.label;
  } else if (ball.runs === 0) {
    el.classList.add('runs');
    el.textContent = 'Dot ball';
  } else {
    el.classList.add('runs');
    el.textContent = `${ball.runs} run${ball.runs > 1 ? 's' : ''}`;
  }

  el.classList.remove('hidden');
  el.style.animation = 'none';
  void el.offsetHeight;
  el.style.animation = 'fadeIn 0.3s ease';
}

// ======================== UI Update ========================
function updateUI() {
  const i = inn();
  if (!i) return;

  const batName = batTeamIdx() === 0 ? state.teamAName : state.teamBName;
  const bowlName = bowlTeamIdx() === 0 ? state.teamAName : state.teamBName;

  document.getElementById('match-title').textContent = `${state.teamAName} vs ${state.teamBName}`;
  document.getElementById('innings-label').textContent =
    state.isInningsOver ? 'Innings Complete' :
    state.currentInnings === 0 ? '1st Innings' : '2nd Innings';
  document.getElementById('innings-label').style.color = state.isInningsOver ? '#fbbf24' : '#94a3b8';

  document.getElementById('score-display').textContent = `${i.runs}/${i.wickets}`;
  document.getElementById('overs-display').textContent = getOversDisplay();
  const totalBalls = getTotalBalls();
  document.getElementById('run-rate').textContent = getRunRate(i.runs, totalBalls);
  document.getElementById('batting-name').textContent = batName;
  document.getElementById('bowling-name').textContent = bowlName;

  // Target display for 2nd innings
  const targetEl = document.getElementById('target-display');
  if (state.currentInnings === 1) {
    const inn0 = state.innings[0];
    const target = inn0.runs + 1;
    const needed = target - i.runs;
    if (state.isInningsOver) {
      targetEl.textContent = '';
    } else {
      targetEl.textContent = `Target: ${target} | Need ${needed} to win`;
    }
    // Required run rate
    const remainingBalls = Math.max(0, state.oversLimit * 6 - totalBalls);
    const reqEl = document.getElementById('req-run-rate');
    if (remainingBalls > 0 && !state.isInningsOver) {
      reqEl.textContent = getRunRate(Math.max(0, target - i.runs), remainingBalls);
    } else {
      reqEl.textContent = '-';
    }
  } else {
    targetEl.textContent = '';
    document.getElementById('req-run-rate').textContent = '-';
  }

  // Extras
  document.getElementById('extras-wide').textContent = i.extras.wide;
  document.getElementById('extras-noball').textContent = i.extras.noball;
  document.getElementById('extras-bye').textContent = i.extras.bye;
  document.getElementById('extras-legbye').textContent = i.extras.legbye;
  document.getElementById('extras-total').textContent = getExtrasTotal();
  const pen = i.extras.wide + i.extras.noball;
  document.getElementById('extras-penalty').textContent = pen;

  renderBatsmenCards();
  renderBowlerCard();
  renderBowlingTable();
  renderBallHistory();
}

// ======================== Batsmen Cards ========================
function renderBatsmenCards() {
  const container = document.getElementById('batsmen-cards');
  const i = inn();
  let html = '';

  i.batsmen.forEach((b, idx) => {
    let cls = 'player-card';
    let tag = '';
    let nameLabel = b.name;

    if (b.isOut) {
      cls += ' out';
      tag = '<span class="pc-status-tag">OUT</span>';
    } else if (idx === i.strikerIdx) {
      cls += ' active';
      tag = '<span class="pc-status-tag">STRIKER</span>';
      nameLabel = b.name + ' <span class="pc-strike">*</span>';
    } else if (idx === i.nonStrikerIdx) {
      cls += ' active';
      tag = '<span class="pc-status-tag">NON-STRIKER</span>';
    } else if (idx < i.nextBatsmanOrder) {
      cls += ' coming';
      tag = '<span class="pc-status-tag">DONE</span>';
    } else {
      tag = '<span class="pc-status-tag">COMING</span>';
    }

    if (b.isOut) {
      const sr = b.balls > 0 ? (b.runs / b.balls * 100).toFixed(0) : '-';
      html += `<div class="${cls}">
        ${tag}
        <div class="pc-name">${nameLabel}</div>
        <div class="pc-stats"><em>${b.runs}</em> (${b.balls}b, ${b.fours}x4, ${b.sixes}x6) SR: ${sr}</div>
        ${b.dismissal ? `<div style="font-size:10px;color:#f87171;margin-top:3px;">${b.dismissal}</div>` : ''}
      </div>`;
    } else if (idx === i.strikerIdx || idx === i.nonStrikerIdx) {
      html += `<div class="${cls}">
        ${tag}
        <div class="pc-name">${nameLabel}</div>
        <div class="pc-stats"><em>${b.runs}</em> (${b.balls}b)</div>
      </div>`;
    } else {
      html += `<div class="${cls}" onclick="${idx >= i.nextBatsmanOrder ? `sendInBatsman(${idx})` : ''}" style="${idx >= i.nextBatsmanOrder ? 'cursor:pointer;' : ''}">
        ${tag}
        <div class="pc-name">${nameLabel}</div>
      </div>`;
    }
  });

  container.innerHTML = html;
}

function sendInBatsman(idx) {
  if (state.isInningsOver) return;
  const i = inn();
  i.nextBatsmanOrder = Math.max(i.nextBatsmanOrder, idx + 1);
  updateUI();
}

// ======================== Bowler Card ========================
function renderBowlerCard() {
  const container = document.getElementById('bowler-card');
  const i = inn();
  const bowler = getCurrentBowler();

  if (!bowler) {
    container.innerHTML = '<div class="player-card" onclick="showBowlerSelect()" style="cursor:pointer;"><div class="pc-name" style="color:#f97316;">Select Bowler</div></div>';
    return;
  }

  const ov = bowler.balls > 0 ? `${Math.floor(bowler.balls/6)}.${bowler.balls%6}` : '0.0';
  const econ = bowler.balls > 0 ? (bowler.runsConceded / bowler.balls * 6).toFixed(2) : '0.00';

  container.innerHTML = `<div class="player-card bowler-card" onclick="showBowlerSelect()" style="cursor:pointer;">
    <div class="pc-name">${bowler.name} ★</div>
    <div class="pc-stats"><em>${bowler.wickets}/${bowler.runsConceded}</em> (${ov} ov, Econ: ${econ})</div>
  </div>`;
}

// ======================== Bowling Table ========================
function renderBowlingTable() {
  const container = document.getElementById('bowling-table');
  const i = inn();
  const usedBowlers = i.bowlers.filter(b => b.balls > 0 || b.name === i.currentBowlerName);

  if (usedBowlers.length === 0) {
    container.innerHTML = '<div style="color:#475569;font-size:12px;text-align:center;padding:8px;">No bowling data yet.</div>';
    return;
  }

  let html = `<table style="width:100%;"><tr>
    <th>Bowler</th><th>Overs</th><th>Runs</th><th>Wkts</th><th>Econ</th><th>Ext</th>
  </tr>`;

  usedBowlers.forEach(b => {
    const ov = b.balls > 0 ? `${Math.floor(b.balls/6)}.${b.balls%6}` : '0.0';
    const econ = b.balls > 0 ? (b.runsConceded / b.balls * 6).toFixed(2) : '0.00';
    const isCurrent = b.name === i.currentBowlerName;
    html += `<tr>
      <td class="bt-name ${isCurrent ? 'bt-current' : ''}">${b.name}${isCurrent ? ' ★' : ''}</td>
      <td class="bt-fig">${ov}</td>
      <td class="bt-fig">${b.runsConceded}</td>
      <td class="bt-fig">${b.wickets}</td>
      <td class="bt-fig">${econ}</td>
      <td class="bt-fig">${b.extras}</td>
    </tr>`;
  });

  html += '</table>';
  container.innerHTML = html;
}

// ======================== Ball History ========================
function renderBallHistory() {
  const log = document.getElementById('ball-log');
  const i = inn();
  if (i.ballHistory.length === 0) {
    log.innerHTML = '<p class="empty-msg">No balls bowled yet.</p>';
    return;
  }

  let html = '';
  let ballNum = 0;
  let overNum = 0;

  i.ballHistory.forEach(b => {
    ballNum++;
    if (ballNum > 6) { overNum++; ballNum = 1; }

    let cls = 'ball-entry';
    let runsText = '';

    if (b.type === 'wicket') { cls += ' wicket-ball'; runsText = 'W'; }
    else if (b.type === 'four') { cls += ' four-ball'; runsText = '4'; }
    else if (b.type === 'six') { cls += ' six-ball'; runsText = '6'; }
    else if (b.isExtra) { cls += ' extra-ball'; runsText = '+1'; }
    else if (b.runs === 0) { runsText = '0'; }
    else { runsText = b.runs.toString(); }

    html += `<div class="${cls}">
      <span class="over-num">${overNum}.${ballNum}</span>
      <span class="ball-desc">${b.label}</span>
      <span class="ball-runs">${runsText}</span>
    </div>`;
  });

  log.innerHTML = html;
  log.scrollTop = log.scrollHeight;
}

// ======================== Reset ========================
function confirmReset() {
  const i = inn();
  if (i && i.ballHistory.length === 0) return;
  if (!confirm('Reset this match? All current data will be lost.')) return;

  document.getElementById('wicket-modal').classList.add('hidden');
  document.getElementById('bowler-modal').classList.add('hidden');
  document.getElementById('last-ball').classList.add('hidden');
  document.getElementById('last-ball').className = 'last-ball hidden';

  document.getElementById('scoring-screen').classList.add('hidden');
  document.getElementById('innings-switch-screen').classList.add('hidden');
  document.getElementById('result-screen').classList.add('hidden');

  state.innings = [null, null];
  state.currentInnings = 0;
  state.isInningsOver = false;
  state.undoStack = [];
  state.lastBallType = null;

  generatePlayerInputs();

  document.getElementById('setup-screen').classList.remove('hidden');
}

// ======================== New Match ========================
function newMatch() {
  generatePlayerInputs();
  document.getElementById('result-screen').classList.add('hidden');
  document.getElementById('innings-switch-screen').classList.add('hidden');
  document.getElementById('choose-innings-screen').classList.add('hidden');
  document.getElementById('toss-screen').classList.add('hidden');
  document.getElementById('scoring-screen').classList.add('hidden');
  document.getElementById('setup-screen').classList.remove('hidden');
}

function backToSetup() {
  newMatch();
}

// ======================== History (localStorage) ========================
function saveToHistory() {
  const history = getHistory();
  const inn0 = state.innings[0];
  const inn1 = state.innings[1];
  const team0 = state.battingFirst === 0 ? state.teamAName : state.teamBName;
  const team1 = state.battingFirst === 0 ? state.teamBName : state.teamAName;

  let result;
  if (inn1 && inn1.runs > inn0.runs) {
    const wktsLeft = state.wicketsLimit - inn1.wickets;
    result = wktsLeft > 0 ? `${team1} won by ${wktsLeft} wicket${wktsLeft > 1 ? 's' : ''}` : `${team1} won`;
  } else if (inn1 && inn1.runs < inn0.runs) {
    result = `${team0} won by ${inn0.runs - inn1.runs} run${inn0.runs - inn1.runs > 1 ? 's' : ''}`;
  } else if (inn1 && inn1.runs === inn0.runs) {
    result = 'Match Tied';
  } else {
    result = 'Innings Complete';
  }

  const entry = {
    id: Date.now(),
    date: new Date().toLocaleString(),
    teamA: state.teamAName,
    teamB: state.teamBName,
    team0, team1,
    inn0: {
      runs: inn0.runs, wickets: inn0.wickets,
      overs: `${inn0.completedOvers}.${inn0.ballsInOver}`,
      batsmen: inn0.batsmen.map(b => ({ name: b.name, runs: b.runs, balls: b.balls, fours: b.fours, sixes: b.sixes, dismissal: b.dismissal, isOut: b.isOut })),
      bowlers: inn0.bowlers.filter(b => b.balls > 0).map(b => ({ name: b.name, balls: b.balls, runsConceded: b.runsConceded, wickets: b.wickets })),
      extras: { ...inn0.extras },
    },
    inn1: inn1 ? {
      runs: inn1.runs, wickets: inn1.wickets,
      overs: `${inn1.completedOvers}.${inn1.ballsInOver}`,
      batsmen: inn1.batsmen.map(b => ({ name: b.name, runs: b.runs, balls: b.balls, fours: b.fours, sixes: b.sixes, dismissal: b.dismissal, isOut: b.isOut })),
      bowlers: inn1.bowlers.filter(b => b.balls > 0).map(b => ({ name: b.name, balls: b.balls, runsConceded: b.runsConceded, wickets: b.wickets })),
      extras: { ...inn1.extras },
    } : null,
    result,
    oversLimit: state.oversLimit,
    wicketsLimit: state.wicketsLimit,
    teamSize: state.teamSize,
  };
  history.push(entry);
  localStorage.setItem('cricketHistory', JSON.stringify(history));
}

function getHistory() {
  try { return JSON.parse(localStorage.getItem('cricketHistory')) || []; }
  catch { return []; }
}

function showHistory() {
  document.getElementById('setup-screen').classList.add('hidden');
  document.getElementById('scoring-screen').classList.add('hidden');
  document.getElementById('result-screen').classList.add('hidden');
  document.getElementById('innings-switch-screen').classList.add('hidden');
  document.getElementById('choose-innings-screen').classList.add('hidden');
  document.getElementById('toss-screen').classList.add('hidden');
  document.getElementById('history-screen').classList.remove('hidden');

  const list = document.getElementById('match-history-list');
  const history = getHistory();

  if (history.length === 0) {
    list.innerHTML = '<p style="text-align:center;color:#475569;padding:40px;">No matches recorded yet.</p>';
    return;
  }

  let html = '';
  history.slice().reverse().forEach(h => {
    html += `<div class="history-item" onclick="viewMatch(${h.id})">
      <div class="hi-teams">${h.teamA} vs ${h.teamB}</div>
      <div class="hi-score">${h.team0}: ${h.inn0.runs}/${h.inn0.wickets} (${h.inn0.overs})${h.inn1 ? ` | ${h.team1}: ${h.inn1.runs}/${h.inn1.wickets} (${h.inn1.overs})` : ''}</div>
      <div class="hi-result">${h.result}</div>
      <div class="hi-date">${h.date}</div>
    </div>`;
  });

  list.innerHTML = html;
}

function viewMatch(id) {
  const history = getHistory();
  const h = history.find(m => m.id === id);
  if (!h) return;

  document.getElementById('result-content').innerHTML = `
    <div class="winner">${h.result}</div>
    <div style="font-size:13px;color:#94a3b8;margin-bottom:8px;">${h.teamA} vs ${h.teamB}</div>

    <div class="inns-result-block">
      <div style="font-weight:700;color:#4ade80;">${h.team0}</div>
      <div style="font-size:24px;font-weight:800;color:#e2e8f0;margin:4px 0;">${h.inn0.runs}/${h.inn0.wickets}</div>
      <div style="font-size:12px;color:#94a3b8;margin-bottom:6px;">Overs: ${h.inn0.overs}</div>
      ${h.inn0.batsmen ? battingScorecardHTML(h.inn0.batsmen, h.inn0.extras || { wide:0, noball:0, bye:0, legbye:0 }) : ''}
      ${h.inn0.bowlers ? '<div style="margin-top:6px;">' + bowlingScorecardHTML(h.inn0.bowlers) + '</div>' : ''}
    </div>

    ${h.inn1 ? `
    <div class="inns-result-block">
      <div style="font-weight:700;color:#fbbf24;">${h.team1}</div>
      <div style="font-size:24px;font-weight:800;color:#e2e8f0;margin:4px 0;">${h.inn1.runs}/${h.inn1.wickets}</div>
      <div style="font-size:12px;color:#94a3b8;margin-bottom:6px;">Overs: ${h.inn1.overs}</div>
      ${h.inn1.batsmen ? battingScorecardHTML(h.inn1.batsmen, h.inn1.extras || { wide:0, noball:0, bye:0, legbye:0 }) : ''}
      ${h.inn1.bowlers ? '<div style="margin-top:6px;">' + bowlingScorecardHTML(h.inn1.bowlers) + '</div>' : ''}
    </div>` : ''}

    <div style="font-size:11px;color:#475569;margin-top:8px;">${h.date}</div>
  `;

  document.getElementById('history-screen').classList.add('hidden');
  document.getElementById('result-screen').classList.remove('hidden');
}

function clearAllHistory() {
  if (!confirm('Delete all match history? This cannot be undone.')) return;
  localStorage.removeItem('cricketHistory');
  showHistory();
}

// ======================== Keyboard Shortcuts ========================
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
  const scoringHidden = document.getElementById('scoring-screen').classList.contains('hidden');
  if (scoringHidden) return;

  const keyMap = {
    '0': () => scoreRuns(0),
    '1': () => scoreRuns(1),
    '2': () => scoreRuns(2),
    '3': () => scoreRuns(3),
    '4': () => scoreRuns(4),
    '6': () => scoreRuns(6),
    'w': () => scoreExtra('wide'),
    'n': () => scoreExtra('noball'),
    'b': () => scoreExtra('bye'),
    'l': () => scoreExtra('legbye'),
    'W': () => selectWicketBatsman(),
    'z': () => undoLastBall(),
    'r': () => confirmReset(),
    's': () => switchStrike(),
    'c': () => showBowlerSelect(),
  };

  if (keyMap[e.key]) {
    e.preventDefault();
    keyMap[e.key]();
  }
});

// ======================== PWA / Service Worker ========================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
