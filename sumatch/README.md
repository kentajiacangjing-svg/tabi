# SUMATCH（スマッチ）

探す・比べる・決めるを、ひとつに。

サービスを探している一般ユーザーと、仕事を受けたい企業をつなぐマッチングプラットフォームのMVPです。
相談 → マッチング → チャット → 見積もり → 比較 → 契約記録 までを、SUMATCHの中だけで完結できます。

## すぐに試す

```bash
cd sumatch
npm install
npm run dev          # http://localhost:3100
```

初回起動時に、デモデータ（企業10社・ユーザー5人・案件5件・見積もり・チャット・KPI）が自動で作られます。
`/login` の右側にある「デモアカウントで試す」から、各立場でワンクリックでログインできます（パスワードはすべて `sumatch123`）。

| アカウント | 立場 | 見どころ |
|---|---|---|
| yamada@demo.sumatch.jp | 一般ユーザー（山田 太郎） | 藤沢市・外壁塗装。3社とマッチし、118 / 132 / 145万円の見積もりを比較中 |
| ito@demo.sumatch.jp | 一般ユーザー | 相談を出したばかり（まだどの会社も選んでいない） |
| owner@shonan-paint.demo | 企業（湘南ペイント・管理者） | 「お客様が話したい」案件、チャット、見積もり |
| staff@shonan-paint.demo | 企業（湘南ペイント・担当者） | 複数担当者 |
| owner@fujisawa-reform.demo | 企業 | 工事中の契約あり |
| owner@umibe.demo | 企業（審査待ち） | 審査前の画面 |
| admin@demo.sumatch.jp | 運営 | `/admin` KPI・企業審査・各種マスタ |

データを初期化するには `npm run db:reset` を実行してから起動し直してください。

## 主なページ

一般ユーザー: `/` `/diagnosis` `/matches` `/messages` `/messages/[id]` `/quotes` `/projects` `/projects/[id]` `/account` `/company/[id]` `/notifications`
企業: `/business` `/business/signup` `/business/dashboard` `/business/leads` `/business/leads/[id]` `/business/messages` `/business/quotes` `/business/quotes/new` `/business/profile`
運営: `/admin`（KPI / 企業・審査 / ユーザー / 案件 / マッチング / チャット確認 / 見積もり / 契約 / 通報 / カテゴリ / 地域 / 料金プラン / 送信メール）

## 仕様のポイント

- **双方合意のマッチング**: お客様の「この会社と話したい」（1つの相談につき最大3社）と、企業の「対応したい」の両方が揃った時だけチャットが始まります。二重確認はありません。
- **マッチ度**は対応地域・予算帯・カテゴリ実績・希望時期・口コミ・返信速度・自社施工から算出し、理由も表示します（`src/lib/matching.ts`）。料金プランや SUMATCH Web の利用有無は入力に含めていません。
- **連絡先交換の検知**: 電話番号・メールアドレス・LINE・QRコード・SNS・URL（全角数字や漢数字も含む）を送信前に検知して警告し、運営画面に記録します（`src/lib/contact-detect.ts`）。
- **見積もり**: 工事項目・数量・単価・諸経費・値引き・消費税・保証・工期・材料・支払条件・追加費用・備考・PDF添付。改訂すると版が上がり、比較画面は最新版を表示します。比較コメントは今はルールベースで、`compareQuotes()` を差し替えればAIコメントにできます。
- **契約記録とステータス**: 相談中 → 見積もり中 → 比較中 → 契約 → 工事中 → 完了。完了後は口コミを投稿できます。
- **通知**: アプリ内通知・ブラウザ通知（SSE）・メール。メールは送信キュー（`email_outbox`）に記録され、運営画面で確認できます。SMTP・LINE公式アカウント・LINE WORKS は `src/lib/notify.ts` に送信処理を足せば使えます（LINEは通知専用で、会話はSUMATCH内で行います）。見積もり期限のリマインドは `POST /api/cron/reminders`（`Authorization: Bearer $CRON_SECRET`）。
- **AI返信下書き**: `ANTHROPIC_API_KEY` を設定するとチャットの ✦ ボタンで Claude が下書きを作ります。未設定時はテンプレートで下書きします。送信は必ず本人が行います。
- **料金プラン・カテゴリ・地域**はDBで管理し、`/admin` から追加・変更できます。初期は外壁塗装・屋根・水回り・内装・外構・エアコン・ハウスクリーニング（公開）と、引越し・不用品回収・車（非公開＝「まもなく」表示）です。

## 技術構成

- Next.js 15（App Router, Server Actions）/ TypeScript / Tailwind CSS v4
- DB: SQLite（Node 22 の組み込み `node:sqlite`。ネイティブモジュール不要）。スキーマは `src/lib/db/schema.ts` にあり、TEXT主キー・ISO日時で書いているため Postgres / Supabase へ移しやすい形です
- 認証: メール＋パスワード（scrypt）、HttpOnly Cookie のセッション（DBにはトークンのハッシュのみ保存）。ロールは `customer` / `business` / `admin`
- リアルタイム: Server-Sent Events（`/api/stream`）＋ポーリングのフォールバック。複数サーバーで動かす場合は `src/lib/realtime.ts` を Supabase Realtime / Redis に差し替えます
- ファイル: `storage/uploads` に保存し、`/api/files/[id]` で権限チェックしてから配信。ファイル形式はマジックバイトで判定（JPEG/PNG/WebP/GIF/HEIC/PDF、10MBまで）。配信時は `Content-Security-Policy: sandbox` を付けます

### セキュリティ

- すべてのページ・Server Action・APIで、サーバー側でロールと所有者を確認しています（`src/lib/access.ts`）。middleware は未ログイン時の入口チェックだけです
- お客様は自分の相談だけ、企業は自社に届いた案件だけ、運営は全体を見られます。企業にはマッチ成立までお客様の名前を表示せず、連絡先は一切公開しません
- 入力値は zod で検証しています。秘密鍵（`ANTHROPIC_API_KEY` など）はサーバー側だけで使い、フロントには出しません

## テスト

```bash
npm test               # ユニットテスト（マッチ度・連絡先検知・相場・見積もり比較・マッチング成立）
npm run build && npm run test:e2e   # ブラウザで通しのフロー（相談 → マッチ → チャット → 見積もり → 比較 → 決定 → 管理画面）と権限チェック
```

## 本番運用での注意

- SQLite と `storage/` は永続ディスクが必要です（Vercel のようなサーバーレスでは保存できません）。Render / Fly.io / VPS などで `npm run build && npm start`、または DB を Supabase(Postgres) に移して運用してください
- 公開URLが https の場合は `APP_URL=https://...` を設定すると Cookie に `Secure` が付きます
- 実テストでは `DEMO_MODE=false` にして、デモ用のワンクリックログインを無効にしてください

## 今後の拡張（データ構造は対応済み）

電子契約・決済（Stripe Connect）・エスクロー・工事保証・進捗管理は `contracts` テーブルにぶら下げる想定です。企業の複数担当者は `company_members`（owner / staff）で管理しています。
