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
 * Execute the regex based validator.  Supports the 'regex' property with the expression to match,
 * and the 'replace' property (text to replace the match with in the original content stream), 
 * the 'require' property (which is string or an array, with one element for each matching parameter, such as
 * { regex: "Document mode: (\w+)", require: ["inch"] }), and the 'forbidden' property (boolean).
 *
 * @param contents - Contents object with { snapshot: string, failure: [string], header: [string] }
 * @param validator - Validator object from the setup
 * @param file - Filename being validated
 * @param cmdOptions Options from the command line (tests, paths).
 */
export function validateRegex(contents, validator, file, cmdOptions) {
  // unify validator.regex to an array
  let regexArray = Array.isArray(validator.regex)
    ? validator.regex
    : [validator.regex];

  // execute all expressions
  for (const filter of regexArray) {
    let expression;

    // describe this regex
    contents.header.push('  RegEx validator:');
    contents.header.push(`    Regular expression: "${filter.regex}"`);

    // set up the regex expression
    try {
      expression = new RegExp(filter.regex, 'gm');
    } catch (e) {
      contents.failure.push(`FAIL: Regular expression "${filter.regex}" invalid.`);
      contents.failure.push(`      error: ${e}`);
    }

    // handle the "replace" use case
    if (filter.replace) {
      contents.header.push(`    Replace: ${filter.replace}`);
      contents.snapshot = contents.snapshot.replace(expression, filter.replace);
    }

    // handle theh "forbidden" use case
    if (filter.forbidden) {
      const match = contents.snapshot.match(new RegExp(filter.regex, "m"));
      if (match) {
        contents.failure.push(`FAIL: Regular expression "${filter.regex}" is "forbidden" yet matched ${match.length} items.`);
        continue;
      }
    }

    // handle the "require" use case
    if (filter.require) {
      const requireArray = Array.isArray(filter.require)
        ? filter.require
        : [filter.require];

      const match = contents.snapshot.match(new RegExp(filter.regex, "m"));
      if (match) {
        if (requireArray.length != match.length - 1) {
          contents.failure.push(`FAIL: Regular expression "${filter.regex}" parameters are inconsistent with "require" properties.`);
          continue;
        }
        for (
          let requireIndex = 0;
          requireIndex < requireArray.length;
          ++requireIndex
        ) {
          contents.header.push(`    Match (${requireIndex + 1}): ${requireArray[requireIndex]}`);

          if (
            requireArray[requireIndex].toLowerCase() !=
            match[requireIndex + 1].toLowerCase()
          ) {
            contents.failure.push(`FAIL: "require" regular expression "${
              filter.regex
            }" had "${match[requireIndex + 1]}" when expecting "${
              requireArray[requireIndex]
            }".`);
            continue;
          }
        }
      } else {
        contents.failure.push(`FAIL: "require" regular expression "${filter.regex}" failed to find a match.`);
        continue;
      }
    }
  }
}
