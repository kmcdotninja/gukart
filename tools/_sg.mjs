import { chromium } from 'playwright';
import { preview } from 'vite';
const [out, circs = 'marina,gardens,river,heritage', nights = '1,0'] = process.argv.slice(2);
const server = await preview({ preview: { port: 4174, strictPort: true, host: '127.0.0.1' }, logLevel: 'silent' });
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const circ of circs.split(','))
  for (const night of nights.split(',')) {
    const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
    const errs = [];
    p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
    p.on('console', m => {
      if (m.type() === 'error' || /blocked|warn/i.test(m.text())) errs.push(m.type() + ' ' + m.text().slice(0, 200));
    });
    await p.addInitScript(
      ([c, n]) => {
        localStorage.clear();
        localStorage.setItem('gukart.city', '"singapore"');
        localStorage.setItem('gukart.circuit.singapore', JSON.stringify(c));
        localStorage.setItem('gukart.night', n === '1' ? 'true' : 'false');
      },
      [circ, night],
    );
    const t0 = Date.now();
    await p.goto('http://127.0.0.1:4174/?gktest#capture');
    try {
      await p.waitForFunction(() => document.querySelector('#loading')?.classList.contains('done'), null, {
        timeout: 240000,
      });
    } catch {
      console.log(circ, 'NO LOAD', errs.slice(0, 8).join('\n'));
      await p.close();
      continue;
    }
    console.log(
      circ,
      'night',
      night,
      'loaded in',
      ((Date.now() - t0) / 1000).toFixed(1),
      's',
      errs.length ? '\n  ' + errs.slice(0, 10).join('\n  ') : '',
    );
    await p.waitForTimeout(800);
    const places = await p.evaluate(() =>
      (window.gukart.game.world.places || []).map(x => ({
        name: x.name,
        s: x.s,
        x: x.x,
        y: x.y,
        z: x.z,
        lookH: x.lookH,
        back: x.back,
      })),
    );
    console.log('  places:', places.map(x => x.name).join(', '));
    // hide the UI, then look at each place from the road behind it
    await p.evaluate(() => {
      for (const e of document.querySelectorAll('body > *:not(canvas)'))
        if (e.tagName !== 'CANVAS' && !e.querySelector('canvas')) e.style.visibility = 'hidden';
    });
    let n = 0;
    for (const pl of places) {
      await p.evaluate(pl => {
        const { game, cam, renderer, scene } = window.gukart,
          tr = game.track;
        window.gukart.frozen = true;
        const s0 = pl.s - (pl.back || 30) - 25,
          q = tr.point(s0, 0);
        cam.position.set(q.x, q.y + 6, q.z);
        cam.lookAt(pl.x, (pl.y || 0) + (pl.lookH || 10), pl.z);
        cam.fov = 70;
        cam.updateProjectionMatrix();
        renderer.render(scene, cam);
      }, pl);
      await p.screenshot({
        path: `${out}/${circ}-${night}-${String(n++).padStart(2, '0')}.jpg`,
        type: 'jpeg',
        quality: 78,
      });
    }
    // and one from high above the whole circuit
    await p.evaluate(() => {
      const { game, cam, renderer, scene } = window.gukart,
        tr = game.track,
        c = tr.center;
      cam.position.set(c.x + tr.radius * 0.9, tr.radius * 1.1, c.z + tr.radius * 0.9);
      cam.lookAt(c.x, 0, c.z);
      cam.fov = 55;
      cam.far = 20000;
      cam.updateProjectionMatrix();
      renderer.render(scene, cam);
    });
    await p.screenshot({ path: `${out}/${circ}-${night}-air.jpg`, type: 'jpeg', quality: 78 });
    await p.close();
  }
await b.close();
await server.close();
