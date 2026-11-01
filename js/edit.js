import { loadAllEpisodes, loadEpisode } from './data.js';
import { createPlayer } from './player.js';
import { speak } from './speech.js';
import { el } from './dom.js';
import { createCaptionPanel, loadCaptions } from './caption-panel.js';
import {
  canWriteFiles,
  getProjectDir,
  getServerSaveStatus,
  readText,
  saveToServer,
  writeText,
  downloadText,
} from './project-files.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

let ep = null; // 正在編輯的這一集
let isNew = false; // 新的一集，儲存時要加進 episodes.json
let dirty = false;
let saveMode = 'download'; // 'server' | 'folder' | 'download' | 'readonly'，見 project-files.js
let player = null;
let captions = null; // 字幕面板（只有用 tools/serve.py 時才有）

const round1 = (n) => Math.round(n * 10) / 10;

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(1).padStart(4, '0');
  return `${m}:${s}`;
}

// 接受完整網址或 11 碼 ID
function parseVideoId(input) {
  const text = input.trim();
  const match = text.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/);
  if (match) return match[1];
  return /^[\w-]{11}$/.test(text) ? text : null;
}

/* ---------- 大人門檻 ---------- */

function passedGate() {
  try {
    return sessionStorage.getItem('dinoTrain.adult') === '1';
  } catch {
    return false;
  }
}

function showGate(onPass) {
  const a = 6 + Math.floor(Math.random() * 4);
  const b = 6 + Math.floor(Math.random() * 4);
  $('gate-question').textContent = `${a} × ${b} = ?`;
  $('gate').hidden = false;
  $('gate-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (Number($('gate-answer').value) === a * b) {
      try {
        sessionStorage.setItem('dinoTrain.adult', '1');
      } catch {
        // 記不住就每次都問
      }
      $('gate').hidden = true;
      onPass();
    } else {
      $('gate-error').hidden = false;
      $('gate-answer').value = '';
    }
  });
}

/* ---------- 集數列表 ---------- */

async function showPicker() {
  $('picker').hidden = false;
  const episodes = await loadAllEpisodes();

  $('picker-list').replaceChildren(
    ...episodes.map((item) => {
      const row = el('a', 'picker-row');
      row.href = `edit.html?ep=${encodeURIComponent(item.id)}`;
      row.append(
        el('span', 'picker-num', String(item.episode)),
        el('span', 'picker-title', `${item.title.en}　${item.title.zh}`),
        el('span', 'picker-count', `${item.sentences.length} 句 · ${item.words.length} 字`),
      );
      return row;
    }),
  );

  $('new-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const videoId = parseVideoId($('new-video').value);
    if (!videoId) {
      $('picker-status').textContent = '看不懂這個網址，請貼 YouTube 影片網址或 11 碼影片 ID';
      $('picker-status').className = 'message error';
      $('picker-status').hidden = false;
      return;
    }
    location.href = `edit.html?new=${encodeURIComponent(videoId)}`;
  });
}

/* ---------- 編輯畫面的小元件 ---------- */

function markDirty() {
  dirty = true;
  $('save-status').textContent = '● 尚未儲存';
  $('save-status').className = 'save-status unsaved';
}

function textInput(obj, key, placeholder, className = '') {
  const input = el('input', `field ${className}`);
  input.type = 'text';
  input.placeholder = placeholder;
  input.value = obj[key] ?? '';
  input.addEventListener('input', () => {
    obj[key] = input.value;
    markDirty();
  });
  return input;
}

function smallButton(label, onClick, title) {
  const btn = el('button', 'small-btn', label);
  btn.type = 'button';
  if (title) btn.title = title;
  btn.addEventListener('click', onClick);
  return btn;
}

// 秒數欄位：數字 + ⏱（用影片目前時間）+ ±0.1 微調
function timeInput(obj, key, label) {
  const wrap = el('div', 'time-field');
  const input = el('input', 'field time');
  input.type = 'number';
  input.step = '0.1';
  input.min = '0';
  input.inputMode = 'decimal';
  input.value = obj[key];

  const set = (value) => {
    obj[key] = round1(Math.max(0, value));
    input.value = obj[key];
    markDirty();
  };

  input.addEventListener('input', () => {
    const value = parseFloat(input.value);
    if (!Number.isNaN(value)) {
      obj[key] = value;
      markDirty();
    }
  });

  wrap.append(
    el('span', 'time-label', label),
    smallButton('⏱', () => player && set(player.getTime()), '用影片目前時間'),
    input,
    smallButton('−', () => set(obj[key] - 0.1), '提早 0.1 秒'),
    smallButton('+', () => set(obj[key] + 0.1), '延後 0.1 秒'),
  );
  return wrap;
}

