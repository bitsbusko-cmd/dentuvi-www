// Worker strony dentuvi.pl.
// Zasoby statyczne serwuje Cloudflare z katalogu public/. Worker obsługuje tylko formularz
// „Umów prezentację” (POST /api/demo) i przekazuje zgłoszenie e-mailem na adres kontaktowy.

const ROOMS = { '1': '1 gabinet', '2-3': '2–3 gabinety', '4-6': '4–6 gabinetów', '7+': '7 gabinetów i więcej' };
const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;
const MAX_BODY = 16 * 1024;

function reply(status, body, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...extra,
    },
  });
}

// Usuwa znaki sterujące (poza nową linią w treści wiadomości) i przycina długość.
function text(value, max) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, ' ')
    .trim()
    .slice(0, max);
}

function line(value, max) {
  return text(value, max).replace(/\s+/g, ' ');
}

async function handleDemo(request, env) {
  if (request.method !== 'POST') return reply(405, { ok: false, error: 'method' }, { allow: 'POST' });

  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== url.host) return reply(403, { ok: false, error: 'origin' });

  if (!(request.headers.get('content-type') || '').toLowerCase().includes('application/json')) {
    return reply(415, { ok: false, error: 'content-type' });
  }
  if (Number(request.headers.get('content-length') || 0) > MAX_BODY) return reply(413, { ok: false, error: 'size' });

  const raw = await request.text();
  if (raw.length > MAX_BODY) return reply(413, { ok: false, error: 'size' });

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return reply(400, { ok: false, error: 'json' });
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return reply(400, { ok: false, error: 'json' });

  // Pole-pułapka: wypełniają je tylko boty. Udajemy sukces, niczego nie wysyłamy.
  if (line(data.website, 200)) return reply(200, { ok: true });

  if (env.DEMO_LIMIT) {
    const { success } = await env.DEMO_LIMIT.limit({ key: request.headers.get('cf-connecting-ip') || 'brak-ip' });
    if (!success) return reply(429, { ok: false, error: 'rate' });
  }

  const name = line(data.name, 120);
  const clinic = line(data.clinic, 160);
  const email = line(data.email, 254).toLowerCase();
  const phone = line(data.phone, 40);
  const rooms = ROOMS[line(data.rooms, 10)] || 'nie podano';
  const message = text(data.message, 2000);
  const consent = data.consent === 'tak' || data.consent === true;

  if (name.length < 2 || clinic.length < 2 || !EMAIL.test(email) || !consent) {
    return reply(422, { ok: false, error: 'validation' });
  }

  if (!env.MAIL) {
    console.error('Brak powiązania MAIL (send_email) w konfiguracji Workera');
    return reply(503, { ok: false, error: 'mail' });
  }

  const sent = new Intl.DateTimeFormat('pl-PL', {
    dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Warsaw',
  }).format(new Date());

  const body = [
    'Nowe zgłoszenie z formularza „Umów prezentację” na dentuvi.pl.',
    '',
    `Imię i nazwisko: ${name}`,
    `Klinika: ${clinic}`,
    `E-mail: ${email}`,
    `Telefon: ${phone || 'nie podano'}`,
    `Liczba gabinetów: ${rooms}`,
    '',
    'Wiadomość:',
    message || '(brak)',
    '',
    'Zgoda na kontakt w sprawie prezentacji: tak',
    `Wysłano: ${sent} (czas polski)`,
    '',
    'Odpowiedź na tę wiadomość trafi bezpośrednio do osoby, która wypełniła formularz.',
  ].join('\n');

  try {
    await env.MAIL.send({
      to: env.DEMO_TO || 'kontakt@dentuvi.pl',
      from: { email: env.DEMO_FROM || 'formularz@dentuvi.pl', name: 'Formularz dentuvi.pl' },
      replyTo: { email, name },
      subject: `Prezentacja Dentuvi: ${clinic}`,
      text: body,
    });
  } catch (err) {
    // Bez danych osobowych w logach: tylko kod i opis błędu usługi.
    console.error('Wysyłka zgłoszenia nie powiodła się', err?.code || '', err?.message || '');
    return reply(502, { ok: false, error: 'send' });
  }

  return reply(200, { ok: true });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/demo') return handleDemo(request, env);
    if (pathname.startsWith('/api/')) return reply(404, { ok: false, error: 'not-found' });
    return env.ASSETS.fetch(request);
  },
};
