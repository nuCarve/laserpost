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
import fs from 'node:fs';
import path from 'node:path';

/**
 * Execute the regex based validator.  Supports the 'regex' property with the expression to match,
 * and the 'replace' property (text to replace the match with in the original content stream), and
 * the 'require' property (which is an array, with one element for each matching parameter, such as
 * { regex: "Document mode: (\w+)", require: ["inch"] })
 *
 * @param contents - Contents from the generated file
 * @param validator - Validator object from the setup
 * @param file - Filename being validated
 * @param cmdOptions Options from the command line (tests, paths).
 * @returns Object with { snapshot: string, failure: string }
 */
export function validateRegex(contents, validator, file, cmdOptions) {
  let result = { snapshot: contents, failure: undefined };

  let regexArray = Array.isArray(validator.regex)
    ? validator.regex
    : [validator.regex];

  // execute all expressions
  for (const filter of regexArray) {
    let expression;

    // set up the regex expression
    try {
      expression = new RegExp(filter.regex, 'gm');
    } catch (e) {
      console.error(
        chalk.red(`      FAIL: Regular expression "${filter.regex}" invalid.`)
      );
      console.error(chalk.red(`      ${e}`));
      result.failure = `FAIL: Regular expression "${filter.regex}" invalid.`;
    }

    // handle the "replace" use case
    if (filter.replace)
      result.snapshot = result.snapshot.replace(expression, filter.replace);

    // handle the "require" use case
    if (filter.require) {
      const requireArray = Array.isArray(filter.require)
        ? filter.require
        : [filter.require];

      const match = result.snapshot.match(new RegExp(filter.regex, "m"));
      if (match) {
        if (requireArray.length != match.length - 1) {
          // error - incorrect number of matches
          console.error(
            chalk.red(
              `      FAIL: Regular expression "${filter.regex}" parameters are inconsistent with "require" properties.`
            )
          );
          result.failure = `FAIL: Regular expression "${filter.regex}" parameters are inconsistent with "require" properties.`;
          continue;
        }
        for (
          let requireIndex = 0;
          requireIndex < requireArray.length;
          ++requireIndex
        ) {
          if (
            requireArray[requireIndex].toLowerCase() !=
            match[requireIndex + 1].toLowerCase()
          ) {
            // error - regex matches but incorrect value 
            console.error(
              chalk.red(
                `      FAIL: "require" regular expression "${
                  filter.regex
                }" had "${match[requireIndex + 1]}" when expecting "${
                  requireArray[requireIndex]
                }".`
              )
            );
            result.failure = `FAIL: "require" regular expression "${
              filter.regex
            }" had "${match[requireIndex + 1]}" when expecting "${
              requireArray[requireIndex]
            }".`;
            continue;
          }
        }
      } else {
        // error - element does not match
        console.error(
          chalk.red(
            `      FAIL: "require" regular expression "${filter.regex}"failed to find a match.`
          )
        );
        result.failure = `FAIL: "require" regular expression "${filter.regex}" failed to find a match.`;
        continue;
      }
    }
  }

  return result;
}
