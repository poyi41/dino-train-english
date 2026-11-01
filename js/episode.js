import { loadEpisode } from './data.js';
import { createPlayer } from './player.js';
import { speak } from './speech.js';
import { el } from './dom.js';

const statusEl = document.getElementById('status');

function showError(text) {
  statusEl.textContent = text;
  statusEl.classList.add('error');
  statusEl.hidden = false;
}

// 按下後短暫加上 class，給小孩明確的「有點到」回饋
function flash(node, className = 'pressed', ms = 600) {
  node.classList.add(className);
  setTimeout(() => node.classList.remove(className), ms);
}

function renderWords(words, playerReady) {
  const grid = document.getElementById('words');
  grid.replaceChildren(
    ...words.map((word) => {
      const card = el('div', 'word-card');

      const sayBtn = el('button', 'word-say tappable');
      sayBtn.type = 'button';
      sayBtn.append(el('div', 'emoji', word.emoji), el('div', 'en', word.en), el('div', 'zh', word.zh));
      sayBtn.addEventListener('click', () => {
        speak(word.en);
        flash(sayBtn);
      });
      card.append(sayBtn);

      if (typeof word.time === 'number') {
        const watchBtn = el('button', 'word-watch tappable', '🎬');
        watchBtn.type = 'button';
        watchBtn.setAttribute('aria-label', `看影片中的 ${word.en}`);
        watchBtn.addEventListener('click', async () => {
          (await playerReady)?.playFrom(word.time);
        });
        card.append(watchBtn);
      }
      return card;
    }),
  );
  document.getElementById('words-section').hidden = words.length === 0;
}

function renderSentences(sentences, playerReady) {
  const list = document.getElementById('sentences');
  let playingBtn = null;

  list.replaceChildren(
    ...sentences.map((s) => {
      const btn = el('button', 'sentence tappable');
      btn.type = 'button';
      const text = el('div', 'sentence-text');
      text.append(el('div', 'en', s.en), el('div', 'zh', s.zh));
      btn.append(el('div', 'sentence-icon', '▶'), text);

      btn.addEventListener('click', async () => {
        const player = await playerReady;
        if (!player) return;
        playingBtn?.classList.remove('playing');
        playingBtn = btn;
        btn.classList.add('playing');
        player.playSegment(s.start, s.end, () => {
          btn.classList.remove('playing');
          if (playingBtn === btn) playingBtn = null;
        });
      });
      return btn;
    }),
  );
  document.getElementById('sentences-section').hidden = sentences.length === 0;
}

async function init() {
  if (location.protocol === 'file:') {
    showError('請用本機 server 開啟（見 README），直接開檔案無法播放影片。');
    return;
  }

  const id = new URLSearchParams(location.search).get('ep');
  if (!id || !/^ep\d+$/.test(id)) {
    showError('找不到這一集，請回首頁重新選擇。');
    return;
  }

  let ep;
  try {
    ep = await loadEpisode(id);
  } catch (err) {
    showError(`資料讀取失敗：${err.message}`);
    return;
  }

  document.title = `${ep.title.en} - 恐龍火車學英文`;
  document.getElementById('ep-title-en').textContent = `${ep.episode}. ${ep.title.en}`;
  document.getElementById('ep-title-zh').textContent = ep.title.zh;
  statusEl.hidden = true;

  // 影片載入失敗時仍顯示單字卡（發音不需要影片）
  const playerReady = createPlayer('player', ep.videoId).catch((err) => {
    showError(err.message);
    return null;
  });

  renderWords(ep.words ?? [], playerReady);
  renderSentences(ep.sentences ?? [], playerReady);
}

init();
