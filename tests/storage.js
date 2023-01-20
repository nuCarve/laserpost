/**
 * Copyright (C) 2023 nuCarve
 * All rights reserved.
 *
 * Automated test manager for LaserPost
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
 */

import fs from 'node:fs';
import path from 'node:path';
import * as url from 'node:url';
import { SNAPSHOT_MODE_RESET } from './globals.js';
import chalk from 'chalk';

/**
 * Loads the tests.json file
 *
 * @param testsJsonPath - Path to the tests.json file
 * @returns Object with test info
 */
export function loadJson(testsJsonPath) {
  // load the release json file
  const testjson = JSON.parse(fs.readFileSync(testsJsonPath));

  return testjson;
}

/**
 * Handle setting up of paths to working areas.
 *
 * @returns Object with resolved paths
 */
export function setupFilePaths() {
  // determine the directory that holds the tests
  const testPath = url.fileURLToPath(new URL('.', import.meta.url));

  // path to a JSON file that contains the test information
  const testsJsonPath = path.resolve(testPath, 'tests.json');

  return { testsJsonPath: testsJsonPath };
}

/**
 * Prepare the storage folders, and transfer the cnc file into the test cnc folder.  Returns an
 * object with the path to the cnc folder (cncPath) that contains the transferred cnc file and to
 * the snapshot folder (snapshotPath).
 *
 * @param setup Setup to use for the command line arguments
 * @param postNumber Index into which post should be generated
 * @param cmdOptions Options from the command line (tests, paths)
 * @returns Object with cncPath and snapshotPath elements
 */
export function prepStorageFolders(setup, postNumber, cmdOptions) {
  // the target folder is <cncPath>/results/<post-name>/<test-name>
  const testName = setup.name
    .toLowerCase()
    .replace(/\W/g, '-')
    .replace(/[_-]+/g, '-')
    .replace(/-?$/, '');

  // set up the cncPath
  const cncPath = path.resolve(
    cmdOptions.cncPath,
    'results',
    setup.posts[postNumber],
    testName
  );

  // make sure the directory exists
  fs.mkdirSync(cncPath, { recursive: true });

  // transfer the CNC file into this path
  fs.copyFileSync(
    `${path.resolve(cmdOptions.cncPath, setup.cnc)}.cnc`,
    `${path.resolve(cncPath, setup.cnc)}.cnc`
  );

  // set up the snapshotPath
  const snapshotPath = path.resolve(
    cmdOptions.cncPath,
    'snapshots',
    setup.posts[postNumber],
    testName
  );

  // make sure the directory exists
  fs.mkdirSync(snapshotPath, { recursive: true });

  return { cncPath, snapshotPath };
}

/**
 * Clears all contents from the target test folder, with recursion.  Also clears out all snapshots
 * if the test is resetting snapshots and there are no test filters (meaning, all known tests will
 * be getting a fresh snapshot). Executed prior to a test run start to have a fresh results space.
 *
 * @param cmdOptions Options from the command line (tests, paths)
 */
export function clearResultsFolder(cmdOptions) {
  // clear out the results folder
  const resultsPath = path.resolve(cmdOptions.cncPath, 'results');
  fs.rmSync(resultsPath, { force: true, recursive: true });

  // if no test filters and resetting all snapshots, clear out the snapshots folder
  if (cmdOptions.tests.length == 0 && cmdOptions.snapshotMode === SNAPSHOT_MODE_RESET) {
    console.log(chalk.yellow(`No test filters and reset requested; clearing all contents in the snapshot folder.`));
    const snapshotPath = path.resolve(cmdOptions.cncPath, 'snapshots');
    fs.rmSync(snapshotPath, { force: true, recursive: true });
  }
}
