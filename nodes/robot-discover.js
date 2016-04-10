/**
 * Created by ralemy on 2/21/16.
 * Node-Red node to run an ItemSense Job
 */
module.exports = function (RED) {
    "use strict";
    var _ = require("lodash"),
        lib = require("./upnp");

    function RobotDiscoverNode(config) {
        RED.nodes.createNode(this, config);
        var node = this,
            upnp = RED.nodes.getNode(config.upnp);

        node.on("input", function (msg) {
            node.status({
                fill: "red",
                shape: "ring",
                text: "Waiting for device " + (config.deviceSerial.length ? config.deviceSerial : "")
            });
            upnp.service.then(function (server) {
                node.send([null, {
                    topic: "progress",
                    payload: "Searching for device " + config.deviceSerial + " on " + upnp.urn
                }]);
                return lib.waitForRobot(upnp.urn, config.deviceSerial, (parseInt(config.timeout) || 1) * 1000);
            }).then(function (robot) {
                node.status({});
                msg.topic = "SVLRobot";
                msg.payload = robot;
                msg.robot = robot;
                node.send([msg, {
                    topic: "Success",
                    payload: "Found device " + config.deviceSerial + " at " + upnp.urn
                }]);
            }).catch(function (err) {
                lib.throwNodeError(err, "Error discovering robot", msg, node);
            });
        });
    }

    RED.nodes.registerType("robot-discover", RobotDiscoverNode);
};
