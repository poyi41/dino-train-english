import { loadEpisode, MAX_CORE } from './data.js';
import { createPlayer } from './player.js';
import { speak, speakWords } from './speech.js';
import { el } from './dom.js';
import { addProgress, getProgress, isWatched, markWatched, unmarkWatched } from './storage.js';
import { askAdult } from './adult.js';
import { loadDinosaurs, stampDinosaur } from './dinosaurs.js';
import { showStampCeremony } from './stamp.js';

const $ = (id) => document.getElementById(id);
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

/* ---------- core 優先，其他收進「更多」 ---------- */

// 這集有標 core 時：core 項目（最多 max 個）先顯示，其餘照原順序收進「更多」。
// 還沒標 core 的集數全部直接顯示
function splitCore(items, max) {
  if (!items.some((item) => item.core === true)) return { main: items, more: [] };
  const main = items.filter((item) => item.core === true).slice(0, max);
  return { main, more: items.filter((item) => !main.includes(item)) };
}

// 在 container 後面加「➕ 更多」按鈕與收合區；收合區沿用 container 的 class（同樣的版面）
function renderWithMore(container, items, max, makeItem) {
  const { main, more } = splitCore(items, max);
  container.replaceChildren(...main.map(makeItem));
  container.parentElement.querySelectorAll('.more-toggle, .more-items').forEach((n) => n.remove());
  if (!more.length) return;

  const moreBox = el('div', `${container.className} more-items`);
  moreBox.hidden = true;
  moreBox.append(...more.map(makeItem));
  const toggle = el('button', 'more-toggle tappable');
  toggle.type = 'button';
  const label = () => {
    toggle.textContent = moreBox.hidden ? `➕ 更多（${more.length}）` : '➖ 收起來';
  };
  label();
  toggle.addEventListener('click', () => {
    moreBox.hidden = !moreBox.hidden;
    label();
  });
  container.after(toggle, moreBox);
}

function renderWords(words, playerReady) {
  const grid = document.getElementById('words');
  renderWithMore(grid, words, MAX_CORE.words, (word) => {
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
  });
  document.getElementById('words-section').hidden = words.length === 0;
}

function renderSentences(sentences, playerReady) {
  const list = document.getElementById('sentences');
  let playingBtn = null;

  renderWithMore(list, sentences, MAX_CORE.sentences, (s) => {
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
  });
  document.getElementById('sentences-section').hidden = sentences.length === 0;
}

/* ---------- 小故事：點句子朗讀，唸到的字亮起來 ---------- */

function renderStory(story, playerReady) {
  const list = $('story');
  let readingLine = null;

  list.replaceChildren(
    ...story.map((line) => {
      const btn = el('button', 'story-line tappable');
      btn.type = 'button';
      const words = line.en.split(/\s+/).map((w) => el('span', 'story-word', w));
      const text = el('div', 'story-text');
      words.forEach((w, i) => text.append(...(i ? [' ', w] : [w])));
      const zh = el('div', 'zh story-zh', line.zh);
      zh.hidden = true;
      const body = el('div', 'story-body');
      body.append(text, zh);
      btn.append(el('div', 'sentence-icon', '🔊'), body);

      const clear = () => {
        words.forEach((w) => w.classList.remove('reading'));
        btn.classList.remove('playing');
      };
      btn.addEventListener('click', async () => {
        readingLine?.();
        readingLine = clear;
        (await playerReady)?.pause(); // 朗讀時影片不要同時出聲
        btn.classList.add('playing');
        speakWords(line.en, {
          onWord: (index) => {
            words.forEach((w, i) => w.classList.toggle('reading', i === index));
          },
          onEnd: clear,
        });
      });
      return btn;
    }),
  );

  // 中文翻譯預設隱藏，按「中文」一次全部顯示或收起
  const toggle = $('story-zh-toggle');
  toggle.addEventListener('click', () => {
    const show = toggle.getAttribute('aria-pressed') !== 'true';
    toggle.setAttribute('aria-pressed', String(show));
    list.querySelectorAll('.story-zh').forEach((zh) => {
      zh.hidden = !show;
    });
  });
  $('story-section').hidden = story.length === 0;
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
  renderStory(ep.story ?? [], playerReady);
  trackWatching(ep, playerReady);
  setupAdultMark(ep, playerReady);
}

/* ---------- 看完判斷 ---------- */

// 累計播放滿影片長度的 85% 就算看完。不看播放位置，因為點跟讀句會跳到後段、孩子也可能直接拉到最後
const WATCHED_RATIO = 0.85;

function showProgress(ratio, done) {
  $('watch-progress').hidden = false;
  $('watch-progress').classList.toggle('done', done);
  $('watch-train').style.left = `${Math.min(ratio, 1) * 100}%`;
  $('watch-goal').textContent = done ? '⭐' : '🏁';
}

async function completeEpisode(ep, playerReady) {
  if (!markWatched(ep.id)) return;
  showProgress(1, true);
  (await playerReady)?.pause(); // 蓋印章時影片先停下來
  const main = stampDinosaur(ep);
  const dinos = await loadDinosaurs().catch(() => new Map());
  showStampCeremony(ep, main && { ...main, ...dinos.get(main.en) });
}

function trackWatching(ep, playerReady) {
  if (isWatched(ep.id)) showProgress(1, true);

  playerReady.then((player) => {
    if (!player) return;
    let last = performance.now();
    setInterval(() => {
      const now = performance.now();
      const elapsed = Math.min((now - last) / 1000, 5); // 分頁在背景時計時器會變慢，最多算 5 秒
      last = now;
      if (isWatched(ep.id) || !player.isPlaying()) return;
      const duration = player.getDuration();
      if (!duration) return;
      const watchedSec = addProgress(ep.id, elapsed);
      const ratio = watchedSec / (duration * WATCHED_RATIO);
      showProgress(ratio, false);
      if (ratio >= 1) completeEpisode(ep, playerReady);
    }, 1000);
  });

  // 之前看過一部分：先顯示進度（影片長度還不知道，用 11 分鐘估）
  const before = getProgress()[ep.id];
  if (before && !isWatched(ep.id)) showProgress(before / (700 * WATCHED_RATIO), false);
}

// 大人手動標記看完，或取消誤標（印章與進度一起拿掉）
function setupAdultMark(ep, playerReady) {
  const btn = $('adult-mark');
  const label = () => {
    btn.textContent = isWatched(ep.id) ? '大人用：取消這集的看完紀錄' : '大人用：標記這集已看完';
  };
  label();
  btn.addEventListener('click', () => {
    if (!askAdult()) return;
    if (!isWatched(ep.id)) {
      completeEpisode(ep, playerReady).then(label);
    } else if (confirm('確定要取消這集的看完紀錄嗎？印章也會一起拿掉。')) {
      unmarkWatched(ep.id);
      location.reload();
    }
  });
}

init();
