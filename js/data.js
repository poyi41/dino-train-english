// 單集頁預設顯示的 core 數量上限，其他收進「更多」（編輯模式用來提醒）
export const MAX_CORE = { words: 4, sentences: 3 };

// 讀取集數資料。episodes.json 只列 id，每集細節以 data/episodes/<id>.json 為唯一來源
async function fetchJson(url) {
  // no-cache：編輯模式存檔後，重新整理就要看到新內容
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) {
    throw new Error(`讀取 ${url} 失敗（${res.status}）`);
  }
  return res.json();
}

export function loadEpisode(id) {
  return fetchJson(`data/episodes/${id}.json`);
}

export async function loadAllEpisodes() {
  const { episodes } = await fetchJson('data/episodes.json');
  const list = await Promise.all(episodes.map(loadEpisode));
  return list.sort((a, b) => a.episode - b.episode);
}
