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
import minimatch from 'minimatch';
import xpath from 'xpath';
import dom from 'xmldom-qsa';

/**
 * Parse command line arguments.  See the "-?" implementation for details.
 *
 * @returns Object containing command line property results
 */
function parseArgs() {
  // decode the command line options
  let postPath = process.env.AUTODESK_POST ?? 'post';
  let cpsPath = 'release/dist';
  let cncPath = 'tests/cnc';
  let postFilter = [];
  let verbose = false;

  const tests = [];

  for (let cmdIndex = 2; cmdIndex < process.argv.length; ++cmdIndex) {
    // is this a flag?
    if (process.argv[cmdIndex].startsWith('-')) {
      const flag = process.argv[cmdIndex];

      const splitEquals = flag.split('=');

      // decode options that don't require parameters
      if (splitEquals.length == 1) {
        switch (splitEquals[0].toLowerCase()) {
          case '-?':
            console.log(``);
            console.log(`LaserPost automated testing framework`);
            console.log(`Copyright (c) 2023 nuCarve`);
            console.log(``);
            console.log(
              `Command syntax: node tests/test.js {<options...>} {<filters>...}`
            );
            console.log(``);
            console.log(`<filters>:`);
            console.log(
              `Filters limit the tests to run by matching on the test name.  If no filters are specified,`
            );
            console.log(
              `all tests will be executed.  Filters are case insensitive, and match anywhere in the test`
            );
            console.log(
              `name ("box" will match "Test box width" and "Box dimensions" but not "Circle test")`
            );
            console.log(``);
            console.log(`<options>:`);
            console.log(
              `-p=<post-filter>: Limits tests to matching posts (partial match, such as "-p=light" matches "laserpost-lightburn")`
            );
            console.log(
              `                  Can specify multiple "-p" arguments.`
            );
            console.log(`-v: Verbose mode (default is false)`);
            console.log(
              `-pp=<path>: Path to Autodesk post executable (default is env variable AUTODESK_POST, else "post")`
            );
            console.log(
              `-sp=<path>: Path to folder with post-processor CPS source files (default is "release/dist")`
            );
            console.log(
              `-ip=<path>: Path to folder with post-processor CNC intermediate test files (default is "tests/cnc")`
            );
            console.log(``);
            console.log(
              `Source code, additional instructions and license available at:`
            );
            console.log(`https://github.com/nuCarve/laserpost/tree/main/tests`);
            console.log(``);
            process.exit(-1);
          case '-v':
            verbose = true;
            break;
          default:
            console.log(`Unknown command line flag "${flag}"`);
            process.exit(-1);
        }
      } else {
        if (splitEquals.length > 2) {
          console.log(`Too many '=' on "${flag}"`);
          process.exit(-1);
        }
        if (splitEquals[0].length == 0) {
          console.log(`Missing option name "${flag}"`);
          process.exit(-1);
        }

        // decode the switch option
        switch (splitEquals[0].toLowerCase()) {
          case '-p':
            postFilter.push(splitEquals[1]);
            break;
          case '-pp':
            postPath = splitEquals[1];
            break;
          case '-sp':
            cpsPath = splitEquals[1];
            break;
          case '-ip':
            cncPath = splitEquals[1];
            break;
          default:
            console.log(`Unknown command line flag "${splitEquals[0]}=..."`);
            process.exit(-1);
        }
      }
    } else tests.push(process.argv[cmdIndex].toLowerCase());
  }

  return { tests, postPath, cpsPath, cncPath, verbose, postFilter };
}

/**
 * Loads the tests.json file
 *
 * @param testsJsonPath - Path to the tests.json file
 * @returns Object with test info
 */
function loadJson(testsJsonPath) {
  // load the release json file
  const testjson = JSON.parse(fs.readFileSync(testsJsonPath));

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
  const testsJsonPath = path.resolve(testPath, 'tests.json');

  return { testsJsonPath: testsJsonPath };
}

