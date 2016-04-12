/**
 * Created by ralemy on 3/28/16.
 * Sets up a Upnp Server and accepts connections
 */

"use strict";

const q = require("q"),
    _ = require("lodash");


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

function throwRedError(title, msg, node,err) {
    console.trace("Red Error ",title, err);
    var payload = triageError(err, title);
    node.error(payload,
        extend(msg, {
            topic: "failure",
            payload: payload,
            statusCode: payload.statusCode
        }));
}


module.exports = {
    triageError,
    extend,
    throwRedError
};
