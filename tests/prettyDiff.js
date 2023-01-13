/**
 *
 * Diffs two strings and generates a pretty (color) result in GitHub style
 * if they do not match.
 * 
 * Original version: https://github.com/IonicaBizau/node-line-diff
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

import { diffLines } from 'diff';
import chalk from 'chalk';

function log(value) {
  result += value + '\n';
}

function logMulti(lines, color) {
  lines.forEach((line) => log(color(line)));
}

let result;

const defaultOptions = {
  hideLines: true,
  maxAdjacentStaticLines: 2,
};

// Prefixes
const PREFIX_ADD = '+  ';
const PREFIX_REMOVE = '-  ';
const PREFIX_STATIC = '   ';
const PREFIX_MORE = '@@ ';

// Apply prefixes
function replaceLine(part) {
  return (item) => {
    const { added, removed } = part;
    if (added) return PREFIX_ADD + item;
    else if (removed) return PREFIX_REMOVE + item;
    else return PREFIX_STATIC + item;
  };
}

// If necessary, shorten the lines
function logStaticPart(part, options) {
  const { lines, count } = part;
  const { maxAdjacentStaticLines } = options;
  if (
    count > maxAdjacentStaticLines &&
    count - 2 * maxAdjacentStaticLines > 1
  ) {
    log(chalk.gray(lines.slice(0, maxAdjacentStaticLines).join('\n')));
    log(
      chalk.blue(
        PREFIX_MORE + (count - 2 * maxAdjacentStaticLines) + ' more lines'
      )
    );
    log(chalk.gray(lines.slice(-maxAdjacentStaticLines).join('\n')));
  } else {
    logMulti(lines, chalk.gray);
  }
}

function diff(previous, next, options) {
  // Apply overrides
  options = { ...defaultOptions, ...options };

  result = '';

  // Diff
  const diff = diffLines(previous + '\n', next + '\n');

  // did anything change?
  if (diff.length == 1 && !diff[0].added && !diff[0].removed) return undefined;

  // Split multiple lines
  const newDiff = diff.map((part) => {
    const { added, removed, value, count } = part;
    const lines = value.split('\n').slice(0, -1).map(replaceLine(part));
    return { added, removed, lines, count };
  });

  // Finally do the logging
  newDiff.forEach((part) => {
    const { lines, added, removed } = part;
    if (!options.hideLines || added || removed) {
      if (added) logMulti(lines, chalk.green);
      else if (removed) logMulti(lines, chalk.red);
      else logMulti(lines, chalk.gray);
    } else {
      logStaticPart(part, options);
    }
  });

  return result.substring(0, result.length - 1);
}

export default diff;