/**
 * Merges setup information from the tests.json file (setup and test section) such that the top-most
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
  result.validators = setup.validators ?? {};
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

  // descent into child validators and transfer
  if (parentSetup.validators) {
    for (const parentValidator in parentSetup.validators) {
      if (
        !setup.validators ||
        !setup.validators.hasOwnProperty(parentValidator)
      )
        result.validators[parentValidator] =
          parentSetup.validators[parentValidator];
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
    ...propertiesArray,
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
  const testName = setup.name
    .toLowerCase()
    .replace(/\W/g, '-')
    .replace(/_+/g, '-');
  const targetPath = path.resolve(
    cmdOptions.cncPath,
    'results',
    setup.posts[postNumber],
    testName
  );

  // make sure the directory exists
  fs.mkdirSync(targetPath, { recursive: true });

  // transfer the CNC file into this path
  fs.copyFileSync(
    `${path.resolve(cmdOptions.cncPath, setup.cnc)}.cnc`,
    `${path.resolve(targetPath, setup.cnc)}.cnc`
  );

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
function runPostProcessor(cmdOptions, cmdArguments) {
  // spawn the post-processor
  const result = cp.spawnSync(cmdOptions.postPath, cmdArguments, {
    shell: true,
    cwd: process.cwd(),
    env: process.env,
    stdio: 'pipe',
    encoding: 'utf-8',
  });

  // was the execution successful?
  if (result.status == 0) {
    if (cmdOptions.verbose) {
      console.log(`Stdout: ${result.stdout}`);
      console.log(`Stderr: ${result.stderr}`);

      console.log(`\nCommand line executed:`);
      console.log(`${cmdOptions.postPath} ${cmdArguments.join(' ')}`);
      console.log();
    }
    return true;
  }

  // it failed - determine reason to decide if fatal or warning
  if (result.status == 1) {
    console.log(`Post-processor did not execute:\n${result.stderr}`);
  } else {
    console.log(`Post ran, but had error ${result.status}: ${result.stderr}`);
  }
  if (cmdOptions.verbose) {
    console.log(`\nCommand line executed:`);
    console.log(`${cmdOptions.postPath} ${cmdArguments.join(' ')}`);
    console.log();
  }

  // terminate on fatal executions
  if (result.status == 1) process.exit(-1);
  return false;
}

/**
 * Validates the results of a prior post execution.  Identifies the validators to use based on the
 * post type and the artifact files discovered, and delegates to the appropriate validator.
 *
 * @param setup Setup to use for the command line arguments.
 * @param postNumber Index into which post should be generated.
 * @param cmdOptions Options from the command line (tests, paths).
 * @param cncPath Path to the transferred CNC file (in the test results folder).
 * @returns { pass: number, fail: number }
 */
function validatePostResults(setup, postNumber, cmdOptions, cncPath) {
  const result = { pass: 0, fail: 0 };

  // determine the post we used for this test
  const post = setup.posts[postNumber];

  // find validators that match our post for this setup
  for (const key in setup.validators) {
    const validator = setup.validators[key];
    if (minimatch(post, validator.post)) {
      // now see if any artifact files match the validator file pattern
      const files = fs.readdirSync(cncPath);
      for (const file of files)
        if (minimatch(file, validator.file))
          // we have a match - a validator and a file to validate
          switch (validator.validator) {
            case 'xpath':
              const xpathResult = validateXPath(
                validator,
                cncPath,
                file,
                cmdOptions
              );
              if (xpathResult.success) result.pass++;
              else result.fail++;
              // console.log(`Snapshot:\n${xpathResult.snapshot}`);
              break;
            case 'text':
              console.error('    TEXT validator not implemented');
              result.fail++;
              break;
            default:
              console.error(
                `    Unknown validator "${validator.validator}" on "${key}" for "${file}".`
              );
              result.fail++;
              break;
          }
    }
  }
  return result;
}

// set up global used by valiateXMLPathHandleError to track if an error has occured with the DOM
let validateXMLPathError = false;

/**
 * Handler for XMLDOM errors.  Called via callback when the DOM experiences an error.  Outputs the
 * errors to the console, and sets the global `validateXMLPathError` to `true` to provide the error
 * back to the calling code.
 *
 * @param type - String with the type of error (such as "Error")
 * @param message - String (multi-line supported) with the error message
 */
function validateXMLPathHandleError(type, message) {
  if (!validateXMLPathError) console.log('    FAIL: XML file failed to parse:');

  console.log(`      ${type}: ${message.replace(/\n/g, '\n      ')}`);
  validateXMLPathError = true;
}

/**
 * Execute the XPath based validator.  The validator setup must include the `xpath` property, which
 * can be set to a single xpath query, or an array of xpath queries.  The query can be a single string
 * (in which case there must be a match or it will fail), or an object that can include { query:
 * string, required: boolean } to to specify if the field is optional.
 *
 * @param validator - Validator object from the setup
 * @param cncPath - Path to the cnc folder
 * @param file - Filename being validated
 * @param cmdOptions Options from the command line (tests, paths).
 * @returns Object with { snapshot: string, success: boolean }
 */
