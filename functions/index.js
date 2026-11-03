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

  // 2. テストモード判定（?test=1 または ?test=true で全通知を無効化）
  const isTestMode = url.searchParams.get("test") === "1" || url.searchParams.get("test") === "true";

  const webhookUrl = env.DISCORD_WEBHOOK_URL;
  const jstTime = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  const ip = request.headers.get("CF-Connecting-IP") || "不明";
  const userAgent = request.headers.get("User-Agent") || "不明";

  // 3. 「返却しました」ボタン押下時のPOSTリクエスト処理
  if (request.method === "POST" && url.searchParams.get("action") === "returned") {
    // テストモードでない場合のみDiscordへ通知
    if (webhookUrl && !isTestMode) {
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

    return new Response(JSON.stringify({ success: true, testMode: isTestMode }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // 4. 重複通知防止チェック（Cookieによる10分間のクールダウン制御）
  const cookieHeader = request.headers.get("Cookie") || "";
  const hasNotifiedRecently = cookieHeader.includes(`umbrella_seen_${encodeURIComponent(tagToken)}=1`);

  // テストモードでなく、かつ短時間の初回アクセス時のみDiscordへ通知
  if (webhookUrl && !isTestMode && !hasNotifiedRecently) {
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

  // 5. 赤色点滅アニメーション付き返却要請画面のHTML
  const testBadgeHtml = isTestMode
    ? `<div class="test-banner">⚠️ テストモード中（Discord通知は停止されています）</div>`
    : "";

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
      animation: alert-pulse 1.2s infinite alternate ease-in-out;
    }
    @keyframes alert-pulse {
      0% { background-color: #0b0b0b; }
      100% { background-color: #400a0a; }
    }

    .card {
      background: #181818;
      border: 3px solid #ff3b30;
      border-radius: 16px;
      max-width: 420px;
      width: 100%;
      padding: 28px 20px;
      text-align: center;
      box-shadow: 0 0 25px rgba(255, 59, 48, 0.4);
      animation: card-glow 1.2s infinite alternate ease-in-out;
    }
    @keyframes card-glow {
      0% {
        border-color: #ff3b30;
        box-shadow: 0 0 15px rgba(255, 59, 48, 0.3);
      }
      100% {
        border-color: #ff6961;
        box-shadow: 0 0 35px rgba(255, 59, 48, 0.7);
      }
    }

    .test-banner {
      background-color: #ffd60a;
      color: #000;
      font-size: 12px;
      font-weight: bold;
      padding: 6px 12px;
      border-radius: 8px;
      margin-bottom: 16px;
    }

    .badge {
      display: inline-block;
      background: #ff3b30;
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
      border-left: 3px solid #ff3b30;
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
      color: #a1a1a6;
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
      transition: background 0.2s, transform 0.1s;
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
    ${testBadgeHtml}
    <span class="badge">管理識別: ${tagToken}</span>
    <h1>【重要】この傘は個人所有物です</h1>
    
    <div class="message">
      お取り違え、または持ち去りが発生しています。<br><br>
      現在地・スキャンログは所有者へ通知されました。<br>
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
    const isTest = ${isTestMode ? "true" : "false"};
    const STORAGE_KEY = 'umbrella_returned_' + encodeURIComponent("${tagToken}");
    const btn = document.getElementById('return-btn');
    const successBox = document.getElementById('success-box');

    // 本番時のみlocalStorageで二重送信を防止（テスト時は毎回動作確認できるよう除外）
    if (!isTest && localStorage.getItem(STORAGE_KEY)) {
      setButtonDisabled();
    }

    async function submitReturn() {
      btn.disabled = true;
      btn.textContent = '送信中...';

      const postUrl = window.location.pathname + window.location.search + (window.location.search ? '&' : '?') + 'action=returned';

      try {
        const res = await fetch(postUrl, { method: 'POST' });

        if (res.ok) {
          if (!isTest) {
            localStorage.setItem(STORAGE_KEY, 'true');
          }
          setButtonDisabled();
        } else {
          alert('通信に失敗しました。');
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

  const headers = new Headers({
    "Content-Type": "text/html; charset=UTF-8",
    "Cache-Control": "no-store",
  });

  // テストモードではない、かつ初回アクセス時のみクッキーを付与
  if (!isTestMode && !hasNotifiedRecently) {
    headers.append(
      "Set-Cookie",
      `umbrella_seen_${encodeURIComponent(tagToken)}=1; Max-Age=600; Path=/; SameSite=Lax; HttpOnly`
    );
  }

  return new Response(html, { headers });
}