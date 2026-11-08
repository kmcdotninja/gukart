// The game's own arrows: filled shapes on a 24 grid in currentColor, the same family as every other icon. Never use a
// text glyph for an arrow (← → ‹ › ◀ ▶ ↓): those come out in whatever the font has and look generated.
export const ARROW =
  'M13.4 4.6a1.5 1.5 0 0 1 2.1 0l6.3 6.3a1.6 1.6 0 0 1 0 2.2l-6.3 6.3a1.5 1.5 0 1 1-2.1-2.1l3.7-3.8H3.5a1.5 1.5 0 0 1 0-3h13.6l-3.7-3.8a1.5 1.5 0 0 1 0-2.1z'; // points right
export const CHEVRON =
  'M8.9 4.4a1.6 1.6 0 0 1 2.3 0l6.4 6.4a1.7 1.7 0 0 1 0 2.4l-6.4 6.4a1.6 1.6 0 1 1-2.3-2.3l5.3-5.3-5.3-5.3a1.6 1.6 0 0 1 0-2.3z'; // points right
const svg = (body, cls = '') =>
  `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">${body}</svg>`;
export const ICON = {
  right: svg(`<path d="${ARROW}"/>`),
  left: svg(`<path d="${ARROW}"/>`, 'flip'),
  down: svg(`<path d="${ARROW}"/>`, 'down'),
  up: svg(`<path d="${ARROW}"/>`, 'up'),
  chevR: svg(`<path d="${CHEVRON}"/>`),
  chevL: svg(`<path d="${CHEVRON}"/>`, 'flip'),
  pause: svg(
    '<rect x="6" y="4.5" width="4.4" height="15" rx="1.4"/><rect x="13.6" y="4.5" width="4.4" height="15" rx="1.4"/>',
  ),
};
