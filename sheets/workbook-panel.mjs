import { mountFloatingPanel } from '../design/floating-panel.js';
import { mountSkillsCommandsReference } from '../design/skills-commands.js';
import catalog from './invocation-catalog.json' with { type: 'json' };

export function openWorkbookTools(trigger, root, returnFocus) {
  mountSkillsCommandsReference(root.querySelector('#invocation-catalog'), catalog.entries,
    'Agentic OS reference catalog. Commands run in their owning tools.');
  const panel = mountFloatingPanel(trigger, root, { label: 'Workbook tools', activeKey: 'functions', returnFocus });
  panel.open();
}
