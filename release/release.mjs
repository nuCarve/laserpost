/**
 * Copyright (C) 2022 nuCarve
 * All rights reserved.
 *
 * Release manager for LaserPost
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
 *
 * Additional license and attribution requrements are included in subsections below.
 */

/*
 * Simple release manager for LaserPost.
 *
 * Takes all files listed in `sourceFiles` and merges them in order, and
 * performing a substitution of `VERSION_TAG` (`'0.0.0-version'`) with the
 * version number contained in a `version.json` file.
 *
 * See README.md for more information.
 */

import fsp from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import * as url from 'node:url';

// array of source files to merge, in order
const sourceFiles = [
  'laserpost.js',
  'constants.js',
  'globals.js',
  'formatters.js',
  'camProperties.js',
  'camHandlers.js',
  'camConversion.js',
  'lightburn.js',
  'updates.js',
  'xml.js',
  'xmlState.js',
  'debug.js',
  'arcToBezier.js',
];

// determine the directory that holds the release project
const releasePath = url.fileURLToPath(new URL('.', import.meta.url));
// define paths and filenames used for source and targets
const sourcePath = path.resolve(releasePath, '..', 'src');
const distPath = path.resolve(releasePath, 'dist');
const releaseFilePath = path.resolve(distPath, 'laserpost.cps');
// path to a JSON file that contains the version number to substitute when the version tag (VERSION_TAG) is found
const versionFile = path.resolve(releasePath, 'version.json');
// unique tag in files to substitute with the version number
const VERSION_TAG = /0.0.0-version/g;

/**
 * Handle processing of macros in the source file.  Macros are:
 *
 * // #if <MACRO>
 * // #else
 * // #endif
 *
 * Simple macro nesting is supported (#if A ... #if B... #endif ... #endif).
 *
 * Macros can also have values, where any matching string value will be replaced with the value.  Only
 * macros that have values are processed.  Be careful the name isn't used in any other context as everything
 * is substituted (including inside strings).
 *
 * @param source Full source with conditional macros as an array of strings, one per line
 * @param macros Array of macro objects, with { name: <macro name>, value: <optional macro value to substitute>}
 * @returns String array with updated source
 */
