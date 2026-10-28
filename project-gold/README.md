# PROJECT GOLD（仮称）— 白×ゴールドの会員制マッチングアプリ（開発版）

夜職で働く成人女性と、会話や食事など一緒に過ごす時間に価値を感じる成人男性をつなぐ会員制サービスの**開発版**です。
提供するのは**同席・交流の機会のみ**で、性行為・性的サービスの売買・約束・あっせん・保証は行いません（禁止語のサーバー側拒否・通報→審査→停止のワークフローを実装済み）。

> ⚠️ 開発・内部デモ専用です。決済はすべて**サンドボックス（疑似決済）**で、実際の請求・送金は行われません。
> 名称・料金・ランク境界はすべて仮設定で、管理画面から変更できます。公開前に [法令確認チェックリスト](docs/legal-checklist.md) の対応が必要です。

- iOS / Android / Web を **Expo SDK 58 + React Native 0.88 + Expo Router + TypeScript** の単一コードベースで提供
- バックエンドは **Supabase**（PostgreSQL・Auth・Storage・Realtime・Edge Functions）。ランク・利用額・報酬・予約状態・権限はすべて**サーバー側の SQL 関数で確定**し、テーブルには RLS を設定
- Supabase を用意しなくても動かせるよう、同じマイグレーション・同じ supabase-js クライアントで動く**ローカル開発サーバー**（PGlite＝WASM 版 PostgreSQL）を同梱

## ブラウザだけで触るデモ（サーバー不要）

`npm run build:demo` で `demo-dist/` に、サーバーなしで動く1ページ版を書き出します。PGlite（WASM 版 PostgreSQL）をページに同梱し、本番と同じマイグレーション・RLS・サーバー関数をブラウザ内で実行します（`src/demo/gateway.ts`）。
データはその端末のブラウザ（IndexedDB）にだけ保存され、他の人とは共有されません。男女のやりとりは、同じ端末でログアウト→別のデモアカウントでログインして試します。ログイン画面の「デモデータを初期状態に戻す」で初期化できます。

## すぐに動かす（ローカル・Supabase 不要）

Node.js 20 以上が必要です。

```bash
cd project-gold
npm install
npm run dev:env          # .env.local（ローカル開発サーバーの接続先）を生成
npm run dev:api          # ターミナル1: 開発サーバー http://localhost:54321（初回にマイグレーション＋デモデータ投入）
npm run web              # ターミナル2: Web 版 http://localhost:8081
# スマホ実機: npm start → Expo Go / 開発ビルドで QR を読み込み（.env.local の URL を PC の LAN IP に変更）
```

デモアカウント（パスワードはすべて `DemoPass123!`、ログイン画面のボタンでワンタップログイン可・開発ビルドのみ表示）

| 役割 | メール | 状態 |
|---|---|---|
| 男性 | taro@demo.projectgold.local | FREE（C まで申込可） |
| 男性 | kenichi@demo.projectgold.local | GOLD（A まで申込可・サンドボックス） |
| 女性 | misaki@demo.projectgold.local | S ランク・自分で選ぶ |
| 女性 | yui@demo.projectgold.local | C ランク・幅広く受け付ける |
| 女性 | sakura@ / hinano@ / rena@ / akari@demo.projectgold.local | B / B / A / C |
| 運営 | admin@demo.projectgold.local | 管理画面 `/admin` |

デモデータを初期化: `npm run dev:api:reset`。パスワード再設定メールは開発サーバーのログと `http://localhost:54321/dev/mailbox` に出力されます。

## Supabase で動かす

1. Supabase CLI と Docker を用意し `supabase start`（ローカル）または Supabase にプロジェクトを作成
2. `supabase db reset`（ローカル。`supabase/migrations` と `supabase/seed.sql` が適用されます）／本番相当は `supabase link` → `supabase db push`（**seed.sql は本番に流さない**）
3. デモ画像: `SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-storage.mjs`
4. `.env.local` に `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` / `EXPO_PUBLIC_REALTIME=on` を設定（`.env.example` 参照）
5. Auth の Redirect URLs に `https://<公開ドメイン>/reset-password` と `projectgold://reset-password` を追加
6. 管理者の付与は SQL で行います（アプリからは付与不可）: `update public.profiles set role='admin' where id='<auth.users の id>'; delete from public.men_profiles where user_id='<同じ id>';`

## スクリプト

