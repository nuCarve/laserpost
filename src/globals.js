/**************************************************************************************
 *
 * LaserPost module: globals.js
 *
 * Global variables used internally by the post-processor
 *
 *************************************************************************************/
let xmlStack = []; // stack containing all currently open (nested) XML tags in output generation
let includeComments = INCLUDE_COMMENTS_NORMAL; // comment level to include in lbrn file - set from preferences
let includeNotes = INCLUDE_NOTES_SHOW_IMPORTANT; // notes level to include in lbrn file - set from preferences
let notes = ''; // notes to add to the file when the trailer is written
let notesImportant = false; // true when notes contain something "important" (such as update is available)
let currentGroup = undefined; // tracks the current group in use, set in `onSection`.
let currentPower = undefined; // track if the laser is powered on, used to understand CAM movements vs. cuts
let workspaceOffsets = { x: 0, y: 0 }; // offsets the geometry in the workspace based on preferences
let activeState = undefined; // current state that will be persisted to the STATE_FILENAME when done
let origState = undefined; // original state loaded from STATE_FILENAME and should not be changed

// groups is an array of CAM positions, organized by groupings (default is one per operation, but the user
// can specify shared group names to combine operations into grouped collections).  In general, data is
// organized similar to how CAM operations process the data.
let groups = [];

// `project` is created by `groupsToProject` after all operations are completed processing.  It
// contains a representation of the same data, but organized similar to what LightBurn expects
// for the lbrn file (such as conversion from CAM paths to LightBurn vectors and primitives).  No
// optimization is made, such as removing unwanted groups as that is handled in the final phase
// when the project array is written to the file.
//
// cutSettings is an array of individual, unique layers found while processing all CAM paths.
// operationSets is an array that contains one entry for each group (which could be multiple
// operations when group names are user, otherwise it's one per operation).  Groups then
// references an array of operations, which in turn contain all the shapes associated with
// that operation.
let project = { cutSettings: [], operationSets: [] };
