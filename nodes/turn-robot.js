/**
 * Created by ralemy on 2/21/16.
 * Node-Red node to turn robot to a specific angle
 */
module.exports = function (RED) {
    "use strict";
    const q = require("q"),
        Robot =require("./lib/robot"),
        lib = require("./lib/util");

    function turnRobot(robot, angle) {
        const defer = q.defer();
        robot.progress(Robot.waitFor.bind(robot, "turn", defer));
        robot.execute("Turn", {newTurnValue: angle}, Robot.processResult.bind(Robot,defer));
        return defer.promise;
    }

    function TurnRobotNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        this.on("input", (msg) => {
            const robot = Robot.getRobot(msg, node),
                angle = Robot.getNumber(msg, config, "angle");
            if (robot)
                turnRobot(robot, angle).then((result) => {
                        node.send([
                            lib.extend(msg, {
                                topic: "TurnRobot",
                                payload: result
                            }), {
                                topic: "success",
                                payload: `Turned Robot ${result.turn} degrees`
                            }]);
                    })
                    .progress(Robot.sendProgress.bind(Robot, node))
                    .catch(lib.throwRedError.bind(lib, "Error Turning Robot", msg, node));
        });
    }

    RED.nodes.registerType("turn-robot", TurnRobotNode);
};
