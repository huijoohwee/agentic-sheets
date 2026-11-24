# Agentic Sheets

Agentic Sheets is an offline-first local workbook with a headless ECMAScript module and a browser editor. It accepts text, finite numbers, booleans and same-sheet formulas in one adaptively sized worksheet. Formulas support arithmetic, unary signs, parentheses, cell references and rectangular SUM ranges. Errors and capacity limits are explicit.

## Run locally

Use Node 22.22 or later. The core, browser app, builder and tests use platform APIs. Run `npm test` to check the source and sealed artifact, `npm run build:sheets` to regenerate the static files, and `npm run dev` to open the editor at http://127.0.0.1:4177/agentic-sheets/. The optional pinned development dependency supplies the repository's Git workflow. A first online visit to the local server primes the scoped service worker for offline reload.

With the dev server running and Playwright available, run `node test-browser/formula-editor.mjs` to exercise formula inspection in fresh desktop, touch and forced-colors browser contexts. Run `node test-browser/function-discovery.mjs <candidate-url> [predecessor-url]` to check offline help, keyboard and touch editing, and optionally reopen a saved workbook across both releases. Set `PLAYWRIGHT_MODULE` to an existing Playwright installation if needed. To compare the headless fixtures with an earlier checkout, set `SHEETS_PREDECESSOR_CORE` to its absolute `sheets/core.mjs` path and run `node --test test/functions.test.mjs`.

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

The browser and headless callers using `fitToCells: true` start with the occupied rectangle, or A1 for an empty sheet. Existing creation commands start at 32 × 16. Writing beyond the last row or column grows either shape. Clearing cells preserves the dimensions. Saved 32 × 16 snapshots reopen at their original size. The local editor supports up to 512 populated cells and 4,096 grid positions, with at most 512 rows or 128 columns. Formula references are evaluated within the accepted worksheet dimensions.

Use `setCells` with the accepted revision for edits. Download an accepted snapshot before replacing a workbook or moving it to another origin. Restore validates the file and advances the live revision. An explicit clone assigns fresh workbook and sheet IDs. Browser storage can be evicted. Source rollback preserves user data.

### Discover installed functions

Import `listFunctions` from `agentic-sheets` and call `listFunctions()` without a workbook. Each immutable entry describes its stable ID, versioned workbook binding, signature, arguments and runnable example. The current binding is `math.sum`. The example totals A1 = 2 and A2 = 3 with `=SUM(A1:A2)` and returns 5.

Open **Functions** beside the formula field to read the installed definitions in the workbook FloatingPanel’s **Functions** tab. Tab from the formula field and press Enter, or tap Functions from either editor. Choose **Close** or press Escape in the panel to restore the draft and its text selection. The same panel works after an offline reload.

## Source and delivery

The Sheets v1 engine, browser adapter and compatibility tests originate at `huijoohwee/agentic-base@5b28d4b46505de115dcef1eaa60937a0db4eb5f4` under the retained MIT license. The dashboard, headings, forms, selection state and toolbar use the upstream styles at the immutable Design System revision in `design/shared-ui-profile.pin.json`. The builder verifies the pinned styles, native FloatingPanel, control runtime and icon registry and includes their notices in the offline artifact. Sheets supplies the tab content and editor focus callback.

Use named native regions, buttons, inputs and grid cells as interaction and annotation targets. A worksheet address has a stable DOM ID such as `cell-B2` across edits and recalculation. The owner styles set control height, focus and touch geometry. Workbook CSS owns table geometry and spacing around the controls. Run `npm test` to check these boundaries. The active cell keeps the shared inset border while focus moves to the formula input. Use **Mark worksheet** in Workbook actions to toggle the outer annotation outline independently. The mark is local to the current view and does not change the workbook revision or snapshot. The loopback editor allows an annotation tool’s shadow-root stylesheet. The production route uses the site controller’s enforced policy.

Double-click a cell, tap a selected cell, or press F2 or Enter to edit its source directly in the grid. Typing on a focused cell starts a replacement. The in-cell input and the formula field share one unsaved draft. Enter commits and Escape cancels. Switching fields keeps the draft. A rejected commit leaves it open for correction. The builder verifies the native inline editor from the pinned Design System revision and includes its exact bytes in the offline browser entry.

While editing a formula, the References list names its cells and rectangular ranges in expression order. Match each label to the grid by its color and line pattern. Repeated references share a label. Where ranges overlap, the first reference supplies the cell outline. Place the caret inside `SUM(` for range help. Escape cancels the draft. Headless clients can use `inspectFormulaDraft(source, caret)` for the same address groups and function context.

The build seals `sheets/dist/` and its input and output digest inventory. The site release owner in `huijoohwee/agentic-graph` verifies exact Git blobs, owns the intended `airvio.co/agentic-sheets/` route and publishes the generated mirror only after its authorized release checks. A local build or source merge provides no production receipt. Cash-flow functions are an optional example in the product specification.

The workbook panel includes Functions and Skills & Commands. The latter browses the offline Agentic OS invocation catalog by prefix, text and grammar facet. Its source revision and digest are recorded in `sheets/invocation-catalog.json`. Workbook functions and the formula editor use the installed workbook engine.

Choose **Browse populated cells** to see accepted workbook values in a table, a transposed table or a Kanban grouped by cell type. Selecting a record focuses its cell in the editor. Each page covers up to 24 cells in worksheet order. The workbook uses the pinned Agentic Base renderers and Design System toolbar. The service worker verifies the packed views during installation so their first use works after disconnection.

Use `extractFormulaReferences(formula, bounds)` from `agentic-sheets` to inspect an accepted formula. Each occurrence includes its original text, zero-based start and exclusive end offsets, and the addresses it reads. Absolute and mixed references retain their spelling and resolve to the same cell IDs as relative references. Use `calculateWithReferences(workbook)` for unique direct links, including empty cells in ranges.
