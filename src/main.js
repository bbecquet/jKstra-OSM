import OverpassLoader from './overpassLoader.js';
import fs from 'fs';

const testData = fs.readFileSync('../test.json', {encoding: 'utf8'});

const ol = new OverpassLoader();
ol.buildGraph(JSON.parse(testData));
