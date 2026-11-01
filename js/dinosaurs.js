// 恐龍圖鑑資料：data/dinosaurs.json（名稱、插圖、圖片來源）。
// 各集出現哪些恐龍寫在每集 JSON 的 dinosaurs，這裡以英文名稱對應。
async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`讀取 ${url} 失敗（${res.status}）`);
  return res.json();
}

let cache = null;

// 回傳 Map：英文名稱 → { en, zh, image, credit }
export async function loadDinosaurs() {
  if (!cache) {
    const { dinosaurs } = await fetchJson('data/dinosaurs.json');
    cache = new Map(dinosaurs.map((d) => [d.en, d]));
  }
  return cache;
}

// 每集的「主角恐龍」＝ dinosaurs 第一隻，用來當那集的印章
export function stampDinosaur(ep) {
  return ep.dinosaurs?.[0] ?? null;
}

// 建立恐龍插圖；沒有插圖時退回 emoji
export function dinoPicture(info, fallbackEmoji = '🦕', className = 'dino-img') {
  if (info?.image) {
    const img = document.createElement('img');
    img.className = className;
    img.src = info.image;
    img.alt = info.en;
    img.loading = 'lazy';
    img.draggable = false;
    return img;
  }
  const span = document.createElement('span');
  span.className = `${className} dino-emoji`;
  span.textContent = fallbackEmoji;
  return span;
}
