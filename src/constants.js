/**************************************************************************************
 *
 * LaserPost module: constants.js
 *
 * Constants used internally by the post-processor
 *
 *************************************************************************************/

// define enum for comment detail levels
const INCLUDE_COMMENTS_NONE = 'none';
const INCLUDE_COMMENTS_NORMAL = 'normal';
const INCLUDE_COMMENTS_DEBUG = 'debug';
const INCLUDE_COMMENTS_INSANE = 'insane';
const INCLUDE_COMMENTS_DEFAULT = INCLUDE_COMMENTS_NORMAL;

// operation/layer grouping
const ORGANIZATION_BY_OPERATION = 'org-operation';
const ORGANIZATION_BY_LAYER = 'org-layer';
const ORGANIZATION_BY_LAYER_FILE = 'org-file-layer';
const GROUPING_DEFAULT = 
// #if LBRN
ORGANIZATION_BY_OPERATION;
// #else
ORGANIZATION_BY_LAYER;
// #endif

// define enum for notes include level
const INCLUDE_NOTES_NONE = 'none';
const INCLUDE_NOTES_HIDDEN = 'hidden';
const INCLUDE_NOTES_SHOW_IMPORTANT = 'important';
const INCLUDE_NOTES_SHOW = 'show';
const INCLUDE_NOTES_DEFAULT =
// #if LBRN
INCLUDE_NOTES_SHOW_IMPORTANT;
// #else
INCLUDE_NOTES_SHOW;
// #endif

// define logging levels for comments (see debugLog)
const COMMENT_NORMAL = 0;
const COMMENT_DEBUG = 2;
const COMMENT_INSANE = 3;

// path types from CAM
const PATH_TYPE_MOVE = 'move';
const PATH_TYPE_LINEAR = 'linear';
const PATH_TYPE_SEMICIRCLE = 'semicircle';
const PATH_TYPE_CIRCLE = 'circle';

// segments types used after breaking apart paths into segments
const SEGMENT_TYPE_CIRCLE = 'shape-circle';
const SEGMENT_TYPE_PATH = 'shape-path';

// define enum for layer modes
const LAYER_MODE_INHERIT = 'inherit';
const LAYER_MODE_LINE = 'line';
const LAYER_MODE_FILL = 'fill';
const LAYER_MODE_OFFSET_FILL = 'offsetFill';
const LAYER_MODE_DEFAULT = LAYER_MODE_INHERIT;

// #if LBRN
// define enum for Lightburn material library selection
const LIBRARY_NONE = 'none';
const LIBRARY_DEFAULT = LIBRARY_NONE;
const LIBRARY_MATERIAL_TEST = 'acrylic/1.5000/cut'

// define enum for Lightburn material library units
const LIGHTBURN_LIBRARY_UNITS_MM = 'mm';
const LIGHTBURN_LIBRARY_UNITS_INCH = 'in';
const LIGHTBURN_LIBRARY_UNITS_DEFAULT = LIGHTBURN_LIBRARY_UNITS_MM;

// #endif
// define enum for Laserpost features
const LASERPOST_FEATURES_STANDARD = 'standard';
const LASERPOST_FEATURES_ADVANCED = 'advanced';
const LASERPOST_FEATURES_DEFAULT = LASERPOST_FEATURES_STANDARD;

// #if SVG
// define enum for SVG units
const SVG_FILE_UNITS_PIXEL = 'pixel';
const SVG_FILE_UNITS_MM = 'mm';
const SVG_FILE_UNITS_INCH = 'inch';
const SVG_FILE_UNITS_POINT = 'point';
const SVG_FILE_UNITS_DEFAULT = SVG_FILE_UNITS_PIXEL;

// #endif
// define enum for speed units
const SPEED_UNITS_MMPS = 'mmps';
const SPEED_UNITS_MMPM = 'mmpm';
const SPEED_UNITS_DEFAULT = SPEED_UNITS_MMPS;

// shape types
const SHAPE_TYPE_ELLIPSE = 'ellipse';
const SHAPE_TYPE_PATH = 'path';
const SHAPE_TYPE_GROUP = 'group';

// primitive types
const PRIMITIVE_TYPE_LINE = 'line';
const PRIMITIVE_TYPE_BEZIER = 'bezier';

// enum for laser enabling
const LASER_ENABLE_OFF = 'off';
const LASER_ENABLE_1 = 'laser1';
const LASER_ENABLE_2 = 'laser2';
const LASER_ENABLE_BOTH = 'both';
const LASER_ENABLE_TOOL = 'tool';
const LASER_ENABLE_DEFAULT = LASER_ENABLE_1;

// enum for use air
const USE_AIR_OFF = 'off';
const USE_AIR_ON = 'on';
const USE_AIR_ASSIST_GAS = 'gas';
const USE_AIR_DEFAULT = USE_AIR_ASSIST_GAS;

// enum to alignment marks
const ALIGNMENT_MARK_NONE = 'mark-none';
const ALIGNMENT_MARK_UPPER_RIGHT = 'mark-upper-right';
const ALIGNMENT_MARK_CENTER_RIGHT = 'mark-center-right';
const ALIGNMENT_MARK_LOWER_RIGHT = 'mark-lower-right';
const ALIGNMENT_MARK_DEFAULT = ALIGNMENT_MARK_NONE;

