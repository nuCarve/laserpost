/**************************************************************************************
 *
 * LaserPost module: camHandlers.js
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

  // emit the the required file header (LightBurn crashes if there are too many comments
  // before the thumbnail)
  onFileCreate();
}

/**
 * Generate notes that describe the project setup
 *
 * @param layerIndex Layer number being generated (-1 when single file for all layers)
 */
function generateProjectNotes(layerIndex) {
  // clear any existing notes
  notes = [];

  // include info about LaserPost
  appendNote(generatedBy);
  appendNote(codeMoreInformation);
  appendNote('');

  // include the layer file details
  if (layerIndex != -1)
    appendNote('File: {file} ({index} of {total})', {
      file: project.layers[layerIndex].filename,
      index: layerIndex + 1,
      total: project.layers.length,
    });
  else
    appendNote('File: {file}', {
      file: project.layers[0].filename,
    });

  // include timestamp
  appendNote(localize('Generated at: {date}'), { date: new Date().toString() });
  appendNote('');

  // if we have a program name/comment, add it to the file as comments and in notes
  if (programName || programComment) {
    appendNote(localize('Program'));
    if (programName)
      appendNote('  ' + localize('Name: {program}'), { program: programName });
    if (programComment)
      appendNote('  ' + localize('Comment: {comment}'), {
        comment: programComment,
      });
  }

  // dump machine configuration
  var vendor = machineConfiguration.getVendor();
  var model = machineConfiguration.getModel();

  appendNote(localize('Machine'));
  if (vendor) {
    appendNote('  ' + localize('Vendor: {vendor}'), { vendor: vendor });
  }
  if (model) {
    appendNote('  ' + localize('Model: {model}'), { model: model });
  }

  appendNote('');

  // if the user did any laser overrides, include those in the comments
  let laserPowerEtchMin = getProperty('laserPower0100EtchMin', LASER_POWER_ETCH_MIN_DEFAULT);
  let laserPowerEtchMax = getProperty('laserPower0200EtchMax', LASER_POWER_ETCH_MAX_DEFAULT);
  let laserPowerVaporizeMin = getProperty('laserPower0300VaporizeMin', LASER_POWER_VAPORIZE_MIN_DEFAULT);
  let laserPowerVaporizeMax = getProperty('laserPower0400VaporizeMax', LASER_POWER_VAPORIZE_MAX_DEFAULT);
  let laserPowerThroughMin = getProperty('laserPower0500ThroughMin', LASER_POWER_THROUGH_MIN_DEFAULT);
  let laserPowerThroughMax = getProperty('laserPower0600ThroughMax', LASER_POWER_THROUGH_MAX_DEFAULT);

  if (
    laserPowerEtchMax != 0 ||
    laserPowerThroughMax != 0 ||
    laserPowerVaporizeMax != 0
  ) {
    appendNote('Laser power overrides');
    if (laserPowerEtchMax != 0)
      appendNote('  ' + localize('Etch power: {min}% (min) - {max}% (max)'), {
        min: laserPowerEtchMin,
        max: laserPowerEtchMax,
      });
    if (laserPowerVaporizeMax != 0)
      appendNote(
        '  ' + localize('Vaporize power: {min}% (min) - {max}% (max)'),
        {
          min: laserPowerVaporizeMin,
          max: laserPowerVaporizeMax,
        }
      );
    if (laserPowerThroughMax != 0)
      appendNote(
        '  ' + localize('Through power: {min}% (min) - {max}% (max)'),
        {
          min: laserPowerThroughMin,
          max: laserPowerThroughMax,
        }
      );
  }

  // if the user is using a mirror shuttle, output that to comments
  // #if LBRN
  let shuttleLaser1 = getProperty('machine0500ShuttleLaser1', SHUTTLE_LASER_1_DEFAULT);
  let shuttleLaser2 = getProperty('machine0600ShuttleLaser2', SHUTTLE_LASER_2_DEFAULT);

  if (shuttleLaser1 != '' || shuttleLaser2 != '') {
    appendNote('  ' + localize('Shuttle "U" for laser 1: {value}'), {
      value: shuttleLaser1 == '' ? '0' : shuttleLaser1,
    });
    appendNote('  ' + localize('Shuttle "U" for laser 2: {value}'), {
      value: shuttleLaser2 == '' ? '0' : shuttleLaser2,
    });
  }
  // #endif
}

/**
 * onComment is called by CAM when a comment should be emitted.
 *
 * @param message Comment to add to the file.
 */
