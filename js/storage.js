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

// 回傳 true 表示這次才剛看完（第一次），用來決定要不要蓋印章
export function markWatched(episodeId) {
  const watched = getWatched();
  if (watched.includes(episodeId)) return false;
  watched.push(episodeId);
  write('watched', watched);
  return true;
}

// 取消某一集的看完紀錄（印章跟著消失），播放進度也歸零
export function unmarkWatched(episodeId) {
  write('watched', getWatched().filter((id) => id !== episodeId));
  const progress = getProgress();
  delete progress[episodeId];
  write('progress', progress);
}

// 全部重來：清掉所有看完紀錄、印章與進度
export function resetAll() {
  write('watched', []);
  write('progress', {});
}

// 每集累計播放的秒數：{ ep01: 312, ... }。分好幾次看也會累加
export function getProgress() {
  return read('progress', {});
}

export function addProgress(episodeId, seconds) {
  const progress = getProgress();
  progress[episodeId] = (progress[episodeId] ?? 0) + seconds;
  write('progress', progress);
  return progress[episodeId];
}
