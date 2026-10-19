// SALINAN OTOMATIS dari index.html (LLK V1) — jalankan tools/sync-v1-to-v2.py
export const ICONS={
  // Musik
  Piano:'🎹',Gitar:'🎸',Violin:'🎻',Biola:'🎻',Drum:'🥁',Bass:'🎸',Vocal:'🎤',Vokal:'🎤',Keyboard:'🎹',Flute:'🎵',Saxophone:'🎷',
  // Pelajaran / akademik umum
  Matematika:'🔢',Math:'🔢',Kalkulus:'🔢',
  'Bahasa Inggris':'🇬🇧',English:'🇬🇧',
  'Bahasa Indonesia':'🇮🇩',
  IPA:'🔬',Sains:'🔬',Science:'🔬',
  Fisika:'⚛️',Physics:'⚛️',
  Kimia:'🧪',Chemistry:'🧪',
  Biologi:'🧬',Biology:'🧬',
  IPS:'🌍',Geografi:'🌍',Geography:'🌍',
  Sejarah:'📜',History:'📜',
  Ekonomi:'💹',Economics:'💹',Akuntansi:'📊',
  Sosiologi:'🧑\u200d🤝\u200d🧑',
  Komputer:'💻',Coding:'💻',Programming:'💻','Ilmu Komputer':'💻',
  Mengaji:'📖','Al-Quran':'📖',Quran:'📖','Baca Tulis':'✏️',
  PPKN:'⚖️',Hukum:'⚖️',
  Bahasa:'🌐',Mandarin:'🇨🇳',Chinese:'🇨🇳',Jepang:'🇯🇵',Japanese:'🇯🇵',Jerman:'🇩🇪',German:'🇩🇪',Arab:'🇸🇦',Arabic:'🇸🇦',Korea:'🇰🇷',Korean:'🇰🇷',Prancis:'🇫🇷',French:'🇫🇷',Spanyol:'🇪🇸',Spanish:'🇪🇸'
};
export const LLK_SUBJECT_ICON={'🎹':'piano','🎸':'guitar','🎻':'violin','🥁':'drum','🎤':'mic','🎵':'music','🎷':'music',
  '🔢':'math','🔬':'microscope','⚛️':'atom','🧪':'flask','🧬':'dna','🌍':'globe','📜':'scroll','💹':'chart','📊':'chart',
  '💻':'laptop','📖':'book-open','✏️':'pencil','⚖️':'scale','🌐':'lang'};
export const LLK_FLAG_SVG={
  '🇮🇩':'<rect width="30" height="10" fill="#e70011"/><rect y="10" width="30" height="10" fill="#fff"/>',
  '🇬🇧':'<svg viewBox="0 0 60 30" width="30" height="20" preserveAspectRatio="none"><path d="M0 0v30h60V0z" fill="#012169"/><path d="M0 0l60 30m0-30L0 30" stroke="#fff" stroke-width="6"/><path d="M0 0l60 30m0-30L0 30" stroke="#C8102E" stroke-width="2"/><path d="M30 0v30M0 15h60" stroke="#fff" stroke-width="10"/><path d="M30 0v30M0 15h60" stroke="#C8102E" stroke-width="6"/></svg>',
  '🇯🇵':'<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="6" fill="#bc002d"/>',
  '🇨🇳':'<rect width="30" height="20" fill="#de2910"/><polygon fill="#ffde00" points="6,2.4 7.1,5.7 10.6,5.7 7.8,7.8 8.8,11.1 6,9.1 3.2,11.1 4.2,7.8 1.4,5.7 4.9,5.7"/><circle cx="11.5" cy="2.6" r="0.9" fill="#ffde00"/><circle cx="13.3" cy="4.6" r="0.9" fill="#ffde00"/><circle cx="13.3" cy="7.4" r="0.9" fill="#ffde00"/><circle cx="11.5" cy="9.4" r="0.9" fill="#ffde00"/>',
  '🇩🇪':'<rect width="30" height="6.67" fill="#000"/><rect y="6.67" width="30" height="6.67" fill="#dd0000"/><rect y="13.33" width="30" height="6.67" fill="#ffce00"/>',
  '🇸🇦':'<rect width="30" height="20" fill="#006c35"/><path d="M8 7.5h14M9 9.5h12" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/><path d="M8 13.5h13l1.5-1" stroke="#fff" stroke-width="1" fill="none" stroke-linecap="round"/>',
  '🇰🇷':'<rect width="30" height="20" fill="#fff"/><path d="M15 6a4 4 0 0 1 0 8a2 2 0 0 1 0-4a2 2 0 0 0 0-4z" fill="#003478"/><path d="M15 6a4 4 0 0 0 0 8a2 2 0 0 0 0-4a2 2 0 0 1 0-4z" fill="#cd2e3a" transform="rotate(180 15 10)"/><g stroke="#000" stroke-width="0.9"><path d="M5 4.5l3-2.2M5.7 5.4l3-2.2M6.4 6.3l3-2.2"/><path d="M20.6 13.7l3 2.2M21.3 12.8l3 2.2M22 11.9l3 2.2"/><path d="M20.6 6.3l3-2.2M21.3 7.2l3-2.2M22 8.1l3-2.2"/><path d="M5 15.5l3 2.2M5.7 14.6l3 2.2M6.4 13.7l3 2.2"/></g>',
  '🇫🇷':'<rect width="10" height="20" fill="#002395"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#ed2939"/>',
  '🇪🇸':'<rect width="30" height="20" fill="#aa151b"/><rect y="5" width="30" height="10" fill="#f1bf00"/>'
};
export function llkFlagHtml(e){
  const f=LLK_FLAG_SVG[e]; if(!f) return '';
  return '<svg class="llk-flag" viewBox="0 0 30 20" aria-hidden="true" focusable="false">'+f+'</svg>';
}
