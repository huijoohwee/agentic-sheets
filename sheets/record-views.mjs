import { columnLabel, coordinate } from './schema.mjs';

const columns = [
  { id: 'address', name: 'Cell' }, { id: 'column', name: 'Column', kind: 'select' },
  { id: 'kind', name: 'Cell type', kind: 'select' }, { id: 'value', name: 'Calculated value' },
];
const pageSize = 24;
export function projectCells(cells, results) {
  return Object.keys(cells).map(address => ({ address, ...coordinate(address) }))
    .sort((a, b) => a.row - b.row || a.column - b.column)
    .map(({ address, column }) => {
      const result = results[address], value = String(result?.error ? result.display : result?.value ?? '');
      return { id: address, cells: [address, columnLabel(column), cells[address].type, value.replaceAll('\u0000', '␀')] };
    });
}

export async function mountCellRecords(host, activate) {
  const { mountDataView, mountRecordViewToolbar } = await import('./browser-data-view.js');
  const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  const css = document.createElement('link');
  css.rel = 'stylesheet'; css.href = new URL('./browser-data-view.css', import.meta.url).href;
  const controls = document.createElement('div'), content = document.createElement('div');
  const ready = new Promise((resolve, reject) => {
    css.onload = resolve; css.onerror = () => reject(new Error('Workbook record styles could not load.'));
  });
  root.replaceChildren(css, controls, content);
  await ready;
  let layout = 'table', orientation = 'rows', offset = 0, rows = [], table, toolbar;
  const theme = matchMedia('(prefers-color-scheme: dark)');
  function applyTheme() {
    if (theme.matches) host.dataset.darkVariant = 'black'; else delete host.dataset.darkVariant;
  }
  applyTheme(); theme.addEventListener('change', applyTheme);
  function render() {
    const page = rows.slice(offset, offset + pageSize);
    const tools = { label: 'Worksheet record views', layout,
      status: page.length ? (offset + 1) + '–' + (offset + page.length) + ' of ' + rows.length + ' cells' : 'No populated cells',
      actions: [{ id: 'previous', label: 'Previous cells', disabled: !offset, invoke() { offset -= pageSize; render(); } },
        { id: 'next', label: 'Next cells', disabled: offset + page.length >= rows.length, invoke() { offset += pageSize; render(); } }],
      onLayoutChange(value) { layout = value; render(); } };
    if (toolbar) toolbar.update(tools); else toolbar = mountRecordViewToolbar(controls, tools);
    if (!page.length) { table?.destroy(); table = undefined; return; }
    const view = { columns, rows: page, layout, ariaLabel: 'Populated worksheet cells', onActivateRow: activate,
      ...(layout === 'kanban' ? { groupByColumnId: 'kind' } : {}),
      ...(layout === 'multiDimensional' ? { orientation, onOrientationChange(value) { orientation = value; render(); } } : {}) };
    if (table) table.update(view); else table = mountDataView(content, view);
  }
  return { update(cells, results) {
    rows = projectCells(cells, results); offset = Math.min(offset, Math.max(0, Math.floor((rows.length - 1) / pageSize) * pageSize)); render();
  } };
}
