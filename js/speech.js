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

export function speak(text) {
  if (!synth) return false;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 0.85; // 給小孩聽，稍微放慢
  if (voice) utterance.voice = voice;
  synth.speak(utterance);
  return true;
}

export function stopSpeaking() {
  synth?.cancel();
}
