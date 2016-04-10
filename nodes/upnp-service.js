/**
 * Created by ralemy on 2/21/16.
 * Node-Red node to run an ItemSense Job
 */
module.exports = function (RED) {
    "use strict";
    var upnp = require("./upnp"),
        q = require("q");
    function UpnpInstanceNode(config) {
        var node = this,
            defer = q.defer(),
            schema = "urn:" + config.domain + ":service:" + config.serviceType + ":" + config.serviceVersion;
        RED.nodes.createNode(this, config);
        node.service = defer.promise;
        node.urn  = schema;
        upnp.getPeer(config.port,config.prefix,schema).then(function(service){
            defer.resolve(service);
        });
        node.on("close",function(){
            upnp.getPeer(config.port,config.prefix).then(function(peer){
                peer.emit("closeServices");
            });
        });
    }

    RED.nodes.registerType("upnp-instance", UpnpInstanceNode);
};
