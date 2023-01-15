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

import xpath from 'xpath';
import dom from 'xmldom-qsa';
import chalk from 'chalk';
import { MATCH_FORBIDDEN, MATCH_OPTIONAL, MATCH_REQUIRED, SNAPSHOT_COMMENT_LINE_HEADER } from './globals.js';

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
export function validateXMLPathHandleError(type, message) {
  if (!validateXMLPathError) console.error(chalk.red('    FAIL: XML file failed to parse:'));

  console.error(chalk.red(`      ${type}: ${message.replace(/\n/g, '\n      ')}`));
  validateXMLPathError = true;
}
/**
 * Execute the XPath based validator.  The validator setup must include the `xpath` property, which
 * can be set to a single xpath query, or an array of xpath queries.  The query can be a single
 * string (which defaults 'match' to 'required'), or an object that can include { query: string,
 * match: "required|optional|forbidden" }.  The validator setup may also include an array of
 * `namespaces` to define XML namespaces (`"namespaces": { "svg": "http://www.w3.org/2000/svg" }`).
 *
 * @param contents - Contents from the generated file
 * @param validator - Validator object from the setup
 * @param file - Filename being validated
 * @param cmdOptions Options from the command line (tests, paths).
 * @returns Object with { snapshot: string, failure: string }
 */
export function validateXPath(contents, validator, file, cmdOptions) {
  let snapshot = '';
  let failure = undefined;

  // make sure we have a valid xpath specification
  if (validator.xpath) {
    // set up an array for the xpath property, converting a single string to an array
    const xpathArray = Array.isArray(validator.xpath)
      ? validator.xpath
      : [validator.xpath];

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
    }).parseFromString(contents, 'application/xml');

    // fail if we had a parsing problem
    if (validateXMLPathError)
      return { snapshot: `Unable to parse XML file`, failure: `Unable to parse XML file` };

    // process the queries
    for (const xpathQuery of xpathArray) {
      // unify the query to be an object with { query, match } values
      let queryObject =
        typeof xpathQuery === 'string'
          ? { query: xpathQuery, match: MATCH_REQUIRED }
          : { query: xpathQuery.query, match: xpathQuery.match?.toLowerCase() ?? MATCH_REQUIRED };

      if (cmdOptions.verbose) {
        console.log(chalk.gray(
          `    Processing query "${queryObject.query}" (${
            queryObject.match
          }):`
        ));
      }
      snapshot += `${SNAPSHOT_COMMENT_LINE_HEADER}\n`;
      snapshot += `${SNAPSHOT_COMMENT_LINE_HEADER} XPath query "${queryObject.query}" (${
        queryObject.match 
      })\n`;
      snapshot += `${SNAPSHOT_COMMENT_LINE_HEADER}\n`;

      switch (queryObject.match) {
        case MATCH_REQUIRED:
        case MATCH_FORBIDDEN:
        case MATCH_OPTIONAL:
          break;
        default:
          console.log(chalk.gray(
            `    Processing query "${queryObject.query}:`
          ));
          console.error(chalk.red(
            `      FAIL: Unknown "match" value of "${queryObject.match}".`
          ));
          failure = `Unknown "match" value of "${queryObject.match}".`;
          snapshot += `  FAIL: Unknown "match" value of "${queryObject.match}".\n`;
          continue;
      }

      try {
        // register any required namespaces
        const select = xpath.useNamespaces(validator.namespaces);

        // and execute the query
        const nodes = select(queryObject.query, xmlDoc);
        if (nodes.length == 0 && queryObject.match == MATCH_REQUIRED) {
          console.log(chalk.gray(
            `    Processing query "${queryObject.query}" (required):`
          ));
          console.error(chalk.red(
            `      FAIL: Required query did not match any elements`
          ));
          failure = `Required query "${queryObject.query}" did not match any elements.`;
          snapshot += `  FAIL: Required query "${queryObject.query}" did not match any elements.\n`;
          continue;
        }
        if (nodes.length != 0 && queryObject.match == MATCH_FORBIDDEN) {
          console.log(chalk.gray(
            `    Processing query "${queryObject.query}" (forbidden):`
          ));
          console.error(chalk.red(
            `      FAIL: Forbidden query matched ${nodes.length} elements`
          ));
          failure = `Forbidden query "${queryObject.query}" matched ${nodes.length} elements.`;
          snapshot += `  FAIL: Forbidden query "${queryObject.query}" match ${nodes.length} elements.\n`;
          continue;
        }

        if (cmdOptions.verbose)
          console.log(chalk.gray(`      ${nodes.length} elements max XPath query`));

        // add the results to the snapshot
        for (const node of nodes) {
          snapshot += node.toString();
          // make sure snapshot has a newline at the end
          if (snapshot.slice(-1) != '\n') snapshot += '\n';
        }
      } catch (ex) {
        console.error(chalk.red(
          `    FAIL: Failed to parse XPath query "${queryObject.query}"`
        ));
        failure = `Failed to parse XPath query "${queryObject.query}".`;
        snapshot += `  FAIL: Failed to parse XPath query "${queryObject.query}".`;
      }
    }
  } else {
    console.error(chalk.red(
      `    FAIL: XPath validator setup missing required "xpath" property.`
    ));
    return {
      snapshot: `FAIL: XPath validator setup missing required "xpath" property.`,
      failure: `XPath validator setup missing required "xpath" property.`,
    };
  }
  return { snapshot, failure };
}
