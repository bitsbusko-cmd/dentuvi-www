/* Dentuvi, strona produktu: menu, bieżąca sekcja, wejścia przy przewijaniu, formularz prezentacji */
{
  const doc = document;
  const body = doc.body;

  /* menu na wąskich ekranach */
  const menuBtn = doc.querySelector('.menu-btn');
  const menu = doc.getElementById('menu');
  const setMenu = open => {
    body.classList.toggle('nav-open', open);
    if (menuBtn) {
      menuBtn.setAttribute('aria-expanded', String(open));
      menuBtn.setAttribute('aria-label', open ? 'Zamknij menu' : 'Otwórz menu');
    }
  };
  if (menuBtn && menu) {
    menuBtn.addEventListener('click', () => setMenu(!body.classList.contains('nav-open')));
    menu.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
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
        say('ok', `Dziękujemy${firstName ? ', ' + firstName : ''}. Odezwiemy się, aby ustalić termin prezentacji.`);
      } catch (err) {
        say('no', 'Nie udało się wysłać formularza. Spróbuj ponownie albo napisz na kontakt@dentuvi.pl.');
      } finally {
        submit.disabled = false;
        submit.textContent = 'Umów prezentację';
      }
    });
  }
}
