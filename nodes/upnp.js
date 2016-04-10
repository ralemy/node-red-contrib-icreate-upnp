/**
 * Created by ralemy on 3/28/16.
 * Sets up a Upnp Server and accepts connections
 */

var peerPromise = null;
var robots = {};

var upnp = require("./peer-upnp"),
    q = require("q"),
    _ = require("lodash"),
    http = require("http");

function registerRobot(peer, urn, service) {
    var serialNumber = service.device.serialNumber;
    robots[urn][serialNumber] = q({
        service: service,
        event: q.defer(),
        disappeared: false,
        urn: urn
    }).then(function (robot) {
        console.log("creating", Object.keys(robot));
        var deferred = q.defer();
        robot.service.on("disappear", function () {
            robot.event.notify({topic: "Disappeared", payload: robot});
            robot.disappeared = true;
        });
        robot.service.bind(function (api) {
            robot.api = api;
            robot.progress = function (cb) {
                robot.event.promise.progress.call(robot.event.promise, cb);
            };
            robot.execute = function (endPoint, inputs, defer) {
                robot.api[endPoint](inputs, Robot.processResult.bind(Robot, defer));
                return defer.promise;
            };
            deferred.resolve(robot);
        });
        robot.service.on("error", function (err) {
            robot.event.notify({topic: "error", payload: err});
        });
        robot.service.on("event", function (data) {
            robot.event.notify({topic: "notify", payload: data});
        });
        peer.once("closeServices", function (target) {
            if (!target || target === robot) {
                console.log("closing peer services");
                robot.service.removeAllListeners();
            }
        });
        return deferred.promise;
    });
}
function removeOld(urn, serial) {
    return peerPromise.then(function (peer) {
        if (!robots[urn][serial])
            return peer;
        return robots[urn][serial].then(function (robot) {
            console.log("removing", Object.keys(robot));
            peer.emit("closeServices", robot);
            delete robots[urn][serial];
            delete peer.remoteDevices[robot.service.device.UDN];
            return peer;
        });
    });
}

function findRobot(urn, serial, timeout) {
    var defer = q.defer(),
        timer = setTimeout(function () {
            delete robots[urn][serial];
            defer.reject({
                topic: "error",
                statusCode: 403,
                message: "Timed out waiting for device: " + serial + " on urn: " + urn
            });
            timer = null;
        }, timeout);
    removeOld(urn, serial).then(function (peer) {
        peer.once(urn, function (service) {
            console.log("urn", urn,service.device.serialNumber,serial);
            registerRobot(peer, urn, service);
            if (!timer || service.device.serialNumber !== serial)
                return;
            clearTimeout(timer);
            defer.resolve(robots[urn][serial]);
            timer = null;
        });
    });
    return defer.promise;
}


function createPeer(server, endPoint) {
    console.log("creating peer");
    var defer = q.defer(),
        peer = upnp.createPeer({
            prefix: endPoint,
            server: server
        }).on("ready", function (peer) {
            peer.on("error", function () {
                console.log("error in peer, level 2: ", err);
            }).on("found", function () {
                console.log("Found", arguments);
            });
            defer.resolve(peer);
        }).on("error", function () {
            console.log("Error in Peer", err);
        }).on("close", function () {
            console.log("High level close");
            peer.emit("closeServices");
            peerPromise = null;
        }).start();
    return defer.promise;
}

function createServer(port, endPoint) {
    var peer = q.defer();
    server = http.createServer();
    server.on("listening", function () {
        peer.resolve(createPeer(server, endPoint));
    }).on("error", function (err) {
        peer.reject(err);
    }).on("close", function () {
        console.log("Server closed");
    });
    server.listen(port);
    return peer.promise;
}

function stringify(target) {
    try {
        return typeof target === "object" ? JSON.stringify(target, null, " ") : target;
    } catch (e) {
        return target.toString();
    }
}

function getMessage(err) {
    if (err.response)
        if (err.response.body)
            if (err.response.body.message)
                return err.response.body.message;
            else
                return stringify(err.response.body);
    if (err.error)
        return stringify(err.error);
    if (err.message)
        return stringify(err.message);
    return stringify(err);
}
function triageError(err, title) {
    var payload = {};
    payload.title = title || "Error";
    payload.statusCode = err.statusCode || 500;
    payload.message = getMessage(err);
    return payload;
}

function extend(msg, newObj) {
    return _.extend({}, msg, newObj);
}

function throwNodeError(err, title, msg, node) {
    console.log(title, err);
    var payload = triageError(err, title);
    node.error(payload,
        extend(msg, {
            topic: "failure",
            payload: payload,
            statusCode: payload.statusCode
        }));
}


process.on("SIGINT", function () {
    console.log("Delaying Process Exit for 5 seconds");
    if (peerPromise)
        peerPromise.then(function (peer) {
            peer.close();
        });
    setTimeout(function () {
        console.log("delayed");
        process.exit();
    }, 5000);
});

var Robot = {
    isErrorMsg: function (msg) {
        console.log("notified by ", msg);
        if (msg.RetStatus)
            return !!msg.RetStatus.indexOf("200:");
        return false;
    },
    waitFor: function (property, defer, data) {
        if (data.topic === "notify" && data.payload[property])
            defer.resolve(data.payload);
        else
            defer.notify(data);
    },
    processResult: function (defer, result) {
        if (Robot.isErrorMsg(result))
            defer.reject({message: result.RetStatus, statusCode: result.RetStatus.substring(0, 3)});
        else
            defer.notify({topic: "log", message: result});
    },
    getRobot: function (msg, node) {
        if (!msg.robot)
            node.send([null, {
                topic: "error",
                payload: "No Robot object in input msg. place downstream to a robot-discover node."
            }]);
        return msg.robot;
    },
    sendProgress: function (node, data) {
        node.send([null, {topic: data.topic || "progress", payload: data.message || data}]);
    },
    getNumber: function (msg, config, key) {
        var value = msg.payload ? parseInt(msg.payload[key]) || 0 : 0;
        return value || parseInt(config[key]) || 0;
    }
};
module.exports = {
    getPeer: function (port, endPoint, urn) {
        if (!peerPromise)
            peerPromise = createServer(port || 9080, endPoint || "/upnp");
        return peerPromise.then(function (peer) {
            if (robots[urn])
                return peer;
            robots[urn] = {};
            return peer;
        });
    },
    waitForRobot: function (urn, serial, timeout) {
        if (!peerPromise)
            return q.reject({topic: "error", error: new Error("UPNP peer service not created")});
        return findRobot(urn, serial, timeout);
    },
    triageError: triageError,
    throwNodeError: throwNodeError,
    extend: extend,
    throwRedError: function (title, msg, node, err) {
        return throwNodeError(err, title, msg, node);
    },
    Robot: Robot
};
