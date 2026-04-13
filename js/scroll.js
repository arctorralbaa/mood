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

  const HANDOFF = {
    end: '18% top',
    continueStart: '18% top',
  };

  const CROSSING = {
    travelStart: 0.86,
    heroHideProgress: 0.22,
  };

  const HERO_TWEAK = {
    zoomPhase1: 1.05,
    zoomPhase2: 1.12,
    crossingPush: 1.06,
    fadeStart: 0.9,
    fadeEnd: 0.985,
  };

  const HANDOFF_TIMING = {
    startProgress: 0.84,
    clipExpandStart: 0.96,
  };

  const PHASES = {
    phase1End: 0.62,
    phase2End: HANDOFF_TIMING.startProgress,
  };

  const HANDOFF_BLEND = {
    fadeStart: 1,
    fadeEnd: 1,
    clipStart: HANDOFF_TIMING.clipExpandStart,
    heroFadeStart: 1,
    heroFadeEnd: 1,
    portalFadeStart: 1,
    portalFadeEnd: 1,
    logoBoost: 1,
  };

  const CENTERING = {
    phase1End: 0.62,
    phase2End: 0.82,
    phase1Amount: 0.015,
    finalAmount: 0.03,
  };

  const TUNNEL_PROGRESS = {
    idle: 0.03,
    phase2End: 0.03,
    handoffEnd: 0.26,
    fullEnd: 1,
  };

  const CLIP_SCALE = {
    idle: 1,
    handoffOverscan: 1.002,
  };

  const LOGO_SCALE = {
    idle: 1,
    phase1: 1.005,
    phase2: 1.015,
  };

  const BG_SCALE = {
    idle: 1,
    phase1: HERO_TWEAK.zoomPhase1,
    phase2: HERO_TWEAK.zoomPhase2,
  };

  const TUNNEL_VIEW = {
    idleScale: 1,
    phase2Scale: 1,
    idleShift: 0,
    phase2Shift: 0,
    idleYOffset: 0,
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

  function applyPinnedTransition(progress) {
    const {
      hero,
      heroBg,
      heroGrain,
      logoStage,
      logoImg,
      portal,
      tunnel
    } = els;

    const phase1Raw = rangeProgress(progress, 0, PHASES.phase1End);
    const phase2Raw = rangeProgress(progress, PHASES.phase1End, PHASES.phase2End);
    const phase3Raw = rangeProgress(progress, PHASES.phase2End, 1);

    const phase1 = easeOutCubic(phase1Raw);
    const phase2 = easeInOutCubic(phase2Raw);
    const phase3 = easeInOutCubic(phase3Raw);
    const preHandoff = easeOutCubic(rangeProgress(progress, 0, PHASES.phase2End));
    const clipExpand = easeInOutCubic(rangeProgress(phase3Raw, HANDOFF_BLEND.clipStart, 1));
    const crossingPush = easeInExpo(rangeProgress(phase3Raw, 0.24, 1));

    const baseLogoScale = progress < PHASES.phase1End
      ? lerp(LOGO_SCALE.idle, LOGO_SCALE.phase1, phase1)
      : lerp(LOGO_SCALE.phase1, LOGO_SCALE.phase2, phase2);
    const logoScale = phase3Raw > 0
      ? baseLogoScale * HANDOFF_BLEND.logoBoost
      : baseLogoScale;

    const bgScale = progress < PHASES.phase1End
      ? lerp(BG_SCALE.idle, BG_SCALE.phase1, phase1)
      : lerp(BG_SCALE.phase1, BG_SCALE.phase2, phase2);
    const bgScaleWithCrossing = phase3Raw > 0
      ? bgScale * lerp(1, HERO_TWEAK.crossingPush, crossingPush)
      : bgScale;

    const heroOpacity = 1;
    const logoOpacity = 1;
    const portalOpacity = 1;
    const bgBrightness = progress < PHASES.phase1End
      ? lerp(1, 0.93, phase1)
      : lerp(0.93, 0.7, phase2);
    const centerPhase1 = easeOutCubic(rangeProgress(progress, 0, CENTERING.phase1End));
    const centerPhase2 = easeInOutCubic(rangeProgress(progress, CENTERING.phase1End, CENTERING.phase2End));
    const centerAmount = progress < CENTERING.phase1End
      ? lerp(0, CENTERING.phase1Amount, centerPhase1)
      : lerp(CENTERING.phase1Amount, CENTERING.finalAmount, centerPhase2);
    const tunnelScaleBase = lerp(TUNNEL_VIEW.idleScale, TUNNEL_VIEW.phase2Scale, preHandoff);
    const tunnelYOffsetBase = lerp(TUNNEL_VIEW.idleYOffset, TUNNEL_VIEW.phase2YOffset, preHandoff);
    const tunnelShiftBase = lerp(TUNNEL_VIEW.idleShift, TUNNEL_VIEW.phase2Shift, preHandoff);
    const tunnelScale = phase3Raw > 0
      ? lerp(tunnelScaleBase, TUNNEL_VIEW.handoffScale, phase3)
      : tunnelScaleBase;
    const tunnelYOffset = phase3Raw > 0
      ? lerp(tunnelYOffsetBase, TUNNEL_VIEW.handoffYOffset, phase3)
      : tunnelYOffsetBase;
    const tunnelShift = phase3Raw > 0
      ? lerp(tunnelShiftBase, TUNNEL_VIEW.handoffShift, phase3)
      : tunnelShiftBase;
    const crossingTravel = easeInCubic(rangeProgress(progress, CROSSING.travelStart, 1));
    const tunnelProgress = lerp(TUNNEL_PROGRESS.phase2End, TUNNEL_PROGRESS.handoffEnd, crossingTravel);

    hero.style.pointerEvents = 'none';
    hero.style.visibility = 'visible';
    hero.style.opacity = `${heroOpacity}`;
    hero.style.transform = 'none';
    hero.style.clipPath = 'url(#hero-clip)';
    hero.style.webkitClipPath = 'url(#hero-clip)';

    tunnel.classList.add('active');

    heroBg.style.transform = `scale(${bgScaleWithCrossing.toFixed(4)})`;
    heroBg.style.filter = `brightness(${bgBrightness.toFixed(3)}) saturate(${lerp(1, 0.9, phase2).toFixed(3)})`;

    if (heroGrain) {
      heroGrain.style.opacity = `${lerp(0.03, 0.012, phase2).toFixed(4)}`;
    }

    if (logoStage) {
      logoStage.style.transformOrigin = `${logoOriginCx}px ${logoOriginCy}px`;
      logoStage.style.transform = buildLogoStageTransform(logoScale, centerAmount);
      logoStage.style.opacity = '1';
    }

    if (logoImg) {
      logoImg.style.opacity = `${logoOpacity}`;
    }
    
    portal.style.opacity = `${portalOpacity}`;

    updatePortalViewportMetrics(portal);
    heroBg.style.transformOrigin = `${oCxVp}px ${oCyVp}px`;
    const clipScale = phase3Raw > 0
      ? lerp(CLIP_SCALE.idle, CLIP_SCALE.handoffOverscan, clipExpand)
      : CLIP_SCALE.idle;
    setClip(clipScale);
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

  function initPinnedHandoff() {
    const { spacer } = els;

    ScrollTrigger.create({
      trigger: spacer,
      start: 'top top',
      end: HANDOFF.end,
      scrub: 1.2,
      onUpdate: ({ progress }) => {
        applyPinnedTransition(progress);
      },
      onLeave: () => {
        const { tunnel } = els;
        showHeroPortalFrame();
        setTunnelTransform(tunnel, TUNNEL_VIEW.handoffScale, TUNNEL_VIEW.handoffShift, 1, TUNNEL_VIEW.handoffYOffset);
        setTunnelProgress(TUNNEL_PROGRESS.handoffEnd);
        tunnel.style.opacity = '1';
        tunnel.classList.add('active');
      },
      onEnterBack: () => {
        updatePortalViewportMetrics(els.portal);
        applyPinnedTransition(1);
      },
      onLeaveBack: () => {
        applyIdleState();
      }
    });
  }

  function initTunnelScroll() {
    const { tunnel, spacer } = els;

    ScrollTrigger.create({
      trigger: spacer,
      start: HANDOFF.continueStart,
      end: 'bottom bottom',
      scrub: 1.35,
      onUpdate: ({ progress }) => {
        setTunnelTransform(tunnel, TUNNEL_VIEW.handoffScale, TUNNEL_VIEW.handoffShift, 1, TUNNEL_VIEW.handoffYOffset);
        setTunnelProgress(lerp(TUNNEL_PROGRESS.handoffEnd, TUNNEL_PROGRESS.fullEnd, easeInCubic(progress)));
        if (progress >= CROSSING.heroHideProgress) {
          hideHeroForTunnel();
        } else {
          showHeroPortalFrame();
        }
      },
      onEnter: () => {
        showHeroPortalFrame();
        setTunnelProgress(TUNNEL_PROGRESS.handoffEnd);
        setTunnelTransform(
          tunnel,
          TUNNEL_VIEW.handoffScale,
          TUNNEL_VIEW.handoffShift,
          1,
          TUNNEL_VIEW.handoffYOffset
        );
        tunnel.style.opacity = '1';
        tunnel.classList.add('active');
      },
      onLeaveBack: () => {
        showHeroPortalFrame();
        applyPinnedTransition(1);
        tunnel.classList.add('active');
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

    initPinnedHandoff();
    initTunnelScroll();
  }

  return { init };
})();
