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
		
		this.sampleTime = 0;
		this.oneSsamples = [];
		this.w_balV = 0;
		
		this.sn = 0;
		this.ln = 0;
		this.prev_watt = 0;
		

	 }
  name() {
    if(this.name.length > 14)
		return this.name.substring(0,13) + ".";
	return this.name;
  }
  
  
  tau() {
	  //Tau = W' / CP
	  var tauV = this.wprime*1000 / this.cp;
	  return tauV;
	  
  }
  
	w_bal(timediff, totaltime){
		
		if(this.sampleTime == 0){
			this.w_balV = this.wprime;
			this.prev_watt = this.power;
		}
		
		if(totaltime-this.sampleTime>1000){
			this.w_balV = this.wprime*1000 - this.w_bal_integral(timediff, totaltime);
			this.oneSsamples.splice(0, this.oneSsamples.length);
			this.oneSsamples.push((this.prev_watt+this.power)/2);
			this.sampleTime = totaltime;
			
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
	  if(pexp<0)
		pexp = 0;
	  
	  //this.sn = this.sn + pexp*(timediff/1000)*Math.exp(((totaltime/1000)*(1000/timediff)/this.tau()));
	  this.sn = this.sn + pexp*Math.exp(((totaltime/1000)/this.tau()));
	  //this.ln = Math.exp((-1*(totaltime/1000)*(1000/timediff)/this.tau()))*this.sn;
	  this.ln = Math.exp((-1*(totaltime/1000)/this.tau()))*this.sn;
		  
	  return this.ln;
  }
  
}

module.exports = Rider;
