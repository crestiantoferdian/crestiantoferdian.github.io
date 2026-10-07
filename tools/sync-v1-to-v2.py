#!/usr/bin/env python3
"""Salin tampilan LLK V1 (index.html) ke halaman Guru Mitra V2 supaya SAMA PERSIS.

Jalankan dari root repo setiap kali CSS/ikon V1 berubah:
    python3 tools/sync-v1-to-v2.py

Yang disalin (V1 tidak diubah sama sekali):
  - <style> utama V1            -> v2/v1.css
  - sprite ikon SVG V1          -> v2/guru.html (di antara penanda V1-SPRITE)
  - peta ikon mata pelajaran    -> v2/v1-shared.js (ICONS & LLK_SUBJECT_ICON)
"""
import re, pathlib, sys
root = pathlib.Path(__file__).resolve().parent.parent
v1 = (root / 'index.html').read_text(encoding='utf-8')

m = re.search(r'<style>\n(.*?)</style>', v1, re.S)
if not m: sys.exit('style V1 tidak ditemukan')
(root / 'v2' / 'v1.css').write_text('/* SALINAN OTOMATIS dari index.html (LLK V1) — jangan diedit di sini.\n   Ubah di index.html lalu jalankan: python3 tools/sync-v1-to-v2.py */\n' + m.group(1), encoding='utf-8')

body = v1[v1.index('<body>'):]
sm = re.search(r'(<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">.*?</svg>)\n', body, re.S)
if not sm: sys.exit('sprite V1 tidak ditemukan')
g = root / 'v2' / 'guru.html'
html = g.read_text(encoding='utf-8')
html2 = re.sub(r'<!--V1-SPRITE-START-->.*?<!--V1-SPRITE-END-->', lambda _: '<!--V1-SPRITE-START-->\n' + sm.group(1) + '\n<!--V1-SPRITE-END-->', html, flags=re.S)
if html2 == html and '<!--V1-SPRITE-START-->' not in html: sys.exit('penanda V1-SPRITE tidak ada di guru.html')
g.write_text(html2, encoding='utf-8')

ic = re.search(r'\nconst ICONS=\{.*?\n\};\n', v1, re.S)
si = re.search(r'\nconst LLK_SUBJECT_ICON=\{.*?\};\n', v1, re.S)
if not ic or not si: sys.exit('ICONS / LLK_SUBJECT_ICON tidak ditemukan')
(root / 'v2' / 'v1-shared.js').write_text('// SALINAN OTOMATIS dari index.html (LLK V1) — jalankan tools/sync-v1-to-v2.py\n'
  + 'export' + ic.group(0).lstrip('\n').replace('const ICONS=', ' const ICONS=', 1)
  + 'export' + si.group(0).lstrip('\n').replace('const LLK_SUBJECT_ICON=', ' const LLK_SUBJECT_ICON=', 1), encoding='utf-8')
print('OK: v1.css, sprite guru.html, v1-shared.js diperbarui')
