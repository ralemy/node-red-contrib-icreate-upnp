/**
 * Created by ralemy on 2/21/16.
 * Node-Red node to turn robot to a specific angle
 */
module.exports = function (RED) {
    "use strict";
    const q = require("q"),
        Robot = require("./lib/robot"),
        lib = require("./lib/util");

    function robotStatus(robot) {
        const defer = q.defer();
        robot.api.Status({}, (result) => {
            console.log("status robot", result);
            defer.resolve(result);
        });
        return defer.promise;
    }

    function RobotStatusNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        this.on("input", (msg)=> {
            const robot = Robot.getRobot(msg, node);
            if (robot)
                robotStatus(robot).then((result) => {
                        node.send([
                            lib.extend(msg, {
                                topic: "RobotStatus",
                                payload: result
                            }), {
                                topic: "success",
                                payload: `retrieved Robot status: ${result.RetStatus}`
                            }]);
                    })
                    .progress(Robot.sendProgress.bind(Robot, node))
                    .catch(lib.throwRedError.bind(lib, "Error Getting Status", msg, node));
        });
    }

    RED.nodes.registerType("robot-status", RobotStatusNode);
};