function onComment(message) {
  debugLog(message);
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

  switch (currentSection.getJetMode()) {
    case JET_MODE_ETCHING:
      minPower = getProperty('laserPower0100EtchMin', LASER_POWER_ETCH_MIN_DEFAULT);
      maxPower = getProperty('laserPower0200EtchMax', LASER_POWER_ETCH_MAX_DEFAULT);
      powerSource = localize('post-processor etch power properties');
      break;
    case JET_MODE_VAPORIZE:
      minPower = getProperty('laserPower0300VaporizeMin', LASER_POWER_VAPORIZE_MIN_DEFAULT);
      maxPower = getProperty('laserPower0400VaporizeMax', LASER_POWER_VAPORIZE_MAX_DEFAULT);
      powerSource = localize('post-processor vaporize power properties"');
      break;
    case JET_MODE_THROUGH:
      minPower = getProperty('laserPower0500ThroughMin', LASER_POWER_THROUGH_MIN_DEFAULT);
      maxPower = getProperty('laserPower0600ThroughMax', LASER_POWER_THROUGH_MAX_DEFAULT);
      powerSource = localize('post-processor through power properties');
      break;
    default:
      error(
        localize('Unsupported cutting mode') +
          ' (' +
          currentSection.getJetMode() +
          ')'
      );
      return;
  }

  // get values for the "U" when using a mirror shuttle
  // #if LBRN
  let shuttleLaser1 = getProperty('machine0500ShuttleLaser1', SHUTTLE_LASER_1_DEFAULT);
  let shuttleLaser2 = getProperty('machine0600ShuttleLaser2', SHUTTLE_LASER_2_DEFAULT);
  let shuttleLaser1Value = undefined;
  let shuttleLaser2Value = undefined;

  if (shuttleLaser1 != '' || shuttleLaser2 != '') {
    shuttleLaser1Value = shuttleLaser1 == '' ? '0' : shuttleLaser1;
    shuttleLaser2Value = shuttleLaser2 == '' ? '0' : shuttleLaser2;
  }
  // #endif

  // if the user did not specify an override on max power, use the tools cut (max) and/or pierce (min) power
  if (maxPower == 0) {
    minPower = tool.piercePower;
    maxPower = tool.cutPower;
    powerSource = localize('tool power properties');
  }

  // determine the air setting.
  let useAir = true;
  switch (getProperty('op0200UseAir', USE_AIR_DEFAULT)) {
    case USE_AIR_OFF:
      useAir = false;
      break;
    case USE_AIR_ON:
      useAir = true;
      break;
    case USE_AIR_ASSIST_GAS:
      useAir =
        tool.assistGas.toLowerCase() != localize('none') &&
        tool.assistGas.toLowerCase() != localize('off') &&
        tool.assistGas != '';
      break;
  }

  // set up the group - using the shared group name if specified, else a new empty group
  const groupName = currentSection.getProperty('op0800GroupName', GROUP_NAME_DEFAULT);
  if (groupName == '') groupName = undefined;

  currentGroup = getGroupByName(groupName, {
    groupName: groupName,
    operations: [],
  });

  // collect settings from the user via operation properties
  const powerScale = currentSection.getProperty('op0400PowerScale', POWER_SCALE_DEFAULT);
  let opLayerMode = currentSection.getProperty('op0100LayerMode', LAYER_MODE_DEFAULT);
  if (opLayerMode == LAYER_MODE_INHERIT) {
    // select fill based on the cutting mode
    if (currentSection.getJetMode() == JET_MODE_ETCHING)
      opLayerMode = LAYER_MODE_FILL;
    else opLayerMode = LAYER_MODE_LINE;
  }
  const customCutSettingXML = currentSection.getProperty(
    'op0900CustomCutSettingXML', CUSTOM_CUT_SETTING_XML_DEFAULT
  );
  let laserEnable = currentSection.getProperty('op0300LaserEnable', LASER_ENABLE_DEFAULT);
  const zOffset = currentSection.getProperty('op0500ZOffset', Z_OFFSET_DEFAULT);
  const passes = currentSection.getProperty('op0600Passes', PASS_COUNT_DEFAULT);
  const zStep = currentSection.getProperty('op0700ZStep', Z_STEP_PER_PASS_DEFAULT);

  // if laser enable set to inherit from tool, get value from the tool's pierce time
  if (laserEnable == LASER_ENABLE_TOOL) {
    switch (tool.getPierceTime()) {
      case 1:
        laserEnable = LASER_ENABLE_1;
        break;
      case 2:
        laserEnable = LASER_ENABLE_2;
        break;
      case 3:
        laserEnable = LASER_ENABLE_BOTH;
        break;
      case 99:
        laserEnable = LASER_ENABLE_OFF;
        break;
      default:
        appendNote('', {}, true);
        appendNote(
          'WARNING: Operation "{name}" has Laser Enable set to "Use tool setting" but tool Pierce Time ({value}) is invalid.',
          { name: operationName, value: tool.getPierceTime() }
        );
        appendNote('         For safety, setting layer to laser off.');
        laserEnable = LASER_ENABLE_OFF;
        break;
    }
  }

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
      kerf: tool.getKerfWidth(),
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
      kerf: tool.getKerfWidth(),
      // #if LBRN
      shuttleLaser1: shuttleLaser1Value,
      shuttleLaser2: shuttleLaser2Value,
      // #endif
      customCutSettingXML: '',
      paths: [],
    });
  }

  // include comments about the group and power being used
  debugLog(
    'Operation: "{name}" using group "{group}"',
    {
      name: operationName,
      group: groupName ? groupName : 'n/a',
    },
    COMMENT_DEBUG
  );

  if (customCutSettingXML)
    debugLog(
      'Settings: Custom CutSetting XML:\n${xml}',
      { xml: customCutSettingXML },
      COMMENT_DEBUG
    );
  else
    debugLog(
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
  // set up quick reference to the current operation
  const operation = currentGroup.operations[currentGroup.operations.length - 1];

  // is laser currently on?  If not, we ignore this request (other than debugging logic)
  if (currentPower) {
    debugLog(
      'onLinear LASER: [{x}, {y}] at {feed} mm/min',
      {
        x: formatPosition.format(x),
        y: formatPosition.format(y),
        feed: formatSpeed.format(feed),
      },
      COMMENT_INSANE
    );

    // add this path segment
    operation.paths.push({
      type: PATH_TYPE_LINEAR,
      x: x,
      y: y,
      feed: feed,
    });
  } else {
    debugLog(
      'onLinear MOVE: [{x}, {y}] at {feed} mm/min',
      {
        x: formatPosition.format(x),
        y: formatPosition.format(y),
        feed: formatSpeed.format(feed),
      },
      COMMENT_INSANE
    );
    // if top operation is a move, replace it as only the latest move matters
    if (
      operation.paths.length > 0 &&
      operation.paths[operation.paths.length - 1].type == PATH_TYPE_MOVE
    )
      operation.paths.pop();

    // add this path segment
    operation.paths.push({
      type: PATH_TYPE_MOVE,
      x: x,
      y: y,
      feed: feed,
    });
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

  // get quick reference to current operation
  const operation = currentGroup.operations[currentGroup.operations.length - 1];

  debugLog(
    'onCircular: {clockwise} {fullSemi} [{ex}, {ey}] center [{cx}, {cy}], feed={feed} mm/min',
    {
      clockwise: clockwise ? 'CW' : 'CCW',
      fullSemi: isFullCircle() ? 'circle' : 'semicircle',
      cx: formatPosition.format(cx),
      cy: formatPosition.format(cy),
      ex: formatPosition.format(x),
      ey: formatPosition.format(y),
      feed: formatSpeed.format(feed),
    },
    COMMENT_INSANE
  );

  // add this path segment
  operation.paths.push({
    type: isFullCircle() ? PATH_TYPE_CIRCLE : PATH_TYPE_SEMICIRCLE,
    centerX: cx,
    centerY: cy,
    x: x,
    y: y,
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
  debugLog(
    'onCommand: {id} ({command})',
    {
      command: command,
      id: getCommandStringId(command),
    },
    COMMENT_INSANE
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
  debugLog('onSectionEnd', {}, COMMENT_INSANE);
}

/**
 * onClose is called by CAM when the last section has been completed.  Triggers the
 * processing of all entries in the `groups` array and generates the vector file(s).
 */
function onClose() {
  // include some debugging information
  debugLog('onClose', {}, COMMENT_INSANE);

  // trace the stock outline
  traceStockOutline();

  // debugging info if requested
  dumpGroups();

  // process all groups, converting from CAM coordinates
  groupsToProject();

  // determine if we are doing file redirection
  const redirect =
    getProperty('laserpost0100Grouping', GROUPING_DEFAULT) == GROUPING_BY_LAYER_FILE;

  // build up project notes
  generateProjectNotes(redirect ? 0 : -1);

  // write the file header (this goes into the first file, if multiple files are used)
  onWriteHeader(redirect ? 0 : -1);

  // process all layers, potentially breaking them out into different files
  for (let layerIndex = 0; layerIndex < project.layers.length; ++layerIndex) {
    const layer = project.layers[layerIndex];

    // redirect if after the first layer and using redirection
    if (layerIndex > 0 && redirect) {
      redirectToFile2(layer.path);
      generateProjectNotes(layerIndex);
      onFileCreate(layerIndex);
      onWriteHeader(layerIndex);
    }

    // render the layer
    onWriteShapes(layerIndex)

    // close file redirect if used
    if (layerIndex > 0 && redirect) {
      onWriteTrailer(layerIndex);
      closeRedirection2();
    }
  }

  // write the trailer (if multi-file, this will end up in the original, first file)
  generateProjectNotes(redirect ? 0 : -1);
  onWriteTrailer(redirect ? 0 : -1);

  // project complete
  if (typeof onProjectComplete === 'function') {
    generateProjectNotes(-1);
    onProjectComplete(redirect);
  }

  // save our state to the persistent state file (if changed)
  stateSave();
}

/**
 * onClose is called by CAM when the last section has been completed.
 */
function onTerminate() {}
