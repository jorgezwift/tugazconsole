class Rider {
	constructor(	zid, 
				name, 
				weight,
				ftp) {
					
		this.zid = zid;
		this.name = name;
		if(this.name.length > 17)
			this.name = this.name.substring(0,16) + ".";
		this.weigth = weight;
		this.ftp = ftp;
		this.distance = 0;
		this.ko = false;
		this.time = 0;
		this.roadPos = 0;
		this.power = 0;
		this.avgpower = 0;
		this.speed = 0;
		this.cur_speed = 0;
		this.worldTime = 0;
		this.roadTime = 0;
		this.roadTimeMs = 0;
		this.timeinfront = 0;
		this.powerinfront = 0;
		this.timeinback = 0;
		this.power5s = [];
		this.power10s = [];
		this.power30s = [];
		this.p10m = 0;
		this.p20m = 0;
		this.active = true;
		this.position = [0,0,0,0,0,0,0,0];
		//W'Bal
		this.wprime = -1;
		this.cp = -1;
		this.div = "espresso";
		this.factorDiff = 1;
		
		this.sampleTime = 0;
		this.oneSsamples = [];
		this.w_balV = 0;
		
		this.sn = 0;
		this.sn1 = 0;
		this.sn2 = 0;
		this.sn3 = 0;
		this.prev_watt = 0;
		
		this.rest_rate = 0;
		

	 }
  name() {
    if(this.name.length > 14)
		return this.name.substring(0,13) + ".";
	return this.name;
  }
  
  
	tau(pexpN,modePar) {
		var rest = 280;
		if(this.div=="frappe")
			rest = 250;
		else if(this.div=="latte")
			rest = 220;
			
		var modeInner = this.mode;
		if(typeof modePar != 'undefined')
			modeInner = modePar;
			
		var tauVC1 = this.wprime*1000;
		if(modeInner == 3){
			tauVC1 = Math.floor((this.wprime*1000 / (this.cp))*this.factorDiff);
		}else if(modeInner == 2){
			tauVC1 = Math.floor((this.wprime*1000 / (this.cp*0.4))*this.factorDiff);
		}else if(modeInner == 1){
			tauVC1 = Math.floor((this.wprime*1000 / (this.cp*0.2))*this.factorDiff);
		}else{
			if(rest>this.cp)
				rest = this.cp*0.025;
		tauVC1 = Math.floor((this.wprime*1000 / (this.cp-rest))*this.factorDiff);
	}
	
	return tauVC1;
  }
  
	w_bal(timediff, totaltime){
		
		if(this.sampleTime == 0){
			this.w_balV = this.wprime;
			this.prev_watt = this.power;
			this.sampleTime = totaltime;
		}
		
		if(totaltime-this.sampleTime>1000){
			
			var timess = Math.floor((totaltime-this.sampleTime)/1000);
	
			for(var itimes=0; itimes<timess; itimes++){
				this.w_balV = this.wprime*1000 - this.w_bal_integral(timediff, totaltime);
			}
			
			
			this.oneSsamples.splice(0, this.oneSsamples.length);
			this.oneSsamples.push((this.prev_watt+this.power)/2);
			this.sampleTime = this.sampleTime+(1000*timess);
			
		}
		this.oneSsamples.push(this.power);
		
		if(this.w_balV<0)
			this.w_balV = 0;
			
			
		if((this.w_balV*100/(this.wprime*1000))>99)
			this.w_balV = this.wprime*1000;
		
		this.prev_watt = this.power;
		
		return this.w_balV;
	}
  
  w_bal_integral(timediff, totaltime){
	  //av_w - Average Watts Period
	  //totaltime - in miliseconds
	  //timediff - in miliseconds
	  //W'EXP - Energy Expenditure above CP
	  
	  //1 Watt = 1 Joule/second	  
	  var wAVG = 0;
	  for(var j = 0;j<this.oneSsamples.length;j++){
		wAVG = wAVG +this.oneSsamples[j];
	  }
	  wAVG = wAVG/this.oneSsamples.length;
	  
	  var pexp = wAVG-this.cp;
	  var pexpN = this.cp-wAVG;
	  this.mode = 0;
	  if(pexp<0){
		pexp=0;
	  }else{
		this.mode = -1;
		pexpN=1;  
	  }
		
	   var snCur = 0;
	   if(pexpN/this.cp > 0.66){
		  this.mode = 3;
		  snCur = this.sn3 + pexp*Math.exp(((totaltime/1000)/this.tau(pexpN)));
	   }else if(pexpN/this.cp > 0.20 ){
		  this.mode = 2;
		  snCur = this.sn2 + pexp*Math.exp(((totaltime/1000)/this.tau(pexpN)));
	   }else if(pexpN/this.cp > 0.10 ){
		  this.mode = 1;
		  snCur = this.sn1 + pexp*Math.exp(((totaltime/1000)/this.tau(pexpN)));
	  }else{
		  snCur = this.sn + pexp*Math.exp(((totaltime/1000)/this.tau(pexpN)));
	  }
	  
	  var ln = Math.exp((-1*(totaltime/1000)/this.tau(pexpN)))*snCur;
	  
	  this.sn = ln/(Math.exp((-1*(totaltime/1000)/this.tau(pexpN,0))));
	  this.sn1 = ln/(Math.exp((-1*(totaltime/1000)/this.tau(pexpN,1))));
	  this.sn2 = ln/(Math.exp((-1*(totaltime/1000)/this.tau(pexpN,2))));
	  this.sn3 = ln/(Math.exp((-1*(totaltime/1000)/this.tau(pexpN,3))));
	  		  
	  return ln;
  }
  
}

module.exports = Rider;
