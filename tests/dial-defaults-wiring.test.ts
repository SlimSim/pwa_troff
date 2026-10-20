import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * FEATURE SPEC: dial reset targets must come from Settings → "Default Song Values"
 * (nDB) instead of hardcoded `defaultValue="..."` attributes on the SONG dials.
 *
 * The runtime wiring across v2Script.ts / t-settings-panel.ts is too heavy to
 * execute in a unit test, so this suite verifies the source wiring directly —
 * the established pattern from tests/volume-boost.test.ts. It reads the real
 * sources (no re-implementation) and is RED while:
 *  - syncCurrentSongControlsValues() does not assign currentSongControls.default*Value,
 *  - the settings-panel-embedded copy does not receive settingsControls.default*Value,
 *  - the "Save global default song values to nDB" branch does not refresh the
 *    controls/footer after nDB.set,
 *  - t-settings-panel does not forward .default*Value to the embedded controls,
 *  - t-footer / t-current-song-controls still carry hardcoded defaultValue attributes.
 *
 * t-settings-panel's OWN "Default Song Values" dials are deliberately EXCLUDED
 * from the feature — a positive assertion locks that in.
 */

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function readSource(relPath: string): string {
  return readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function sliceBetween(
  src: string,
  startMarker: string,
  endMarker: string,
  context: string
): string {
  const start = src.indexOf(startMarker);
  expect(start, `${context}: expected to find "${startMarker}"`).toBeGreaterThan(-1);
  const end = src.indexOf(endMarker, start + startMarker.length);
  expect(end, `${context}: expected to find "${endMarker}" after "${startMarker}"`).toBeGreaterThan(
    -1
  );
  return src.slice(start, end);
}

/** The full <t-dial>...</t-dial> block that carries the given label attribute. */
function getDialBlock(src: string, label: string, context: string): string {
  const labelIndex = src.indexOf(`label="${label}"`);
  expect(labelIndex, `${context}: expected to find label="${label}"`).toBeGreaterThan(-1);
  const start = src.lastIndexOf('<t-dial', labelIndex);
  expect(start, `${context}: expected a <t-dial opening before label="${label}"`).toBeGreaterThan(
    -1
  );
  const end = src.indexOf('</t-dial>', labelIndex);
  expect(end, `${context}: expected a </t-dial> closing after label="${label}"`).toBeGreaterThan(
    -1
  );
  return src.slice(start, end + '</t-dial>'.length);
}

const DEFAULT_VALUE_PROPERTIES = [
  'defaultStartBeforeValue',
  'defaultStopAfterValue',
  'defaultPauseBeforeValue',
  'defaultWaitBetweenValue',
  'defaultIncrementUntilValue',
  'defaultVolumeValue',
  'defaultSpeedValue',
] as const;

describe('v2Script.ts syncCurrentSongControlsValues pushes Default Song Values onto the controls', () => {
  const v2Script = readSource('v2Script.ts');

  it('the function exists and is sliceable', () => {
    const body = sliceBetween(
      v2Script,
      'const syncCurrentSongControlsValues = () => {',
      'const applyStoredVolumeAndSpeedToMedia',
      'syncCurrentSongControlsValues'
    );
    expect(body).toContain('#settingsCurrentSongControls');
  });

  it('assigns all 7 default*Value properties onto currentSongControls', () => {
    const body = sliceBetween(
      v2Script,
      'const syncCurrentSongControlsValues = () => {',
      'const applyStoredVolumeAndSpeedToMedia',
      'syncCurrentSongControlsValues'
    );
    for (const property of DEFAULT_VALUE_PROPERTIES) {
      expect(
        body,
        `syncCurrentSongControlsValues must assign currentSongControls.${property} (from nDB with fallback)`
      ).toContain(`currentSongControls.${property} =`);
    }
  });

  it('copies all 7 default*Value properties onto the settings-panel-embedded instance', () => {
    const body = sliceBetween(
      v2Script,
      'const syncCurrentSongControlsValues = () => {',
      'const applyStoredVolumeAndSpeedToMedia',
      'syncCurrentSongControlsValues'
    );
    const settingsControlsStart = body.indexOf('#settingsCurrentSongControls');
    expect(settingsControlsStart, 'sync must reach #settingsCurrentSongControls').toBeGreaterThan(-1);
    const settingsControlsBlock = body.slice(settingsControlsStart);

    for (const property of DEFAULT_VALUE_PROPERTIES) {
      expect(
        settingsControlsBlock,
        `sync must assign settingsControls.${property} (the #settingsCurrentSongControls instance)`
      ).toContain(`settingsControls.${property} =`);
    }
  });
});

describe('v2Script.ts setting-changed branch refreshes reset targets after saving to nDB', () => {
  const v2Script = readSource('v2Script.ts');

  it('"Save global default song values" branch calls syncCurrentSongControlsValues() + updateFooterWithCurrentSong() after nDB.set', () => {
    const branch = sliceBetween(
      v2Script,
      'const numericKey = defaultNumericKeyBySetting',
      'return;',
      'default-value branch'
    );

    // Sanity: we sliced the branch that persists the configured default.
    expect(branch, 'the branch must persist via nDB.set(numericKey, value)').toContain(
      'nDB.set(numericKey'
    );
    // The reset targets must be refreshed live when the user edits them.
    expect(
      branch,
      'after nDB.set the branch must call syncCurrentSongControlsValues() so the dials get the new reset target'
    ).toContain('syncCurrentSongControlsValues()');
    expect(
      branch,
      'after nDB.set the branch must call updateFooterWithCurrentSong() so the footer dials get the new reset target'
    ).toContain('updateFooterWithCurrentSong()');
  });
});

describe('t-settings-panel.ts forwards default*Value to the embedded controls', () => {
  const settingsPanel = readSource('components/molecule/t-settings-panel.ts');

  it('the embedded <t-current-song-controls id="settingsCurrentSongControls"> binds all 7 .default*Value properties', () => {
    const embedded = sliceBetween(
      settingsPanel,
      '<t-current-song-controls',
      '</t-current-song-controls>',
      'embedded t-current-song-controls'
    );
    expect(embedded, 'embedded element must keep its id').toContain('id="settingsCurrentSongControls"');

    for (const property of DEFAULT_VALUE_PROPERTIES) {
      expect(
        embedded,
        `embedded controls must bind .${property}=\${this.${property}}`
      ).toContain(`.${property}=\${this.${property}}`);
    }
  });
});

describe('t-footer.ts song dials bind reset targets to default*Value properties', () => {
  const footerSource = readSource('components/molecule/t-footer.ts');

  const dialCases = [
    { label: 'Volume', property: 'defaultVolumeValue', hardcoded: 'defaultValue="75"' },
    { label: 'Speed', property: 'defaultSpeedValue', hardcoded: 'defaultValue="100"' },
    { label: 'Pause before', property: 'defaultPauseBeforeValue', hardcoded: 'defaultValue="3"' },
    { label: 'Wait between', property: 'defaultWaitBetweenValue', hardcoded: 'defaultValue="1"' },
    {
      label: 'Increment until',
      property: 'defaultIncrementUntilValue',
      hardcoded: 'defaultValue="100"',
    },
  ];

  for (const { label, property, hardcoded } of dialCases) {
    it(`"${label}" dial binds .defaultValue=\${this.${property}} and drops ${hardcoded}`, () => {
      const block = getDialBlock(footerSource, label, 't-footer.ts');
      expect(block, `t-footer "${label}" dial must bind .defaultValue to the ${property} property`)
        .toContain(`.defaultValue=\${this.${property}}`);
      expect(
        block,
        `t-footer "${label}" dial must no longer carry the hardcoded ${hardcoded}`
      ).not.toContain(hardcoded);
    });
  }
});

describe('t-current-song-controls.ts song dials bind reset targets to default*Value properties', () => {
  const controlsSource = readSource('components/molecule/t-current-song-controls.ts');

  const dialCases = [
    { label: 'Start before', property: 'defaultStartBeforeValue', hardcoded: 'defaultValue="4"' },
    { label: 'Stop after', property: 'defaultStopAfterValue', hardcoded: 'defaultValue="2"' },
    { label: 'Pause before', property: 'defaultPauseBeforeValue', hardcoded: 'defaultValue="3"' },
    { label: 'Wait between', property: 'defaultWaitBetweenValue', hardcoded: 'defaultValue="1"' },
    { label: 'Volume', property: 'defaultVolumeValue', hardcoded: 'defaultValue="75"' },
    { label: 'Speed', property: 'defaultSpeedValue', hardcoded: 'defaultValue="100"' },
    {
      label: 'Increment until',
      property: 'defaultIncrementUntilValue',
      hardcoded: 'defaultValue="100"',
    },
  ];

  for (const { label, property, hardcoded } of dialCases) {
    it(`"${label}" dial binds .defaultValue=\${this.${property}} and drops ${hardcoded}`, () => {
      const block = getDialBlock(controlsSource, label, 't-current-song-controls.ts');
      expect(
        block,
        `t-current-song-controls "${label}" dial must bind .defaultValue to the ${property} property`
      ).toContain(`.defaultValue=\${this.${property}}`);
      expect(
        block,
        `t-current-song-controls "${label}" dial must no longer carry the hardcoded ${hardcoded}`
      ).not.toContain(hardcoded);
    });
  }
});

describe('t-settings-panel.ts Default Song Values section stays hardcoded (excluded from the feature)', () => {
  const settingsPanel = readSource('components/molecule/t-settings-panel.ts');

  it('t-settings-panel.ts still contains defaultValue="75" (the panel edits the defaults, it does not reset to them)', () => {
    expect(
      settingsPanel,
      't-settings-panel.ts must KEEP its hardcoded defaultValue attributes in the Default Song Values section'
    ).toContain('defaultValue="75"');
  });

  it('the panel\'s own "Volume" dial inside Default Song Values keeps defaultValue="75"', () => {
    const volumeDial = getDialBlock(settingsPanel, 'Volume', 't-settings-panel.ts');
    expect(volumeDial).toContain('defaultValue="75"');
    expect(volumeDial).not.toContain('.defaultValue=${this.');
  });
});
