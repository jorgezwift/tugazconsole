const ZwiftPacketMonitor = require('./ZwiftPacketMonitor_tugaz')
var ip = require("ip");

var ifface = "192.168.1.92";
// interface is cap interface name (can be device name or IP address)
const monitor = new ZwiftPacketMonitor(ip.address())




var ended = false;
  
monitor.on('outgoingPlayerState', (playerState, serverWorldTime) => {
	//console.log("-----------------");
	//console.log(serverWorldTime);
	//console.log(playerState.distance);
	//console.log(playerState.time);	
	//console.log(playerState.power);		
  
});



monitor.on('incomingPlayerState', (playerState, serverWorldTime) => {
	
	if(playerState.id == 416001){
			
			var course =  ((playerState.f19 & 0xff0000) >> 16);
	var world = course - 2;
	var roadID = ((playerState.f20 & 0xff00) >> 8);
	var isForward = ((playerState.f19 & 4) !== 0);
	
	console.log("id: "+playerState.id+"# distance: "+playerState.distance+" # roadTime: "+playerState.roadTime
			+" # world: "+world
		   +" # roadID: "+roadID
		   +" # isForward: "+isForward
		   +" | roadTime: "+playerState.time);
	}
});


// The Zwift server sends states in batches. This event is emitted at the end of each incoming batch
monitor.on('endOfBatch', () => {
  //console.log('end of batch')
})

monitor.start()
