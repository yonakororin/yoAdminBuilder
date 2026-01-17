# yoAdminBuilder User Guide

## 1. Builder UI
- **Header Overlay**: コンポーネントの移動/編集/削除アイコンは、マウスオーバー時のみ表示されます。これにより実際の表示と同じ配置で編集できます。
- **File Browser**: 「Browse」ボタンからサーバー内の設定ファイル (`.json`) を直接ロードできます。

## 2. Components

### Checklist
- **Mode**:
  - `Multi`: 複数の項目を選択可能（チェックボックス）
  - `Single`: 1つの項目のみ選択可能（ラジオボタン）
- **Items**: 改行区切りでリスト項目を入力します。

### Button
- **Styles**:
  - `Normal` (Blue), `Info` (Cyan), `Danger` (Red), `Warning` (Orange), `Disabled` (Gray)
- **OnClick**:
  - ボタンクリック時に実行するJavaScriptを記述できます。
  - 例: `alert('Hello')`
  - 例: `openModal('myModal')`

### Modal
- **Setup**:
  - ツールボックスから「Modal」を配置し、**ID** (例: `myModal`) を設定します。
  - **Footer Buttons**: フッターにボタンを追加できます（`Label | Style | OnClick` 形式）。
- **Display**:
  - デフォルトでは非表示です。ボタンのOnClick等で `openModal('myModal')` を呼び出して表示します。
- **Close**:
  - 右上の「×」ボタン、または `closeModal('myModal')` で閉じます。

### Loading
- **Setup**:
  - 「Loading」を配置し、**ID** (例: `loadingOverlay`) を設定します。
  - テキスト（"Processing..." 等）を編集可能です。
- **Control**:
  - `document.getElementById('loadingOverlay').style.display = 'flex'` で表示。
  - `style.display = 'none'` で非表示。

## 3. JavaScript Helpers
便利なグローバル関数を利用できます。

- `openModal(id)`: IDを指定してモーダルを表示
- `closeModal(id)`: IDを指定してモーダルを非表示
- `closeModal(this)`: 内包する親モーダルを自動判別して閉じる（フッターボタン等で使用）
