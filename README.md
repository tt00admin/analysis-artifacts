# DataDeck for VS Code

[![Version](https://img.shields.io/badge/version-1.0.2-blue.svg)](https://github.com/datadeck/datadeck)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code-Marketplace-blue.svg)](https://marketplace.visualstudio.com/items?itemName=tt00.datadeck)

データサイエンティストの試行錯誤過程を支援するクリップボード型成果物管理システム

## 主な機能

- **クリップ保存**: ノートブックの出力をワンクリックで保存
- **クリップ管理**: 保存したクリップの一覧表示・検索・フィルタリング
- **ピン留め**: 重要なクリップをピン留めして優先表示
- **ドラッグ＆ドロップ**: クリップの順序を直感的に並び替え
- **検索・フィルタ**: テキスト検索、タイプ別フィルタ、タグ検索、日付範囲指定
- **ソースジャンプ**: クリップから元のノートブックセルへ瞬時に移動
- **Markdownエクスポート**: 保存したクリップをMarkdown形式でエクスポート

## 概要

DataDeckは、VS Code上でデータ分析の過程で生成される出力（グラフ、データフレーム、HTMLなど）を「クリップ」として保存・管理する拡張機能です。Jupyterノートブックとの連携により、分析の試行錯誤を効率的に記録・参照できます。

## インストール

1. VS Codeの拡張機能マーケットプレイスから「DataDeck for VS Code」をインストール
2. または、`.vsix`ファイルからインストール：
   ```
   code --install-extension datadeck-1.0.2.vsix
   ```

## 使用方法

### クリップの保存
1. ノートブックエディタでクリップしたいセルを選択
2. コマンドパレット（`Ctrl+Shift+P` または `Cmd+Shift+P`）を開き、「Clip Active Cell Output」を実行
   - ショートカットキー：`Ctrl+Shift+D`（Windows/Linux）または `Cmd+Shift+D`（macOS）

### クリップの閲覧
1. アクティビティバーからDataDeckアイコンをクリック
2. サイドバーで保存されたクリップを閲覧
3. 検索バーでクリップを検索・フィルタリング

### クリップの管理
- **ピン留め**: クリップをピン留めして固定表示
- **削除**: 不要なクリップを削除
- **並び替え**: ドラッグ＆ドロップで順序を変更
- **ソースへジャンプ**: クリップをクリックして元のセルに移動

### Markdownエクスポート
コマンドパレットから「Export to Markdown」を実行

## 対応ノートブック

- **VS Code Native Notebook**: Jupyterノートブック（.ipynb）

## データの保存場所

クリップデータはワークスペースの `.vscode/datadeck/` ディレクトリに保存されます：
- `clips.json`: クリップのメタデータ
- `images/`: 画像ファイル

## 設定

クリップの最大保存数や画像品質などは `clips.json` の `settings` で設定可能です。

## 開発

### 必要条件
- Node.js 16以上
- npm
- VS Code

### セットアップ
```bash
git clone https://github.com/tt00admin/datadeck.git
cd datadeck
npm install
cd webview && npm install
```

### ビルド
```bash
npm run compile    # TypeScriptのコンパイル
npm run watch      # ウォッチモード
cd webview && npm run build  # Webviewのビルド
```

### テスト
```bash
npm test
```

### デバッグ
1. VS Codeでプロジェクトを開く
2. `F5` キーで拡張機能開発ホストを起動
3. 新しいウィンドウでDataDeckをテスト

## ライセンス

MIT License

## 貢献

Issue報告やプルリクエストを歓迎します。

## 詳細な使用例

### 例1: データ分析の試行錯誤を記録する
1. Jupyter Notebookでデータ分析を行う
2. 重要なグラフが出力されたら、セルを選択して `Ctrl+Shift+D` でクリップ
3. クリップにタイトルやメモを入力して保存
4. 後でサイドバーからクリップを参照し、分析の過程を振り返る

### 例2: 複数のグラフを比較する
1. 複数のクリップをピン留めする
2. サイドバーで並び替え（ドラッグ＆ドロップ）
3. 比較したいグラフを順に配置

## トラブルシューティング

### クリップが保存できない
- Notebookがアクティブになっているか確認してください
- セルが選択されているか確認してください
- VS Codeのバージョンが1.80.0以上であるか確認してください

### 画像が表示されない
- `.vscode/datadeck/images/` ディレクトリが存在するか確認
- 画像ファイルが削除されていないか確認

## FAQ

**Q: クリップの保存場所はどこですか？**
A: ワークスペースの `.vscode/datadeck/` ディレクトリです。

**Q: クリップを削除するには？**
A: クリップカードの削除ボタンをクリックするか、右クリックメニューから削除を選択してください。

## 更新履歴

### v1.0.0 (2026-04-29)
- 初回リリース
- クリップ保存・管理機能
- 検索・フィルタリング
- ドラッグ＆ドロップ並び替え
- ソースジャンプ
- Markdownエクスポート
