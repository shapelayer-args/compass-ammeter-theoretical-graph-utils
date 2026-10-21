import { clamp } from "../utils.js";
export function installPanels({ $, panel }) {
  function panelTab(name) {
    if(document.body.classList.contains('presenting')) $('present').click();
    document.body.classList.remove('panel-closed');
    $('panel-toggle').setAttribute('aria-expanded', 'true');
    document.querySelectorAll('[data-panel-tab]').forEach(button => {
      const active = button.dataset.panelTab === name;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
      $('panel-' + button.dataset.panelTab).hidden = !active;
    });
  }
  function togglePanel() {
    if(document.body.classList.contains('presenting')) { $('present').click(); panelTab('animation'); return; }
    const closed = document.body.classList.toggle('panel-closed');
    $('panel-toggle').setAttribute('aria-expanded', String(!closed));
    if (closed) $('panel-toggle').focus();
  }
  $('panel-toggle').addEventListener('click', togglePanel);
  $('panel-close').addEventListener('click', togglePanel);
  document.querySelectorAll('[data-panel-tab]').forEach(button => {
    button.addEventListener('click', () => panelTab(button.dataset.panelTab));
    button.addEventListener('keydown', event => {
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault();
      const buttons = [...document.querySelectorAll('[data-panel-tab]')];
      const index = buttons.indexOf(button);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
      panelTab(buttons[next].dataset.panelTab); buttons[next].focus();
    });
  });
  let resizing = null;
  function panelWidth(width) {
    width = clamp(width, 280, 520);
    $('workbench').style.setProperty('--panel-width', width + 'px');
    $('panel-splitter').setAttribute('aria-valuenow', Math.round(width));
  }
  $('panel-splitter').addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    resizing = { x: event.clientX, width: panel.getBoundingClientRect().width, pointer: event.pointerId };
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
  });
  $('panel-splitter').addEventListener('pointermove', event => {
    if (resizing && resizing.pointer === event.pointerId) panelWidth(resizing.width + resizing.x - event.clientX);
  });
  ['pointerup','pointercancel','lostpointercapture'].forEach(type => $('panel-splitter').addEventListener(type, () => { resizing = null; }));
  $('panel-splitter').addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    panelWidth(event.key === 'Home' ? 280 : event.key === 'End' ? 520 : panel.getBoundingClientRect().width + (event.key === 'ArrowLeft' ? 20 : -20));
  });

return { panelTab };
}
