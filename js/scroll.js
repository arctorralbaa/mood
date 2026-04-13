const ScrollManager = (() => {
  const O_INNER = [
    ['M', 165.278, 264.583],
    ['C', 184.028, 264.583, 200.926, 260.069, 215.972, 251.042],
    ['C', 231.019, 241.782, 242.94, 229.398, 251.736, 213.889],
    ['C', 260.764, 198.38, 265.278, 181.25, 265.278, 162.5],
    ['C', 265.278, 143.519, 260.764, 126.389, 251.736, 111.111],
    ['C', 242.94, 95.6019, 231.019, 83.3333, 215.972, 74.3056],
    ['C', 200.926, 65.0463, 184.028, 60.4167, 165.278, 60.4167],
    ['C', 146.528, 60.4167, 129.514, 65.0463, 114.236, 74.3056],
    ['C', 99.1898, 83.3333, 87.2685, 95.6019, 78.4722, 111.111],
    ['C', 69.6759, 126.389, 65.2778, 143.519, 65.2778, 162.5],
    ['C', 65.2778, 181.25, 69.6759, 198.38, 78.4722, 213.889],
    ['C', 87.2685, 229.398, 99.1898, 241.782, 114.236, 251.042],
    ['C', 129.514, 260.069, 146.528, 264.583, 165.278, 264.583],
    ['Z']
  ];

  const O_BOUNDS = {
    cx: 165.278,
    cy: 162.5,
    w: 331,
    h: 325,
  };

  const SCROLL_STAGES = {
    entryEnd: 0.62,
  };

  const CENTERING = {
    brand: 0.1,
    commit: 0.18,
    crossing: 0.72,
  };

  const ENTRY_TUNNEL = {
    idle: 0.02,
    handoff: 0.06,
  };

  const TUNNEL_PROGRESS = {
    idle: ENTRY_TUNNEL.idle,
    handoffEnd: ENTRY_TUNNEL.handoff,
    fullEnd: 1,
  };

  const CLIP_SCALE = {
    idle: 1,
    handoffOverscan: 1.002,
    insideOverscan: 1.004,
  };

  const LOGO_SCALE = {
    idle: 1.08,
    brand: 1.24,
    commit: 1.42,
    crossing: 13.5,
  };

  const PORTAL_SCALE = {
    idle: 1,
    commit: 1,
    crossing: 1,
  };

  const PORTAL_EDGE_FADE = {
    start: 0.992,
    end: 1,
    minOpacity: 0,
  };

  const BG_SCALE = {
    idle: 1.04,
    brand: 1.1,
    crossing: 1.16,
  };

  const TUNNEL_VIEW = {
    idleScale: 0.86,
    phase2Scale: 1,
    idleShift: 1,
    phase2Shift: 0,
    idleYOffset: -8,
    phase2YOffset: 0,
    handoffScale: 1,
    handoffShift: 0,
    handoffYOffset: 0,
  };

  let clipPathEl = null;
  let baseSx = 1;
  let baseSy = 1;
  let oCxVp = 0;
  let oCyVp = 0;

  let els = null;
  let logoOriginCx = 0;
  let logoOriginCy = 0;
  let portalAnchorCx = 0;
  let portalAnchorCy = 0;
  let recalcRaf = 0;

  const SCREEN_CENTER_OFFSET = {
    x: 0,
    y: -56,
  };

  function getScreenCenter() {
    return {
      x: (window.innerWidth / 2) + SCREEN_CENTER_OFFSET.x,
      y: (window.innerHeight / 2) + SCREEN_CENTER_OFFSET.y,
    };
  }

  function clamp01(value) {
    return Math.max(0, Math.min(1, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeOutCubic(t) {
    const p = clamp01(t);
    return 1 - ((1 - p) ** 3);
  }

  function easeInOutCubic(t) {
    const p = clamp01(t);
    return p < 0.5 ? 4 * p * p * p : 1 - (((-2 * p + 2) ** 3) / 2);
  }

  function easeInCubic(t) {
    const p = clamp01(t);
    return p * p * p;
  }

  function easeInOutSine(t) {
    const p = clamp01(t);
    return -(Math.cos(Math.PI * p) - 1) / 2;
  }

  function easeInExpo(t) {
    const p = clamp01(t);
    return p === 0 ? 0 : 2 ** (10 * p - 10);
  }

  function rangeProgress(value, start, end) {
    if (end <= start) return value >= end ? 1 : 0;
    return clamp01((value - start) / (end - start));
  }

  function transformOPath(tx, ty, sx, sy) {
    return O_INNER.map((cmd) => {
      if (cmd[0] === 'Z') return 'Z';
      if (cmd[0] === 'M') {
        return `M${cmd[1] * sx + tx} ${cmd[2] * sy + ty}`;
      }
      return `C${cmd[1] * sx + tx} ${cmd[2] * sy + ty} ${cmd[3] * sx + tx} ${cmd[4] * sy + ty} ${cmd[5] * sx + tx} ${cmd[6] * sy + ty}`;
    }).join(' ');
  }

  function updatePortalViewportMetrics(portal) {
    const rect = portal.getBoundingClientRect();
    baseSx = rect.width / O_BOUNDS.w;
    baseSy = rect.height / O_BOUNDS.h;
    oCxVp = rect.left + O_BOUNDS.cx * baseSx;
    oCyVp = rect.top + O_BOUNDS.cy * baseSy;
  }

  function computeBase(portal, logoStage) {
    updatePortalViewportMetrics(portal);
    portalAnchorCx = oCxVp;
    portalAnchorCy = oCyVp;

    const logoRect = logoStage.getBoundingClientRect();
    logoOriginCx = oCxVp - logoRect.left;
    logoOriginCy = oCyVp - logoRect.top;
  }

  function setLogoBaseNudge(dx, dy) {
    if (!els?.logoWrap) return;
    els.logoWrap.style.setProperty('--logo-base-nudge-x', `${dx.toFixed(2)}px`);
    els.logoWrap.style.setProperty('--logo-base-nudge-y', `${dy.toFixed(2)}px`);
  }

  function centerPortalInViewport() {
    const { portal } = els;
    updatePortalViewportMetrics(portal);

    const center = getScreenCenter();
    const currentBaseX = parseFloat(getComputedStyle(els.logoWrap).getPropertyValue('--logo-base-nudge-x')) || 0;
    const currentBaseY = parseFloat(getComputedStyle(els.logoWrap).getPropertyValue('--logo-base-nudge-y')) || 0;
    const dx = currentBaseX + (center.x - oCxVp);
    const dy = currentBaseY + (center.y - oCyVp);

    setLogoBaseNudge(dx, dy);
    updatePortalViewportMetrics(portal);
  }

  function buildLogoStageTransform(scale = 1, centerAmount = 0) {
    const center = getScreenCenter();
    const dx = (center.x - portalAnchorCx) * centerAmount;
    const dy = (center.y - portalAnchorCy) * centerAmount;
    return `translate(calc(var(--logo-base-nudge-x) + var(--logo-nudge-x) + ${dx.toFixed(2)}px), calc(var(--logo-base-nudge-y) + var(--logo-nudge-y) + ${dy.toFixed(2)}px)) scale(${scale.toFixed(4)})`;
  }

  function buildClipPath(scale = 1) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const sx = baseSx * scale;
    const sy = baseSy * scale;
    const tx = oCxVp - O_BOUNDS.cx * sx;
    const ty = oCyVp - O_BOUNDS.cy * sy;

    return `M0,0 L${w},0 L${w},${h} L0,${h}Z ${transformOPath(tx, ty, sx, sy)}`;
  }

  function setClip(scale = 1) {
    if (clipPathEl) {
      clipPathEl.setAttribute('d', buildClipPath(scale));
    }
  }

  function setTunnelTransform(tunnel, scale, shiftFrac, opacity = 1, extraYOffset = 0) {
    const vpCx = window.innerWidth / 2;
    const vpCy = window.innerHeight / 2;
    const dx = (oCxVp - vpCx) * shiftFrac;
    const dy = (oCyVp - vpCy) * shiftFrac + extraYOffset;

    tunnel.style.opacity = `${opacity}`;

    if (Math.abs(scale - 1) < 0.001 && Math.abs(shiftFrac) < 0.001 && Math.abs(extraYOffset) < 0.001) {
      tunnel.style.transform = 'none';
      return;
    }

    tunnel.style.transformOrigin = `${oCxVp.toFixed(1)}px ${oCyVp.toFixed(1)}px`;
    tunnel.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${scale.toFixed(4)})`;
  }

  function setTunnelProgress(progress) {
    if (typeof TunnelScene !== 'undefined' && TunnelScene.setScrollProgress) {
      TunnelScene.setScrollProgress(progress);
    }
  }

  function showHeroPortalFrame() {
    if (!els?.hero) return;
    els.hero.style.visibility = 'visible';
    els.hero.style.opacity = '1';
    els.hero.style.clipPath = 'url(#hero-clip)';
    els.hero.style.webkitClipPath = 'url(#hero-clip)';
  }

  function hideHeroForTunnel() {
    if (!els?.hero) return;
    els.hero.style.visibility = 'hidden';
    els.hero.style.opacity = '0';
    els.hero.style.clipPath = 'none';
    els.hero.style.webkitClipPath = 'none';
  }

  function applyIdleState() {
    const {
      hero,
      heroBg,
      heroGrain,
      logoStage,
      logoImg,
      portal,
      tunnel
    } = els;

    hero.style.pointerEvents = 'none';
    hero.style.visibility = 'visible';
    hero.style.opacity = '1';
    hero.style.transform = 'none';
    hero.style.clipPath = 'url(#hero-clip)';
    hero.style.webkitClipPath = 'url(#hero-clip)';

    heroBg.style.transformOrigin = `${oCxVp}px ${oCyVp}px`;
    heroBg.style.transform = 'none';
    heroBg.style.filter = 'none';

    if (heroGrain) {
      heroGrain.style.opacity = '0.03';
    }

    if (logoStage) {
      logoStage.style.transformOrigin = `${logoOriginCx}px ${logoOriginCy}px`;
      logoStage.style.transform = buildLogoStageTransform(1, 0);
      logoStage.style.opacity = '1';
    }

    if (logoImg) {
      logoImg.style.opacity = '1';
    }

    portal.style.opacity = '1';
    portal.style.transformOrigin = '50% 50%';
    portal.style.transform = 'none';

    tunnel.classList.add('active');
    setTunnelTransform(
      tunnel,
      TUNNEL_VIEW.idleScale,
      TUNNEL_VIEW.idleShift,
      1,
      TUNNEL_VIEW.idleYOffset
    );

    setTunnelProgress(TUNNEL_PROGRESS.idle);
    setClip(CLIP_SCALE.idle);
  }

  function applyUnifiedTransition(masterProgress) {
    const {
      hero,
      heroBg,
      heroGrain,
      logoStage,
      logoImg,
      portal,
      tunnel
    } = els;

    const isEntryStage = masterProgress < SCROLL_STAGES.entryEnd;
    const entryProgress = rangeProgress(masterProgress, 0, SCROLL_STAGES.entryEnd);
    const travelProgress = rangeProgress(masterProgress, SCROLL_STAGES.entryEnd, 1);

    const zoomEase = easeInOutSine(entryProgress);
    const handoffProgress = easeInOutSine(entryProgress);

    const logoScale = lerp(LOGO_SCALE.idle, LOGO_SCALE.crossing, zoomEase);
    const centerAmount = lerp(0, CENTERING.crossing, zoomEase);

    const portalScale = PORTAL_SCALE.idle;
    const edgeFade = clamp01(rangeProgress(entryProgress, PORTAL_EDGE_FADE.start, PORTAL_EDGE_FADE.end));
    const portalBaseOpacity = isEntryStage
      ? lerp(1, PORTAL_EDGE_FADE.minOpacity, edgeFade)
      : PORTAL_EDGE_FADE.minOpacity;
    const entryFrameFade = isEntryStage
      ? lerp(1, 0, clamp01(rangeProgress(entryProgress, 0.65, 0.92)))
      : 0;
    const tunnelMotionFade = isEntryStage
      ? entryFrameFade
      : 0;
    const portalOpacity = portalBaseOpacity * tunnelMotionFade;

    const bgScale = lerp(BG_SCALE.idle, BG_SCALE.crossing, clamp01(entryProgress));

    let tunnelProgress = TUNNEL_PROGRESS.idle;
    if (!isEntryStage) {
      tunnelProgress = lerp(TUNNEL_PROGRESS.idle, TUNNEL_PROGRESS.fullEnd, easeInOutSine(travelProgress));
    }

    tunnel.classList.add('active');
    hero.style.pointerEvents = 'none';
    hero.style.visibility = 'visible';
    hero.style.transform = 'none';
    hero.style.opacity = `${entryFrameFade.toFixed(4)}`;
    hero.style.clipPath = 'url(#hero-clip)';
    hero.style.webkitClipPath = 'url(#hero-clip)';
    heroBg.style.transform = `scale(${bgScale.toFixed(4)})`;
    const dimAmount = easeInOutCubic(entryProgress);
    if (dimAmount < 0.01) {
      heroBg.style.filter = 'none';
    } else if (dimAmount > 0.99 || Math.abs(dimAmount - (heroBg._lastDim || 0)) > 0.02) {
      heroBg.style.filter = `brightness(${lerp(1, 0.82, dimAmount).toFixed(3)}) saturate(${lerp(1, 0.93, dimAmount).toFixed(3)})`;
      heroBg._lastDim = dimAmount;
    }

    if (heroGrain) {
      heroGrain.style.opacity = `${lerp(0.03, 0.015, easeInOutCubic(entryProgress)).toFixed(4)}`;
    }

    if (logoStage) {
      logoStage.style.transformOrigin = `${logoOriginCx}px ${logoOriginCy}px`;
      logoStage.style.transform = buildLogoStageTransform(logoScale, centerAmount);
      logoStage.style.opacity = `${tunnelMotionFade.toFixed(4)}`;
    }

    if (logoImg) {
      logoImg.style.opacity = `${tunnelMotionFade.toFixed(4)}`;
    }

    portal.style.opacity = `${portalOpacity.toFixed(4)}`;
    portal.style.transformOrigin = '50% 50%';
    if (Math.abs(portalScale - 1) < 0.001) {
      portal.style.transform = 'none';
    } else {
      portal.style.transform = `scale(${portalScale.toFixed(4)})`;
    }

    updatePortalViewportMetrics(portal);
    heroBg.style.transformOrigin = `${oCxVp}px ${oCyVp}px`;
    setClip(CLIP_SCALE.handoffOverscan);
    const tunnelScale = isEntryStage
      ? lerp(TUNNEL_VIEW.idleScale, TUNNEL_VIEW.handoffScale, handoffProgress)
      : TUNNEL_VIEW.handoffScale;
    const tunnelShift = isEntryStage
      ? lerp(TUNNEL_VIEW.idleShift, TUNNEL_VIEW.handoffShift, handoffProgress)
      : TUNNEL_VIEW.handoffShift;
    const tunnelYOffset = isEntryStage
      ? lerp(TUNNEL_VIEW.idleYOffset, TUNNEL_VIEW.handoffYOffset, handoffProgress)
      : TUNNEL_VIEW.handoffYOffset;

    setTunnelTransform(tunnel, tunnelScale, tunnelShift, 1, tunnelYOffset);
    setTunnelProgress(tunnelProgress);
  }

  function recalc() {
    recalcRaf = 0;
    const { hero, portal, logoStage, tunnel } = els;
    centerPortalInViewport();
    computeBase(portal, logoStage);

    if (hero.style.visibility !== 'hidden') {
      applyIdleState();
    } else {
      setTunnelTransform(tunnel, 1, 0, 1);
    }

    ScrollTrigger.refresh();
  }

  function scheduleRecalc() {
    if (recalcRaf || !els) return;
    recalcRaf = requestAnimationFrame(recalc);
  }

  function initUnifiedScroll() {
    const { spacer, tunnel } = els;

    ScrollTrigger.create({
      trigger: spacer,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.05,  // single smooth pass — DOM and 3D stay in sync
      onUpdate: ({ progress }) => {
        applyUnifiedTransition(progress);
        tunnel.style.opacity = '1';
        tunnel.classList.add('active');
      },
      onEnterBack: () => {
        applyUnifiedTransition(1);
      },
      onLeaveBack: () => {
        applyIdleState();
      }
    });
  }

  function init() {
    gsap.registerPlugin(ScrollTrigger);

    els = {
      hero: document.getElementById('hero'),
      heroBg: document.querySelector('.hero-bg'),
      heroGrain: document.querySelector('.hero-grain'),
      logoWrap: document.getElementById('logo-wrap'),
      logoStage: document.getElementById('logo-stage'),
      logoImg: document.getElementById('hero-logo'),
      portal: document.getElementById('o-portal'),
      tunnel: document.getElementById('tunnel-container'),
      spacer: document.getElementById('scroll-spacer'),
    };

    clipPathEl = document.getElementById('hero-clip-path');
    if (!els.hero || !els.heroBg || !els.logoWrap || !els.logoStage || !els.portal || !els.tunnel || !els.spacer || !clipPathEl) {
      return;
    }

    centerPortalInViewport();
    computeBase(els.portal, els.logoStage);
    applyIdleState();

    if (els.logoImg && !els.logoImg.complete) {
      els.logoImg.addEventListener('load', scheduleRecalc, { once: true });
    }

    window.addEventListener('load', scheduleRecalc, { once: true });
    window.addEventListener('resize', scheduleRecalc, { passive: true });

    initUnifiedScroll();
  }

  return { init };
})();
