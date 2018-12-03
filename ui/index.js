var obniz_button_counter = 0;

class ObnizButton {
  constructor(text, size) {
    this.size = (size || "M").toUpperCase();
    this.no = obniz_button_counter;
    this.text = text;
    obniz_button_counter++;
    this.pushed = false;
    this.clicked = false;

    this.width = {
      "S" :  "33%",
      "M" :  "50%",
      "L" :  "100%"

    }
    this.addButton();

  }


  addButton(){
    var output = document.getElementById("OBNIZ_OUTPUT");
    var button = document.createElement("button");
    button.id = 'obniz_button_'+this.no;
    button.style = "width:"+this.width[this.size]+";height:100px;font-size:50px;";
    button.innerText = this.text;
    output.appendChild(button);
    $("#obniz_button_"+this.no).on('touchstart mousedown', ()=>{
      this.touchStart();
    })

    $("#obniz_button_"+this.no).on('touchend mouseup',()=>{
      this.touchEnd();
    })
    $(document).on('touchend mouseup',()=>{
      this.touchEnd();
    })
    $("#obniz_button_"+this.no).on('click',()=>{
      this.click();
    })
  }

  touchStart(){
    //console.log(this.no + " start")
    this.pushed =true;
  }

  touchEnd(){
    //console.log(this.no + " end")
    this.pushed =false;
  }
  click(){
    //console.log(this.no + " click")
    this.clicked = true;
  }

  isClicked(){
    var tmp = this.clicked;
    this.clicked = false;
    return tmp;
  }

  isTouching(){
    return this.pushed;
  }

}

var ObnizUtil  = {
  wait : function(ms){
    return new Promise(resolve => setTimeout(() => resolve(), ms));
  }
}


var ObnizUI = {
  Button : ObnizButton,
  Util : ObnizUtil,
}
