/*
   Light Switch Module
   Portal entry is scroll-only; the O is no longer clickable.
    */
const LightSwitch = (() => {
  let switchEl;

  function init() {
    switchEl = document.getElementById('o-portal');

    if (!switchEl) return;

    switchEl.style.pointerEvents = 'none';
    switchEl.style.cursor = 'default';
    switchEl.removeAttribute('tabindex');
    switchEl.removeAttribute('role');
  }

  return { init };
})();
