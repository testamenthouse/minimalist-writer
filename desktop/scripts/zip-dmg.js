// afterAllArtifactBuild: wrap each .dmg in a .zip next to it (the DMG itself stays so publishing is unaffected).
const { execFileSync } = require('child_process');
const path = require('path');

module.exports = async function (result) {
  const zips = [];
  for (const file of result.artifactPaths) {
    if (!file.endsWith('.dmg')) continue;
    const zip = file + '.zip';
    execFileSync('ditto', ['-c', '-k', '--norsrc', file, zip], { stdio: 'inherit' });
    console.log('  • zipped          file=' + path.relative(process.cwd(), zip));
    zips.push(zip);
  }
  return zips;
};
