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
    return 0;
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

  async getWeather(region) {
    /* https://developer.yahoo.com/weather/documentation.html#codes */
    const res = await fetch("https://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20weather.forecast%20where%20woeid%20in%20(select%20woeid%20from%20geo.places(1)%20where%20text%3D%22" + region + "%22)&format=json&env=store%3A%2F%2Fdatatables.org%2Falltableswithkeys")
    const data = await res.json();

    const forecast = data.query.results.channel.item.forecast[0].text;
    return forecast.toLowerCase();
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