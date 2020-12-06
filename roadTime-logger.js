const ZwiftPacketMonitor = require('zwift-packet-monitor')

var ifface = "192.168.1.92";
// interface is cap interface name (can be device name or IP address)
const monitor = new ZwiftPacketMonitor(ifface)




var ended = false;
  
monitor.on('outgoingPlayerState', (playerState, serverWorldTime) => {
	//console.log("-----------------");
	//console.log(serverWorldTime);
	//console.log(playerState.distance);
	//console.log(playerState.time);	
	//console.log(playerState.power);		
	console.log("id: "+playerState.id+"# distance: "+playerState.distance+" # roadTime: "+playerState.roadTime);
  
});



monitor.on('incomingPlayerState', (playerState, serverWorldTime) => {
	
	
});


// The Zwift server sends states in batches. This event is emitted at the end of each incoming batch
monitor.on('endOfBatch', () => {
  //console.log('end of batch')
})

monitor.start()