/**
 * Created by ralemy on 2/21/16.
 * Node-Red node to turn robot to a specific angle
 */
module.exports = function (RED) {
    "use strict";
    var q = require("q"),
        lib = require("./upnp");

    function robotStatus(robot) {
        var defer = q.defer();
        robot.api.Status({},function(result){
            console.log("status robot",result);
            defer.resolve(result);
        });
        return defer.promise;
    }

    function RobotStatusNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        this.on("input", function (msg) {
            var robot = lib.Robot.getRobot(msg, node);
            if (robot)
                robotStatus(robot).then(function (result) {
                        node.send([
                            lib.extend(msg, {
                                topic: "RobotStatus",
                                payload: result
                            }), {
                                topic: "success",
                                payload: "retrieved Robot status " + result.RetStatus
                            }]);
                    })
                    .progress(lib.Robot.sendProgress.bind(lib.Robot, node))
                    .catch(lib.throwRedError.bind(lib, "Error Getting Status", msg, node));
        });
    }

    RED.nodes.registerType("robot-status", RobotStatusNode);
};
