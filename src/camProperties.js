/**************************************************************************************
 *
 * LaserPost module: camProperties.js
 *
 * CAM UI configuration
 *
 *************************************************************************************/

/**
 * Global code that executes upon post load.  Loads the XML state file so we can set
 * feature visibility.
 */
stateLoad();

/**
 * Helper method used on "visibility" properties for advanced features.  If advanced features
 * are enabled, returns `true` to enable the feature, otherwise `false`.
 * 
 * @returns {boolean} true if the user has selected the advanced features
 */
function advancedFeature() {
  // if automated test, use the property value if available, else fall back on state
  if (getProperty('automatedTesting', false) || activeState.automatedTesting) {
    const features = getProperty('machine0025LaserpostFeatures', undefined);
    if (features) return features === LASERPOST_FEATURES_ADVANCED;
    return true;
  }

  // return if advanced based on the state
  return activeState.laserpostFeatures ? activeState.laserpostFeatures === LASERPOST_FEATURES_ADVANCED : false;
}

/**
 * Define the groups used for properties when displayed during CAM configuration in the CAM UI
 */
groupDefinitions = {
  groupLaserPost: {
    title: localize('LaserPost (VERSION_NUMBER) file settings'),
    description: localize('Settings to customize the generated files.'),
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
};

/**
 * Define the properties (often organized by the groups above) that users can control during CAM configuration.
 */
properties = {
  //
  // Group: groupLaserPost
  //
  laserpost0100Organization: {
    title: localize('Organization'),
    description: localize(
      'Determines if shapes be organized by operation (in one file), by layer (in one file), or by layer oer file (one file for each layer).'
    ),
    group: 'groupLaserPost',
    type: 'enum',
    values: [
      { title: localize('By operation'), id: ORGANIZATION_BY_OPERATION },
      { title: localize('By layer'), id: ORGANIZATION_BY_LAYER },
      { title: localize('By file per layer'), id: ORGANIZATION_BY_LAYER_FILE },
    ],
    value: GROUPING_DEFAULT,
    scope: 'post',
  },
  laserpost0200GroupShapes: {
    title: localize('Group shapes'),
    description: localize(
      'Set if a groups should be created around shapes (based on organization) or if all shapes should be ungrouped.'
    ),
    group: 'groupLaserPost',
    type: 'boolean',
    value: GROUP_SHAPES_DEFAULT,
    scope: 'post',
  },
  laserpost0300AlignmentMarks: {
    title: localize('Alignment marks'),
    description: localize(
      'Add alignment marks in a group/layer along the outside edge of the stock.  Useful when grouping is set to "File per layer" and the laser tool does not import shapes aligned to their original positions.'
    ),
    group: 'groupLaserPost',
    type: 'enum',
    values: [
      { title: localize('None'), id: ALIGNMENT_MARK_NONE },
      {
        title: localize('Aligned to stock upper-right'),
        id: ALIGNMENT_MARK_UPPER_RIGHT,
      },
      {
        title: localize('Aligned to stock center-right'),
        id: ALIGNMENT_MARK_CENTER_RIGHT,
      },
      {
        title: localize('Aligned to stock lower-right'),
        id: ALIGNMENT_MARK_LOWER_RIGHT,
      },
    ],
    value: ALIGNMENT_MARK_DEFAULT,
    scope: 'post',
  },
  laserpost0400IncludeNotes: {
    title: localize('Notes'),
    // #if LBRN
    description: localize('Detail level of generated LightBurn setup notes, which may appear when LightBurn opens the project. ' +
      '"Disable" will not generate any notes, "Hidden" will generate them but not shown them automatically (in LightBurn, use ' +
      'File / Show Notes to see them), "Show when important" will normally hide them but will show when there is something important '+
      ' to share, and "Always show" will always show the notes when LightBurn loads the project.'
    ),
    // #else
    description: localize('Detail level of generated setup notes, which are placed in a text file along side the generated SVG ' +
      'file.  "Disable" will not generate any notes, "Hidden" will generate them but not the popup saying they are available, ' +
      '"Show when important" will normally not show the popup, but will when there is something important to share, and ' +
      '"Always show" will always generate the notes and display a popup when they are generated.'
    ),
    // #endif
    group: 'groupLaserPost',
    type: 'enum',
    values: [
      { title: localize('Disable'), id: INCLUDE_NOTES_NONE },
      { title: localize('Hidden'), id: INCLUDE_NOTES_HIDDEN },
      {
        title: localize('Show when important'),
        id: INCLUDE_NOTES_SHOW_IMPORTANT,
      },
      { title: localize('Always show'), id: INCLUDE_NOTES_SHOW },
    ],
    value: INCLUDE_NOTES_DEFAULT,
    scope: 'post',
  },
  laserpost0500IncludeComments: {
    title: localize('Comments'),
    description: localize('Detail level of comments in the generated files.'),
    group: 'groupLaserPost',
    type: 'enum',
    values: [
      { title: localize('Disable'), id: INCLUDE_COMMENTS_NONE },
      { title: localize('Normal'), id: INCLUDE_COMMENTS_NORMAL },
      { title: localize('Debug'), id: INCLUDE_COMMENTS_DEBUG },
      { title: localize('Insane'), id: INCLUDE_COMMENTS_INSANE },
    ],
    value: INCLUDE_COMMENTS_DEFAULT,
    scope: 'post',
  },
  laserpost0600LaunchOnPost: {
    title: localize('Launch on post'),
    // #if LBRN
    description: localize(
        'Check to launch LightBurn with the generated file after a successful post (similar to double-clicking the file).'
    ),
    // #else
    description: localize(
        'Check to launch the SVG file with the default application after a successful post (similar to double-clicking the file).'
    ),
    // #endif
    group: 'groupLaserPost',
    type: 'boolean',
    value: LAUNCH_ON_POST_DEFAULT,
    scope: 'post',
  },
  //
  // Group: groupWorkspace
  //
  work0100TraceStock: {
    title: localize('Trace stock'),
    description: localize(
      'Includes a group/layer that traces the outline of the stock.'
    ),
    group: 'groupWorkspace',
    type: 'boolean',
    value: TRACE_STOCK_DEFAULT,
    scope: 'post',
  },
  work0200OffsetX: {
    title: localize('Offset X axis'),
    description: localize(
      'Sets an optional X offset (in mm) to move all geometry in the workspace.  Positive and negative numbers are allowed.'
    ),
    group: 'groupWorkspace',
    type: 'number',
    value: OFFSET_X_AXIS_DEFAULT,
    scope: 'post',
    visible: advancedFeature()
  },
  work0300OffsetY: {
    title: localize('Offset Y axis'),
    description: localize(
      'Sets an optional Y offset (in mm) to move all geometry in the workspace.  Positive and negative numbers are allowed.'
    ),
    group: 'groupWorkspace',
    type: 'number',
    value: OFFSET_Y_AXIS_DEFAULT,
    scope: 'post',
    visible: advancedFeature()
  },
  //
  // Group: groupLaserPower
  //
  laserPower0100EtchMin: {
    title: localize('Etch power (min, %)'),
    description: localize(
      'Overrides the mininum laser power used on etching cutting mode operations (ignored if etch max power is 0).'
    ),
    group: 'groupLaserPower',
    type: 'number',
    value: LASER_POWER_ETCH_MIN_DEFAULT,
    range: [0, 100],
    scope: 'post',
    visible: advancedFeature()
  },
  laserPower0200EtchMax: {
    title: localize('Etch power (max, %)'),
    description: localize(
      "Overrides the maximum laser power used on etching cutting mode operations ('0' to use power specified on the tool)."
    ),
    group: 'groupLaserPower',
    type: 'number',
    value: LASER_POWER_ETCH_MAX_DEFAULT,
    range: [0, 100],
    scope: 'post',
    visible: advancedFeature()
  },
  laserPower0300VaporizeMin: {
    title: localize('Vaporize power (min, %)'),
    description: localize(
      'Overrides the minimum laser power used on vaporize cutting mode operations (ignored if vaporize max power is 0).'
    ),
    group: 'groupLaserPower',
    type: 'number',
    value: LASER_POWER_VAPORIZE_MIN_DEFAULT,
    range: [0, 100],
    scope: 'post',
    visible: advancedFeature()
  },
  laserPower0400VaporizeMax: {
    title: localize('Vaporize power (max, %)'),
    description: localize(
      "Overrides the maximum laser power used on vaporize cutting mode operations ('0' to use power specified on the tool)."
    ),
    group: 'groupLaserPower',
    type: 'number',
    value: LASER_POWER_VAPORIZE_MAX_DEFAULT,
    range: [0, 100],
    scope: 'post',
    visible: advancedFeature()
  },
  laserPower0500ThroughMin: {
    title: localize('Through power (min, %)'),
    description: localize(
      'Overrides the minimum laser power used on through cutting cutting mode operations (ignored if through max power is 0)).'
    ),
    group: 'groupLaserPower',
    type: 'number',
    value: LASER_POWER_THROUGH_MIN_DEFAULT,
    range: [0, 100],
    scope: 'post',
    visible: advancedFeature()
  },
  laserPower0600ThroughMax: {
    title: localize('Through power (max, %)'),
    description: localize(
      "Overrides the maximum laser power used on through cutting cutting mode operations ('0' to use power specified on the tool)."
    ),
    group: 'groupLaserPower',
    type: 'number',
    value: LASER_POWER_THROUGH_MAX_DEFAULT,
    range: [0, 100],
    scope: 'post',
    visible: advancedFeature()
  },
  //
  // machine: common machine settings
  //
  machine0025LaserpostFeatures: {
    title: localize('Laserpost Features (run post to apply)'),
    description: localize(
      'Laserpost generates laser-ready files from CAM operations in all modes.  Advanced mode extends the capabilties ' +
      'to allow for advanced laser settings, using the tool library to define materials and setups, and providing for ' +
      'operation specific exceptions on those settings.  For most use, standard is sufficient.  Advanced is useful if you ' +
      'want to capture all laser settings in the CAM operations instead or (or in addition to) having those settings in ' +
      'your laser program.' +
      '<br><br>' +
      '<i>IMPORTANT</i>: When changed, you must run the post once to allow the processor to apply the changes.  This is because ' +
      'the post is cached and the code to change the properties can only run when a post is loaded.'
    ),
    type: 'enum',
    values: [
        { title: localize('Standard'), id: LASERPOST_FEATURES_STANDARD },
        { title: localize('Advanced with Tool Library and laser settings'), id: LASERPOST_FEATURES_ADVANCED },
    ],
    value: LASERPOST_FEATURES_DEFAULT,
    scope: 'machine',
  },
  // #if LBRN
  machine0050Orientation: {
    title: localize('Machine orientation'),
    description: localize(
      'Orientation of the home position on the physical laser machine.' + 
      '<br><br>' +
      '<i>IMPORTANT</i>: Must match the Lightburn machine orientation (in Lightburn, Edit / Device Settings / Origin radio buttons).'
    ),
    type: 'enum',
    values: [
      { title: localize('Upper left'), id: MACHINE_ORIENTATION_UPPER_LEFT },
      { title: localize('Upper right'), id: MACHINE_ORIENTATION_UPPER_RIGHT },
      { title: localize('Lower left'), id: MACHINE_ORIENTATION_LOWER_LEFT },
      { title: localize('Lower right'), id: MACHINE_ORIENTATION_LOWER_RIGHT },
    ],
    value: MACHINE_ORIENTATION_DEFAULT,
    scope: 'machine',
  },
  machine0070LightburnLibrary: {
    title: localize('Lightburn library (run post to apply)'),
    description: localize(
      'Optional: Path to a Lightburn material library to use for material selection, including the library file name.' +
      '<br><br>' +
      '<i>IMPORTANT</i>: When changed, you must run the post once to allow the processor to apply the changes.  This is because ' +
      'the post is cached and the code to change the properties can only run when a post is loaded.'
    ),
    type: 'string',
    length: 50,
    width: 50,
    siez: 50,
    value: '',
    scope: 'machine',
  },
  machine0075LightburnLibraryUnits: {
    title: localize('Lightburn library units (run post to apply)'),
    description: localize(
      'When using a Lightburn material library, specifies the units thickness should be displayed in.  Does not affect generated files.' +
      '<br><br>' +
      '<i>IMPORTANT</i>: When changed, you must run the post once to allow the processor to apply the changes.  This is because ' +
      'the post is cached and the code to change the properties can only run when a post is loaded.'
    ),
    type: 'enum',
    values: [
        { title: localize('mm'), id: LIGHTBURN_LIBRARY_UNITS_MM },
        { title: localize('in'), id: LIGHTBURN_LIBRARY_UNITS_INCH },
    ],
    value: LIGHTBURN_LIBRARY_UNITS_DEFAULT,
    scope: 'machine',
  },
  // #endif
  // #if SVG
  machine0090SVGFileUnits: {
    title: localize('SVG file units'),
    description: localize(
      'Specifies the units to use in the SVG file, including mm, inch, pixels and points.  This optional can usually be ignored ' +
      'as the import should work the same independent of the units selected.  However, if you want to hand edit SVG and prefer specific ' +
      'units to be used, or if your import results in the wrong scale, you can adjust this parameter.'
    ),
    type: 'enum',
    values: [
      { title: localize('pixel'), id: SVG_FILE_UNITS_PIXEL },
      { title: localize('mm'), id: SVG_FILE_UNITS_MM },
      { title: localize('inch'), id: SVG_FILE_UNITS_INCH },
      { title: localize('point'), id: SVG_FILE_UNITS_POINT },
    ],
    value: SVG_FILE_UNITS_DEFAULT,
    scope: 'machine',
  },
  // #endif
  machine0100SpeedUnits: {
    title: localize('Speed units'),
    description: localize(
      'Speed units to use in comments and setup notes (used in comments and setup sheets only, does not change operational behavior).'
    ),
    type: 'enum',
    values: [
      { title: localize('mm/sec'), id: SPEED_UNITS_MMPS },
      { title: localize('mm/min'), id: SPEED_UNITS_MMPM },
    ],
    value: SPEED_UNITS_DEFAULT,
    scope: 'machine',
  },
  machine0300AutomaticUpdate: {
    title: localize('Check for updates'),
    description: localize(
      'Set how often LaserPost should check and notify that updates are available.'
    ),
    type: 'enum',
    values: [
      { title: localize('Never'), id: UPDATE_FREQUENCY_NEVER },
      { title: localize('Always'), id: UPDATE_FREQUENCY_ALWAYS },
      { title: localize('Hourly'), id: UPDATE_FREQUENCY_HOURLY },
      { title: localize('Daily'), id: UPDATE_FREQUENCY_DAILY },
      { title: localize('Weekly'), id: UPDATE_FREQUENCY_WEEKLY },
      { title: localize('Monthly'), id: UPDATE_FREQUENCY_MONTHLY },
    ],
    value: UPDATE_FREQUENCY_DEFAULT,
    scope: 'machine',
  },
  machine0400UpdateAllowBeta: {
    title: localize('Beta releases'),
    description: localize(
      'Enable to allow for checking if beta release updates are available, disable for stable releases only.'
    ),
    type: 'boolean',
    value: UPDATE_ALLOW_BETA_DEFAULT,
    scope: 'machine'
  },
  // #if LBRN
  machine0500ShuttleLaser1: {
    title: localize('Mirror shuttle laser 1'),
    description: localize(
      'For machines that use a mirror shuttle to switch between lasers.  ' +
        'Leave empty if you do not have a mirror shuttle.  ' +
        'To use, specify the value to set the "U" axis to when laser 1 is selected.'
    ),
    type: 'string',
    value: SHUTTLE_LASER_1_DEFAULT,
    scope: 'machine',
    // visible: advancedFeature()  // 'machine' scope doesn't support visible, so see below for removal
  },
  machine0600ShuttleLaser2: {
    title: localize('Mirror shuttle laser 2'),
    description: localize(
      'For machines that use a mirror shuttle to switch between lasers.  ' +
        'Leave empty if you do not have a mirror shuttle.  ' +
        'To use, specify the value to set the "U" axis to when laser 2 is selected.'
    ),
    type: 'string',
    value: SHUTTLE_LASER_2_DEFAULT,
    scope: 'machine',
    // visible: advancedFeature()  // 'machine' scope doesn't support visible, so see below for removal
  },
  // #endif
//   machine0700LaunchOnPost: {
//     title: localize('Launch on post'),
//     description: localize(
//       'Optional: Command to launch after the post successfully completes.  For example, to open the resulting LightBurn project ' +
//       'on Windows with LightBurn you might use "C:\\Program Files\\LightBurn\\LightBurn" along with specifying "{path}" ' +
//       'on the launch arguments.'
//     ),
//     type: 'string',
//     value: LAUNCH_ON_POST_PATH_DEFAULT,
//     scope: 'machine',
//   },
//   machine0800LaunchOnPostArguments: {
//     title: localize('Launch arguments'),
//     description: localize(
//       'Arguments to pass to the "Launch on post" application (if specified).  Parameters can be added using "{parameter-name}" such as "{path}":' +
//       '<ul>' +
//       '<li>{path}: Full path to the file including extension.</li>' +
//       '<li>{basename}: Name of the generated file, without the path or extension</li>' +
//       '<li>{ext}: Extension of the generated file (not including any "." character)' +
//       '<li>{dir}: Directory of the generated file, without the filename and without a trailing slash' +
//       '</ul>'
//     ),
//     type: 'string',
//     value: LAUNCH_ON_POST_ARGUMENTS_DEFAULT,
//     scope: 'machine',
//   },

  //
  // operation: cutting
  //
  op0100LayerMode: {
    title: localize('Layer mode'),
    description: localize(
      'Selects the layer mode for the layer ("Use cutting mode", "Line", "Fill" or "Offset Fill").  "Use cutting mode" will set to "Line" for through, and "Fill" for etch.'
    ),
    type: 'enum',
    values: [
      { title: localize('Use cutting mode'), id: LAYER_MODE_INHERIT },
      { title: localize('Line'), id: LAYER_MODE_LINE },
      { title: localize('Fill'), id: LAYER_MODE_FILL },
      { title: localize('Offset Fill'), id: LAYER_MODE_OFFSET_FILL },
    ],
    value: LAYER_MODE_DEFAULT,
    scope: 'operation',
    enabled: 'cutting',
    visible: advancedFeature()
  },
  // #if LBRN
  op0150LightburnMaterial: {
    title: localize('Lightburn library material'),
    description: localize(
        'Material setting from a Lightburn material library to use for this layer.' + 
        '<br><br>' +
        'Settings to adjust the library path and units are found in the Machine\'s post properties.'),
    type: 'enum',
    values: [
        { title: localize('None'), id: LIBRARY_NONE },
    ], // this is populated in lightburn.js upon loading the library
    value: LIBRARY_DEFAULT,
    scope: 'operation',
    enabled: 'cutting',
  },
  // #endif
  op0200UseAir: {
    title: localize('Air assist'),
    description: localize(
      'Sets if the layer uses air.' +
      '<br><br>' +
      '"Off" / "On" always set the air to the specified state.  "Tool Assist Gas" will set the air based on the selected tool:' +
      '<ul><li>Air off: Assist gas "None", "off", or blank)</li>' +
      '<li>Air on: Assist gas "Air", "on", or any non-off value</li>' +
      '<ul>'
    ),
    type: 'enum',
    values: [
      { title: localize('Off'), id: USE_AIR_OFF },
      { title: localize('On'), id: USE_AIR_ON },
      { title: localize('Use tool setting'), id: USE_AIR_ASSIST_GAS },
    ],
    value: USE_AIR_DEFAULT,
    scope: 'operation',
    enabled: 'cutting',
    visible: advancedFeature()
  },
  op0300LaserEnable: {
    title: localize('Laser selection'),
    description: localize(
      'For machines with dual laser heads, controls which laser(s) to use for the operation.'
    ),
    type: 'enum',
    values: [
      { title: localize('Use tool setting'), id: LASER_ENABLE_TOOL },
      { title: localize('Disable output'), id: LASER_ENABLE_OFF },
      { title: localize('Laser 1'), id: LASER_ENABLE_1 },
      { title: localize('Laser 2'), id: LASER_ENABLE_2 },
      { title: localize('Both lasers'), id: LASER_ENABLE_BOTH },
    ],
    value: LASER_ENABLE_DEFAULT,
    scope: 'operation',
    enabled: 'cutting',
    visible: advancedFeature()
  },
  op0400PowerScale: {
    title: localize('Power scale (%)'),
    description: localize(
      'Relative power scale (0-100%) for the shapes in the operation.'
    ),
    type: 'number',
    value: POWER_SCALE_DEFAULT,
    range: [0, 100],
    scope: 'operation',
    enabled: 'cutting',
    visible: advancedFeature()
  },
  op0500ZOffset: {
    title: localize('Z-offset (mm)'),
    description: localize(
      'Amount to offset Z into the material (or out of it) at the start of cutting.'
    ),
    type: 'number',
    value: Z_OFFSET_DEFAULT,
    scope: 'operation',
    enabled: 'cutting',
    visible: advancedFeature()
  },
  op0600Passes: {
    title: localize('Pass count'),
    description: localize('Number of times to repeat the cut.'),
    type: 'number',
    value: PASS_COUNT_DEFAULT,
    scope: 'operation',
    enabled: 'cutting',
    visible: advancedFeature()
  },
  op0700ZStep: {
    title: localize('Z-step per pass (mm)'),
    description: localize('Amount of raise or lower Z for each cut pass.'),
    type: 'number',
    value: Z_STEP_PER_PASS_DEFAULT,
    scope: 'operation',
    enabled: 'cutting',
    visible: advancedFeature()
  },
  op0800GroupName: {
    title: localize('Grouping name'),
    description: localize(
      'Operations that share the same "Grouping name" will have an additional group wrapped around them, ' +
        'in addition to any other groupings.  The name is used only to identify ' +
        'operations to group and is not part of the resulting generated files or laser setup.'
    ),
    type: 'string',
    value: GROUP_NAME_DEFAULT,
    scope: 'operation',
    enabled: 'cutting',
  },
  // #if LBRN
  op0900CustomCutSettingXML: {
    title: localize('Custom CutSetting (XML)'),
    description: localize(
      'For complex LightBurn cut settings (such as using sub-layers or advanced options) you can paste the \<CutSettings> section of the XML from a template ' +
        'LightBurn file.  Include everything from \<CutSettings> through \</CutSettings> (including those tags).'
    ),
    type: 'string',
    value: CUSTOM_CUT_SETTING_XML_DEFAULT,
    scope: 'operation',
    enabled: 'cutting',
    visible: advancedFeature()
  },
  // #endif

  //
  // hidden settings, used by automated test
  //
  automatedTesting: {
    title: 'Automated testing',
    description:
      'Set by automated testing to clense output (remove timestamps, version numbers, etc).',
    type: 'boolean',
    value: false,
    visible: false,
  },
  createImportantNote: {
    title: 'Create important note',
    description:
      'Used by automated testing to cause an important note to be generated.',
    type: 'boolean',
    value: false,
    visible: false,
  }
};

// machine scope doesn't support the visible attribute, so if advanced we need to delete the
// unwanted machine scope properties.  This has the unfortunate side effect that the property values
// are deleted as well.  
if (!advancedFeature()) {
  delete properties.machine0500ShuttleLaser1;
  delete properties.machine0600ShuttleLaser2;
}