'use babel';

import fs from 'fs';
import path from 'path';
import Slider from './slider';
import {make, setAtts, css} from './utils';

/* global atom */

export default class PainterView {

  // Build
  constructor() {
    this._element = make("svg", "painter");

    // Add background
    this.background = make("rect", "background");
    setAtts(this.background, {fill: "#000000"});
    this._element.appendChild(this.background);

    // Attach to window
    atom.workspace.element.appendChild(this._element);

    // Add sliders
    let n_sliders = Number(window.getComputedStyle(this._element)
      .getPropertyValue("--sliders"));
    this.sliders = Array(n_sliders).fill().map(() =>new Slider(this));
  }


  // Summon the window
  trigger(event, isFillMode) {

    // Set fill mode
    this.isFillMode = isFillMode;

    // Prepare window for measurements
    setAtts(this._element, {display: "block", visibility: "hidden"});

    // Position window
    this.position(event.x, event.y);

    // Clicking outside element will close (and cancel) it
    this.closeCheck = ((that) => (e => that.checkIfClosing(e)))(this);
    document.addEventListener("mousedown", this.closeCheck);

    // Escape will cancel, enter/return will save
    this.buttonCheck = ((that) => (e => {
      if (["Enter", "Escape"].includes(e.key)) {
        that.endPaint(e.key === "Escape");
        e.stopPropagation();
      }
    }))(this);
    this.activeView = atom.views.getView(atom.workspace);
    this.activeView.addEventListener("keydown", this.buttonCheck);

    // Make element visible
    setAtts(this._element, {visibility: "visible"});

    // Get the target Element
    this.newColor = null;
    this.color = this.matchColor(event.path);
    this.originalColor = this.color;
    this.setSliders(this.originalColor);
  }

  // Handle clicks outside window while open
  checkIfClosing(e) {
    let wb = this._element.getBoundingClientRect();
    let inBox = (
      e.x >= wb.x
      && e.x <= wb.x + wb.width
      && e.y >= wb.y
      && e.y <= wb.y + wb.height
    );
    if (!inBox) this.endPaint(true);
  }

  // Apply Changes
  endPaint(cancelled=false) {
    if (!cancelled && this.newColor) {

      // Get user styles file
      let filePath = path.resolve(__dirname, './../../../styles.less');
      fs.readFile(filePath, 'utf8',
        (err, data) => {
          if (err) throw err;
          let saveData = this.formatStyle(data);
          fs.writeFile(filePath, saveData, err => { if (err) throw err;});
        });

    // If cancelled, revert
    } else this.changeColor(this.originalColor);

    // Clean up
    document.removeEventListener("mousedown", this.closeCheck);
    this.activeView.removeEventListener("keydown", this.buttonCheck);
    this.hide();
  }

  // Set sliders to current color
  setSliders(color) {
    let sliderCols = this.sliders.map(v => v.rgb.map(w => parseInt(w, 16)));

    // TODO: Add pattern recognition for other color formats
    let elemCol = color.match(/rgb\((\d*), (\d*), (\d*)\)/);
    elemCol = [elemCol[1], elemCol[2], elemCol[3]].map(v => Number(v));
    for (let s = 0; s < sliderCols.length; s++) {
      let val = Math.min(...sliderCols[s].map((v, i) => v ? elemCol[i]*255/v : Infinity), 255);
      elemCol = elemCol.map((v, i) => v - val*sliderCols[s][i]/255);
      this.sliders[s].setValue(val);
    }
  }

