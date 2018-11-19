class IoTHomeKit {
  
  constructor() {
    this.keys = [];
    this.requiredKeys = [];
    
    this._storageCache;
    this.cloudStorageFileName = 'iothomekit_storage';
    
    /* distance */
    this.ondistancechange = undefined;
    this.onproximitychange = undefined;
    
    this._proximityEnums = [
      {
        name: "immidiate",
        max: 150,
      },{
        name: "near",
        max: 500,
      },{
        name: "far",
        max: 10000,
      }
    ]
    this.proximityHysterisis = 50;
    this._lastProximityChangeDistancde = 10000;
    this.proximity = this._proximityNameFromDistance(this._lastProximityChangeDistancde);
    
    /* ir */
    this._irDetected = [];
    this.onirdetect = undefined;
  }

  static info() {
    return {
      name: 'IoTHomeKit',
    };
  }

  wired(obniz) {
    this.obniz = obniz;
    
    /* assign parts */
    
    this.irmodule = obniz.wired('IRModule',   { vcc: 0, send: 1, recv: 2, gnd: 3 });
    this.servo =    obniz.wired("ServoMotor", { gnd:6, vcc:7, signal:8});
    this.distanceSensor = obniz.wired("GP2Y0A21YK0F", {vcc:9, gnd:10, signal:11});
    
    /* initial configrations */
    
    this.distanceSensor.start((distance) => {
      this.distance = distance;
      if (typeof this.ondistancechange === "function") {
        this.ondistancechange(distance);
      }
      const proximity = this._proximityNameFromDistance(distance);
      if (this.proximity !== proximity
          && Math.abs(distance - this._lastProximityChangeDistancde) >= this.proximityHysterisis) {
        this._lastProximityChangeDistancde = distance;
        this.proximity = proximity;
        if (typeof this.onproximitychange === "function") {
          this.onproximitychange(proximity);
        }
      }
    })
    
    this.irmodule.start()

    this.irmodule.ondetect = (arr) => {
      this._irDetected.push(arr);
      if (typeof this.onirdetect === "function") {
        this.onirdetect(distance);
      }
    }
  }

  _proximityNameFromDistance(distance) {
    for (let i=0; i<this._proximityEnums.length; i++){
      const proximity = this._proximityEnums[i];
      if (distance <= proximity.max) {
        return proximity.name;
      }
    }
    return this._proximityEnums[this._proximityEnums.length-1].name;
  }
  
  /* distance related */
  
  getDistance() { // => number(in mm)
    return this.distance;
  }
  
  getProximity() { // => string
    return this.proximity;
  }
  
  /* servo related */
  
  flag(posture) {
    if (posture === "up") {
      this.servo.angle(0);
    } else if (posture === "down") {
      this.servo.angle(90);
    }
  }
  
  /* Infrared related */
  
  hasIrRecord() {
    return this._irDetected.length;
  }
  
  getOneIrRecord() {
    if (!this.hasIrRecord()) return undefined;
    return this._irDetected.splice(0,1);
  }
  
  irSend(arr) {
    this.irmodule.send(arr);
  }
  
  /* API related */
  
  async getWeather(region) {
    
    /* https://developer.yahoo.com/weather/documentation.html#codes */
    const res = await fetch("https://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20weather.forecast%20where%20woeid%20in%20(select%20woeid%20from%20geo.places(1)%20where%20text%3D%22"+region+"%22)&format=json&env=store%3A%2F%2Fdatatables.org%2Falltableswithkeys")
    const data = await res.json();
    
    const forecast = data.query.results.channel.item.forecast[0].text;
    return forecast;
  }
  
  async _createStorage() {
    this._storageCache = {};
    let form = new FormData();
    form.append('file', new Blob([JSON.stringify(this._storageCache)]), this.cloudStorageFileName);
    await fetch('/users/me/repo/'+this.cloudStorageFileName,{
      method: "POST",
      body: form
    })
  }
  
  async prepareStorage() {
    if (this._storageCache) {
      return;
    }
    let response;
    response = await fetch('/users/me/repo/'+this.cloudStorageFileName,{ method: "GET" })
    if (response.status == 200) {
      this._storageCache = await response.json();
    } else if (response.status == 404) {
      await this._createStorage();
    } else if (response.status == 403) {
      throw new Error('please login')
    } else {
      throw new Error('cloud storage access error('+response.status+')')
    }    
  }
  
  async saveToStorage(key, value) {
    await this.prepareStorage();
    this._storageCache[key] = value;
    let form = new FormData();
    form.append('file', new Blob([JSON.stringify(this._storageCache)]), this.cloudStorageFileName);

    await fetch('/users/me/repo/'+this.cloudStorageFileName,{
      method: "POST",
      body: form
    })
  }
  
  async loadFromStorage(key) {
    await this.prepareStorage();
    return this._storageCache[key];
  }

}

if (typeof module === 'object') {
  module.exports = IoTHomeKit;
} else {
  Obniz.PartsRegistrate( IoTHomeKit );  
}