# sdk for IoT Home Kit 

## Overview

```javascript
obniz.onconnect = async function () {

  var homekit = obniz.wired("IoTHomeKit");

  /* servo */
  homekit.flag("up");
  await obniz.wait(1000);
  homekit.flag("down");

  /* distance sensor */

  // distance async
  homekit.ondistancechange = (distance) => {
    //console.log(distance);
  }
  
  // proximity from distance
  homekit.onproximitychange = (p) => {
    console.log(p + ":" + homekit.distance);
    if (p === "near") {
      homekit.flag("up");
    } else {
      homekit.flag("down");
    }
  }
  
  // distance sync methods
  var mm = homekit.getDistance();
  var oneOfThreeType = homekit.getProximity();
  
  /* API */

  // API getting weather
  var weatherinfo = await homekit.getWeather('Tokyo');
  console.log(weatherinfo)

  /* Storage */
  await homekit.saveToStorage('something_key', 'something_value');
  var data = await homekit.loadFromStorage('something_key');
  console.log(data);

  /* IR */

  var irSignal;

  $("#send").click(()=>{
    if (irSignal)
      homekit.irSend(irSignal);
  })

  // async method to be notified ir detection
  // homekit.onirdetect = function(arr){
  //}
  
  // sync method to get ir
  while(true) {
    // var arr = homekit.getOneIrRecord(); // retriving latest one
    var arr = await iot.getIrWait(); // async method
    irSignal = arr;
    console.log("ir:"+arr.length);
  }
}
```

## install

```html
<script src="https://unpkg.com/obniz@latest/obniz.js"></script>
<script src="https://unpkg.com/obniz-parts-kits@latest/iothome/index.js"></script>
```

