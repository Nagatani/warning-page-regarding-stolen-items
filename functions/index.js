export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 1. クエリから傘のIDを取得
  const itemId = url.searchParams.get("id") || "未設定";

  // 2. アクセス情報の取得
  const jstTime = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  const ip = request.headers.get("CF-Connecting-IP") || "不明";
  const userAgent = request.headers.get("User-Agent") || "不明";

  // 3. Discordへ非同期送信（ユーザーの画面表示を待たせないためにwaitUntilを使用）
  const webhookUrl = env.DISCORD_WEBHOOK_URL;
  if (webhookUrl) {
    const discordPayload = {
      embeds: [
        {
          title: "🚨 傘のNFCタグがスキャンされました",
          color: 0xff0000, // 赤色
          fields: [
            { name: "傘ID", value: itemId, inline: true },
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

  // 4. スマホ通知バナー用のタイトル ＆ 警告HTML（サウンド・バイブ機能付き）
  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>【警告】防犯追跡登録傘 - ID:${itemId}</title>
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: #0d0d0d;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    /* 画面全体をタップ対象にするコンテナ */
    #touch-area {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      width: 100%;
      height: 100%;
      padding: 24px;
      text-align: center;
      cursor: pointer;
    }
    .alert-card {
      border: 3px solid #ff3b30;
      background: #2a0808;
      padding: 28px 20px;
      border-radius: 16px;
      max-width: 400px;
      width: 100%;
      box-shadow: 0 0 25px rgba(255, 59, 48, 0.4);
    }
    .badge {
      display: inline-block;
      background: #ff3b30;
      color: #fff;
      font-size: 13px;
      font-weight: bold;
      padding: 4px 12px;
      border-radius: 20px;
      margin-bottom: 16px;
      letter-spacing: 0.5px;
    }
    h2 {
      margin: 0 0 12px 0;
      font-size: 22px;
      color: #ff453a;
    }
    p {
      margin: 8px 0;
      font-size: 14px;
      color: #e5e5ea;
      line-height: 1.6;
    }
    .tap-guide {
      margin-top: 20px;
      font-size: 12px;
      color: #8e8e93;
      border-top: 1px solid #441515;
      padding-top: 12px;
    }
    /* アラート作動時の点滅アニメーション */
    .flashing {
      animation: flash-bg 0.5s infinite alternate;
    }
    @keyframes flash-bg {
      0% { background-color: #0d0d0d; }
      100% { background-color: #5c0a0a; }
    }
  </style>
</head>
<body>
  <div id="touch-area">
    <div class="alert-card">
      <span class="badge">管理番号: ${itemId}</span>
      <h2>【警告】所有者管理傘</h2>
      <p>この傘は位置・端末検知システムに登録されています。</p>
      <p>アクセス日時・IP・端末識別ログが管理者のDiscordへ即時送信されました。</p>
      <div class="tap-guide">画面をタップして確認を完了してください</div>
    </div>
  </div>

  <script>
    let audioCtx = null;
    let isAlarming = false;

    // Web Audio API によるサイレン音の生成（外部mp3不要）
    function startSiren() {
      if (isAlarming) return;
      isAlarming = true;

      // 画面の赤点滅を開始
      document.body.classList.add('flashing');

      // バイブレーション（Android対応機種で動作）
      if (navigator.vibrate) {
        navigator.vibrate([300, 200, 300, 200, 500]);
      }

      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();

      // 周波数を上下させて緊急アラーム音を作る
      function playBeep(freq, duration, delay) {
        setTimeout(() => {
          if (!audioCtx) return;
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();

          osc.type = 'sawtooth'; // 鋭いサイレン音
          osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

          // 音量制御
          gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

          osc.connect(gain);
          gain.connect(audioCtx.destination);

          osc.start();
          osc.stop(audioCtx.currentTime + duration);
        }, delay);
      }

      // ピロピロと高音警告音を繰り返すシーケンス（4回ループ）
      let delay = 0;
      for (let i = 0; i < 4; i++) {
        playBeep(880, 0.15, delay);       // 高音
        playBeep(659.25, 0.15, delay + 180); // 中音
        delay += 380;
      }
    }

    // 画面のどこを触っても即座に発火
    const touchArea = document.getElementById('touch-area');
    touchArea.addEventListener('click', startSiren, { once: true });
    touchArea.addEventListener('touchstart', startSiren, { once: true });

    // ページロード時にも一度自動再生を試行（ブロックされなければ即鳴る）
    window.addEventListener('load', () => {
      try {
        startSiren();
      } catch (e) {
        // 自動再生ポリシーに弾かれた場合はclick/touchstart待ちへ自然にフォールバック
      }
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