  // Save to styles.less
  formatStyle(content) {
    let header = /\s*\/\* Painter Styles \*\/\s*(.*?)\s*\/\* End Painter Styles \*\//ms;
    let innerText = "";
    let rules = {};

    // Parse each matching rule
    this.targetSheets.forEach(v => {
      let cssText = v.sheet.cssRules[v.index].cssText;
      let attributes = cssText.matchAll(
        new RegExp(`[;{]\\s*(\\S*?:[^:]*?${
          this.color.replace(/[()]/g, '\\$&')}.*?)(?=;)`, 'gm')
      );
      for (const match of attributes) {
        let attribute = match[1];
        if (!rules[attribute]) rules[attribute] = [];
        let newEntry = cssText.match(/([^{]*[^\s{])\s*/)[1];
        if (!rules[attribute].includes(newEntry)) {
          rules[attribute].push(newEntry);
        }
      }
    });
    // Parse relevant rules from existing data in user styles
    if (header.test(content)) {
      // Split Painter styles into rules
      const preStyles = RegExp.$1.split("\n").filter(Boolean);
      content = content.replace(header, '');
      preStyles.forEach(v => {
        let accessors = v.match(/.*?(?=\s*{)/)[0].split(/\s*,\s*/).filter(Boolean);
        let inner = v.match(/(?<={\s*)[^\s].*?(?=;\s*})/)[0];
        let innerRep = inner.replace(this.originalColor, this.color);
        if (!rules[innerRep]) rules[inner] = accessors;
        else {
          accessors.forEach(a => {
            if (!rules[innerRep].includes(a)) {
              if (!rules[inner]) rules[inner] = [];
              rules[inner].push(a);
            }
          });
        }
      });
    }
    // Finally build the file and save
    Object.keys(rules).forEach(v => innerText +=
      `${rules[v].join(', ')}{ ${v}; }\n\n`);
    return `${content}\n\n/* Painter Styles */\n\n${innerText}/* End Painter Styles */`;
  }



  // Position window
  position(x, y) {
    let screenHeight = document.body.clientHeight;
    let screenWidth = document.body.clientWidth;
    let windowBox = this._element.getBoundingClientRect();
    let yOffset = 25;

    // Don't let it go over the sides
    let left = Math.max(
      Math.min(screenWidth - windowBox.width, x - windowBox.width/2), 0
    ) + "px";

    // If window is too low, move it above mouse
    let top = ((y + yOffset + windowBox.height > screenHeight)
      ? y - yOffset - windowBox.height
      : y + yOffset) + "px";

    // Set element Position
    this._element.style.left = left;
    this._element.style.top = top;
  }

  // Hide window
  hide() {
    setAtts(this._element, {display: "none"});
  }

  // Called on changing slider value
  changeColor(color) {
    let colorVals = this.sliders.map(v=>v.color);
    let rC = colorVals.reduce((a,c)=>[a[0]+c[0], a[1]+c[1],a[2]+c[2]],[0,0,0])
      .map(v => Math.min(Math.max(0, v), 255));

    // Change background to match
    this.newColor = color || `rgb(${rC[0]}, ${rC[1]}, ${rC[2]})`;
    this.background.style.fill = this.newColor;

    // Apply color to target class in stylesheet or something
    this.targetSheets.forEach(v => {
      let rule = v.sheet.cssRules[v.index].cssText;
      let newCSS = css.format(rule, this.color, this.newColor);
      v.sheet.deleteRule(v.index);
      v.sheet.insertRule(newCSS, v.index);
    });
    this.color = this.newColor;
  }

  // Helper functions
  destroy() {
    this._element.remove();
  }

  get element() {
    return this._element;
  }

  // Find matching sheets
  matchSheets(color, elem) {
    let selectors;
    this.targetSheets = [];

    // Set up compare function for later
    let isMatch = cssText => {
      return cssText[0] !== '@' && cssText.includes(color) && (this.isFillMode
      ? true : (selectors = css.match(cssText, elem)).length)};

    // For each style in document
    for (let ss = 0; ss < document.styleSheets.length; ss++) {
      for (let i = 0; i < document.styleSheets[ss].cssRules.length; i++) {
        let cssText = document.styleSheets[ss].cssRules[i].cssText;
        if (isMatch(cssText)) {

          // Need to split apart some rules
          if (!this.isFillMode) {
            let ruleSelList = cssText.match(/.*?(?=\s*{)/)[0].split(/\s*,\s*/);
            let unaffected = ruleSelList.filter(v => !selectors.includes(v));
            let affected = ruleSelList.filter(v => selectors.includes(v));
            if (unaffected.length) {
              let newRule = cssText.replace(/.*?(?=\s*{)/, unaffected.join(', '));
              let otherNewRule = cssText.replace(/.*?(?=\s*{)/, affected.join(', '));
              let sheet = document.styleSheets[ss];
              sheet.deleteRule(i);
              sheet.insertRule(otherNewRule, i);
              sheet.insertRule(newRule, i);
              continue;
            }
          }
          // Store relevant rules
          this.targetSheets.push({
            sheet: document.styleSheets[ss],
            index: i
          })
        }
      }
    }
  }

  matchColor(path) {
    window.floop = path;
    let isText = path[0].tagName === 'SPAN'
      || path[0].childNodes[0].nodeType === 3;
    let matcher = isText
      ? /(?<={.*)(?<=\scolor:\s*)(?:rgba?\((?:\d+,?\s*){3,4}\)|#[0-9a-f]{3,6})/
      : /(?<={.*)(?<!\scolor:\s*)(?:rgba?\((?:\d+,?\s*){3,4}\)|#[0-9a-f]{3,6})/;
    let textColour = isText ? window.getComputedStyle(path[0]).color : null;
    for (let el = 0; el < path.length; el++) {
      let element = path[el];
      let sheets = document.styleSheets;

      // Iter backwards through all stylesheets
      // Since apparently they apply the last first
      for (let i = sheets.length - 1; i > -1; i--) {
        for (let j = sheets[i].cssRules.length -1; j > -1; j--) {
          let cssText = sheets[i].cssRules[j].cssText;
          if (textColour && !cssText.includes(textColour)) continue;
          if (css.match(cssText, element).length && matcher.test(cssText)) {
            let result = RegExp.lastMatch;
            this.matchSheets(result, element);
            return result;
          }
        }
      }
    }
  }
}
