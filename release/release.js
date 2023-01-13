/**
 * Copyright (C) 2023 nuCarve
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
 */

/*
 * Simple release manager for LaserPost.
 *
 * Combines JS files into a single file, including support for simple macro variable
 * substitution and macro-based conditional code inclusion.  Configuration is defined
 * in the release.json file and augmented with command line options.
 *
 * See README.md for more information.
 */

import fsp from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import * as url from 'node:url';

/**
 * Searches all macros for a specified named macro.
 *
 * @param macros Array of macros
 * @param name Macro to locate
 * @returns Macro object found, or undefined if not located
 */
function findMacro(macros, name) {
  for (const macro of macros) {
    if (macro.name.toUpperCase() == name.toUpperCase()) return macro;
    return undefined;
  }
}

/**
 * Sets up paths to the release.json file, source files, and the path for the release distribution files
 *
 * @returns Object with resolved paths
 */
function setupFilePaths() {
  // determine the directory that holds the release project
  const releasePath = url.fileURLToPath(new URL('.', import.meta.url));

  // define paths and filenames used for source and targets
  const sourcePath = path.resolve(releasePath, '..', 'src');
  const distPath = path.resolve(releasePath, 'dist');

  // path to a JSON file that contains the release setup information
  const releaseJsonPath = path.resolve(releasePath, 'release.json');

  return { releaseJsonPath, sourcePath, distPath };
}

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
  console.log("processMacros: " + JSON.stringify(macros));
  // do simple macro substitutions (for macro=value style macros)
  for (const lineIndex in source) {
    let line = source[lineIndex];
    for (const macro of macros)
      if (macro.value)
        line = line.replace(macro.name, macro.value);
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
            let macroInclude = findMacro(macros, macroName) !== undefined;

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
              !activeMacros[activeMacros.length - 1].include;
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
  for (const line of source) if (line !== undefined) output.write(line + '\n');
  output.end();
}

/**
 * Release LaserPost by merging a series of source files into a single file
 *
 * @param sourcePath - Path to where source files are located
 * @param sourceFiles - Object array with source files and macro conditions
 * @param distPath - Path to the distribution folder
 * @param targetFilename - Filename for the source in the distribution folder
 * @param macros - Array of macro objects for conditional and substitution
 * @param duplicatePath - optional, if defined a duplicate of the generated file is copied to this path.
 */
async function release(
  sourcePath,
  sourceFiles,
  distPath,
  targetFilename,
  macros,
  duplicatePath
) {
  // load all into an array of strings
  let releaseSource = [];
  for (let sourceFile of sourceFiles) {
    let lastLineIsBlank = false;
    // does this file require a macro to be included?
    if (sourceFile.macro !== undefined) {
      if (!findMacro(macros, sourceFile.macro)) continue;
    }

    // read in all lines from the file
    const file = await fsp.open(path.resolve(sourcePath, sourceFile.file));
    for await (const line of file.readLines()) {
      releaseSource.push(line);
      lastLineIsBlank = line.trim() == '';
    }
    // add a blank line if missing from last line of source
    if (!lastLineIsBlank) releaseSource.push('');
  }

  // handle all macros
  releaseSource = processMacros(releaseSource, macros);

  // make sure target directory exists, and write the release source
  if (await fsp.access(distPath)) await fsp.mkdir(distPath);
  const releaseFilePath = path.resolve(distPath, targetFilename);
  writeSource(releaseSource, releaseFilePath);

  // build up a list of macros used to help with debug output
  let macrosUsed = '';
  macros.forEach((macro) => {
    if (macrosUsed != '') macrosUsed += ', ';
    macrosUsed += macro.name;
    if (macro.value) macrosUsed += '=' + macro.value;
  });

  // tell the user what we are doing
  console.log(`Released ${targetFilename}:`);
  console.log(`  Macros: ${macrosUsed}`);
  console.log(`  Path: ${releaseFilePath}`);

  // is a duplicate requested?
  if (duplicatePath) {
    const duplicateFilePath = path.resolve(duplicatePath, targetFilename);
    writeSource(releaseSource, duplicateFilePath);
    console.log(`  Duplicate: ${duplicateFilePath}`);
  }
}

/**
 * Parse command line arguments.  None are required.  Arguments are a list of macros, optionally
 * with a substitution value (`macro`, `macro=value`) and the one switch option `-d` to specify a duplicate
 * path for the target file.
 *
 * @returns Object containing `macros` (array of macro objects) and `duplicatePath` if the -f option used
 */
async function parseArgs() {
  // decode the command line options
  let duplicatePath = process.env.AUTODESK_CAMPOSTS ?? undefined;
  const macros = [];

  for (let cmdIndex = 2; cmdIndex < process.argv.length; ++cmdIndex) {
    // is this a flag?
    if (process.argv[cmdIndex].startsWith('-')) {
      const flag = process.argv[cmdIndex];
      switch (flag[1].toLowerCase()) {
        case 'd':
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
  return { macros, duplicatePath };
}

/**
 * Loads the release.json file
 *
 * @param releaseJsonPath - Path to the release.json file
 * @returns Object with release info
 */
async function loadJson(releaseJsonPath) {
  // load the release json file
  const releaseJson = JSON.parse(await fsp.readFile(releaseJsonPath));

  return releaseJson;
}

/**
 * Updates each targets macros to include the global shared macros as well as the command line macros
 *
 * @param releaseJson release.json file object, for access to the global macros and the target list
 * @param cmdlineMacros macros defined on the command line
 */
function updateMacros(releaseJson, cmdlineMacros) {
  for (const release in releaseJson.targets) {
    // add the global macros to this target
    releaseJson.targets[release].macros.push(...releaseJson.macros);
    // add any command line provided macros
    releaseJson.targets[release].macros.push(...cmdlineMacros);
  }
}

/**
 * Run the release process for all targets as defined in the `release.json` file.
 *
 * @param targets - object containing the list of all targets to release, from `release.json`
 * @param sourcePath - path to root of where all source files are held
 * @param sourceFiles - Array of source file objects from `release.json`, with `{ file: "name",
 * macros: "macroname" }` elements
 * @param distPath - Path to where the distribution file(s) should be stored.
 * @param duplicatePath - Optional path for a duplicate copy of the release files.
 */
async function releaseAll(
  targets,
  sourcePath,
  sourceFiles,
  distPath,
  duplicatePath
) {
  for (const target in targets) {
    await release(
      sourcePath,
      sourceFiles,
      distPath,
      targets[target].filename,
      targets[target].macros,
      duplicatePath
    );
  }
}

// decode command line
const parsed = await parseArgs();

// build up file paths to access source and dist
const filePaths = setupFilePaths();

// load the release json file that defines the target releases
const releaseJson = await loadJson(filePaths.releaseJsonPath);

// update the macros from the release json file to include our command line macros and to share
// the global macros
updateMacros(releaseJson, parsed.macros);

// execute the release for each target
await releaseAll(
  releaseJson.targets,
  filePaths.sourcePath,
  releaseJson.sourceFiles,
  filePaths.distPath,
  parsed.duplicatePath
);
