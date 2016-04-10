/**
 * Created by ralemy on 2/21/16.
 * Node-Red node to move robot to a specific instance
 */
module.exports = function (RED) {
    "use strict";
    var q = require("q"),
        lib = require("./upnp");

    function moveRobot(robot, distance) {
        var defer = q.defer();
        robot.progress(lib.Robot.waitFor.bind(robot, "location", defer));
        return robot.execute("MoveTo", {newLocation: distance}, defer);
    }

    function MoveRobotNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        this.on("input", function (msg) {
            var robot = lib.Robot.getRobot(msg, node),
                distance = lib.Robot.getNumber(msg, config, "distance");
            if (robot)
                moveRobot(robot, distance).then(function (result) {
                        node.send([
                            lib.extend(msg, {
                                topic: "MoveRobot",
                                payload: result
                            }), {
                                topic: "success",
                                payload: "moved Robot " + result.location + " mm"
                            }])
                    })
                    .progress(lib.Robot.sendProgress.bind(lib.Robot, node))
                    .catch(lib.throwRedError.bind(lib, "Error Moving Robot", msg, node));
        });
    }

    RED.nodes.registerType("move-robot", MoveRobotNode);
};
