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

import chalk from 'chalk';
import { parseArgs } from "./cmdLine.js";
import { loadJson, setupFilePaths, clearResultsFolder } from "./storage.js";
import { runTests } from "./testValidate.js";

/**
 * Automated test manager for LaserPost.  Execute with '-?' option to see command line help.
 */
function main() {
  // decode command line
  const cmdOptions = parseArgs();

  // build up file paths to access source and dist
  const filePaths = setupFilePaths();

  // load the test json file that defines the test cases
  const testSuites = loadJson(filePaths.testsJsonPath);

  // clear out the prior test results folder
  clearResultsFolder(cmdOptions);

  // run the tests & summarize results
  const summary = runTests(testSuites, cmdOptions);
  const message = `Test run complete: ${summary.pass} of ${
      summary.pass + summary.fail
    } tests passed`;

    if (summary.fail > 0) {
      console.log(chalk.yellow(message));
      console.error(chalk.red(`WARNING: ${summary.fail} tests failed`));
    } else console.log(chalk.green(message));

  // pass back status to shell (-1: failure, 0: all tests passed, >0: number of failed tests)
  process.exit(summary.fail);
}

// launch main
main();
