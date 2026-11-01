// 編輯模式存檔，依序嘗試：
// 1. tools/serve.py 的存檔 API（不用選資料夾，只限執行 server 的那台電腦）
// 2. File System Access API 直接寫回專案資料夾（用一般 http.server 時；只支援電腦版 Edge / Chrome，
//    資料夾授權記在 IndexedDB，下次只要再按一次「允許」）
// 3. 下載 JSON，手動覆蓋

// 回傳 true（可存檔）、false（是我們的 server，但這台裝置不能存）、null（不是 tools/serve.py）
export async function getServerSaveStatus() {
  try {
    const res = await fetch('api/status', { cache: 'no-store' });
    if (!res.ok) return null;
    return Boolean((await res.json()).canSave);
  } catch {
    return null;
  }
}

// 新集數會由 server 自動加進 episodes.json
export async function saveToServer(episodeId, text) {
  const res = await fetch(`api/episodes/${episodeId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: text,
  });
  if (!res.ok) {
    throw new Error((await res.text()) || `HTTP ${res.status}`);
  }
}

const DB_NAME = 'dinoTrain';
const STORE = 'handles';
const KEY = 'projectDir';

export function canWriteFiles() {
  return 'showDirectoryPicker' in window;
}

function withStore(mode, fn) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      try {
        const tx = open.result.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
      } catch (err) {
        reject(err); // 例如 put() 遇到無法複製的物件
      }
    };
  });
}

async function loadSavedDir() {
  try {
    return await withStore('readonly', (s) => s.get(KEY));
  } catch {
    return null;
  }
}

async function saveDir(handle) {
  try {
    await withStore('readwrite', (s) => s.put(handle, KEY));
  } catch {
    // 記不住就下次再選一次
  }
}

async function getFile(dir, path) {
  let current = dir;
  const parts = path.split('/');
  for (const part of parts.slice(0, -1)) {
    current = await current.getDirectoryHandle(part);
  }
  return current.getFileHandle(parts.at(-1), { create: true });
}

async function isProjectDir(dir) {
  try {
    const data = await dir.getDirectoryHandle('data');
    await data.getFileHandle('episodes.json');
    return true;
  } catch {
    return false;
  }
}

// 回傳專案資料夾，之後用 readText / writeText 讀寫。
// 必須在按鈕的 click 處理函式裡呼叫（瀏覽器要求使用者操作才能要求權限）
export async function getProjectDir() {
  const saved = await loadSavedDir();
  if (saved && (await saved.requestPermission({ mode: 'readwrite' })) === 'granted') {
    return saved;
  }

  const dir = await window.showDirectoryPicker({ id: 'dino-train', mode: 'readwrite' });
  if (!(await isProjectDir(dir))) {
    throw new Error('選的不是專案資料夾：請選有 index.html 和 data 資料夾的那一層');
  }
  await saveDir(dir);
  return dir;
}

export async function readText(dir, path) {
  const file = await (await getFile(dir, path)).getFile();
  return file.text();
}

export async function writeText(dir, path, text) {
  const writable = await (await getFile(dir, path)).createWritable();
  await writable.write(text);
  await writable.close();
}

// 不支援 File System Access API 時的備案：下載檔案讓使用者手動覆蓋
export function downloadText(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
