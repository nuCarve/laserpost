/**
 * Copyright (C) 2022 nuCarve
 * All rights reserved.
 *
 * Release manager for LaserPost
 *
 * This software is licensed under the MIT License:
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 *
 * Additional license and attribution requrements are included in subsections below.
 */

/*
 * Simple release manager for LaserPost.  
 *
 * Takes all files listed in `sourceFiles` and merges them in order, and
 * performing a substitution of `VERSION_TAG` (`'0.0.0-version'`) with the
 * version number contained in a `version.json` file.  
 *
 * See README.md for more information. 
 */

import fsp from 'fs/promises';
import path from 'path';
import * as url from 'url';

// array of source files to merge, in order
const sourceFiles = [
  'laserpost.js',
  'constants.js',
  'globals.js',
  'formatters.js',
  'camProperties.js',
  'camHandlers.js',
  'camConversion.js',
  'lightburn.js',
  'updates.js',
  'xmlState.js',
  'debug.js',
  'arcToBezier.js',
];

// determine the directory that holds the release project
const releasePath = url.fileURLToPath(new URL('.', import.meta.url));
// define paths and filenames used for source and targets
const sourcePath = path.resolve(releasePath, '..', 'src');
const distPath = path.resolve(releasePath, 'dist');
const releaseFilePath = path.resolve(distPath, 'laserpost.cps');
// path to a JSON file that contains the version number to substitute when the version tag (VERSION_TAG) is found
const versionFile = path.resolve(releasePath, 'version.json');
// unique tag in files to substitute with the version number
const VERSION_TAG = /0.0.0-version/g;

/**
 * Release LaserPost by merging a series of source files into a single file, and performing
 * substitution of version numbers.
 * 
 * @param duplicatePath - optional, if defined a duplicate of the generated file is copied to this path.
 */
async function release(duplicatePath) {
  // load the version info
  const version = JSON.parse(await fsp.readFile(versionFile));

  // load all files and perform parameter substitution
  let releaseSource = '';
  for (let sourceFile of sourceFiles) {
    const source = await fsp.readFile(path.resolve(sourcePath, sourceFile));
    releaseSource += source.toString().replace(VERSION_TAG, version.version);
  }

  // make sure target directory exists, and write the release source
  if (await fsp.access(distPath)) await fsp.mkdir(distPath);
  await fsp.writeFile(releaseFilePath, releaseSource);
  console.log(`Released version ${version.version} to ${releaseFilePath}`);

  // is a duplicate requested?
  if (duplicatePath) {
    await fsp.writeFile(duplicatePath, releaseSource);
    console.log(`Duplicate copied to ${duplicatePath}`);
  }
}

// start the release, using the optional command line argument with the target duplicate directory
await release((process.argv.length > 2) ? path.resolve(process.argv[2]) : undefined);
