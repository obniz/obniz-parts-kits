class AIRobotKit {
  
  constructor() {
    this.keys = [];
    this.requiredKeys = [];
    
    this._storageCache;
    this.cloudStorageFileName = 'airobotkit_storage.json';
    
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
    
    /* tfjs */
    this.tfModel = undefined;
    this.video = undefined;
  }

  static info() {
    return {
      name: 'AIRobotKit',
    };
  }

  wired(obniz) {
    this.obniz = obniz;
    
    /* assign parts */
    this.motorLeft  = obniz.wired("DCMotor",  {forward:0, back:1});
    this.motorRight = obniz.wired("DCMotor",  {forward:10, back:11});
    
    this.distanceSensor = obniz.wired("GP2Y0A21YK0F", {vcc:7, gnd:8, signal:9});
    
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
  }

  /* motor */
  
  move(direction, right) {
    const DefaultPower = 60;
    
    let left;
    if (typeof right === "number") {
      left = direction;
    }
     
    if (direction === "forward") {
      this.move(DefaultPower, DefaultPower);
    } else if(direction === "back") {
      this.move(-DefaultPower, -DefaultPower);
    } else {
      this.motorLeft.power(Math.abs(left));
      this.motorLeft.move( left > 0 );
      this.motorRight.power(Math.abs(right));
      this.motorRight.move( right > 0 )
    } 
  }
  
  turn(orientation) {
    const DefaultPower = 60;
     
    if (orientation === "left") {
      this.move(-DefaultPower, DefaultPower);
    } else if(orientation === "right") {
      this.move(DefaultPower, -DefaultPower);
    } else {
      throw new Error('unknown orientation ' + orientation);
    } 
  }
  
  stop() {
    this.motorLeft.stop();
    this.motorRight.stop();
  }
  
  /* Cam Management */
  
  async startCamWait() {
    this._prepareDOM();
    await this._loadModel();
    await this._startVideo();
    this.cap = new cv.VideoCapture(this.video);
  }
  
  _prepareDOM() {
    const viodeDOM = `<video id="video_forairobotkit" width="320px" height="240px" autoplay playsinline></video>`;
    document.body.innerHTML = viodeDOM + document.body.innerHTML;
    this.video = document.getElementById("video_forairobotkit");
  }
  
  async _loadCascadeModel() {
    const path = 'haarcascade_frontalface_default.xml';
    const url = 'https://unpkg.com/obniz-parts-kits@0.1.2/airobot/opencv3.4/haarcascade_frontalface_default.xml'
    const response = await fetch(url);
    const buf = await response.arrayBuffer();
    cv.FS_createDataFile('/', path, new Uint8Array(buf), true, false, false);
  }
  
  async _loadModel() {
    /* opencv */
    
    await this._loadCascadeModel();
    this._cv_classifier = new cv.CascadeClassifier();
    const loaded = this._cv_classifier.load('haarcascade_frontalface_default.xml');
    if (!loaded) {
      throw new Error('oepncv cascade not loaded');
    }
    /* tf */
    this._mobileNet = await mobilenet.load();
  }
  
  _startVideo() {
    const video = this.video;
    return new Promise(async (resolve, reject) => {
      const stream = await navigator.mediaDevices.getUserMedia({ video: {facingMode: "user"}, audio: false });
      video.srcObject = stream;
      video.onloadedmetadata = (e) => { video.play(); resolve(); };
    })
  }
  
  /* opencv */
  
  isFaceInside() {
    const video = this.video;
    const cap = this.cap;
    let src = new cv.Mat(video.height, video.width, cv.CV_8UC4);
    let gray = new cv.Mat();
    let faces = new cv.RectVector();
    
    cap.read(src);
    
    // detect faces.
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
    let msize = new cv.Size(0, 0);
    this._cv_classifier.detectMultiScale(gray, faces, 1.1, 3, 0, msize, msize);

    const faceCount = faces.size();
    src.delete();
    gray.delete();
    faces.delete();
    return faceCount !== 0;
    //for (let i = 0; i < faces.size(); ++i) {
    //  let face = faces.get(i);
    //  let point1 = new cv.Point(face.x, face.y);
    //  let point2 = new cv.Point(face.x + face.width, face.y + face.height);
    //  cv.rectangle(dst, point1, point2, [255, 0, 0, 255]);
    //}
  }
  
  positionOfWhiteline() { // reutn -100 to 100. notfound=0
    return 0;
  }
  
  /* tensorflow */
  
  async classify() {
    const predictions = await this._mobileNet.classify(this.video);
    for (let i=0; i<predictions.length; i++) {
      const name = predictions[i].className;
      const probability = predictions[i].probability;
      return name;
    }
    return 'unknown';
  }

  
  /* distance */
  
  _proximityNameFromDistance(distance) {
    for (let i=0; i<this._proximityEnums.length; i++){
      const proximity = this._proximityEnums[i];
      if (distance <= proximity.max) {
        return proximity.name;
      }
    }
    return this._proximityEnums[this._proximityEnums.length-1].name;
  }
  
  getDistance() { // => number(in mm)
    return this.distance;
  }
  
  getProximity() { // => string
    return this.proximity;
  }
  
  /* storage */
  
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
  module.exports = AIRobotKit;
} else {
  Obniz.PartsRegistrate( AIRobotKit );  
}