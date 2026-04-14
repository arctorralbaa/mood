/*
   Main - Initialize all modules
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
  IntroScreen.init();
  TunnelScene.init();
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