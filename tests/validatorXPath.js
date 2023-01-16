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
 * Handler for XMLDOM errors.  Called via callback when the DOM experiences an error.  Updates the
 * failure diagnostics, and sets the global `validateXMLPathError` to `true` to provide the error
 * back to the calling code.
 *
 * @param type - String with the type of error (such as "Error")
 * @param message - String (multi-line supported) with the error message
 * @param contents - Contents object with { snapshot: string, failure: [string], header: [string] }
 */
export function validateXMLPathHandleError(type, message, contents) {
  if (!validateXMLPathError) contents.failure.push('FAIL: XML file failed to parse:');
  contents.failure.push(`      ${type}: ${message.replace(/\n/g, '\n      ')}`);
  validateXMLPathError = true;
}
/**
 * Execute the XPath based validator.  The validator setup must include the `xpath` property, which
 * can be set to a single xpath query, or an array of xpath queries.  The query can be a single
 * string (which defaults 'match' to 'required'), or an object that can include { query: string,
 * match: "required|optional|forbidden" }.  The validator setup may also include an array of
 * `namespaces` to define XML namespaces (`"namespaces": { "svg": "http://www.w3.org/2000/svg" }`).
 *
 * @param contents - Contents object with { snapshot: string, failure: [string], header: [string] }
 * @param validator - Validator object from the setup
 * @param file - Filename being validated
 * @param cmdOptions Options from the command line (tests, paths).
 * @returns Object with { snapshot: string, failure: string }
 */
export function validateXPath(contents, validator, file, cmdOptions) {
  // cache the snapshot and clear the contents.snapshot as we will form a new content body
  const originalSnapshot = contents.snapshot;
  contents.snapshot = '';

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
        warning: (m) => validateXMLPathHandleError('Warning', m, contents),
        error: (m) => validateXMLPathHandleError('Error', m, contents),
        fatalError: (m) => validateXMLPathHandleError('Fatal error', m, contents),
      },
    }).parseFromString(originalSnapshot, 'application/xml');

    // fail if we had a parsing problem (validateXMLPathHandleError will have updated failure info
    // in contents)
    if (validateXMLPathError)
      return;

    // process the queries
    for (const xpathQuery of xpathArray) {
      // unify the query to be an object with { query, match } values
      let queryObject =
        typeof xpathQuery === 'string'
          ? { query: xpathQuery, match: MATCH_REQUIRED }
          : { query: xpathQuery.query, match: xpathQuery.match?.toLowerCase() ?? MATCH_REQUIRED };

      // add this query to the header
      contents.header.push(`  XPath validator:`);
      contents.header.push(`    Query: "${queryObject.query}"`);
      contents.header.push(`    Match: ${queryObject.match}`);

      switch (queryObject.match) {
        case MATCH_REQUIRED:
        case MATCH_FORBIDDEN:
        case MATCH_OPTIONAL:
          break;
        default:
          contents.failure.push(`Unknown "match" value of "${queryObject.match}".`);
          continue;
      }

      try {
        // register any required namespaces
        const select = xpath.useNamespaces(validator.namespaces);

        // and execute the query
        const nodes = select(queryObject.query, xmlDoc);
        if (nodes.length == 0 && queryObject.match == MATCH_REQUIRED) {
          contents.failure.push(`Required query "${queryObject.query}" did not match any elements.`);
          continue;
        }
        if (nodes.length != 0 && queryObject.match == MATCH_FORBIDDEN) {
          contents.failure.push(`Forbidden query "${queryObject.query}" matched ${nodes.length} elements.`);
          continue;
        }

        // add the results to the snapshot
        for (const node of nodes) {
          contents.snapshot += node.toString();
          // make sure snapshot has a newline at the end
          if (contents.snapshot.slice(-1) != '\n') contents.snapshot += '\n';
        }
      } catch (ex) {
        contents.failure.push(`Failed to parse XPath query "${queryObject.query}".`);
      }
    }
  } 
}
