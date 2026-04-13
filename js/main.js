/* 
   Main – Initialize All Modules
    */
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

function resetToHero() {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

resetToHero();

document.addEventListener('DOMContentLoaded', () => {
  resetToHero();

  // Intro screen (light switch entrance)
  IntroScreen.init();

  // Light switch (2nd O hotspot)
  LightSwitch.init();

  // Three.js tunnel scene
  TunnelScene.init();

  // Scroll transitions (hero → tunnel)
  ScrollManager.init();
});

window.addEventListener('load', () => {
  resetToHero();
});

window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    resetToHero();
  }
});

window.addEventListener('beforeunload', () => {
  resetToHero();
});
