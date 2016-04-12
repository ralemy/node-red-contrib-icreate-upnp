/**
 * Created by ralemy on 4/10/16.
 * Encapsulate Upnp functionality
 */

"use strict";

const q = require("q"),
    _ = require("lodash"),
    upnp = require("./peer-upnp"),
    http = require("http");

const Remotes = class UpnpRemotes {

    constructor(peer) {
        this._peer = peer;
        this._remotes = {};
        peer.on("closeServices", (target)=> {
            _.each(this._remotes, (urn) => {
                _.each(urn, (remote) => {
                    if (!target || target === remote)
                        remote.service.removeAllListeners("event");
                });
            });
        });
    }

    close() {
        this._peer.close();
    }

    closeServices(target) {
        this._peer.emit("closeServices", target);
    }

    register(urn, service) {
        const serial = service ? service.device.serialNumber : null;
        if (!this._remotes[urn])
            this._remotes[urn] = {};
        if (serial) this._remotes[urn][serial] = q({
            service: service,
            event: q.defer(),
            disappeared: false,
            urn: urn
        }).then((remote) => this.registerService(remote));
    }

    registerService(remote) {
        const defer = q.defer();
        remote.service.on("disappear", ()=> {
                remote.event.notify({topic: "Disappeared", payload: remote});
                remote.disappeared = true;
            })
            .on("error", error => remote.event.notify({topic: "error", payload: error}))
            .on("event", event => remote.event.notify({topic: "notify", payload: event}))
            .bind((api)=> {
                this.bindService(remote, api);
                defer.resolve(remote);
            });
        return defer.promise;
    }

    bindService(remote, api) {
        remote.api = api;
        remote.progress = (cb) => remote.event.promise.progress.call(robot.event.promise, cb);
        remote.execute = (endPoint, inputs, cb)=> remote.api[endPoint](inputs, cb);
    }

    remove(urn, serial) {
        const remote = this._remotes[urn] ? this._remotes[urn][serial] : null;
        return remote ?
            remote.then((remote)=> {
                this._peer.emit("closeServices", remote);
                delete this._peer.remoteDevices[remote.service.device.UDN];
                delete this._remotes[urn][serial];
                return this._peer;
            }) :
            q(this._peer);
    }

    find(urn, serial, timeout) {
        const data = {
            urn, serial, timeout,
            peer: this._peer,
            defer: q.defer()
        };
        return this.remove(urn, serial).then(()=> {
            let timer = this.setTimer(data);
            this.waitForRemote(data, timer);
            this.watchForBindError(data, timer);
            return data.defer.promise;
        });
    }

    setTimer(options) {
        const urn = options.urn,
            serial = options.serial,
            defer = options.defer,
            timeout = options.timeout;
        return setTimeout(()=> {
            if (this._remotes[urn])
                delete this._remotes[urn][serial];
            defer.reject({
                topic: "error",
                statusCode: 403,
                message: `Timed out waiting for device: ${serial} on urn: ${urn}`
            });
            this.off(urn);
        }, timeout);
    }

    waitForRemote(options, timer) {
        const urn = options.urn,
            serial = options.serial,
            defer = options.defer;
        this._peer.on(urn, (service)=> {
            this.register(urn, service);
            if (service.device.serialNumber === serial) {
                this.off(urn, timer);
                defer.resolve(this._remotes[urn][serial]);
            }
        });
    }

    watchForBindError(options, timer) {
        const urn = options.urn,
            serial = options.serial,
            defer = options.defer;
        this._peer.once("deviceBindError", (error)=> {
            delete this._remotes[urn][serial];
            defer.reject({
                topic: "error", statusCode: 500,
                message: `Error Binding Device: ${error.message}`
            });
            this.off(urn, timer);
        });
    }

    off(urn, timer) {
        this._peer.removeAllListeners(urn);
        this._peer.removeAllListeners("deviceBindError");
        if (timer)
            clearTimeout(timer);
    }
};

const Server = class UpnpServer {
    static  getPeer(port, endPoint) {
        if (!UpnpServer._peerPromise)
            UpnpServer._peerPromise = UpnpServer.getServer(port, endPoint);
        return UpnpServer._peerPromise;
    }

    static getServer(port, endPoint) {
        const peer = q.defer(),
            server = http.createServer();
        server.on("listening", () => {
            peer.resolve(UpnpServer.createPeer(server, endPoint));
        }).on("error", (err) => {
            console.log("Http UPNP Server Error", err);
            peer.reject(err);
        }).on("close", () => {
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
            }).on("ready", (peer) => {
                peer.on("found", function () {
                    console.log("Found", arguments);
                });
                defer.resolve(new Remotes(peer));
            }).on("error", (err) => {
                console.log("Error in Peer", err);
            }).on("close", () => {
                console.log("High level close");
                peer.emit("closeServices");
                UpnpServer._peerPromise = null;
            }).start();
        return defer.promise;
    }
};

process.on("SIGINT", function () {
    console.log("Delaying Process Exit for 5 seconds");
    if (Server._peerPromise)
        Server._peerPromise.then(function (remotes) {
            remotes.close();
        });
    setTimeout(function () {
        console.log("delayed");
        process.exit();
    }, 5000);
});

module.exports = {
    Server, Remotes
};