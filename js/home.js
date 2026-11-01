import { loadAllEpisodes } from './data.js';
import { getProgress, isWatched } from './storage.js';
import { el } from './dom.js';
import { isLocalComputer } from './env.js';

const listEl = document.getElementById('episode-list');
const statusEl = document.getElementById('status');
const progress = getProgress();

// 編輯模式入口只在家裡電腦顯示
document.getElementById('settings-link').hidden = !isLocalComputer;

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
  } else if (progress[ep.id]) {
    // 看到一半：卡片底部顯示進度條（以 11 分鐘的 85% 估算）
    const bar = el('div', 'card-progress');
    bar.style.width = `${Math.min(progress[ep.id] / (700 * 0.85), 1) * 100}%`;
    card.append(bar);
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
    const done = episodes.filter((ep) => isWatched(ep.id)).length;
    document.getElementById('home-progress').textContent = `⭐ ${done} / ${episodes.length}`;
    statusEl.hidden = true;
  } catch (err) {
    statusEl.textContent = `資料讀取失敗：${err.message}`;
    statusEl.classList.add('error');
  }
}

init();