function deleteButton(list, item, rerender) {
  return smallButton(
    '🗑',
    () => {
      const name = item.en || '這一筆';
      if (!confirm(`刪除「${name}」？`)) return;
      list.splice(list.indexOf(item), 1);
      markDirty();
      rerender();
    },
    '刪除',
  );
}

/* ---------- 各區塊 ---------- */

function renderMeta() {
  const meta = $('meta');
  const episode = el('input', 'field narrow');
  episode.type = 'number';
  episode.min = '1';
  episode.value = ep.episode;
  episode.addEventListener('input', () => {
    ep.episode = parseInt(episode.value, 10) || ep.episode;
    markDirty();
  });

  const video = textInput(ep, 'videoId', '11 碼影片 ID', 'video-id');
  video.addEventListener('change', () => {
    const id = parseVideoId(video.value);
    if (id) {
      ep.videoId = id;
      video.value = id;
      player?.changeVideo(id);
      reloadCaptions();
    }
  });

  const label = (text, input) => {
    const wrap = el('label', 'meta-item');
    wrap.append(el('span', 'meta-label', text), input);
    return wrap;
  };

  meta.replaceChildren(
    label('集數', episode),
    label('影片 ID', video),
    label('英文標題', textInput(ep.title, 'en', 'English title')),
    label('中文標題', textInput(ep.title, 'zh', '中文標題')),
  );
}

function renderSentences() {
  $('sentences').replaceChildren(
    ...ep.sentences.map((s) => {
      const row = el('div', 'edit-row');
      const texts = el('div', 'row-texts');
      texts.append(textInput(s, 'en', 'English sentence', 'en-field'), textInput(s, 'zh', '中文'));

      const times = el('div', 'row-times');
      times.append(timeInput(s, 'start', '開始'), timeInput(s, 'end', '結束'));

      const actions = el('div', 'row-actions');
      actions.append(
        smallButton('▶ 試播', () => player?.playSegment(s.start, s.end)),
        deleteButton(ep.sentences, s, renderSentences),
      );

      row.append(texts, times, actions);
      return row;
    }),
  );
}

function renderWords() {
  $('words').replaceChildren(
    ...ep.words.map((w) => {
      const row = el('div', 'edit-row');
      const texts = el('div', 'row-texts');
      texts.append(
        textInput(w, 'emoji', '🙂', 'emoji-field'),
        textInput(w, 'en', 'word', 'en-field'),
        textInput(w, 'zh', '中文'),
      );

      const times = el('div', 'row-times');
      times.append(timeInput(w, 'time', '出現'));

      const actions = el('div', 'row-actions');
      actions.append(
        smallButton('🔊', () => speak(w.en), '聽發音'),
        smallButton('🎬', () => player?.playFrom(w.time), '從這裡播放'),
        deleteButton(ep.words, w, renderWords),
      );

      row.append(texts, times, actions);
      return row;
    }),
  );
}

function renderDinosaurs() {
  $('dinosaurs').replaceChildren(
    ...ep.dinosaurs.map((d) => {
      const row = el('div', 'edit-row');
      const texts = el('div', 'row-texts');
      texts.append(
        textInput(d, 'emoji', '🦕', 'emoji-field'),
        textInput(d, 'en', 'Dinosaur name', 'en-field'),
        textInput(d, 'zh', '中文名'),
      );
      const actions = el('div', 'row-actions');
      actions.append(deleteButton(ep.dinosaurs, d, renderDinosaurs));
      row.append(texts, actions);
      return row;
    }),
  );
}

/* ---------- 存檔 ---------- */

function validate() {
  const errors = [];
  if (!parseVideoId(ep.videoId)) errors.push('影片 ID 不正確');
  if (!ep.title.en.trim()) errors.push('缺少英文標題');
  ep.sentences.forEach((s, i) => {
    if (!s.en.trim()) errors.push(`第 ${i + 1} 句沒有英文`);
    if (!(s.end > s.start)) errors.push(`「${s.en || `第 ${i + 1} 句`}」的結束時間要比開始晚`);
  });
  ep.words.forEach((w, i) => {
    if (!w.en.trim()) errors.push(`第 ${i + 1} 個單字沒有英文`);
  });
  ep.dinosaurs.forEach((d, i) => {
    if (!d.en.trim()) errors.push(`第 ${i + 1} 隻恐龍沒有英文名`);
  });
  return errors;
}

