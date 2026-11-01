// 所有 localStorage 讀寫集中在這裡；隱私模式或被封鎖時會丟例外，一律吞掉並回傳預設值
const PREFIX = 'dinoTrain.';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // 存不進去就算了，網站照常可用
  }
}

export function getWatched() {
  return read('watched', []);
}

export function isWatched(episodeId) {
  return getWatched().includes(episodeId);
}

export function markWatched(episodeId) {
  const watched = getWatched();
  if (!watched.includes(episodeId)) {
    watched.push(episodeId);
    write('watched', watched);
  }
}
