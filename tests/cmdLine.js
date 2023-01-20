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

import {
  SNAPSHOT_MODE_NEVER,
  SNAPSHOT_MODE_RESET,
  SNAPSHOT_MODE_CREATE,
  SNAPSHOT_MODE_DIFF
} from './globals.js';
import chalk from 'chalk';

/**
 * Parse command line arguments.  See the "-?" implementation for details.
 *
 * @returns Object containing command line property results
 */
export function parseArgs() {
  // decode the command line options
  let postPath = process.env.AUTODESK_POST ?? 'post';
  let cpsPath = 'release/dist';
  let cncPath = 'tests/cnc';
  let postFilter = [];
  let verbose = false;
  let snapshotMode = SNAPSHOT_MODE_NEVER;

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
            console.log(
              chalk.greenBright(`LaserPost automated testing framework`)
            );
            console.log(chalk.greenBright(`Copyright (c) 2023 nuCarve`));
            console.log(``);
            console.log(
              `Command syntax: ${chalk.yellow(
                'node tests/test.js'
              )} ${chalk.magenta('{<options...>}')} ${chalk.blue(
                '{<filters>...}'
              )}`
            );
            console.log(``);
            console.log(chalk.magenta(`<filters>:`));
            console.log(
              chalk.gray(
                `Filters limit the tests to run by matching on the test name.  If no filters are specified,`
              )
            );
            console.log(
              chalk.gray(
                `all tests will be executed.  Filters are case insensitive, and match anywhere in the test`
              )
            );
            console.log(
              chalk.gray(
                `name ("box" will match "Test box width" and "Box dimensions" but not "Circle test")`
              )
            );
            console.log(``);
            console.log(chalk.blue(`<options>:`));
            console.log(
              chalk.gray(
                `-p=<post-filter>: Limits tests to matching posts (partial match, such as "-p=light" matches "laserpost-lightburn")`
              )
            );
            console.log(
              chalk.gray(
                `                  Can specify multiple "-p" arguments.`
              )
            );
            console.log(chalk.gray(`-v: Verbose mode (default is false)`));
            console.log(chalk.gray(`-s=<mode>: Snapshot storage mode:`));
            console.log(
              chalk.gray(
                `           "n", "never": will never create or update a snapshot (default).`
              )
            );
            console.log(
              chalk.gray(
                `           "c", "create": will create a snapshot only none already exist.`
              )
            );
            console.log(
              chalk.gray(
                `           "d" "diff": will update the snapshot if different than the recorded snapshot (or no snapshot exists).`
              )
            );
            console.log(
              chalk.gray(
                `           "r", "reset": will always overwrite (reset) snapshots.`
              )
            );
            console.log(
              chalk.gray(
                `-pp=<path>: Path to Autodesk post executable (default is env variable AUTODESK_POST, else "post")`
              )
            );
            console.log(
              chalk.gray(
                `-sp=<path>: Path to folder with post-processor CPS source files (default is "release/dist")`
              )
            );
            console.log(
              chalk.gray(
                `-ip=<path>: Path to folder with post-processor CNC intermediate test files (default is "tests/cnc")`
              )
            );
            console.log(``);
            console.log(
              chalk.gray(
                `Source code, additional instructions and license available at:`
              )
            );
            console.log(
              chalk.blueBright(
                `https://github.com/nuCarve/laserpost/tree/main/tests`
              )
            );
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
          case '-s':
            switch (splitEquals[1][0].toLowerCase()) {
              case 'n':
                snapshotMode = SNAPSHOT_MODE_NEVER;
                break;
              case 'c':
                snapshotMode = SNAPSHOT_MODE_CREATE;
                break;
              case 'd':
                snapshotMode = SNAPSHOT_MODE_DIFF;
                break;
              case 'r':
                snapshotMode = SNAPSHOT_MODE_RESET;
                break;
              default:
                console.error(
                  `Unknown snapshot create option "${splitEquals[1]}"; expected "reset" or "create"`
                );
                process.exit(-1);
            }
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

  return {
    tests,
    postPath,
    cpsPath,
    cncPath,
    verbose,
    postFilter,
    snapshotMode,
  };
}
