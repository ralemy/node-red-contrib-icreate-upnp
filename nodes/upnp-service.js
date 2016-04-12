/**
 * Created by ralemy on 2/21/16.
 * Node-Red node to run an ItemSense Job
 */
module.exports = function (RED) {
    "use strict";
    const upnp = require("./lib/upnp"),
        q = require("q");

    function UpnpInstanceNode(config) {
        const node = this,
            schema = `urn:${config.domain}:service:${config.serviceType}:${config.serviceVersion}`;
        RED.nodes.createNode(this, config);
        node.urn = schema;
        node.service = upnp.Server.getPeer(config.port, config.prefix);
        node.on("close", ()=> {
            node.service.then(remotes => remotes.closeServices())
        });
    }

    RED.nodes.registerType("upnp-instance", UpnpInstanceNode);
};
