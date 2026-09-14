import * as fs from 'node:fs';

/**
 * Validates that package.json correctly configures the top-level firebase dependency
 * and rejects redundant or polluted @firebase/* subpackages.
 */
async function validatePackageJson(packageJsonPath = 'package.json') {
  if (!fs.existsSync(packageJsonPath)) {
    console.error(`Error: Expected ${packageJsonPath} does not exist.`);
    process.exit(1);
  }

  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const deps = pkg.dependencies || {};

  if (!deps.firebase) {
    console.error('Error: Missing "firebase" in dependencies.');
    process.exit(1);
  }

  if (deps['@firebase/firestore'] || deps['@firebase/app']) {
    console.error(
      'Error: package.json incorrectly includes internal @firebase/* subpackages as separate dependencies. ' +
      'Only the top-level "firebase" package should be installed for customer projects.'
    );
    process.exit(1);
  }

  try {
    const res = await fetch('https://registry.npmjs.org/firebase/latest');
    if (res.ok) {
      const data = await res.json();
      if (data && data.version) {
        const latestMajor = data.version.split('.')[0];
        const ver = String(deps.firebase);
        if (!ver.includes(latestMajor) && ver !== 'latest' && !ver.startsWith('^' + latestMajor)) {
          console.error(
            `Error: Installed firebase version (${ver}) does not match latest npm major version (${latestMajor}).`
          );
          process.exit(1);
        }
      }
    }
  } catch {
    // Network or registry access issue in offline/sandbox environments; fallback to local checks
  }

  console.log(`Validation passed: ${packageJsonPath} has valid Firebase dependencies.`);
}

const targetPath = process.argv[2] || 'package.json';
validatePackageJson(targetPath);
