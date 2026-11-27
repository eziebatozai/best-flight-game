import * as THREE from '../vendor/three.min.js';
import { WEAPON_SPECS } from './weapons.js';

/**
 * Full-screen 2D tactical combat HUD canvas renderer and combat DOM telemetry controller.
 * Projects enemy brackets, health bars, predictive lead-aim pippers, infrared missile lock
 * rings, off-screen threat arrows, center gunsight crosshair, hit markers, damage vignette,
 * weapon ammo/heat/missile racks, kill feed, and boss health bar.
 */
export function createCombatHud() {
  const canvas = document.getElementById('combat-canvas');
  const ctx = canvas.getContext('2d');

  const bossWrap = document.getElementById('boss-bar-wrap');
  const bossNameEl = document.getElementById('boss-name');
  const bossHpFill = document.getElementById('boss-hp-fill');
  const bossHpText = document.getElementById('boss-hp-text');

  const combatPanel = document.getElementById('hud-combat');
  const valAmmo = document.getElementById('val-ammo');
  const valHeatState = document.getElementById('val-heat-state');
  const barHeat = document.getElementById('bar-heat');
  const missileRacks = document.getElementById('missile-racks');
  const valFlares = document.getElementById('val-flares');
  const valKills = document.getElementById('val-kills');
  const killFeedEl = document.getElementById('kill-feed');

  const projVec = new THREE.Vector3();
  const leadWorld = new THREE.Vector3();

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  function projectToScreen(worldPos, camera, w, h) {
    projVec.copy(worldPos).project(camera);
    const inFront = projVec.z < 1 && projVec.z > -1;
    const x = (projVec.x * 0.5 + 0.5) * w;
    const y = (-projVec.y * 0.5 + 0.5) * h;
    return { x, y, inFront, ndcX: projVec.x, ndcY: projVec.y };
  }

  function drawCornerBrackets(x, y, size, color, lineWidth = 2.2) {
    const c = Math.max(7, size * 0.34);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    // Top-left
    ctx.moveTo(x - size, y - size + c);
    ctx.lineTo(x - size, y - size);
    ctx.lineTo(x - size + c, y - size);
    // Top-right
    ctx.moveTo(x + size - c, y - size);
    ctx.lineTo(x + size, y - size);
    ctx.lineTo(x + size, y - size + c);
    // Bottom-right
    ctx.moveTo(x + size, y + size - c);
    ctx.lineTo(x + size, y + size);
    ctx.lineTo(x + size - c, y + size);
    // Bottom-left
    ctx.moveTo(x - size + c, y + size);
    ctx.lineTo(x - size, y + size);
    ctx.lineTo(x - size, y + size - c);
    ctx.stroke();
  }

  function drawRotatedDiamond(x, y, radius, angle, color, lineWidth = 2) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(0, -radius);
    ctx.lineTo(radius, 0);
    ctx.lineTo(0, radius);
    ctx.lineTo(-radius, 0);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  function drawOffscreenArrow(w, h, ndcX, ndcY, behind, isBoss) {
    let vx = ndcX;
    let vy = -ndcY;
    if (behind) {
      vx = -vx;
      vy = -vy;
    }
    const ang = Math.atan2(vy, vx);
    const rx = w * 0.42;
    const ry = h * 0.38;
    const px = w * 0.5 + Math.cos(ang) * rx;
    const py = h * 0.5 + Math.sin(ang) * ry;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(ang);
    ctx.fillStyle = isBoss ? '#ffb833' : '#ff4646';
    ctx.strokeStyle = '#101822';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-8, -7);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-8, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawCenterReticle(w, h, cameraMode, combatState, mouseAim) {
    const cx = w * 0.5;
    const cy = cameraMode === 'cockpit' ? h * 0.44 : h * 0.49;

    ctx.save();
    if (cameraMode !== 'cockpit') {
      // Crisp tactical gun crosshair
      ctx.strokeStyle = 'rgba(220, 248, 255, 0.85)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(cx, cy, 13, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx - 22, cy);
      ctx.lineTo(cx - 8, cy);
      ctx.moveTo(cx + 8, cy);
      ctx.lineTo(cx + 22, cy);
      ctx.moveTo(cx, cy - 22);
      ctx.lineTo(cx, cy - 8);
      ctx.moveTo(cx, cy + 8);
      ctx.lineTo(cx, cy + 22);
      ctx.stroke();

      ctx.fillStyle = '#4fe3d8';
      ctx.beginPath();
      ctx.arc(cx, cy, 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Subtle mouse-aim cue ring when cursor moves away from center
      if (mouseAim && (Math.abs(mouseAim.x) > 0.04 || Math.abs(mouseAim.y) > 0.04)) {
        const mx = cx + mouseAim.x * w * 0.24;
        const my = cy + mouseAim.y * h * 0.24;
        ctx.strokeStyle = 'rgba(255, 211, 107, 0.52)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(mx, my, 8, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Crisp hit-marker X flash when player rounds strike a hostile
    if (combatState.hitMarkerTimer > 0) {
      const alpha = Math.min(1, combatState.hitMarkerTimer / 0.14);
      ctx.strokeStyle = `rgba(255, 245, 195, ${alpha})`;
      ctx.lineWidth = 3.0;
      const r1 = 8;
      const r2 = 21;
      ctx.beginPath();
      ctx.moveTo(cx - r2, cy - r2);
      ctx.lineTo(cx - r1, cy - r1);
      ctx.moveTo(cx + r2, cy - r2);
      ctx.lineTo(cx + r1, cy - r1);
      ctx.moveTo(cx - r2, cy + r2);
      ctx.lineTo(cx - r1, cy + r1);
      ctx.moveTo(cx + r2, cy + r2);
      ctx.lineTo(cx + r1, cy + r1);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawDamageVignette(w, h, vignette) {
    if (vignette.alpha <= 0.01) return;
    const cx = w * 0.5;
    const cy = h * 0.5;
    const rad = Math.min(w, h) * 0.43;
    const ang = vignette.angleRad - Math.PI / 2;

    ctx.save();
    ctx.strokeStyle = `rgba(255, 48, 56, ${vignette.alpha * 0.85})`;
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, rad, ang - 0.55, ang + 0.55);
    ctx.stroke();
    ctx.restore();
  }

  function updateDom(combatState, weaponsState, activeBoss, gameState) {
    const showCombat = gameState === 'flying';
    combatPanel.classList.toggle('hidden', !showCombat);

    if (activeBoss && showCombat) {
      bossWrap.classList.remove('hidden');
      const pct = Math.max(0, Math.round((activeBoss.hp / activeBoss.maxHp) * 100));
      bossNameEl.textContent = `${activeBoss.isAce ? 'ACE INTERCEPTOR' : 'COMMAND AIRSHIP'} — ${activeBoss.shortName}`;
      bossHpFill.style.width = `${pct}%`;
      bossHpText.textContent = `${pct}%`;
    } else {
      bossWrap.classList.add('hidden');
    }

    valAmmo.textContent = String(weaponsState.ammo);
    const heatPct = Math.round(weaponsState.heat * 100);
    barHeat.style.width = `${heatPct}%`;
    barHeat.classList.toggle('hot', weaponsState.overheated || heatPct >= 75);
    valHeatState.textContent = weaponsState.overheated ? 'OVERHEAT' : `${heatPct}%`;

    let racksHtml = '';
    for (let i = 0; i < weaponsState.maxMissiles; i++) {
      racksHtml += `<span class="missile-pip${i < weaponsState.missiles ? ' ready' : ''}"></span>`;
    }
    missileRacks.innerHTML = racksHtml;

    if (weaponsState.flareActiveTimer > 0) {
      valFlares.textContent = 'ACTIVE';
      valFlares.className = 'flare-status active';
    } else if (weaponsState.flareCooldown > 0) {
      valFlares.textContent = `${Math.ceil(weaponsState.flareCooldown)}s`;
      valFlares.className = 'flare-status cooling';
    } else {
      valFlares.textContent = 'READY (F)';
      valFlares.className = 'flare-status ready';
    }

    valKills.textContent = String(combatState.kills);

    killFeedEl.innerHTML = combatState.killFeed
      .map((item) => `<div class="kill-item ${item.tone}">${item.text}</div>`)
      .join('');
  }

  function update(elapsed, camera, flightState, enemiesList, activeBoss, combatState, weaponsState, cameraMode, gameState, mouseAim) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);

    updateDom(combatState, weaponsState, activeBoss, gameState);

    if (gameState !== 'flying') return;

    drawCenterReticle(w, h, cameraMode, combatState, mouseAim);
    drawDamageVignette(w, h, combatState.damageVignette);

    const locked = combatState.lockedEnemy;

    for (let i = 0; i < enemiesList.length; i++) {
      const e = enemiesList[i];
      const dist = e.pos.distanceTo(flightState.position);
      const proj = projectToScreen(e.pos, camera, w, h);
      const inside = proj.inFront && proj.x > 36 && proj.x < w - 36 && proj.y > 36 && proj.y < h - 36;

      if (!inside) {
        drawOffscreenArrow(w, h, proj.ndcX, proj.ndcY, !proj.inFront, e.isBoss);
        continue;
      }

      const isLocked = e === locked;
      const boxSize = e.type === 'naga' ? Math.max(28, Math.min(64, 14000 / Math.max(120, dist))) : Math.max(17, Math.min(34, 6500 / Math.max(90, dist)));
      const color = isLocked ? '#ff4444' : e.isBoss ? '#ffae33' : '#f7b733';

      drawCornerBrackets(proj.x, proj.y, boxSize, color, isLocked ? 2.6 : 2.0);

      // Enemy health bar directly beneath bracket
      const barW = Math.max(44, boxSize * 2);
      const barX = proj.x - barW * 0.5;
      const barY = proj.y + boxSize + 6;
      const hpRatio = Math.max(0, Math.min(1, e.hp / e.maxHp));
      ctx.fillStyle = 'rgba(8, 16, 26, 0.85)';
      ctx.fillRect(barX - 1, barY - 1, barW + 2, 7);
      ctx.fillStyle = hpRatio > 0.5 ? '#ffae33' : '#ff3d47';
      ctx.fillRect(barX, barY, barW * hpRatio, 5);

      // Label & range readout
      ctx.font = 'bold 10.5px ui-monospace, Menlo, Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff5e4';
      ctx.fillText(`${e.shortName} ${Math.round(dist)}m`, proj.x, barY + 17);

      // Predictive lead-aim pipper + missile lock diamond on the active target
      if (isLocked) {
        const tof = dist / WEAPON_SPECS.cannonSpeed;
        leadWorld.copy(e.pos).addScaledVector(e.vel, tof);
        const leadProj = projectToScreen(leadWorld, camera, w, h);
        if (leadProj.inFront) {
          ctx.save();
          ctx.strokeStyle = 'rgba(255, 110, 96, 0.72)';
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(proj.x, proj.y);
          ctx.lineTo(leadProj.x, leadProj.y);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.strokeStyle = '#ffe066';
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.arc(leadProj.x, leadProj.y, 10, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#ff5454';
          ctx.beginPath();
          ctx.arc(leadProj.x, leadProj.y, 2.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // Progressive infrared missile lock-on diamond
        if (combatState.lockProgress > 0.02) {
          const lockedNow = combatState.lockAcquired;
          const r = lockedNow
            ? boxSize + 10 + Math.sin(elapsed * 14) * 2.5
            : boxSize + 36 * (1 - combatState.lockProgress) + 10;
          const ang = lockedNow ? 0 : (1 - combatState.lockProgress) * Math.PI * 1.4;
          drawRotatedDiamond(proj.x, proj.y, r, ang, lockedNow ? '#ff3333' : '#ffd356', lockedNow ? 2.8 : 2.1);

          if (lockedNow) {
            ctx.fillStyle = '#ff3838';
            ctx.font = 'bold 11px ui-monospace, Menlo, Consolas, monospace';
            ctx.fillText('LOCK', proj.x, proj.y - boxSize - 10);
          }
        }
      }
    }
  }

  return {
    update,
    resize,
  };
}
