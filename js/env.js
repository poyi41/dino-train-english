// 是否在家裡電腦本機開啟（tools/serve.py）。網路版（GitHub Pages）與 iPad 都不是。
// 編輯模式只在本機提供，因為存檔與字幕都需要 serve.py。
export const isLocalComputer = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
