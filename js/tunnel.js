const TunnelScene = (() => {
  let scene, camera, renderer;
  let time = 0;
  let endLogo = null;
  let logoHovered = false;
  let gifHoverOverlay = null;
  let hoveredAnimatedCard = null;

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const loader = new THREE.TextureLoader();

  const TUNNEL_LEN = 100;
  const TUNNEL_R = 5;
  const ARCH_N = 22;
  const ARCH_GAP = TUNNEL_LEN / ARCH_N;

  const CAM_Z0 = 6.6;
  const CAM_Y = 1.92;
  const MAX_TRAVEL = 52;
  const ENTRY_LOCK_PROGRESS = 0;
  const ENTRY_FOV = 66;
  const CRUISE_FOV = 53;
  const ENTRY_CAMERA_Y = 1.56;
  const ENTRY_LOOK_Y = 1.92;
  const CAMERA_TRAVEL = {
    entryStart: 0,
    entryEnd: 1,
  };
  const CARD_START_Z = 1.5;
  const CARD_GAP = 2.8;

  const CARD = {
    w: 2.6,
    h: 2.6,
    y: 1.8,
    leftX: -1.7,
    rightX: 1.7,
    yaw: 0.14,
  };

  const FLOOR = {
    length: 50,
    width: TUNNEL_R * 1.95,
    centerZ: -20,
  };
  const END_ZONE_Z = -58;

  const END_LOGO_URL = 'assets/tunnel-welcome.svg';
  const END_LOGO_LINK = 'https://mood.mt/services/';
  const FEATURE_GIF_SRC = 'assets/feature-card.gif';

  const projects = [
    { title: '',                 z: CARD_START_Z + (CARD_GAP * -1), side: 'left',  accent: 0xffffff, img: FEATURE_GIF_SRC, hideTitle: true, fillImage: true, animateOnHover: true },
    { title: 'Brand Identity',   z: CARD_START_Z + (CARD_GAP * -3), side: 'right', accent: 0xffffff, img: 'assets/coffeefellows.jpg' },
    { title: 'Website Design',   z: CARD_START_Z + (CARD_GAP * -5), side: 'left',  accent: 0xffffff, img: 'assets/coffeefellows.jpg' },
    { title: 'Website Design',   z: CARD_START_Z + (CARD_GAP * -7), side: 'right', accent: 0xffffff, img: 'assets/coffeefellows.jpg' },
    { title: 'Digital Strategy', z: CARD_START_Z + (CARD_GAP * -9), side: 'left',  accent: 0xffffff, img: 'assets/coffeefellows.jpg' },
    { title: 'Digital Strategy', z: CARD_START_Z + (CARD_GAP * -11), side: 'right', accent: 0xffffff, img: 'assets/coffeefellows.jpg' },
    { title: 'Photography',      z: CARD_START_Z + (CARD_GAP * -14), side: 'left',  accent: 0xffffff, img: 'assets/coffeefellows.jpg' },
    { title: 'Photography',      z: CARD_START_Z + (CARD_GAP * -16), side: 'right', accent: 0xffffff, img: 'assets/coffeefellows.jpg' },
  ];

  const cardMeshes = [];
  const panelToCard = new Map();

  let scrollProgress = 0;
  let targetScrollProgress = 0;
  let currentProgress = 0;
  let lastScrollProgress = 0;
  let lastScrollInputTime = 0;
  let lastFrameTime = performance.now();

  const SCROLL_DAMPING = 18;

  let sharedShadowTexture = null;
  let sharedGlowTexture = null;
  let sharedFloorTexture = null;
  let sharedFloorReflectionTexture = null;

  const reusablePanels = [];

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function clamp01(value) {
    return Math.max(0, Math.min(1, value));
  }

  function rangeProgress(value, start, end) {
    if (end <= start) return value >= end ? 1 : 0;
    return clamp01((value - start) / (end - start));
  }

  function init() {
    const canvas = document.getElementById('tunnel-canvas');
    if (!canvas) return;

    scene = new THREE.Scene();
    scene.background = createBackgroundGradientTexture(1024);

    camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 200);
    camera.position.set(0, CAM_Y, CAM_Z0);

    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
    });
    applyRendererSizing();
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.94;

    sharedShadowTexture = createShadowTexture();
    sharedGlowTexture = createGlowTexture();
    sharedFloorTexture = createConcreteTexture(512);
    sharedFloorReflectionTexture = createFloorReflectionTexture(512);

    addLights();
    addArches();
    addFloor();
    addCards();
    addEndLight();
    addEndLogo();

    renderer.domElement.addEventListener('click', onLogoClick);
    renderer.domElement.addEventListener('mousemove', onHover);
    renderer.domElement.addEventListener('mouseleave', onCanvasLeave);
    window.addEventListener('resize', onResize);

    animate();
  }

  function addLights() {
    scene.add(new THREE.AmbientLight(0xffead7, 0.44));
    scene.add(new THREE.HemisphereLight(0xfff6ea, 0xc7aa91, 0.3));
    scene.add(createPointLight(0xffddbf, 3.1, 120, [0, 2.8, -TUNNEL_LEN + 8]));
    scene.add(createPointLight(0xffe8cf, 1.75, 80, [0, 2.1, -TUNNEL_LEN + 20]));
    scene.add(createPointLight(0xffdec1, 0.36, 18, [0, 2, CAM_Z0 + 3]));

    const dir = new THREE.DirectionalLight(0xffead7, 0.22);
    dir.position.set(0, 5.5, 3);
    scene.add(dir);
  }

  function createPointLight(color, intensity, distance, position) {
    const light = new THREE.PointLight(color, intensity, distance, 1.0);
    light.position.set(...position);
    return light;
  }

  function createBackgroundGradientTexture(size = 1024) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');

    const base = ctx.createLinearGradient(0, 0, 0, size);
    base.addColorStop(0, '#ead7bf');
    base.addColorStop(0.42, '#e1ccb3');
    base.addColorStop(1, '#cfb292');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);

    const ceilingGlow = ctx.createRadialGradient(
      size * 0.5,
      size * 0.08,
      0,
      size * 0.5,
      size * 0.18,
      size * 0.7
    );
    ceilingGlow.addColorStop(0, 'rgba(255, 244, 228, 0.36)');
    ceilingGlow.addColorStop(0.42, 'rgba(250, 228, 194, 0.22)');
    ceilingGlow.addColorStop(1, 'rgba(250, 228, 194, 0)');
    ctx.fillStyle = ceilingGlow;
    ctx.fillRect(0, 0, size, size);

    const warmWash = ctx.createLinearGradient(0, 0, size, size);
    warmWash.addColorStop(0, 'rgba(235, 205, 169, 0.14)');
    warmWash.addColorStop(0.5, 'rgba(223, 193, 157, 0.08)');
    warmWash.addColorStop(1, 'rgba(206, 176, 145, 0.04)');
    ctx.fillStyle = warmWash;
    ctx.fillRect(0, 0, size, size);

    const amberDrift = ctx.createRadialGradient(
      size * 0.18,
      size * 0.28,
      0,
      size * 0.18,
      size * 0.28,
      size * 0.68
    );
    amberDrift.addColorStop(0, 'rgba(238, 210, 176, 0.2)');
    amberDrift.addColorStop(0.5, 'rgba(224, 193, 158, 0.12)');
    amberDrift.addColorStop(1, 'rgba(224, 193, 158, 0)');
    ctx.fillStyle = amberDrift;
    ctx.fillRect(0, 0, size, size);

    const sideGlow = ctx.createRadialGradient(
      size * 0.84,
      size * 0.18,
      0,
      size * 0.84,
      size * 0.18,
      size * 0.5
    );
    sideGlow.addColorStop(0, 'rgba(247, 235, 218, 0.14)');
    sideGlow.addColorStop(0.5, 'rgba(230, 213, 193, 0.08)');
    sideGlow.addColorStop(1, 'rgba(230, 213, 193, 0)');
    ctx.fillStyle = sideGlow;
    ctx.fillRect(0, 0, size, size);

    const lowerFalloff = ctx.createLinearGradient(0, size * 0.48, 0, size);
    lowerFalloff.addColorStop(0, 'rgba(218, 196, 171, 0)');
    lowerFalloff.addColorStop(1, 'rgba(188, 160, 130, 0.24)');
    ctx.fillStyle = lowerFalloff;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function createConcreteTexture(size = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');

    const base = ctx.createLinearGradient(0, 0, 0, size);
    base.addColorStop(0, '#e8ded1');
    base.addColorStop(0.5, '#e3d8ca');
    base.addColorStop(1, '#dacfbe');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);

    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const grain = (Math.random() - 0.5) * 6;
      data[i] = clamp255(data[i] + grain);
      data[i + 1] = clamp255(data[i + 1] + grain - 1);
      data[i + 2] = clamp255(data[i + 2] + grain - 2);
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1.3, 1.7);
    return texture;
  }

  function createFloorReflectionTexture(size = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');

    const glow = ctx.createRadialGradient(
      size * 0.5,
      size * 0.28,
      0,
      size * 0.5,
      size * 0.28,
      size * 0.45
    );
    glow.addColorStop(0, 'rgba(255,255,245,0.32)');
    glow.addColorStop(0.55, 'rgba(255,250,236,0.14)');
    glow.addColorStop(1, 'rgba(255,250,236,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  function addArches() {
    const group = new THREE.Group();
    const floorFront = FLOOR.centerZ + FLOOR.length / 2;
    const floorBack = FLOOR.centerZ - FLOOR.length / 2;

    group.add(makeArch(floorFront));
    group.add(makeArch(7.8));
    group.add(makeArch(4.2));

    for (let i = 0; i < ARCH_N; i += 1) {
      const z = -i * ARCH_GAP;
      if (z < floorBack) break;
      group.add(makeArch(z));
    }

    scene.add(group);
  }

  function makeArch(z) {
    const geo = new THREE.TorusGeometry(TUNNEL_R, 0.07, 12, 80);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: false,
      opacity: 1,
      toneMapped: false,
    });

    const ring = new THREE.Mesh(geo, mat);
    ring.position.z = z;

    const group = new THREE.Group();
    group.add(ring);
    return group;
  }

  function clamp255(value) {
    return Math.max(0, Math.min(255, value));
  }

  function addFloor() {
    const mat = new THREE.MeshPhysicalMaterial({
      map: sharedFloorTexture,
      color: 0xffffff,
      roughness: 0.65,
      metalness: 0.0,
      clearcoat: 0.12,
      clearcoatRoughness: 0.4,
      side: THREE.DoubleSide,
    });

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(FLOOR.width, FLOOR.length),
      mat
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, FLOOR.centerZ);
    scene.add(floor);

    const reflection = new THREE.Mesh(
      new THREE.PlaneGeometry(FLOOR.width, FLOOR.length),
      new THREE.MeshBasicMaterial({
        map: sharedFloorReflectionTexture,
        transparent: true,
        opacity: 0.15,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      })
    );
    reflection.rotation.x = -Math.PI / 2;
    reflection.position.set(0, 0.012, FLOOR.centerZ);
    scene.add(reflection);
  }

  function addCards() {
    const group = new THREE.Group();
    projects.forEach((project, index) => {
      group.add(makeCard(project, index));
    });
    scene.add(group);
  }

  function canvasRoundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function makeCardTexture(project) {
    const { title, img: imgSrc, accent, side, hideTitle, fillImage, animateOnHover } = project;
    const width = 384;
    const height = 384;
    const pad = 8;
    const radius = 22;
    const bx = pad;
    const by = pad;
    const bw = width - pad * 2;
    const bh = height - pad * 2;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas);
    let baseImage = null;

    const accentR = (accent >> 16) & 0xff;
    const accentG = (accent >> 8) & 0xff;
    const accentB = accent & 0xff;

    function draw(image) {
      ctx.clearRect(0, 0, width, height);

      ctx.save();
      canvasRoundedRect(ctx, bx, by, bw, bh, radius);
      ctx.clip();

      if (!fillImage) {
        ctx.fillStyle = 'rgba(238, 234, 228, 0.65)';
        ctx.fillRect(bx, by, bw, bh);
      }

      if (image) {
        const imgPad = fillImage ? 0 : 24;
        const imgHeight = fillImage ? bh : (bh - 90);
        const scaleBase = fillImage
          ? Math.max((bw - imgPad * 2) / image.width, imgHeight / image.height)
          : Math.min((bw - imgPad * 2) / image.width, imgHeight / image.height) * 0.88;
        const scale = scaleBase;
        const drawW = image.width * scale;
        const drawH = image.height * scale;
        const drawX = bx + (bw - drawW) / 2;
        const drawY = fillImage ? by + (bh - drawH) / 2 : by + imgPad + (imgHeight - drawH) / 2;

        ctx.globalAlpha = fillImage ? 1 : 0.82;
        ctx.drawImage(image, drawX, drawY, drawW, drawH);
        ctx.globalAlpha = 1;

        if (!fillImage) {
          const haze = ctx.createLinearGradient(bx, by, bx, by + bh);
          haze.addColorStop(0, 'rgba(242, 238, 232, 0.10)');
          haze.addColorStop(0.5, 'rgba(242, 238, 232, 0.02)');
          haze.addColorStop(1, 'rgba(242, 238, 232, 0.15)');
          ctx.fillStyle = haze;
          ctx.fillRect(bx, by, bw, bh);
        }
      }

      const edgeHaze = ctx.createRadialGradient(width / 2, height / 2, bw * 0.22, width / 2, height / 2, bw * 0.55);
      edgeHaze.addColorStop(0, 'rgba(245, 241, 235, 0)');
      edgeHaze.addColorStop(1, 'rgba(245, 241, 235, 0.15)');
      ctx.fillStyle = edgeHaze;
      ctx.fillRect(bx, by, bw, bh);

      const edgeWidth = 124;
      const edgeGradient = side === 'right'
        ? ctx.createLinearGradient(bx + bw - edgeWidth, 0, bx + bw, 0)
        : ctx.createLinearGradient(bx, 0, bx + edgeWidth, 0);

      if (side === 'right') {
        edgeGradient.addColorStop(0, 'rgba(0,0,0,0)');
        edgeGradient.addColorStop(1, `rgba(${accentR},${accentG},${accentB},0.85)`);
        ctx.fillStyle = edgeGradient;
        ctx.fillRect(bx + bw - edgeWidth, by, edgeWidth, bh);
        ctx.fillStyle = `rgba(${accentR},${accentG},${accentB},0.92)`;
        ctx.fillRect(bx + bw - 3, by + radius, 3, bh - radius * 2);
      } else {
        edgeGradient.addColorStop(0, `rgba(${accentR},${accentG},${accentB},0.85)`);
        edgeGradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = edgeGradient;
        ctx.fillRect(bx, by, edgeWidth, bh);
        ctx.fillStyle = `rgba(${accentR},${accentG},${accentB},0.92)`;
        ctx.fillRect(bx, by + radius, 3, bh - radius * 2);
      }

      ctx.restore();

      drawGlassBorder(ctx, bx, by, bw, bh, radius);
      drawAccentEdge(ctx, bx, by, bw, bh, radius, side, accentR, accentG, accentB);

      if (!hideTitle) {
        drawTextGradient(ctx, bx, by, bw, bh, radius);

        ctx.shadowColor = 'rgba(34, 20, 10, 0.45)';
        ctx.shadowBlur = 16;
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(48, 28, 16, 0.32)';
        ctx.font = '600 30px sans-serif';
        ctx.strokeText(title, bx + 18, by + bh - 24);
        ctx.fillStyle = 'rgba(255,252,248,1)';
        ctx.fillText(title, bx + 18, by + bh - 24);
        ctx.shadowBlur = 0;
      }

      texture.needsUpdate = true;
    }

    draw(null);

    if (imgSrc) {
      const image = new Image();
      image.onload = () => {
        baseImage = image;
        draw(image);
      };
      image.src = imgSrc;
    }

    function setAnimated(enabled) {
      if (!animateOnHover) return;
    }

    return { texture, setAnimated };
  }

  function drawGlassBorder(ctx, bx, by, bw, bh, radius) {
    ctx.save();
    ctx.shadowColor = 'rgba(255,255,255,0.65)';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = 'rgba(255,255,255,0.40)';
    ctx.lineWidth = 1.5;
    canvasRoundedRect(ctx, bx, by, bw, bh, radius);
    ctx.stroke();

    ctx.shadowBlur = 4;
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.stroke();
    ctx.restore();
  }

  function drawAccentEdge(ctx, bx, by, bw, bh, radius, side, r, g, b) {
    ctx.save();
    ctx.shadowColor = `rgba(${r},${g},${b},0.95)`;
    ctx.shadowBlur = 64;
    ctx.strokeStyle = `rgba(${r},${g},${b},0.95)`;
    ctx.lineWidth = 2.4;

    ctx.beginPath();
    if (side === 'right') {
      ctx.moveTo(bx + bw, by + radius);
      ctx.lineTo(bx + bw, by + bh - radius);
    } else {
      ctx.moveTo(bx, by + radius);
      ctx.lineTo(bx, by + bh - radius);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawTextGradient(ctx, bx, by, bw, bh, radius) {
    ctx.save();
    canvasRoundedRect(ctx, bx, by, bw, bh, radius);
    ctx.clip();

    const textGradient = ctx.createLinearGradient(bx, by + bh - 120, bx, by + bh);
    textGradient.addColorStop(0, 'rgba(38, 24, 12, 0)');
    textGradient.addColorStop(0.5, 'rgba(26, 14, 8, 0.18)');
    textGradient.addColorStop(1, 'rgba(18, 8, 3, 0.48)');
    ctx.fillStyle = textGradient;
    ctx.fillRect(bx, by + bh - 120, bw, 120);
    ctx.restore();
  }

  function makeCard(project) {
    const group = new THREE.Group();
    const pivot = new THREE.Group();

    const textureController = makeCardTexture(project);
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD.w, CARD.h),
      new THREE.MeshBasicMaterial({
        map: textureController.texture,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    pivot.add(panel);

    pivot.add(createCardShadow());
    pivot.add(createCardGlow());

    pivot.position.x = project.side === 'left' ? CARD.w / 2 : -CARD.w / 2;
    group.add(pivot);

    const pivotOffset = project.side === 'left' ? CARD.w / 2 : -CARD.w / 2;
    const x = (project.side === 'left' ? CARD.leftX : CARD.rightX) - pivotOffset;
    const yaw = project.side === 'left' ? CARD.yaw : -CARD.yaw;

    group.position.set(x, CARD.y, project.z);
    group.rotation.y = yaw;

    const cardData = {
      group,
      doorPivot: pivot,
      panel,
      proj: project,
      textureController,
      doorTarget: 0,
      doorCurrent: 0,
    };

    cardMeshes.push(cardData);
    panelToCard.set(panel, cardData);
    reusablePanels.push(panel);

    return group;
  }

  function createCardShadow() {
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD.w * 1.12, 1.05),
      new THREE.MeshBasicMaterial({
        map: sharedShadowTexture,
        transparent: true,
        depthWrite: false,
        opacity: 0.72,
      })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0, -CARD.y + 0.03, 0.08);
    return shadow;
  }

  function createCardGlow() {
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD.w * 1.5, CARD.h * 1.5),
      new THREE.MeshBasicMaterial({
        map: sharedGlowTexture,
        transparent: true,
        depthWrite: false,
      })
    );
    glow.position.z = -0.04;
    return glow;
  }

  function createShadowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 192;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createRadialGradient(96, 48, 0, 96, 48, 92);
    gradient.addColorStop(0, 'rgba(0,0,0,0.2)');
    gradient.addColorStop(0.45, 'rgba(0,0,0,0.1)');
    gradient.addColorStop(0.8, 'rgba(0,0,0,0.03)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 192, 96);

    return new THREE.CanvasTexture(canvas);
  }

  function createGlowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 250, 240, 0.14)');
    gradient.addColorStop(0.6, 'rgba(255, 250, 240, 0.04)');
    gradient.addColorStop(1, 'rgba(255, 250, 240, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);

    return new THREE.CanvasTexture(canvas);
  }

  function addEndLogo() {
    loader.load(END_LOGO_URL, (tex) => {
      const height = 2.1;
      const width = height * 3;

      endLogo = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        new THREE.MeshBasicMaterial({
          map: tex,
          color: 0x43362b,
          transparent: true,
          alphaTest: 0.02,
          opacity: 1,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );

      endLogo.position.set(0, 1.12, END_ZONE_Z);
      endLogo.visible = true;
      scene.add(endLogo);

    });
  }

  function addEndLight() {
    scene.add(createPointLight(0xffd6b0, 1.45, 80, [0, 2.35, END_ZONE_Z + 2]));
    scene.add(createPointLight(0xffead1, 0.78, 48, [0, 1.45, END_ZONE_Z - 1.5]));

    const accent = new THREE.SpotLight(0xffd7ae, 0.95, 72, Math.PI / 8, 0.62, 1.3);
    accent.position.set(0, 3.1, END_ZONE_Z + 4.5);
    accent.target.position.set(0, 1.2, END_ZONE_Z - 0.5);
    scene.add(accent);
    scene.add(accent.target);
  }

  function onLogoClick(event) {
    if (isLogoHit(event)) {
      window.location.href = END_LOGO_LINK;
    }
  }

  function onHover(event) {
    if (isScrollActive()) {
      cardMeshes.forEach((card) => {
        card.doorTarget = 0;
        card.textureController?.setAnimated(false);
      });
      hideGifHoverOverlay();
      logoHovered = false;
      renderer.domElement.style.cursor = 'default';
      return;
    }

    const hits = getIntersections(event);
    const logoHit = endLogo ? hits.logo.length > 0 : false;
    const cardHit = hits.cards[0]?.object || null;
    const hoveredCard = (cardHit && panelToCard.has(cardHit))
      ? panelToCard.get(cardHit)
      : null;

    cardMeshes.forEach((card) => {
      const isHoveredCard = card === hoveredCard;
      card.doorTarget = isHoveredCard ? (card.proj.side === 'left' ? 0.5 : -0.5) : 0;
      card.textureController?.setAnimated(isHoveredCard);
    });

    hoveredAnimatedCard = hoveredCard && hoveredCard.proj.animateOnHover && hoveredCard.proj.img === FEATURE_GIF_SRC
      ? hoveredCard
      : null;
    if (hoveredAnimatedCard) {
      ensureGifHoverOverlay();
      gifHoverOverlay.style.display = 'block';
      updateGifHoverOverlayPosition();
    } else {
      hideGifHoverOverlay();
    }

    logoHovered = logoHit;
    renderer.domElement.style.cursor = (logoHit || cardHit) ? 'pointer' : 'default';
  }

  function onCanvasLeave() {
    hideGifHoverOverlay();
  }

  function ensureGifHoverOverlay() {
    if (gifHoverOverlay) return;
    const wrapper = document.createElement('div');
    wrapper.style.position = 'fixed';
    wrapper.style.left = '0';
    wrapper.style.top = '0';
    wrapper.style.width = '0';
    wrapper.style.height = '0';
    wrapper.style.display = 'none';
    wrapper.style.pointerEvents = 'none';
    wrapper.style.overflow = 'hidden';
    wrapper.style.borderRadius = '0';
    wrapper.style.zIndex = '10';
    wrapper.style.transformOrigin = '0 0';

    const img = document.createElement('img');
    img.src = FEATURE_GIF_SRC;
    img.alt = '';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.display = 'block';
    img.style.objectFit = 'cover';

    const frost = document.createElement('div');
    frost.style.position = 'absolute';
    frost.style.inset = '0';
    frost.style.pointerEvents = 'none';
    frost.style.borderRadius = 'inherit';
    frost.style.background = [
      'radial-gradient(138% 118% at 50% 50%, rgba(255,255,255,0) 58%, rgba(245,241,235,0.22) 100%)',
      'linear-gradient(180deg, rgba(246,242,236,0.18) 0%, rgba(242,238,232,0.07) 50%, rgba(240,235,228,0.18) 100%)'
    ].join(',');

    const border = document.createElement('div');
    border.style.position = 'absolute';
    border.style.inset = '0';
    border.style.pointerEvents = 'none';
    border.style.borderRadius = 'inherit';
    border.style.boxShadow = 'inset 0 0 0 1.5px rgba(255,255,255,0.38), inset 0 0 12px rgba(255,255,255,0.16)';

    const accent = document.createElement('div');
    accent.style.position = 'absolute';
    accent.style.inset = '0';
    accent.style.pointerEvents = 'none';
    accent.style.borderRadius = 'inherit';
    accent.style.background = 'linear-gradient(90deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.42) 4%, rgba(255,255,255,0.16) 10%, rgba(255,255,255,0) 22%)';

    const highlight = document.createElement('div');
    highlight.style.position = 'absolute';
    highlight.style.inset = '0';
    highlight.style.pointerEvents = 'none';
    highlight.style.borderRadius = 'inherit';
    highlight.style.boxShadow = 'inset 0 2px 0 rgba(255,255,255,0.34), inset 0 -10px 20px rgba(248,243,236,0.08), inset 0 0 18px rgba(255,255,255,0.1)';

    wrapper.appendChild(img);
    wrapper.appendChild(frost);
    wrapper.appendChild(border);
    wrapper.appendChild(accent);
    wrapper.appendChild(highlight);
    document.body.appendChild(wrapper);
    gifHoverOverlay = wrapper;
  }

  function hideGifHoverOverlay() {
    hoveredAnimatedCard = null;
    if (!gifHoverOverlay) return;
    gifHoverOverlay.style.display = 'none';
  }

  function updateGifHoverOverlayPosition() {
    if (!gifHoverOverlay || !hoveredAnimatedCard || !renderer || !camera) return;

    const panel = hoveredAnimatedCard.panel;
    panel.updateWorldMatrix(true, false);
    const rect = renderer.domElement.getBoundingClientRect();

    // Match the same inner content area used by makeCardTexture():
    // canvas 384x384 with pad=8 (inner rect 8..376).
    const texSize = 384;
    const pad = 8;
    const radius = 22;
    const innerLeft = (pad / texSize) * CARD.w - CARD.w * 0.5;
    const innerRight = ((texSize - pad) / texSize) * CARD.w - CARD.w * 0.5;
    const innerTop = CARD.h * 0.5 - (pad / texSize) * CARD.h;
    const innerBottom = CARD.h * 0.5 - ((texSize - pad) / texSize) * CARD.h;

    const localCorners = [
      new THREE.Vector3(innerLeft, innerTop, 0),
      new THREE.Vector3(innerRight, innerTop, 0),
      new THREE.Vector3(innerRight, innerBottom, 0),
      new THREE.Vector3(innerLeft, innerBottom, 0),
    ];

    const projected = localCorners.map((corner) => {
      corner.applyMatrix4(panel.matrixWorld);
      corner.project(camera);
      return {
        x: (corner.x * 0.5 + 0.5) * rect.width + rect.left,
        y: (-corner.y * 0.5 + 0.5) * rect.height + rect.top,
      };
    });

    const dx1 = projected[1].x - projected[2].x;
    const dx2 = projected[3].x - projected[2].x;
    const dx3 = projected[0].x - projected[1].x + projected[2].x - projected[3].x;
    const dy1 = projected[1].y - projected[2].y;
    const dy2 = projected[3].y - projected[2].y;
    const dy3 = projected[0].y - projected[1].y + projected[2].y - projected[3].y;

    let a;
    let b;
    let c;
    let d;
    let e;
    let f;
    let g;
    let h;
    if (dx3 === 0 && dy3 === 0) {
      a = projected[1].x - projected[0].x;
      b = projected[3].x - projected[0].x;
      c = projected[0].x;
      d = projected[1].y - projected[0].y;
      e = projected[3].y - projected[0].y;
      f = projected[0].y;
      g = 0;
      h = 0;
    } else {
      const det = dx1 * dy2 - dx2 * dy1;
      g = (dx3 * dy2 - dx2 * dy3) / det;
      h = (dx1 * dy3 - dx3 * dy1) / det;
      a = projected[1].x - projected[0].x + g * projected[1].x;
      b = projected[3].x - projected[0].x + h * projected[3].x;
      c = projected[0].x;
      d = projected[1].y - projected[0].y + g * projected[1].y;
      e = projected[3].y - projected[0].y + h * projected[3].y;
      f = projected[0].y;
    }

    const sourceW = texSize - pad * 2;
    const sourceH = texSize - pad * 2;
    const A = a / sourceW;
    const B = b / sourceH;
    const D = d / sourceW;
    const E = e / sourceH;
    const G = g / sourceW;
    const H = h / sourceH;
    const matrix = `matrix3d(${A},${D},0,${G},${B},${E},0,${H},0,0,1,0,${c},${f},0,1)`;

    gifHoverOverlay.style.left = '0px';
    gifHoverOverlay.style.top = '0px';
    gifHoverOverlay.style.width = `${sourceW}px`;
    gifHoverOverlay.style.height = `${sourceH}px`;
    gifHoverOverlay.style.borderRadius = `${radius}px`;
    gifHoverOverlay.style.transform = matrix;
  }

  function getIntersections(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    return {
      logo: endLogo ? raycaster.intersectObject(endLogo) : [],
      cards: raycaster.intersectObjects(reusablePanels),
    };
  }

  function isLogoHit(event) {
    return getIntersections(event).logo.length > 0;
  }

  function setScrollProgress(progress) {
    targetScrollProgress = progress;
    scrollProgress = progress;
    if (Math.abs(progress - lastScrollProgress) > 0.0001) {
      lastScrollInputTime = performance.now();
      lastScrollProgress = progress;
    }
  }

  function isScrollActive() {
    return (performance.now() - lastScrollInputTime) < 140;
  }

  function animate() {
    requestAnimationFrame(animate);

    const now = performance.now();
    const dt = Math.min(0.05, (now - lastFrameTime) / 1000);
    lastFrameTime = now;

    time += 0.004;
    if (isScrollActive()) {
      // Follow scroll input directly to avoid perceived lag while user is actively scrolling.
      currentProgress = targetScrollProgress;
    } else {
      const smoothBlend = 1 - Math.exp(-SCROLL_DAMPING * dt);
      currentProgress = lerp(currentProgress, targetScrollProgress, smoothBlend);
      if (Math.abs(currentProgress - targetScrollProgress) < 0.0002) {
        currentProgress = targetScrollProgress;
      }
    }
    const entryProgress = rangeProgress(currentProgress, CAMERA_TRAVEL.entryStart, CAMERA_TRAVEL.entryEnd);
    const travelProgress = entryProgress; // remove extra easing layer from camera travel
    const cameraZ = CAM_Z0 - travelProgress * MAX_TRAVEL;
    const lookAhead = lerp(17.6, 20, travelProgress);
    const verticalBlend = clamp01((currentProgress - ENTRY_LOCK_PROGRESS) / (1 - ENTRY_LOCK_PROGRESS));
    const lookY = lerp(ENTRY_LOOK_Y, CAM_Y + 0.3, verticalBlend);
    const fovBlend = clamp01((currentProgress - ENTRY_LOCK_PROGRESS) / (1 - ENTRY_LOCK_PROGRESS));
    const fov = lerp(ENTRY_FOV, CRUISE_FOV, fovBlend);

    if (Math.abs(camera.fov - fov) > 0.08) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }

    camera.position.set(
      0,
      lerp(ENTRY_CAMERA_Y, CAM_Y + Math.sin(travelProgress * Math.PI * 0.5) * 0.1, verticalBlend),
      cameraZ
    );
    camera.lookAt(0, lookY, cameraZ - lookAhead);

    const scrollActive = isScrollActive();
    cardMeshes.forEach((card, i) => {
      card.group.position.y = CARD.y + Math.sin(time + i * 0.7) * 0.02;
      card.doorCurrent = lerp(card.doorCurrent, card.doorTarget, 0.08);
      card.doorPivot.rotation.y = card.doorCurrent;
    });

    if (endLogo) {
      endLogo.visible = true;
      endLogo.material.opacity = 1;
      endLogo.position.y = scrollActive ? 1.12 : 1.12 + Math.sin(time * 2.8) * 0.06;
      const pulse = scrollActive ? 0.5 : (Math.sin(time * 2.6) + 1) * 0.5;
      const breathe = lerp(0.92, 1.16, pulse);
      endLogo.scale.set(breathe, breathe, 1);
    }

    if (scrollActive) {
      hideGifHoverOverlay();
    } else if (hoveredAnimatedCard && gifHoverOverlay && gifHoverOverlay.style.display !== 'none') {
      updateGifHoverOverlayPosition();
    }

    renderer.render(scene, camera);
  }

  function onResize() {
    if (!camera || !renderer) return;
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    applyRendererSizing();
  }

  function applyRendererSizing() {
    if (!renderer) return;
    renderer.setSize(innerWidth, innerHeight);
    const dprCap = innerWidth <= 768 ? 1.15 : 1.35;
    renderer.setPixelRatio(Math.min(devicePixelRatio, dprCap));
  }

  return {
    init,
    setScrollProgress,
  };
})();
