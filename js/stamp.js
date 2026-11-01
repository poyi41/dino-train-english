// 看完一集的蓋印章畫面。孩子要自己點一下才蓋下去：
// iPad 只允許在點擊時發出聲音（Web Audio 與 speechSynthesis 都是），順便讓蓋章更有參與感。
import { el } from './dom.js';
import { speak } from './speech.js';
import { dinoPicture } from './dinosaurs.js';

// 用 Web Audio 合成「咚！」的蓋章聲，不需要音效檔
function playThump() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.25);
    gain.gain.setValueAtTime(0.9, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // 沒聲音也沒關係
  }
}

// ep：這一集；dino：{ en, zh, emoji } 加上圖鑑資料（可能沒有插圖）
export function showStampCeremony(ep, dino) {
  const overlay = el('div', 'stamp-overlay');
  const card = el('div', 'stamp-card');

  const title = el('div', 'stamp-title', `🎉 看完第 ${ep.episode} 集了！`);
  const slot = el('div', 'stamp-slot');
  const pressBtn = el('button', 'big-btn stamp-press', '👆 蓋印章！');
  pressBtn.type = 'button';

  const after = el('div', 'stamp-after');
  after.hidden = true;
  const name = el('div', 'stamp-name');
  name.append(el('span', 'en', dino?.en ?? ''), el('span', 'zh', dino?.zh ?? ''));
  const links = el('div', 'stamp-links');
  const book = el('a', 'big-btn', '📒 印章簿');
  book.href = 'stamps.html';
  const dex = el('a', 'big-btn', '🦕 圖鑑');
  dex.href = 'dex.html';
  const close = el('button', 'big-btn stamp-close', '👍 好！');
  close.type = 'button';
  close.addEventListener('click', () => overlay.remove());
  links.append(book, dex, close);
  after.append(name, links);

  // once：只能蓋一次
  pressBtn.addEventListener('click', () => {
    pressBtn.hidden = true;
    const stamp = el('div', 'stamp stamp-slam');
    stamp.append(dinoPicture(dino, dino?.emoji ?? '🦕', 'stamp-img'), el('div', 'stamp-number', String(ep.episode)));
    slot.append(stamp);
    playThump();
    speak(dino?.en ? `Great job! ${dino.en}!` : 'Great job!');
    after.hidden = false;
  }, { once: true });

  card.append(title, slot, pressBtn, after);
  overlay.append(card);
  document.body.append(overlay);
}
