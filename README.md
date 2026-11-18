# Agentic Sheets

Agentic Sheets is an offline-first local workbook with a headless ECMAScript module and a browser editor. It accepts text, finite numbers, booleans and same-sheet formulas in one 32 × 16 worksheet. Formulas support arithmetic, unary signs, parentheses, cell references and rectangular SUM ranges. Errors and capacity limits are explicit.

## Run locally

Use Node 22.22 or later. The core, browser app, builder and tests use platform APIs. Run `npm test` to check the source and sealed artifact, `npm run build:sheets` to regenerate the static files, and `npm run dev` to open the editor at http://127.0.0.1:4177/agentic-sheets/. The optional pinned development dependency supplies the repository's Git workflow. A first online visit to the local server primes the scoped service worker for offline reload.

With the dev server running and Playwright available, run `node test-browser/formula-editor.mjs` to exercise formula inspection in fresh desktop, touch and forced-colors browser contexts. Set `PLAYWRIGHT_MODULE` to the entry point of an existing Playwright installation if needed.

## Headless use

Import `agentic-sheets` from this package or from a consumer with a pinned checkout installed. The public core runs independently of the DOM, renderer, network and browser storage. Its caller owns the accepted snapshot. For durable browser writes use `createSheetsStore` from `agentic-sheets/storage`.

```js
import { CONTRACT, executeWorkbook, calculate } from 'agentic-sheets';

const { workbook } = await executeWorkbook(null, {
  contract: CONTRACT,
  operation: 'create',
  operationId: 'first-edit',
  expectedRevision: 0,
  payload: {
    workbookId: 'schedule',
    sheetId: 'sessions',
    name: 'Session lengths',
    cells: {
      A1: { type: 'number', value: 12 },
      A2: { type: 'number', value: 18 },
      B1: { type: 'formula', value: '=SUM(A1:A2)' }
    }
  }
});
console.log(calculate(workbook).B1.value); // 30
```

Use `setCells` with the accepted revision for edits. Download an accepted snapshot before replacing a workbook or moving it to another origin. Restore validates the file and advances the live revision. An explicit clone assigns fresh workbook and sheet IDs. Browser storage can be evicted. Source rollback preserves user data.

## Source and delivery

The Sheets v1 engine, browser adapter and compatibility tests originate at `huijoohwee/agentic-base@5b28d4b46505de115dcef1eaa60937a0db4eb5f4` under the retained MIT license. The dashboard, headings, forms, selection state and toolbar use the upstream styles at the immutable Design System revision in `design/shared-ui-profile.pin.json`. The builder verifies both CSS projections and packages them for offline use. Retain the included MIT notice.

Use named native regions, buttons, inputs and grid cells as interaction and annotation targets. A worksheet address has a stable DOM ID such as `cell-B2` across edits and recalculation. The owner styles set control height, focus and touch geometry. Workbook CSS owns table geometry and spacing around the controls. Run `npm test` to check these boundaries. The active cell keeps the shared inset border while focus moves to the formula input. Use **Mark worksheet** in Workbook actions to toggle the outer annotation outline independently. The mark is local to the current view and does not change the workbook revision or snapshot. The loopback editor allows an annotation tool’s shadow-root stylesheet. The production route uses the site controller’s enforced policy.

While editing a formula, the References list names its cells and rectangular ranges in expression order. Match each label to the grid by its color and line pattern. Repeated references share a label. Where ranges overlap, the first reference supplies the cell outline. Place the caret inside `SUM(` for range help. Escape cancels the draft. Headless clients can use `inspectFormulaDraft(source, caret)` for the same address groups and function context.

The build seals `sheets/dist/` and its input and output digest inventory. The site release owner in `huijoohwee/agentic-graph` verifies exact Git blobs, owns the intended `airvio.co/agentic-sheets/` route and publishes the generated mirror only after its authorized release checks. A local build or source merge provides no production receipt. Cash-flow functions are an optional example in the product specification.
