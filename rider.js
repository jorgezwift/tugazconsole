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

	 }
  name() {
    if(this.name.length > 14)
		return this.name.substring(0,13) + ".";
	return this.name;
	//return `${this.constructor.name}`;
  }
}

module.exports = Rider;
