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

/**
 * Merges setup information from the tests.json file (setup and test section) such that the top-most
 * setup wins on conflicts (to allow for overriding settings).  Descends deeper into the validators
 * setup to merge at the property level within a validator.
 *
 * @param setup Setup object (most current, top level)
 * @param parentSetup Setup object from the parent (items are included only if not overriden by setup)
 * @returns Merged new setup object
 */
export function mergeSetups(setup, parentSetup) {
  const result = {};

  // define a result setup that duplicates defaults from our setup first, and then our parent setup
  // if the property is not defined
  result.posts = setup.posts ?? parentSetup.posts ?? [];
  result.cnc = setup.cnc ?? parentSetup.cnc ?? '';
  result.machine = setup.machine ?? parentSetup.machine ?? undefined;
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

  // descend into child validators and transfer
  if (parentSetup.validators) {
    for (const parentValidator in parentSetup.validators) {
      // If nothing our our new setup, transfer over whatever the parent has
      if (
        !setup.validators ||
        !setup.validators.hasOwnProperty(parentValidator)
      ) {
        result.validators[parentValidator] =
          parentSetup.validators[parentValidator];
      } else {
        // descend one more level - to allow overridding of individual properties such as
        // post, file, validator (and validator specific props like regex and xpath)
        for (const parentValidatorProp in parentSetup.validators[
          parentValidator
        ]) {
          // if our setup doesn't have the property, transfer it over from parent
          if (
            !setup.validators[parentValidator].hasOwnProperty(
              parentValidatorProp
            )
          ) {
            result.validators[parentValidator][parentValidatorProp] =
              parentSetup.validators[parentValidator][parentValidatorProp];
          } else {
            // is this an array?  If so, merge at the array level
            if (
              Array.isArray(
                setup.validators[parentValidator][parentValidatorProp]
              ) &&
              Array.isArray(
                result.validators[parentValidator][parentValidatorProp]
              )
            ) {
              // make a new array that is the parent array first, then our result array
              result.validators[parentValidator][parentValidatorProp] = [
                ...parentSetup.validators[parentValidator][parentValidatorProp],
                ...result.validators[parentValidator][parentValidatorProp],
              ];
            }
          }
        }
      }
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
export function aggregateSetup(setupName, testSetups) {
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
  console.error(chalk.red(`Fatal: Unable to locate setup ${setupName}`));
  process.exit(-1);
}
