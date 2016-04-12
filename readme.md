# Node-RED-Contrib-iCreate-UPNP

This is a collection of nodes to control an [iRobot iCreate2](http://www.irobot.com/About-iRobot/STEM/Create-2.aspx) that is connected to a **Raspberry PI** and is running a service that advertises it on the network as as UPNP device.

To Setup the PI for control of the robot as a UPNP device, see [PI, iCreate and UPNP repository](https://github.com/ralemy/iCreate2).

Once you have the PI running, you can `npm install node-red-contrib-icreate-upnp` in your node-red installation that will add a number of nodes to your palette. Start with a **robot-discover** node, once the robot is dicovered you can use nodes like **move-robot** to move it a certain distance or **turn-robot** to turn it a specific angle.

In your Node-RED settings file, you can create a `upnp` object with the following properties (all optional), to set the default for the robots you want to discover.
```javascript
upnp:{
    port: 8090; //port for peer to listen
    prefix: "/upnp" //path on the localhost:<port> for upnp peer
    domain: "schemas-<yourorganization>-com",
    serviceType:"iCreateRobot",
    serviceVersion:"1"
}
```

See included <code>settings.js</code> file for an example.

**Note** this contribution library adds a delay to process.exit() so that the UPNP peer can cleanly advertise its close to all peers and unregister from their services. as a result, if you restart node-red in an IDE like Intellij Idea, you may get an "address in use" error. Simply wait a couple of seconds and restart your installation again.
