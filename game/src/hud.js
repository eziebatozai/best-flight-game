import { AIRSTRIPS, VOLCANO_POS } from './world.js';

function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

/**
 * Core flight telemetry HUD, heading compass tape with hostile bearing bug,
 * chase-view mini-attitude + combat radar, mission selector, and Combat + Courier debrief panels.
 */
export function createHud({ onSelectMission, onLaunch, onRetry, onNextMission, onMenu }) {
  const compassCanvas = document.getElementById('compass-canvas');
  const compassCtx = compassCanvas.getContext('2d');
  const hdgReadout = document.getElementById('hdg-readout');

  const objText = document.getElementById('obj-text');
  const objRings = document.getElementById('obj-rings');
  const objHostiles = document.getElementById('obj-hostiles');
  const objDist = document.getElementById('obj-dist');
  const objTimer = document.getElementById('obj-timer');

  const valSpd = document.getElementById('val-spd');
  const valThrPct = document.getElementById('val-thr-pct');
  const barThr = document.getElementById('bar-thr');
  const valFlaps = document.getElementById('val-flaps');
  const valView = document.getElementById('val-view');
  const valWind = document.getElementById('val-wind');

  const valAlt = document.getElementById('val-alt');
  const valVsi = document.getElementById('val-vsi');
  const valFuelPct = document.getElementById('val-fuel-pct');
  const barFuel = document.getElementById('bar-fuel');
  const valHullPct = document.getElementById('val-hull-pct');
  const barHull = document.getElementById('bar-hull');

  const instrumentsBox = document.getElementById('hud-instruments');
  const miniAttCanvas = document.getElementById('mini-attitude');
  const miniAttCtx = miniAttCanvas.getContext('2d');
  const miniRadCanvas = document.getElementById('mini-radar');
  const miniRadCtx = miniRadCanvas.getContext('2d');

  const alertsContainer = document.getElementById('flight-alerts');
  const titleOverlay = document.getElementById('title-overlay');
  const missionListEl = document.getElementById('mission-list');
  const resultOverlay = document.getElementById('result-overlay');
  const resultKicker = document.getElementById('result-kicker');
  const resultTitle = document.getElementById('result-title');
  const resultSubtitle = document.getElementById('result-subtitle');
  const resultScores = document.getElementById('result-scores');
  const btnNext = document.getElementById('btn-next');
  const srStatus = document.getElementById('sr-status');

  document.getElementById('btn-launch').addEventListener('click', onLaunch);
  document.getElementById('btn-retry').addEventListener('click', onRetry);
  btnNext.addEventListener('click', onNextMission);
  document.getElementById('btn-menu').addEventListener('click', onMenu);

  let transientAlert = null;
  let transientTimer = 0;

  function pushAlert(text, tone = 'info', duration = 2.4) {
    transientAlert = { text, tone };
    transientTimer = duration;
    srStatus.textContent = text;
  }

  function renderMissionCards(missions, selectedIdx) {
    missionListEl.innerHTML = '';
    missions.forEach((m, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `mission-card${idx === selectedIdx ? ' selected' : ''}`;
      btn.innerHTML = `
        <div class="mission-card-head">
          <span>${idx + 1}. ${m.name}</span>
          <span class="mission-diff">${m.difficulty}</span>
        </div>
        <div class="mission-desc">${m.description}</div>
      `;
      btn.addEventListener('click', () => onSelectMission(idx));
      missionListEl.appendChild(btn);
    });
  }

  function drawCompass(headingDeg, targetBearingDeg, enemyBearingDeg) {
    const ctx = compassCtx;
    const W = compassCanvas.width;
    const H = compassCanvas.height;
    ctx.clearRect(0, 0, W, H);

    const pxPerDeg = 3.2;
    const center = W * 0.5;
    const cardinals = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };

    ctx.strokeStyle = 'rgba(200, 224, 240, 0.55)';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';

    const startDeg = Math.floor((headingDeg - 65) / 5) * 5;
    for (let d = startDeg; d <= headingDeg + 65; d += 5) {
      const norm = ((d % 360) + 360) % 360;
      const x = center + (d - headingDeg) * pxPerDeg;
      if (x < 4 || x > W - 4) continue;
      const major = norm % 15 === 0;
      ctx.lineWidth = major ? 1.8 : 1;
      ctx.beginPath();
      ctx.moveTo(x, H - 2);
      ctx.lineTo(x, H - (major ? 12 : 7));
      ctx.stroke();

      if (cardinals[norm]) {
        ctx.fillStyle = norm % 90 === 0 ? '#ffd36b' : '#9ed4e8';
        ctx.fillText(cardinals[norm], x, H - 10);
      } else if (norm % 30 === 0) {
        ctx.fillStyle = '#cbe0ee';
        ctx.fillText(String(norm).padStart(3, '0'), x, H - 10);
      }
    }

    // Cyan courier waypoint diamond bug
    const wpDiff = ((targetBearingDeg - headingDeg + 540) % 360) - 180;
    const bx = Math.max(12, Math.min(W - 12, center + wpDiff * pxPerDeg));
    ctx.fillStyle = '#4fe3d8';
    ctx.beginPath();
    ctx.moveTo(bx, H - 2);
    ctx.lineTo(bx + 6, H - 10);
    ctx.lineTo(bx, H - 18);
    ctx.lineTo(bx - 6, H - 10);
    ctx.closePath();
    ctx.fill();

    // Crimson locked-hostile bearing bug
    if (enemyBearingDeg !== null && enemyBearingDeg !== undefined) {
      const eDiff = ((enemyBearingDeg - headingDeg + 540) % 360) - 180;
      const ex = Math.max(12, Math.min(W - 12, center + eDiff * pxPerDeg));
      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.moveTo(ex, H - 18);
      ctx.lineTo(ex + 6, H - 7);
      ctx.lineTo(ex - 6, H - 7);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawMiniAttitude(pitchRad, rollRad) {
    const ctx = miniAttCtx;
    const W = miniAttCanvas.width;
    const H = miniAttCanvas.height;
    const cx = W * 0.5;
    const cy = H * 0.5;
    const r = 46;

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rollRad);
    const py = Math.max(-36, Math.min(36, pitchRad * 65));
    ctx.fillStyle = '#1e78be';
    ctx.fillRect(-80, -90 + py, 160, 90);
    ctx.fillStyle = '#754623';
    ctx.fillRect(-80, py, 160, 90);
    ctx.strokeStyle = '#fff5dc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-60, py);
    ctx.lineTo(60, py);
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = '#ffd36b';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(cx - 22, cy);
    ctx.lineTo(cx - 6, cy);
    ctx.lineTo(cx - 6, cy + 4);
    ctx.moveTo(cx + 22, cy);
    ctx.lineTo(cx + 6, cy);
    ctx.lineTo(cx + 6, cy + 4);
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = 'rgba(247, 183, 51, 0.72)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawMiniRadar(telemetry, enemiesList) {
    const ctx = miniRadCtx;
    const W = miniRadCanvas.width;
    const H = miniRadCanvas.height;
    const cx = W * 0.5;
    const cy = H * 0.54;
    const scale = 0.038;

    ctx.fillStyle = '#071722';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(79, 227, 216, 0.24)';
    ctx.lineWidth = 1;
    for (const r of [20, 42]) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    const cos = Math.cos(telemetry.headingRad);
    const sin = Math.sin(telemetry.headingRad);
    const toPt = (wx, wz) => {
      const dx = wx - telemetry.pos.x;
      const dz = wz - telemetry.pos.z;
      return [cx + (dx * cos + dz * sin) * scale, cy + (-dx * sin + dz * cos) * scale];
    };

    const [vx, vy] = toPt(VOLCANO_POS.x, VOLCANO_POS.z);
    ctx.fillStyle = 'rgba(255, 114, 58, 0.45)';
    ctx.beginPath();
    ctx.arc(vx, vy, 8, 0, Math.PI * 2);
    ctx.fill();

    for (const s of AIRSTRIPS) {
      const [sx, sy] = toPt(s.x, s.z);
      ctx.fillStyle = s.id === telemetry.destRunwayId ? '#3ee08e' : '#7ec5d9';
      ctx.fillRect(sx - 3, sy - 3, 6, 6);
    }

    if (telemetry.targetPos) {
      const [tx, ty] = toPt(telemetry.targetPos.x, telemetry.targetPos.z);
      ctx.strokeStyle = 'rgba(255, 211, 107, 0.65)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#ffd36b';
      ctx.beginPath();
      ctx.arc(tx, ty, 3.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hostile red triangles & pulsing crimson-gold boss diamond on chase combat radar
    if (enemiesList) {
      for (const e of enemiesList) {
        const [ex, ey] = toPt(e.pos.x, e.pos.z);
        if (e.isBoss) {
          ctx.fillStyle = '#ff3838';
          ctx.strokeStyle = '#ffd356';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(ex, ey - 6);
          ctx.lineTo(ex + 6, ey);
          ctx.lineTo(ex, ey + 6);
          ctx.lineTo(ex - 6, ey);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillStyle = '#ff4444';
          ctx.beginPath();
          ctx.moveTo(ex, ey - 4.8);
          ctx.lineTo(ex + 4.4, ey + 3.6);
          ctx.lineTo(ex - 4.4, ey + 3.6);
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 6);
    ctx.lineTo(cx + 5, cy + 5);
    ctx.lineTo(cx - 5, cy + 5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#4fe3d8';
    ctx.font = 'bold 9px monospace';
    ctx.fillText('COMBAT RADAR', 6, 12);
  }

  function showTitle(visible) {
    titleOverlay.classList.toggle('hidden', !visible);
    document.body.classList.toggle('title-open', visible);
  }

  function showLandingResult(score) {
    resultOverlay.classList.remove('hidden', 'crash');
    resultKicker.textContent = 'STORM INTERCEPTOR SORTIE DEBRIEF';
    resultTitle.innerHTML = `MISSION COMPLETE <span class="rank-badge">${score.rank}</span>`;
    resultSubtitle.textContent = `${score.grade} touchdown at ${score.destName} (${score.touchdownVsi.toFixed(1)} m/s sink, ${score.bounceCount} bounce${score.bounceCount === 1 ? '' : 's'}).`;
    btnNext.style.display = 'block';

    const bossRow = score.bossBounty > 0
      ? `<div class="score-row highlight"><span>ACE / BOSS BOUNTY</span><strong>+${score.bossBounty.toLocaleString()}</strong></div>`
      : '';

    resultScores.innerHTML = `
      <div class="score-row"><span>HOSTILES DESTROYED (${score.kills})</span><strong>+${score.raiderScore.toLocaleString()}</strong></div>
      ${bossRow}
      <div class="score-row"><span>RINGS CLEARED (${score.ringsHit}/${score.totalRings})</span><strong>+${score.ringScore.toLocaleString()}</strong></div>
      <div class="score-row"><span>FLIGHT TIME (${formatTime(score.elapsedSec)})</span><strong>+${score.timeBonus}</strong></div>
      <div class="score-row"><span>LANDING GRADE (${score.grade})</span><strong>+${score.landingBonus}</strong></div>
      <div class="score-row"><span>FUEL (${score.fuelPct}%) &amp; HULL (${score.hullPct}%)</span><strong>+${score.fuelBonus + score.hullBonus}</strong></div>
      <div class="score-row total"><span>TOTAL SORTIE SCORE</span><strong>${score.total.toLocaleString()}</strong></div>
    `;
    srStatus.textContent = `Mission complete! ${score.kills} hostiles destroyed, ${score.grade} landing, total score ${score.total}.`;
  }

  function showCrashResult(reason, missionInfo, flightState, combatState) {
    resultOverlay.classList.remove('hidden');
    resultOverlay.classList.add('crash');
    resultKicker.textContent = 'COMBAT INCIDENT REPORT — PK-MRP';
    resultTitle.textContent = flightState.damage >= 100 && reason.startsWith('Shot down') ? 'AIRCRAFT SHOT DOWN' : 'AIRCRAFT CRASHED';
    resultSubtitle.textContent = reason;
    btnNext.style.display = 'none';

    resultScores.innerHTML = `
      <div class="score-row"><span>SORTIE</span><strong>${missionInfo.mission.name}</strong></div>
      <div class="score-row"><span>HOSTILES DESTROYED</span><strong>${combatState ? combatState.kills : 0}</strong></div>
      <div class="score-row"><span>RINGS CLEARED</span><strong>${missionInfo.ringsHit}/${missionInfo.totalRings}</strong></div>
      <div class="score-row"><span>FLIGHT TIME</span><strong>${formatTime(missionInfo.elapsedSec)}</strong></div>
      <div class="score-row"><span>FUEL REMAINING</span><strong>${Math.round(flightState.fuel)}%</strong></div>
    `;
    srStatus.textContent = `Aircraft lost: ${reason}`;
  }

  function hideResult() {
    resultOverlay.classList.add('hidden');
  }

  function update(dt, telemetry, missionInfo, cameraMode, gameState, combatState, enemiesList, lockedBearingDeg) {
    const hdg = Math.round(telemetry.headingDeg) % 360;
    hdgReadout.textContent = `HDG ${String(hdg).padStart(3, '0')}°`;
    drawCompass(telemetry.headingDeg, missionInfo.targetBearingDeg, lockedBearingDeg);

    const remaining = combatState ? combatState.hostilesRemaining : 0;
    if (gameState === 'landed') {
      objText.textContent = `SORTIE COMPLETE — ${missionInfo.destName.toUpperCase()} SECURED`;
    } else if (gameState === 'crashed') {
      objText.textContent = `MAYDAY — PK-MRP LOST`;
    } else if (telemetry.onGround && gameState === 'flying' && missionInfo.elapsedSec < 8) {
      objText.textContent = `SCRAMBLE — SHIFT THROTTLE • SPACE GUNS • X MISSILES`;
    } else if (remaining > 0) {
      objText.textContent = `INTERCEPT RAIDERS (${remaining} LEFT) → ${missionInfo.destName.toUpperCase()}`;
    } else {
      objText.textContent = `AIRSPACE CLEAR — LAND AT ${missionInfo.destName.toUpperCase()} (B BRAKE)`;
    }

    objRings.textContent = `RINGS ${missionInfo.ringsHit}/${missionInfo.totalRings}`;
    objHostiles.textContent = remaining > 0 ? `HOSTILES ${remaining}` : 'SKIES CLEAR';
    objHostiles.classList.toggle('clear', remaining === 0);
    objDist.textContent = `DIST ${Math.round(missionInfo.targetDist)}m`;
    objTimer.textContent = formatTime(missionInfo.elapsedSec);

    // Left flight tape
    valSpd.textContent = String(Math.round(telemetry.airspeedKt));
    const thrPct = Math.round(telemetry.throttle * 100);
    valThrPct.textContent = telemetry.wepActive ? `WEP ${thrPct}%` : `${thrPct}%`;
    barThr.style.width = `${thrPct}%`;
    barThr.classList.toggle('wep', telemetry.wepActive);
    valFlaps.textContent = `${telemetry.flapsDeg}°`;
    valView.textContent = cameraMode === 'cockpit' ? 'COCKPIT' : 'CHASE';
    valWind.textContent = `${telemetry.windSpeedKt} KT`;

    // Right flight tape
    valAlt.textContent = String(Math.round(telemetry.altitudeFt));
    const vsi = Math.round(telemetry.vsiFpm / 10) * 10;
    valVsi.textContent = `${vsi >= 0 ? '+' : ''}${vsi}`;

    const fuelPct = Math.round(telemetry.fuel);
    valFuelPct.textContent = `${fuelPct}%`;
    barFuel.style.width = `${fuelPct}%`;

    const hullPct = Math.max(0, Math.round(100 - telemetry.damage));
    valHullPct.textContent = `${hullPct}%`;
    barHull.style.width = `${hullPct}%`;

    // Mini instruments visible in Chase View
    instrumentsBox.classList.toggle('hidden', cameraMode === 'cockpit');
    if (cameraMode !== 'cockpit') {
      drawMiniAttitude(telemetry.pitchRad, telemetry.rollRad);
      drawMiniRadar(telemetry, enemiesList);
    }

    if (transientTimer > 0) {
      transientTimer -= dt;
      if (transientTimer <= 0) transientAlert = null;
    }

    const alerts = [];
    if (gameState === 'flying') {
      if (telemetry.stalling) alerts.push({ text: 'STALL WARNING — LOWER NOSE / ADD THROTTLE', tone: 'warn' });
      if (telemetry.overspeed) alerts.push({ text: 'OVERSPEED — REDUCE THROTTLE / B AIRBRAKE', tone: 'warn' });
      if (telemetry.fuel <= 0.1) alerts.push({ text: 'FUEL EXHAUSTED — GLIDE TO NEAREST RUNWAY', tone: 'warn' });
      else if (telemetry.fuel < 22) alerts.push({ text: 'LOW FUEL — TOUCH-AND-GO AT ANY STRIP TO REFUEL', tone: 'gold' });
    }
    if (transientAlert) alerts.push(transientAlert);

    alertsContainer.innerHTML = alerts
      .slice(0, 2)
      .map((a) => `<div class="alert-banner ${a.tone}">${a.text}</div>`)
      .join('');
  }

  return {
    renderMissionCards,
    showTitle,
    showLandingResult,
    showCrashResult,
    hideResult,
    pushAlert,
    update,
  };
}
