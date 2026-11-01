// 恐龍圖鑑：看過有牠出現的那一集就解鎖。
// 解鎖的卡片點了唸英文名、列出出現的集數；沒解鎖的是剪影，點了提示去看哪一集
import { loadAllEpisodes } from './data.js';
import { isWatched } from './storage.js';
import { loadDinosaurs, dinoPicture } from './dinosaurs.js';
import { speak } from './speech.js';
import { el } from './dom.js';

function episodeLink(ep) {
  const a = el('a', 'small-btn dex-ep', `${ep.episode}`);
  a.href = `episode.html?ep=${encodeURIComponent(ep.id)}`;
  return a;
}

function renderCard(info, appearsIn) {
  const unlocked = appearsIn.some((ep) => isWatched(ep.id));
  const card = el('button', `dex-card tappable${unlocked ? '' : ' locked'}`);
  card.type = 'button';

  const emoji = appearsIn[0]?.dinosaurs.find((d) => d.en === info.en)?.emoji ?? '🦕';
  card.append(dinoPicture(info, emoji, 'dex-img'));
  if (unlocked) {
    card.append(el('div', 'en', info.en), el('div', 'zh', info.zh));
  } else {
    card.append(el('div', 'en', '？？？'));
  }

  const detail = el('div', 'dex-detail');
  detail.hidden = true;
  if (unlocked) {
    detail.append(el('span', 'zh', '出現在第'), ...appearsIn.map(episodeLink), el('span', 'zh', '集'));
  } else if (appearsIn.length) {
    detail.append(el('span', 'zh', '看第'), episodeLink(appearsIn[0]), el('span', 'zh', '集就能找到牠！'));
  }
  card.append(detail);

  card.addEventListener('click', (e) => {
    if (e.target.closest('a')) return; // 點集數按鈕直接換頁
    detail.hidden = !detail.hidden;
    if (unlocked) speak(info.en);
  });
  return { card, unlocked };
}

async function init() {
  const statusEl = document.getElementById('status');
  try {
    const [episodes, dinos] = await Promise.all([loadAllEpisodes(), loadDinosaurs()]);
    const cards = [...dinos.values()].map((info) =>
      renderCard(
        info,
        episodes.filter((ep) => ep.dinosaurs?.some((d) => d.en === info.en)),
      ),
    );
    const found = cards.filter((c) => c.unlocked).length;
    document.getElementById('dex-count').textContent = `${found} / ${cards.length}`;
    document.getElementById('dex').replaceChildren(...cards.map((c) => c.card));
    statusEl.hidden = true;
  } catch (err) {
    statusEl.textContent = `資料讀取失敗：${err.message}`;
    statusEl.classList.add('error');
  }
}

init();
