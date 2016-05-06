'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _jkstra = require('jkstra');

var _jkstra2 = _interopRequireDefault(_jkstra);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var OverpassLoader = function () {
    function OverpassLoader() {
        _classCallCheck(this, OverpassLoader);

        this.nodes = {};
        this.ways = [];
    }

    _createClass(OverpassLoader, [{
        key: 'buildNode',
        value: function buildNode(n) {
            this.nodes['_' + n.id] = {
                id: n.id,
                lat: n.lat,
                lng: n.lon
            };
        }
    }, {
        key: 'buildWay',
        value: function buildWay(w) {
            var _this = this;

            var way = {
                id: w.id,
                tags: this.filterTags(w.tags)
            };
            way.nodes = w.nodes.map(function (id, i, array) {
                var node = _this.nodes['_' + id];
                if (i === 0 || i === array.length - 1) {
                    node.isExtremity = true;
                } else {
                    if (!node.isPartOfWays) {
                        node.isPartOfWays = [];
                    }
                    node.isPartOfWays.push(way);
                }
                return node;
            });
            this.ways.push(way);
        }
    }, {
        key: 'filterTags',
        value: function filterTags(tags) {
            return _lodash2.default.pick(tags, ['maxspeed', 'name', 'oneway', 'highway']);
        }
    }, {
        key: 'normalizeTopology',
        value: function normalizeTopology() {
            var _this2 = this;

            function markWaysToSplitAt(node) {
                node.isPartOfWays.forEach(function (way) {
                    way.splitAt = way.splitAt ? way.splitAt.concat(node) : [node];
                });
            }

            var nodeKeys = Object.keys(this.nodes);
            nodeKeys.forEach(function (k) {
                var node = _this2.nodes[k];
                if (!node.isExtremity) {
                    if (!node.isPartOfWays) {
                        // isolated node => remove
                        delete _this2.nodes[k];
                    } else if (node.isPartOfWays.length === 1) {
                        // only shape node
                        node.isShapeNode = true;
                    } else {
                        markWaysToSplitAt(node);
                    }
                } else if (node.isPartOfWays) {
                    markWaysToSplitAt(node);
                }
            });

            var finalWays = [];
            var notSplitWays = this.ways;
            while (notSplitWays.length > 0) {
                var way = notSplitWays.pop();
                // if the way is already normalized, keep it
                if (!way.splitAt || way.splitAt.length === 0) {
                    finalWays.push(way);
                    continue;
                }

                var newPair = this.splitWayAt(way, way.splitAt.pop());
                notSplitWays.push(newPair[0], newPair[1]);
            }

            this.ways = finalWays;
        }
    }, {
        key: 'splitWayAt',
        value: function splitWayAt(way, node) {
            var nodes = way.nodes;
            var i = nodes.indexOf(node);
            var nodesA = nodes.slice(0, i + 1);
            var nodesB = nodes.slice(i);
            return [{
                id: way.id + 'a',
                tags: way.tags,
                nodes: nodesA,
                // keep only the nodes that will be in this half
                splitAt: _lodash2.default.intersection(way.splitAt, nodesA)
            }, {
                id: way.id + 'b',
                tags: way.tags,
                nodes: nodesB,
                splitAt: _lodash2.default.intersection(way.splitAt, nodesB)
            }];
        }
    }, {
        key: 'buildGraph',
        value: function buildGraph(overpassResult) {
            var _this3 = this;

            this.nodes = {};
            this.ways = [];

            var elements = overpassResult.elements;
            console.log('Load nodes...');
            elements.filter(function (e) {
                return e.type === 'node';
            }).forEach(function (e) {
                _this3.buildNode(e);
            });

            console.log('Load ways...');
            elements.filter(function (e) {
                return e.type === 'way';
            }).forEach(function (e) {
                _this3.buildWay(e);
            });

            console.log('Convert OSM graph-like to graph structure...');
            this.normalizeTopology();

            console.log('Build jKstra graph...');
            var graph = this.toJkstra();
            // graph.forEachEdge(e => {
            //     console.log(e.data);
            // });
        }
    }, {
        key: 'getOrCreateVertexFromNode',
        value: function getOrCreateVertexFromNode(n, graph) {
            if (!n.refToVertex) {
                n.refToVertex = graph.addVertex({
                    id: n.id,
                    lat: n.lat,
                    lng: n.lng
                });
            }
            return n.refToVertex;
        }
    }, {
        key: 'wayToEdges',
        value: function wayToEdges(w, from, to, g) {
            var data = {
                id: w.id,
                tags: w.tags,
                coords: this.nodesToCoords(w.nodes),
                length: 200
            };
            g.addEdge(from, to, data);
        }
    }, {
        key: 'nodesToCoords',
        value: function nodesToCoords(nodes) {
            return nodes.map(function (n) {
                return [n.lat, n.lng];
            });
        }
    }, {
        key: 'toJkstra',
        value: function toJkstra() {
            var _this4 = this;

            var g = new _jkstra2.default.Graph();

            this.ways.forEach(function (w) {
                var from = _this4.getOrCreateVertexFromNode(_lodash2.default.first(w.nodes), g);
                var to = _this4.getOrCreateVertexFromNode(_lodash2.default.last(w.nodes), g);
                _this4.wayToEdges(w, from, to, g);
            });

            return g;
        }
    }]);

    return OverpassLoader;
}();

exports.default = OverpassLoader;
module.exports = exports['default'];