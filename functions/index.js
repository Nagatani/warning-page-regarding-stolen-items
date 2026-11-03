export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 1. パラメータチェック（tag が存在しない場合は 404 で遮断）
  const tagToken = url.searchParams.get("tag");
  if (!tagToken) {
    return new Response("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=UTF-8" },
    });
  }

  const webhookUrl = env.DISCORD_WEBHOOK_URL;
  const jstTime = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  const ip = request.headers.get("CF-Connecting-IP") || "不明";
  const userAgent = request.headers.get("User-Agent") || "不明";

  // 2. 「返却しました」ボタン押下時のPOSTリクエスト処理
  if (request.method === "POST" && url.searchParams.get("action") === "returned") {
    if (webhookUrl) {
      const returnPayload = {
        embeds: [
          {
            title: "🟢 傘が元の場所に返却されました",
            color: 0x2ecc71, // 緑色
            description: "相手が画面上の「返却しました」ボタンを押しました。",
            fields: [
              { name: "識別トークン (tag)", value: `\`${tagToken}\``, inline: true },
              { name: "返却報告時刻 (JST)", value: jstTime, inline: true },
              { name: "接続元IP", value: ip, inline: false },
            ],
          },
        ],
      };

      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(returnPayload),
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // 3. 通常アクセス時のDiscord通知（初期アクセス検知）
  if (webhookUrl) {
    const alertPayload = {
      embeds: [
        {
          title: "🚨 傘のNFCタグがスキャンされました",
          color: 0xff3b30, // 赤色
          fields: [
            { name: "識別トークン (tag)", value: `\`${tagToken}\``, inline: true },
            { name: "スキャン時刻 (JST)", value: jstTime, inline: true },
            { name: "接続元IP", value: ip, inline: false },
            { name: "端末情報 (User-Agent)", value: `\`\`\`${userAgent.slice(0, 300)}\`\`\``, inline: false },
          ],
        },
      ],
    };

    context.waitUntil(
      fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(alertPayload),
      })
    );
  }

  // 4. 返却要請画面のHTML
  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>【警告】防犯登録傘 - 元の場所へ返却してください</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #0d0d0d;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }
    .card {
      background: #181818;
      border: 2px solid #ff453a;
      border-radius: 16px;
      max-width: 420px;
      width: 100%;
      padding: 28px 20px;
      text-align: center;
      box-shadow: 0 4px 24px rgba(255, 69, 58, 0.2);
    }
    .badge {
      display: inline-block;
      background: #ff453a;
      color: #fff;
      font-size: 12px;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: 20px;
      letter-spacing: 0.5px;
      margin-bottom: 16px;
    }
    h1 {
      font-size: 20px;
      color: #ff453a;
      margin-bottom: 14px;
      line-height: 1.4;
    }
    .message {
      font-size: 14px;
      color: #d1d1d6;
      line-height: 1.7;
      text-align: left;
      background: #241414;
      border-left: 3px solid #ff453a;
      padding: 14px;
      border-radius: 6px;
      margin-bottom: 20px;
    }
    .message strong {
      color: #fff;
      text-decoration: underline;
    }
    .notice {
      font-size: 12px;
      color: #8e8e93;
      margin-bottom: 24px;
      line-height: 1.5;
    }
    .return-btn {
      width: 100%;
      background: #34c759;
      color: #fff;
      font-size: 16px;
      font-weight: bold;
      padding: 16px 0;
      border-radius: 12px;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(52, 199, 89, 0.3);
      transition: background 0.2s, opacity 0.2s;
    }
    .return-btn:active {
      transform: scale(0.98);
    }
    .return-btn:disabled {
      background: #3a3a3c;
      color: #8e8e93;
      box-shadow: none;
      cursor: not-allowed;
    }
    .success-box {
      display: none;
      background: #142918;
      border: 1px solid #34c759;
      border-radius: 8px;
      padding: 14px;
      margin-top: 16px;
      font-size: 13px;
      color: #34c759;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">管理識別: ${tagToken}</span>
    <h1>【重要】この傘は個人所有物です</h1>
    
    <div class="message">
      お取り違え、または持ち去りが発生しています。<br><br>
      現在地・スキャンログはすでに所有者へ通知されました。<br>
      <strong>直ちに持ち去った元の傘立て（店舗・施設）へお戻しください。</strong>
    </div>

    <p class="notice">
      元の場所へ傘を戻したら、下のボタンを押してください。<br>所有者に返却完了の通知が送信されます。
    </p>

    <button id="return-btn" class="return-btn" onclick="submitReturn()">
      元の場所へ返却しました
    </button>

    <div id="success-box" class="success-box">
      返却通知を所有者に送信しました。<br>ご協力ありがとうございました。<br>返却が確認されない場合は、所轄の警察署から連絡が入る場合があります。
    </div>
  </div>

  <script>
    const STORAGE_KEY = 'umbrella_returned_' + encodeURIComponent("${tagToken}");
    const btn = document.getElementById('return-btn');
    const successBox = document.getElementById('success-box');

    // 既に返却済みボタンが押されている場合は再押下をロック
    if (localStorage.getItem(STORAGE_KEY)) {
      setButtonDisabled();
    }

    async function submitReturn() {
      btn.disabled = true;
      btn.textContent = '送信中...';

      try {
        const res = await fetch(window.location.pathname + '?tag=${tagToken}&action=returned', {
          method: 'POST'
        });

        if (res.ok) {
          localStorage.setItem(STORAGE_KEY, 'true');
          setButtonDisabled();
        } else {
          alert('通信に失敗しました。電波の良い場所でもう一度お試しください。');
          btn.disabled = false;
          btn.textContent = '元の場所へ返却しました';
        }
      } catch (err) {
        alert('通信に失敗しました。');
        btn.disabled = false;
        btn.textContent = '元の場所へ返却しました';
      }
    }

    function setButtonDisabled() {
      btn.disabled = true;
      btn.textContent = '返却通知済み';
      successBox.style.display = 'block';
    }
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