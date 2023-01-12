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

/*
 * Simple automated test manager for Autodesk CAM, for testing LaserPost post-processors.
 */

import fs from 'node:fs';
import path from 'node:path';
import * as url from 'node:url';
import cp from 'node:child_process';

/**
 * Parse command line arguments.
 *
 * Command line syntax:
 * test {<test-name> {<test-name...>}} {-p=<path-to-post-processor-executable>}
 * {-s=<path-to-CPS-source-directory>} {-c=<path-to-CNC-directory>}
 *
 * Defaults:
 * - -p: "post" (requires path to resolve the location of the post processor)
 * - -s: "release/dist"
 * - -c: "tests/cnc"
 *
 * @returns Object { tests: <array of test names>, postPath: <post path>, cpsPath: <cps directory>,
 * cncPath: <cnc directory> }
 */
function parseArgs() {
  // decode the command line options
  let postPath = 'post';
  let cpsPath = 'release/dist';
  let cncPath = 'tests/cnc';

  const tests = [];

  for (let cmdIndex = 2; cmdIndex < process.argv.length; ++cmdIndex) {
    // is this a flag?
    if (process.argv[cmdIndex].startsWith('-')) {
      const flag = process.argv[cmdIndex];

      // all options require an '=' with a value
      if (flag[2] != '=') {
        console.log(`Missing path on ${flag}`);
        process.exit(-1);
      }

      // decode the switch option
      switch (flag[1].toLowerCase()) {
        case 'p':
          postPath = flag.substring(3);
          break;
        case 'c':
          cpsPath = flag.substring(3);
          break;
        case 'i':
          cncPath = flag.substring(3);
          break;
        default:
          console.log(`Unknown command line flag: ${flag}`);
          process.exit(-1);
      }
    } else tests.push(process.argv[cmdIndex].toLowerCase());
  }

  return { tests, postPath, cpsPath, cncPath };
}

/**
 * Loads the test.json file
 *
 * @param testJsonPath - Path to the test.json file
 * @returns Object with test info
 */
function loadJson(testJsonPath) {
  // load the release json file
  const testjson = JSON.parse(fs.readFileSync(testJsonPath));

  return testjson;
}

/**
 * Handle setting up of paths to working areas.
 *
 * @returns Object with resolved paths
 */
function setupFilePaths() {
  // determine the directory that holds the tests
  const testPath = url.fileURLToPath(new URL('.', import.meta.url));

  // path to a JSON file that contains the test information
  const testJsonPath = path.resolve(testPath, 'test.json');

  return { testJsonPath: testJsonPath };
}

/**
 * Merges setup information from the test.json file (setup and test section) such that the top-most
 * setup wins on conflicts (to allow for overriding settings)
 *
 * @param setup Setup object (most current, top level)
 * @param parentSetup Setup object from the parent (items are included only if not overriden by setup)
 * @returns Merged new setup object
 */
function mergeSetups(setup, parentSetup) {
  const result = {};

  // transfer over properties from parent unless overridden
  result.posts = setup.posts ?? parentSetup.posts ?? [];
  result.cnc = setup.cnc ?? parentSetup.cnc ?? '';
  result.properties = setup.properties ?? [];
  result.options = setup.options ?? {};
  result.name = setup.name;

  // descend into child properties and transfer
  if (parentSetup.properties) {
    for (const parentProperty in parentSetup.properties) {
      if (!setup.properties || !setup.properties.hasOwnProperty(parentProperty))
        result.properties[parentProperty] =
          parentSetup.properties[parentProperty];
    }
  }

  // descend into child options and transfer
  if (parentSetup.options) {
    for (const parentOption in parentSetup.options) {
      if (!setup.options || !setup.options.hasOwnProperty(parentOption))
        result.options[parentOption] = parentSetup.options[parentOption];
    }
  }

  return result;
}

/**
 * Aggregates a setup, following the parent chain of setups, along with the test setup itself - such that
 * the resulting setup is a merged combination of all configuration.
 *
 * @param setupName Name of the setup this test is associatd with
 * @param testSetups Object with all setups (dictionary of setups)
 * @returns Aggregated (merged) setup for this specific test
 */
function aggregateSetup(setupName, testSetups) {
  if (testSetups[setupName]) {
    const setup = testSetups[setupName];

    // do we have a parent setup?
    if (testSetups[setupName].setup) {
      const parentSetup = aggregateSetup(
        testSetups[setupName].setup,
        testSetups
      );
      return mergeSetups(setup, parentSetup);
    }
    return setup;
  }
  console.error(`Fatal: Unable to locate setup ${setupName}`);
  process.exit(-1);
}

/**
 * Build the command line arguments for the Autodesk post procesor
 *
 * @param setup Setup to use for the command line arguments
 * @param postNumber Index into which post should be generated
 * @param cmdOptions Options from the command line (tests, paths)
 * @param cncPath Path to the transferred CNC file (in the test results folder)
 * @returns Array of command line options consistent with process.spawn
 */
function buildPostCommand(setup, postNumber, cmdOptions, cncPath) {
  // process all options
  const optionsArray = [];
  for (const option in setup.options) {
    const entry = setup.options[option];

    if (entry)
      if (typeof entry === 'string') optionsArray.push(entry);
      else optionsArray.push(...entry);
  }

  // process all properties
  const propertiesArray = [];
  for (const property in setup.properties) {
    const value = setup.properties[property];

    if (value !== null) propertiesArray.push(`--property`, property, value);
  }

  return [
    ...optionsArray,
    `${path.resolve(cmdOptions.cpsPath, setup.posts[postNumber])}.cps`,
    `${path.resolve(cncPath, setup.cnc)}.cnc`,
  ];
}

