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

// operation/layer grouping
const GROUPING_BY_OPERATION = 'group-operation';
const GROUPING_BY_LAYER = 'group-layer';
const GROUPING_BY_LAYER_FILE = 'file-layer';

// define enum for notes include level
const INCLUDE_NOTES_NONE = 'none';
const INCLUDE_NOTES_HIDDEN = 'hidden';
const INCLUDE_NOTES_SHOW_IMPORTANT = 'important';
const INCLUDE_NOTES_SHOW = 'show';

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

// define enum for speed units
const SPEED_UNITS_MMPS = 'mmps';
const SPEED_UNITS_MMPM = 'mmpm';

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

// enum for use air
const USE_AIR_OFF = 'off';
const USE_AIR_ON = 'on';
const USE_AIR_ASSIST_GAS = 'gas';

// define the name of the group used to trace the stock outline border, and the feed rate
// to associate with it (which is required, but not meaningful as the layer is turned off)
const STOCK_GROUP_NAME = 'Stock trace outline';
const STOCK_FEED_RATE = 6000;

// extension name of the state storage file
const STATE_EXTENSION = 'xml';

// time to wait on retry of version update checks when the API fails to respond
const RETRY_VERSION_CHECK_ON_FAILURE_TIME_MS = 60 * 60 * 1000;

// freqncy of update checking from the post properties UI
const UPDATE_FREQUENCY_NEVER = 'never';
const UPDATE_FREQUENCY_ALWAYS = 'always';
const UPDATE_FREQUENCY_HOURLY = 'hourly';
const UPDATE_FREQUENCY_DAILY = 'daily';
const UPDATE_FREQUENCY_WEEKLY = 'weekly';
const UPDATE_FREQUENCY_MONTHLY = 'monthly';

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
