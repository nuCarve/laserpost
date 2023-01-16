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
import minimatch from 'minimatch';
import prettyDiff from './prettyDiff.js';
import {
  SNAPSHOT_NO_WRITE,
  SNAPSHOT_RESET,
  SNAPSHOT_CREATE,
} from './globals.js';
import chalk from 'chalk';
import { validateXPath } from './validatorXPath.js';
import { validateText } from './validatorText.js';
import { validateRegex } from './validatorRegex.js';
import { buildPostCommand, runPostProcessor } from './runPost.js';
import { prepStorageFolders } from './storage.js';
import { aggregateSetup, mergeSetups } from './combineSetups.js';
import { SNAPSHOT_COMMENT_LINE_HEADER } from './globals.js';

/**
 * Validates the results of a prior post execution.  Identifies the validators to use based on the
 * post type and the artifact files discovered, and delegates to the appropriate validator.
 *
 * @param setup Setup to use for the command line arguments.
 * @param postNumber Index into which post should be generated.
 * @param cmdOptions Options from the command line (tests, paths).
 * @param cncPath Path to the transferred CNC file (in the test results folder).
 * @param snapshotPath Path to the snapshot folder (for the baseline snapshot to compare against)
 * @returns { pass: number, fail: number, lastFailure: string }
 */
export function validatePostResults(
  setup,
  postNumber,
  cmdOptions,
  cncPath,
  snapshotPath
) {
  const result = { pass: 0, fail: 0, lastFailure: undefined };
  
  // determine the post we used for this test
  const post = setup.posts[postNumber];

  // find validators that match our post for this setup
  for (const key in setup.validators) {
    const validator = setup.validators[key];
    if (minimatch(post, validator.post)) {
      // now see if any artifact files match the validator file pattern
      const files = fs.readdirSync(cncPath);
      for (const file of files)
        if (minimatch(file, validator.file)) {
          // read in the file
          let document = fs.readFileSync(path.resolve(cncPath, file), {
            encoding: 'utf-8',
          });

          // set up our contents object
          const contents = { snapshot: document, failure: [], header: [] };

          // prepare the header with information about the snapshot
          contents.header.push('');
          contents.header.push('LaserPost automated testing snapshot');
          contents.header.push('See https://github.com/nucarve/laserpost for information.')
          contents.header.push('');
          contents.header.push(`Snapshot:`);
          contents.header.push(`  Post: ${validator.post}`);
          contents.header.push(`  Setup: ${setup.name}`);
          contents.header.push(`  File: ${file}`);
          contents.header.push('');
          contents.header.push('Properties:');
          for (const propertyKey in setup.properties)
            contents.header.push(`  ${propertyKey}: ${setup.properties[propertyKey]}`)
          contents.header.push('');
          contents.header.push('Options:');
          for (const optionsKey in setup.options)
            contents.header.push(`  ${optionsKey}: ${JSON.stringify(setup.options[optionsKey])}`);
          contents.header.push('');
          contents.header.push('Validators:');

          // execute the generic regex validator (if requested)
          if (validator.regex) {
            runValidator(
              'regex',
              contents,
              validator,
              file,
              cmdOptions
            );
          }

          // execute their specific requested validator
          if (validator.validator) {
            runValidator(
              validator.validator,
              contents,
              validator,
              file,
              cmdOptions
            );
          }

          // handle the failures - to the header and to the console
          if (contents.failure.length > 0) {
            contents.header.push('');
            contents.header.push('Validation failures:');
            console.error(chalk.red(`Validation failures:`));
            for (const failure of contents.failure) {
              contents.header.push('  ' + failure);
              console.error(chalk.red('      ' + failure));
            }
          }

          // format the header for output to the snapshot file
          contents.header.push('');
          const formattedHeader = SNAPSHOT_COMMENT_LINE_HEADER + contents.header.join('\n' + SNAPSHOT_COMMENT_LINE_HEADER) + '\n';

          // record the snapshot
          const snapshotFile = path.resolve(cncPath, file + '.snapshot');
          fs.writeFileSync(snapshotFile, formattedHeader + contents.snapshot, {
            encoding: 'utf-8',
          });

          // run the snapshot compare / management
          const targetSnapshotFile = path.resolve(
            snapshotPath,
            file + '.snapshot'
          );
          const artifactFile = path.resolve(cncPath, file);
          const targetArtifactFile = path.resolve(snapshotPath, file);

          const failureMessage = snapshotCompare(
            key,
            snapshotFile,
            targetSnapshotFile,
            artifactFile,
            targetArtifactFile,
            cmdOptions
          );

          // if no prior errors, look at our snapshot failure (this let's prior failures win as the
          // snapshot isn't important when failures have happened)
          if (contents.failure.length == 0 && failureMessage)
            contents.failure.push(failureMessage);

          // summarize our failure
          if (contents.failure.length > 0) {
            result.lastFailure = contents.failure[contents.failure.length - 1];
            result.fail++;
          } else result.pass++;
        }
    }
  }
  return result;
}

