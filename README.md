# dentuvi.pl

Strona produktu Dentuvi, systemu ERP dla klinik stomatologicznych i ortodontycznych. Statyczny serwis z małym Workerem do obsługi formularza, publikowany na Cloudflare pod adresem https://dentuvi.pl. Aplikacja działa osobno pod https://erp.dentuvi.pl.

## Struktura

```
src/                          źródła stron (tu wprowadzaj zmiany)
  index.html                  strona główna; obrazy jako znaczniki <!--IMG nazwa sizes="…" alt="…"-->
  polityka-prywatnosci.html   polityka prywatności (uzupełnij dane administratora)
  404.html                    strona błędu
tools/build.py                buduje src/*.html do public/: img z srcset i wymiarami, JSON-LD z FAQ, polska typografia
worker/index.js               Worker: POST /api/demo wysyła zgłoszenie z formularza e-mailem, resztę serwują zasoby statyczne
public/                       gotowy serwis (to publikuje Cloudflare)
  assets/css/site.css         style
  assets/js/site.js           menu mobilne, wejścia sekcji, formularz prezentacji
  assets/fonts/               Instrument Sans i Source Sans 3 (licencja OFL), podzbiór z polskimi znakami
  assets/img/app/             ekrany aplikacji, każdy w dwóch rozmiarach WebP
  assets/img/og-dentuvi.png   obraz do udostępnień 1200×630
  _headers                    nagłówki bezpieczeństwa (CSP, HSTS) i cache
  _redirects                  /logowanie i /login → erp.dentuvi.pl, /prezentacja → formularz
  robots.txt, sitemap.xml, llms.txt, site.webmanifest, .well-known/security.txt
wrangler.jsonc                konfiguracja Workera: zasoby z public/, wysyłka e-maili, limit zgłoszeń
```

Ekrany w `assets/img/app/` to zrzuty prawdziwej aplikacji Dentuvi 1.6.1 uruchomionej lokalnie z danymi demonstracyjnymi. Nie zawierają danych rzeczywistych pacjentów.

Fonty są hostowane lokalnie, bez Google Fonts, więc strona nie przekazuje danych odwiedzających zewnętrznym serwisom i nie potrzebuje banera cookie.

## Zmiany treści

```
pip install pillow
python3 tools/build.py
```

Skrypt nadpisuje `public/index.html`, `public/polityka-prywatnosci.html` i `public/404.html`. Pliki w `public/` są wersjonowane, więc publikacja nie wymaga kroku budowania.

## Podgląd lokalny

```
npm install
npx wrangler dev
```

Lokalnie formularz działa w pełni, a wiadomości zamiast wysyłki trafiają do plików w `.wrangler/tmp/email/`. Sam podgląd stron bez Workera: `cd public && python3 -m http.server 8080` (formularz pokaże wtedy komunikat trybu podglądu).

## Publikacja na Cloudflare

1. Workers & Pages › Create › Import a repository i wybierz to repozytorium.
2. Polecenie budowania zostaw puste, polecenie wdrożenia: `npx wrangler deploy`.
3. W ustawieniach Workera dodaj własne domeny `dentuvi.pl` i `www.dentuvi.pl`.

Jeśli w DNS strefy dentuvi.pl jest rekord kierujący na stronę parkingową rejestratora, usuń go przed podpięciem domeny. Przekierowanie `www.dentuvi.pl` → `dentuvi.pl` ustaw regułą przekierowania (Rules › Redirect Rules).

## Formularz „Umów prezentację”

Worker przyjmuje zgłoszenie pod `POST /api/demo`, sprawdza dane, odrzuca boty (pole-pułapka, najwyżej 5 zgłoszeń na minutę z jednego adresu IP) i wysyła wiadomość przez Cloudflare Email Service. Odpowiedź na wiadomość trafia bezpośrednio do osoby, która wypełniła formularz. Formularz działa tylko na domenie dentuvi.pl; w podglądzie niczego nie wysyła.

Konfiguracja w panelu Cloudflare (strefa dentuvi.pl › Email › Email Routing):

1. Włącz Email Routing. Cloudflare doda rekordy MX i SPF.
2. W Destination addresses dodaj skrzynkę, na którą ma trafiać poczta, i potwierdź ją linkiem z wiadomości weryfikacyjnej.
3. Utwórz adres `kontakt@dentuvi.pl` przekierowujący na tę skrzynkę.
4. Ustaw adresata zgłoszeń w `wrangler.jsonc` (`vars.DEMO_TO`). Bez planu płatnego Workers można wysyłać tylko na zweryfikowane adresy docelowe, więc jeśli `kontakt@dentuvi.pl` jest przekierowaniem, wpisz tu skrzynkę docelową z punktu 2. Zgłoszenia trafią tam, gdzie cała poczta z `kontakt@dentuvi.pl`. Na planie płatnym, po dodaniu domeny w Email Sending, można zostawić `kontakt@dentuvi.pl`.

Nadawcą jest `formularz@dentuvi.pl` (`vars.DEMO_FROM`), czyli adres w domenie z włączonym Email Routing. Błędy wysyłki widać w logach Workera (Observability), bez danych osobowych.

## Przed publikacją

- [ ] Dane administratora (nazwa firmy, adres, NIP) w `src/polityka-prywatnosci.html`, potem `python3 tools/build.py`
- [ ] Email Routing z adresem `kontakt@dentuvi.pl` i adresat zgłoszeń (sekcja „Formularz”), potem test formularza na dentuvi.pl
- [ ] Opcjonalnie Cloudflare Web Analytics bez plików cookie (CSP już na to pozwala)
- [ ] Zgłoszenie mapy strony w Google Search Console
