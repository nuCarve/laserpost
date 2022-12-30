/**************************************************************************************
 *
 * LaserPost module: formatters.js
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
