/**************************************************************************************
 *
 * LaserPost module: utilities.js
 *
 * Utility methods to support LaserPost.
 *
 *************************************************************************************/

/**
 * Compare two numbers to see if they are nearly equal, based on the accuracy defined by `accuracyInMM`
 *
 * @param a First numeric value to compare
 * @param b Second numeric value to compare
 * @returns `true` if they are the same, within the accuracy defined by the global constant `accuracyInMM`
 */
function closeEquals(a, b) {
  return Math.abs(a - b) <= accuracyInMM;
  // return Math.round(a / accuracyInMM) == Math.round(b / accuracyInMM);
}

/**
 * Add a line to the LightBurn notes field.
 *
 * @param template Template comment to format and write to the notes field
 * @param parameters Optional key/value dictionary with parameters from template (such as {name})
 * @param important If the note is "important" (show notes in LightBurn when INCLUDE_NOTES_SHOW_IMPORTANT); optional, default `false`
 */
function appendNote(template, parameters, important) {
  if (important === true) notesImportant = true;
  const text = format(template, parameters);
  notes.push(text);
}

/**
 * Write a comment formatted for XML to the file including a newine at the end.  User preferences
 * determines the detail level of comments.  Supports template strings (see `format`)
 *
 * @param template Template comment to format and write to the file
 * @param parameters Optional key/value dictionary with parameters from template (such as {name})
 * @param level Optional level of the comment (COMMENT_NORMAL, COMMENT_DEBUG, COMMENT_INSANE); defaults to COMMENT_NORMAL
 */
function debugLog(template, parameters, level) {
  const text = format(template, parameters);
  text = text.replace(/[ \n]+$/, '');

  if (level === undefined) level = COMMENT_NORMAL;
  switch (getProperty('laserpost0400IncludeComments')) {
    case INCLUDE_COMMENTS_NONE:
      return;
    case INCLUDE_COMMENTS_NORMAL:
      if (level > COMMENT_NORMAL) return;
      break;
    case INCLUDE_COMMENTS_DEBUG:
      if (level > COMMENT_DEBUG) return;
      break;
    case INCLUDE_COMMENTS_INSANE:
      break;
  }

  if (text == '\n' || text == '') writeCommentLine('');
  else {
    var commentPrefix = '';
    if (level == COMMENT_DEBUG) commentPrefix = 'DEBUG: ';
    else if (level == COMMENT_INSANE) commentPrefix = 'INSANE: ';
    writeCommentLine(commentPrefix + text);
  }
}

/**
 * Converts a speed (in mm/min) to a string used for comments and notes according to the user
 * selected preference.
 *
 * @param speed Speed (already in the correct units)
 * @returns String with "### mm/min" or "### mm/sec"
 */
function speedToUnits(speedInMMPM) {
  const speedUnits = getProperty('machine0100SpeedUnits');
  if (speedUnits == SPEED_UNITS_MMPM)
    return formatSpeed.format(speedInMMPM) + ' ' + localize('mm/min');

  return formatSpeed.format(speedInMMPM) + ' ' + localize('mm/sec');
}
