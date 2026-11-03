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

  // 4. スマホ通知バナー用のタイトル ＆ 警告HTML
  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>【警告】防犯追跡登録傘 - ID:${itemId}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #121212;
      color: #fff;
      padding: 24px;
      line-height: 1.6;
    }
    .alert-card {
      border: 2px solid #e53e3e;
      background: #231215;
      padding: 24px;
      border-radius: 12px;
      margin-top: 16px;
    }
    .badge {
      display: inline-block;
      background: #e53e3e;
      color: #fff;
      font-size: 13px;
      font-weight: bold;
      padding: 4px 10px;
      border-radius: 6px;
      margin-bottom: 12px;
    }
    h2 { margin: 0 0 12px 0; font-size: 20px; }
    p { margin: 8px 0; font-size: 14px; color: #cbd5e0; }
  </style>
</head>
<body>
  <div class="alert-card">
    <span class="badge">管理識別: ${itemId}</span>
    <h2>【警告】所有者管理傘です</h2>
    <p>NFCタグの読み取りにより、アクセス時刻と端末情報が管理者に即時通知されました。</p>
    <p>お取り違えの場合は、直ちに元の傘立てまたは店舗受付へお戻しください。</p>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
      "Cache-Control": "no-store",
    },
  });
}