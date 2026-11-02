// 包裝瀏覽器內建 speechSynthesis（en-US）。
// iPad Safari 只允許在使用者點擊時發聲，所以 speak() 必須直接在 click 處理函式裡呼叫。
const synth = window.speechSynthesis;
let voice = null;

function pickVoice() {
  const voices = synth.getVoices();
  voice =
    voices.find((v) => v.lang === 'en-US' && v.localService) ||
    voices.find((v) => v.lang === 'en-US') ||
    voices.find((v) => v.lang.startsWith('en')) ||
    null;
}

if (synth) {
  pickVoice();
  // 語音清單在多數瀏覽器是非同步載入
  synth.addEventListener?.('voiceschanged', pickVoice);
}

export function isSpeechSupported() {
  return Boolean(synth);
}

const RATE = 0.85; // 給小孩聽，稍微放慢

function makeUtterance(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = RATE;
  if (voice) utterance.voice = voice;
  return utterance;
}

export function speak(text) {
  if (!synth) return false;
  activeUtterance = null; // 正在朗讀的故事句被打斷，不拿來校正時間
  synth.cancel();
  synth.speak(makeUtterance(text));
  return true;
}

// 備援計時：每個字平均分到的毫秒數。先用估計值，每唸完一句就依實際花的時間校正，
// 所以不同裝置、不同語音唸幾句之後就會對準
let msPerWord = 340 / RATE;
// 開始唸之後這麼久還沒收到 boundary 事件，就改用平均分配時間
const BOUNDARY_GRACE_MS = 350;
let activeUtterance = null;

// 朗讀並回報唸到第幾個字（以空白分隔的字）：onWord(index)，唸完或被打斷時 onEnd()。
// 優先用 boundary 事件的 charIndex 對應到字；瀏覽器沒送 boundary（例如 iPad Safari）時，
// 依字數平均分配時間輪流回報。
export function speakWords(text, { onWord, onEnd } = {}) {
  if (!synth) return false;
  synth.cancel();

  const starts = [...text.matchAll(/\S+/g)].map((m) => m.index);
  const utterance = makeUtterance(text);
  activeUtterance = utterance;
  let current = -1;
  let gotBoundary = false;
  let timer = null;
  let startedAt = 0;
  let usedFallback = false;

  const show = (index) => {
    if (index !== current && index < starts.length) {
      current = index;
      onWord?.(index);
    }
  };
  const stopTimer = () => clearTimeout(timer);

  // 依「從開始唸到現在過了多久」算出該亮第幾個字，所以等待 boundary 的那段時間不會造成落後
  const startFallback = () => {
    if (gotBoundary) return;
    usedFallback = true;
    const tick = () => {
      if (gotBoundary) return;
      show(Math.min(Math.floor((performance.now() - startedAt) / msPerWord), starts.length - 1));
      timer = setTimeout(tick, 50);
    };
    tick();
  };

  utterance.onstart = () => {
    startedAt = performance.now();
    timer = setTimeout(startFallback, BOUNDARY_GRACE_MS);
  };
  utterance.onboundary = (e) => {
    if (e.name && e.name !== 'word') return;
    gotBoundary = true;
    stopTimer();
    // charIndex 落在哪個字的範圍
    let index = 0;
    while (index + 1 < starts.length && starts[index + 1] <= e.charIndex) index += 1;
    show(index);
  };
  utterance.onend = () => {
    stopTimer();
    // 完整唸完（沒被下一句打斷）才拿來校正每個字的時間；限制在合理範圍內
    if (usedFallback && !gotBoundary && activeUtterance === utterance && startedAt) {
      const measured = (performance.now() - startedAt) / starts.length;
      msPerWord = Math.min(900, Math.max(200, msPerWord * 0.5 + measured * 0.5));
    }
    onEnd?.();
  };
  utterance.onerror = () => {
    stopTimer();
    onEnd?.();
  };

  synth.speak(utterance);
  return true;
}

export function stopSpeaking() {
  synth?.cancel();
}
