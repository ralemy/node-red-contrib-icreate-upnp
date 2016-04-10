/**
 * Created by ralemy on 2/21/16.
 * Node-Red node to turn robot to a specific angle
 */
module.exports = function (RED) {
    "use strict";
    var q = require("q"),
        lib = require("./upnp");

    function turnRobot(robot, angle) {
        var defer = q.defer();
        robot.progress(lib.Robot.waitFor.bind(robot, "turn", defer));
        return robot.execute("Turn", {newTurnValue: angle}, defer);
    }

    function TurnRobotNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        this.on("input", function (msg) {
            var robot = lib.Robot.getRobot(msg, node),
                angle = lib.Robot.getNumber(msg, config, "angle");
            if (robot)
                turnRobot(robot, angle).then(function (result) {
                        node.send([
                            lib.extend(msg, {
                                topic: "TurnRobot",
                                payload: result
                            }), {
                                topic: "success",
                                payload: "turned Robot " + result.turn + " degrees"
                            }]);
                    })
                    .progress(lib.Robot.sendProgress.bind(lib.Robot, node))
                    .catch(lib.throwRedError.bind(lib, "Error Turning Robot", msg, node));
        });
    }

    RED.nodes.registerType("turn-robot", TurnRobotNode);
};
