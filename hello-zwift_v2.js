const ZwiftPacketMonitor = require('./ZwiftPacketMonitor_tugaz')
const ZwiftLineMonitor = require('zwift-line-monitor');
var ZwiftAccount = require("zwift-mobile-api");
const Rider = require('./rider');
const Team = require('./team');
const fs = require('fs');
const http = require('http');
const https = require('https');
const iomodule = require('socket.io');
const cheerio = require('cheerio');
var ip = require("ip");
const he = require('he');

module.exports = function(confFile, httpFile) {
	let rawdata = fs.readFileSync(confFile);
	var config = JSON.parse(rawdata);

	var ifface = config.ip;
	
	const monitor = new ZwiftPacketMonitor(ip.address())
	const monitorLine = new ZwiftLineMonitor();
	var account = new ZwiftAccount(config.user, config.pwd);

	//IGNORE
	//var profile = account.getProfile(416001);
	var world = account.getWorld(1);

	var startTime = config.start_time;
	//GET MAP DETAILS
	let mapdata = fs.readFileSync('maps/'+config.map+'.json');
	let mapconfig = JSON.parse(mapdata);

	var endDistance = mapconfig.distance;
	var reverseMap = mapconfig.reverse;
	 
	var ended = false; 

	var finalTime = -1;
	var liderRoadPOS = 0;

	var tugaTeam = {
		team_leader: config.team_leader,
		team_class: config.team_class,
		rider: {
			zid: 0		
		},
		startTime:0,
		power:0,
		time:0,
		total_time:0,
		avgpowerABS:0,
		avgpowerREL:0,
		riderorder:[],
		riderorder_index:-1,
		riderorder_time:2,
		riderorder_active: false
	};

	tugaTeam.riderorder_active = config.turn_timer_active;
	if(tugaTeam.riderorder_active)
		tugaTeam.riderorder = config.turns_sequence_name;

	var currentMap = mapconfig.lines;

	//BUILD TEAMS
	var WTRLTeams = {};
	function buildTeamsConfig(){
		WTRLTeams = {};
		WTRLTeams['team'+config.team_leader] = new Team(config.team_leader, "TugaZ", true, startTime);
		for (var i = 0; i < config.other_teams.length; i++) {   

			var tObj = config.other_teams[i];
			if(tObj.active){
				var startT = startTime;
				if(typeof tObj.startTime != 'undefined'){
					startT = tObj.startTime;
				}
				var tTeam = new Team(tObj.team_leader, tObj.name, tObj.active, startT);
				if(typeof tObj.marks != 'undefined'){
					tTeam.marks = tObj.marks;
					tTeam.complete = true;
				}
				
				WTRLTeams['team'+tObj.team_leader] = tTeam;
			}
		}
	}
	buildTeamsConfig();
	//BUILD TEAM ROSTER
	var tugaZRiders = {};
	function buildTeamRosterConfig(){
		tugaZRiders = {};
		for (var i = 0; i < config.riders.length; i++) {   
			var rObj = config.riders[i];
			if(rObj.active){
				var tRider = new Rider(
						rObj.zid, 
						he.decode(rObj.name), 
						rObj.weight,
						rObj.ftp);
				tugaZRiders['rider'+rObj.zid] = tRider;
				if(typeof rObj.ftp != 'undefined'){
					tRider.cp = rObj.ftp;
					if(typeof rObj.wprime != 'undefined'){
						tRider.wprime = rObj.wprime;
					}else{
						tRider.wprime = 0.0538*tRider.cp+8.78;
					}
				}
			}
		}
	}
	buildTeamRosterConfig();
	
	monitorLine.addDistanceMark(100, currentMap[0].name, currentMap[0].roadTime);

	for(var i = 1; i<currentMap.length; i++){
		monitorLine.addDistanceMark(i-1, currentMap[i].name, currentMap[i].roadTime);	
	}

	monitorLine.on('crossing', (crossing) => {
		
		var team = WTRLTeams['team'+crossing.riderId];
		if(typeof team != 'undefined'){
			if(team.active){
				if(crossing.lineId==100){
					var today = new Date();
					var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
					team.start_clock_time = time;
				}else{
					if(team.marks.length>crossing.lineId){
						return;
					}else if(team.marks.length<crossing.lineId){
						for(var i = team.marks.length;i<crossing.lineId;i++){
							team.marks[i] = -1;
						}
					}
					team.marks[crossing.lineId] = crossing.time;
					if(crossing.lineId == (currentMap.length-2) ){
						team.complete = true;
					}
				}
			}
		}	
	});

	monitor.logFinalTugaZ = function(){
		//monitor.logTugaZ();
		console.log("\nFim!")
		for(var key in tugaZRiders){
			var rider = tugaZRiders[key];
			
			console.log(""+rider.name+":"+
						'Frente: '+Math.floor(rider.timeinfront/60/1000)+'m'+(Math.round(rider.timeinfront/1000)%60)+'s ## '+rider.powerinfront+'W ('+(Math.round(rider.powerinfront*10/rider.weigth)/10)+')');
		}
	}

	function swap(arr, first_Index, second_Index){
		var temp = arr[first_Index];
		arr[first_Index] = arr[second_Index];
		arr[second_Index] = temp;
	}

	function bubble_Sort(arr, line){

		var len = arr.length,
			i, j, stop;
			
		for (i=1; i < len; i++){
			for (j=0, stop=len-i; j < stop; j++){
				if (arr[j].marks[line] > arr[j+1].marks[line]){
					swap(arr, j, j+1);
				}
			}
		}

		return arr;
	}

	monitor.logTugaZ = function(){
		console.clear();
		console.log('\x1b[33m%s\x1b[0m', "|--------------------------------------------------------------------------------|");
		console.log('\x1b[33m%s\x1b[0m', "|------------------------------     TugaZ WTRL         --------------------------|");
		console.log('\x1b[33m%s\x1b[0m', "|--------------------------------------------------------------------------------|\n");
		console.log('\x1b[36m%s\x1b[0m', "|--------------------------------------------------------------------------------|");
		var header = " TEAMS\t\t|";
		for(var j = 1;j<currentMap.length;j++){
			header=header+" "+currentMap[j].name+"\t|";
		}
		console.log('\x1b[36m%s\x1b[0m', header);
		
		console.log('\x1b[36m%s\x1b[0m', "|--------------------------------------------------------------------------------|");
		
		var WTRLTeamsTemp = { ...WTRLTeams };   
		
		if(WTRLTeams['team'+config.team_leader].marks.length>0){
			var line_array = [];
			
			for(key in WTRLTeamsTemp){
				var team = WTRLTeamsTemp[key];
				if(team.active){
					if(team.marks.length>=WTRLTeams['team'+config.team_leader].marks.length){
						line_array.push(WTRLTeams[key]);
						
						delete WTRLTeamsTemp[key];
					}
				}	
			}
			
			if(line_array.length>1){
				line_array = bubble_Sort(line_array,WTRLTeams['team'+config.team_leader].marks.length-1);
			}
			
			for(var jj = 0;jj<line_array.length;jj++){	
				var team = line_array[jj];
				var header = " "+team.name+"\t|";
				for(var j3 = 0;j3<team.marks.length;j3++){
					if(team.marks[j3]==-1)
						header=header+"   -  \t|";
					else
						header=header+" "+Math.floor(team.marks[j3]/60)+"m"+Math.round(team.marks[j3]%60)+"\t|";
				}
				console.log('\x1b[36m%s\x1b[0m', header);
			}		
		}
		
		for(var j = (currentMap.length-1);j>=0;j--){
			var line_array = [];
			for(key in WTRLTeamsTemp){
				var team = WTRLTeamsTemp[key];
				if(team.active){
					if(team.marks.length>j){
						line_array.push(WTRLTeams[key]);
						
						delete WTRLTeamsTemp[key];
					}
				}	
			}
			if(line_array.length>1){
				line_array = bubble_Sort(line_array,j);
			}
		
			for(var jj = 0;jj<line_array.length;jj++){
		
				var team = line_array[jj];
				var header = " "+team.name+"\t|";
				for(var j3 = 0;j3<team.marks.length;j3++){
					if(team.marks[j3]==-1)
						header=header+"   -  \t|";
					else
						header=header+" "+Math.floor(team.marks[j3]/60)+"m"+Math.round(team.marks[j3]%60)+"\t|";
				}
				console.log('\x1b[36m%s\x1b[0m', header);
			}
		
		}
		
		for(key in WTRLTeamsTemp){
			if(WTRLTeamsTemp[key].active){
				var header = " "+WTRLTeamsTemp[key].name+"\t|";
				console.log('\x1b[36m%s\x1b[0m', header);
			}	
		}
		
		console.log('\x1b[36m%s\x1b[0m', "|--------------------------------------------------------------------------------|");
		console.log('\n\x1b[47m\x1b[31m%s\x1b[0m',
					'\t\t      Distancia:   '+tugaTeam.rider.distance/1000+" km     \n"+
					'\t\t      Vel. Med:    '+Math.round(tugaTeam.rider.speed*1000)/1000+" km/h   \n"+
					'\t\t      Pot. TugaZ:  '+Math.round(tugaTeam.avgpowerABS*10)/10+'W ('+Math.round(tugaTeam.avgpowerREL*100)/100+'W/K)  \n'+
					'\t\t      Tempo:       '+Math.floor(tugaTeam.rider.time/60)+"m"+(tugaTeam.rider.time%60)+'    ');			
			
		if(!ended){
				
			if(tugaTeam.rider.zid!=0){	
				console.log('\n\x1b[1;33;43m\x1b[36m%s\x1b[0m',
							'\t\t      CABEÇA DO GRUPO      \n'+
							'\t\t      '+tugaTeam.rider.name+'                     \n'+
							'\t\t      Potencia BRU:  '+tugaTeam.rider.power+'W   \n'+
							'\t\t      Potencia REL:  '+(Math.round(tugaTeam.rider.power*10/tugaTeam.rider.weigth)/10)+'W/K   \n'+
							'\t\t                                          \n'+
							'\t\t      Tempo:     '+Math.floor(tugaTeam.time/1000/60)+"m"+(Math.round(tugaTeam.time/1000)%60)+'\n');
			}		

			console.log("\t\t ----------------\n"+
			'\t\t RIDER\t\tPOWER\t\tTEMPO NA RODA\t\tRoadTime\n ');
			for(var key in tugaZRiders){
				var rider = tugaZRiders[key];
				if(rider.active){
					console.log(
								
								'\t\t '+rider.name+':\t '+
								rider.power+
								'('+(rider.power == 0 ? 0 : Math.round(rider.power*100/rider.weigth)/100)+'w/k) \t\t '+
								Math.floor(Math.round(rider.timeinback/1000)/60)+'m'+Math.round(rider.timeinback/1000)%60+'s\t\t '+
								rider.roadTime);		
				}
			}
		}			
			
		if(ended){
			monitor.logFinalTugaZ();
		}
		
	};
	  
	monitor.on('outgoingPlayerState', (playerState, serverWorldTime) => {
		try{
			var today = new Date();
			var h = today.getHours();
			if(h<10)
				h="0"+h;
			var m = today.getMinutes();
			if(m<10)
				m="0"+m;
			var s = today.getSeconds();
			if(s<10)
				s="0"+s;
			var time = h + "" + m + "" + s;
			if(time>startTime){
				if(!ended){
					updatePlayer(playerState);
				}
			}
		}catch(e){
			console.log("a. "+e);
		}		
	});

	monitor.on('incomingPlayerState', (playerState, serverWorldTime) => {
		var today = new Date();
		var h = today.getHours();
		if(h<10)
			h="0"+h;
		var m = today.getMinutes();
		if(m<10)
			m="0"+m;
		var s = today.getSeconds();
		if(s<10)
			s="0"+s;
		var time = h + "" + m + "" + s;
		if(time>startTime){
			updateRiders(playerState);
		}	
	});

	var BreakException = {};
	function updateRiders(playerState){
		if(!ended){
			
			//!playerState.power removed to receive data while supertucking
			if(!playerState.distance || /*!playerState.power ||*/ !playerState.time || !playerState.worldTime )
				return;
			if(playerState.distance!=0){			
				if(typeof tugaZRiders['rider'+playerState.id] != 'undefined'){
					var rider = tugaZRiders['rider'+playerState.id];
					var cur_time = playerState.worldTime.toNumber();
					
					var packet_time = playerState.worldTime.toNumber();
					if(rider.worldTime>=packet_time)
						return;
					
					if(rider.active){
						if(playerState.id==config.team_leader){
							if(liderRoadPOS!=0){
								if(liderRoadPOS>playerState.roadTime && Math.abs(liderRoadPOS-playerState.roadTime)<50000)
									reverseMap = true;
								else if(liderRoadPOS<playerState.roadTime && Math.abs(liderRoadPOS-playerState.roadTime)<50000)
									reverseMap = false;
							}
							liderRoadPOS = playerState.roadTime;
						}		
						rider.distance = playerState.distance;
						rider.power = playerState.power;
						
						try{
							rider.power5s.forEach(
								function(item, index, object){
									if(item.time<rider.time-5){
										object.splice(index,1);
									}else{
										throw BreakException;
									}
								}
							);
						} catch (e) {
						  if (e !== BreakException) throw e;
						}
						try{		
							if(rider.power10s.length>0){
								if(rider.power10s[0].time<rider.time-60){
									var p1sum = 0;
									var p1count = rider.power10s.length;
									rider.power10s.forEach(
										function(item, index, object){
											p1sum = p1sum+item.power;
										}
									);
									rider.power10s=[];
									rider.power30s.push({power: p1sum/p1count, time: (rider.time-60)});
								}
							}
						} catch (e) {
						  if (e !== BreakException) throw e;
						}
						try{					
							rider.power30s.forEach(
								function(item, index, object){
									if(item.time<rider.time-(60*20)){
										object.splice(index,1);
									}else{
										throw BreakException;
									}
								}
							);
						} catch (e) {
						  if (e !== BreakException) throw e;
						}
						
						rider.power5s.push({power: rider.power, time: rider.time});
						rider.power10s.push({power: rider.power, time: rider.time});
						//rider.power30s.push({power: rider.power, time: rider.time});
					
						var timeTemp = rider.time;
						if(rider.time == playerState.time){
							rider.time = rider.time+((packet_time-rider.worldTime)/1000);
						}else{
							rider.time = playerState.time;
						}
						if(rider.roadTime != 0){
							rider.roadTimeMs = (playerState.roadTime-rider.roadTime)
												/ (packet_time-rider.worldTime);
						
							rider.avgpower = ((rider.avgpower*timeTemp)+(rider.power*(rider.time-timeTemp)))/
												rider.time;
						}
						
						rider.roadTime = playerState.roadTime;
						rider.cur_speed = playerState.speed;
						
						rider.worldTime = packet_time;
						rider.speed = (rider.distance/rider.time)*3600/1000;				
					}
				}
			}
		}
	}
	function updatePlayer(playerState){
		
	  if(!ended){
		const obj = playerState;
	  
	  if(typeof obj != 'undefined'){
		if(typeof obj.id != 'undefined'){
			if(config.user_is_rider && obj.id == config.user_zid){

				if(!playerState.distance /*|| !playerState.power*/ || !playerState.time || !playerState.worldTime )
					return;
				
				var rider = tugaZRiders['rider'+config.user_zid];
				var packet_time = playerState.worldTime.toNumber();
					if(rider.worldTime>=packet_time)
						return;	
				if(playerState.time != 0){
					updateRiders(playerState);
				}
		  }  
		}  
	  }}
	}


	var printFreq = 0;
	monitor.on('endOfBatch', () => {
	  try{
		var today = new Date();
		var h = today.getHours();
		if(h<10)
			h="0"+h;
		var m = today.getMinutes();
		if(m<10)
			m="0"+m;
		var s = today.getSeconds();
		if(s<10)
			s="0"+s;
		var time = h + "" + m + "" + s;
		
		if(time>startTime){
			var highest_time = 0;
			var highest_time_distance = 0;
			var circuit_limit = false;
			for(var key in tugaZRiders){
				var rider = tugaZRiders[key];
				if(rider.worldTime > highest_time){
					highest_time = rider.worldTime;
				}
				if(rider.distance > highest_time_distance){
					highest_time_distance = rider.distance;
				}
				if(rider.roadTime > 1000000 || rider.roadTime < 5000){
					circuit_limit = true;
				}
			}
			
			var frontid = 0;
			var frontdistance = 0;
			var originalfrontdistance = 0;
			var position_array = [];
		
			for(var key in tugaZRiders){
				var rider = tugaZRiders[key];
				if(rider.speed>0){
					rider.ko = false;
					var current_distance = 0;
					if(highest_time_distance<(rider.distance+150)){	
						if(rider.worldTime == highest_time){
							current_distance = rider.roadTime;
						}else{
							var diff = highest_time-rider.worldTime;
							var distanceTemp = rider.roadTimeMs*diff;
							current_distance = rider.roadTime+distanceTemp;
						}
						
						if(reverseMap)
							current_distance = 1005000-current_distance;
						else	
							current_distance = current_distance;
						
						var comparable = current_distance;
						if(circuit_limit){
							if(comparable<305000)
								comparable = comparable+1000000;
						}	
						if(comparable>frontdistance){
							frontid = rider.zid;
							frontdistance = comparable;
						}
						
						var added = false;
						for(var posi = 0;posi<position_array.length;posi++){
							if(comparable>position_array[posi].frontdistance){
								added = true;
								position_array.splice(posi, 0, {"frontdistance":comparable,"zid":rider.zid});
								break;
							}
						}
						if(!added)
							position_array.splice(position_array.length, 0, {"frontdistance":comparable,"zid":rider.zid});
								
						

					}else{
						rider.ko = true;
					}

				}else{
					rider.ko = true;
				}	
			}
			
			if(frontid!=0){			
				if(tugaTeam.startTime!=0){
					for(var key in tugaZRiders){
						
						var rider = tugaZRiders[key];
						if(rider.zid != frontid){
							rider.timeinback = rider.timeinback+
												(highest_time
												-
												(tugaTeam.startTime+tugaTeam.time));
						}
						
						//UPDATE POSITIONS
						for(var posi = 0;posi<position_array.length;posi++){
							if(position_array[posi].zid == rider.zid){
								rider.position[posi] = rider.position[posi] +
												(highest_time
												-
												(tugaTeam.startTime+tugaTeam.time));
							}
						}
						
						//UPDATE W'Bal
						//-> (highest_time-(tugaTeam.startTime+tugaTeam.time))
						if(rider.cp != -1){
							var ttt_time = tugaTeam.total_time;
							if(ttt_time==0){
								ttt_time = 500;
							}
							var tdiff = highest_time - (ttt_time+tugaTeam.time);
							if(tdiff>0)
								rider.w_bal(tdiff, ttt_time);
						}
					}
				}
				
				if(highest_time>(tugaTeam.startTime+tugaTeam.time)){
				
					if(tugaTeam.rider.zid == frontid){
						var time2 = tugaTeam.time; 
						tugaTeam.avgpowerABS = ((tugaTeam.avgpowerABS*tugaTeam.total_time) +
											   (tugaTeam.rider.power*(highest_time-(tugaTeam.startTime+time2)))) /
											   (tugaTeam.total_time + (highest_time-(tugaTeam.startTime+time2)));
						
						tugaTeam.avgpowerREL = ((tugaTeam.avgpowerREL*tugaTeam.total_time) +
											   ((tugaTeam.rider.power/tugaTeam.rider.weigth)*(highest_time-(tugaTeam.startTime+time2)))) /
											   (tugaTeam.total_time + (highest_time-(tugaTeam.startTime+time2)));
						
						var timeinfrontW = 0;
						if(tugaTeam.rider.timeinfront>0)
							timeinfrontW = tugaTeam.rider.powerinfront*tugaTeam.rider.timeinfront;
					
						tugaTeam.rider.powerinfront = (timeinfrontW
														+
													tugaTeam.rider.power*(highest_time-(tugaTeam.startTime+time2)))
														/
													(tugaTeam.rider.timeinfront + (highest_time-(tugaTeam.startTime+time2)));													
						
						tugaTeam.rider.timeinfront = tugaTeam.rider.timeinfront + (highest_time-(tugaTeam.startTime+time2));
											  
											  
						tugaTeam.time = highest_time - tugaTeam.startTime;
						tugaTeam.total_time = tugaTeam.total_time + (highest_time-(tugaTeam.startTime+time2));
						
						var time3 = tugaTeam.time-time2;
						tugaTeam.power = ((time2 * tugaTeam.power) + (time3 * tugaTeam.rider.power))/tugaTeam.time;
					}else{
						if(tugaTeam.rider.zid!=0){
							if(tugaTeam.rider.powerinfront == 0)
								tugaTeam.rider.powerinfront = tugaTeam.rider.power;
							else{
								tugaTeam.rider.powerinfront = 	((tugaTeam.rider.powerinfront*tugaTeam.rider.timeinfront)
																+
																(tugaTeam.power*(highest_time - (tugaTeam.startTime+tugaTeam.time))))
																/
																(tugaTeam.rider.timeinfront+highest_time - (tugaTeam.startTime+tugaTeam.time));
							}
							tugaTeam.rider.timeinfront = tugaTeam.rider.timeinfront + highest_time - (tugaTeam.startTime+tugaTeam.time);
						}
						
						tugaTeam.rider = tugaZRiders['rider'+frontid];
						
						if(tugaTeam.startTime==0){
							tugaTeam.startTime = highest_time-500;
							tugaTeam.rider.powerinfront = tugaTeam.rider.power;
							tugaTeam.rider.timeinfront = 500;
						}else
							tugaTeam.startTime = tugaTeam.startTime+tugaTeam.time;
						
						tugaTeam.time = highest_time - tugaTeam.startTime;
						
						tugaTeam.avgpowerABS = ((tugaTeam.avgpowerABS*tugaTeam.total_time) +
											   (tugaTeam.rider.power*tugaTeam.time)) /
											   (tugaTeam.total_time + tugaTeam.time);
						
						tugaTeam.avgpowerREL = ((tugaTeam.avgpowerREL*tugaTeam.total_time) +
											   ((tugaTeam.rider.power/tugaTeam.rider.weigth)*tugaTeam.time)) /
											   (tugaTeam.total_time + tugaTeam.time);
						tugaTeam.total_time = tugaTeam.total_time + tugaTeam.time;
						
						tugaTeam.rider.timeinback = 0;
						tugaTeam.power = tugaTeam.rider.power;
					}
					
				}else{
					//console.log(highest_time);
					//console.log(tugaTeam);
				}	
			}
	  
			printFreq++;
			if(!ended && printFreq%10==0){
				//monitor.logTugaZ();
				//io.sockets.emit("zevent", { tugaZ: { blob: tugaTeam, riders: tugaZRiders}, distanceMarks: currentMap, WTRLTiming: WTRLTeams, 'ended': ended} );
			}
			
			if(highest_time_distance > endDistance && finalTime == -1){
				finalTime = highest_time;
				ended = true;
				monitor.logTugaZ();
			}
		}
		
		}catch(e){
			console.log("b. "+e);
		}		
	})

	monitor.start();

	const interval = setInterval(function() {
	   
   	var today = new Date();
	var h = today.getHours();
	if(h<10)
		h="0"+h;
	var m = today.getMinutes();
	if(m<10)
		m="0"+m;
	var s = today.getSeconds();
	if(s<10)
		s="0"+s;
	var time = h + "" + m + "" + s;
	//console.log(time);
		for(var key in WTRLTeams){
			var team = WTRLTeams[key];
			if(time>team.startTime){
				if(team.active && !team.complete){
				//console.log("get: "+team.name);
					world.riderStatus(team.zid).then(statuss => {
						statuss.roadID=0;
						statuss.world=1;

						if(!ended){
							//updateRiders(statuss.riderStatus);
						}
						
						if(typeof WTRLTeams['team'+statuss.riderStatus.id] != 'undefined')
							WTRLTeams['team'+statuss.riderStatus.id].distance = statuss.riderStatus.distance;
				
						monitorLine.updateRiderStatus(statuss.riderStatus, statuss.riderStatus.worldTime);
					});
				}
			}
		}
	 }, 8000);

	process.on('unhandledRejection', error => {
	  console.log('unhandledRejection', error.message);
	});

	//const content = fs.readFileSync(httpFile, 'utf8');

	const httpServer = http.createServer((req, res) => {
	  /*res.setHeader('Content-Type', 'text/html');
	  res.setHeader('Content-Length', Buffer.byteLength(content));
	  res.end(content);*/
	  console.log("req.url: "+req.url);
	  var filee = req.url;
	  if(filee == '/'){
		  filee = "/"+httpFile;
	  }
	  console.log("req.url: "+filee);
	  fs.readFile("./"+filee, function (err,data) {
		if (err) {
		  res.writeHead(404);
		  console.log("ERROR: "+JSON.stringify(err))
		  res.end("ERROR - Someone is doing something wrong!");
		  return;
		}
		res.setHeader('Content-Length', Buffer.byteLength(data));
		if(req.url.endsWith(".html"))
			res.setHeader('Content-Type', 'text/html');
		else if(req.url.endsWith(".js"))
			res.setHeader('Content-Type', 'text/javascript');
		else if(req.url.endsWith(".css"))
			res.setHeader('Content-Type', 'text/css');
		
		res.writeHead(200);
		res.end(data);
	  });
	});

	const io = iomodule(httpServer);

	io.on('connect', socket => {
	  console.log('connect');
	  io.sockets.emit("zevent", { tugaZ: { blob: tugaTeam, riders: tugaZRiders}, distanceMarks: currentMap, WTRLTiming: WTRLTeams, 'ended': ended} );
	});
	
	io.on('connect', socket => {
	  console.log('connect');
	  
	  socket.on('message', function(msg){
		console.log('received', msg);
		var msgObj = JSON.parse(msg);
		if(msgObj.action == 'build_conf'){
			console.log("Starting Building Conf");
			//https://www.zwiftpower.com/cache3/results/1326092_signups.json?_=1608417944711
			socket.emit('info',{"ended":false,"msg":'Starting Building Conf'});
			var domStr = "";
			var teamFound = false;
			var teamObj;
			var WTRL_signedUpTeams = new Object; 
			var WTRL_signedUpTeamTags = new Object; 
			const request = https.get('https://www.wtrl.racing/ttt/TTT-Event.php?_='+Math.round(Math.random()*1000000), function(response) {
			  response.on('data', (d) => {
				console.log("WTRL Part Data Received");
				domStr += d;
				
			  });
			  response.on('end', () => {
				const $ = cheerio.load(domStr);
				console.log("WTRL DOM Loaded");
				socket.emit('info',{"ended":false,'msg':'WTRL DOM Loaded'});
				$('#reg_ttt tbody tr').each(function(i, tr){
					console.log("Team Line: "+i);
					var curTeam = new Object;
					
					var children = $(this).children('td').each(function(j, td){
						//console.log("Line Column: "+j);
						var td = $(this);
						if(j==0){
							console.log(td.text());
							curTeam.zone=td.text();
							
						}else if(j==1){
							
							console.log(td.text());
							curTeam.cl=td.text();
						}else if(j==2){			
							console.log(td.html());
							curTeam.name=td.text();
						}else if(j==4){						
							console.log(td.html());
							curTeam.tag=td.text();
							if(curTeam.tag == msgObj.tag){
								teamFound = true;
								teamObj = curTeam;
							}	
						}else if(j==5){			
							console.log(td.html());
							curTeam.box=td.text();
						}else if(j==6){
							console.log(td.html());
							var edate = td.html();
							edate = edate.substring(edate.lastIndexOf("-")+1).trim();
							var hourStr = "";
							var pm = 0;
							if(edate.indexOf("PM")>-1)
								pm = 12;
							edate = edate.substring(0, edate.indexOf(" ")).trim();
							edateHour = edate.substring(0, edate.indexOf(":")).trim();
							edateMinute = edate.substring(edate.indexOf(":")+1).trim();
							
							curTeam.startTime=""+(pm+parseInt(edateHour))+""+edateMinute+"00";
							
							console.log(curTeam.startTime);
						}else if(j==7){
							var linka = $(td).children('a');
							var href1 = linka.attr('href');
							var href2 = href1.substring(href1.lastIndexOf("/")+1);
							console.log(href2);
							curTeam.eid=href2;
							if(true){
								if(typeof WTRL_signedUpTeams[curTeam.cl] == 'undefined')
									WTRL_signedUpTeams[curTeam.cl] = new Object;
								if(typeof WTRL_signedUpTeams[curTeam.cl][curTeam.zone] == 'undefined'){
									WTRL_signedUpTeams[curTeam.cl][curTeam.zone] = new Array;
								}
								WTRL_signedUpTeams[curTeam.cl][curTeam.zone].push(curTeam);
								WTRL_signedUpTeamTags[curTeam.tag] = curTeam;
							}
						}	
					});	
					console.log("--------");
				});
				
				if(!teamFound){
					socket.emit('info',{"ended":true,'msg':'WTRL Teams Processed. TugaZ tag not Found.'});
				}else{
					socket.emit('info',{"ended":false,'msg':'WTRL Teams Processed. Getting ZP info.'});
					//Get ZP Info
					var allDivs = [];
					allDivs.push({
						"eid" : WTRL_signedUpTeams[teamObj.cl][teamObj.zone][0].eid,
						"startTime" : WTRL_signedUpTeams[teamObj.cl][teamObj.zone][0].startTime
					});
					
					for (zoneKey in WTRL_signedUpTeams[teamObj.cl]) {
						var process = false;
						if(zoneKey=='PL' && msgObj.pl)
							process = true;
						else if(zoneKey=='1' && msgObj.z1)
							process = true;
						else if(zoneKey=='2' && msgObj.z2)
							process = true;
						else if(zoneKey=='3' && msgObj.z3)
							process = true;
						else if(zoneKey=='4' && msgObj.z4)
							process = true;
						else if(zoneKey=='5' && msgObj.z5)
							process = true;
						else if(zoneKey=='6' && msgObj.z6)
							process = true;
						else if(zoneKey=='7' && msgObj.z7)
							process = true;
						else if(zoneKey=='8' && msgObj.z8)
							process = true;
						else if(zoneKey=='9' && msgObj.z9)
							process = true;
						else if(zoneKey=='10' && msgObj.z10)
							process = true;
						else if(zoneKey=='11' && msgObj.z11)
							process = true;
						
						if(zoneKey != teamObj.zone && process){
							allDivs.push(
							{
								"eid" : WTRL_signedUpTeams[teamObj.cl][zoneKey][0].eid,
								"startTime" : WTRL_signedUpTeams[teamObj.cl][zoneKey][0].startTime
							}
							);
						}
					}

					getZPDivision(teamObj, allDivs, 0, function(teamRetObj){
						
						if(Object.keys(teamRetObj.teams).length > 0 && Object.keys(teamRetObj.riders).length > 0){
						
							console.log(teamRetObj);
							//WRITE IP - ip
							config.ip = ip.address();
							//WRITE TEAMS - other_teams
							/*
							{
								"team_leader": 9,
								"name": "", 
								"active": true
							}
							*/
							config.other_teams = [];
							for(var team_key in teamRetObj.teams){
								var nTeam = teamRetObj.teams[team_key];
								if(typeof WTRL_signedUpTeamTags['('+team_key+')'] != 'undefined'){
									if(WTRL_signedUpTeamTags['('+team_key+')'].cl == teamObj.cl){
										var nTeam_Obj = new Object;
										nTeam_Obj.name = nTeam.name;
										nTeam_Obj.team_leader = nTeam.rider.zid;
										nTeam_Obj.active = true;
										config.other_teams.push(nTeam_Obj);
									}
								}
							}		
							
							//WRITE START_TIME - start_time
							config.start_time = teamRetObj.startTime;
							//WRITE RIDERS - riders
							/*
							{
								"zid": 416001,
								"name": "J. Carvalho",
								"weight": 75,
								"active": true
							}				
							*/
							config.riders = [];
							var tCaptain = {'rank':601,'zid':0};
							for(var rider_key in teamRetObj.riders){
								var nRider = teamRetObj.riders[rider_key];
								var nRider_Obj = new Object;
								nRider_Obj.name = nRider.name.replace(" "+teamRetObj.tag, "");
								nRider_Obj.zid = nRider.zid;
								nRider_Obj.ftp = nRider.ftp;
								nRider_Obj.weight = parseFloat(""+(nRider.weight == 0 ? "80" : nRider.weight));
								nRider_Obj.active = true;
								if(nRider.rank < tCaptain.rank )
									tCaptain = nRider;
								config.riders.push(nRider_Obj);
							}
							//WRITE TEAM CAPTAIN - team_leader
							config.team_leader = tCaptain.zid;
							//WRITE TEAM CLASS - team_class
							config.team_class = teamRetObj.cl.toLowerCase();
							
							
							fs.writeFile(confFile, JSON.stringify(config, null, 4), function (a,b,c){
								
								let rawdataT = fs.readFileSync(confFile);
								config = JSON.parse(rawdataT);
								tugaTeam.team_leader = config.team_leader;
								tugaTeam.team_class = config.team_class;
								
								buildTeamsConfig();
								buildTeamRosterConfig();
								socket.emit('info',{"ended":true,'msg':'ZP Info Processed. File Saved. Info Loaded'});
								
							});
						}else{
							socket.emit('info',{"ended":true,'msg':'ZP Info Not Complete. File NOT Saved. Info NOT Loaded'});
				
						}
					}, socket);
					
				}
				
			  });	
			});
		}
	  });
	  
	  io.sockets.emit("zevent", { tugaZ: { blob: tugaTeam, riders: tugaZRiders}, distanceMarks: currentMap, WTRLTiming: WTRLTeams, 'ended': ended} );
	});

	httpServer.listen(config.port, () => {
	  console.log('running at http://localhost:'+config.port);
	});
	
	const getZPDivision = function(teamArg, allDivs, index, callback, socket){
		const ZP_Signup_file = fs.createWriteStream("zp_signup.json");
		var getRiders = false;
		if(allDivs[index].eid == teamArg.eid)
			getRiders = true;
		
		var urlZP = "https://www.zwiftpower.com/cache3/results/"+allDivs[index].eid+'_signups.json?_='+Math.round(Math.random()*1000000);
		console.log("urlZP: "+urlZP);
		const request = https.get(urlZP, function(response) {
			console.log("response.statusCode: "+response.statusCode);
			if(response.statusCode != 200){
				socket.emit('info',{"ended":true,'msg':'ZP Info not available yet.'});
			}else{
				response.pipe(ZP_Signup_file);
				
				ZP_Signup_file.on('finish', function() {
					ZP_Signup_file.close(function() {
						buildConf(teamArg, allDivs[index], getRiders);
						if(allDivs.length>index+1)
							getZPDivision(teamArg, allDivs, index+1, callback, socket);
						else{
							callback(teamArg);
						}
					});  // close() is async, call cb after close completes.
					
				});
			}
		});
	}

	const buildConf = function(teamArg, divData, isGetRiders){
		let zp_signup = fs.readFileSync("zp_signup.json");
		let zp_signupconfig = JSON.parse(zp_signup);
		
		if(typeof teamArg.teams == 'undefined')
			teamArg.teams = new Object;
		if(typeof teamArg.riders == 'undefined')
			teamArg.riders = new Object;
		var teams = teamArg.teams;
		var riders = teamArg.riders;
		for(var i=0;i<zp_signupconfig.data.length;i++){
			var riderS = zp_signupconfig.data[i];
			var label = riderS.label;
			if((label == 1 && teamArg.box == "A") ||
			(label == 2 && teamArg.box == "B") ||
			(label == 3 && teamArg.box == "C") ||
			(label == 4 && teamArg.box == "D") ||
			(label == 5 && teamArg.box == "E") || true
			){
				if(riderS.name.trim().endsWith(")")){
					var tag = riderS.name.trim().substring(riderS.name.lastIndexOf("(")+1);
					tag = tag.replace(")","");
					if(typeof teams[tag] == 'undefined'){
						teams[tag] = new Object;
						teams[tag].name = tag;
						teams[tag].startTime = divData.startTime;
						teams[tag].rider = new Object;
						teams[tag].rider.rank = parseFloat(riderS.rank);
						teams[tag].rider.zid = riderS.zwid;
					}
					if(parseFloat(riderS.rank) < teams[tag].rider.rank){
						teams[tag].rider.rank = parseFloat(riderS.rank);
						teams[tag].rider.zid = riderS.zwid;
					}
					if(isGetRiders){
						var tag_comp = "("+tag+")";
						if(tag_comp == teamArg.tag){
							riders[riderS.zwid] = new Object;
							riders[riderS.zwid].name = riderS.name;
							try{
								riders[riderS.zwid].ftp = parseFloat(riderS.cp_1200_watts[1])*0.95;
							}catch(e){
								riders[riderS.zwid].ftp = parseFloat(riderS.ftp);
							}
							riders[riderS.zwid].weight = riderS.w;
							riders[riderS.zwid].zid = riderS.zwid;
							riders[riderS.zwid].rank = riderS.rank;
						}
					}	
				}
			}
		}
	}
	
	const intervalOrder = setInterval(function() {
		if(tugaTeam.total_time>0 && !ended){
			if(tugaTeam.riderorder_time==1){
				tugaTeam.riderorder_time=30;
				tugaTeam.riderorder_index = (tugaTeam.riderorder_index+1)%tugaTeam.riderorder.length;
			}else{
				tugaTeam.riderorder_time--;
			}
		}
		io.sockets.emit("zevent", { tugaZ: { blob: tugaTeam, riders: tugaZRiders}, distanceMarks: currentMap, WTRLTiming: WTRLTeams, 'ended': ended} );
	 }, 1000);
	 
	monitor.logTugaZ();
}