/**
 * Delegates to the type specific validator
 *
 * @param validatorType - The name of the validator to execute
 * @param contents - Contents object with { snapshot: string, failure: [string], header: [string] }
 * @param validator - Validator object from the setup
 * @param file - Filename being validated
 * @param cmdOptions Options from the command line (tests, paths).
 * @returns Object with { snapshot: string, failure: string }
 */
function runValidator(validatorType, contents, validator, file, cmdOptions) {
  // delegate to the appropriate validator
  switch (validatorType) {
    case 'xpath':
      validateXPath(contents, validator, file, cmdOptions);
      break;
    case 'text':
      validateText(contents, validator, file, cmdOptions);
      break;
    case 'regex':
      validateRegex(contents, validator, file, cmdOptions);
      break;
    default:
      contents.failure.push(`Unknown validator "${validator.validator}" on "${key}" for "${file}".`);
      break;
  }
}

/**
 * Compare (and manage) snapshots, potentially capturing the new snapshot as current state depending
 * on command line options.
 *
 * @param validatorName Name of the validator
 * @param newSnapshotFile Path to the file that has the new snapshot test results
 * @param baselineSnapshotFile Path to the baseline snapshot (for the baseline snapshot to compare against)
 * @param sourceArtifactFile Path to the source artifact file
 * @param targetArtifactFile Path to copy the source artifact file to, if a snapshot is recorded
 * @param cmdOptions Options from the command line (tests, paths).
 * @returns String with failure message, undefined means success
 */
export function snapshotCompare(
  validatorName,
  newSnapshotFile,
  baselineSnapshotFile,
  sourceArtifactFile,
  targetArtifactFile,
  cmdOptions
) {
  // do we need to look at the baseline snapshot?
  if (cmdOptions.snapshotMode != SNAPSHOT_RESET) {
    // does the baseline snapshot file exist?
    if (fs.existsSync(baselineSnapshotFile)) {
      // load both snapshots
      let newSnapshot = fs.readFileSync(newSnapshotFile, {
        encoding: 'utf-8',
      });
      let baselineSnapshot = fs.readFileSync(baselineSnapshotFile, {
        encoding: 'utf-8',
      });

      // remove all lines that are snapshot comments
      const snapshotFilter = (item) => !item.startsWith(SNAPSHOT_COMMENT_LINE_HEADER);
      newSnapshot = newSnapshot.split('\n').filter(snapshotFilter).join('\n');
      baselineSnapshot = baselineSnapshot.split('\n').filter(snapshotFilter).join('\n');

      // do a diff, which returns console-ready pretty formatting (or undefined if no diffs)
      const changes = prettyDiff(baselineSnapshot, newSnapshot);

      // do we have successful match?  If so, return success
      if (!changes) {
        if (cmdOptions.verbose)
          console.log(chalk.green(`      ${validatorName}: Snapshots match`));

        return undefined;
      }

      // not a match.
      console.log(
        chalk.red(
          `      FAIL ${validatorName}: Snapshots do not match (${path.basename(
            newSnapshotFile
          )})`
        )
      );
      console.log(`      ${changes.replace(/\n/g, '\n      ')}`);
      return `Snapshots do not match (${path.basename(newSnapshotFile)}).`;
    } else {
      if (cmdOptions.snapshotMode == SNAPSHOT_NO_WRITE) {
        console.log(
          chalk.red(
            `      FAIL ${validatorName}: Snapshot does not exist, but snapshot mode disallows creation (see "-s=create")`
          )
        );
        return 'Snapshot does not exist (see "-s=create")';
      }
      console.log(
        chalk.yellow(
          `      ${validatorName}: Baseline snapshot does not exist; saving snapshot.`
        )
      );
    }
  } else
    console.log(
      chalk.yellow(`      ${validatorName}: Resetting snapshot ${path.basename(newSnapshotFile)} to latest.`)
    );

  // overwrite the baseline snapshot with latest, and copy over the artifact
  fs.copyFileSync(newSnapshotFile, baselineSnapshotFile);
  fs.copyFileSync(sourceArtifactFile, targetArtifactFile);

  return undefined;
}

