class Team {
	constructor(zid, 
				name, 
				active, 
				startT) {
		this.zid = zid;
		this.distance = 0;
		this.name = name;
		if(this.name.length > 20)
			this.name = this.name.substring(0,19) + ".";
		this.marks = [];
		this.start_clock_time = "-";
		this.active = active;
		this.complete = false;
		this.startTime = startT;
	 }
  name() {
    if(this.name.length > 20)
		return this.name.substring(0,19) + ".";
	return this.name;
	//return `${this.constructor.name}`;
  }
}

module.exports = Team;
