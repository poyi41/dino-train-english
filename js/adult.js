// 大人確認：答對一題二位數加法才放行，避免孩子自己按到標記或重置
export function askAdult() {
  const a = 10 + Math.floor(Math.random() * 10);
  const b = 10 + Math.floor(Math.random() * 10);
  return Number(prompt(`大人確認：${a} + ${b} = ?`)) === a + b;
}
