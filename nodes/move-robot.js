/**
 * Created by ralemy on 2/21/16.
 * Node-Red node to move robot to a specific instance
 */
module.exports = function (RED) {
    "use strict";
    const q = require("q"),
        Robot = require("./lib/robot"),
        lib = require("./lib/util");

    function moveRobot(robot, distance) {
        const defer = q.defer();
        robot.progress(Robot.waitFor.bind(robot, "location", defer));
        robot.execute("MoveTo", {newLocation: distance}, Robot.processResult.bind(Robot,defer));
        return defer.promise;
    }

    function MoveRobotNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        this.on("input", (msg) => {
            const robot = lib.Robot.getRobot(msg, node),
                distance = lib.Robot.getNumber(msg, config, "distance");
            if (robot)
                moveRobot(robot, distance).then((result)=> {
                        node.send([
                            lib.extend(msg, {
                                topic: "MoveRobot",
                                payload: result
                            }), {
                                topic: "success",
                                payload: `moved Robot ${result.location} mm`
                            }])
                    })
                    .progress(Robot.sendProgress.bind(Robot, node))
                    .catch(lib.throwRedError.bind(lib, "Error Moving Robot", msg, node));
        });
    }

    RED.nodes.registerType("move-robot", MoveRobotNode);
};
