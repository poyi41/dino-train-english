// 編輯模式的字幕面板：顯示 raw/ 裡的自動字幕（由 tools/serve.py 的 /api/captions 提供），
// 跟著影片標亮目前那一行，選取文字後可直接加成跟讀句（秒數依每個字的時間計算）。
import { el } from './dom.js';

// 與 README「用字幕找句子和秒數」一致：開始往前 0.3 秒、結束往後 0.5 秒
const PAD_BEFORE = 0.3;
const PAD_AFTER = 0.5;
// 一個字最多算 1 秒（字幕裡下一個字可能隔很久才出現）
const MAX_WORD_SEC = 1;

const round1 = (n) => Math.round(n * 10) / 10;

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = String(Math.floor(sec % 60)).padStart(2, '0');
  return `${m}:${s}`;
}

// 回傳字幕資料；這支影片沒有字幕時回傳 null
export async function loadCaptions(videoId) {
  const res = await fetch(`api/captions/${encodeURIComponent(videoId)}`, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
  return res.json();
}

export function createCaptionPanel(container, { onSeek, onAdd, onReload }) {
  let words = []; // 攤平的所有字：{ t, w, span }
  let lines = []; // { start, node, firstWord, lastWord, text }
  let current = -1;
  let hovering = false;

  const search = el('input', 'field cap-search');
  search.type = 'search';
  search.placeholder = '🔍 搜尋字幕';

  const reload = el('button', 'small-btn', '🔄');
  reload.type = 'button';
  reload.title = '重新讀取 raw/ 裡的字幕';
  reload.addEventListener('click', onReload);

  const header = el('div', 'cap-header');
  header.append(el('strong', '', '📜 字幕'), search, reload);

  const hint = el('div', 'cap-hint', '選取幾個字再按 ➕ 加成句子；沒選取就加整行。點時間從那裡播放。');
  const list = el('div', 'cap-list');
  container.replaceChildren(header, hint, list);

  list.addEventListener('mouseenter', () => (hovering = true));
  list.addEventListener('mouseleave', () => (hovering = false));

  search.addEventListener('input', () => {
    const query = search.value.trim().toLowerCase();
    for (const line of lines) {
      line.node.hidden = query !== '' && !line.text.toLowerCase().includes(query);
    }
  });

  function wordEnd(index) {
    const next = words[index + 1];
    const t = words[index].t;
    return next ? Math.min(next.t, t + MAX_WORD_SEC) : t + MAX_WORD_SEC;
  }

  // 選取範圍裡的字（可以跨好幾行）；沒有選取時回傳空陣列
  function selectedRange() {
    const sel = window.getSelection();
    if (!sel.rangeCount || sel.isCollapsed) return [];
    const picked = [];
    words.forEach((word, i) => {
      if (sel.containsNode(word.span, true)) picked.push(i);
    });
    return picked;
  }

  function add(line) {
    const picked = selectedRange();
    const first = picked.length ? picked[0] : line.firstWord;
    const last = picked.length ? picked.at(-1) : line.lastWord;
    const text = words
      .slice(first, last + 1)
      .map((w) => w.w)
      .join(' ');
    window.getSelection().removeAllRanges();
    onAdd({
      en: text.charAt(0).toUpperCase() + text.slice(1),
      start: round1(Math.max(0, words[first].t - PAD_BEFORE)),
      end: round1(wordEnd(last) + PAD_AFTER),
    });
  }

  function showMessage(text) {
    words = [];
    lines = [];
    current = -1;
    list.replaceChildren(el('p', 'cap-message', text));
  }

  function setCaptions(data) {
    words = [];
    lines = [];
    current = -1;
    const nodes = data.lines.map((raw) => {
      const node = el('div', 'cap-line');
      const firstWord = words.length;
      const text = el('span', 'cap-text');
      raw.words.forEach(([t, w], i) => {
        const span = el('span', 'cap-word', w);
        words.push({ t, w, span });
        text.append(span);
        if (i < raw.words.length - 1) text.append(' ');
      });
      const line = {
        start: raw.words[0][0],
        node,
        firstWord,
        lastWord: words.length - 1,
        text: raw.words.map(([, w]) => w).join(' '),
      };
      if (/^\[.*\]$/.test(line.text)) node.classList.add('cap-noise'); // [Music]、[Applause]

      const time = el('button', 'cap-time', formatTime(line.start));
      time.type = 'button';
      time.addEventListener('click', () => onSeek(line.start));

      const addBtn = el('button', 'cap-add', '➕');
      addBtn.type = 'button';
      addBtn.title = '加成跟讀句';
      // 按下按鈕時不要清掉文字選取
      addBtn.addEventListener('mousedown', (e) => e.preventDefault());
      addBtn.addEventListener('click', () => add(line));

      node.append(time, text, addBtn);
      lines.push(line);
      return node;
    });
    list.replaceChildren(...nodes);
    search.dispatchEvent(new Event('input'));
  }

  // 跟著影片標亮目前那一行；滑鼠在面板上時不自動捲動，免得選取時跑掉
  function update(time) {
    let index = -1;
    for (let i = 0; i < lines.length && lines[i].start <= time; i++) index = i;
    if (index === current) return;
    lines[current]?.node.classList.remove('cap-current');
    current = index;
    const line = lines[current];
    if (!line) return;
    line.node.classList.add('cap-current');
    if (!hovering && !line.node.hidden) {
      list.scrollTop = line.node.offsetTop - list.clientHeight / 3;
    }
  }

  return { setCaptions, showMessage, update };
}
