/**
 * Copyright (C) 2022 nuCarve
 * All rights reserved.
 *
 * A CAM post processor for emitting a LightBurn LBRN file for laser (jet) operations.
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

/**************************************************************************************
 *
 * Post-processor global kernel settings
 *
 *************************************************************************************/

 description = localize('LaserPost');
 vendor = 'nuCarve';
 vendorUrl = 'https://nucarve.com/laserpost';
 let semVer = '1.0.0-beta.2';
 
 let codeDescription = localize(
   'This post outputs the toolpath in LightBurn (LBRN) file format.'
 );
 let codeMoreInformation = localize(
   'Visit https://nucarve.com/laserpost for software, instructions and instructional videos.'
 );
 let codeLongVersion = localize('Version') + ': ' + semVer;
 
 longDescription =
   codeDescription + '  ' + codeMoreInformation + ' ' + codeLongVersion;
 legal = 'Copyright (C) 2022 by nuCarve';
 certificationLevel = 2;
 minimumRevision = 45845;
 
 extension = 'lbrn';
 setCodePage('ascii');
 
 capabilities = CAPABILITY_JET;
 tolerance = spatial(0.0001, MM);
 minimumChordLength = spatial(0.01, MM);
 minimumCircularRadius = spatial(0.01, MM);
 maximumCircularRadius = spatial(99999, MM);
 minimumCircularSweep = toRad(0.01);
 maximumCircularSweep = Math.PI * 2;
 allowHelicalMoves = false;
 allowedCircularPlanes = 1 << PLANE_XY;
 
 /**************************************************************************************
  *
  * Constants used internally by the post-processor
  *
  *************************************************************************************/
 // define enum for comment detail levels
 const INCLUDE_COMMENTS_NONE = 'none';
 const INCLUDE_COMMENTS_NORMAL = 'normal';
 const INCLUDE_COMMENTS_DETAILED = 'detail';
 const INCLUDE_COMMENTS_DEBUG = 'debug';
 const INCLUDE_COMMENTS_INSANE = 'insane';
 
 // define enum for notes include level
 const INCLUDE_NOTES_NONE = 'none';
 const INCLUDE_NOTES_HIDDEN = 'hidden';
 const INCLUDE_NOTES_SHOW = 'show';
 
 // define logging levels for comments (see writeComment)
 const COMMENT_NORMAL = 0;
 const COMMENT_DETAIL = 1;
 const COMMENT_DEBUG = 2;
 const COMMENT_INSANE = 3;
 
 // notes string used to indiciate a newline operation
 const NOTES_NEWLINE = '&#10;';
 
 // path types from CAM
 const PATH_TYPE_LINEAR = 'linear';
 const PATH_TYPE_SEMICIRCLE = 'semicircle';
 const PATH_TYPE_CIRCLE = 'circle';
 
 // define enum for layer modes
 const LAYER_MODE_LINE = 'line';
 const LAYER_MODE_FILL = 'fill';
 const LAYER_MODE_OFFSET_FILL = 'offsetFill';
 
 // define enum for speed units
 const SPEED_UNITS_MMPS = 'mmps';
 const SPEED_UNITS_MMPM = 'mmpm';
 
 // LightBurn shape types
 const SHAPE_TYPE_ELIPSE = 'elipse';
 const SHAPE_TYPE_PATH = 'path';
 const SHAPE_TYPE_GROUP = 'group';
 
 // LightBurn primitive types
 const PRIMITIVE_TYPE_LINE = 'line';
 const PRIMITIVE_TYPE_BEZIER = 'bezier';
 
 // enum for laser enabling
 const LASER_ENABLE_OFF = 'off';
 const LASER_ENABLE_1 = 'laser1';
 const LASER_ENABLE_2 = 'laser2';
 const LASER_ENABLE_BOTH = 'both';
 
 // enum for use air
 const USE_AIR_OFF = 'off';
 const USE_AIR_ON = 'on';
 const USE_AIR_ASSIST_GAS = 'gas';
 
 // define the name of the group used to trace the stock outline border, and the feed rate
 // to associate with it (which is required, but not meaningful as the layer is turned off)
 const STOCK_GROUP_NAME = 'Stock trace outline';
 const STOCK_FEED_RATE = 1000;
 
 // name of the state storage file
 const STATE_FILENAME = 'laserpost.xml';
 
 // time to wait on retry of version update checks when the API fails to respond
 const RETRY_VERSION_CHECK_ON_FAILURE_TIME_MS = 60 * 60 * 1000;
 
 // freqncy of update checking from the post properties UI
 const UPDATE_FREQUENCY_NEVER = "never";
 const UPDATE_FREQUENCY_ALWAYS = "always";
 const UPDATE_FREQUENCY_HOURLY = "hourly";
 const UPDATE_FREQUENCY_DAILY = "daily";
 const UPDATE_FREQUENCY_WEEKLY = "weekly";
 const UPDATE_FREQUENCY_MONTHLY = "monthly";
 
 /**************************************************************************************
  *
  * Global variables used internally by the post-processor
  *
  *************************************************************************************/
 let xmlStack = []; // stack containing all currently open (nested) XML tags in output generation
 let includeComments = INCLUDE_COMMENTS_NORMAL; // comment level to include in lbrn file - set from preferences
 let includeNotes = INCLUDE_NOTES_HIDDEN; // notes level to include in lbrn file - set from preferences
 let notes = ''; // notes to add to the file when the trailer is written
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
 // operationGroups is an array that contains one entry for each group (which could be multiple
 // operations when group names are user, otherwise it's one per operation).  Groups then
 // references an array of operations, which in turn contain all the shapes associated with
 // that operation.
 let project = { cutSettings: [], operationGroups: [] };
 
 /**************************************************************************************
  *
  * Define formatters
  *
  *************************************************************************************/
 const formatPosition = createFormat({ decimals: 3 });
 const formatRadius = createFormat({ decimals: 2 });
 const formatSpeed = createFormat({ decimals: 3 });
 const formatLeadingZero = createFormat({
   decimals: 0,
   zeropad: true,
   width: 2,
 });
 
 /**************************************************************************************
  *
  * CAM UI configuration
  *
  *************************************************************************************/
 
 /**
  * Define the groups used for properties when displayed during CAM configuraiton in the CAM UI
  */
 groupDefinitions = {
   groupLightBurn: {
     title: localize('LightBurn file settings'),
     description: localize('Settings to customize the generated .lbrn file.'),
     collapsed: false,
     order: 20,
   },
   groupWorkspace: {
     title: localize('Workspace'),
     description: localize(
       'Adjust the workspace (or stock) settings, including X/Y offset and rendering of the stock boundries.'
     ),
     collapsed: true,
     order: 40,
   },
   groupLaserPower: {
     title: localize('Power overrides'),
     description: localize(
       'Laser power overrides to based on operation cutting type (etch, cut through and vaporize).'
     ),
     collapsed: true,
     order: 40,
   },
   groupLaserPost: {
     title: localize('LaserPost'),
     description: localize('Settings to control the behavior of the post itself, such as automatic updates.'),
     collapsed: true,
     order: 50
   }
 };
 
 /**
  * Define the properties (often organized by the groups above) that users can control during CAM configuration.
  */
 properties = {
   //
   // Group: groupLightBurn
   //
   lightburn0200IncludeComments: {
     title: localize('Comments'),
     description: localize(
       'Detail level of XML comments in the generated ".lbrn" file.'
     ),
     group: 'groupLightBurn',
     type: 'enum',
     values: [
       { title: localize('Disable'), id: INCLUDE_COMMENTS_NONE },
       { title: localize('Normal'), id: INCLUDE_COMMENTS_NORMAL },
       { title: localize('Detailed'), id: INCLUDE_COMMENTS_DETAILED },
       { title: localize('Debug'), id: INCLUDE_COMMENTS_DEBUG },
       { title: localize('Insane'), id: INCLUDE_COMMENTS_INSANE },
     ],
     value: INCLUDE_COMMENTS_NORMAL,
     scope: 'post',
   },
   lightburn0300IncludeNotes: {
     title: localize('Notes'),
     description: localize(
       'Detail level of Notes in the generated ".lbrn" file.'
     ),
     group: 'groupLightBurn',
     type: 'enum',
     values: [
       { title: localize('Disable'), id: INCLUDE_NOTES_NONE },
       { title: localize('Hidden'), id: INCLUDE_NOTES_HIDDEN },
       { title: localize('Show'), id: INCLUDE_NOTES_SHOW },
     ],
     value: INCLUDE_NOTES_SHOW,
     scope: 'post',
   },
   lightburn0400IncludeNotes: {
     title: localize('Speed units'),
     description: localize(
       'Speed units to use in comments and file notes (does not affect the actual file as LightBurn always uses mm/sec).'
     ),
     group: 'groupLightBurn',
     type: 'enum',
     values: [
       { title: localize('mm/sec'), id: SPEED_UNITS_MMPS },
       { title: localize('mm/min'), id: SPEED_UNITS_MMPM },
     ],
     value: SPEED_UNITS_MMPS,
     scope: 'post',
   },
   lightburn0500GroupOperations: {
     title: localize('Group operations'),
     description: localize(
       'Set if a group should be created around all operations that share the same layer.  Groups are only created if there is more than one operation in the layer.'
     ),
     group: 'groupLightBurn',
     type: 'boolean',
     value: true,
     scope: 'post',
   },
   lightburn0600GroupShapes: {
     title: localize('Group shapes'),
     description: localize(
       'Set if a group should be created around all shapes generated by a single operation.  Groups are only created if there is more than one shape in the operation.'
     ),
     group: 'groupLightBurn',
     type: 'boolean',
     value: true,
     scope: 'post',
   },
   //
   // Group: groupWorkspace
   //
   work0100TraceStock: {
     title: localize('Trace stock'),
     description: localize(
       'Includes vectors on a custom layer (with output off) that traces the outline of the stock.'
     ),
     group: 'groupWorkspace',
     type: 'boolean',
     value: true,
     scope: 'post',
   },
   work0200OffsetX: {
     title: localize('Offset X axis'),
     description: localize(
       'Sets an optional X offset (in mm) to move all geometry in the workspace.  Positive and negative numbers are allowed.'
     ),
     group: 'groupWorkspace',
     type: 'number',
     value: 0,
     scope: 'post',
   },
   work0300OffsetX: {
     title: localize('Offset Y axis'),
     description: localize(
       'Sets an optional Y offset (in mm) to move all geometry in the workspace.  Positive and negative numbers are allowed.'
     ),
     group: 'groupWorkspace',
     type: 'number',
     value: 0,
     scope: 'post',
   },
   //
   // Group: groupLaserPower
   //
   laserPower0100EtchMin: {
     title: localize('Etch power (min, %)'),
     description: localize(
       'Sets the mininum laser power used for etching (ignored if etch max power is 0).'
     ),
     group: 'groupLaserPower',
     type: 'number',
     value: 0,
     range: [0, 100],
     scope: 'post',
   },
   laserPower0200EtchMax: {
     title: localize('Etch power (max, %)'),
     description: localize(
       "Sets the maximum laser power used for etching ('0' to use power specified on the tool)."
     ),
     group: 'groupLaserPower',
     type: 'number',
     value: 0,
     range: [0, 100],
     scope: 'post',
   },
   laserPower0300VaporizeMin: {
     title: localize('Vaporize power (min, %)'),
     description: localize(
       'Sets the minimum laser power used for vaporize (ignored if vaporize max power is 0).'
     ),
     group: 'groupLaserPower',
     type: 'number',
     value: 0,
     range: [0, 100],
     scope: 'post',
   },
   laserPower0400VaporizeMax: {
     title: localize('Vaporize power (max, %)'),
     description: localize(
       "Sets the maximum laser power used for vaporize ('0' to use power specified on the tool)."
     ),
     group: 'groupLaserPower',
     type: 'number',
     value: 0,
     range: [0, 100],
     scope: 'post',
   },
   laserPower0500ThroughMin: {
     title: localize('Through power (min, %)'),
     description: localize(
       'Sets the minimum laser power used for through cutting (ignored if through max power is 0)).'
     ),
     group: 'groupLaserPower',
     type: 'number',
     value: 0,
     range: [0, 100],
     scope: 'post',
   },
   laserPower0600ThroughMax: {
     title: localize('Through power (max, %)'),
     description: localize(
       "Sets the maximum laser power used for through cutting ('0' to use power specified on the tool)."
     ),
     group: 'groupLaserPower',
     type: 'number',
     value: 0,
     range: [0, 100],
     scope: 'post',
   },
   //
   // group: groupLaserPost
   //
   laserpost0100AutomaticUpdate: {
     title: localize('Automatic update'),
     description: localize(
       'Set how often LaserPost should check and notify that updates are available.'
     ),
     group: 'groupLaserPost',
     type: 'enum',
     values: [
       { title: localize('Never'), id: UPDATE_FREQUENCY_NEVER },
       { title: localize('Always'), id: UPDATE_FREQUENCY_ALWAYS },
       { title: localize('Hourly'), id: UPDATE_FREQUENCY_HOURLY },
       { title: localize('Daily'), id: UPDATE_FREQUENCY_DAILY },
       { title: localize('Weekly'), id: UPDATE_FREQUENCY_WEEKLY },
       { title: localize('Monthly'), id: UPDATE_FREQUENCY_MONTHLY },
     ],
     value: UPDATE_FREQUENCY_HOURLY, // todo: change to DAILY when at RC/STABLE
     scope: 'post',
   },
   laserpost0200UpdateAllowBeta: {
     title: localize('Beta releases'),
     description: localize(
       'Enable to allow beta releases, disable for stable releases only.'
     ),
     group: 'groupLaserPost',
     type: 'boolean',
     value: true,  // todo: change to false when at RC/STABLE
     scope: 'post',
   },
 
   //
   // operation: cutting
   //
   op0100GroupName: {
     title: localize('Group name'),
     description: localize(
       'Shapes are automatically grouped when an operation has more than one shape, but each operation (group or single shape) will be ungrouped.  To ' +
         'group multple operations together, specify a name on each operation and matching group names (case insensitive) will be grouped together.'
     ),
     type: 'string',
     value: '',
     scope: 'operation',
     enabled: 'cutting',
   },
   op0200PowerScale: {
     title: localize('Power scale'),
     description: localize(
       'LightBurn power scale (0-100%) for the shapes in the operation.'
     ),
     type: 'number',
     value: 100,
     range: [0, 100],
     scope: 'operation',
     enabled: 'cutting',
   },
   op0300LayerMode: {
     title: localize('Layer mode'),
     description: localize(
       'Selects the layer mode for the layer (Line, Fill or Offset Fill).  If a complex layer setup is needed, including for sub-layers (Multi), see the ' +
         'property "Custom CutSetting XML".'
     ),
     type: 'enum',
     values: [
       { title: localize('Line'), id: LAYER_MODE_LINE },
       { title: localize('Fill'), id: LAYER_MODE_FILL },
       { title: localize('Offset Fill'), id: LAYER_MODE_OFFSET_FILL },
     ],
     value: LAYER_MODE_LINE,
     scope: 'operation',
     enabled: 'cutting',
   },
   op0400LaserEnable: {
     title: localize('Laser enable'),
     description: localize(
       'Controls if the layer should be enabled and using which laser(s) (for dual laser machines).'
     ),
     type: 'enum',
     values: [
       { title: localize('Disable output'), id: LASER_ENABLE_OFF },
       { title: localize('Laser 1'), id: LASER_ENABLE_1 },
       { title: localize('Laser 2'), id: LASER_ENABLE_2 },
       { title: localize('Both lasers'), id: LASER_ENABLE_BOTH },
     ],
     value: LASER_ENABLE_1,
     scope: 'operation',
     enabled: 'cutting',
   },
   op0500UseAir: {
     title: localize('Use air'),
     description: localize(
       'Sets if the layer uses air.  "Off" / "On" always set the air to the specified state, "Tool Assist Gas" will set the air off when ' +
         'the tools "Cutting Data" (section "Process inputs") property "Assist gas" is "None" (or blank) and turn the air on for any other value.'
     ),
     type: 'enum',
     values: [
       { title: localize('Off'), id: USE_AIR_OFF },
       { title: localize('On'), id: USE_AIR_ON },
       { title: localize('Tool Assist Gas'), id: USE_AIR_ASSIST_GAS },
     ],
     value: USE_AIR_ON,
     scope: 'operation',
     enabled: 'cutting',
   },
   op0600ZOffset: {
     title: localize('Z offset (mm)'),
     description: localize(
       'Amount to offset the Z into the material (or out of it) at the start of cutting.  Useful for deep cutting or defocusing.'
     ),
     type: 'number',
     value: 0,
     scope: 'operation',
     enabled: 'cutting',
   },
   op0700Passes: {
     title: localize('Passes'),
     description: localize('Number of times to repeat the cut.'),
     type: 'number',
     value: 1,
     scope: 'operation',
     enabled: 'cutting',
   },
   op0800ZStep: {
     title: localize('Z step per pass (mm)'),
     description: localize('Amount of raise or lower Z for each cut pass.'),
     type: 'number',
     value: 0,
     scope: 'operation',
     enabled: 'cutting',
   },
   op0900CustomCutSettingXML: {
     title: localize('Custom CutSetting (XML)'),
     description: localize(
       'For complex LightBurn cut settings (such as using sub-layers or advanced options) you can paste the <CutSettings> section of the XML from a template ' +
         'LightBurn file (it does not matter if it is from lbrn or lbrn2).  Include everything from <CutSettings> through </CutSettings> (including those tags).'
     ),
     type: 'string',
     value: '',
     scope: 'operation',
     enabled: 'cutting',
   },
 };
 
 /**************************************************************************************
  *
  * Methods for handling the CAM events
  *
  *************************************************************************************/
 
 /**
  * onOpen is called by CAM at the start of the processing, before the first section.
  */
 function onOpen() {
   // load our state from the persistent state file
   stateLoad();
 
   // check if an update is available
   checkUpdateAvailability();
 
   // capture and save the preferences that affect file generation
   includeComments = getProperty('lightburn0200IncludeComments');
   includeNotes = getProperty('lightburn0300IncludeNotes');
   workspaceOffsets = {
     x: getProperty('work0200OffsetX'),
     y: getProperty('work0300OffsetX'),
   };
 
   // emit the the required XML header
   writeXMLHeader();
 
   // if we have a program name/comment, add it to the file as comments and in notes
   if (programName || programComment) {
     writeCommentAndNote(localize('Program'));
     if (programName)
       writeCommentAndNote('  ' + localize('Name') + ': ' + programName);
     if (programComment)
       writeCommentAndNote('  ' + localize('Comment') + ': ' + programComment);
   }
 
   // dump machine configuration
   var vendor = machineConfiguration.getVendor();
   var model = machineConfiguration.getModel();
   var description = machineConfiguration.getDescription();
 
   writeCommentAndNote(localize('Machine'));
   if (vendor) {
     writeCommentAndNote('  ' + localize('Vendor') + ': ' + vendor);
   }
   if (model) {
     writeCommentAndNote('  ' + localize('Model') + ': ' + model);
   }
   if (description) {
     writeCommentAndNote('  ' + localize('Description') + ': ' + description);
   }
 
   // if the user did any laser overrides, include those in the comments
   let laserPowerEtchMin = getProperty('laserPower0100EtchMin');
   let laserPowerEtchMax = getProperty('laserPower0200EtchMax');
   let laserPowerVaporizeMin = getProperty('laserPower0300VaporizeMin');
   let laserPowerVaporizeMax = getProperty('laserPower0400VaporizeMax');
   let laserPowerThroughMin = getProperty('laserPower0500ThroughMin');
   let laserPowerThroughMax = getProperty('laserPower0600ThroughMax');
 
   if (
     laserPowerEtchMax != 0 ||
     laserPowerThroughMax != 0 ||
     laserPowerVaporizeMax != 0
   ) {
     writeCommentAndNote(localize('Laser power overrides'));
     if (laserPowerEtchMax != 0)
       writeCommentAndNote(
         '  ' +
           localize('Etch power') +
           ': ' +
           laserPowerEtchMin +
           '% ' +
           localize('(min)') +
           ' - ' +
           laserPowerEtchMax +
           '% ' +
           localize('(max)')
       );
     if (laserPowerVaporizeMax != 0)
       writeCommentAndNote(
         '  ' +
           localize('Vaporize power') +
           ': ' +
           laserPowerVaporizeMin +
           '% ' +
           localize('(min)') +
           ' - ' +
           laserPowerVaporizeMax +
           '% ' +
           localize('(max)')
       );
     if (laserPowerThroughMax != 0)
       writeCommentAndNote(
         '  ' +
           localize('Through power') +
           ': ' +
           laserPowerThroughMin +
           '% ' +
           localize('(min)') +
           ' - ' +
           laserPowerThroughMax +
           '% ' +
           localize('(max)')
       );
   }
 
   // add comments for tool information
   var tools = getToolTable();
   if (tools.getNumberOfTools() > 0) {
     writeComment(localize('Tools'));
     for (var i = 0; i < tools.getNumberOfTools(); ++i) {
       var tool = tools.getTool(i);
       writeComment(
         '  ' +
           localize(
             'Tool #{num}: {desc} [{type}], min power (pierce)={pierce}%, max power (cut)={cut}%, kerf width={kerf}mm'
           ),
         {
           num: tool.number,
           desc: tool.getDescription(),
           type: getToolTypeName(tool.type),
           pierce: tool.piercePower,
           cut: tool.cutPower,
           kerf: tool.getKerfWidth(),
         }
       );
     }
   }
 }
 
 /**
  * onComment is called by CAM when a comment should be emitted.
  *
  * @param message Comment to add to the file.
  */
 function onComment(message) {
   writeComment(message);
 }
 
 /**
  * onSection is called by CAM on the start of each operation.
  */
 function onSection() {
   // add a comment that contains the operation name
   var operationName = getParameter('operation-comment');
   if (!operationName)
     // it appears this can never happen, but it is a safety valve just in case...
     operationName = 'unknown';
 
   // make sure this is a tool type for laser cutting
   if (tool.type !== TOOL_LASER_CUTTER) {
     error(
       localize('Operation is not for laser cutting') +
         (operationName ? ': ' + operationName : '')
     );
     return;
   }
 
   // laser power is defined on the tool (cut power is max power, pierce power is min power), but
   // can also be overridden in post properties.  Determine the min/max power and the source of
   // that power selection (for logging purposes).
   var minPower = 0;
   var maxPower = 0;
   let powerSource;
   switch (currentSection.jetMode) {
     case JET_MODE_ETCHING:
       minPower = getProperty('laserPower0100EtchMin');
       maxPower = getProperty('laserPower0200EtchMax');
       powerSource = localize('post-processor etch power properties');
       break;
     case JET_MODE_VAPORIZE:
       minPower = getProperty('laserPower0300VaporizeMin');
       maxPower = getProperty('laserPower0400VaporizeMax');
       powerSource = localize('post-processor vaporize power properties"');
       break;
     case JET_MODE_THROUGH:
       minPower = getProperty('laserPower0500ThroughMin');
       maxPower = getProperty('laserPower0600ThroughMax');
       powerSource = localize('post-processor through power properties');
       break;
     default:
       error(
         localize('Unsupported cutting mode') +
           ' (' +
           currentSection.jetMode +
           ')'
       );
       return;
   }
 
   // if the user did not specify an override on max power, use the tools cut (max) and/or pierce (min) power
   if (maxPower == 0) {
     minPower = tool.piercePower;
     maxPower = tool.cutPower;
     powerSource = localize('tool power properties');
   }
 
   // determine the air setting.
   let useAir = true;
   switch (getProperty('op0500UseAir')) {
     case USE_AIR_OFF:
       useAir = false;
       break;
     case USE_AIR_ON:
       useAir = true;
       break;
     case USE_AIR_ASSIST_GAS:
       useAir = tool.assistGas.toLowerCase() != 'none' && tool.assistGas != '';
       break;
   }
 
   // set up the group - using the shared group name if specified, else a new empty group
   const groupName = currentSection.getProperty('op0100GroupName');
   if (groupName == '') groupName = undefined;
 
   currentGroup = getGroup(groupName, {
     groupName: groupName,
     operations: [],
   });
 
   // collect settings from the user via operation properties
   const powerScale = currentSection.getProperty('op0200PowerScale');
   const opLayerMode = currentSection.getProperty('op0300LayerMode');
   const customCutSettingXML = currentSection.getProperty(
     'op0900CustomCutSettingXML'
   );
   const laserEnable = currentSection.getProperty('op0400LaserEnable');
   const zOffset = currentSection.getProperty('op0600ZOffset');
   const passes = currentSection.getProperty('op0700Passes');
   const zStep = currentSection.getProperty('op0800ZStep');
 
   // if custom XML is used, decode it
   let parsedXML = undefined;
   if (customCutSettingXML) {
     parsedXML = parseXML(customCutSettingXML);
     if (parsedXML === undefined) {
       error(
         localize('Unable to parse Custom CutSetting XML on operation') +
           ': ' +
           operationName
       );
       return;
     }
     // make sure we have <CutSetting> as our starting tag
     if (!parsedXML.CutSetting) {
       error(
         localize(
           'Invalid Custom CutSetting (must be "<CutSetting>...</CutSetting>") on operation'
         ) +
           ': ' +
           operationName
       );
       return;
     }
     // remove properties disallowed on custom
     delete parsedXML.index;
     delete parsedXML.priority;
     delete parsedXML.name;
 
     // update power source (used for comments below) to indicate it was custom
     powerSource = localize('post-processor through custom CutSeting XML');
   }
 
   // add the operation to this group
   if (parsedXML) {
     currentGroup.operations.push({
       operationName: operationName,
       powerScale: powerScale,
       powerSource: powerSource,
       customCutSettingXML: customCutSettingXML,
       customCutSetting: parsedXML,
       paths: [],
     });
   } else {
     currentGroup.operations.push({
       operationName: operationName,
       minPower: minPower,
       maxPower: maxPower,
       laserEnable: laserEnable,
       layerMode: opLayerMode,
       powerScale: powerScale,
       powerSource: powerSource,
       useAir: useAir,
       zOffset: zOffset,
       passes: passes,
       zStep: zStep,
       customCutSettingXML: '',
       paths: [],
     });
   }
 
   // include comments about the group and power being used
   writeComment(
     'Operation: "{name}" using group "{group}"',
     {
       name: operationName,
       group: groupName ? groupName : 'n/a',
     },
     COMMENT_DEBUG
   );
 
   if (customCutSettingXML)
     writeComment(
       'Settings: Custom CutSetting XML:\n${xml}',
       { xml: customCutSettingXML },
       COMMENT_DEBUG
     );
   else
     writeComment(
       'Settings: {min}-{max}% ({source}), layer mode: {mode}, laser enable: {enable}, power scale: {scale}, air: {air}, z-offset: {zOffset}, passes: {passes}, z-step: {zStep}',
       {
         min: minPower,
         max: maxPower,
         source: powerSource,
         mode: opLayerMode,
         enable: laserEnable,
         scale: powerScale,
         air: useAir ? localize('on') : localize('off'),
         zOffset: zOffset,
         passes: passes,
         zStep: zStep,
       },
       COMMENT_DEBUG
     );
 }
 
 /**
  * onLinear is called by CAM when the laser should move at another location, with or without power.
  *
  * @param x X position to move to.
  * @param y Y positoin to move to.
  * @param z Z position to move to.
  * @param feed Feedrate to use.
  */
 function onLinear(x, y, z, feed) {
   var start = getCurrentPosition();
 
   // adjust offsets
   x += workspaceOffsets.x;
   y += workspaceOffsets.y;
   start.x += workspaceOffsets.x;
   start.y += workspaceOffsets.y;
 
   // is laser currently on?  If not, we ignore this request (other than debugging logic)
   if (currentPower) {
     writeComment(
       'onLinear LASER: [{startX}, {startY}] to [{endX}, {endY}] at {feed} mm/min',
       {
         startX: formatPosition.format(start.x),
         startY: formatPosition.format(start.y),
         endX: formatPosition.format(x),
         endY: formatPosition.format(y),
         feed: formatSpeed.format(feed),
       },
       COMMENT_DEBUG
     );
 
     // add this path segment
     currentGroup.operations[currentGroup.operations.length - 1].paths.push({
       type: PATH_TYPE_LINEAR,
       startX: start.x,
       startY: start.y,
       endX: x,
       endY: y,
       feed: feed,
     });
   } else {
     writeComment(
       'onLinear MOVE: [{startX}, {startY}] to [{endX}, {endY}]',
       {
         startX: formatPosition.format(start.x),
         startY: formatPosition.format(start.y),
         endX: formatPosition.format(x),
         endY: formatPosition.format(y),
       },
       COMMENT_INSANE
     );
   }
 }
 
 /**
  * onCircular is called by CAM when a curve needs to be lasered.  Curve starts
  * from the current position of the laser.
  *
  * @param clockwise Direction to move, `true` is clockwise
  * @param cx Center position X of the curve
  * @param cy Center position Y of the curve
  * @param cz Center position Z of the curve
  * @param x Ending X position of the curve
  * @param y Ending Y position of the curve
  * @param z Ending Z position of the curve
  * @param feed Feedrate to move at
  */
 function onCircular(clockwise, cx, cy, cz, x, y, z, feed) {
   if (!currentPower) {
     error(
       localize(
         'Invalid CAM request: onCircular called with laser not powered on'
       )
     );
     return;
   }
 
   // adjust offsets
   cx += workspaceOffsets.x;
   cy += workspaceOffsets.y;
   x += workspaceOffsets.x;
   y += workspaceOffsets.y;
 
   var start = getCurrentPosition();
   start.x += workspaceOffsets.x;
   start.y += workspaceOffsets.y;
 
   writeComment(
     'onCircular: {clockwise} {fullSemi}, [{sx}, {sy}] to [{ex}, {ey}] center [{cx}, {cy}], feed={feed} mm/min',
     {
       clockwise: clockwise ? 'CW' : 'CCW',
       fullSemi: isFullCircle() ? 'circle' : 'semicircle',
       sy: formatPosition.format(start.x),
       sx: formatPosition.format(start.y),
       cx: formatPosition.format(cx),
       cy: formatPosition.format(cy),
       ex: formatPosition.format(x),
       ey: formatPosition.format(y),
       feed: formatSpeed.format(feed),
     },
     COMMENT_DEBUG
   );
 
   // add this path segment
   currentGroup.operations[currentGroup.operations.length - 1].paths.push({
     type: isFullCircle() ? PATH_TYPE_CIRCLE : PATH_TYPE_SEMICIRCLE,
     startX: start.x,
     startY: start.y,
     centerX: cx,
     centerY: cy,
     endX: x,
     endY: y,
     clockwise: clockwise,
     feed: feed,
   });
 }
 
 /**
  * onCommand is called by command to issue a variety of commands to the post-processor.
  *
  * @param command Command to process, such as COMMAND_STOP
  */
 function onCommand(command) {
   writeComment(
     'onCommand: {id} ({command})',
     {
       command: command,
       id: getCommandStringId(command),
     },
     COMMENT_DEBUG
   );
 
   switch (command) {
     case COMMAND_POWER_ON:
       currentPower = true;
       return;
     case COMMAND_POWER_OFF:
       currentPower = false;
       return;
   }
 
   onUnsupportedCommand(command);
 }
 
 /**
  * onSectionEnd is called by CAM when the current operation is done.
  */
 function onSectionEnd() {
   writeComment('onSectionEnd', {}, COMMENT_DEBUG);
 }
 
 /**
  * onClose is called by CAM when the last section has been completed.  Triggers the
  * processing of all entries in the `groups` array and generates the LightBurn file.
  */
 function onClose() {
   // include some debugging information
   writeComment('onClose', {}, COMMENT_DEBUG);
 
   // trace the stock outline
   if (getProperty('work0100TraceStock')) traceStockOutline();
 
   dumpGroups();
 
   // process all groups, converting from CAM coordinates to LightBurn
   groupsToProject();
 
   // render the file
   writeHeader();
   writeCutSettings();
   writeShapes();
   writeTrailer();
 
   // save our state to the persistent state file (if changed)
   stateSave();
 }
 
 /**
  * onClose is called by CAM when the last section has been completed.
  */
 function onTerminate() {}
 
 /**************************************************************************************
  *
  * Group and Project services.  Handles the heavy lifting of converting CAM paths
  * to LightBurn objects (layers, vectors and primitives), including grouping and path closures.
  *
  *************************************************************************************/
 
 /**
  * Gets a group object by name.  If the group does not already exist (in the `groups` array)
  * it is instantiated.  `defaults` is an object that defines the settings for the group should the
  * group not already exist.
  *
  * @param groupName Name of group to locate or instantiate (undefined if stand alone group)
  * @param defaults Object containing default values for the group if new one needs to be created.
  * @returns An individual group from the `groups` array (new or existing)
  */
 function getGroup(groupName, defaults) {
   let group = undefined;
   if (groupName)
     for (let l = 0; l < groups.length; ++l) {
       if (groups[l].groupName.toLowerCase() == groupName.toLowerCase()) {
         group = groups[l];
         break;
       }
     }
   if (!group) {
     writeComment(
       'getGroup: Create new group "{group}"',
       { group: groupName },
       COMMENT_DEBUG
     );
     groups.push(defaults);
     group = groups[groups.length - 1];
   } else
     writeComment(
       'getGroup: Join existing group "{group}"',
       { group: groupName },
       COMMENT_DEBUG
     );
   return group;
 }
 
 /**
  * Converts the `groups` array into the `project` array, converting CAM style paths metrics into
  * LightBurn CutSettings and Shapes objects.
  *
  * This must be called after all CAM operations are complete, and prior to accessing any information
  * in the `project` array.
  */
 function groupsToProject() {
   // loop through all groups
   for (let g = 0; g < groups.length; ++g) {
     const group = groups[g];
 
     // create a new operationGroup in the project to group all the operations together in LightBurn
     // that share the same group name
     project.operationGroups.push({
       groupName: group.groupName,
       operations: [],
     });
     const projOpGroup =
       project.operationGroups[project.operationGroups.length - 1];
 
     // loop through all operations on this group
     for (let o = 0; o < group.operations.length; ++o) {
       const operation = group.operations[o];
 
       // if no points, skip this one
       if (operation.paths.length == 0) continue;
 
       // set up a project operation inside the project group (each operation is grouped to make managing them in LightBurn easier)
       const index = projOpGroup.operations.push({
         shapeGroups: [],
         operationName: operation.operationName,
       });
       const projOperation = projOpGroup.operations[index - 1];
 
       // find (or create) a layer (<CutSetting>) for this operation (all shapes within
       // a CAM operation share the same cut setting)
       const cutSetting = getCutSetting({
         name: operation.operationName,
         minPower: operation.minPower,
         maxPower: operation.maxPower,
         speed: operation.paths[0].feed / 60, // LightBurn is mm/sec, CAM is mm/min
         layerMode: operation.layerMode,
         laserEnable: operation.laserEnable,
         powerSource: operation.powerSource,
         useAir: operation.useAir,
         zOffset: operation.zOffset,
         passes: operation.passes,
         zStep: operation.zStep,
         customCutSettingXML: operation.customCutSettingXML,
         customCutSetting: operation.customCutSetting,
       });
 
       // convert the group (paths) into segments (groups of shapes)
       const segments = identifySegments(operation, cutSetting);
 
       // build out shapes for each segments
       generateShapesFromSegments(
         operation,
         segments,
         cutSetting,
         projOperation
       );
     }
   }
 
   // dump the project to comments to assist with debugging problems
   dumpProject();
 }
 
 /**
  * Identifies from operation (paths) the groupings of segments (start/end/type) to define LightBurn shapes
  *
  * Breaks apart individual paths into logical segments open paths (series of lines), closed paths (where start and end
  * point are the same), and circles (by definition, a closed path).
  *
  * Paths from CAM sometimes have segments as lead-ins (for example, a through cut adds a short cut to ensure a full cut
  * at the start / end of the geometry), and so to make sure we can close shapes whenever possible (when end point of a cut
  * matches the start point of the geometry), we need to search across all the paths in the operation, and break them
  * into unique path sets - where each set is a contiguous path from start to end and broken out into a separate set whenever
  * the geometry can be closed (to define a fillable shape in LightBurn).
  *
  * @param operation Operation containing the path points
  * @param cutSetting The cutSetting to use with this operation
  * @returns Array of start/end indexes (of operation paths) and if the shape is closed ([{start, end, closed}]
  */
 function identifySegments(operation, cutSetting) {
   const segments = [];
   let startSegment = 0;
   for (
     let currentSegment = 0;
     currentSegment < operation.paths.length;
     ++currentSegment
   ) {
     startPath = operation.paths[startSegment];
     const currentPath = operation.paths[currentSegment];
 
     // if this is a circle, break it off as circles are single point closed shapes
     if (currentPath.type == PATH_TYPE_CIRCLE) {
       if (startSegment != currentSegment) {
         // break off the prior elements
         segments.push({
           start: startSegment,
           end: currentSegment - 1,
           closed: false,
         });
         writeComment(
           'groupsToProject: Breaking off open segment (due to next circle): {start} to {end}',
           { start: startSegment, end: currentSegment - 1 },
           COMMENT_INSANE
         );
       }
       // break off the circle itself
       segments.push({
         start: currentSegment,
         end: currentSegment,
         closed: true,
       });
       writeComment(
         'groupsToProject: Breaking off closed segment (circle): {start} to {end}',
         {
           start: currentSegment,
           end: currentSegment,
         },
         COMMENT_INSANE
       );
       startSegment = currentSegment + 1;
       continue;
     }
 
     // other than circle, the first segment can be ignored as decisions are made based on the segments that follow it
     if (startSegment != currentSegment) {
       // is our end point the same as any prior start point in this segment?  If so, we need to connect them,
       // and may need to break apart the segment if it isn't at the first path
       for (let i = startSegment; i < currentSegment; ++i) {
         const checkPath = operation.paths[i];
         if (
           currentPath.endX == checkPath.startX &&
           currentPath.endY == checkPath.startY
         ) {
           // we have a closure - so we need to take the paths prior to this new segment and save them
           // as one segment (including this ending point), and then take our new paths and save as another segment.
           if (startSegment != i) {
             segments.push({ start: startSegment, end: i - 1, closed: false });
             writeComment(
               'groupsToProject: Breaking off open segment (due to next closure): {start} to {end}',
               { start: startSegment, end: i - 1 },
               COMMENT_INSANE
             );
           }
           segments.push({ start: i, end: currentSegment, closed: true });
           writeComment(
             'groupsToProject: Breaking off closed segment: {start} to {end}',
             { start: i, end: currentSegment },
             COMMENT_INSANE
           );
           startSegment = currentSegment + 1;
           break;
         }
       }
       // if we closed out this segment, go back to do the next one
       if (startSegment == currentSegment + 1) continue;
       // is our current path not the same as our prior end?  If so, we have a move operation so we need to start a new segment
       const priorPath = operation.paths[currentSegment - 1];
       if (
         currentPath.startX != priorPath.endX ||
         currentPath.startY != priorPath.endY
       ) {
         segments.push({
           start: startSegment,
           end: currentSegment - 1,
           closed: false,
         });
         writeComment(
           'groupsToProject: Breaking off open segment (due to move): {start} to {end}',
           { start: startSegment, end: currentSegment - 1 },
           COMMENT_INSANE
         );
         startSegment = currentSegment;
       }
     }
     // is this the last segment?  Break off what remains
     if (currentSegment == operation.paths.length - 1) {
       segments.push({
         start: startSegment,
         end: currentSegment,
         closed: false,
       });
       writeComment(
         'groupsToProject: Breaking off open segment (due to last segment): {start} to {end}',
         { start: startSegment, end: currentSegment },
         COMMENT_INSANE
       );
     }
   }
 
   // dump the segments into insane comments
   writeComment('groupsToProject: Segmentation list:', {}, COMMENT_INSANE);
   for (let i = 0; i < segments.length; ++i)
     writeComment(
       '  #{num}: {start} to {end} ({openClosed})',
       {
         num: i,
         start: segments[i].start,
         end: segments[i].end,
         openClosed: segments[i].closed ? 'closed' : 'open',
       },
       COMMENT_INSANE
     );
 
   return segments;
 }
 
 /**
  * Constructs LightBurn style shapes from a series of segments.
  *
  * Walks all segments and builds LightBurn shapes for each of them.  Handles the conversion of CAM style paths
  * to LightBurn style shapes (including bezier and circle conversions).
  *
  * @param operation The CAM operation, where the path metrics can be found
  * @param segments The segmentation index of each shape (which references operation for the metrics)
  * @param cutSetting The cutSettings (aka LightBurn layer) that will be used for these shapes
  * @param projOperation The project operation object, where the resolved shapes are added for grouping
  */
 function generateShapesFromSegments(
   operation,
   segments,
   cutSetting,
   projOperation
 ) {
   // process all segments and convert them into shapes (vectors and primities), including conversion of
   // non-linear paths from circular (start/end/center points) to bezier (center point, with two control points)
   for (let i = 0; i < segments.length; ++i) {
     const segment = segments[i];
 
     // create a new shape in our shapeGroup for this operation (to group the shapes together by operation)
     projOperation.shapeGroups.push({
       cutIndex: cutSetting.index,
     });
     const shape =
       projOperation.shapeGroups[projOperation.shapeGroups.length - 1];
 
     // build out the shape.
     if (operation.paths[segment.start].type == PATH_TYPE_CIRCLE)
       // cirlces create LightBurn elipses (no vertex/primitive)
       generateElipseShape(
         shape,
         operation.paths[segment.start],
         operation.powerScale
       );
     // all other shapes (linear, semicircle) become LightBurn Paths using vertex/primitives
     else
       generatePathShape(
         shape,
         operation,
         segment.start,
         segment.end,
         segment.closed,
         operation.powerScale
       );
   }
 }
 
 /**
  * Generates a LightBurn Elipse, from a full circle CAM operation
  *
  * Converts the CAM style path (start xy and center xy) into LightBurn style
  * elipse of center xy and radius.
  *
  * @param shape Shape object to complete with the elipse information
  * @param path Path data for the CAM full circle
  * @param powerScale Power scale to use for this shape
  */
 function generateElipseShape(shape, path, powerScale) {
   // determine the radius of this circle
   const deltaX = path.startX - path.centerX;
   const deltaY = path.startY - path.centerY;
   const radius = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
 
   // add the shape
   shape.type = SHAPE_TYPE_ELIPSE;
   shape.centerX = path.centerX;
   shape.centerY = path.centerY;
   shape.radius = radius;
   shape.powerScale = powerScale;
 }
 
 /**
  * Generates a LightBurn Path, from CAM operations
  *
  * Handles the creation of a LightBurn Path shape, including the conversion of CAM style paths (center, start and
  * end points) into LightBurn style paths (cubic bezier vectors and primitives that connect them).
  *
  * @param shape Shape object to complete with the path information
  * @param operation Path data for all shapes within this operation
  * @param segmentStart Index into operation to the path that starts this shape
  * @param segmentEnd Index into operation to the path that completes this shape
  * @param segmentClosed `true` if this is a closed shape, `false` if it is an open shape
  * @param powerScale Power scale to use for this shape
  */
 function generatePathShape(
   shape,
   operation,
   segmentStart,
   segmentEnd,
   segmentClosed,
   powerScale
 ) {
   // regular path shape (any combination of PATH_TYPE_LINEAR and PATH_TYPE_SEMICIRCLE)
   shape.type = SHAPE_TYPE_PATH;
   shape.vectors = [];
   shape.primitives = [];
   shape.powerScale = powerScale;
 
   // define a variable to track the entry bezier control point into the next vector
   let c1 = undefined;
 
   // gather all points from the segment (from start to end) into vectors (the individual points) and primitives (the connection between vectors)
   // this is also where we do the conversion of circular paths into bezier curves for LightBurn
   for (p = segmentStart; p <= segmentEnd; ++p) {
     const path = operation.paths[p];
 
     switch (path.type) {
       case PATH_TYPE_LINEAR:
         shape.vectors.push({
           x: path.startX,
           y: path.startY,
           c1x: c1 ? c1.x : undefined, // there may be a bezier control point from the last curve that needs to be applied
           c1y: c1 ? c1.y : undefined,
         });
 
         // add a primitive connecting the vectors, except if we are on the first one (we don't have a line yet)
         if (p != segmentStart)
           shape.primitives.push({
             type: c1 ? PRIMITIVE_TYPE_BEZIER : PRIMITIVE_TYPE_LINE,
             start: shape.vectors.length - 2,
             end: shape.vectors.length - 1,
           });
 
         // clear the bezier control point as we have now consumed it (if it was in use)
         c1 = undefined;
 
         break;
       case PATH_TYPE_SEMICIRCLE:
         // convert the path style curvature (start, end, centerpoint) into bezier vectors - which can result in more vectors to make the curve
         const curves = circularToBezier(
           { x: path.startX, y: path.startY },
           { x: path.endX, y: path.endY },
           { x: path.centerX, y: path.centerY },
           path.clockwise
         );
 
         // debug info
         writeComment(
           'generatePathShape: converting to bezier [{startX}, {startY}] to [{endX}, {endY}] center [{centerX}, {centerY}]',
           {
             startX: formatPosition.format(path.startX),
             startY: formatPosition.format(path.startY),
             endX: formatPosition.format(path.endX),
             endY: formatPosition.format(path.endY),
             centerX: formatPosition.format(path.centerX),
             centerY: formatPosition.format(path.centerY),
           },
           COMMENT_INSANE
         );
 
         // process all curves
         let startX = path.startX;
         let startY = path.startY;
 
         for (let i = 0; i < curves.length; ++i) {
           // debug
           writeComment(
             '  #{num}: end=[{x}, {y}], 1=[{x1}, {y1}], 2=[{x2}, {y2}]',
             {
               num: i,
               x: formatPosition.format(curves[i].x),
               y: formatPosition.format(curves[i].y),
               x1: formatPosition.format(curves[i].x1),
               y1: formatPosition.format(curves[i].y1),
               x2: formatPosition.format(curves[i].x2),
               y2: formatPosition.format(curves[i].y2),
             },
             COMMENT_INSANE
           );
 
           // set up the control points for exiting this vector
           let c0 = { x: curves[i].x1, y: curves[i].y1 };
 
           // push this vector into the list
           shape.vectors.push({
             x: startX,
             y: startY,
             c0x: c0.x,
             c0y: c0.y,
             c1x: c1 ? c1.x : undefined, // include the entry control point if the prior vector had left it for us
             c1y: c1 ? c1.y : undefined,
           });
 
           // add a primitive to connect them, except if we are on the first one (we don't have a line yet)
           if (p + i != segmentStart)
             shape.primitives.push({
               type: c1 ? PRIMITIVE_TYPE_BEZIER : PRIMITIVE_TYPE_LINE,
               start: shape.vectors.length - 2,
               end: shape.vectors.length - 1,
             });
 
           // set up the control point for entering the next vector
           c1 = { x: curves[i].x2, y: curves[i].y2 };
 
           // update start position to reflect where this curve ended
           startX = curves[i].x;
           startY = curves[i].y;
         }
         break;
     }
   }
   // if this is a closed segment, add a primitive to connect the last to the first, and update
   // the starting vector to have the entry bezier control point if we have one.  If an open
   // segment, add the final vector and primitive to connect them.
   if (segmentClosed) {
     // closed - so connect primitive to start vector as our ending point
     shape.primitives.push({
       type: c1 ? PRIMITIVE_TYPE_BEZIER : PRIMITIVE_TYPE_LINE,
       start: shape.vectors.length - 1,
       end: 0,
     });
     shape.vectors[0].c1x = c1 ? c1.x : undefined;
     shape.vectors[0].c1y = c1 ? c1.y : undefined;
   } else {
     // open - so add the final vector and connect them
     shape.vectors.push({
       x: operation.paths[segmentEnd].endX,
       y: operation.paths[segmentEnd].endY,
       c0x: undefined,
       c0y: undefined,
       c1x: c1 ? c1.x : undefined, // include the entry control point if the prior vector had left it for us
       c1y: c1 ? c1.y : undefined,
     });
     shape.primitives.push({
       type: c1 ? PRIMITIVE_TYPE_BEZIER : PRIMITIVE_TYPE_LINE,
       start: shape.vectors.length - 2,
       end: shape.vectors.length - 1,
     });
   }
 }
 
 /**
  * Converts a circular coordinate system (such as used CAM onCircular, and gcode G2/G3) into a bezier curve (as
  * used by LightBurn).  Accepts a start point, end point, center point of the circle, and a flag indicating if
  * we are moving clockwise or counterclockwise.  Returns an array of curves, containing {x, y, x1, y1, x2, y2}
  * where x/y is the end point of the curve, x1/y1 are the starting control points for the bezier, and x2/y2 are
  * the ending control points for the bezier.
  *
  * @param startPoint Start position {x, y}
  * @param endPoint  End position {x, y}
  * @param centerPoint Center point of the circle {x, y}
  * @param clockwise `true` if moving clockwise, `false` if counterclockwise
  * @returns Array of curves
  */
 function circularToBezier(startPoint, endPoint, centerPoint, clockwise) {
   // determine distance of lines from center to start and end
   const startCenterDelta = {
     x: startPoint.x - centerPoint.x,
     y: startPoint.y - centerPoint.y,
   };
   const endCenterDelta = {
     x: endPoint.x - centerPoint.x,
     y: endPoint.y - centerPoint.y,
   };
 
   // determine the radius of the arc
   const radius = Math.sqrt(
     startCenterDelta.x * startCenterDelta.x +
       startCenterDelta.y * startCenterDelta.y
   );
 
   // determine the angle of the center-to-start and center-to-end lines (radians)
   const angleCenterStart = Math.atan2(startCenterDelta.y, startCenterDelta.x);
   const angleCenterEnd = Math.atan2(endCenterDelta.y, endCenterDelta.x);
 
   // determine the angle from the center/start to the center/end, which is used to determine if we
   // are going clockwise or counterclockwise the short or long way
   let angleStartCenterEnd = angleCenterEnd - angleCenterStart;
   // let TEMPBEFORE = angleStartCenterEnd;
   if (angleStartCenterEnd >= Math.PI) angleStartCenterEnd -= Math.PI * 2;
   if (angleStartCenterEnd < 0) angleStartCenterEnd += Math.PI * 2;
 
   // if our clockwise direction is the long way, set largeArcFlag so bezier generates the long way around
   const largeArcFlag = clockwise == angleStartCenterEnd <= Math.PI / 2;
 
   // convert circular (points/radius) to bezier
   const curves = arcToBezier({
     px: startPoint.x,
     py: startPoint.y,
     cx: endPoint.x,
     cy: endPoint.y,
     rx: radius,
     ry: radius,
     xAxisRotation: 0,
     largeArcFlag: largeArcFlag,
     sweepFlag: !clockwise,
   });
 
   return curves;
 }
 
 /**
  * Gets a cutSetting object that matches the specifications provided in the `cutSettingSpecs` parameter.  Scans all existing cutSettings in the
  * current project array and if an exact match is found, it returns that object (potentially doing a name change).  If none exist yet, it creates a new
  * entry using the provided specs and returns that.
  *
  * @param cutSettingSpecs Cut settings object, including parameters such as minPower, maxPower and layerMode.
  * @returns The cutSetting object from the project that matches the specs (creating one if a match isn't found)
  */
 function getCutSetting(cutSettingSpecs) {
   for (let c = 0; c < project.cutSettings.length; ++c) {
     const cutSetting = project.cutSettings[c];
     let matchFound = false;
 
     // look to see if we already have a matching cutsetting, based on the custom XML if provided,
     // otherwise the properties of the setting
     if (cutSettingSpecs.customCutSettingXML)
       // if custom cut is used, we expect a perfect string match.  This might someday be
       // improved with a deep object comparison (preceeded by filtering out unwanted fields)
       matchFound =
         cutSetting.customCutSettingXML == cutSettingSpecs.customCutSettingXML;
     // standard properties - see if we match
     else
       matchFound =
         cutSetting.minPower == cutSettingSpecs.minPower &&
         cutSetting.maxPower == cutSettingSpecs.maxPower &&
         cutSetting.speed == cutSettingSpecs.speed &&
         cutSetting.layerMode == cutSettingSpecs.layerMode &&
         cutSetting.laserEnable == cutSettingSpecs.laserEable &&
         cutSetting.useAir == cutSettingSpecs.useAir &&
         cutSetting.zOffset == cutSettingSpecs.zOffset &&
         cutSetting.passes == cutSettingSpecs.passes &&
         cutSetting.zStep == cutSettingSpecs.zStep &&
         cutSetting.customCutSetting === undefined;
 
     // do we have a match?
     if (matchFound) {
       // add this name to the list of operation names that this combined setting is being used for
       cutSetting.operationNames.push(cutSettingSpecs.name);
 
       // combine operation names for the layer name
       cutSetting.name = cutSetting.operationNames.join(', ');
       return cutSetting;
     }
   }
 
   // none exist that match, so create a new one
   cutSettingSpecs.index = project.cutSettings.length;
   cutSettingSpecs.priority = project.cutSettings.length;
   cutSettingSpecs.operationNames = [cutSettingSpecs.name];
   const cutLength = project.cutSettings.push(cutSettingSpecs);
   return project.cutSettings[cutLength - 1];
 }
 
 /**
  * Creates a stock outline with the laser disabled using a pseudo-operation that traces the four
  * sides of the stock
  */
 function traceStockOutline() {
   // get the stock dimensions
   const stock = {
     minX: getGlobalParameter('stock-lower-x'),
     minY: getGlobalParameter('stock-lower-y'),
     maxX: getGlobalParameter('stock-upper-x'),
     maxY: getGlobalParameter('stock-upper-y'),
   };
 
   // set up a private group
   currentGroup = getGroup(STOCK_GROUP_NAME, {
     groupName: STOCK_GROUP_NAME,
     operations: [],
   });
 
   // set up an operation to contain the stock outline
   const paths = [];
   currentGroup.operations.push({
     operationName: STOCK_GROUP_NAME,
     minPower: 100,
     maxPower: 100,
     laserEnable: LASER_ENABLE_OFF,
     layerMode: LAYER_MODE_LINE,
     powerScale: 100,
     powerSource: localize('stock dimensions'),
     customCutSettingXML: '',
     paths: paths,
   });
 
   // add a path outlining the stock
   paths.push({
     type: PATH_TYPE_LINEAR,
     startX: stock.minX,
     startY: stock.minY,
     endX: stock.maxX,
     endY: stock.minY,
     feed: STOCK_FEED_RATE,
   });
   paths.push({
     type: PATH_TYPE_LINEAR,
     startX: stock.maxX,
     startY: stock.minY,
     endX: stock.maxX,
     endY: stock.maxY,
     feed: STOCK_FEED_RATE,
   });
   paths.push({
     type: PATH_TYPE_LINEAR,
     startX: stock.maxX,
     startY: stock.maxY,
     endX: stock.minX,
     endY: stock.maxY,
     feed: STOCK_FEED_RATE,
   });
   paths.push({
     type: PATH_TYPE_LINEAR,
     startX: stock.minX,
     startY: stock.maxY,
     endX: stock.minX,
     endY: stock.minY,
     feed: STOCK_FEED_RATE,
   });
 }
 
 /**************************************************************************************
  *
  * LightBurn file syntax services
  *
  *************************************************************************************/
 
 /**
  * Writes the LightBurn (.lbrn) header information
  */
 function writeHeader() {
   writeXML('VariableText', {}, true);
   writeXML('Start', { Value: '0' });
   writeXML('End', { Value: '999' });
   writeXML('Current', { Value: '0' });
   writeXML('Increment', { Value: '1' });
   writeXML('AutoAdvance', { Value: '0' });
   writeXMLClose();
 
   writeXML('UIPrefs', {}, true);
   writeXML('Optimize_ByLayer', { Value: 1 });
   writeXML('Optimize_ByGroup', { Value: -1 });
   writeXML('Optimize_ByPriority', { Value: 0 });
   writeXML('Optimize_WhichDirection', { Value: 0 });
   writeXML('Optimize_InnerToOuter', { Value: 1 });
   writeXML('Optimize_ByDirection', { Value: 0 });
   writeXML('Optimize_ReduceTravel', { Value: 1 });
   writeXML('Optimize_HideBacklash', { Value: 0 });
   writeXML('Optimize_ReduceDirChanges', { Value: 0 });
   writeXML('Optimize_ChooseCorners', { Value: 0 });
   writeXML('Optimize_AllowReverse', { Value: 1 });
   writeXML('Optimize_RemoveOverlaps', { Value: 0 });
   writeXML('Optimize_OptimalEntryPoint', { Value: 1 });
   writeXMLClose();
 }
 
 /**
  * Adds the <CutSetting> tags for all LightBurn layers as well as update notes to describe
  * the layers
  */
 function writeCutSettings() {
   writeNote('');
   writeNote('Layers:', false);
 
   for (let i = 0; i < project.cutSettings.length; ++i) {
     const cutSetting = project.cutSettings[i];
 
     writeNote('  ' + localize('{layer}: {name}'), {
       layer: formatLeadingZero.format(cutSetting.index),
       name: cutSetting.name,
     });
 
     if (cutSetting.customCutSetting) {
       writeNote(
         '    ' + localize('Settings overridden with custom CutSetting property')
       );
       writeComment(
         localize(
           'CutSetting (layer) {layer}: Settings overridden with custom CutSetting property'
         ),
         {
           layer: formatLeadingZero.format(cutSetting.index),
         },
         COMMENT_DETAIL
       );
     } else {
       if (cutSetting.laserEnable !== LASER_ENABLE_OFF) {
         const laserNames = {};
         laserNames[LASER_ENABLE_1] = localize('laser 1');
         laserNames[LASER_ENABLE_2] = localize('laser 2');
         laserNames[LASER_ENABLE_BOTH] = localize('lasers 1 and 2');
 
         writeNote(
           '    ' +
             localize(
               'Power {min}-{max}% speed {speed} using {lasers} (air {air}, Z offset {zOffset}, passes {passes}, z step {zStep})'
             ),
           {
             min: cutSetting.minPower,
             max: cutSetting.maxPower,
             speed: speedToUnits(cutSetting.speed),
             lasers: laserNames[cutSetting.laserEnable],
             air: cutSetting.useAir ? localize('on') : localize('off'),
             zOffset: cutSetting.zOffset,
             passes: cutSetting.passes,
             zStep: cutSetting.zStep,
           }
         );
 
         // format for comments
         writeComment(
           'CutSetting (layer) {id}: power {min}-{max}% ({source}), speed {speed} {lasers} (air {air}, Z offset {zOffset}, passes {passes}, z step {zStep})',
           {
             id: formatLeadingZero.format(cutSetting.index),
             min: cutSetting.minPower,
             max: cutSetting.maxPower,
             source: cutSetting.powerSource,
             speed: speedToUnits(cutSetting.speed),
             lasers: laserNames[cutSetting.laserEnable],
             air: cutSetting.useAir ? localize('on') : localize('off'),
             zOffset: cutSetting.zOffset,
             passes: cutSetting.passes,
             zStep: cutSetting.zStep,
           },
           COMMENT_DETAIL
         );
       } else {
         // laser is off
         writeNote('    ' + localize('Output turned off'));
       }
     }
 
     // if not custom, generate the cut setting
     if (!cutSetting.customCutSetting) {
       // determine our cut setting type
       let types = {};
       types[LAYER_MODE_LINE] = 'Cut';
       types[LAYER_MODE_FILL] = 'Scan';
       types[LAYER_MODE_OFFSET_FILL] = 'Offset';
 
       writeXML('CutSetting', { type: types[cutSetting.layerMode] }, true);
 
       writeXML('index', { Value: cutSetting.index });
       writeXML('name', { Value: cutSetting.name });
       writeXML('minPower', { Value: cutSetting.minPower });
       writeXML('maxPower', { Value: cutSetting.maxPower });
       writeXML('minPower2', { Value: cutSetting.minPower });
       writeXML('maxPower2', { Value: cutSetting.maxPower });
       writeXML('speed', { Value: formatSpeed.format(cutSetting.speed) });
       writeXML('priority', { Value: cutSetting.priority });
       writeXML('runBlower', { Value: cutSetting.useAir ? 1 : 0 });
       writeXML('zOffset', { Value: cutSetting.zOffset });
       writeXML('numPasses', { Value: cutSetting.passes });
       writeXML('zPerPass', { Value: cutSetting.zStep });
 
       // write the settings for select select and output enable/disable
       switch (cutSetting.laserEnable) {
         case LASER_ENABLE_OFF:
           writeXML('doOutput', { Value: '0' });
           break;
         case LASER_ENABLE_1:
           writeXML('enableLaser1', { Value: '1' });
           writeXML('enableLaser2', { Value: '0' });
           break;
         case LASER_ENABLE_2:
           writeXML('enableLaser1', { Value: '0' });
           writeXML('enableLaser2', { Value: '1' });
           break;
         case LASER_ENABLE_BOTH:
           writeXML('enableLaser1', { Value: '1' });
           writeXML('enableLaser2', { Value: '1' });
           break;
       }
       writeXMLClose();
     } else {
       // adjust the properties that we must override on custom
       const custom = cutSetting.customCutSetting.CutSetting;
       custom.index = { Value: cutSetting.index };
       custom.priority = { Value: cutSetting.priority };
       custom.name = { Value: cutSetting.name };
       writeXMLObject('CutSetting', custom);
     }
   }
 }
 
 /**
  * Writes the shapes (<Shape>) to the LightBurn file, including grouping as necessary
  */
 function writeShapes() {
   // process all operation groups.  These are groups of operations and generate a grouping for
   // LightBurn when there is more than one operation in the group (when the group name property has
   // been used by the user)
   for (let og = 0; og < project.operationGroups.length; ++og) {
     const opGroup = project.operationGroups[og];
 
     // do we have more than one operation in this group?  If so, and enabled, go ahead and group it
     if (
       opGroup.operations.length > 1 &&
       getProperty('lightburn0500GroupOperations')
     ) {
       writeComment(localize('Group: "{name}"'), { group: opGroup.groupName });
 
       writeXML('Shape', { Type: 'Group' }, true);
       writeXML('XForm', { content: '1 0 0 1 0 0' });
       writeXML('Children', {}, true);
     }
 
     // process all operations within the group
     for (let o = 0; o < opGroup.operations.length; ++o) {
       const operation = opGroup.operations[o];
 
       writeComment(localize('Operation: {name}'), {
         name: operation.operationName,
       });
 
       // do we need to group shapes within our operation?
       if (
         operation.shapeGroups.length > 1 &&
         getProperty('lightburn0600GroupShapes')
       ) {
         writeXML('Shape', { Type: 'Group' }, true);
         writeXML('XForm', { content: '1 0 0 1 0 0' });
         writeXML('Children', {}, true);
       }
 
       // loop through all shapes within this operation
       for (let s = 0; s < operation.shapeGroups.length; ++s) {
         const shape = operation.shapeGroups[s];
 
         // write the shape, based on it's type
         if (shape.type == SHAPE_TYPE_ELIPSE) writeShapeElipse(shape);
         else writeShapePath(shape);
       }
 
       // if we grouped the shapes, close the group
       if (
         operation.shapeGroups.length > 1 &&
         getProperty('lightburn0600GroupShapes')
       ) {
         writeXMLClose();
         writeXMLClose();
       }
     }
 
     // if we grouped these operations, close the group now
     if (
       opGroup.operations.length > 1 &&
       getProperty('lightburn0500GroupOperations')
     ) {
       writeXMLClose();
       writeXMLClose();
     }
   }
 }
 
 /**
  * Write an elipse (a closed circle) to the LightBurn file
  *
  * @param shape Shape information (cutIndex, radius, centerX, centerY) to write
  */
 function writeShapeElipse(shape) {
   writeXML(
     'Shape',
     {
       Type: 'Ellipse',
       CutIndex: shape.cutIndex,
       Rx: formatRadius.format(shape.radius),
       Ry: formatRadius.format(shape.radius),
     },
     true
   );
   writeXML('XForm', {
     content:
       '1 0 0 1 ' +
       formatPosition.format(shape.centerX) +
       ' ' +
       formatPosition.format(shape.centerY),
   });
   writeXMLClose();
 }
 
 /**
  * Write a path (lines and beziers) to the LightBurn file
  *
  * @param shape Shape information (cutIndex, vectors[], primitives[]) to write
  */
 function writeShapePath(shape) {
   writeXML('Shape', { Type: 'Path', CutIndex: shape.cutIndex }, true);
   writeXML('XForm', { content: '1 0 0 1 0 0' });
 
   // output the vectors
   for (let i = 0; i < shape.vectors.length; ++i) {
     const vector = shape.vectors[i];
     writeXML('V', {
       vx: formatPosition.format(vector.x),
       vy: formatPosition.format(vector.y),
       c0x:
         vector.c0x !== undefined
           ? formatPosition.format(vector.c0x)
           : undefined,
       c0y:
         vector.c0y != undefined ? formatPosition.format(vector.c0y) : undefined,
       c1x:
         vector.c1x != undefined ? formatPosition.format(vector.c1x) : undefined,
       c1y:
         vector.c1y != undefined ? formatPosition.format(vector.c1y) : undefined,
     });
   }
 
   // output the primitives
   for (let i = 0; i < shape.primitives.length; ++i) {
     const primitive = shape.primitives[i];
 
     writeXML('P', {
       T: primitive.type == PRIMITIVE_TYPE_LINE ? 'L' : 'B',
       p0: primitive.start,
       p1: primitive.end,
     });
   }
 
   // close the shape
   writeXMLClose();
 }
 
 /**
  * Writes the LightBurn (.lbrn) XML header (the `<?xml...?>` tag) along with the
  * LightBurn file headers and thumbnail.  These must be written before any extensive
  * comments due to a bug in LightBurn that causes it to corrupt if the thumbnail is
  * not near the top of the file.
  */
 function writeXMLHeader() {
   writeln('<?xml version="1.0" encoding="UTF-8"?>');
   writeXML(
     'LightBurnProject',
     {
       AppVersion: '1.2.04',
       FormatVersion: 0,
       MaterialHeight: 0,
       MirrorX: false,
       MirrorY: false,
     },
     true
   );
 
   writeXML('Thumbnail', {
     Source:
       'iVBORw0KGgoAAAANSUhEUgAAAPoAAAD6CAMAAAC/MqoPAAACiFBMVEX//////8z//5n//2b//zP//wD/zP//zMz/zJn/zGb/zDP/zAD/mf//mcz/mZn/mWb/mTP/mQD/Zv//Zsz/Zpn/Zmb/ZjP/ZgD/M///M8z/M5n/M2b/MzP/MwD/AP//AMz/AJn/AGb/ADP/AADM///M/8zM/5nM/2bM/zPM/wDMzP/MzMzMzJnMzGbMzDPMzADMmf/MmczMmZnMmWbMmTPMmQDMZv/MZszMZpnMZmbMZjPMZgDMM//MM8zMM5nMM2bMMzPMMwDMAP/MAMzMAJnMAGbMADPMAACZ//+Z/8yZ/5mZ/2aZ/zOZ/wCZzP+ZzMyZzJmZzGaZzDOZzACZmf+ZmcyZmZmZmWaZmTOZmQCZZv+ZZsyZZpmZZmaZZjOZZgCZM/+ZM8yZM5mZM2aZMzOZMwCZAP+ZAMyZAJmZAGaZADOZAABm//9m/8xm/5lm/2Zm/zNm/wBmzP9mzMxmzJlmzGZmzDNmzABmmf9mmcxmmZlmmWZmmTNmmQBmZv9mZsxmZplmZmZmZjNmZgBmM/9mM8xmM5lmM2ZmMzNmMwBmAP9mAMxmAJlmAGZmADNmAAAz//8z/8wz/5kz/2Yz/zMz/wAzzP8zzMwzzJkzzGYzzDMzzAAzmf8zmcwzmZkzmWYzmTMzmQAzZv8zZswzZpkzZmYzZjMzZgAzM/8zM8wzM5kzM2YzMzMzMwAzAP8zAMwzAJkzAGYzADMzAAAA//8A/8wA/5kA/2YA/zMA/wAAzP8AzMwAzJkAzGYAzDMAzAAAmf8AmcwAmZkAmWYAmTMAmQAAZv8AZswAZpkAZmYAZjMAZgAAM/8AM8wAM5kAM2YAMzMAMwAAAP8AAMwAAJkAAGYAADMAAAALihLaAAAACXBIWXMAAAsTAAALEwEAmpwYAAA/o2lUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgOS4wLWMwMDAgNzkuMTcxYzI3ZiwgMjAyMi8wOC8xNi0xODowMjo0MyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtbG5zOnhtcE1NPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvbW0vIiB4bWxuczpzdFJlZj0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL3NUeXBlL1Jlc291cmNlUmVmIyIgeG1sbnM6c3RFdnQ9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZUV2ZW50IyIgeG1sbnM6aWxsdXN0cmF0b3I9Imh0dHA6Ly9ucy5hZG9iZS5jb20vaWxsdXN0cmF0b3IvMS4wLyIgeG1sbnM6eG1wVFBnPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvdC9wZy8iIHhtbG5zOnN0RGltPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvRGltZW5zaW9ucyMiIHhtbG5zOnhtcEc9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9nLyIgeG1sbnM6cGRmPSJodHRwOi8vbnMuYWRvYmUuY29tL3BkZi8xLjMvIiB4bWxuczpwaG90b3Nob3A9Imh0dHA6Ly9ucy5hZG9iZS5jb20vcGhvdG9zaG9wLzEuMC8iIHhtbG5zOnRpZmY9Imh0dHA6Ly9ucy5hZG9iZS5jb20vdGlmZi8xLjAvIiB4bWxuczpleGlmPSJodHRwOi8vbnMuYWRvYmUuY29tL2V4aWYvMS4wLyIgZGM6Zm9ybWF0PSJpbWFnZS9wbmciIHhtcDpNZXRhZGF0YURhdGU9IjIwMjItMTItMDJUMDY6MzA6NTktMDU6MDAiIHhtcDpNb2RpZnlEYXRlPSIyMDIyLTEyLTAyVDA2OjMwOjU5LTA1OjAwIiB4bXA6Q3JlYXRlRGF0ZT0iMjAyMi0xMi0wMVQxMTowMDo0OC0wNDowMCIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBJbGx1c3RyYXRvciAyNy4wIChXaW5kb3dzKSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDphMmFlOGNhNS01YjY1LTliNGEtYWJjYS0yZThlOGU1ZmNiMzciIHhtcE1NOkRvY3VtZW50SUQ9ImFkb2JlOmRvY2lkOnBob3Rvc2hvcDpmNTVhZTg0Zi03NDZmLWQ2NDItYjk3NC03ZGYwYTU4YjAyZDciIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0idXVpZDo1RDIwODkyNDkzQkZEQjExOTE0QTg1OTBEMzE1MDhDOCIgeG1wTU06UmVuZGl0aW9uQ2xhc3M9InByb29mOnBkZiIgaWxsdXN0cmF0b3I6U3RhcnR1cFByb2ZpbGU9IlByaW50IiBpbGx1c3RyYXRvcjpDcmVhdG9yU3ViVG9vbD0iQUlSb2JpbiIgaWxsdXN0cmF0b3I6VHlwZT0iRG9jdW1lbnQiIHhtcFRQZzpIYXNWaXNpYmxlT3ZlcnByaW50PSJGYWxzZSIgeG1wVFBnOkhhc1Zpc2libGVUcmFuc3BhcmVuY3k9IkZhbHNlIiB4bXBUUGc6TlBhZ2VzPSIxIiBwZGY6UHJvZHVjZXI9IkFkb2JlIFBERiBsaWJyYXJ5IDE2LjA3IiBwaG90b3Nob3A6Q29sb3JNb2RlPSIyIiB0aWZmOk9yaWVudGF0aW9uPSIxIiB0aWZmOlhSZXNvbHV0aW9uPSIzMDAwMDAwLzEwMDAwIiB0aWZmOllSZXNvbHV0aW9uPSIzMDAwMDAwLzEwMDAwIiB0aWZmOlJlc29sdXRpb25Vbml0PSIyIiBleGlmOkNvbG9yU3BhY2U9IjY1NTM1IiBleGlmOlBpeGVsWERpbWVuc2lvbj0iMjgwMCIgZXhpZjpQaXhlbFlEaW1lbnNpb249IjI4MDAiPiA8ZGM6dGl0bGU+IDxyZGY6QWx0PiA8cmRmOmxpIHhtbDpsYW5nPSJ4LWRlZmF1bHQiPm51Q2FydmUgTG9nbzwvcmRmOmxpPiA8L3JkZjpBbHQ+IDwvZGM6dGl0bGU+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOmY4MWMyMWEwLTZkYzgtYmM0Yi1iOTExLTk1N2VmM2FjNjA2MCIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDo1OWIxOThmYS04YTYxLTRhNDgtYmViYi1kY2IxZmMwYzlhOTMiIHN0UmVmOm9yaWdpbmFsRG9jdW1lbnRJRD0idXVpZDo1RDIwODkyNDkzQkZEQjExOTE0QTg1OTBEMzE1MDhDOCIgc3RSZWY6cmVuZGl0aW9uQ2xhc3M9InByb29mOnBkZiIvPiA8eG1wTU06SGlzdG9yeT4gPHJkZjpTZXE+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJzYXZlZCIgc3RFdnQ6aW5zdGFuY2VJRD0ieG1wLmlpZDo4MjVmZTk3OC1hMjcxLWUxNDktOGJiZS03OWY3MDFiNzdhMjciIHN0RXZ0OndoZW49IjIwMjItMTItMDFUMDc6NDc6NTUtMDU6MDAiIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkFkb2JlIElsbHVzdHJhdG9yIDI3LjAgKFdpbmRvd3MpIiBzdEV2dDpjaGFuZ2VkPSIvIi8+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJzYXZlZCIgc3RFdnQ6aW5zdGFuY2VJRD0ieG1wLmlpZDo1OWIxOThmYS04YTYxLTRhNDgtYmViYi1kY2IxZmMwYzlhOTMiIHN0RXZ0OndoZW49IjIwMjItMTItMDFUMTA6NTg6MDItMDU6MDAiIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkFkb2JlIElsbHVzdHJhdG9yIDI3LjAgKFdpbmRvd3MpIiBzdEV2dDpjaGFuZ2VkPSIvIi8+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJjb252ZXJ0ZWQiIHN0RXZ0OnBhcmFtZXRlcnM9ImZyb20gYXBwbGljYXRpb24vcGRmIHRvIGFwcGxpY2F0aW9uL3ZuZC5hZG9iZS5waG90b3Nob3AiLz4gPHJkZjpsaSBzdEV2dDphY3Rpb249InNhdmVkIiBzdEV2dDppbnN0YW5jZUlEPSJ4bXAuaWlkOmUwYzY3MTZmLTQwMWItYzE0NC1iZGU4LTEzYTczMWQyNjk2NSIgc3RFdnQ6d2hlbj0iMjAyMi0xMi0wMVQxNDoxOTo0OS0wNTowMCIgc3RFdnQ6c29mdHdhcmVBZ2VudD0iQWRvYmUgUGhvdG9zaG9wIDI0LjAgKFdpbmRvd3MpIiBzdEV2dDpjaGFuZ2VkPSIvIi8+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJzYXZlZCIgc3RFdnQ6aW5zdGFuY2VJRD0ieG1wLmlpZDpmODFjMjFhMC02ZGM4LWJjNGItYjkxMS05NTdlZjNhYzYwNjAiIHN0RXZ0OndoZW49IjIwMjItMTItMDJUMDY6MzA6NTktMDU6MDAiIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkFkb2JlIFBob3Rvc2hvcCAyNC4wIChXaW5kb3dzKSIgc3RFdnQ6Y2hhbmdlZD0iLyIvPiA8cmRmOmxpIHN0RXZ0OmFjdGlvbj0iY29udmVydGVkIiBzdEV2dDpwYXJhbWV0ZXJzPSJmcm9tIGFwcGxpY2F0aW9uL3ZuZC5hZG9iZS5waG90b3Nob3AgdG8gaW1hZ2UvcG5nIi8+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJkZXJpdmVkIiBzdEV2dDpwYXJhbWV0ZXJzPSJjb252ZXJ0ZWQgZnJvbSBhcHBsaWNhdGlvbi92bmQuYWRvYmUucGhvdG9zaG9wIHRvIGltYWdlL3BuZyIvPiA8cmRmOmxpIHN0RXZ0OmFjdGlvbj0ic2F2ZWQiIHN0RXZ0Omluc3RhbmNlSUQ9InhtcC5paWQ6YTJhZThjYTUtNWI2NS05YjRhLWFiY2EtMmU4ZThlNWZjYjM3IiBzdEV2dDp3aGVuPSIyMDIyLTEyLTAyVDA2OjMwOjU5LTA1OjAwIiBzdEV2dDpzb2Z0d2FyZUFnZW50PSJBZG9iZSBQaG90b3Nob3AgMjQuMCAoV2luZG93cykiIHN0RXZ0OmNoYW5nZWQ9Ii8iLz4gPC9yZGY6U2VxPiA8L3htcE1NOkhpc3Rvcnk+IDx4bXBUUGc6TWF4UGFnZVNpemUgc3REaW06dz0iNTQ0Ljk2OTI0OSIgc3REaW06aD0iMjk2LjUwMDY2NiIgc3REaW06dW5pdD0iUGl4ZWxzIi8+IDx4bXBUUGc6UGxhdGVOYW1lcz4gPHJkZjpTZXE+IDxyZGY6bGk+Q3lhbjwvcmRmOmxpPiA8cmRmOmxpPk1hZ2VudGE8L3JkZjpsaT4gPHJkZjpsaT5ZZWxsb3c8L3JkZjpsaT4gPHJkZjpsaT5CbGFjazwvcmRmOmxpPiA8L3JkZjpTZXE+IDwveG1wVFBnOlBsYXRlTmFtZXM+IDx4bXBUUGc6U3dhdGNoR3JvdXBzPiA8cmRmOlNlcT4gPHJkZjpsaT4gPHJkZjpEZXNjcmlwdGlvbiB4bXBHOmdyb3VwTmFtZT0iRGVmYXVsdCBTd2F0Y2ggR3JvdXAiIHhtcEc6Z3JvdXBUeXBlPSIwIj4gPHhtcEc6Q29sb3JhbnRzPiA8cmRmOlNlcT4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkJsYWNrIiB4bXBHOm1vZGU9IkNNWUsiIHhtcEc6dHlwZT0iUFJPQ0VTUyIgeG1wRzpjeWFuPSIwLjAwMDAwMCIgeG1wRzptYWdlbnRhPSIwLjAwMDAwMCIgeG1wRzp5ZWxsb3c9IjAuMDAwMDAwIiB4bXBHOmJsYWNrPSIxMDAuMDAwMDAwIi8+IDxyZGY6bGkgeG1wRzpzd2F0Y2hOYW1lPSJDTVlLIFJlZCIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iMC4wMDAwMDAiIHhtcEc6bWFnZW50YT0iMTAwLjAwMDAwMCIgeG1wRzp5ZWxsb3c9IjEwMC4wMDAwMDAiIHhtcEc6YmxhY2s9IjAuMDAwMDAwIi8+IDxyZGY6bGkgeG1wRzpzd2F0Y2hOYW1lPSJDTVlLIFllbGxvdyIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iMC4wMDAwMDAiIHhtcEc6bWFnZW50YT0iMC4wMDAwMDAiIHhtcEc6eWVsbG93PSIxMDAuMDAwMDAwIiB4bXBHOmJsYWNrPSIwLjAwMDAwMCIvPiA8cmRmOmxpIHhtcEc6c3dhdGNoTmFtZT0iQ01ZSyBHcmVlbiIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iMTAwLjAwMDAwMCIgeG1wRzptYWdlbnRhPSIwLjAwMDAwMCIgeG1wRzp5ZWxsb3c9IjEwMC4wMDAwMDAiIHhtcEc6YmxhY2s9IjAuMDAwMDAwIi8+IDxyZGY6bGkgeG1wRzpzd2F0Y2hOYW1lPSJDTVlLIEN5YW4iIHhtcEc6bW9kZT0iQ01ZSyIgeG1wRzp0eXBlPSJQUk9DRVNTIiB4bXBHOmN5YW49IjEwMC4wMDAwMDAiIHhtcEc6bWFnZW50YT0iMC4wMDAwMDAiIHhtcEc6eWVsbG93PSIwLjAwMDAwMCIgeG1wRzpibGFjaz0iMC4wMDAwMDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkNNWUsgQmx1ZSIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iMTAwLjAwMDAwMCIgeG1wRzptYWdlbnRhPSIxMDAuMDAwMDAwIiB4bXBHOnllbGxvdz0iMC4wMDAwMDAiIHhtcEc6YmxhY2s9IjAuMDAwMDAwIi8+IDxyZGY6bGkgeG1wRzpzd2F0Y2hOYW1lPSJDTVlLIE1hZ2VudGEiIHhtcEc6bW9kZT0iQ01ZSyIgeG1wRzp0eXBlPSJQUk9DRVNTIiB4bXBHOmN5YW49IjAuMDAwMDAwIiB4bXBHOm1hZ2VudGE9IjEwMC4wMDAwMDAiIHhtcEc6eWVsbG93PSIwLjAwMDAwMCIgeG1wRzpibGFjaz0iMC4wMDAwMDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9MTUgTT0xMDAgWT05MCBLPTEwIiB4bXBHOm1vZGU9IkNNWUsiIHhtcEc6dHlwZT0iUFJPQ0VTUyIgeG1wRzpjeWFuPSIxNS4wMDAwMDAiIHhtcEc6bWFnZW50YT0iMTAwLjAwMDAwMCIgeG1wRzp5ZWxsb3c9IjkwLjAwMDAwMCIgeG1wRzpibGFjaz0iMTAuMDAwMDAwIi8+IDxyZGY6bGkgeG1wRzpzd2F0Y2hOYW1lPSJDPTAgTT05MCBZPTg1IEs9MCIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iMC4wMDAwMDAiIHhtcEc6bWFnZW50YT0iOTAuMDAwMDAwIiB4bXBHOnllbGxvdz0iODUuMDAwMDAwIiB4bXBHOmJsYWNrPSIwLjAwMDAwMCIvPiA8cmRmOmxpIHhtcEc6c3dhdGNoTmFtZT0iQz0wIE09ODAgWT05NSBLPTAiIHhtcEc6bW9kZT0iQ01ZSyIgeG1wRzp0eXBlPSJQUk9DRVNTIiB4bXBHOmN5YW49IjAuMDAwMDAwIiB4bXBHOm1hZ2VudGE9IjgwLjAwMDAwMCIgeG1wRzp5ZWxsb3c9Ijk1LjAwMDAwMCIgeG1wRzpibGFjaz0iMC4wMDAwMDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9MCBNPTUwIFk9MTAwIEs9MCIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iMC4wMDAwMDAiIHhtcEc6bWFnZW50YT0iNTAuMDAwMDAwIiB4bXBHOnllbGxvdz0iMTAwLjAwMDAwMCIgeG1wRzpibGFjaz0iMC4wMDAwMDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9MCBNPTM1IFk9ODUgSz0wIiB4bXBHOm1vZGU9IkNNWUsiIHhtcEc6dHlwZT0iUFJPQ0VTUyIgeG1wRzpjeWFuPSIwLjAwMDAwMCIgeG1wRzptYWdlbnRhPSIzNS4wMDAwMDAiIHhtcEc6eWVsbG93PSI4NS4wMDAwMDAiIHhtcEc6YmxhY2s9IjAuMDAwMDAwIi8+IDxyZGY6bGkgeG1wRzpzd2F0Y2hOYW1lPSJDPTUgTT0wIFk9OTAgSz0wIiB4bXBHOm1vZGU9IkNNWUsiIHhtcEc6dHlwZT0iUFJPQ0VTUyIgeG1wRzpjeWFuPSI1LjAwMDAwMCIgeG1wRzptYWdlbnRhPSIwLjAwMDAwMCIgeG1wRzp5ZWxsb3c9IjkwLjAwMDAwMCIgeG1wRzpibGFjaz0iMC4wMDAwMDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9MjAgTT0wIFk9MTAwIEs9MCIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iMjAuMDAwMDAwIiB4bXBHOm1hZ2VudGE9IjAuMDAwMDAwIiB4bXBHOnllbGxvdz0iMTAwLjAwMDAwMCIgeG1wRzpibGFjaz0iMC4wMDAwMDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9NTAgTT0wIFk9MTAwIEs9MCIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iNTAuMDAwMDAwIiB4bXBHOm1hZ2VudGE9IjAuMDAwMDAwIiB4bXBHOnllbGxvdz0iMTAwLjAwMDAwMCIgeG1wRzpibGFjaz0iMC4wMDAwMDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9NzUgTT0wIFk9MTAwIEs9MCIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iNzUuMDAwMDAwIiB4bXBHOm1hZ2VudGE9IjAuMDAwMDAwIiB4bXBHOnllbGxvdz0iMTAwLjAwMDAwMCIgeG1wRzpibGFjaz0iMC4wMDAwMDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9ODUgTT0xMCBZPTEwMCBLPTEwIiB4bXBHOm1vZGU9IkNNWUsiIHhtcEc6dHlwZT0iUFJPQ0VTUyIgeG1wRzpjeWFuPSI4NS4wMDAwMDAiIHhtcEc6bWFnZW50YT0iMTAuMDAwMDAwIiB4bXBHOnllbGxvdz0iMTAwLjAwMDAwMCIgeG1wRzpibGFjaz0iMTAuMDAwMDAwIi8+IDxyZGY6bGkgeG1wRzpzd2F0Y2hOYW1lPSJDPTkwIE09MzAgWT05NSBLPTMwIiB4bXBHOm1vZGU9IkNNWUsiIHhtcEc6dHlwZT0iUFJPQ0VTUyIgeG1wRzpjeWFuPSI5MC4wMDAwMDAiIHhtcEc6bWFnZW50YT0iMzAuMDAwMDAwIiB4bXBHOnllbGxvdz0iOTUuMDAwMDAwIiB4bXBHOmJsYWNrPSIzMC4wMDAwMDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9NzUgTT0wIFk9NzUgSz0wIiB4bXBHOm1vZGU9IkNNWUsiIHhtcEc6dHlwZT0iUFJPQ0VTUyIgeG1wRzpjeWFuPSI3NS4wMDAwMDAiIHhtcEc6bWFnZW50YT0iMC4wMDAwMDAiIHhtcEc6eWVsbG93PSI3NS4wMDAwMDAiIHhtcEc6YmxhY2s9IjAuMDAwMDAwIi8+IDxyZGY6bGkgeG1wRzpzd2F0Y2hOYW1lPSJDPTgwIE09MTAgWT00NSBLPTAiIHhtcEc6bW9kZT0iQ01ZSyIgeG1wRzp0eXBlPSJQUk9DRVNTIiB4bXBHOmN5YW49IjgwLjAwMDAwMCIgeG1wRzptYWdlbnRhPSIxMC4wMDAwMDAiIHhtcEc6eWVsbG93PSI0NS4wMDAwMDAiIHhtcEc6YmxhY2s9IjAuMDAwMDAwIi8+IDxyZGY6bGkgeG1wRzpzd2F0Y2hOYW1lPSJDPTcwIE09MTUgWT0wIEs9MCIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iNzAuMDAwMDAwIiB4bXBHOm1hZ2VudGE9IjE1LjAwMDAwMCIgeG1wRzp5ZWxsb3c9IjAuMDAwMDAwIiB4bXBHOmJsYWNrPSIwLjAwMDAwMCIvPiA8cmRmOmxpIHhtcEc6c3dhdGNoTmFtZT0iQz04NSBNPTUwIFk9MCBLPTAiIHhtcEc6bW9kZT0iQ01ZSyIgeG1wRzp0eXBlPSJQUk9DRVNTIiB4bXBHOmN5YW49Ijg1LjAwMDAwMCIgeG1wRzptYWdlbnRhPSI1MC4wMDAwMDAiIHhtcEc6eWVsbG93PSIwLjAwMDAwMCIgeG1wRzpibGFjaz0iMC4wMDAwMDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9MTAwIE09OTUgWT01IEs9MCIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iMTAwLjAwMDAwMCIgeG1wRzptYWdlbnRhPSI5NS4wMDAwMDAiIHhtcEc6eWVsbG93PSI1LjAwMDAwMCIgeG1wRzpibGFjaz0iMC4wMDAwMDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9MTAwIE09MTAwIFk9MjUgSz0yNSIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iMTAwLjAwMDAwMCIgeG1wRzptYWdlbnRhPSIxMDAuMDAwMDAwIiB4bXBHOnllbGxvdz0iMjUuMDAwMDAwIiB4bXBHOmJsYWNrPSIyNS4wMDAwMDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9NzUgTT0xMDAgWT0wIEs9MCIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iNzUuMDAwMDAwIiB4bXBHOm1hZ2VudGE9IjEwMC4wMDAwMDAiIHhtcEc6eWVsbG93PSIwLjAwMDAwMCIgeG1wRzpibGFjaz0iMC4wMDAwMDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9NTAgTT0xMDAgWT0wIEs9MCIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iNTAuMDAwMDAwIiB4bXBHOm1hZ2VudGE9IjEwMC4wMDAwMDAiIHhtcEc6eWVsbG93PSIwLjAwMDAwMCIgeG1wRzpibGFjaz0iMC4wMDAwMDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9MzUgTT0xMDAgWT0zNSBLPTEwIiB4bXBHOm1vZGU9IkNNWUsiIHhtcEc6dHlwZT0iUFJPQ0VTUyIgeG1wRzpjeWFuPSIzNS4wMDAwMDAiIHhtcEc6bWFnZW50YT0iMTAwLjAwMDAwMCIgeG1wRzp5ZWxsb3c9IjM1LjAwMDAwMCIgeG1wRzpibGFjaz0iMTAuMDAwMDAwIi8+IDxyZGY6bGkgeG1wRzpzd2F0Y2hOYW1lPSJDPTEwIE09MTAwIFk9NTAgSz0wIiB4bXBHOm1vZGU9IkNNWUsiIHhtcEc6dHlwZT0iUFJPQ0VTUyIgeG1wRzpjeWFuPSIxMC4wMDAwMDAiIHhtcEc6bWFnZW50YT0iMTAwLjAwMDAwMCIgeG1wRzp5ZWxsb3c9IjUwLjAwMDAwMCIgeG1wRzpibGFjaz0iMC4wMDAwMDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9MCBNPTk1IFk9MjAgSz0wIiB4bXBHOm1vZGU9IkNNWUsiIHhtcEc6dHlwZT0iUFJPQ0VTUyIgeG1wRzpjeWFuPSIwLjAwMDAwMCIgeG1wRzptYWdlbnRhPSI5NS4wMDAwMDAiIHhtcEc6eWVsbG93PSIyMC4wMDAwMDAiIHhtcEc6YmxhY2s9IjAuMDAwMDAwIi8+IDxyZGY6bGkgeG1wRzpzd2F0Y2hOYW1lPSJDPTI1IE09MjUgWT00MCBLPTAiIHhtcEc6bW9kZT0iQ01ZSyIgeG1wRzp0eXBlPSJQUk9DRVNTIiB4bXBHOmN5YW49IjI1LjAwMDAwMCIgeG1wRzptYWdlbnRhPSIyNS4wMDAwMDAiIHhtcEc6eWVsbG93PSI0MC4wMDAwMDAiIHhtcEc6YmxhY2s9IjAuMDAwMDAwIi8+IDxyZGY6bGkgeG1wRzpzd2F0Y2hOYW1lPSJDPTQwIE09NDUgWT01MCBLPTUiIHhtcEc6bW9kZT0iQ01ZSyIgeG1wRzp0eXBlPSJQUk9DRVNTIiB4bXBHOmN5YW49IjQwLjAwMDAwMCIgeG1wRzptYWdlbnRhPSI0NS4wMDAwMDAiIHhtcEc6eWVsbG93PSI1MC4wMDAwMDAiIHhtcEc6YmxhY2s9IjUuMDAwMDAwIi8+IDxyZGY6bGkgeG1wRzpzd2F0Y2hOYW1lPSJDPTUwIE09NTAgWT02MCBLPTI1IiB4bXBHOm1vZGU9IkNNWUsiIHhtcEc6dHlwZT0iUFJPQ0VTUyIgeG1wRzpjeWFuPSI1MC4wMDAwMDAiIHhtcEc6bWFnZW50YT0iNTAuMDAwMDAwIiB4bXBHOnllbGxvdz0iNjAuMDAwMDAwIiB4bXBHOmJsYWNrPSIyNS4wMDAwMDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9NTUgTT02MCBZPTY1IEs9NDAiIHhtcEc6bW9kZT0iQ01ZSyIgeG1wRzp0eXBlPSJQUk9DRVNTIiB4bXBHOmN5YW49IjU1LjAwMDAwMCIgeG1wRzptYWdlbnRhPSI2MC4wMDAwMDAiIHhtcEc6eWVsbG93PSI2NS4wMDAwMDAiIHhtcEc6YmxhY2s9IjQwLjAwMDAwMCIvPiA8cmRmOmxpIHhtcEc6c3dhdGNoTmFtZT0iQz0yNSBNPTQwIFk9NjUgSz0wIiB4bXBHOm1vZGU9IkNNWUsiIHhtcEc6dHlwZT0iUFJPQ0VTUyIgeG1wRzpjeWFuPSIyNS4wMDAwMDAiIHhtcEc6bWFnZW50YT0iNDAuMDAwMDAwIiB4bXBHOnllbGxvdz0iNjUuMDAwMDAwIiB4bXBHOmJsYWNrPSIwLjAwMDAwMCIvPiA8cmRmOmxpIHhtcEc6c3dhdGNoTmFtZT0iQz0zMCBNPTUwIFk9NzUgSz0xMCIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iMzAuMDAwMDAwIiB4bXBHOm1hZ2VudGE9IjUwLjAwMDAwMCIgeG1wRzp5ZWxsb3c9Ijc1LjAwMDAwMCIgeG1wRzpibGFjaz0iMTAuMDAwMDAwIi8+IDxyZGY6bGkgeG1wRzpzd2F0Y2hOYW1lPSJDPTM1IE09NjAgWT04MCBLPTI1IiB4bXBHOm1vZGU9IkNNWUsiIHhtcEc6dHlwZT0iUFJPQ0VTUyIgeG1wRzpjeWFuPSIzNS4wMDAwMDAiIHhtcEc6bWFnZW50YT0iNjAuMDAwMDAwIiB4bXBHOnllbGxvdz0iODAuMDAwMDAwIiB4bXBHOmJsYWNrPSIyNS4wMDAwMDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9NDAgTT02NSBZPTkwIEs9MzUiIHhtcEc6bW9kZT0iQ01ZSyIgeG1wRzp0eXBlPSJQUk9DRVNTIiB4bXBHOmN5YW49IjQwLjAwMDAwMCIgeG1wRzptYWdlbnRhPSI2NS4wMDAwMDAiIHhtcEc6eWVsbG93PSI5MC4wMDAwMDAiIHhtcEc6YmxhY2s9IjM1LjAwMDAwMCIvPiA8cmRmOmxpIHhtcEc6c3dhdGNoTmFtZT0iQz00MCBNPTcwIFk9MTAwIEs9NTAiIHhtcEc6bW9kZT0iQ01ZSyIgeG1wRzp0eXBlPSJQUk9DRVNTIiB4bXBHOmN5YW49IjQwLjAwMDAwMCIgeG1wRzptYWdlbnRhPSI3MC4wMDAwMDAiIHhtcEc6eWVsbG93PSIxMDAuMDAwMDAwIiB4bXBHOmJsYWNrPSI1MC4wMDAwMDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9NTAgTT03MCBZPTgwIEs9NzAiIHhtcEc6bW9kZT0iQ01ZSyIgeG1wRzp0eXBlPSJQUk9DRVNTIiB4bXBHOmN5YW49IjUwLjAwMDAwMCIgeG1wRzptYWdlbnRhPSI3MC4wMDAwMDAiIHhtcEc6eWVsbG93PSI4MC4wMDAwMDAiIHhtcEc6YmxhY2s9IjcwLjAwMDAwMCIvPiA8L3JkZjpTZXE+IDwveG1wRzpDb2xvcmFudHM+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpsaT4gPHJkZjpsaT4gPHJkZjpEZXNjcmlwdGlvbiB4bXBHOmdyb3VwTmFtZT0iR3JheXMiIHhtcEc6Z3JvdXBUeXBlPSIxIj4gPHhtcEc6Q29sb3JhbnRzPiA8cmRmOlNlcT4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9MCBNPTAgWT0wIEs9MTAwIiB4bXBHOm1vZGU9IkNNWUsiIHhtcEc6dHlwZT0iUFJPQ0VTUyIgeG1wRzpjeWFuPSIwLjAwMDAwMCIgeG1wRzptYWdlbnRhPSIwLjAwMDAwMCIgeG1wRzp5ZWxsb3c9IjAuMDAwMDAwIiB4bXBHOmJsYWNrPSIxMDAuMDAwMDAwIi8+IDxyZGY6bGkgeG1wRzpzd2F0Y2hOYW1lPSJDPTAgTT0wIFk9MCBLPTkwIiB4bXBHOm1vZGU9IkNNWUsiIHhtcEc6dHlwZT0iUFJPQ0VTUyIgeG1wRzpjeWFuPSIwLjAwMDAwMCIgeG1wRzptYWdlbnRhPSIwLjAwMDAwMCIgeG1wRzp5ZWxsb3c9IjAuMDAwMDAwIiB4bXBHOmJsYWNrPSI4OS45OTk0MDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9MCBNPTAgWT0wIEs9ODAiIHhtcEc6bW9kZT0iQ01ZSyIgeG1wRzp0eXBlPSJQUk9DRVNTIiB4bXBHOmN5YW49IjAuMDAwMDAwIiB4bXBHOm1hZ2VudGE9IjAuMDAwMDAwIiB4bXBHOnllbGxvdz0iMC4wMDAwMDAiIHhtcEc6YmxhY2s9Ijc5Ljk5ODgwMCIvPiA8cmRmOmxpIHhtcEc6c3dhdGNoTmFtZT0iQz0wIE09MCBZPTAgSz03MCIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iMC4wMDAwMDAiIHhtcEc6bWFnZW50YT0iMC4wMDAwMDAiIHhtcEc6eWVsbG93PSIwLjAwMDAwMCIgeG1wRzpibGFjaz0iNjkuOTk5NzAwIi8+IDxyZGY6bGkgeG1wRzpzd2F0Y2hOYW1lPSJDPTAgTT0wIFk9MCBLPTYwIiB4bXBHOm1vZGU9IkNNWUsiIHhtcEc6dHlwZT0iUFJPQ0VTUyIgeG1wRzpjeWFuPSIwLjAwMDAwMCIgeG1wRzptYWdlbnRhPSIwLjAwMDAwMCIgeG1wRzp5ZWxsb3c9IjAuMDAwMDAwIiB4bXBHOmJsYWNrPSI1OS45OTkxMDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9MCBNPTAgWT0wIEs9NTAiIHhtcEc6bW9kZT0iQ01ZSyIgeG1wRzp0eXBlPSJQUk9DRVNTIiB4bXBHOmN5YW49IjAuMDAwMDAwIiB4bXBHOm1hZ2VudGE9IjAuMDAwMDAwIiB4bXBHOnllbGxvdz0iMC4wMDAwMDAiIHhtcEc6YmxhY2s9IjUwLjAwMDAwMCIvPiA8cmRmOmxpIHhtcEc6c3dhdGNoTmFtZT0iQz0wIE09MCBZPTAgSz00MCIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iMC4wMDAwMDAiIHhtcEc6bWFnZW50YT0iMC4wMDAwMDAiIHhtcEc6eWVsbG93PSIwLjAwMDAwMCIgeG1wRzpibGFjaz0iMzkuOTk5NDAwIi8+IDxyZGY6bGkgeG1wRzpzd2F0Y2hOYW1lPSJDPTAgTT0wIFk9MCBLPTMwIiB4bXBHOm1vZGU9IkNNWUsiIHhtcEc6dHlwZT0iUFJPQ0VTUyIgeG1wRzpjeWFuPSIwLjAwMDAwMCIgeG1wRzptYWdlbnRhPSIwLjAwMDAwMCIgeG1wRzp5ZWxsb3c9IjAuMDAwMDAwIiB4bXBHOmJsYWNrPSIyOS45OTg4MDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9MCBNPTAgWT0wIEs9MjAiIHhtcEc6bW9kZT0iQ01ZSyIgeG1wRzp0eXBlPSJQUk9DRVNTIiB4bXBHOmN5YW49IjAuMDAwMDAwIiB4bXBHOm1hZ2VudGE9IjAuMDAwMDAwIiB4bXBHOnllbGxvdz0iMC4wMDAwMDAiIHhtcEc6YmxhY2s9IjE5Ljk5OTcwMCIvPiA8cmRmOmxpIHhtcEc6c3dhdGNoTmFtZT0iQz0wIE09MCBZPTAgSz0xMCIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iMC4wMDAwMDAiIHhtcEc6bWFnZW50YT0iMC4wMDAwMDAiIHhtcEc6eWVsbG93PSIwLjAwMDAwMCIgeG1wRzpibGFjaz0iOS45OTkxMDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9MCBNPTAgWT0wIEs9NSIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iMC4wMDAwMDAiIHhtcEc6bWFnZW50YT0iMC4wMDAwMDAiIHhtcEc6eWVsbG93PSIwLjAwMDAwMCIgeG1wRzpibGFjaz0iNC45OTg4MDAiLz4gPC9yZGY6U2VxPiA8L3htcEc6Q29sb3JhbnRzPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6bGk+IDxyZGY6bGk+IDxyZGY6RGVzY3JpcHRpb24geG1wRzpncm91cE5hbWU9IkJyaWdodHMiIHhtcEc6Z3JvdXBUeXBlPSIxIj4gPHhtcEc6Q29sb3JhbnRzPiA8cmRmOlNlcT4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9MCBNPTEwMCBZPTEwMCBLPTAiIHhtcEc6bW9kZT0iQ01ZSyIgeG1wRzp0eXBlPSJQUk9DRVNTIiB4bXBHOmN5YW49IjAuMDAwMDAwIiB4bXBHOm1hZ2VudGE9IjEwMC4wMDAwMDAiIHhtcEc6eWVsbG93PSIxMDAuMDAwMDAwIiB4bXBHOmJsYWNrPSIwLjAwMDAwMCIvPiA8cmRmOmxpIHhtcEc6c3dhdGNoTmFtZT0iQz0wIE09NzUgWT0xMDAgSz0wIiB4bXBHOm1vZGU9IkNNWUsiIHhtcEc6dHlwZT0iUFJPQ0VTUyIgeG1wRzpjeWFuPSIwLjAwMDAwMCIgeG1wRzptYWdlbnRhPSI3NS4wMDAwMDAiIHhtcEc6eWVsbG93PSIxMDAuMDAwMDAwIiB4bXBHOmJsYWNrPSIwLjAwMDAwMCIvPiA8cmRmOmxpIHhtcEc6c3dhdGNoTmFtZT0iQz0wIE09MTAgWT05NSBLPTAiIHhtcEc6bW9kZT0iQ01ZSyIgeG1wRzp0eXBlPSJQUk9DRVNTIiB4bXBHOmN5YW49IjAuMDAwMDAwIiB4bXBHOm1hZ2VudGE9IjEwLjAwMDAwMCIgeG1wRzp5ZWxsb3c9Ijk1LjAwMDAwMCIgeG1wRzpibGFjaz0iMC4wMDAwMDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9ODUgTT0xMCBZPTEwMCBLPTAiIHhtcEc6bW9kZT0iQ01ZSyIgeG1wRzp0eXBlPSJQUk9DRVNTIiB4bXBHOmN5YW49Ijg1LjAwMDAwMCIgeG1wRzptYWdlbnRhPSIxMC4wMDAwMDAiIHhtcEc6eWVsbG93PSIxMDAuMDAwMDAwIiB4bXBHOmJsYWNrPSIwLjAwMDAwMCIvPiA8cmRmOmxpIHhtcEc6c3dhdGNoTmFtZT0iQz0xMDAgTT05MCBZPTAgSz0wIiB4bXBHOm1vZGU9IkNNWUsiIHhtcEc6dHlwZT0iUFJPQ0VTUyIgeG1wRzpjeWFuPSIxMDAuMDAwMDAwIiB4bXBHOm1hZ2VudGE9IjkwLjAwMDAwMCIgeG1wRzp5ZWxsb3c9IjAuMDAwMDAwIiB4bXBHOmJsYWNrPSIwLjAwMDAwMCIvPiA8cmRmOmxpIHhtcEc6c3dhdGNoTmFtZT0iQz02MCBNPTkwIFk9MCBLPTAiIHhtcEc6bW9kZT0iQ01ZSyIgeG1wRzp0eXBlPSJQUk9DRVNTIiB4bXBHOmN5YW49IjYwLjAwMDAwMCIgeG1wRzptYWdlbnRhPSI5MC4wMDAwMDAiIHhtcEc6eWVsbG93PSIwLjAwMzEwMCIgeG1wRzpibGFjaz0iMC4wMDMxMDAiLz4gPC9yZGY6U2VxPiA8L3htcEc6Q29sb3JhbnRzPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6bGk+IDxyZGY6bGk+IDxyZGY6RGVzY3JpcHRpb24geG1wRzpncm91cE5hbWU9IkNvcnBvcmF0ZSIgeG1wRzpncm91cFR5cGU9IjEiPiA8eG1wRzpDb2xvcmFudHM+IDxyZGY6U2VxPiA8cmRmOmxpIHhtcEc6c3dhdGNoTmFtZT0iQ29ycG9yYXRlIExvZ28iIHhtcEc6dHlwZT0iUFJPQ0VTUyIgeG1wRzp0aW50PSIxMDAuMDAwMDAwIiB4bXBHOm1vZGU9IkNNWUsiIHhtcEc6Y3lhbj0iMTcuNzA5NjIwIiB4bXBHOm1hZ2VudGE9IjUyLjI0NTM2MSIgeG1wRzp5ZWxsb3c9IjgzLjg5ODY3NSIgeG1wRzpibGFjaz0iMi4wNDQ3MDkiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkNvcnBvcmF0ZSBCcmFuZCIgeG1wRzp0eXBlPSJQUk9DRVNTIiB4bXBHOnRpbnQ9IjEwMC4wMDAwMDAiIHhtcEc6bW9kZT0iQ01ZSyIgeG1wRzpjeWFuPSIwLjc5MDQxNyIgeG1wRzptYWdlbnRhPSI5OC41NDQyODgiIHhtcEc6eWVsbG93PSI5NS4zNDkwNTAiIHhtcEc6YmxhY2s9IjAuMDg4NTAyIi8+IDwvcmRmOlNlcT4gPC94bXBHOkNvbG9yYW50cz4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOmxpPiA8cmRmOmxpPiA8cmRmOkRlc2NyaXB0aW9uIHhtcEc6Z3JvdXBOYW1lPSJDb3Jwb3JhdGUgY29weSIgeG1wRzpncm91cFR5cGU9IjEiPiA8eG1wRzpDb2xvcmFudHM+IDxyZGY6U2VxPiA8cmRmOmxpIHhtcEc6c3dhdGNoTmFtZT0iQ29ycG9yYXRlIExvZ28gY29weSIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iMTcuNzA5NjIwIiB4bXBHOm1hZ2VudGE9IjUyLjI0NTM2MSIgeG1wRzp5ZWxsb3c9IjgzLjg5ODY3NSIgeG1wRzpibGFjaz0iMi4wNDQ3MDkiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkNvcnBvcmF0ZSBCcmFuZCBjb3B5IiB4bXBHOm1vZGU9IkNNWUsiIHhtcEc6dHlwZT0iUFJPQ0VTUyIgeG1wRzpjeWFuPSIwLjc5MDQxNyIgeG1wRzptYWdlbnRhPSI5OC41NDQyODgiIHhtcEc6eWVsbG93PSI5NS4zNDkwNTAiIHhtcEc6YmxhY2s9IjAuMDg4NTAyIi8+IDwvcmRmOlNlcT4gPC94bXBHOkNvbG9yYW50cz4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOmxpPiA8cmRmOmxpPiA8cmRmOkRlc2NyaXB0aW9uIHhtcEc6Z3JvdXBOYW1lPSJCbGFjayIgeG1wRzpncm91cFR5cGU9IjEiPiA8eG1wRzpDb2xvcmFudHM+IDxyZGY6U2VxPiA8cmRmOmxpIHhtcEc6c3dhdGNoTmFtZT0iQmxhY2sgTG9nbyIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iNzQuOTcyMTQ3IiB4bXBHOm1hZ2VudGE9IjY3LjkxOTQyNyIgeG1wRzp5ZWxsb3c9IjY3LjA0OTY2NCIgeG1wRzpibGFjaz0iOTAuMTQ1NzE5Ii8+IDxyZGY6bGkgeG1wRzpzd2F0Y2hOYW1lPSJCbGFjayBCcmFuZCIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iNzQuOTc1MTk5IiB4bXBHOm1hZ2VudGE9IjY3Ljg1ODM5MiIgeG1wRzp5ZWxsb3c9IjY3LjA0MzU2MSIgeG1wRzpibGFjaz0iOTAuMDQ4MDYzIi8+IDwvcmRmOlNlcT4gPC94bXBHOkNvbG9yYW50cz4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOmxpPiA8cmRmOmxpPiA8cmRmOkRlc2NyaXB0aW9uIHhtcEc6Z3JvdXBOYW1lPSJXaGl0ZSIgeG1wRzpncm91cFR5cGU9IjEiPiA8eG1wRzpDb2xvcmFudHM+IDxyZGY6U2VxPiA8cmRmOmxpIHhtcEc6c3dhdGNoTmFtZT0iV2hpdGUgTG9nbyIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iMC4wMDAwMDAiIHhtcEc6bWFnZW50YT0iMC4wMDAwMDAiIHhtcEc6eWVsbG93PSIwLjAwMDAwMCIgeG1wRzpibGFjaz0iMC4wMDAwMDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IldoaXRlIEJyYW5kIiB4bXBHOm1vZGU9IkNNWUsiIHhtcEc6dHlwZT0iUFJPQ0VTUyIgeG1wRzpjeWFuPSIwLjAwMDAwMCIgeG1wRzptYWdlbnRhPSIwLjAwMDAwMCIgeG1wRzp5ZWxsb3c9IjAuMDAwMDAwIiB4bXBHOmJsYWNrPSIwLjAwMDAwMCIvPiA8L3JkZjpTZXE+IDwveG1wRzpDb2xvcmFudHM+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpsaT4gPC9yZGY6U2VxPiA8L3htcFRQZzpTd2F0Y2hHcm91cHM+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+2O+yoAAACmFJREFUeNrtnL2ZqzoQht3BaYAuTESkCHehiGjpwpGcrBoRyZliaOcC+kEjCbC9nL0YDX54dgHz83r06RsJweVCE0000UQTTTTRdOqpP8OUKfY7+P3ZpmzBn4bv+1zZ+z5X9r7Plb3vc2Xv+1zZ+z5X9r7Plj1f9L7Plj1f9L7Plp3QCT0n9L7Plp3QCZ3QCZ3QCZ3QCZ3QCZ3QCZ3QCZ3QCZ3QCZ3QCZ3QCZ3QCZ3QCZ3QCZ3QCZ3QCf1/QAchuOCc37kQOaED59eqrNzM75AFOvCB9095ra6l95ffz4/+KKuFT3du9PsQcR3nxF8uTozOK6TxaL6fFb0z8dXzVLsPM/fWVdU50Tut6TG+5cMv24LPiq/OiP6Y431P1fo29udD75ymH8nNwm0/G3pnfbxa/ob1+ZOhV0bLfLX+3/7O56Fz49/r7lUanxcnQu+e9O3K5PQnQjf19zaSqefFadC7pz0bjL+fBt3E8pmWqXi2fHwGutJ+/RyOyfdOgs61X6vwFxn7aYSK23ajv3fjdtHdhXjc9V+/aPjr7d9OHRA96dau3c67pW/j9rzvF8n2/gGjLnT93gXrvHY6itddr+9GR/Tb815dmG7vdwdEj706bLerOAcY6kTcf4ejnmjvHzDqVVRnc7/dPs0i8oN7r9B3Sj/q0f7XRF1yAHQe9rxhrV4DJZtaQFit6+0lD/e/ov0PqXUIYwIuTpxXrg0flYnRGXg5zAtaL0uzveRH1brRLuqz0O32McVRvExv54vLVusQ5A3Hi7pph3dIy4PPd65Gn5ZnNKG3z1X+tIy1jvKELp03/P/oIsjfjdIfQV3Awzw+aAFEWi8Xlw8UdePTuI9Ohb6/uKzzuzLydYXK1RG1LnQdHCxXqPyW/pV3r2pdHFrr1wpmknHZI1FBu07oZaT1lK+roFwdVetlsMyjrL17UevXj9G68vJa7ONKaxvWtR77Omn96Fr/M5MJfT8da/1PoPVz+vpeWv9AX99L6+Tr5OtZ+frnaJ18nXydfP09rUM2vh4uW21noPUu7KvngbbP6+tmu7tHo8I+3I/39bBvrkNRHtWufxxlRtmJxTMcTev6nuj9cecLWtfbu1j71sevFe9Ux+PxdVE5OpbWwznWup5HAP2/dy/qkbjH5o1T0NrnB9V6PP498vV5vR4v79+GW93f3L8X/VG1Hnxirc/reTTypuPB/k0f7S8Oq/Xgfnis9cqNnXoEvj2xo/3RILR7WDccXOvlita71FhaT+8VpuS7jLX7N1Hn3j1RN3tR99cLXYJTY6Qnb6jK8Akp2GfM1UGec3ssqTdVqPk+I+0Ogm7HUzyTlYvo/vxHo9uxNs9U2ub+vDgLem/8ezvsfK9nJw6D/nhyfEy325ja4zzOa31+4xcyPs/PhK6s/8N6zHcbP3+gh7jvdmzVst7vdsycOhe6exLm+lgoF9yOm9vlwYFDPbo/j6lMPDcCrt1e7vM06LHeWsDn3P6By7QSuz8He7AXNnC/nS7uneoVqO7O/fb/Xk8AH+1dFaIq1z98t4feD/eaDsVXnncfXG2/x/0P+IaSx/Lz7ru+5+CQL2fhZXL8+85vtzjoe2k67o97nzTO936zxa+iQ/98d5rqOHfPQwzc+7/S47fQQTYtuxU31jbwPH8HXafgH73I5HfQJWNFUbi5gSOI6ldeydMWt+DTQhboDSvqIdZ14f9lIgP0QeG1iTX625wenTmNDzXcWNe55ebk6Myom7l6HaRd15wavdExrjFlU+u4f38I+pCPwKv1Mhhdh/tJsz74NsjVU7x2/uFoUsLP0WF05jF+LaqZoWmHD251jmtaJ/RJ13FP2l+t99bL3qz3sya4YHOOaftwdjktQ+if+EpAmhyiZvAzdOl5MpPz+vYWxVR7uLmA4paKuXdEt+kb+b7EJWesF1r7fb3M8OH0VvdLfqGjwQ/QGfblOVZyWoZAx8P3wNsvXZsNdf0QJzH7APJ9n8xfP36fTcuYR28H+4sHeUTzNjoLfdmxi3TUax11qBPxWfMB7zwsqi+m9WDIboVEKvMdA+I8gr2JjvPvaf5yUR+X4zpd//5ab3KbPDr+ODt0f70wRcTbPtcpEH/f5RRvoUuncQnSZuPgb0NRl3Okm1tci696/3gG5/oMad1s947r/aSmTjG/o80a0NGad9CNXoQfZ1OiTVwhyNgLo/VJa9vlvSm0Jq3uhdaoU2gRbDdavgV1kblCpq/PtY+Evv5EDrGJLrVmwP+Fa/ubC7wt0HqsyeSkNdmiNdO6xdzAO4eJjluW+n+J2o11svRtorNZY37cW+9/SGsd2ByLtbZ8MZcTe7Vau9LXLnpLDW4DSC9HqBP1C0vXOVvoMnZRz7nXtY6de13pEGaB7igpH2eoFvGOANiBUGbwMvrkjzJuf8Omr/+dvrcVdYh8fPZ5mH29Da6qmEu18OqUqd5gf5N5iXgRfapNa4SufRO2ff0prYPz63CtOYfWerNYKvp2vh5TIm8s+Exr5YvobVyHi1l7676O6un1tl2IrpjbF7y6Jcg1lC0VzkgSOchi/8BTUb/JhYisa5094+synfHNcUoqFebt0t9+K5Y/r0c9qsNFgbS+7Ovt5L+w2XNXxL8PeHEK2g1+/jbnHYD6hOoi8fflqNcbWq83cvi62Y56XcRRr72o13H9rP1b2Lqi7X3dp+f2La3Lt7RucvN02BVAr3owHh3WvmJD6+bYLMw7tNYbiT8Cxo/611pvPe3KlMui7ECmndhtXXZlm11g15deb4Hf0TJ++pejXidqeKt18P3VeajrfYE6qdP5uGOdoNvVcUxdOzvh67rED+ubIO+Y6iHGYvUM69Wuvh5nWlM5cPoW6brVRqf+1meo09namtZx/z7gPevvRH+D6HfVutWWn32jOp/h9r3V+Zf2Wubl6E3cj7uqdVPPzMfx83lUdzRx+34HrduWsgza1oE/B0cQ1ml91XpxbZATw1J7e3bsxNo57l9LJe9nvm79tZ7uMIDtXxf+72R8lUm9Vkjnt+BKimlvge1LrYstX7d5vqnne1zu3PmENO139npXxbqvW++e+r+ch7I4Rze6ZL7PgteCmff1vXhV6+Y66qBMmlwD9c/VyV7ZH2p91qU3h1eYzqkhbH/H86rWbds8PJ/VdhH16e2r9aCPPp2Ps0RGnWqJoaNsa9323cuF9Vs98W/7ugyWbb936hqHMoj72SOnUS3aLtWmr89+Dan7Xei+AbzVDz9GndVrUR8D7/rRl0ZLAPP6xZPjSaBB25+o4XHmuHi+5u0bT2OerRLr8OWL8U7YkCsvN1OUvj83fAcW7w+O2+0oo/m8Otdfuge6NDJeTffm4sz9F4cWHHcidEIndEIndEIndEIndEIndEIndEIndEIndEIndEIndEIndEIndEIndEIndEIndEIndEIndEIndEIndEIndEIndEIndEIndEIn9I9Dv+RLTuiEnhf6JV/ynNEv+ZLnjH7Jl/z07JdLruyXS67sl0uu7JdLruyXS67slyenbMFPB395ecoUmyaaaKKJJppo+rzpP9PJeNIeBS0+AAAAAElFTkSuQmCC',
   });
 
   writeln('');
   writeCommentAndNote(localize('Post processor: {description} ({version})'), {
     description: description,
     version: semVer,
   });
   writeCommentAndNote(codeMoreInformation);
   writeCommentAndNote('');
 }
 
 /**
  * Writes the LightBurn (.lbrn) trailer information, including optionally adding notes and
  * closing off the LightBurnProject section opened in `writeHeader`.
  *
  * Notes are injected (if requested in post preferences by the user) using the `notes` variable.
  */
 function writeTrailer() {
   if (includeNotes != INCLUDE_NOTES_NONE && notes != '')
     writeXML('Notes', {
       ShowOnLoad: includeNotes == INCLUDE_NOTES_SHOW ? 1 : 0,
       Notes: notes.replace(/\n/g, NOTES_NEWLINE),
     });
 
   writeXMLClose();
 }
 
 /**
  * Writes an XML tag to the output file, including adding indentation, parameters and optionally
  * leaving the tag open or closing it.  If the tag is left open, the tag name is pushed onto a stack
  * so a future call to `writeXMLClose` will close the matching tag.  When tags are left open, the
  * indentation of the XML is increased for pretty alignment.
  *
  * Members of the `parameters` object that are strings, numbers booleans are rendered as attributes for
  * the tag, except for the special property name 'content' (case sensitive) which will be rendered
  * as the content of the xml tag.
  *
  * @param tag Name of the tag
  * @param parameters Object containing key/value pairs for each parameter
  * @param leaveOpen Optional (default false) flag to specify to leave the tag open, pending a future call to `writeXMLClose`
  */
 function writeXML(tag, parameters, leaveOpen) {
   if (parameters === undefined) parameters = {};
   if (leaveOpen === undefined) leaveOpen = false;
 
   let xml = '<' + tag;
   for (key in parameters) {
     if (
       (typeof parameters[key] === 'string' ||
         typeof parameters[key] === 'number' ||
         typeof parameters[key] === 'boolean') &&
       key != 'content'
     ) {
       if (typeof parameters[key] === 'boolean')
         xml += ' ' + key + '="' + (parameters[key] ? 'True' : 'False') + '"';
       else xml += ' ' + key + '="' + parameters[key] + '"';
     }
   }
 
   // we handle the content a bit differently if we are auto-closing the tag, since the
   // content needs to keep the tag open briefly
   if (leaveOpen) {
     xml += '>';
     if (parameters.content) xml += parameters.content;
   } else {
     if (parameters.content) xml += '>' + parameters.content + '</' + tag + '>';
     else xml += ' />';
   }
 
   writeBlock(xml);
   if (leaveOpen) xmlStack.push(tag);
 }
 
 /**
  * Close a tag previously opened with `writeXML` (with `leaveOpen` set to true).  All calls to open/close must
  * be symmetrical, as the tag name is stored in a stack and closed based on order of execution.  An error will
  * be generated if an attempt is made to close a tag when none exist on the stack.
  */
 function writeXMLClose() {
   if (xmlStack.length === 0) {
     error(
       localize('Internal error: Attempt to close XML tag when none are open.')
     );
     return;
   }
   writeBlock('</' + xmlStack.pop() + '>');
 }
 
 /**
    Write a single line to the file with multiple arguments.
  
    @param arguments Variable number of arguments to write to the file on a single line
  */
 function writeBlock() {
   const spaces = '                                        ';
   write(spaces.slice(0, xmlStack.length * 2));
   for (let i = 0; i < arguments.length; ++i) write(arguments[i]);
   writeln('');
 }
 
 /**
  * Format a string as a comment for XML
  *
  * @param text Text comment to format
  * @returns String with the XML formatted comment
  */
 function formatComment(text) {
   return '<!-- ' + text + ' -->';
 }
 
 /**
  * Write a comment formatted for XML to the file including a newine at the end.  User preferences
  * determines the detail level of comments.  Supports template strings (see `format`)
  *
  * @param template Template comment to format and write to the file
  * @param parameters Optional key/value dictionary with parameters from template (such as {name})
  * @param level Optional level of the comment (COMMENT_NORMAL, COMMENT_DETAIL, COMMENT_DEBUG, COMMENT_INSANE); defaults to COMMENT_NORMAL
  */
 function writeComment(template, parameters, level) {
   const text = format(template, parameters);
   text = text.replace(/[ \n]+$/, '');
 
   if (level === undefined) level = COMMENT_NORMAL;
   switch (includeComments) {
     case INCLUDE_COMMENTS_NONE:
       return;
     case INCLUDE_COMMENTS_NORMAL:
       if (level > COMMENT_NORMAL) return;
       break;
     case INCLUDE_COMMENTS_DETAILED:
       if (level > COMMENT_DETAIL) return;
       break;
     case INCLUDE_COMMENTS_DEBUG:
       if (level > COMMENT_DEBUG) return;
       break;
     case INCLUDE_COMMENTS_INSANE:
       break;
   }
 
   if (text == '\n' || text == '') writeln('');
   else {
     var commentPrefix = '';
     if (level == COMMENT_DEBUG) commentPrefix = '+ ';
     else if (level == COMMENT_INSANE) commentPrefix = '! ';
     writeBlock(formatComment(commentPrefix + text));
   }
 }
 
 /**
  * Add a line to the LightBurn notes field.
  *
  * @param template Template comment to format and write to the notes field
  * @param parameters Optional key/value dictionary with parameters from template (such as {name})
  */
 function writeNote(template, parameters) {
   const text = format(template, parameters);
   notes += text + NOTES_NEWLINE;
 }
 
 /**
  * Write a line to the comments as well as add it to LightBurn file notes
  *
  * @param template Template comment to format and write to the comments and notes field
  * @param parameters Optional key/value dictionary with parameters from template (such as {name})
  */
 function writeCommentAndNote(template, parameters) {
   const text = format(template, parameters);
   writeComment(text);
   writeNote(text);
 }
 
 /**
  * Simple XML parser
  *
  * This limited parser handles nested xml tags with attributes.  It has support
  * only for non-duplicate tag names with attributes and content within a tag.
  * There is no handling of special character codes for xml.  Very limited
  * detection of malformed XML.  Results in a nested object where the name of the
  * tag is the name of the member of the object, and the value of the member is
  * either the value of an attribute, or another object (for nested xml).
  *
  * For example:
  *
  * `<one><two v1="1" v2="2"><three v3="3" /><four>example</four></two></one>`
  *
  * translates to:
  *
  * `{ one: { two: { v1: '1', v2: '2', three: { v3: '3' }, four: { content: 'example' } } } }`
  *
  * @param xml XML string to parse
  * @returns Nested object with members, of undefined if XML could not be parsed.
  */
 function parseXML(xml) {
   let startTagPos = -1;
   let endTagPos = 0;
   let tagEndPosition = 0;
   let objStack = [{}];
 
   while (true) {
     // locate the starting tag and ending of the tag
     startTagPos = xml.indexOf('<', startTagPos + 1);
     if (startTagPos === -1) break;
     endTagPos = xml.indexOf('>', startTagPos + 1);
     if (endTagPos === -1) return undefined;
 
     let xmlElement = xml.substring(startTagPos, endTagPos + 1);
     // ignore processing instructions, such as <?xml?>
     if (xmlElement[1] === '?') continue;
 
     // if this is a closing element pop up to the parent tag/object
     if (xmlElement[1] === '/') {
       objStack.pop();
       continue;
     }
 
     // identify just the tag (name) of the xml element and if it is self-closing
     tagEndPosition = xmlElement.indexOf(' ');
     if (tagEndPosition === -1) tagEndPosition = xmlElement.length - 1;
     let tagName = xmlElement.substring(1, tagEndPosition);
     let selfContainedTag = xmlElement[xmlElement.length - 2] === '/';
 
     // create a new object for this tag
     let currentTagObject = {};
     objStack[objStack.length - 1][tagName] = currentTagObject;
     objStack.push(currentTagObject);
 
     // parse the attributes
     let match = xmlElement.match(/\w+\=\".*?\"/g);
     if (match !== null) {
       for (let i = 0; i < match.length; i++) {
         let index = match[i].indexOf('"');
         let attrName = match[i].substring(0, index - 1);
         let attrValue = match[i].substring(index + 1, match[i].length - 1);
         currentTagObject[attrName] = attrValue;
       }
     }
 
     // if this is a self-contained tag, close it by poping the object off the stack
     if (selfContainedTag) objStack.pop();
     else {
       let nextTagPos = xml.indexOf('<', endTagPos + 1);
       if (nextTagPos > endTagPos + 1) {
         var content = xml.substring(endTagPos + 1, nextTagPos).trim();
         if (content.length) currentTagObject['content'] = content;
       }
     }
   }
 
   // make sure we have decended back to the top element
   if (objStack.length != 1) return undefined;
 
   return objStack[0];
 }
 
 /**
  * Write an object as a nested XML sequence to the file.  Uses the same object format as provided by
  * `parseXML`, where properties that are strings/numbers/booleans are treated as attributes of the
  * tag, and objects are treated as child XML tags to be descended into.
  *
  * @param tag Tag of the parent object
  * @param obj Object to enumerate and write as XML
  */
 function writeXMLObject(tag, obj) {
   let hasChildren = false;
   for (key in obj) {
     if (typeof obj[key] === 'object') {
       hasChildren = true;
       break;
     }
   }
   writeXML(tag, obj, hasChildren);
   if (hasChildren) {
     for (key in obj) {
       if (typeof obj[key] === 'object') writeXMLObject(key, obj[key]);
     }
     writeXMLClose();
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
   const speedUnits = getProperty('lightburn0400IncludeNotes');
   if (speedUnits == SPEED_UNITS_MMPM)
     return formatSpeed.format(speedInMMPM) + ' ' + localize('mm/min');
 
   return formatSpeed.format(speedInMMPM) + ' ' + localize('mm/sec');
 }
 
 /**
  * String template service, similar to template literals in more modern javascript engines.  The template
  * string can have parameters in braces, such as "My name is {name}".  The second parameter is an object
  * with named parameters to substitute, in this example {name: "Billy"}.
  *
  * @param template Template string to format
  * @param parameters Key/value dictionary of parameters to substitute
  * @returns Formatted string
  */
 function format(template, parameters) {
   // callback to replace that handles {tag} and swaps parameters[tag] (handling boolean)
   function replaceToken(parameterWithBraces) {
     const parameterName = parameterWithBraces.substring(
       1,
       parameterWithBraces.length - 1
     );
     const replacement = parameters ? parameters[parameterName] : parameterName;
     if (typeof replacement === 'boolean') return replacement ? 'True' : 'False';
     return replacement !== undefined ? replacement : parameterWithBraces;
   }
 
   return template.replace(/{\w+}/g, replaceToken);
 }
 
 /**************************************************************************************
  *
  * Secure access APIs
  *
  *************************************************************************************/
 
 /**************************************************************************************
  *
  * Automatic update checking APIs
  *
  *************************************************************************************/
 
 /**
  * Determines if an update to this post-processor is available, according to post properties
  * `laserpost0100AutomaticUpdate` (how often to check) and `laserpost0200UpdateAllowBeta` 
  * (if beta releases are allowed).  
  *
  * Displays a message if an update is available.
  *
  * @returns `true` if an update is available, `false` if no update or did not check
  */
 function checkUpdateAvailability() {
   // determine parameters for doing update checking from the post properties
   const allowBeta = getProperty('laserpost0200UpdateAllowBeta');
   let timeBetweenChecksMs = 0;
   switch (getProperty('laserpost0100AutomaticUpdate')) {
     case UPDATE_FREQUENCY_NEVER:
       timeBetweenChecksMs = undefined;
       break;
     case UPDATE_FREQUENCY_ALWAYS:
       timeBetweenChecksMs = 0;
       break;
     case UPDATE_FREQUENCY_HOURLY:
       timeBetweenChecksMs = 60 * 1000 * 1000;
       break;
     case UPDATE_FREQUENCY_DAILY:
       timeBetweenChecksMs = 24 * 60 * 1000 * 1000;
       break;
     case UPDATE_FREQUENCY_WEEKLY:
       timeBetweenChecksMs = 7 * 24 * 60 * 1000 * 1000;
       break;
     case UPDATE_FREQUENCY_MONTHLY:
       timeBetweenChecksMs = 30 * 7 * 24 * 60 * 1000 * 1000;
       break;
   }
 
   // are we even allowed to check?
   if (timeBetweenChecksMs === undefined)
     return false;
 
   // have we every checked?
   if (activeState.updateEpoch) {
     if (Date.now() - activeState.updateEpoch < timeBetweenChecksMs)
       return false;
   }
   // check the version
   const version = getVersionFromWeb(!allowBeta);
   if (version) {
     // track this update check
     activeState.updateEpoch = Date.now();
     if (version && version.compare && version.compare.content && version.compare.content === 'upgrade') {
       showWarning(localize('LaserPost update "{version}" available:\n\n{summary}\n\nRelease notes and download: {url}'), {
         version: version.semver.content,
         url: version.homepage.content.replace(/\/$/, ''),
         summary: version.notes.summary.content
       });
       return true;
     }
     return false;
   }
   // we failed to get version info, so reset the timer to try again soon
   activeState.updateEpoch += RETRY_VERSION_CHECK_ON_FAILURE_TIME_MS;
   return false;
 }
 
 /**
  * Gets the version object from the web (using the nuCarve.com web server `version-check` API)
  *
  * @param stableOnly `true` to get only stable releases, `false` to allow beta releases
  * @returns Version object if available, else undefined
  */
 function getVersionFromWeb(stableOnly) {
   if (stableOnly === undefined) stableOnly = true;
 
   // make sure we are allowed to access the net
   ensureSecurityRights();
 
   // issue the API call
   const request = new XMLHttpRequest();
   try {
     request.open(
       'GET',
       'https://nucarve.com/version-check/laserpost?type=' +
         (stableOnly ? 'stable' : 'any') +
         '&version=' +
         semVer,
       false,
       '',
       ''
     );
     request.send(null);
   } catch (ex) {
     return undefined;
   }
 
   // make sure we got back an XML message
   if (request.response.substring(0, 5) != '<?xml') return undefined;
 
   // decode the XML
   const versionObject = parseXML(request.response);
 
   // make sure it's our version object and we didn't get an error
   if (!versionObject.version) return undefined;
   if (versionObject.version.error) return undefined;
 
   // return the verison object
   return versionObject.version;
 }
 
 /**
  * Determine if we have permission from Autodesk to run security level 0 calls.
  *
  * @returns `true` if we have level 0, `false` if we do not
  */
 function haveSecurityRights() {
   // by using a try/catch block, the lack of security rights will be caught as an error rather
   // than being presented to the user as a prompt for permission.
   try {
     // this call requires rights or it will fail, but doesn't leave behind anything if it succeeeds
     FileSystem.getTemporaryFile('temp');
     return true;
   } catch (ex) {}
   return false;
 }
 
 /**
  * Ensures we have security rights to use level 0 calls.  If the current security context is insufficient,
  * this will inform the user what is happening and then trigger a secure call which will cause Autodesk
  * to prompt for permission.
  */
 function ensureSecurityRights() {
   if (!haveSecurityRights()) {
     showWarning(
       localize(
         'LaserPost requires your permission to check for updates.\n\n' +
         'ALLOW: Select "Yes" on the following dialog (and optionally check the "Remember" box).\n\n' +
         'DECLINE: You must disable update checking.  Select "No" on the following dialog ' +
         'then change the "LaserPost: Automatic update" option on the post properties page to "Never".\n\n' +
         'Visit https://nucarve.com/laserpost-permissions for more information.'
       )
     );
     // use a benign security 0 call to trigger the clearance message
     FileSystem.getTemporaryFile('temp');
   }
 }
 
 /**************************************************************************************
  *
  * State and XML file support
  *
  *************************************************************************************/
 
 /**
  * Loads the state from the XML file (STATE_FILENAME) used for tracking processing activities
  * of the post processor.  Results in two global variables being set:
  *
  * - activeState: The state loaded from the XML file that can be modified as needed
  * - origState: The original state that is used to compare for state changes and should not be changed.
  *
  * The XML file is expected to contain `<laserpost>` and then one key for each object entry
  * with <memberName>value</memberName>
  */
 function stateLoad() {
   // set up path to the state file, and see if it exists
   const statePath = FileSystem.getCombinedPath(
     getConfigurationFolder(),
     STATE_FILENAME
   );
   try {
     const xmlFile = new TextFile(statePath, false, 'ansi');
   } catch (ex) {
     // no file, so set an empty state
     origState = {};
     activeState = {};
     return;
   }
 
   // bring in all lines from the file
   let xmlString = '';
   try {
     for (let x = 0; x < 5; ++x) {
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
     const statePath = FileSystem.getCombinedPath(
       getConfigurationFolder(),
       STATE_FILENAME
     );
     let xmlFile;
     try {
       // write the XML state to the file
       xmlFile = new TextFile(statePath, true, 'ansi');
       xmlFile.writeln('<?xml version="1.0" encoding="UTF-8"?>');
       xmlFile.writeln('<laserpost>');
       for (key in activeState) {
         xmlFile.writeln(
           format('  <{key}>{value}</{key}>', {
             key: key,
             value: activeState[key],
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
 
 /**************************************************************************************
  *
  * Debugging and simple UI support
  *
  *************************************************************************************/
 
 /**
  * Display a simple warning message with a single OK button to continue.
  * 
  * @param message Message that has been localized, with optional {arguments}
  * @param keyValue Object to resolve any {arguments} in message
  */
 function showWarning(message, keyValue) {
   alert(format(localize("{description} ({version})"), { description: description, version: semVer }),
     format(message, keyValue)
   );
 }
 
 
 /**
  * Dumps the contents of the groups (CAM based pathing) to comments in the file.
  */
 function dumpGroups() {
   writeComment(
     'Dump: Groups ({groupCount} groups):',
     { groupCount: groups.length },
     COMMENT_DEBUG
   );
   for (let l = 0; l < groups.length; ++l) {
     const group = groups[l];
 
     writeComment(
       '  Group "{name}" ({opCount} operations)',
       {
         name: group.groupName ? group.groupName : '(none)',
         opCount: group.operations.length,
       },
       COMMENT_DEBUG
     );
     for (let o = 0; o < group.operations.length; ++o) {
       const operation = group.operations[o];
 
       writeComment(
         '    Operation "{name}" ({min}-{max}% power, power scale {powerScale}%, layer mode {layerMode} ({pathCount} paths)',
         {
           name: operation.operationName,
           min: operation.minPower,
           max: operation.maxPower,
           powerScale: operation.powerScale,
           layerMode: operation.layerMode,
           pathCount: operation.paths.length,
         },
         COMMENT_DEBUG
       );
       for (let p = 0; p < operation.paths.length; ++p) {
         const path = operation.paths[p];
 
         if (path.type == PATH_TYPE_LINEAR)
           writeComment(
             '      Path #{pathId}: {pathType} from [{startX}, {startY}] to [{endX}, {endY}] at {feed} mm/min',
             {
               pathId: p,
               pathType: path.type,
               startX: formatPosition.format(path.startX),
               startY: formatPosition.format(path.startY),
               endX: formatPosition.format(path.endX),
               endY: formatPosition.format(path.endY),
               feed: formatSpeed.format(path.feed),
             },
             COMMENT_INSANE
           );
         else if (
           path.type == PATH_TYPE_SEMICIRCLE ||
           path.type == PATH_TYPE_CIRCLE
         )
           writeComment(
             '      Path #{pathId}: {pathType} ({direction}) from [{startX}, {startY}] to [{endX}, {endY}] centered on [{centerX}, {centerY}] at {feed} mm/min',
             {
               pathId: p,
               pathType: path.type,
               startX: formatPosition.format(path.startX),
               startY: formatPosition.format(path.startY),
               centerX: formatPosition.format(path.centerX),
               centerY: formatPosition.format(path.centerY),
               endX: formatPosition.format(path.endX),
               endY: formatPosition.format(path.endY),
               direction: path.clockwise ? 'CW' : 'CCW',
               feed: formatSpeed.format(path.feed),
             },
             COMMENT_INSANE
           );
       }
     }
   }
 }
 
 /**
  * Dump the contents of the project (LightBurn style shapes) to comments in the file.
  */
 function dumpProject() {
   // structure of the project object:
   // project.operationGroups[{ shapeGroups: {type: SHAPE_TYPE_*, powerScale, cutIndex, ...)}, cutSettings: [{index, priority, minPower, maxPower, speed, layerMode, customCutSetting}}]
   //   for shapeGroups:
   //     when SHAPE_TYPE_ELIPSE: centerX, centerY, radius
   //     when SHAPE_TYPE_PATH: vectors[], primitives: []
   writeComment(
     'Dump: Project ({groupCount} operation groups):',
     { groupCount: project.operationGroups.length },
     COMMENT_DEBUG
   );
   writeComment('  Cut settings:', {}, COMMENT_DEBUG);
   for (let c = 0; c < project.cutSettings.length; ++c) {
     const cutSetting = project.cutSettings[c];
     if (cutSetting.customCutSettingXML)
       writeComment(
         '    #{id}: index={index}, priority={priority}, customCutSettingXML:\n{xml}',
         {
           id: c,
           index: cutSetting.index,
           priority: cutSetting.priority,
           xml: cutSetting.customCutSettingXML,
         },
         COMMENT_DEBUG
       );
     else
       writeComment(
         '    #{id}: {minPower}-{maxPower}% power at {speed} mm/min, index={index}, priority={priority}, layerMode={layerMode}, laserEnable={laserEnable}',
         {
           id: c,
           index: cutSetting.index,
           priority: cutSetting.priority,
           minPower: cutSetting.minPower,
           maxPower: cutSetting.maxPower,
           speed: formatSpeed.format(cutSetting.speed),
           layerMode: cutSetting.layerMode,
           laserEnable: cutSetting.laserEnable,
         },
         COMMENT_DEBUG
       );
   }
 
   for (let og = 0; og < project.operationGroups.length; ++og) {
     writeComment('  Operation group #{id}:', { id: og }, COMMENT_DEBUG);
     for (let o = 0; o < project.operationGroups[og].operations.length; ++o) {
       writeComment('    Operation #{id}:', { id: o }, COMMENT_DEBUG);
       writeComment('      Shape groups:', {}, COMMENT_DEBUG);
       for (
         let s = 0;
         s < project.operationGroups[og].operations[o].shapeGroups.length;
         ++s
       ) {
         const shape = project.operationGroups[og].operations[o].shapeGroups[s];
 
         // dump the shape into insane comments
         writeComment(
           '        Shape (type={type}, cutIndex={cutIndex}, powerScale={powerScale}',
           {
             type: shape.type,
             cutIndex: shape.cutIndex,
             powerScale: shape.powerScale,
           },
           COMMENT_DEBUG
         );
         if (shape.type == SHAPE_TYPE_ELIPSE) {
           writeComment(
             '          Circle center=[{centerX}, {centerY}, radius={radius}',
             {
               centerX: formatPosition.format(shape.centerX),
               centerY: formatPosition.format(shape.centerY),
               radius: formatRadius.format(shape.radius),
             },
             COMMENT_INSANE
           );
         } else {
           writeComment('        Vector list:', {}, COMMENT_INSANE);
           for (let i = 0; i < shape.vectors.length; ++i)
             writeComment(
               '        Vector #{id}: point=[{x}, {y}]{c0}{c1}',
               {
                 id: i,
                 x: formatPosition.format(shape.vectors[i].x),
                 y: formatPosition.format(shape.vectors[i].y),
                 c0:
                   shape.vectors[i].c0x !== undefined
                     ? format('c0=[{x}, {y}]', {
                         x: formatPosition.format(shape.vectors[i].c0x),
                         y: formatPosition.format(shape.vectors[i].c0y),
                       })
                     : '',
                 c1:
                   shape.vectors[i].c1x !== undefined
                     ? format(', c1=[{x}, {y}]', {
                         x: formatPosition.format(shape.vectors[i].c1x),
                         y: formatPosition.format(shape.vectors[i].c1y),
                       })
                     : '',
               },
               COMMENT_INSANE
             );
 
           writeComment('        Primitive list:', {}, COMMENT_INSANE);
           for (let i = 0; i < shape.primitives.length; ++i)
             writeComment(
               '          Primitive #{id}: type={type}, start={start}, end={end}',
               {
                 id: i,
                 type: shape.primitives[i].type,
                 start: shape.primitives[i].start,
                 end: shape.primitives[i].end,
               },
               COMMENT_INSANE
             );
         }
       }
     }
   }
 }
 
 /**************************************************************************************
  *
  * Arc to Bezier library.  See https://github.com/colinmeinke/svg-arc-to-cubic-bezier
  *
  * Modified to use the more restricted version of JavaScript used by the post processor engine.
  *
  * This section is using the following license:
  *
  * Internet Systems Consortium license
  * Copyright (c) 2017, Colin Meinke
  *
  * Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted,
  * provided that the above copyright notice and this permission notice appear in all copies.
  *
  * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED
  * WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR
  * CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT,
  * NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
  *
  * Additionally, Colin Meinke derived this from https://github.com/fontello/svgpath with the following license:
  *
  * (The MIT License)
  *
  * Copyright (C) 2013-2015 by Vitaly Puzrin
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
  *************************************************************************************/
 
 const TAU = Math.PI * 2;
 
 function mapToEllipse({ x, y }, rx, ry, cosphi, sinphi, centerx, centery) {
   x *= rx;
   y *= ry;
 
   const xp = cosphi * x - sinphi * y;
   const yp = sinphi * x + cosphi * y;
 
   return {
     x: xp + centerx,
     y: yp + centery,
   };
 }
 
 function approxUnitArc(ang1, ang2) {
   // If 90 degree circular arc, use a constant
   // as derived from http://spencermortensen.com/articles/bezier-circle
   const a =
     ang2 === 1.5707963267948966
       ? 0.551915024494
       : ang2 === -1.5707963267948966
       ? -0.551915024494
       : (4 / 3) * Math.tan(ang2 / 4);
 
   const x1 = Math.cos(ang1);
   const y1 = Math.sin(ang1);
   const x2 = Math.cos(ang1 + ang2);
   const y2 = Math.sin(ang1 + ang2);
 
   return [
     {
       x: x1 - y1 * a,
       y: y1 + x1 * a,
     },
     {
       x: x2 + y2 * a,
       y: y2 - x2 * a,
     },
     {
       x: x2,
       y: y2,
     },
   ];
 }
 
 function vectorAngle(ux, uy, vx, vy) {
   const sign = ux * vy - uy * vx < 0 ? -1 : 1;
 
   let dot = ux * vx + uy * vy;
 
   if (dot > 1) {
     dot = 1;
   }
 
   if (dot < -1) {
     dot = -1;
   }
 
   return sign * Math.acos(dot);
 }
 
 function getArcCenter(
   px,
   py,
   cx,
   cy,
   rx,
   ry,
   largeArcFlag,
   sweepFlag,
   sinphi,
   cosphi,
   pxp,
   pyp
 ) {
   const rxsq = Math.pow(rx, 2);
   const rysq = Math.pow(ry, 2);
   const pxpsq = Math.pow(pxp, 2);
   const pypsq = Math.pow(pyp, 2);
 
   let radicant = rxsq * rysq - rxsq * pypsq - rysq * pxpsq;
 
   if (radicant < 0) {
     radicant = 0;
   }
 
   radicant /= rxsq * pypsq + rysq * pxpsq;
   radicant = Math.sqrt(radicant) * (largeArcFlag === sweepFlag ? -1 : 1);
 
   const centerxp = ((radicant * rx) / ry) * pyp;
   const centeryp = ((radicant * -ry) / rx) * pxp;
 
   const centerx = cosphi * centerxp - sinphi * centeryp + (px + cx) / 2;
   const centery = sinphi * centerxp + cosphi * centeryp + (py + cy) / 2;
 
   const vx1 = (pxp - centerxp) / rx;
   const vy1 = (pyp - centeryp) / ry;
   const vx2 = (-pxp - centerxp) / rx;
   const vy2 = (-pyp - centeryp) / ry;
 
   let ang1 = vectorAngle(1, 0, vx1, vy1);
   let ang2 = vectorAngle(vx1, vy1, vx2, vy2);
 
   if (sweepFlag == 0 && ang2 > 0) {
     ang2 -= TAU;
   }
 
   if (sweepFlag == 1 && ang2 < 0) {
     ang2 += TAU;
   }
 
   return [centerx, centery, ang1, ang2];
 }
 
 function arcToBezier({
   px,
   py,
   cx,
   cy,
   rx,
   ry,
   xAxisRotation,
   largeArcFlag,
   sweepFlag,
 }) {
   if (xAxisRotation === undefined) xAxisRotation = 0;
   if (largeArcFlag === undefined) largeArcFlag = false;
   if (sweepFlag === undefined) sweepFlag = false;
   const curves = [];
 
   if (rx === 0 || ry === 0) {
     return [];
   }
 
   const sinphi = Math.sin((xAxisRotation * TAU) / 360);
   const cosphi = Math.cos((xAxisRotation * TAU) / 360);
 
   const pxp = (cosphi * (px - cx)) / 2 + (sinphi * (py - cy)) / 2;
   const pyp = (-sinphi * (px - cx)) / 2 + (cosphi * (py - cy)) / 2;
 
   if (pxp === 0 && pyp === 0) {
     return [];
   }
 
   rx = Math.abs(rx);
   ry = Math.abs(ry);
 
   const lambda =
     Math.pow(pxp, 2) / Math.pow(rx, 2) + Math.pow(pyp, 2) / Math.pow(ry, 2);
 
   if (lambda > 1) {
     rx *= Math.sqrt(lambda);
     ry *= Math.sqrt(lambda);
   }
 
   let arcCenter = getArcCenter(
     px,
     py,
     cx,
     cy,
     rx,
     ry,
     largeArcFlag,
     sweepFlag,
     sinphi,
     cosphi,
     pxp,
     pyp
   );
   let centerx = arcCenter[0];
   let centery = arcCenter[1];
   let ang1 = arcCenter[2];
   let ang2 = arcCenter[3];
 
   // If 'ang2' == 90.0000000001, then `ratio` will evaluate to
   // 1.0000000001. This causes `segments` to be greater than one, which is an
   // unecessary split, and adds extra points to the bezier curve. To alleviate
   // this issue, we round to 1.0 when the ratio is close to 1.0.
   let ratio = Math.abs(ang2) / (TAU / 4);
   if (Math.abs(1.0 - ratio) < 0.0000001) {
     ratio = 1.0;
   }
 
   const segments = Math.max(Math.ceil(ratio), 1);
 
   ang2 /= segments;
 
   for (let i = 0; i < segments; i++) {
     curves.push(approxUnitArc(ang1, ang2));
     ang1 += ang2;
   }
 
   const result = [];
   for (let i = 0; i < curves.length; ++i) {
     let curve = curves[i];
     const xy1 = mapToEllipse(
       curve[0],
       rx,
       ry,
       cosphi,
       sinphi,
       centerx,
       centery
     );
     const xy2 = mapToEllipse(
       curve[1],
       rx,
       ry,
       cosphi,
       sinphi,
       centerx,
       centery
     );
     const xy = mapToEllipse(curve[2], rx, ry, cosphi, sinphi, centerx, centery);
 
     result.push({
       x1: xy1.x,
       y1: xy1.y,
       x2: xy2.x,
       y2: xy2.y,
       x: xy.x,
       y: xy.y,
     });
   }
   return result;
 }
 
