// YouTube IFrame Player API 包裝：載入 API、建立播放器、播放指定片段後自動暫停
let apiPromise = null;

function loadApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise((resolve, reject) => {
      window.onYouTubeIframeAPIReady = () => resolve(window.YT);
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.onerror = () => reject(new Error('YouTube 載入失敗，請檢查網路'));
      document.head.append(script);
    });
  }
  return apiPromise;
}

// IFrame API 沒有「播到某秒」事件，只能在播放中定時檢查目前時間
const CHECK_INTERVAL_MS = 100;
// 播放中時間跑出片段這麼多秒，視為使用者自己拉了進度條，放棄自動暫停
const OUT_OF_RANGE_SEC = 2;

export async function createPlayer(elementId, videoId) {
  const YT = await loadApi();

  let segment = null; // { start, end, reached, started, onDone, timer }

  function endSegment() {
    if (!segment) return;
    clearInterval(segment.timer);
    const { onDone } = segment;
    segment = null;
    onDone?.();
  }

  const player = await new Promise((resolve, reject) => {
    const p = new YT.Player(elementId, {
      videoId,
      playerVars: {
        playsinline: 1, // iPad 上不要自動跳全螢幕
        rel: 0, // 結尾推薦影片盡量限制在同頻道
        modestbranding: 1,
      },
      events: {
        onReady: () => resolve(p),
        onError: (e) => reject(new Error(`影片無法播放（錯誤碼 ${e.data}）`)),
        onStateChange: (e) => {
          if (!segment) return;
          if (e.data === YT.PlayerState.PLAYING) {
            segment.started = true;
          } else if (
            e.data === YT.PlayerState.ENDED ||
            (e.data === YT.PlayerState.PAUSED && segment.started)
          ) {
            // 使用者自己按了暫停，或影片結束
            endSegment();
          }
        },
      },
    });
  });

  function checkSegment() {
    if (!segment || player.getPlayerState() !== YT.PlayerState.PLAYING) return;
    const t = player.getCurrentTime();

    // seekTo 剛送出時 getCurrentTime() 可能還是舊時間，等真的播進片段才開始判斷
    if (!segment.reached) {
      if (t >= segment.start - 0.5 && t < segment.end) {
        segment.reached = true;
        segment.started = true;
      }
      return;
    }

    if (t < segment.start - OUT_OF_RANGE_SEC || t > segment.end + OUT_OF_RANGE_SEC) {
      endSegment(); // 使用者自己拉了進度條，讓影片繼續播
    } else if (t >= segment.end) {
      clearInterval(segment.timer);
      player.pauseVideo(); // 觸發 PAUSED → endSegment()
    }
  }

  return {
    // 跳到 start 播放，到 end 自動暫停；片段結束（含被中斷）時呼叫 onDone
    playSegment(start, end, onDone) {
      endSegment();
      segment = {
        start,
        end,
        reached: false,
        started: false,
        onDone,
        timer: setInterval(checkSegment, CHECK_INTERVAL_MS),
      };
      player.seekTo(start, true);
      player.playVideo();
    },

    // 跳到某秒開始播放，不自動暫停
    playFrom(time) {
      endSegment();
      player.seekTo(time, true);
      player.playVideo();
    },
  };
}
