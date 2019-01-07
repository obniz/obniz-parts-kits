class ObnizAIHelper {

  constructor() {

    /* tfjs */
    this.tfModel = undefined;
    this.video = undefined;

    this.tfclassify = {
      time: null,
      name: 'unknown'
    }

    this.closestFace = {
      time: null,
      found: false,
      x: 0,
      y: 0,
      distance: 0
    }
    
    this.detectedWhiteLine = {
      center_x: 0
    }

    this.addWeatherList();
  }


  /* Cam Management */

  async startCamWait() {
    this._prepareDOM();
    await this._loadModel();
    await this._startVideo();
    this.cap = new cv.VideoCapture(this.video);
  }

  _prepareDOM() {
    var div = document.createElement('div');
    div.innerHTML = `<video id="video_forairobotkit" width="320px" height="240px" autoplay playsinline></video>`;
    const viodeDOM = div.firstChild;
    var output = document.getElementById("OBNIZ_OUTPUT");
    output.appendChild(viodeDOM);
    this.video = document.getElementById("video_forairobotkit");
  }

  async _loadCascadeModel() {
    const path = 'haarcascade_frontalface_default.xml';
    const url = 'https://unpkg.com/obniz-parts-kits@0.2.0/ai/opencv3.4/haarcascade_frontalface_default.xml'
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
    if(!navigator.mediaDevices) {
      navigator.mediaDevices = ((navigator.mozGetUserMedia || navigator.webkitGetUserMedia) ? {
        getUserMedia: function (c) {
          return new Promise(function (y, n) {
            (navigator.mozGetUserMedia ||
              navigator.webkitGetUserMedia).call(navigator, c, y, n);
          });
        }
      } : null);
    }
    return new Promise(async (resolve, reject) => {
      const stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: "user"}, audio: false});
      video.srcObject = stream;
      video.onloadedmetadata = (e) => {
        video.play();
        resolve();
      };
    })
  }

  /* opencv */

  _detectFace() {
    const video = this.video;
    if (this.closestFace.time !== this.video.currentTime) {
      this.closestFace.time = this.video.currentTime;

      const cap = this.cap;
      let src = new cv.Mat(video.height, video.width, cv.CV_8UC4);
      let gray = new cv.Mat();
      let faces = new cv.RectVector();

      cap.read(src);

      // detect faces.
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
      let msize = new cv.Size(0, 0);
      this._cv_classifier.detectMultiScale(gray, faces, 1.1, 3, 0, msize, msize);

      this.closestFace.found = false;
      this.closestFace.distance = 101;
      for (let i = 0; i < faces.size(); ++i) {
        let face = faces.get(i);
        const distance = (video.width - face.width) / video.width * 100;
        if (distance < this.closestFace.distance) {
          this.closestFace.found = true;
          this.closestFace.x = (((face.x + face.width / 2) / video.width) * 2 - 1) * 100;
          this.closestFace.y = (((face.y + face.height / 2) / video.height) * 2 - 1) * 100;
          this.closestFace.distance = distance;
        }
      }

      src.delete();
      gray.delete();
      faces.delete();
    }
  }

  isFaceInside() {
    this._detectFace();
    return this.closestFace.found;
  }

  positionOfFace() {
    //this._detectFace();
    if (this.closestFace.found) {
      return this.closestFace.x;
    } else {
      return 0;
    }
  }

  distanceOfFace() {
    //this._detectFace();
    if (this.closestFace.found) {
      return this.closestFace.distance;
    } else {
      return 101;
    }
  }

  positionOfWhiteline() { // reutn -100 to 100. notfound=0
    
    const video = this.video;
    if (this.closestFace.time !== this.video.currentTime) {
      this.closestFace.time = this.video.currentTime;

      const cap = this.cap;
      let src = new cv.Mat(video.height, video.width, cv.CV_8UC4);
      let gray = new cv.Mat();
      
      cap.read(src);
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
      
      let window = parseInt(video.width * 0.05);
      
      let boundary = [1,1,1];
      let max_bright = 0;
      let max_bright_x = 0; 
      const roi_h = parseInt(video.height*(0.7));
      console.log("start");
      for (let col = 0; col < (video.width-window); col++) {
        let lastBoundary = 255;
        let pixel = 0;
        for (let w = 0; w<window; w++) {
          pixel += gray.ucharPtr(roi_h, col + w)[0]
        }
        pixel /= window;
        if (max_bright < pixel) {
          max_bright = pixel;
          max_bright_x = col;
        }
      }
      
      let center_x = max_bright_x + parseInt(window/2);
      center_x = ((center_x / video.width) * 2 - 1) * 100;
      
      this.detectedWhiteLine.center_x = parseInt(center_x);
      
      gray.delete();
      src.delete();
    }
    
    return this.detectedWhiteLine.center_x;
  }

  /* tensorflow */

  async classify() {
    if (this.tfclassify.time !== this.video.currentTime) {
      // http://starpentagon.net/analytics/imagenet_ilsvrc2012_dataset/
      const predictions = await this._mobileNet.classify(this.video);
      for (let i = 0; i < predictions.length; i++) {
        const name = predictions[i].className;
        const probability = predictions[i].probability;
        this.tfclassify.time = this.video.currentTime;
        this.tfclassify.name = name;
        break;
      }
    }
    return this.tfclassify.name;
  }

  /* speech */

  say(mes, rate, pitch) {
    return new Promise((resolve, reject) => {
      const synth = window.speechSynthesis;
      let message = new SpeechSynthesisUtterance(mes);
      if (typeof rate === "number") {
        message.rate = rate;
      }
      if (typeof pitch === "number") {
        message.pitch = pitch;
      }
      message.onerror = (err) => {
        reject(err);
      }
      synth.speak(message);
      resolve();
    })
  }

  /* API related */


  async getLatLng(place) {

    var key = "AIzaSyC0BmxlTmV1i9gChYnZdCqvPjCOr4xt7ak";
    var url = "https://maps.googleapis.com/maps/api/geocode/json?address=" + place + "+CA&key=" + key ;

    var json = await fetch(url, {mode: 'cors'}).then((res)=>res.json());

    if(!json || !json.results || ! json.results[0] || !json.results[0].geometry || !json.results[0].geometry.location){
      return null;
    }
    return json.results[0].geometry.location;
  }

  async getWeather(region) {

    const key = "4aa1a96a50432353baf849e808c112e5";
    const url = `https://api.openweathermap.org/data/2.5/forecast?q=${region}&APPID=${key}`;
    var response = await fetch(url);
    var json = await response.json();

    if(!json || !json.list || ! json.list[0] || !json.list[0].weather|| !json.list[0].weather[0]){
      return "unknown";
    }
    return json.list[0].weather[0].main.toLowerCase();

  }

  addWeatherList() {
    this.sunny = [
      "clear (night)",
      "clear",
      "sunny",
    ];

    this.cloudy = [
      "cloudy",
      "mostly cloudy (night)",
      "mostly cloudy (day)",
      "partly cloudy (night)",
      "partly cloudy (day)",
      "mostly cloudy",
      "partly cloudy",
      "clouds",
    ];

    this.rain = [
      "mixed rain and snow",
      "mixed rain and sleet",
      "freezing drizzle",
      "drizzle",
      "freezing rain",
      "showers",
      "mixed rain and hail",
      "scattered showers",
      "atmosphere",
      "rain",
      "thunderstorm",
    ];

    this.snow = [
      "mixed snow and sleet",
      "snow flurries",
      "light snow showers",
      "blowing snow",
      "snow",
      "heavy snow",
      "scattered snow showers",
      "snow showers",

    ];
  }

}

if (typeof module === 'object') {
  module.exports = ObnizAIHelper;
} else {
  _ai = new ObnizAIHelper();
}