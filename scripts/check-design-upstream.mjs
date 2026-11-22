// Workspace-level upstream verification: local vendored Design System assets must equal the
// authentic owner Git bytes at each asset's pinned revision (not merely consumer-maintained hashes).
// Requires a sibling Design System checkout; the standalone Sheets build/CI is unchanged.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ownerId = 'github.com/huijoohwee/agentic-design-system';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const need = (condition, label) => { if (!condition) throw new Error(label); };

// Local vendored file names differ from owner source basenames where the build renames them.
const localNames = {
  toolbar: 'toolbar.css', inlineEditor: 'inline-editor.mjs', floatingPanel: 'floating-panel.js',
  floatingPanelStyles: 'floating-panel.css', panelControls: 'toolbar-icons.js', icons: 'icons.json',
  notices: 'THIRD-PARTY-NOTICES.txt', skillsCommands: 'skills-commands.js', skillsCommandsStyles: 'skills-commands.css',
  collectionLayoutStyles: 'collection-layout.css', panelSection: 'panel-section.js', panelSectionStyles: 'panel-section.css',
  collectionLayout: 'collection-layout.js', panelStyles: 'panels.css',
};

// Pure verifier: localAsset(name) -> Buffer of the vendored file; ownerBlob(path, revision) -> Buffer.
export function verifyUpstreamAssets({ pin, localAsset, ownerBlob }) {
  need(pin?.profile?.owner === ownerId, 'Sheets Design System pin owner mismatch');
  const profile = pin.profile;
  const source = ownerBlob(profile.sourcePath, profile.sourceRevision);
  need(`sha256:${sha(source)}` === profile.sourceSha256, 'shared-ui source differs from pinned owner bytes');
  const projection = ownerBlob(profile.projectionPath, profile.registryRevision);
  need(`sha256:${sha(projection)}` === profile.projectionSha256, 'shared-ui projection differs from pinned owner bytes');
  need(localAsset('shared-ui-profile.css').equals(projection), 'vendored shared-ui profile differs from owner bytes');
  const verified = ['shared-ui-profile.css'];
  for (const [key, asset] of Object.entries(pin)) {
    if (key === 'profile' || !asset?.sourcePath) continue;
    const localName = localNames[key];
    need(localName, `unknown Design System asset key: ${key}`);
    const revision = asset.registryRevision ?? profile.registryRevision;
    const ownerBytes = ownerBlob(asset.sourcePath, revision);
    need(`sha256:${sha(ownerBytes)}` === asset.sha256, `Design System asset pin drift: ${key}`);
    need(localAsset(localName).equals(ownerBytes), `vendored Design System asset differs from owner bytes: ${key}`);
    verified.push(localName);
  }
  return verified;
}

function ownerRoot(sheetsRoot) {
  const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: sheetsRoot, encoding: 'utf8' }).trim();
  return join(dirname(common), 'agentic-design-system');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const sheetsRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const workspace = process.argv[2];
  const owner = workspace ? resolve(workspace, 'agentic-design-system') : ownerRoot(sheetsRoot);
  const pin = JSON.parse(readFileSync(join(sheetsRoot, 'design/shared-ui-profile.pin.json'), 'utf8'));
  const localAsset = name => readFileSync(join(sheetsRoot, 'design', name));
  const ownerBlob = (path, revision) => execFileSync('git', ['-C', owner, 'show', `${revision}:${path}`], { maxBuffer: 500000 });
  const verified = verifyUpstreamAssets({ pin, localAsset, ownerBlob });
  console.log(`PASS sheets-design-upstream · ${verified.length} vendored assets equal authentic owner bytes at their pinned revisions.`);
}