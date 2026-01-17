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

### Table
- **Setup**:
  - ツールボックスから「Table」を配置し、**ID** を設定します。
  - **Columns**: カラム名をカンマ区切りで入力（例: `名前, 年齢, メール`）
  - **Rows per page**: 1ページに表示する行数
- **JavaScript API** (`yoTable`): 下記参照

## 3. JavaScript Helpers

### 共通関数
- `openModal(id)`: IDを指定してモーダルを表示
- `closeModal(id)`: IDを指定してモーダルを非表示
- `closeModal(this)`: 内包する親モーダルを自動判別して閉じる

### yoTable API（テーブル操作）

#### データ設定
```javascript
// データを一括登録
yoTable.setData('myTable', [
    { Name: 'John', Age: 30, Email: 'john@example.com' },
    { Name: 'Jane', Age: 25, Email: 'jane@example.com' }
]);

// カラムヘッダーを変更
yoTable.setColumns('myTable', ['名前', '年齢', 'メール']);
```

#### ページネーション
```javascript
yoTable.nextPage('myTable');      // 次のページ
yoTable.prevPage('myTable');      // 前のページ
yoTable.goToPage('myTable', 3);   // 3ページ目に移動
yoTable.refresh('myTable');       // テーブルを再描画
```

#### アクションボタン（編集・削除等）
```javascript
// アクションカラムを追加
yoTable.setActionColumn('myTable', '操作', [
    { label: '編集', style: 'info', action: 'edit' },
    { label: '削除', style: 'danger', action: 'delete' }
]);

// ボタンクリック時の処理
yoTable.onRowAction('myTable', (action, rowData, index) => {
    if (action === 'edit') {
        console.log('編集:', rowData);
    } else if (action === 'delete') {
        // 削除処理
    }
});
```

#### データ取得
```javascript
const row = yoTable.getRowData('myTable', 0);  // 特定行
const all = yoTable.getData('myTable');        // 全データ
```