function validateXPath(validator, cncPath, file, cmdOptions) {
  let snapshot = '';
  let success = true;

  // make sure we have a valid xpath specification
  if (validator.xpath) {
    // set up an array for the xpath property, converting a single string to an array
    const xpathArray = Array.isArray(validator.xpath)
      ? validator.xpath
      : [validator.xpath];

    // load up the file into memory as a string
    const xmlSource = fs.readFileSync(path.resolve(cncPath, file), {
      encoding: 'utf-8',
    });

    // set up the XML dom and parse the XML.  Note the use of the global variable
    // `validateXMLPathError` that is set to true in the `validateXMLPathHandleError` callbacks
    // to indicate an error was discovered
    validateXMLPathError = false;
    const xmlDoc = new dom.DOMParser({
      locator: {},
      errorHandler: {
        warning: (m) => validateXMLPathHandleError('Warning', m),
        error: (m) => validateXMLPathHandleError('Error', m),
        fatalError: (m) => validateXMLPathHandleError('Fatal error', m),
      },
    }).parseFromString(xmlSource, 'application/xml');

    // fail if we had a parsing problem
    if (validateXMLPathError)
      return { snapshot: `XML parse failure`, success: false };

    // process the queries
    for (const xpathQuery of xpathArray) {
      // unify the query to be an object with { query, required } values
      let queryObject =
        typeof xpathQuery === 'string'
          ? { query: xpathQuery, required: true }
          : { query: xpathQuery.query, required: xpathQuery.required ?? true };

      if (cmdOptions.verbose) {
        console.log(
          `    Processing query "${queryObject.query}" (${
            queryObject.required ? 'required' : 'not required'
          }):`
        );
      }
      snapshot += `XPath query "${queryObject.query}" (${
        queryObject.required ? 'required' : 'not required'
      }):\n`;

      try {
        const nodes = xpath.select(queryObject.query, xmlDoc);
        if (nodes.length == 0 && queryObject.required) {
          console.log(
            `    Processing query "${queryObject.query}" (required):`
          );
          console.error(
            `      FAIL: Required query did not match any elements`
          );
          success = false;
          snapshot += `  FAIL: Required query did not match any elements.\n`;
          continue;
        }

        if (cmdOptions.verbose)
          console.log(`      ${nodes.length} elements found`);

        // add the results to the snapshot
        for (const node of nodes) {
          snapshot += node.toString();
          // make sure snapshot has a newline at the end
          if (snapshot.slice(-1) != '\n') snapshot += '\n';
        }
      } catch (ex) {
        console.log(
          `    FAIL: Failed to parse XPath query "${queryObject.query}"`
        );
        success = false;
        snapshot += `  FAIL: Failed to parse XPath query`;
      }
    }
  } else {
    console.error(
      `    FAIL: XPath validator setup missing required "xpath" property`
    );
    return {
      snapshot: `FAIL: XPath validator setup missing required "xpath" property`,
      success: false,
    };
  }
  return { snapshot, success };
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
  let headerShown = false;

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
      // if using post filter(s), make sure the post matches
      if (cmdOptions.postFilter.length > 0) {
        let matchPost = false;
        for (const filter of cmdOptions.postFilter)
          if (
            setup.posts[postIndex].toLowerCase().includes(filter.toLowerCase())
          ) {
            matchPost = true;
            break;
          }
        if (!matchPost) continue;
      }

      // show test header if not already done
      if (!headerShown) {
        console.log(`Test: "${testSuite.name}" (setup "${testSuite.setup}"):`);
        headerShown = true;
      }
      console.log(`  Post: ${setup.posts[postIndex]}`);

      // prepare the test results folder
      const cncPath = prepResultsFolder(setup, postIndex, cmdOptions);

      // execute the test
      const passed = runPostProcessor(
        cmdOptions,
        buildPostCommand(setup, postIndex, cmdOptions, cncPath)
      );

      // did we successfully run the post?
      if (passed) {
        // validate the post results
        const validateResult = validatePostResults(
          setup,
          postIndex,
          cmdOptions,
          cncPath
        );

        if (validateResult.fail > 0) result.fail++;
        else result.pass++;
      } else result.fail++;
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
        if (testSuite.name?.toLowerCase().includes(test.toLowerCase())) {
          testSelected = true;
          break;
        }
      }
    } else testSelected = true;

    // if test selected, run the test
    if (testSelected) {
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
const testSuites = loadJson(filePaths.testsJsonPath);

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
