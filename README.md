# Harukaze / ハルカゼ

インターネット上の情報を収集して、集約して、提供するためのアプリケーション。

## 由来

『図書館の魔女』（高田大介）に登場する人物の名前。
彼女が作り上げた、勘所を押さえて必要な情報が集約されていくような諜報網にあやかって名付けた。

## プロジェクト概要

Harukaze は、SourceProvider から提供される情報を Plugin
を使ってフィルタリングおよび要約し、 Notifier でユーザーに通知する。

## 機能

- **情報の取得**: たとえば、 RSSフィードを取得します。
- **プラグインによる処理**:
  たとえば、言語モデルを使用して情報の内容をフィルタリングおよび要約します。
- **通知**: たとえば、要約された内容を指定された Slack チャンネルに送信します。

## アーキテクチャ

### 主なコンポーネント

- **SourceProvider**: フィードエントリを取得するための抽象インターフェース。
  - **MinifluxSourceProvider**: `SourceProvider` を実装し、Miniflux
    からエントリを取得するクラス。
- **Notifier**: 通知を送信するための抽象インターフェース。
  - **SlackNotifier**: `Notifier` を実装し、Slack に通知を送信するクラス。
- **Plugin**: フィードエントリを変換するためのプラグインの型。
  - 例: `SlackDataEntryTransformer` は、フィードエントリを Slack
    通知用に変換するプラグインです。

### データの流れ

1. **SourceProvider** がデータを取得し、`DataEntry`
   オブジェクトの配列として返します。
2. 取得した `DataEntry`
   オブジェクトは、必要に応じてプラグインによって変換されます。
3. 変換された `DataEntry` オブジェクトは、**Notifier** によって通知されます。

### 現在の実装クラス

- **MinifluxSourceProvider**: Miniflux API からデータを取得するクラス。
- **SlackNotifier**: Slack に通知を送信するクラス。`for_harukaze_notification`
  という文言が topic に含まれているチャンネルから通知先を選んで送信する。
- **DataEntry**: フィードエントリのデータ構造を定義するインターフェース。
- **Plugin**: フィードエントリを変換するためのプラグインの型。

## エラーハンドリング

エラーハンドリングは、各モジュールが successHandler と errorHandler を返し、
それらをトップレベルで呼び出すことで実装されています。

## セットアップ手順

```bash
npm install
cp .env.sample .env # and set environment variables
npm start
```

## ライセンス / License

このプロジェクトは MIT ライセンスの下でライセンスされています。

This project is licensed under the MIT License.
