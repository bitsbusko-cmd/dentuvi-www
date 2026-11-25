/* Dentuvi, strona produktu: menu, bieżąca sekcja, wejścia przy przewijaniu, formularz prezentacji */
{
  const doc = document;
  const body = doc.body;

  /* menu na wąskich ekranach */
  const menuBtn = doc.querySelector('.menu-btn');
  const menu = doc.getElementById('menu');
  // treść pod otwartym menu jest nieaktywna: fokus i kliknięcia zostają w menu
  const behind = [doc.getElementById('tresc'), doc.querySelector('.ftr')].filter(Boolean);
  const scrim = doc.querySelector('.nav-scrim');
  const setMenu = open => {
    body.classList.toggle('nav-open', open);
    behind.forEach(el => { el.inert = open; });
    if (scrim) scrim.hidden = !open;
    if (menuBtn) {
      menuBtn.setAttribute('aria-expanded', String(open));
      menuBtn.setAttribute('aria-label', open ? 'Zamknij menu' : 'Otwórz menu');
    }
  };
  if (menuBtn && menu) {
    menuBtn.addEventListener('click', () => {
      const open = !body.classList.contains('nav-open');
      setMenu(open);
      if (open) { const first = menu.querySelector('a'); if (first) first.focus({ preventScroll: true }); }
    });
    menu.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
    if (scrim) scrim.addEventListener('click', () => setMenu(false));
    window.addEventListener('keydown', e => { if (e.key === 'Escape' && body.classList.contains('nav-open')) { setMenu(false); menuBtn.focus(); } });
    const wide = window.matchMedia('(min-width: 1061px)');
    if (wide.addEventListener) wide.addEventListener('change', e => { if (e.matches) setMenu(false); });
  }

  /* bieżąca sekcja w nawigacji */
  if (menu && 'IntersectionObserver' in window) {
    const links = [...menu.querySelectorAll('a[href^="#"]')];
    const byId = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
    const sectionObserver = new IntersectionObserver(entries => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        links.forEach(a => a.removeAttribute('aria-current'));
        const a = byId.get(en.target.id);
        if (a) a.setAttribute('aria-current', 'true');
      }
    }, { rootMargin: '-45% 0px -50% 0px' });
    byId.forEach((a, id) => { const s = doc.getElementById(id); if (s) sectionObserver.observe(s); });
  }

  /* wejścia przy przewijaniu: ukrywamy tylko to, co jest jeszcze poniżej ekranu */
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const items = [...doc.querySelectorAll('.rv')];
  if (!calm && items.length && 'IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(entries => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        en.target.classList.remove('pre');
        revealObserver.unobserve(en.target);
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    const fold = window.innerHeight * 0.95;
    for (const el of items) {
      if (el.getBoundingClientRect().top > fold) { el.classList.add('pre'); revealObserver.observe(el); }
    }
  }

  /* formularz prezentacji */
  const form = doc.getElementById('demo-form');
  if (form) {
    const msg = doc.getElementById('form-msg');
    const submit = form.querySelector('button[type="submit"]');
    const live = /(^|\.)dentuvi\.pl$/i.test(window.location.hostname);
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    const rules = {
      name: v => v.trim().length >= 2,
      clinic: v => v.trim().length >= 2,
      email: v => emailRe.test(v.trim())
    };
    const show = (field, ok) => {
      const wrap = field.closest('.fld');
      if (!wrap) return;
      wrap.classList.toggle('bad', !ok);
      field.setAttribute('aria-invalid', String(!ok));
      const err = doc.getElementById(field.id + '-err');
      if (err) { if (ok) field.removeAttribute('aria-describedby'); else field.setAttribute('aria-describedby', err.id); }
    };
    const check = field => {
      const rule = rules[field.name];
      if (!rule) return true;
      const ok = rule(field.value);
      show(field, ok);
      return ok;
    };
    const consent = doc.getElementById('f-consent');
    const consentWrap = doc.getElementById('f-consent-wrap');
    const checkConsent = () => {
      const ok = consent.checked;
      consentWrap.classList.toggle('bad', !ok);
      consent.setAttribute('aria-invalid', String(!ok));
      return ok;
    };
    for (const name of Object.keys(rules)) {
      const f = form.elements[name];
      f.addEventListener('blur', () => { if (f.value) check(f); });
      f.addEventListener('input', () => { if (f.closest('.fld').classList.contains('bad')) check(f); });
    }
    consent.addEventListener('change', () => { if (consentWrap.classList.contains('bad')) checkConsent(); });

    const say = (kind, text) => { msg.className = 'form-msg ' + kind; msg.textContent = text; };

    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (form.elements.website && form.elements.website.value) return;
      const fields = Object.keys(rules).map(n => form.elements[n]);
      const results = fields.map(check);
      const consentOk = checkConsent();
      if (results.includes(false) || !consentOk) {
        const first = fields[results.indexOf(false)] || consent;
        first.focus();
        say('no', 'Uzupełnij zaznaczone pola, aby umówić prezentację.');
        return;
      }
      const data = Object.fromEntries(new FormData(form));
      delete data.website;
      const firstName = String(data.name || '').trim().split(/\s+/)[0];
      if (!live) {
        say('info', 'To podgląd strony, dlatego dane nie zostały wysłane. Na dentuvi.pl zgłoszenie trafi na adres kontakt@dentuvi.pl.');
        return;
      }
      submit.disabled = true;
      submit.textContent = 'Wysyłanie…';
      try {
        const res = await fetch(form.action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (!res.ok) throw new Error(String(res.status));
        form.classList.add('sent');
        say('ok', `Dziękujemy${firstName ? ', ' + firstName : ''}. Skontaktujemy się z Tobą, aby ustalić termin prezentacji.`);
      } catch (err) {
        say('no', 'Nie udało się wysłać formularza. Spróbuj ponownie albo napisz na kontakt@dentuvi.pl.');
      } finally {
        submit.disabled = false;
        submit.textContent = 'Poproś o prezentację';
      }
    });
  }
}

