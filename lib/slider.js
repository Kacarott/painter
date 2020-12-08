'use babel';

import {toSVG, setAtts, make} from './utils'

// Static id number for gradients
var id = 0;

export default class Slider {

  // Build slider
  constructor(parent) {
    this.sliderX = 0;
    let gradID = "painterSlider" + (id += 1);
    this.color = [0, 0, 0];

    // Make the elements
    this.elem = make("g", "slider");
    let bar = make("rect", "slidebar");
    let grad = make("linearGradient");
    let endStop = make("stop");
    this.handle = make("rect", "handle");

    // Set up some attributes
    setAtts(bar, {fill: `url(#${gradID})`});
    setAtts(grad, {id: gradID, x1: "0%", x2: "100%", y1: "50%", y2: "50%"});
    setAtts(endStop, {offset: "100%"});

    // Set up event listeners
    var handleClick = ((that) => (e => that.click(e)))(this);
    this.handle.addEventListener("mousedown", handleClick);
    bar.addEventListener("mousedown", handleClick);

    // Connect everything
    grad.appendChild(make("stop", "a"));
    grad.appendChild(endStop);
    this.elem.appendChild(bar);
    this.elem.appendChild(this.handle);
    this.elem.appendChild(grad);
    parent.element.appendChild(this.elem);

    // Set up some values we will need later
    this.parent = parent;
    this.handleOffset = Number(window.getComputedStyle(this.handle)
      .transform.match(/matrix\((?:.*?,){4}\s*?(.*?)\s*,/)[1]);
    this.handleWidth = Number(window.getComputedStyle(this.handle)
      .width.match(/([0-9.]*)/)[1]);
    this.barWidth = Number(window.getComputedStyle(bar)
      .width.match(/([0-9.]*)/)[1]);
    this.rgb = window.getComputedStyle(this.elem.children[2].children[1])
      .stopColor.slice(4, -1).split(", ").map(v => parseInt(v).toString(16));
  }

  // Destroy
  destroy() {
    if (this.clickX) this.release();
  }

  // Click and drag handling
  click(event) {
    this.dragHandler = ((that) => (e => that.drag(e)))(this);
    this.releaseHandler = ((that) => (() => that.release()))(this);
    document.addEventListener("mousemove", this.dragHandler);
    document.addEventListener("mouseup", this.releaseHandler);
    this.drag(event);
    this.clickX = toSVG(event, this.elem).x;
  }

  drag(event) {
    let newX = toSVG(event, this.elem).x - this.handleOffset - this.handleWidth/2;
    let maxX = Number(this.barWidth) - Number(this.handleWidth);
    let finalX = Math.max(Math.min(newX, maxX), 0);
    this.handle.setAttribute("x", finalX);
    this.changeColor(finalX/maxX);
    this.clickX = newX;
  }

  release() {
    document.removeEventListener("mousemove", this.dragHandler);
    document.removeEventListener("mouseup", this.releaseHandler);
    this.clickX  = null;
  }

  setValue(x) {
    let maxX = Number(this.barWidth) - Number(this.handleWidth);
    let newX = maxX*x/255;
    let finalX = Math.max(Math.min(newX, maxX), 0);
    this.handle.setAttribute("x", finalX);
    this.changeColor(finalX/maxX);
  }

  // Return element
  get element() {
    return this.elem;
  }

  // Compute new color based on handle position
  changeColor(factor) {
    this.color = this.rgb.map(v => (parseInt(v, 16)*factor>>0));
    let newColor = "#" + this.color.map(v=>v.toString(16))
      .map(v=>(v.length-1)?v:"0"+v).join("");
    this.handle.style.fill = newColor;
    this.parent.changeColor();
  }
}
