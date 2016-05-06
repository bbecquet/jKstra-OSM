'use strict';

var _overpassLoader = require('./overpassLoader.js');

var _overpassLoader2 = _interopRequireDefault(_overpassLoader);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var testData = _fs2.default.readFileSync('../test.json', { encoding: 'utf8' });

var ol = new _overpassLoader2.default();
ol.buildGraph(JSON.parse(testData));