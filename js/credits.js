// 插圖來源頁：依 data/dinosaurs.json 的 credit 欄位列出作者、授權與原始檔案（CC 授權要求標示）
import { loadDinosaurs } from './dinosaurs.js';
import { el } from './dom.js';

function link(text, href) {
  const a = el('a', '', text);
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener';
  return a;
}

async function init() {
  const statusEl = document.getElementById('status');
  try {
    const dinos = await loadDinosaurs();
    const items = [...dinos.values()]
      .filter((d) => d.credit)
      .map((d) => {
        const li = el('li');
        const c = d.credit;
        li.append(
          el('strong', '', `${d.en}（${d.zh}）`),
          el('br'),
          `作者：${c.author}　授權：`,
          c.licenseUrl ? link(c.license, c.licenseUrl) : c.license,
          '　',
          link(c.file, c.source),
        );
        if (c.note) li.append(el('br'), `備註：${c.note}`);
        return li;
      });
    document.getElementById('credits').replaceChildren(...items);
    statusEl.hidden = true;
  } catch (err) {
    statusEl.textContent = `資料讀取失敗：${err.message}`;
    statusEl.classList.add('error');
  }
}

init();
