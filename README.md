# エシュールのパン屋さん

『トリッカル・もちもちほっぺ大作戦』の **非公式ファンゲーム** です。公式とは関係ありません。原作に関する権利は各権利者に帰属します。

エシュールのベーカリーを手伝って、30 秒でどれだけ売上を稼げるかの接客ゲーム（「30びょう営業」1 本勝負・★3 段階評価）。

- お客さんの注文どおりにパンを渡す（早いほどチップ、続けるとコンボ）
- オーブンでパンを焼いて補充する（取り出し忘れると焦げる）
- **ほっぺを引っぱる**: お客さんを押したままずらすと、ほっぺが伸びる（[もちほっぺメーカー](https://github.com/saba383810/moti_hoppe_maker) の移植）。離すとごきげんが満タンに（1 人 1 回）。キャラはタイトルやリザルトの画面でも引っぱれる
- **エルフィン** がパンをつまみ食いしてツケにしていく → ほっぺを強く引っぱって離すと追い払える
- **ネル** の「記憶接客」: 注文は最初の 3 秒だけ。ぴったり渡せばツケを全額回収 + 10 秒間 売上 ×1.2
- **コミー** は居眠りしていて注文しない → ほっぺを引っぱると起きる
- **バター** は座っている間エルフィンをパチンコで追い払ってくれる（早く渡すと見張りも終わる）

設計の詳細は [docs/design.md](docs/design.md)。

## 操作

| 操作 | タッチ / マウス | キーボード |
|---|---|---|
| パンをトレーへ | ショーケースのパンをタップ | `1`〜`4` |
| トレーのパンを戻す | トレーのパンをタップ | `Backspace`（最後の 1 個） |
| お客さんに渡す | お客さんか吹き出しをタップ | `A` `S` `D` `F`（左の席から） |
| ほっぺを引っぱる | お客さんを押したままずらして離す | `Shift` + `A` `S` `D` `F` |
| オーブン | オーブンをタップ → パンを選ぶ / 焼けたらタップ | `Z` `X` → `1`〜`4` |
| エルフィンを追い払う | ほっぺをつまんで強く引っぱり、離す | `Space` 長押し → 離す |
| ポーズ | 右上のボタン | `Esc` / `P` |

タブを離れると自動でポーズします。

## 開発

```sh
npm ci
npm run dev      # http://localhost:5173/
npm test         # ロジックの単体テスト（vitest）
npm run sim      # ボットによるバランス確認（ラウンドの売上分布・★分布を腕前ごとに表示）
npm run build    # 型チェック + 本番ビルド（dist/）
```

- 開発用ページ: `/preview.html`（キャラ・表情・パンの一覧）、`/thumb.html`（掲載用サムネイル 800×515）。本番ビルドには含まれません。
- 開発サーバーではコンソールから `app` で状態を触れます（本番ビルドでは無効）。
- 絵はすべて Canvas 2D のコード描画（ほっぺの変形だけ WebGL2。使えない環境では変形なしで描画）、音はすべて WebAudio の合成です（素材ファイルなし）。

## sabanogames への組み込み

[sabanogames](https://github.com/saba383810/sabanogames) の「あそび場」に、もちほっぺメーカーと同じ submodule 方式で載せる想定です。

1. このディレクトリを GitHub リポジトリ（例: `saba383810/eshur_bakery`）として公開する
2. sabanogames 側で submodule を追加する

   ```sh
   git submodule add https://github.com/saba383810/eshur_bakery.git entertainments/eshur_bakery
   ```

   CI が `npm ci && npm run build -- --base=/entertainments/eshur_bakery/app/` を実行し、`/entertainments/eshur_bakery/app/` に公開されます。
3. `site/src/data/entertainments.ts` にエントリを追加する

   ```ts
   {
     slug: 'eshur_bakery',
     title: 'エシュールのパン屋さん',
     description: 'トリッカルの非公式ファンゲーム。パンを渡して、エルフィンのほっぺを引っぱって、ネルの注文を覚えよう。',
     repo: 'https://github.com/saba383810/eshur_bakery',
     image: '/images/entertainments/eshur_bakery.png',
   },
   ```

4. `docs/thumbnail.png` を `site/public/images/entertainments/eshur_bakery.png` としてコピーする

## 権利・素材について

[公式の二次創作ガイドライン](https://trickcal.biligames.com/news/jp/?news_detail_id=181782100307091368) に沿って、公式のイラスト・ゲーム内素材・ロゴ・ボイス・BGM は一切使っていません（直接使用・模写・改変が禁止のため）。キャラクターはトリッカルの SD の雰囲気に寄せてコードで描いたオリジナルのデフォルメ絵（トレース・模写なし）、BGM・効果音はオリジナルです。お客さんは原作キャラではないオリジナルの「妖精村の人たち」です。