// 固定欄位順序，陣列每筆一行，方便手動修改與看 git diff
function formatEpisode() {
  const line = (obj) =>
    `{ ${Object.entries(obj)
      .map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`)
      .join(', ')} }`;
  const list = (items) =>
    items.length ? `[\n${items.map((item) => `    ${line(item)}`).join(',\n')}\n  ]` : '[]';
  const trim = (s) => s.trim();

  return `{
  "id": ${JSON.stringify(ep.id)},
  "episode": ${ep.episode},
  "videoId": ${JSON.stringify(ep.videoId)},
  "title": ${line({ en: trim(ep.title.en), zh: trim(ep.title.zh) })},
  "dinosaurs": ${list(ep.dinosaurs.map((d) => ({ en: trim(d.en), zh: trim(d.zh), emoji: trim(d.emoji) })))},
  "words": ${list(ep.words.map((w) => ({ en: trim(w.en), zh: trim(w.zh), time: round1(w.time), emoji: trim(w.emoji) })))},
  "sentences": ${list(ep.sentences.map((s) => ({ en: trim(s.en), zh: trim(s.zh), start: round1(s.start), end: round1(s.end) })))}
}
`;
}

function setStatus(text, className = '') {
  $('save-status').textContent = text;
  $('save-status').className = `save-status ${className}`;
}

// 用一般 http.server 時的備案：寫進使用者選的專案資料夾
async function saveToFolder(text) {
  const dir = await getProjectDir();
  await writeText(dir, `data/episodes/${ep.id}.json`, text);
  if (isNew) {
    const index = JSON.parse(await readText(dir, 'data/episodes.json'));
    if (!index.episodes.includes(ep.id)) {
      index.episodes.push(ep.id);
      await writeText(dir, 'data/episodes.json', `{\n  "episodes": ${JSON.stringify(index.episodes).replaceAll(',', ', ')}\n}\n`);
    }
  }
}

async function save() {
  const errors = validate();
  if (errors.length) {
    alert(`還不能儲存：\n\n${errors.join('\n')}`);
    return;
  }
  const text = formatEpisode();

  if (saveMode === 'readonly') {
    alert('只能在執行 server 的那台電腦上存檔');
    return;
  }
  if (saveMode === 'download') {
    downloadText(`${ep.id}.json`, text);
    setStatus(`已下載 ${ep.id}.json，請放進 data/episodes/` + (isNew ? `，並在 episodes.json 加上 "${ep.id}"` : ''));
    return;
  }

  try {
    if (saveMode === 'server') {
      await saveToServer(ep.id, text);
    } else {
      await saveToFolder(text);
    }
    if (isNew) {
      isNew = false;
      history.replaceState(null, '', `edit.html?ep=${ep.id}`);
      $('ep-id').textContent = `（檔名 ${ep.id}.json）`;
    }
    dirty = false;
    setStatus(`✓ 已儲存 ${new Date().toLocaleTimeString()}`, 'saved');
  } catch (err) {
    if (err.name === 'AbortError') {
      setStatus('已取消儲存');
    } else {
      setStatus(`儲存失敗：${err.message}`, 'error');
    }
  }
}

/* ---------- 編輯單集 ---------- */

async function loadForEdit() {
  const newVideo = params.get('new');
  if (newVideo) {
    const episodes = await loadAllEpisodes();
    const next = Math.max(0, ...episodes.map((e) => e.episode)) + 1;
    isNew = true;
    return {
      id: `ep${String(next).padStart(2, '0')}`,
      episode: next,
      videoId: parseVideoId(newVideo) ?? '',
      title: { en: '', zh: '' },
      dinosaurs: [],
      words: [],
      sentences: [],
    };
  }
  const id = params.get('ep');
  if (!/^ep\d+$/.test(id)) throw new Error('網址裡的集數不正確');
  const data = await loadEpisode(id);
  data.title ??= { en: '', zh: '' };
  data.dinosaurs ??= [];
  data.words ??= [];
  data.sentences ??= [];
  return data;
}

async function showEditor() {
  ep = await loadForEdit();
  $('editor').hidden = false;
  $('ep-id').textContent = `（檔名 ${ep.id}.json${isNew ? '，尚未建立' : ''}）`;
  $('preview-link').href = `episode.html?ep=${ep.id}`;
  const serverStatus = await getServerSaveStatus();
  if (serverStatus === true) {
    saveMode = 'server';
  } else if (serverStatus === false) {
    saveMode = 'readonly';
    setStatus('這台裝置只能看，請到執行 server 的電腦上編輯', 'error');
  } else if (canWriteFiles()) {
    saveMode = 'folder';
    setStatus('用 python tools/serve.py 啟動就不用選資料夾');
  } else {
    saveMode = 'download';
    setStatus('這個瀏覽器無法直接存檔，儲存會改成下載檔案');
  }

  renderMeta();
  renderSentences();
  renderWords();
  renderDinosaurs();

  const now = () => (player ? player.getTime() : 0);

  $('add-sentence').addEventListener('click', () => {
    const t = round1(now());
    ep.sentences.push({ en: '', zh: '', start: t, end: round1(t + 2) });
    markDirty();
    renderSentences();
    $('sentences').lastElementChild.querySelector('input').focus();
  });
  $('add-word').addEventListener('click', () => {
    ep.words.push({ en: '', zh: '', time: round1(now()), emoji: '' });
    markDirty();
    renderWords();
    $('words').lastElementChild.querySelectorAll('input')[1].focus();
  });
  $('add-dino').addEventListener('click', () => {
    ep.dinosaurs.push({ en: '', zh: '', emoji: '🦕' });
    markDirty();
    renderDinosaurs();
    $('dinosaurs').lastElementChild.querySelectorAll('input')[1].focus();
  });
  $('sort-sentences').addEventListener('click', () => {
    ep.sentences.sort((a, b) => a.start - b.start);
    markDirty();
    renderSentences();
  });
  $('sort-words').addEventListener('click', () => {
    ep.words.sort((a, b) => a.time - b.time);
    markDirty();
    renderWords();
  });
  $('save').addEventListener('click', save);

  window.addEventListener('beforeunload', (e) => {
    if (dirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  try {
    player = await createPlayer('player', ep.videoId);
  } catch (err) {
    setStatus(err.message, 'error');
    return;
  }

  document.querySelectorAll('[data-seek]').forEach((btn) => {
    btn.addEventListener('click', () => player.seekBy(Number(btn.dataset.seek)));
  });

  // 字幕來自 tools/serve.py；用其他方式開網站時沒有這個面板
  if (saveMode === 'server') {
    captions = createCaptionPanel($('captions'), {
      onSeek: (t) => player.playFrom(t),
      onAdd: addSentenceFromCaption,
      onReload: reloadCaptions,
    });
    $('captions').hidden = false;
    reloadCaptions();
  }

  setInterval(() => {
    const t = player.getTime();
    $('now').textContent = formatTime(t);
    captions?.update(t);
  }, 200);
}

/* ---------- 字幕面板 ---------- */

async function reloadCaptions() {
  if (!captions) return;
  try {
    const data = await loadCaptions(ep.videoId);
    if (data) {
      captions.setCaptions(data);
    } else {
      captions.showMessage('raw/ 裡沒有這支影片的字幕。照 README「用字幕找句子和秒數」用 yt-dlp 抓好後，按 🔄 重新讀取。');
    }
  } catch (err) {
    captions.showMessage(`字幕讀取失敗：${err.message}`);
  }
}

function addSentenceFromCaption({ en, start, end }) {
  ep.sentences.push({ en, zh: '', start, end });
  markDirty();
  renderSentences();
  // 自動字幕沒有標點和中文，捲到新句子讓大人補上
  const row = $('sentences').lastElementChild;
  row.scrollIntoView({ block: 'center', behavior: 'smooth' });
  row.classList.add('just-added');
  row.querySelectorAll('input')[1].focus({ preventScroll: true });
}

/* ---------- 進入點 ---------- */

function start() {
  const run = params.has('ep') || params.has('new') ? showEditor : showPicker;
  run().catch((err) => {
    document.body.prepend(el('p', 'message error', `載入失敗：${err.message}`));
  });
}

if (location.protocol === 'file:') {
  document.body.prepend(el('p', 'message error', '請用本機 server 開啟（見 README）'));
} else if (passedGate()) {
  start();
} else {
  showGate(start);
}
