# イケオジの深夜Bar 🥃

Next.js (App Router) + TypeScript + Tailwind CSS で作った、スマホ最適化の音声チャットアプリ。
Web Speech API でユーザーの愚痴を聞き取り、Gemini API がバーテンダー「イケオジ」として応答、
音声合成で渋く読み上げます。

## 特徴

- **音声入力**: `SpeechRecognition` (webkit フォールバック対応)
- **音声出力**: `SpeechSynthesis` で `pitch: 0.8 / rate: 0.9` のイケオジボイス
- **4段階のキャラ変化**: 往復回数 `drinkCount` に応じて API 側でシステムプロンプトを動的切替
  - 0〜2回: しらふ・親父ギャグ全開
  - 3〜4回: ほろ酔い・気遣いモード
  - 5〜7回: 本音が滲み始める（深い話）モード
  - 8回以上: 泥酔・全肯定モード
- **グラスモーフィズム**の字幕チャットエリアと、**親指で押しやすい大きなマイクボタン**

## 必要なもの

- Node.js 20 以上
- Google AI Studio で取得した `GEMINI_API_KEY`
- Chrome / Safari 最新版（Web Speech API 対応ブラウザ）

## セットアップ

```bash
npm install

cp .env.local.example .env.local
# .env.local を開いて GEMINI_API_KEY を貼り付け

npm run dev
```

`http://localhost:3000` をスマホ（または DevTools の device mode）で開いてください。

### マイクを使うためのヒント

- **PC の Chrome**: `http://localhost:3000` はそのまま使えます。
- **スマホから実機確認**: HTTPS が必要なので、`ngrok` などで HTTPS トンネルを作るか、
  Vercel にデプロイしてから実機で開くのが簡単です。

## ディレクトリ構成

```
app/
  api/chat/route.ts         # Gemini API 呼び出し + drinkCount / masterId 分岐
  _components/              # UI コンポーネント
    BgmToggle.tsx
    ClosingModal.tsx        # お会計モーダル
    DrinkRecoCard.tsx       # 今夜のおすすめ
    LogDrawer.tsx           # 今夜の記録
    MasterSelect.tsx        # マスター切替
    StageTransition.tsx     # 泥酔ステージ移行の幕間
    TypewriterText.tsx      # 字幕タイプライター
  _lib/
    audio.ts                # BGM/SFX（WebAudio 合成 + mp3 再生）
    constants.ts            # 定数・マスター・おすすめ・ナッジ
    haptic.ts               # バイブ
    storage.ts              # localStorage 永続化
  manifest.ts               # PWA マニフェスト
  icon.tsx / apple-icon.tsx # ImageResponse 生成のアプリアイコン
  layout.tsx
  page.tsx
  globals.css
public/
  master-jiji.png           # 背景のイケオジ（Jiji）写真
  sounds/bgm.mp3            # 任意：本物のジャズ BGM（置けば優先再生）
types/
  speech.d.ts               # Web Speech API の型定義
```

## 主な機能（深夜Bar パック）

- 🎷 **環境音 BGM**：ヘッダー右のスピーカーアイコンで ON/OFF。
  `public/sounds/bgm.mp3` を置けばそれを再生、無ければ WebAudio で合成したアンビエントドローンを流します。
- 🥃 **効果音 + ハプティック**：マイクオンで氷の音、送信でシェイカー、
  泥酔ステージ昇格でチャイム、お会計で木カウンターの音など。スマホだと振動もします。
- 🌬️ **背景の呼吸・ランプのゆらぎ**：イケオジ写真がゆっくり 14 秒周期で揺れ、暖色ランプが明滅します。
- 🎬 **ステージ移行の幕間**：泥酔度が 0→1→2→3 に上がる瞬間、画面全体に字幕が現れてキャラ切替を演出。
- 💬 **Typewriter 字幕**：マスターの返答が 1 文字ずつ現れ、末尾に金色のキャレットが点滅。
- 📖 **今夜の記録ドロワー**：右上の本アイコンから全会話を見返せます。
- 💾 **会話の永続化**：ブラウザを閉じても `localStorage` に保存され、次回開くとマスターが
  「おかえり。……昨夜の続き、やるかい？」と迎えてくれます。
- 🤐 **マスターの自発発話**：30 秒沈黙すると「……グラスが進まないな。何かあったのか？」と声をかけてくれる。
- 🥃 **今夜のおすすめ一杯**：泥酔度に応じてカクテル/ウィスキーをレコメンド。
- 🧑‍💼 **マスター選択**：現在はイケオジがデフォルト、女将とちょい悪先輩は準備中の枠を用意。
- 🧾 **お会計モーダル**：「……そろそろ、お会計を」からフィナーレ。泥酔度と会話数、マスターからの一言で夜を締めます。
- 📲 **PWA**：`manifest.webmanifest`、`icon`、`apple-icon` が自動生成され、ホーム画面に追加してアプリっぽく使えます。

## カスタマイズ

- **背景のイケオジ画像**：`public/master-jiji.png` を差し替えれば別のマスターにできます。
  状態（待機/傾聴/語りかけ）に応じて明度・彩度・拡大率が自動で切り替わります。

### 🎤 マスターの声を VOICEVOX に差し替える（おすすめ）

ブラウザ内蔵TTSは機械っぽく聞こえるので、無料の VOICEVOX を使うと
**一気に渋いイケおじ**になります。

1. [VOICEVOX 公式サイト](https://voicevox.hiroshiba.jp/) から Mac版を DL → 起動
2. エンジンが自動的に `http://localhost:50021` で立ち上がります
3. アプリ上で `http://localhost:3000/voices` を開く
4. 「VOICEVOX」タブに切り替え → 「⭐ イケおじBarおすすめ」から
   **青山龍星** や **剣崎雌雄** を選んで「⭐」ボタンで保存
5. Bar画面に戻るとマスターの声がその話者になります

VOICEVOX エンジンが止まると自動でブラウザ内蔵TTSにフォールバックするので、
アプリが壊れることはありません。

※ 合成音声は話者ごとにライセンスがあります。配信・商用利用時は各キャラクターの
利用規約を確認し、必要なクレジット表記（例：「VOICEVOX:青山龍星」）を行ってください。
- **本物のジャズ BGM**：`public/sounds/bgm.mp3` に mp3 を置くだけで合成ドローンより優先的に再生されます。
  著作権フリーのジャズループがおすすめ。
- **モデル変更**: `app/api/chat/route.ts` の `model: "gemini-flash-latest"` を好みで。
- **口調・マスター追加**: `app/_lib/constants.ts` の `MASTERS` に追加し、
  `app/api/chat/route.ts` の `masterIntro` にシステムプロンプトを足せば新キャラが増やせます。

## ライセンス

MIT
