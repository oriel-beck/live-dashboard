const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Build TypeScript
console.log('Building TypeScript...');
execSync('tsc', { stdio: 'inherit' });

// Copy package.json to dist for reference (packing uses root package.json)
console.log('Copying package.json to dist...');
const packageJson = require('./package.json');
const distPackageJson = {
  name: packageJson.name,
  version: packageJson.version,
  description: packageJson.description,
  main: './index.js',
  types: './index.d.ts',
  exports: {
    '.': {
      import: './index.js',
      require: './index.js',
      types: './index.d.ts'
    }
  },
  files: ['**/*'],
  dependencies: packageJson.dependencies,
  keywords: packageJson.keywords,
  author: packageJson.author,
  license: packageJson.license
};

fs.writeFileSync(
  path.join(__dirname, 'dist', 'package.json'),
  JSON.stringify(distPackageJson, null, 2)
);

console.log('Build complete!');

