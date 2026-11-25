"""Buduje strony z katalogu src/ do public/: obrazy z srcset, dane strukturalne, polska typografia.

Użycie: python3 tools/build.py   (wymaga Pillow: pip install pillow)
"""
import hashlib, json, re, html, pathlib
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'src'
PUB = ROOT / 'public'
IMG = PUB / 'assets/img/app'
SITE = 'https://dentuvi.pl/'


def img_tag(m):
    name, sizes, alt, eager = m.group(1), m.group(2), m.group(3), bool(m.group(4))
    big, small = IMG / f'{name}.webp', IMG / f'{name}-s.webp'
    wl, hl = Image.open(big).size
    ws, _ = Image.open(small).size
    attrs = [f'src="assets/img/app/{name}.webp"',
             f'srcset="assets/img/app/{name}-s.webp {ws}w, assets/img/app/{name}.webp {wl}w"',
             f'sizes="{sizes}"', f'width="{wl}"', f'height="{hl}"', f'alt="{alt}"']
    attrs += ['fetchpriority="high"', 'decoding="async"'] if eager else ['loading="lazy"', 'decoding="async"']
    return '<img ' + ' '.join(attrs) + '>'


def strip(t):
    t = re.sub(r'<svg.*?</svg>', '', t, flags=re.S)
    t = re.sub(r'<[^>]+>', '', t)
    return html.unescape(re.sub(r'\s+', ' ', t)).strip()


def jsonld(src):
    faqs = re.findall(r'<details class="qa"><summary>(.*?)</summary><p>(.*?)</p></details>', src, flags=re.S)
    assert len(faqs) == 7, len(faqs)
    data = {'@context': 'https://schema.org', '@graph': [
        {'@type': 'Organization', '@id': SITE + '#organizacja', 'name': 'Dentuvi', 'url': SITE,
         'logo': SITE + 'assets/img/logo-512.png', 'email': 'kontakt@dentuvi.pl', 'slogan': 'Where Dentistry Meets Digital Innovation'},
        {'@type': 'WebSite', '@id': SITE + '#witryna', 'url': SITE, 'name': 'Dentuvi', 'inLanguage': 'pl-PL',
         'publisher': {'@id': SITE + '#organizacja'}},
        {'@type': 'SoftwareApplication', '@id': SITE + '#aplikacja', 'name': 'Dentuvi',
         'applicationCategory': 'BusinessApplication',
         'applicationSubCategory': 'System ERP dla klinik stomatologicznych i ortodontycznych',
         'operatingSystem': 'Przeglądarka internetowa', 'url': SITE, 'inLanguage': 'pl-PL',
         'image': SITE + 'assets/img/og-dentuvi.png',
         'description': 'System ERP, który łączy organizację pracy kliniki stomatologicznej lub ortodontycznej '
                        'z danymi potrzebnymi do podejmowania lepszych decyzji: terminarz, obsługa pacjenta, magazyn, '
                        'rozliczenia i pulpit właściciela.',
         'publisher': {'@id': SITE + '#organizacja'},
         'featureList': [
             'Ekran Dziś dopasowany do roli i podpowiedzi uporządkowane według pilności',
             'Terminarz gabinetów ze stanem gabinetów na żywo',
             'Karta pacjenta z osią czasu leczenia',
             'Wizyta przy fotelu z diagramem zębów FDI',
             'Plany leczenia, ortodoncja i raty z przypomnieniami SMS',
             'Magazyn z partiami, terminami ważności i propozycjami zamówień',
             'Rejestr sterylizacji i listy kontrolne gabinetu',
             'Pulpit zarządczy, rentowność i modele rozliczeń lekarzy',
             'Grafik zespołu, nieobecności i zastępstwa',
             'Baza danych objęta jurysdykcją UE, logowanie dwuetapowe i dziennik zdarzeń',
             'Kreator wdrożenia, który staje się panelem administracyjnym']},
        {'@type': 'FAQPage', '@id': SITE + '#pytania', 'inLanguage': 'pl-PL',
         'mainEntity': [{'@type': 'Question', 'name': strip(q), 'acceptedAnswer': {'@type': 'Answer', 'text': strip(a)}} for q, a in faqs]}]}
    return '<script type="application/ld+json">\n' + json.dumps(data, ensure_ascii=False, indent=1) + '\n</script>'


NB = ' '


def typo(text):
    text = re.sub(r'(?<![\wÀ-ſ])([aiouwzAIOUWZ])\s+(?=\S)', r'\1' + NB, text)
    text = re.sub(r'(\d) (?=\d{3}(?!\d))', r'\1' + NB, text)
    text = re.sub(r'(\d) (zł|min|dni|dniach|krokach|kroków|minut|placówki|gabinety|gabinetów|gabinet)\b', r'\1' + NB + r'\2', text)
    text = re.sub(r'\b(Ctrl) (K)\b', r'\1' + NB + r'\2', text)
    text = re.sub(r' ([—–]) ', NB + r'\1 ', text)  # myślnik nigdy na początku wiersza
    return text


def apply_typo(doc):
    parts = re.split(r'(<script.*?</script>|<style.*?</style>|<[^>]+>)', doc, flags=re.S)
    for i, p in enumerate(parts):
        if i % 2 == 0 and p.strip():
            parts[i] = typo(p)
    return ''.join(parts)


for page in sorted(SRC.glob('*.html')):
    doc = page.read_text(encoding='utf-8')
    if page.name == 'index.html':
        src = doc
        doc = re.sub(r'<!--IMG ([a-z0-9-]+) sizes="([^"]*)" alt="([^"]*)"( eager)?-->', img_tag, src)
        assert '<!--IMG' not in doc
        doc = doc.replace('<!--JSONLD-->', jsonld(src))
    doc = apply_typo(doc)
    # wersja plików w adresach: po wdrożeniu przeglądarki od razu pobierają nowe style i skrypt
    for rel in ('assets/css/site.css', 'assets/js/site.js'):
        ver = hashlib.sha256((PUB / rel).read_bytes()).hexdigest()[:10]
        doc = re.sub(re.escape(rel) + r'(\?v=[0-9a-f]+)?"', rel + '?v=' + ver + '"', doc)
    (PUB / page.name).write_text(doc, encoding='utf-8')
    print('ok', page.name, len(doc), 'bytes', doc.count('<img '), 'images')
