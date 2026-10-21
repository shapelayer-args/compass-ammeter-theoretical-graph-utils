/** Native popovers supply outside-click dismissal, Escape, and focus restoration. */
export function installMenus() {
  const entries = ['file', 'view'].map(name => ({
    button: document.getElementById(`${name}-menu-toggle`),
    menu: document.getElementById(`${name}-menu`)
  }));
  function position({ button, menu }) {
    const rect = button.getBoundingClientRect();
    const width = Math.min(menu.offsetWidth || (menu.id === 'file-menu' ? 340 : 240), window.innerWidth - 16);
    menu.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`;
    menu.style.top = `${rect.bottom + 6}px`;
  }
  for (const entry of entries) {
    const { button, menu } = entry;
    menu.addEventListener('beforetoggle', event => {
      if (event.newState === 'open') position(entry);
    });
    menu.addEventListener('toggle', event => {
      button.setAttribute('aria-expanded', String(event.newState === 'open'));
    });
    button.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown') {
        event.preventDefault(); menu.showPopover();
        menu.querySelector('input:not([type=file]), button:not(:disabled)')?.focus();
      } else if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
        const other = entries.find(item => item !== entry);
        if (menu.matches(':popover-open')) { menu.hidePopover(); other.menu.showPopover(); }
        other.button.focus();
      }
    });
  }
  window.addEventListener('resize', () => {
    for (const entry of entries) if (entry.menu.matches(':popover-open')) position(entry);
  });
}
