// The world map, after NFS: a top-down satellite view of the island rendered from the real scene, every place on it
// labelled where it actually is, tabs to filter, a card for whatever you tap. Drag to pan.
// It shows one race's map: the circuit you have chosen (no world map, no flying between cities). `title` names it.
export function buildMap(root, { places, onAction, wallet, onPan, islands = [], onIsland = () => {}, title = '' }) {
  const tabs = [
    ['all', 'ALL'],
    ['race', 'RACES'],
    ['place', 'LANDMARKS'],
  ];
  let filter = 'all',
    sel = places.find(p => p.kind === 'race') || places[0];
  root.innerHTML = `
    <div class="nfs-map" id="nfsMap"><div class="nfs-pins" id="nfsPins"></div></div>
    <header class="nfs-top">
      <button class="sq-btn" id="mapBack" aria-label="Back"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M15.1 4.4a1.6 1.6 0 0 1 0 2.3L9.8 12l5.3 5.3a1.6 1.6 0 1 1-2.3 2.3l-6.4-6.4a1.7 1.7 0 0 1 0-2.4l6.4-6.4a1.6 1.6 0 0 1 2.3 0z"/></svg></button>
      ${title ? `<b class="nfs-title">${title}</b>` : ''}
      <nav class="nfs-tabs">${tabs.map(([k, t]) => `<button data-tab="${k}">${t}</button>`).join('')}</nav>
      <div class="wallet"><i class="coin-icon"></i><span>${wallet}</span></div>
    </header>
    <div class="nfs-card" id="nfsCard"></div>
    ${islands.length ? '' : '<!-- no island list: the map is one race -->'}<nav class="isl-list" aria-label="Islands" ${islands.length ? '' : 'hidden'}>${islands.map((is, i) => `<button class="isl ${is.open || is.built ? 'open' : ''} ${is.open ? 'sel' : ''}" data-isl="${i}" data-city="${is.city}"><b>${is.name}</b>${is.open || is.built ? '' : '<small>SOON</small>'}</button>`).join('')}</nav>`;
  const pins = root.querySelector('#nfsPins'),
    card = root.querySelector('#nfsCard');
  const ICON = {
    race: '<svg viewBox="0 0 24 24"><path d="M5 3v18" stroke="currentColor" stroke-width="2.2"/><path d="M6 4h13l-3 4 3 4H6z" fill="currentColor"/><path d="M8 4h3v4H8zM11 8h3v4h-3zM14 4h3v4h-3z" fill="#0b1330"/></svg>',
    garage:
      '<svg viewBox="0 0 24 24"><path d="M3 10l9-6 9 6v10H3z" fill="currentColor"/><path d="M7 20v-7h10v7M7 15h10M7 17h10" stroke="#0b1330" stroke-width="1.6"/></svg>',
    place:
      '<svg viewBox="0 0 24 24"><circle cx="12" cy="10" r="6" fill="currentColor"/><path d="M12 22l-5-7h10z" fill="currentColor"/><circle cx="12" cy="10" r="2.4" fill="#0b1330"/></svg>',
    island:
      '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="17" rx="9" ry="3.4" fill="currentColor"/><path d="M12 16V7M12 7c-3-2-6-1-7 1 3-1 5 0 7-1zm0 0c3-2 6-1 7 1-3-1-5 0-7-1z" stroke="currentColor" stroke-width="1.8" fill="currentColor"/></svg>',
  };
  function paint() {
    root.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === filter));
    pins.innerHTML = places
      .filter(p => filter === 'all' || p.kind === filter || (filter === 'race' && p.kind === 'garage'))
      .map(
        (p, i) => `
      <button class="pin ${p.kind} ${p === sel ? 'sel' : ''}" data-i="${places.indexOf(p)}" >
        <i>${ICON[p.kind]}</i><span>${p.name}</span>${p.isNew ? '<em>NEW</em>' : ''}</button>`,
      )
      .join('');
    card.innerHTML = `<div class="nfs-card-h">${sel.kind === 'race' ? 'RACE' : sel.kind === 'garage' ? 'GARAGE' : sel.kind === 'island' ? 'ISLAND' : 'LANDMARK'}</div>
      ${sel.img ? `<img src="${sel.img}" alt="">` : ''}
      <div class="nfs-card-b"><b>${sel.name}</b><span>${sel.sub || ''}</span>
      ${sel.action ? `<button class="btn primary" id="mapAct">${sel.action}</button>` : ''}</div>`;
    card.querySelector('#mapAct')?.addEventListener('click', () => onAction(sel));
  }
  const islEls = [...root.querySelectorAll('.isl')];
  const pickIsland = i => {
    islEls.forEach((el, k) => el.classList.toggle('sel', k === i));
    islEls[i].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    const is = islands[i];
    sel = is.open ? places.find(p => p.kind === 'race') : places.find(p => p.island === is) || sel;
    paint();
    if (!is.open && is.built)
      card.innerHTML = `<div class="nfs-card-h">TRAVEL</div><div class="nfs-card-b"><b>${is.name}</b><span>Chapter ${is.ch} · flying there now</span></div>`; // on the way to another city: the card says where
    card.classList.remove('enter');
    void card.offsetWidth;
    card.classList.add('enter');
    onIsland(is);
  };
  root.addEventListener('click', e => {
    const t = e.target.closest('[data-tab]');
    if (t) {
      filter = t.dataset.tab;
      paint();
      return;
    }
    const il = e.target.closest('.isl');
    if (il) {
      const is = islands[+il.dataset.isl];
      if (is.open || is.built) pickIsland(+il.dataset.isl);
      else {
        il.classList.remove('nope');
        void il.offsetWidth;
        il.classList.add('nope');
      }
      return;
    }
    const p = e.target.closest('.pin');
    if (p && !dragged) {
      sel = places[+p.dataset.i];
      paint();
      card.classList.remove('enter');
      void card.offsetWidth;
      card.classList.add('enter');
    }
  });
  // drag to pan the live camera
  const view = root.querySelector('#nfsMap');
  let lx = 0,
    ly = 0,
    down = false,
    dragged = false;
  view.addEventListener('pointerdown', e => {
    if (e.target.closest('.pin')) return;
    down = true;
    dragged = false;
    lx = e.clientX;
    ly = e.clientY;
  });
  addEventListener('pointermove', e => {
    if (!down) return;
    const dx = e.clientX - lx,
      dy = e.clientY - ly;
    if (Math.abs(dx) + Math.abs(dy) > 3) dragged = true;
    lx = e.clientX;
    ly = e.clientY;
    onPan(dx, dy);
  });
  addEventListener('pointerup', () => {
    down = false;
    setTimeout(() => {
      dragged = false;
    }, 0);
  });
  paint();
  // each frame: put every pin over its place in the live view
  return {
    place(project) {
      pins.querySelectorAll('.pin').forEach(el => {
        const p = places[+el.dataset.i],
          q = project(p.x, p.z);
        el.style.left = q.x + 'px';
        el.style.top = q.y + 'px';
        el.style.display = q.on ? '' : 'none';
      });
    },
  };
}
