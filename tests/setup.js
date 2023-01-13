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


/**
 * Merges setup information from the tests.json file (setup and test section) such that the top-most
 * setup wins on conflicts (to allow for overriding settings)
 *
 * @param setup Setup object (most current, top level)
 * @param parentSetup Setup object from the parent (items are included only if not overriden by setup)
 * @returns Merged new setup object
 */
export function mergeSetups(setup, parentSetup) {
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
  console.error(`Fatal: Unable to locate setup ${setupName}`);
  process.exit(-1);
}