function processMacros(source, macros) {
  // do simple macro substitutions (for macro=value style macros)
  for (const lineIndex in source) {
    let line = source[lineIndex];
    for (const macro of macros)
      if (macro.value)
        line = source[lineIndex].replace(macro.name, macro.value);
    source[lineIndex] = line;
  }

  // now handle the if/else/endif macros
  let activeMacros = [];
  for (const lineIndex in source) {
    let line = source[lineIndex];
    let removeLine = false;

    // is this a macro line?  Machines any sequence that is "// #if NAME", "// #else" and "// #endif"
    const matches = line.match(/\/\/\s*#(?:(if)\s+(\w*)|(else)|(endif))/);
    if (matches) {
      const condition = matches[1] || matches[3] || matches[4];
      const macroName = matches[2];

      switch (condition.toLowerCase()) {
        case 'if':
          // did our parent already exclude us?
          if (
            activeMacros.length == 0 ||
            activeMacros[activeMacros.length - 1].include
          ) {
            let macroInclude = false;
            for (const macro of macros) {
              if (macro.name == macroName.toUpperCase()) {
                macroInclude = true;
                break;
              }
            }
            // save this macro with state based on if it is known or not
            activeMacros.push({
              name: macroName,
              include: macroInclude,
              primary: true,
              parentDisabled: false,
            });
          }
          // our parent disabled us, so always disable this macro
          else {
            console.log(
              'parent disabled: ' + activeMacros[activeMacros.length - 1].name
            );
            activeMacros.push({
              name: macroName,
              include: false,
              primary: true,
              parentDisabled: true,
            });
          }
          break;
        case 'else':
          if (activeMacros.length == 0) {
            console.log(`#else found, yet no open macros`);
            process.exit(-1);
          }
          if (!activeMacros[activeMacros.length - 1].primary) {
            console.log(
              `More than one #else found for macro ${
                activeMacros[activeMacros.length - 1].name
              }`
            );
            process.exit(-1);
          }
          // flip our state
          activeMacros[activeMacros.length - 1].primary = false;
          if (!activeMacros[activeMacros.length - 1].parentDisabled)
            activeMacros[activeMacros.length - 1].include =
              !activeMacros[activeMacros.length - 1];
          // disabled by parent
          else activeMacros[activeMacros.length - 1].include = false;
          break;
        case 'endif':
          if (activeMacros.length == 0) {
            console.log(`#endif found with no open macros`);
            process.exit(-1);
          }
          // close this macro
          activeMacros.pop();
          break;
      }
      // mark this specific line for removal
      removeLine = true;

    }

    // remove this line if not allowed (or this line is marked for removal)
    if (
      (activeMacros.length > 0 &&
        !activeMacros[activeMacros.length - 1].include) ||
      removeLine
    )
      source[lineIndex] = undefined;
  }

  // do we have any unresolved macros?
  if (activeMacros.length > 0) {
    console.log(
      `Unclosed macro(s) found, most recent "${
        activeMacros[activeMacros.length - 1].name
      }"`
    );
    process.exit(-1);
  }

  return source;
}

/**
 * Writes the source array (of source lines) to the specified file path, overwriting any file there.
 * 
 * @param source Array of strings to write, ignoring any undefined entry
 * @param path Path to write to
 */
function writeSource(source, path) {
  const output = fs.createWriteStream(path);
  for (const line of source)
    if (line !== undefined)
      output.write(line + '\n');
  output.end();
}

/**
 * Release LaserPost by merging a series of source files into a single file, and performing
 * substitution of version numbers.
 *
 * @param duplicatePath - optional, if defined a duplicate of the generated file is copied to this path.
 */
async function release(macros, duplicatePath) {
  // load the version info
  const version = JSON.parse(await fsp.readFile(versionFile));

  // load all into an array of strings
  let releaseSource = [];
  for (let sourceFile of sourceFiles) {
    let lastLineIsBlank = false;
    const file = await fsp.open(path.resolve(sourcePath, sourceFile));
    for await (const line of file.readLines()) {
      releaseSource.push(line);
      lastLineIsBlank = (line.trim() == '');
    }
    // add a blank line if missing from last line of source
    if (!lastLineIsBlank)
      releaseSource.push('');
  }

  // add the version to our macros
  macros.push({ name: VERSION_TAG, value: version.version });
  // handle all macros
  releaseSource = processMacros(releaseSource, macros);

  // make sure target directory exists, and write the release source
  if (await fsp.access(distPath)) await fsp.mkdir(distPath);
  writeSource(releaseSource, releaseFilePath);

  // build up a list of macros used to help with debug output
  let macrosUsed = '';
  macros.forEach((macro) => {
    if (macrosUsed != '') macrosUsed += ', ';
    macrosUsed += macro.name;
    if (macro.value) macrosUsed += '=' + macro.value;
  });

  // tell the user what we are doing
  console.log(`Released version ${version.version}:`);
  console.log(`  Macros: ${macrosUsed}`);
  console.log(`  Path: ${releaseFilePath}`);

  // is a duplicate requested?
  if (duplicatePath) {
    writeSource(releaseSource, duplicatePath);
    console.log(`  Duplicate: ${duplicatePath}`);
  }
}

// decode the command line options
let duplicatePath = undefined;
const macros = [];

for (let cmdIndex = 2; cmdIndex < process.argv.length; ++cmdIndex) {
  // is this a flag?
  if (process.argv[cmdIndex].startsWith('-')) {
    const flag = process.argv[cmdIndex];
    switch (flag[1].toLowerCase()) {
      case 'f':
        if (flag[2] != '=') {
          console.log(`Missing file path on ${flag}`);
          process.exit(-1);
        }
        duplicatePath = flag.substring(3);
        break;
      default:
        console.log(`Unknown command line flag: ${flag}`);
        process.exit(-1);
    }
  } else {
    let name;
    let value = undefined;

    const macro = process.argv[cmdIndex];
    const equals = macro.indexOf('=');

    if (equals >= 0) {
      name = macro.substring(0, equals);
      value = macro.substring(equals + 1);
    } else name = macro;
    if (name.length == 0) {
      console.log(`Missing macro name: ${macro}`);
      process.exit(-1);
    }
    macros.push({ name: name.toUpperCase(), value });
  }
}

// validate we received at least one macro definition
if (macros.length == 0) {
  console.log('You must specify at least one target.');
  console.log(
    'For example, "release lbrn" or "release svg -f <path-to-directory-for-duplicate-copy>'
  );
  process.exit(-1);
}
// start the release
await release(macros, duplicatePath);
