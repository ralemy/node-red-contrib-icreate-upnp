/**
 * Created by ralemy on 4/10/16.
 * Encapsulates Robot functionality
 */
"use strict";

const upnp = require("./upnp");

const Robot = {
    isErrorMsg: msg => msg.RetStatus && msg.RetStatus.startsWith("200:"),
    waitFor(property, defer, data) {
        if (data.topic === "notify" && data.payload[property])
            defer.resolve(data.payload);
        else
            defer.notify(data);
    },
    processResult(defer, result){
        if (Robot.isErrorMsg(result))
            defer.reject({
                message: result.RetStatus || "no data available",
                statusCode: result.RetStatus ? result.RetStatus.substring(0, 3) : 500
            });
        else
            defer.notify({topic: "log", message: result});
    },
    getRobot(msg, node){
        if (!msg.robot)
            node.send([null, {
                topic: "error",
                payload: "No Robot object in input msg. place downstream to a robot-discover node."
            }]);
        return msg.robot;
    },
    sendProgress(node, data) {
        node.send([null, {topic: data.topic || "progress", payload: data.message || data}]);
    },
    getNumber(msg, config, key){
        var value = msg.payload ? parseInt(msg.payload[key]) || 0 : 0;
        return value || parseInt(config[key]) || 0;
    }
};

module.exports = Robot;

