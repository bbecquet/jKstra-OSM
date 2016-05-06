import _ from 'lodash';
import jKstra from 'jkstra';

class OverpassLoader {
    constructor() {
        this.nodes = {};
        this.ways = [];
    }

    buildNode(n) {
        this.nodes['_' + n.id] = {
            id: n.id,
            lat: n.lat,
            lng: n.lon
        };
    }

    buildWay(w) {
        const way = {
            id: w.id,
            tags: this.filterTags(w.tags)
        };
        way.nodes = w.nodes.map((id, i, array) => {
            const node = this.nodes['_' + id];
            if(i === 0 || i === array.length - 1) {
                node.isExtremity = true;
            } else {
                if(!node.isPartOfWays) { node.isPartOfWays = []; }
                node.isPartOfWays.push(way);
            }
            return node;
        });
        this.ways.push(way);
    }

    filterTags(tags) {
        return _.pick(tags, ['maxspeed', 'name', 'oneway', 'highway']);
    }

    normalizeTopology() {
        function markWaysToSplitAt(node) {
            node.isPartOfWays.forEach(way => {
                way.splitAt = way.splitAt ? way.splitAt.concat(node) : [node];
            });
        }

        const nodeKeys = Object.keys(this.nodes);
        nodeKeys.forEach(k => {
            const node = this.nodes[k];
            if (!node.isExtremity) {
                if (!node.isPartOfWays) {
                    // isolated node => remove
                    delete this.nodes[k];
                } else if (node.isPartOfWays.length === 1) {
                    // only shape node
                    node.isShapeNode = true;
                } else {
                    markWaysToSplitAt(node);
                }
            } else if(node.isPartOfWays) {
                markWaysToSplitAt(node);
            }
        });

        const finalWays = [];
        const notSplitWays = this.ways;
        while(notSplitWays.length > 0) {
            const way = notSplitWays.pop();
            // if the way is already normalized, keep it
            if(!way.splitAt || way.splitAt.length === 0) {
                finalWays.push(way);
                continue;
            }

            const newPair = this.splitWayAt(way, way.splitAt.pop());
            notSplitWays.push(newPair[0], newPair[1]);
        }

        this.ways = finalWays;
    }

    splitWayAt(way, node) {
        const nodes = way.nodes;
        const i = nodes.indexOf(node);
        const nodesA = nodes.slice(0, i + 1);
        const nodesB = nodes.slice(i);
        return [
            {
                id: way.id + 'a',
                tags: way.tags,
                nodes: nodesA,
                // keep only the nodes that will be in this half
                splitAt: _.intersection(way.splitAt, nodesA)
            },
            {
                id: way.id + 'b',
                tags: way.tags,
                nodes: nodesB,
                splitAt: _.intersection(way.splitAt, nodesB)
            }
        ];
    }

    buildGraph(overpassResult) {
        this.nodes = {};
        this.ways = [];

        const elements = overpassResult.elements;
        console.log('Load nodes...');
        elements.filter(e => e.type === 'node').forEach(e => {
            this.buildNode(e);
        });

        console.log('Load ways...');
        elements.filter(e => e.type === 'way').forEach(e => {
            this.buildWay(e);
        });

        console.log('Convert OSM graph-like to graph structure...');
        this.normalizeTopology();

        console.log('Build jKstra graph...');
        const graph = this.toJkstra();
        // graph.forEachEdge(e => {
        //     console.log(e.data);
        // });
    }

    getOrCreateVertexFromNode(n, graph) {
        if(!n.refToVertex) {
            n.refToVertex = graph.addVertex({
                id: n.id,
                lat: n.lat,
                lng: n.lng
            });
        }
        return n.refToVertex;
    }

    wayToEdges(w, from, to, g) {
        const data = {
            id: w.id,
            tags: w.tags,
            coords: this.nodesToCoords(w.nodes),
            length: 200
        };
        g.addEdge(from, to, data);
    }

    nodesToCoords(nodes) {
        return nodes.map(n => [n.lat, n.lng]);
    }

    toJkstra() {
        const g = new jKstra.Graph();

        this.ways.forEach(w => {
            const from = this.getOrCreateVertexFromNode(_.first(w.nodes), g);
            const to = this.getOrCreateVertexFromNode(_.last(w.nodes), g);
            this.wayToEdges(w, from, to, g);
        });

        return g;
    }
}

export default OverpassLoader;
