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

/**
 * Execute the text based validator.  The validator setup may include a "filter" property
 * which is an array of `[{ regex: string, replace: string }, ...]` which will execute the regex
 * (globally) and replace all matches with the `replace` string.
 *
 * @param validator - Validator object from the setup
 * @param cncPath - Path to the cnc folder
 * @param file - Filename being validated
 * @param cmdOptions Options from the command line (tests, paths).
 * @returns Object with { snapshot: string, success: boolean }
 */
export function validateText(validator, cncPath, file, cmdOptions) {
    // read the text file without changes as our snapshot
    let snapshot = fs.readFileSync(path.resolve(cncPath, file), {
      encoding: 'utf-8',
    });
  
    // process filters if specified
    if (validator.filter) {
      // support a single object, or an array of objects
      let filterArray = Array.isArray(validator.filter)
        ? validator.filter
        : [validator.filter];
  
      // execute all filters
      for (const filter of filterArray) {
        try {
          snapshot = snapshot.replace(
            new RegExp(filter.regex, 'gm'),
            filter.replace
          );
        } catch (e) {
          console.error(
            `      FAIL: Regular expression ${filter} invalid.`
          );        
          console.error(
            `      ${e}`
          );
          return false;
        }
      }
    }
    return { snapshot, success: true };
  }
  
  