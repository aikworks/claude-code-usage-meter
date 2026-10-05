# usage-meter

Claude Code の入力欄の上に、**週間使用量**と**5時間使用量**を常に表示するMod（プラグイン）です。

```
週間  ██████████░░░░░░░░░░░░░░  41%  リセットまで 3日5時間   文脈 34%
5時間 ████████████░░  83%  リセットまで 2時間10分
```

- 週間を1行目・太字・長いバーで強調。色は 70%未満=緑／70%以上=黄／90%以上=赤。
- 週間の行の右端に、会話の長さ（文脈）の使用率も小さく表示。
- 応答のたびと1分ごとに更新。新しいセッションを開くたびに自動で表示されます。

## インストール（かんたん）

Claude Code（デスクトップの Code タブ）に、次の文を貼ってください。

> `aikworks/claude-code-usage-meter` を Claude Code のマーケットプレイスに追加して、`usage-meter` をユーザー用プラグインとしてインストールして。終わったら、新しいセッションを開けば表示される、と教えて。

（Claude が許可を求めてきたら、内容を確認して許可してください。）

## インストール（コマンド）

ターミナルで次の2行を実行します。

```bash
claude plugin marketplace add aikworks/claude-code-usage-meter
claude plugin install usage-meter@usage-meter-market --scope user
```

そのあと**新しいセッションを開く**と表示されます（すでに開いているセッションには出ません）。

## 必要なもの・注意

- Claude Code のデスクトップ版（Code タブ）またはターミナル版。公式資料は Mod に **v2.1.287 以降**を求めています。
- **Claude の契約プラン**（Pro/Max など）。API キー利用では週間・5時間の数字は出ません。最初の応答が返るまでは「取得待ち」と表示されます。
- WSL セッションでは Mod が使えません。
- Mod は「あなたの権限で動くプログラム」です。このMod は使用量を**読んで画面に描くだけ**で、ファイル・通信・外部プロセスには触れません（`claude plugin validate` で確認できます）。ソースは `usage-meter/hooks/usage-meter.mjs` の1ファイルです。

## 外し方

```bash
claude plugin uninstall usage-meter@usage-meter-market
```

## ライセンス・免責

MIT ライセンスで、無保証で提供します（LICENSE を参照）。公式の Claude Code Mod の仕組み（Anthropic の公開サンプルと同じ形式）で作っていますが、Anthropic 公式製品ではありません。