/* 
   Intro Screen – Light Switch Entrance
   Click the switch image to turn ON and reveal the landing page
    */
const IntroScreen = (() => {
  function init() {
    const intro = document.getElementById('intro-screen');
    const switchImg = document.getElementById('switch-img');

    if (!intro || !switchImg) return;

    // Block scrolling while intro is visible
    document.body.style.overflow = 'hidden';

    switchImg.addEventListener('click', () => activate(intro, switchImg));
  }

  function activate(intro, switchImg) {
    if (intro.classList.contains('exiting')) return;
    intro.classList.add('exiting');

    // Swap to ON image
    switchImg.src = 'assets/on.webp';

    const tl = gsap.timeline();

    // Flash glow on switch
    tl.to(switchImg, {
      filter: 'drop-shadow(0 0 80px rgba(232, 224, 32, 0.8))',
      duration: 0.4,
      ease: 'power2.out',
    });

    // Dark overlay fades out (lights turning on)
    tl.to('.intro-bg', {
      opacity: 0,
      duration: 0.8,
      ease: 'power2.inOut',
    }, 0.3);

    // Switch fades and shrinks
    tl.to(switchImg, {
      opacity: 0,
      scale: 0.8,
      duration: 0.5,
      ease: 'power2.in',
      onComplete: () => {
        intro.style.display = 'none';
        intro.style.pointerEvents = 'none';
        document.body.style.overflow = '';
      }
    }, 0.5);
  }

  return { init };
})();
