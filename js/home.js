import { loadAllEpisodes } from './data.js';
import { isWatched } from './storage.js';
import { el } from './dom.js';

const listEl = document.getElementById('episode-list');
const statusEl = document.getElementById('status');

function renderCard(ep) {
  const card = el('a', 'episode-card tappable');
  card.href = `episode.html?ep=${encodeURIComponent(ep.id)}`;

  card.append(
    el('div', 'ep-number', String(ep.episode)),
    el('div', 'en', ep.title.en),
    el('div', 'zh', ep.title.zh),
  );

  if (isWatched(ep.id)) {
    card.classList.add('watched');
    card.append(el('div', 'watched-badge', '⭐'));
  }
  return card;
}

async function init() {
  if (location.protocol === 'file:') {
    statusEl.textContent = '請用本機 server 開啟（見 README），直接開檔案無法播放影片。';
    statusEl.classList.add('error');
    return;
  }

  try {
    const episodes = await loadAllEpisodes();
    listEl.replaceChildren(...episodes.map(renderCard));
    statusEl.hidden = true;
  } catch (err) {
    statusEl.textContent = `資料讀取失敗：${err.message}`;
    statusEl.classList.add('error');
  }
}

init();