/**
 *
 * @param testSuite Test suite object that the individual test that needs to be executed.
 * @param testSetups Object containing all test setups
 * @param cmdOptions Options from the command line (tests, paths)
 * @returns Object with { pass: number, fail: number, summary: [{ test: string, post: string,
 * lastFailure: string }] }
 */
export function runTest(testSuite, testSetups, cmdOptions) {
  const aggregatedSetups = aggregateSetup(testSuite.setup, testSetups);
  const mergedSetups = mergeSetups(testSuite, aggregatedSetups);
  let headerShown = false;

  const result = { pass: 0, fail: 0, summary: [] };

  for (let postIndex = 0; postIndex < mergedSetups.posts.length; ++postIndex) {
    // validate the setup
    let invalidSetup = undefined;
    if (!mergedSetups.cnc) invalidSetup = `Invalid setup: No CNC defined.`;
    if (mergedSetups.posts.length == 0)
      invalidSetup = `Invalid setup: No "posts" defined.`;

      if (invalidSetup) {
      // invalid setup - so populate the failure details and loop
      result.fail++;
      result.summary.push({
        test: mergedSetups.name,
        post: mergedSetups.posts[postIndex],
        lastFailure: invalidSetup,
      });
      continue;
    }

    // if using post filter(s), make sure the post matches
    if (cmdOptions.postFilter.length > 0) {
      let matchPost = false;
      for (const filter of cmdOptions.postFilter)
        if (
          mergedSetups.posts[postIndex].toLowerCase().includes(filter.toLowerCase())
        ) {
          matchPost = true;
          break;
        }
      if (!matchPost) continue;
    }

    // show test header if not already done
    if (!headerShown) {
      console.log(
        chalk.blue(`Test: "${testSuite.name}" (setup "${testSuite.setup}"):`)
      );
      headerShown = true;
    }
    console.log(chalk.gray(`  Post: ${mergedSetups.posts[postIndex]}`));

    // prepare the test results folder
    const folders = prepStorageFolders(mergedSetups, postIndex, cmdOptions);

    // execute the test
    const passed = runPostProcessor(
      cmdOptions,
      buildPostCommand(mergedSetups, postIndex, cmdOptions, folders.cncPath)
    );

    // did we successfully run the post?
    if (passed) {
      // validate the post results
      const validateResult = validatePostResults(
        mergedSetups,
        postIndex,
        cmdOptions,
        folders.cncPath,
        folders.snapshotPath
      );

      if (validateResult.fail > 0) {
        result.fail++;
        result.summary.push({
          test: mergedSetups.name,
          post: mergedSetups.posts[postIndex],
          lastFailure: validateResult.lastFailure,
        });
      } else {
        result.pass++;
        result.summary.push({
          test: mergedSetups.name,
          post: mergedSetups.posts[postIndex],
          lastFailure: undefined,
        });
      }
    } else {
      result.fail++;
      result.summary.push({
        test: mergedSetups.name,
        post: mergedSetups.posts[postIndex],
        lastFailure: 'Post-processor failed to execute.',
      });
    }
  }

  return result;
}

/**
 * Runs all tests that match the test criteria
 *
 * @param testSuites Object with all possible test suites
 * @param cmdOptions Options from the command line (tests, paths)
 * @returns Object with { pass: number, fail: number, summary: [{ test: string, post: string,
 * lastFailure: string }] }
 */
export function runTests(testSuites, cmdOptions) {
  const summary = { pass: 0, fail: 0, summary: [] };

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
      summary.summary.push(...result.summary);
    }
  }
  return summary;
}
