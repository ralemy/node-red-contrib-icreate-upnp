/**
 * Created by ralemy on 3/28/16.
 * Sets up a Upnp Server and accepts connections
 */

"use strict";

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
        var deferred = q.defer();
        robot.service.on("disappear", function () {
            robot.event.notify({topic: "Disappeared", payload: robot});
            robot.disappeared = true;
        });
        robot.service.on("error", function (err) {
            console.log("Service error: ", err);
            robot.event.notify({topic: "error", payload: err});
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
        robot.service.on("event", function (data) {
            robot.event.notify({topic: "notify", payload: data});
        });
        peer.once("closeServices", function (target) {
            if (!target || target === robot) {
                robot.service.removeAllListeners("event");
            }
        });
        return deferred.promise;
    });
}

function RobotFinder(urn, serial, timeout) {
    var self = this;
    this.urn = urn;
    this.serial = serial;
    this.timeout = timeout;
    this.defer = q.defer();
    this.promise = this.defer.promise;
    this.removeOld(urn, serial).then(function (peer) {
        self.peer = peer;
        self.find();
    });
}

RobotFinder.prototype = {
    removeOld: function (urn, serial) {
        return peerPromise.then(function (peer) {
            if (!robots[urn][serial])
                return peer;
            return robots[urn][serial].then(function (robot) {
                peer.emit("closeServices", robot);
                delete robots[urn][serial];
                delete peer.remoteDevices[robot.service.device.UDN];
                return peer;
            });
        });
    },
    find: function () {
        this.setTimer();
        this.waitForUrn();
        this.watchForBindError();
    },
    setTimer: function () {
        var self = this;
        this.timer = setTimeout(function () {
            delete robots[self.urn][self.serial];
            self.defer.reject({
                topic: "error",
                statusCode: 403,
                message: "Timed out waiting for device: " + self.serial + " on urn: " + self.urn
            });
            self.off();
        }, this.timeout);
    },
    waitForUrn: function () {
        var self = this;
        this.peer.on(this.urn, function (service) {
            registerRobot(self.peer, self.urn, service);
            if (self.timer && service.device.serialNumber === self.serial) {
                self.defer.resolve(robots[self.urn][self.serial]);
                self.off();
            }
        });
    },
    watchForBindError: function () {
        var self = this;
        this.peer.once("deviceBindError", function (err) {
            delete robots[self.urn][self.serial];
            self.defer.reject({
                topic: "error",
                statusCode: 500,
                message: "Error Binding Device: " + err.message
            });
            self.off();
        });
    },
    off: function () {
        this.peer.removeAllListeners(this.urn);
        this.peer.removeAllListeners("deviceBindError");
        clearTimeout(this.timer);
        this.timer = null;
    }
};

class UpnpRemotes{
    constructor(){
        this._remotes = {};
    }
}

class UpnpServer {
    static  getPeer(port,endPoint){
        if(!UpnpServer._peerPromise)
            UpnpServer._peerPromise = UpnpServer.getServer(port,endPoint);
        return UpnpServer._peerPromise;
    }
    static get Remotes(){
        return UpnpServer._remotes;
    }
    static getServer(port, endPoint) {
        const peer = q.defer(),
            server = http.createServer();
        server.on("listening", function () {
            peer.resolve(UpnPServer.createPeer(server, endPoint));
        }).on("error", function (err) {
            console.log("Http UPNP Server Closed");
            peer.reject(err);
        }).on("close", function () {
            console.log("Server closed");
        });
        server.listen(port);
        return peer.promise;
    }

    static createPeer(server, endPoint) {
        const defer = q.defer(),
            peer = upnp.createPeer({
                prefix: endPoint,
                server: server
            }).on("ready", function (peer) {
                peer.on("found", function () {
                    console.log("Found", arguments);
                });
                UpnpServer._remotes = new UpnpRemotes();
                defer.resolve(peer);
            }).on("error", function (err) {
                console.log("Error in Peer", err);
            }).on("close", function () {
                console.log("High level close");
                peer.emit("closeServices");
                peerPromise = null;
            }).start();
        return defer.promise;
    }
}

function createPeer(server, endPoint) {
    var defer = q.defer(),
        peer = upnp.createPeer({
            prefix: endPoint,
            server: server
        }).on("ready", function (peer) {
            peer.on("found", function () {
                console.log("Found", arguments);
            });
            defer.resolve(peer);
        }).on("error", function (err) {
            console.log("Error in Peer", err);
        }).on("close", function () {
            console.log("High level close");
            peer.emit("closeServices");
            peerPromise = null;
        }).start();
    return defer.promise;
}

function createServer(port, endPoint) {
    var peer = q.defer(),
        server = http.createServer();
    server.on("listening", function () {
        peer.resolve(createPeer(server, endPoint));
    }).on("error", function (err) {
        console.log("Http UPNP Server Closed");
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
        return (new RobotFinder(urn, serial, timeout)).promise;
    },
    triageError: triageError,
    throwNodeError: throwNodeError,
    extend: extend,
    throwRedError: function (title, msg, node, err) {
        return throwNodeError(err, title, msg, node);
    },
    Robot: Robot
};
