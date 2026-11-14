// The results card: your place and the standings (or your laps in Time Trial), the prize, and the coins flying into the bank.
import { Haptics } from './haptics.js';
import { Sound } from './audio.js';
import { store, fmtTime, ordinal } from './util.js';
import { $, whip, show } from './dom.js';
import { chapter, game } from './game.js';
import { TT, FREE } from './timetrial.js';
import { afterCupRace } from './cup.js';
import { earn } from './chest.js';

// Free drive has no finish line: ending the drive banks the coins
export function endDrive() {
  game.state = 'results';
  game.replay = null; // (the replay behind the results starts from its first shot)
  game.race.player.ai = true;
  game.resultsTimer = 0;
  const p = game.race.player,
    from = store.get('wallet', 0),
    total = p.coins;
  earn(total);
  $('#hud').hidden = true;
  whip(1);
  show($('#results'));
  $('#results .tag span').textContent = `${game.PLACE}`;
  $('.place-big').hidden = true;
  $('#resChapter').textContent = 'DRIVE OVER';
  $('#standings').innerHTML = '';
  $('#standings').className = 'standings';
  $('#resStats').innerHTML = [
    ['Time', fmtTime(game.race.time)],
    ['Laps', Math.max(0, p.lap)],
    ['Top speed', `${Math.round(FREE.top * 3.2)} km/h`],
  ]
    .map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`)
    .join('');
  $('#resWallet').textContent = from.toLocaleString('en');
  $('#prize').innerHTML = p.coins
    ? `<div class="pz"><span>PRIZE</span><b><i class="coin-icon"></i>+${p.coins}</b></div>`
    : '';
  setTimeout(() => payOut(from, total), 900);
}
export function showResults() {
  if (game.state !== 'finish' && game.state !== 'podium') return;
  game.state = 'results';
  game.replay = null; // (the replay behind the results starts from its first shot)
  $('#results .tag span').textContent = `${game.PLACE}`;
  $('.place-big').hidden = game.mode !== 'gp' && game.mode !== 'cup';
  $('#standings').className = game.mode === 'tt' ? 'standings laps' : 'standings';
  if (game.mode === 'tt') {
    // Time trial: your laps, the best one lit, a bonus for a new record
    const p = game.race.player,
      total = TT.laps.reduce((a, b) => a + b, 0),
      best = Math.min(...TT.laps),
      from = store.get('wallet', 0),
      bonus = TT.newBest ? 150 : 0,
      pay = bonus + p.coins;
    earn(pay);
    $('#hud').hidden = true;
    whip(1);
    show($('#results'));
    $('#resChapter').textContent = TT.newBest
      ? 'NEW BEST LAP'
      : `BEST LAP ${fmtTime(store.get('bestlap.' + game.RID, best))}`;
    $('#standings').innerHTML = TT.laps
      .map(
        (lt, i) =>
          `<li class="${lt === best ? 'me' : ''}"><span class="nm">LAP ${i + 1}</span><span class="t">${fmtTime(lt)}</span></li>`,
      )
      .join('');
    $('#resStats').innerHTML = [
      ['Time', fmtTime(total)],
      ['Best lap', fmtTime(best)],
    ]
      .map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`)
      .join('');
    $('#resWallet').textContent = from.toLocaleString('en');
    $('#prize').innerHTML =
      bonus + p.coins
        ? `<div class="pz"><span>PRIZE</span><b><i class="coin-icon"></i>+${bonus + p.coins}</b></div>`
        : '';
    setTimeout(() => payOut(from, pay), 900);
    return;
  }
  const p = game.race.player,
    best = store.get('best.' + game.RID, null),
    newBest = !best || p.finishTime < best;
  if (newBest) store.set('best.' + game.RID, p.finishTime);
  if (p.rank === 1) store.set('wins.' + game.vehicle, store.get('wins.' + game.vehicle, 0) + 1);
  const earned = p.rank === 1 ? 3 : p.rank <= 3 ? 2 : 1;
  if (earned > store.get('stars.' + game.RID, 0)) store.set('stars.' + game.RID, earned);
  // prize money for where you finished, plus every coin picked up on the way; it lands in the bank once the coins fly
  const PRIZE = [chapter.reward, 300, 200, 120, 80, 50],
    prize = PRIZE[p.rank - 1] ?? 30,
    from = store.get('wallet', 0),
    total = prize + p.coins;
  earn(total);
  $('#hud').hidden = true;
  whip(1);
  show($('#results'));
  $('#resPlace').textContent = p.rank;
  $('#resSfx').textContent = ordinal(p.rank).toUpperCase();
  $('#resChapter').textContent = newBest ? 'NEW BEST TIME' : '';
  $('#resStats').innerHTML = ''; // (your time is in your row of the standings; the coins are in the prize)
  paintStandings();
  $('#resWallet').textContent = from.toLocaleString('en');
  $('#prize').innerHTML = `<div class="pz"><span>PRIZE</span><b><i class="coin-icon"></i>+${total}</b></div>`; // the place prize and the coins picked up, as one
  setTimeout(() => payOut(from, total), 900);
  if (game.mode === 'cup') afterCupRace();
}
// the coins fly from the prize lines into the bank in the corner: a stream of them on a curve, each one ticking the
// total up with a chime and a buzz, the bank jumping as they land
function payOut(from, total) {
  const src = [...document.querySelectorAll('#prize .coin-icon')],
    bank = $('#resWalletChip'),
    to = bank.querySelector('.coin-icon').getBoundingClientRect();
  if (!src.length || !total) return;
  const n = Math.min(18, 6 + Math.round(total / 40)),
    reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let landed = 0;
  for (let i = 0; i < n; i++)
    setTimeout(() => {
      const a = src[i % src.length].getBoundingClientRect(),
        el = document.createElement('i');
      el.className = 'coin-icon paycoin';
      document.body.append(el);
      const x0 = a.left + a.width / 2,
        y0 = a.top + a.height / 2,
        x1 = to.left + to.width / 2,
        y1 = to.top + to.height / 2,
        lift = 80 + Math.random() * 80,
        dx = (Math.random() - 0.5) * 60;
      el.style.left = x0 + 'px';
      el.style.top = y0 + 'px';
      const kf = reduce
        ? [{ opacity: 1 }, { opacity: 0 }]
        : [
            { transform: 'translate(-50%,-50%) scale(.6)', opacity: 0 },
            {
              transform: `translate(calc(-50% + ${(x1 - x0) * 0.35 + dx}px), calc(-50% + ${(y1 - y0) * 0.35 - lift}px)) scale(1.25)`,
              opacity: 1,
              offset: 0.35,
            },
            { transform: `translate(calc(-50% + ${x1 - x0}px), calc(-50% + ${y1 - y0}px)) scale(.8)`, opacity: 1 },
          ];
      el.animate(kf, {
        duration: reduce ? 200 : 620 + Math.random() * 120,
        easing: 'cubic-bezier(.3,.1,.3,1)',
        fill: 'forwards',
      }).onfinish = () => {
        el.remove();
        landed++;
        $('#resWallet').textContent = Math.round(from + (total * landed) / n).toLocaleString('en');
        bank.classList.remove('bump');
        void bank.offsetWidth;
        bank.classList.add('bump');
        Sound.coin();
        Haptics.coin();
      };
    }, i * 70);
}
// the results card's list: the top three, big, and you under them if you weren't one of them (you're YOU, lit)
// rows: [{ place, id, name, fur, right, me }]
export function paintTop(rows) {
  const me = rows.find(r => r.me),
    list = me && me.place > 3 ? [...rows.slice(0, 3), me] : rows.slice(0, 3);
  const html = list
    .map(
      r =>
        `<li class="${r.me ? 'me' : ''} ${r.place > 3 ? 'apart' : ''}"><span class="place">${r.place}</span><span class="face" style="--c:${r.fur}"><img src="${game.FACES[r.id] || ''}" alt=""></span><span class="nm">${r.me ? 'YOU' : r.name.toUpperCase()}</span><span class="t">${r.right}</span></li>`,
    )
    .join('');
  // only when something changed: rewriting it every half second reloaded the faces, and they blinked
  const el = $('#standings');
  if (el.className === 'standings top' && el.firstChild && el._top === html) return;
  el.className = 'standings top';
  el.innerHTML = el._top = html;
}
export function paintStandings() {
  paintTop(
    game.race.rank().map(k => ({
      place: k.rank,
      id: k.def.id,
      name: k.name,
      fur: k.color,
      right: k.finished ? fmtTime(k.finishTime) : 'RACING',
      me: k === game.race.player,
    })),
  );
}
