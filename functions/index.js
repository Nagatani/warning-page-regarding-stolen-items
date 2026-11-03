export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 1. 推測されにくいパラメータ名に変更（例: "tag"）
  // 以前の "id" は受け付けず無視します
  const tagToken = url.searchParams.get("tag");

  // 2. パラメータが設定されていない（または空文字）場合は即座に無効化
  if (!tagToken) {
    return new Response("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=UTF-8" },
    });
  }

  // 3. 有効なパラメータが存在する場合のみDiscordへ通知
  const jstTime = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  const ip = request.headers.get("CF-Connecting-IP") || "不明";
  const userAgent = request.headers.get("User-Agent") || "不明";

  const webhookUrl = env.DISCORD_WEBHOOK_URL;
  if (webhookUrl) {
    const discordPayload = {
      embeds: [
        {
          title: "🚨 傘のNFCタグがスキャンされました",
          color: 0xff0000,
          fields: [
            { name: "識別トークン (tag)", value: `\`${tagToken}\``, inline: true },
            { name: "スキャン時刻 (JST)", value: jstTime, inline: true },
            { name: "接続元IP", value: ip, inline: false },
            { name: "端末情報 (User-Agent)", value: `\`\`\`${userAgent.slice(0, 500)}\`\`\``, inline: false },
          ],
        },
      ],
    };

    context.waitUntil(
      fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(discordPayload),
      })
    );
  }

  // 4. 警告画面 ＆ サイレン・バイブレーションの返却
  // 4. 警告画面 ＆ 確実なタップ起動型アラーム
  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>【警告】防犯追跡登録傘 - 追跡中</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%;
      height: 100%;
      background-color: #0b0b0b;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      overflow: hidden;
      user-select: none;
      -webkit-user-select: none;
    }
    /* 全画面をタップ領域にする */
    #overlay {
      position: fixed;
      top: 0; left: 0; width: 100%; height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 24px;
      z-index: 9999;
    }
    .alert-card {
      border: 3px solid #ff3b30;
      background: #1c0505;
      padding: 24px 20px;
      border-radius: 16px;
      text-align: center;
      max-width: 380px;
      width: 100%;
      box-shadow: 0 0 30px rgba(255, 59, 48, 0.4);
    }
    .badge {
      display: inline-block;
      background: #ff3b30;
      color: #fff;
      font-size: 13px;
      font-weight: bold;
      padding: 4px 12px;
      border-radius: 20px;
      margin-bottom: 14px;
    }
    h2 { font-size: 20px; color: #ff453a; margin-bottom: 12px; }
    p { font-size: 14px; color: #d1d1d6; line-height: 1.6; margin-bottom: 20px; }
    
    /* 相手が思わず押してしまうボタンデザイン */
    .action-btn {
      display: block;
      width: 100%;
      background: #ff3b30;
      color: white;
      font-size: 16px;
      font-weight: bold;
      padding: 16px 0;
      border-radius: 10px;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(255, 59, 48, 0.5);
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.03); }
      100% { transform: scale(1); }
    }
    .flashing {
      animation: flash-bg 0.4s infinite alternate;
    }
    @keyframes flash-bg {
      0% { background-color: #0b0b0b; }
      100% { background-color: #660000; }
    }
  </style>
</head>
<body>
  <div id="overlay">
    <div class="alert-card">
      <span class="badge">防犯追跡作動中</span>
      <h2>【警告】所有者管理傘</h2>
      <p>この傘のNFCタグが読み取られました。<br>端末識別情報・IPを所有者に送信済みです。</p>
      
      <!-- 閉じようとする・解除しようとする心理を利用してタップさせる -->
      <button class="action-btn" id="trigger-btn">
        誤操作・返却手続きへ進む
      </button>
    </div>
  </div>

  <script>
    let audioCtx = null;
    let isFired = false;

    // 音声発火コア関数（タッチイベント内でのみ動かす）
    async function triggerAlarm() {
      if (isFired) return;
      isFired = true;

      // 1. 画面の赤点滅開始
      document.body.classList.add('flashing');

      // 2. Androidバイブレーション
      if (navigator.vibrate) {
        navigator.vibrate([400, 200, 400, 200, 600]);
      }

      // 3. AudioContext初期化 ＆ 強制resume（iOS必須処理）
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContextClass();

      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      // 4. アラーム音の合成再生（周波数を高速スイープさせる鋭い防犯ブザー音）
      playEmergencySiren();
    }

    function playEmergencySiren() {
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sawtooth';

      // 800Hz 〜 1600Hz を高速往復させる防犯アラーム音
      for (let i = 0; i < 15; i++) {
        const step = i * 0.25;
        osc.frequency.setValueAtTime(850, now + step);
        osc.frequency.linearRampToValueAtTime(1600, now + step + 0.12);
        osc.frequency.linearRampToValueAtTime(850, now + step + 0.25);
      }

      // 最大音量近くに設定
      gain.gain.setValueAtTime(0.8, now);
      // 4秒後にフェードアウト
      gain.gain.setValueAtTime(0.8, now + 3.8);
      gain.gain.linearRampToValueAtTime(0.01, now + 4.0);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now);
      osc.stop(now + 4.0);
    }

    // 画面全体のどこをタップ・スワイプしても即鳴らす
    const overlay = document.getElementById('overlay');
    ['touchstart', 'touchend', 'click'].forEach(evt => {
      overlay.addEventListener(evt, triggerAlarm, { once: true, passive: false });
    });
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
      "Cache-Control": "no-store",
    },
  });
}