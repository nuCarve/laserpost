/**************************************************************************************
 *
 * LaserPost module: xmlState.js
 *
 * State and XML file support
 *
 *************************************************************************************/

/**
 * Loads the state from the XML file (in the post directory, same name as the post plus the extension STATE_EXTENSION)
 * used for tracking processing activities of the post processor.  Results in two global variables being set:
 *
 * - activeState: The state loaded from the XML file that can be modified as needed
 * - origState: The original state that is used to compare for state changes and should not be changed.
 *
 * The XML file is expected to contain `<laserpost>` and then one key for each object entry
 * with <memberName>value</memberName>
 */
function stateLoad() {
  // set up path to the state file, and see if it exists
  try {
    const xmlFile = new TextFile(getStatePath(), false, 'ansi');
  } catch (ex) {
    // no file, so set an empty state
    origState = {};
    activeState = {};
    return;
  }

  // bring in all lines from the file
  let xmlString = '';
  try {
    // load all lines.  The readln method throws error at EOF, so we just read until we get an error
    while (true) {
      xmlString += xmlFile.readln();
    }
  } catch (ex) {}
  xmlFile.close();

  const xmlObject = parseXML(xmlString);
  if (!xmlObject || !xmlObject.laserpost) origState = {};
  else {
    origState = xmlObject.laserpost;
    for (key in origState)
      if (origState[key].content) origState[key] = origState[key].content;
      else delete origState[key];
  }
  activeState = JSON.parse(JSON.stringify(origState));
}

/**
 * Determine if the state (activeState) has changed (shallow compare with origState)
 *
 * @returns `true` if the state is dirty and should be written.
 */
function stateIsDirty() {
  if (Object.keys(origState).length != Object.keys(activeState).length)
    return true;
  for (key in origState) if (origState[key] != activeState[key]) return true;
  return false;
}

/**
 * Writes the activeState to the XML state file, if it is dirty (has changed since it
 * was last loaded)
 */
function stateSave() {
  // make sure something has changed....
  if (stateIsDirty()) {
    // make sure to tell the user why we need security rights if we don't have them
    ensureSecurityRights();

    // write the state to the XML file
    let xmlFile;
    try {
      // write the XML state to the file
      xmlFile = new TextFile(getStatePath(), true, 'ansi');
      xmlFile.writeln('<?xml version="1.0" encoding="UTF-8"?>');
      xmlFile.writeln('<laserpost>');
      for (key in activeState) {
        xmlFile.writeln(
          format('  <{key}>{value}</{key}>', {
            key: key,
            value: encodeXML(activeState[key]),
          })
        );
      }
      xmlFile.writeln('</laserpost>');
      xmlFile.close();
    } catch (ex) {
      showWarning(
        localize(
          'Warning: Unable to save state file, but post should continue to work correctly (error "{error}")'
        ),
        {
          error: ex.toString(),
        }
      );
      if (xmlFile) {
        try {
          xmlFile.close();
        } catch (ex) {}
      }
    }
  }
}

/**
 * Returns the path to the XML state file, based on the path to the post file.
 * 
 * @returns Path to the state XML file.
 */
function getStatePath() {
  return FileSystem.replaceExtension(getConfigurationPath(), STATE_EXTENSION);
}