// Powiększanie ekranów z sekcji Funkcje: okno podglądu ze strzałkami, Esc i gestem przesunięcia
(() => {
  const lb = document.getElementById('lb');
  const triggers = [...document.querySelectorAll('.zoom')];
  if (!lb || !triggers.length || typeof lb.showModal !== 'function') return;
  const fig = lb.querySelector('.lb-fig');
  const img = document.createElement('img');
  img.className = 'lb-img';
  img.decoding = 'async';
  fig.prepend(img);
  const title = lb.querySelector('.lb-cap b');
  const desc = lb.querySelector('.lb-cap span');
  const count = lb.querySelector('.lb-count');
  const items = triggers.map((t) => {
    const tile = t.closest('.tile');
    return {
      src: t.dataset.full, w: t.dataset.fw, h: t.dataset.fh,
      alt: (t.querySelector('img') || {}).alt || '',
      title: tile.querySelector('h3').textContent,
      desc: tile.querySelector('p').textContent,
    };
  });
  let i = 0;
  let swiped = false;
  const at = (k) => items[(k + items.length) % items.length];
  const preload = (k) => { const im = new Image(); im.src = at(k).src; };

  function show(k) {
    i = (k + items.length) % items.length;
    const d = items[i];
    img.classList.add('swap');
    img.onload = () => img.classList.remove('swap');
    img.width = d.w; img.height = d.h; img.alt = d.alt;
    img.src = d.src;
    if (img.complete) img.classList.remove('swap');
    title.textContent = d.title;
    desc.textContent = d.desc;
    count.textContent = (i + 1) + ' z ' + items.length;
    preload(i + 1); preload(i - 1);
  }

  triggers.forEach((t, k) => t.addEventListener('click', () => { show(k); lb.showModal(); }));
  lb.querySelector('.lb-close').addEventListener('click', () => lb.close());
  lb.querySelector('.lb-prev').addEventListener('click', () => show(i - 1));
  lb.querySelector('.lb-next').addEventListener('click', () => show(i + 1));
  lb.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); show(i + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(i - 1); }
  });
  lb.addEventListener('click', (e) => {
    if (swiped) { swiped = false; return; }
    if (e.target === lb || e.target.classList.contains('lb-in') || e.target === fig) lb.close();
  });
  let x0 = null;
  lb.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') x0 = e.clientX; });
  lb.addEventListener('pointerup', (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0; x0 = null;
    if (Math.abs(dx) > 50) { swiped = true; show(i + (dx < 0 ? 1 : -1)); setTimeout(() => { swiped = false; }, 350); }
  });
})();