| コマンド | 内容 |
|---|---|
| `npm run typecheck` / `npm run lint` | TypeScript 型チェック / ESLint（React Compiler ルール含む） |
| `npm run test:api` | supabase-js で開発サーバーを操作する統合テスト（RLS 不正アクセス試験含む・9 件） |
| `npm run test:ui` | Playwright による UI 通しテスト＋ 320〜1280px の表示崩れ検査（dev:api と web を起動しておく） |
| `bash tests/race-pg.sh` | 実 PostgreSQL での同時承認レース試験（`PSQL` 環境変数で接続先を指定） |
| `npm run build:web` / `npm run build:native-bundle` | Web 静的書き出し / iOS・Android の JS バンドル書き出し |

テスト結果の記録: [docs/test-report.md](docs/test-report.md)

## 構成

```
project-gold/
├─ src/app/                 Expo Router の画面（ロール別ガード: Stack.Protected）
│  ├─ index, auth/*          ランディング・役割選択・登録・ログイン・パスワード再設定
│  ├─ m/*                    男性タブ（ホーム・さがす・予約・メッセージ・マイページ）
│  ├─ w/*                    女性タブ（ホーム・申込・日程・メッセージ・マイページ）
│  ├─ woman/[id], membership 女性詳細・会員プラン/ランク（男性のみ）
│  ├─ accept-settings, earnings, share, schedule-new   受付モード・報酬・紹介QR・空き枠（女性のみ）
│  ├─ booking/[id], chat/[id], notifications, verification, profile, settings, support, report, safety, delete-account
│  ├─ admin/*                運営管理画面（ダッシュボード・審査・ユーザー・予約/申立て・通報・返金・問い合わせ・設定・決済・監査ログ）
│  └─ legal/*                規約・プライバシー・料金・禁止事項（ドラフト）
├─ src/components            デザインシステム（ui.tsx, Icon.tsx, blocks.tsx, TabBar.tsx）
├─ src/theme/tokens.ts       白×ゴールドのデザイントークン
├─ src/lib                   Supabase クライアント・RPC 呼び出し・認証・署名URL・新着検知
├─ supabase/migrations       スキーマ・関数（RPC）・RLS・Storage/Realtime 設定
├─ supabase/seed.sql         デモデータ（開発環境専用）
├─ supabase/functions/payments-webhook   決済 Webhook の雛形（未有効化）
├─ dev-server/               Supabase 互換のローカル開発サーバー（Auth / RPC / 最小 REST / Storage）
├─ tests/                    API 統合テスト・UI 通しテスト・レース試験
└─ docs/                     法令・ストア審査チェックリスト、引き継ぎ、テスト結果、スクリーンショット
```

## 仕様の要点（実装済み）

- **ランク**: 女性 C/B/A/S はスコア（プロフィール充実・運営の非公開審査・確認済み店舗・アプリ内確定報酬・完了実績・違反減点）で算出し、計算根拠を `rank_snapshots` に保存。店舗売上・容姿の採点・公開投票は使用しない。
- **男性の申込可能ランク** = max（累計確定利用額のランク, 有効な月額プランの解放ランク）。本人確認・ブロック・女性の受付条件（受付停止・レベル条件・受付モード）が優先。招待リンク経由のお客様はランク条件を免除（女性本人の招待のため）。
- **受付モード**: 「自分で選ぶ」= プロフィール申請→女性が承認した人だけ予約申請可。「幅広く受け付ける」= 直接予約申請可。**どちらも女性が個別承認して初めて確定**（自動確定なし）。
- **予約状態**: `requested / accepted / declined / canceled / completed / disputed` をサーバーの遷移関数で厳密に管理し、履歴を `booking_events` に記録。ダブルブッキングは**アドバイザリロック＋排他制約（btree_gist）**で防止。
- **決済（サンドボックス）**: 承認時に与信、完了時に確定→報酬台帳（手数料控除）へ記録、キャンセルは取消、返金は運営承認で台帳に取消行を追加し利用額・ランクを再計算。`payment_mode=live` にしても事業者アダプター未設定のため確定・課金はサーバーが拒否。
- **安全**: 20歳以上の本人確認（開発版はテスト提出→運営承認）、禁止語のサーバー拒否、ブロック（検索・チャット・RLS でも遮断）、通報→審査→停止、異議申立て、退会（即時非公開→運営が匿名化）。
- **レベル・メーター・バッジ**: 本人確認・完了実績・トラブルなし・利用実績から算出。ガチャ・ルーレット・偽のカウントダウン・人気の水増し表示はなし。

公開前に本人が行う操作・費用・未解決点は [docs/handoff.md](docs/handoff.md) を参照してください。