/**
 * Prepare the target test folder, and transfer the cnc file into the folder.  Returns the path to
 * the folder that contains the transferred cnc file.  This is so that all artifacts from the test
 * are gathered together.
 *
 * @param setup Setup to use for the command line arguments
 * @param postNumber Index into which post should be generated
 * @param cmdOptions Options from the command line (tests, paths)
 * @returns String with path to the CNC folder.
 */
function prepResultsFolder(setup, postNumber, cmdOptions) {
  // the target folder is <cncPath>/results/<post-name>/<test-name>
  const testName = setup.name.toLowerCase().replace(/\W/g, '-').replace(/_+/g, '-');
  const targetPath = path.resolve(cmdOptions.cncPath, 'results', setup.posts[postNumber], testName);

  // make sure the directory exists
  fs.mkdirSync(targetPath, { recursive: true });

  // transfer the CNC file into this path
  fs.copyFileSync(`${path.resolve(cmdOptions.cncPath, setup.cnc)}.cnc`, `${path.resolve(targetPath, setup.cnc)}.cnc`);

  return targetPath;
}

/**
 * Clears all contents from the target test folder, with recursion.  Executed prior to a test run
 * start to have a fresh results space.
 *
 * @param cmdOptions Options from the command line (tests, paths)
 */
function clearResultsFolder(cmdOptions) {
  const targetPath = path.resolve(cmdOptions.cncPath, 'results');
  fs.rmSync(targetPath, { force: true, recursive: true });
}

/**
 * Executes a single Autodesk post operation.  
 *
 * @param cmdOptions Options from the command line (tests, paths)
 * @param cmdArguments Command line arguments for the post processor (see buildPostCommand)
 * @returns `true` if successful, `false` if it fails to work. May terminate process on fatal
 * errors.
 */
function runPostTest(cmdOptions, cmdArguments) {
  // spawn the post-processor
  const result = cp.spawnSync(cmdOptions.postPath, cmdArguments, {
    shell: true,
    cwd: process.cwd(),
    env: process.env,
    stdio: 'pipe',
    encoding: 'utf-8'
  });

  // was the execution successful?
  if (result.status == 0) {
    console.log(`Stdout: ${result.stdout}`);
    console.log(`Stderr: ${result.stderr}`);
    return true;
  }

  // it failed - determine reason to decide if fatal or warning
  if (result.status == 1) {
    console.log(`Post-processor did not execute:\n${result.stderr}`);
  } else {
    console.log(`Post ran, but had error ${result.status}: ${result.stderr}`);
  }
  console.log(`\nCommand line executed:`);
  console.log(`${cmdOptions.postPath} ${cmdArguments.join(' ')}`);
  console.log();

  // terminate on fatal executions
  if (result.status == 1) process.exit(-1);
  return false;
}

/**
 *
 * @param testSuite Test suite object that the individual test that needs to be executed.
 * @param testSetups Object containing all test setups
 * @param cmdOptions Options from the command line (tests, paths)
 * @returns Object with { pass: number, fail: number } summarizing the executions (one per post defined)
 */
function runTest(testSuite, testSetups, cmdOptions) {
  let setup = aggregateSetup(testSuite.setup, testSetups);
  setup = mergeSetups(testSuite, setup);

  // validate the setup
  let valid = true;
  if (!setup.cnc) {
    console.warn(`  Invalid setup: No CNC defined.`);
    valid = false;
  }
  if (setup.posts.length == 0) {
    console.warn(`  Invalid setup: No "posts" defined.`);
    valid = false;
  }

  const result = { pass: 0, fail: 0 };

  // if valid test, loop through all posts on the test and run each one
  if (valid) {
    for (let postIndex = 0; postIndex < setup.posts.length; ++postIndex) {
      // prepare the test results folder
      const cncPath = prepResultsFolder(setup, postIndex, cmdOptions);

      // execute the test
      const passed = runPostTest(
        cmdOptions,
        buildPostCommand(setup, postIndex, cmdOptions, cncPath)
      );
      if (passed) result.pass++;
      else result.fail++;
    }
  } else console.warn('  TEST SKIPPED');

  return result;
}

/**
 * Runs all tests that match the test criteria
 *
 * @param testSuites Object with all possible test suites
 * @param cmdOptions Options from the command line (tests, paths)
 * @returns Object with { pass: number, fail: number }
 */
function runTests(testSuites, cmdOptions) {
  const summary = { pass: 0, fail: 0 };

  // loop for all defined tests
  for (const testSuite of testSuites.tests) {
    let testSelected = false;

    // if selectedTests were specified, limit to those that match
    if (cmdOptions.tests.length) {
      for (const test of cmdOptions.tests) {
        if (testSuite.name?.toLowerCase().contains(test?.toLowerCase())) {
          testSelected = true;
          break;
        }
      }
    } else testSelected = true;

    // if test selected, run the test
    if (testSelected) {
      console.log(`Test: "${testSuite.name}" (setup "${testSuite.setup}"):`);
      const result = runTest(testSuite, testSuites.setups, cmdOptions);
      summary.pass += result.pass;
      summary.fail += result.fail;
    }
  }
  return summary;
}

/*** MAIN LOGIC ***/

// decode command line
const cmdOptions = parseArgs();

// build up file paths to access source and dist
const filePaths = setupFilePaths();

// load the test json file that defines the test cases
const testSuites = loadJson(filePaths.testJsonPath);

// clear out the prior test results folder
clearResultsFolder(cmdOptions);

// run the tests
const summary = runTests(testSuites, cmdOptions);
console.log(
  `Test run complete: ${summary.pass} of ${
    summary.pass + summary.fail
  } tests passed`
);
if (summary.fail > 0) console.error(`WARNING: ${summary.fail} tests failed`);
process.exit(summary.fail);
