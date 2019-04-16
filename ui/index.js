var ObnizUI = {};

(function () {

  var obniz_ui_counter = 0;

  class ObnizButton {
    constructor(text, size) {
      this.size = (size || "M").toUpperCase();
      this.no = obniz_ui_counter;
      this.text = text;
      obniz_ui_counter++;
      this.pushed = false;
      this.clicked = false;

      this.width = {
        "S": "33%",
        "M": "50%",
        "L": "100%"

      };
      this.addButton();

    }


    addButton() {
      var output = document.getElementById("OBNIZ_OUTPUT");
      var button = document.createElement("button");
      button.id = 'obniz_button_' + this.no;
      button.style = "width:" + this.width[this.size] + ";height:100px;font-size:30px;";
      button.className = "btn btn-primary";
      button.innerText = this.text;
      output.appendChild(button);
      $("#obniz_button_" + this.no).on('touchstart mousedown', () => {
        this.touchStart();
      })

      $("#obniz_button_" + this.no).on('touchend mouseup', () => {
        this.touchEnd();
      })
      $(document).on('touchend mouseup', () => {
        this.touchEnd();
      })
      $("#obniz_button_" + this.no).on('click', () => {
        this.click();
      })
    }

    touchStart() {
      //console.log(this.no + " start")
      this.pushed = true;
    }

    touchEnd() {
      //console.log(this.no + " end")
      this.pushed = false;
    }

    click() {
      //console.log(this.no + " click")
      this.clicked = true;
    }

    isClicked() {
      var tmp = this.clicked;
      this.clicked = false;
      return tmp;
    }

    isTouching() {
      return this.pushed;
    }

  }


  class ObnizLabel {
    constructor(text) {
      this.no = obniz_ui_counter;
      this.text = text || "label";
      obniz_ui_counter++;
      this.pushed = false;
      this.clicked = false;

      this.addLabel();

    }


    addLabel() {
      var output = document.getElementById("OBNIZ_OUTPUT");
      var button = document.createElement("div");
      button.id = 'obniz_label_' + this.no;
      button.style = "font-size:30px;padding:10px";
      button.className = "";
      button.innerText = this.text;
      output.appendChild(button);
    }

    setText(text) {
      $('#obniz_label_' + this.no).text(text);
    }

  }


  class ObnizSlider {
    constructor(min, max, size) {
      this.size = (size || "M").toUpperCase();
      this.min = 0;
      this.max = 100;
      this.no = obniz_ui_counter;
      obniz_ui_counter++;
      this.changed = false;

      this.width = {
        "S": "33%",
        "M": "50%",
        "L": "100%"

      }

      this.addSlider();

    }


    addSlider() {
      var output = document.getElementById("OBNIZ_OUTPUT");
      var slider = document.createElement("input");
      slider.type = "range";
      slider.id = 'obniz_slider_' + this.no;
      slider.style = "width:" + this.width[this.size] + ";";
      slider.className = "";
      this.slider = slider;
      output.appendChild(slider);

      let targetObj = $('#obniz_slider_' + this.no);
      targetObj.on('input', () => {
        this.change(this.slider.value);
      });

      targetObj.change(() => {
        this.change(this.slider.value);
      });
    }


    change(val) {
      this.val = val;
      this.changed = true;
    }

    isChanged() {
      return this.changed;
    }

    getValue() {
      this.changed = false;
      return this.slider.value;
    }

  }


  class ObnizImage {
    constructor(url, size) {
      this.size = (size || "M").toUpperCase();
      this.no = obniz_ui_counter;
      obniz_ui_counter++;
      this.changed = false;

      this.src = url;
      this.width = {
        "S": "33%",
        "M": "50%",
        "L": "100%"

      };

      this.x = 0;
      this.y = 0;
      this.rotate = 0;


      this.addImage();

    }


    addImage() {
      var output = document.getElementById("OBNIZ_OUTPUT");
      var imgTag = document.createElement("img");
      imgTag.id = 'obniz_image_' + this.no;
      imgTag.style = "width:" + this.width[this.size] + ";";
      imgTag.className = "";
      imgTag.src = this.src;
      this.imgTag = imgTag;
      output.appendChild(imgTag);


    }

    addX(val) {
      this.x += val;
      this.updateView();
    }
    addY(val) {
      this.y += val;
      this.updateView();
    }
    addRotate(val) {
      this.rotate += val;
      this.updateView();
    }

    updateView() {
      let trans = `translateX(${this.x}px) translateY(${this.y}px) rotate(${this.rotate}deg)`;
      this.imgTag.style.transform = trans;
      this.imgTag.style.MozTransform = trans;
      this.imgTag.style.webkitTransform = trans;
    }

  }


  var ObnizUtil = {
    cloudStorageFileName: "storage.json",
    wait: function (ms) {
      return new Promise(resolve => setTimeout(() => resolve(), ms));
    },
    _strageCache: undefined,
    prepareStorage: async function () {
      if (this._storageCache) {
        return;
      }
      let response;
      response = await fetch('/users/me/repo/' + this.cloudStorageFileName, {method: "GET", credentials: "include"})
      if (response.status == 200) {
        this._storageCache = await response.json();
      } else if (response.status == 404) {
        await this._createStorage();
      } else if (response.status == 403) {
        throw new Error('please login')
      } else {
        throw new Error('cloud storage access error(' + response.status + ')')
      }
    },

    _createStorage: async function () {
      this._storageCache = {};
      let form = new FormData();
      form.append('file', new Blob([JSON.stringify(this._storageCache)]), this.cloudStorageFileName);
      await fetch('/users/me/repo/' + this.cloudStorageFileName, {
        method: "POST",
        body: form,
        credentials: "include"
      })
    },
    saveToStorage: async function (key, value) {
      await this.prepareStorage();
      this._storageCache[key] = value;
      let form = new FormData();
      form.append('file', new Blob([JSON.stringify(this._storageCache)]), this.cloudStorageFileName);

      await fetch('/users/me/repo/' + this.cloudStorageFileName, {
        method: "POST",
        body: form,
        credentials: "include"
      })
    },

    loadFromStorage: async function (key) {
      await this.prepareStorage();
      return this._storageCache[key];
    }
  };

  ObnizUI = {
    Button: ObnizButton,
    Label: ObnizLabel,
    Slider: ObnizSlider,
    Image: ObnizImage,
    Util: ObnizUtil,
  }

})();

