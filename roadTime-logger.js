const ZwiftPacketMonitor = require('./ZwiftPacketMonitor_tugaz')
var ip = require("ip");

const monitor = new ZwiftPacketMonitor(ip.address())




var ended = false;
  
monitor.on('outgoingPlayerState', (playerState, serverWorldTime) => {	
			
	var course =  ((playerState.f19 & 0xff0000) >> 16);
	var world = course - 2;
	var roadID = ((playerState.f20 & 0xff00) >> 8);
	var isForward = ((playerState.f19 & 4) !== 0);
	
	console.log("id: "+playerState.id+"# distance: "+playerState.distance+" # roadTime: "+playerState.roadTime
		   +" # world: "+world
		   +" # roadID: "+roadID
		   +" # isForward: "+isForward
		   +" | roadTime: "+playerState.time);
  
});



monitor.on('incomingPlayerState', (playerState, serverWorldTime) => {	
});


monitor.on('endOfBatch', () => {
})

monitor.start()