// #if LBRN
// machine orientation
const MACHINE_ORIENTATION_UPPER_LEFT = 'upper-left';
const MACHINE_ORIENTATION_UPPER_RIGHT = 'upper-right';
const MACHINE_ORIENTATION_LOWER_LEFT = 'lower-left';
const MACHINE_ORIENTATION_LOWER_RIGHT = 'lower-right';
const MACHINE_ORIENTATION_DEFAULT = MACHINE_ORIENTATION_UPPER_RIGHT;
// #endif

// define the name of the groups used with no putput, including the stock outline border, the
// alignment mark, and and the feed rate to associate with them (which is required, but not
// meaningful as the layer is turned off)
const STOCK_GROUP_NAME = 'Stock outline';
const ALIGNMENT_MARK_GROUP_NAME = 'Alignment mark';
const NO_OUTPUT_FEED_RATE = 6000;

// extension name of the state storage file
const STATE_EXTENSION = 'xml';

// time to wait on retry of version update checks when the API fails to respond
const RETRY_VERSION_CHECK_ON_FAILURE_TIME_MS = 60 * 60 * 1000;

// frequency of update checking from the post properties UI
const UPDATE_FREQUENCY_NEVER = 'never';
const UPDATE_FREQUENCY_ALWAYS = 'always';
const UPDATE_FREQUENCY_HOURLY = 'hourly';
const UPDATE_FREQUENCY_DAILY = 'daily';
const UPDATE_FREQUENCY_WEEKLY = 'weekly';
const UPDATE_FREQUENCY_MONTHLY = 'monthly';
const UPDATE_FREQUENCY_DEFAULT = UPDATE_FREQUENCY_DAILY;

// defaults used for non-enum properties in camProperties
const GROUP_SHAPES_DEFAULT = true;
const TRACE_STOCK_DEFAULT =
// #if LBRN
true;
// #else
false;
// #endif
const OFFSET_X_AXIS_DEFAULT = 0;
const OFFSET_Y_AXIS_DEFAULT = 0;
const LASER_POWER_ETCH_MIN_DEFAULT = 0;
const LASER_POWER_ETCH_MAX_DEFAULT = 0;
const LASER_POWER_VAPORIZE_MIN_DEFAULT = 0;
const LASER_POWER_VAPORIZE_MAX_DEFAULT = 0;
const LASER_POWER_THROUGH_MIN_DEFAULT = 0;
const LASER_POWER_THROUGH_MAX_DEFAULT = 0;
const UPDATE_ALLOW_BETA_DEFAULT = false;
// #if LBRN
const SHUTTLE_LASER_1_DEFAULT = '';
const SHUTTLE_LASER_2_DEFAULT = '';
// #endif
const POWER_SCALE_DEFAULT = 100;
const Z_OFFSET_DEFAULT = 0;
const PASS_COUNT_DEFAULT = 1;
const Z_STEP_PER_PASS_DEFAULT = 0;
const GROUP_NAME_DEFAULT = '';
const GROUP_NAME_TEST = 'Test-group-name';
const CUSTOM_CUT_SETTING_XML_DEFAULT = '';
const CUSTOM_CUT_SETTING_XML_TEST = '<CutSetting><Test /></CutSetting>';
const LAUNCH_ON_POST_DEFAULT = false;
// const LAUNCH_ON_POST_PATH_DEFAULT = '';
// const LAUNCH_ON_POST_ARGUMENTS_DEFAULT = '"{path}"';

// CAM APIs offer a redirection feature to create multiple output fles (such as used in
// file-by-layer).  When JavaScript errors occur during redirection the logging information is
// lost or hard to find.  Setting this to `false` will disable redirection, but will also stop
// creating the extra files.  Should always be `true` expect when debugging problems.
const ALLOW_REDIRECT_TO_FILE = true;

// accuracy of units from CAM to determine if a segment is closed or connected
const accuracyInMM = 0.01;

// Map of characters and symbols for XML encoding/decoding
const xmlEncodeMap = {
  '&': '&amp;',
  '"': '&quot;',
  "'": '&apos;',
  '<': '&lt;',
  '>': '&gt;',
  '\t': '&#x9;',
  '\n': '&#xA;',
  '\r': '&#xD;',
};

// #if SVG
// map of colors to localized names and hex value
const layerColorMap = {
  black: { name: localize('Black'), hex: '000000' },
  green: { name: localize('Green'), hex: '178837' },
  blue: { name: localize('Blue'), hex: '2b63a3' },
  maroon: { name: localize('Maroon'), hex: '991209' },
  magenta: { name: localize('Magenta'), hex: '01484' },
  orange: { name: localize('Orange'), hex: 'f39915' },
  red: { name: localize('Red'), hex: '#f7130d' },
  gold: { name: localize('Gold'), hex: 'facc14' },
};

// ordered color table - colors for layers are selected in this order
const layerColors = [
  'black',
  'green',
  'blue',
  'maroon',
  'magenta',
  'orange',
  'red',
  'gold',
];
// #endif
