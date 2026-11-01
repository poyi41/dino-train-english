// 印章簿：每集一格。看完的格子蓋著那集主角恐龍的印章（點了唸名字），還沒看的格子點了去看那一集
import { loadAllEpisodes } from './data.js';
import { isWatched } from './storage.js';
import { loadDinosaurs, stampDinosaur, dinoPicture } from './dinosaurs.js';
import { speak } from './speech.js';
import { el } from './dom.js';

async function init() {
  const statusEl = document.getElementById('status');
  try {
    const [episodes, dinos] = await Promise.all([loadAllEpisodes(), loadDinosaurs()]);
    const done = episodes.filter((ep) => isWatched(ep.id)).length;
    document.getElementById('stamp-count').textContent = `⭐ ${done} / ${episodes.length}`;

    document.getElementById('stamps').replaceChildren(
      ...episodes.map((ep) => {
        const main = stampDinosaur(ep);
        const info = main && { ...main, ...dinos.get(main.en) };

        if (!isWatched(ep.id)) {
          const slot = el('a', 'stamp-slot-cell tappable');
          slot.href = `episode.html?ep=${encodeURIComponent(ep.id)}`;
          slot.append(el('div', 'stamp empty', String(ep.episode)));
          return slot;
        }

        const cell = el('button', 'stamp-slot-cell tappable');
        cell.type = 'button';
        const stamp = el('div', 'stamp');
        stamp.append(dinoPicture(info, info?.emoji ?? '🦕', 'stamp-img'), el('div', 'stamp-number', String(ep.episode)));
        cell.append(stamp, el('div', 'stamp-label', info?.en ?? ''));
        cell.addEventListener('click', () => info && speak(info.en));
        return cell;
      }),
    );
    statusEl.hidden = true;
  } catch (err) {
    statusEl.textContent = `資料讀取失敗：${err.message}`;
    statusEl.classList.add('error');
  }
}

init();
