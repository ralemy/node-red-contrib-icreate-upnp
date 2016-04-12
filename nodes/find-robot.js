/**
 * Created by ralemy on 2/21/16.
 * Node-Red node to run an ItemSense Job
 */
module.exports = function (RED) {
    "use strict";
    const lib = require("./lib/util");

    function FindRobotNode(config) {
        RED.nodes.createNode(this, config);
        const node = this,
            serial = config.deviceSerial.length ? config.deviceSerial : "",
            upnp = RED.nodes.getNode(config.upnp);

        node.on("input", (msg) => {
            node.status({
                fill: "red",
                shape: "ring",
                text: `Waiting for device ${serial}`
            });
            upnp.service.then((remotes) => {
                node.send([null, {
                    topic: "progress",
                    payload: `Searching for device ${serial} on ${upnp.urn}`
                }]);
                return remotes.find(upnp.urn, config.deviceSerial, (parseInt(config.timeout) || 1) * 1000);
            }).then((robot) => {
                node.status({});
                msg.topic = "SVLRobot";
                msg.payload = robot;
                msg.robot = robot;
                node.send([msg, {
                    topic: "Success",
                    payload: `Found device ${serial} at ${upnp.urn}`
                }]);
            }).catch(lib.throwRedError.bind(lib,"Error discovering robot",msg,node));
        });
    }

    RED.nodes.registerType("find-robot", FindRobotNode);
};
