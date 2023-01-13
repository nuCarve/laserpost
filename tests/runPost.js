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

import path from 'node:path';
import cp from 'node:child_process';

/**
 * Build the command line arguments for the Autodesk post procesor
 *
 * @param setup Setup to use for the command line arguments
 * @param postNumber Index into which post should be generated
 * @param cmdOptions Options from the command line (tests, paths)
 * @param cncPath Path to the transferred CNC file (in the test results folder)
 * @returns Array of command line options consistent with process.spawn
 */
export function buildPostCommand(setup, postNumber, cmdOptions, cncPath) {
  // process all options
  const optionsArray = [];
  for (const option in setup.options) {
    const entry = setup.options[option];

    if (entry)
      if (typeof entry === 'string') optionsArray.push(entry);
      else optionsArray.push(...entry);
  }

  // process all properties
  const propertiesArray = [];
  for (const property in setup.properties) {
    const value = setup.properties[property];

    if (value !== null) propertiesArray.push(`--property`, property, value);
  }

  return [
    ...optionsArray,
    ...propertiesArray,
    `${path.resolve(cmdOptions.cpsPath, setup.posts[postNumber])}.cps`,
    `${path.resolve(cncPath, setup.cnc)}.cnc`,
  ];
}

/**
 * Executes a single Autodesk post operation.
 *
 * @param cmdOptions Options from the command line (tests, paths)
 * @param cmdArguments Command line arguments for the post processor (see buildPostCommand)
 * @returns `true` if successful, `false` if it fails to work. May terminate process on fatal
 * errors.
 */
export function runPostProcessor(cmdOptions, cmdArguments) {
  // spawn the post-processor
  const result = cp.spawnSync(cmdOptions.postPath, cmdArguments, {
    shell: true,
    cwd: process.cwd(),
    env: process.env,
    stdio: 'pipe',
    encoding: 'utf-8',
  });

  // was the execution successful?
  if (result.status == 0) {
    if (cmdOptions.verbose) {
      console.log(`Stdout: ${result.stdout}`);
      console.log(`Stderr: ${result.stderr}`);

      console.log(`\nCommand line executed:`);
      console.log(`${cmdOptions.postPath} ${cmdArguments.join(' ')}`);
      console.log();
    }
    return true;
  }

  // it failed - determine reason to decide if fatal or warning
  if (result.status == 1) {
    console.log(`Post-processor did not execute:\n${result.stderr}`);
  } else {
    console.log(`Post ran, but had error ${result.status}: ${result.stderr}`);
  }
  if (cmdOptions.verbose) {
    console.log(`\nCommand line executed:`);
    console.log(`${cmdOptions.postPath} ${cmdArguments.join(' ')}`);
    console.log();
  }

  // terminate on fatal executions
  if (result.status == 1) process.exit(-1);
  return false;
}
