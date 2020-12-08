'use babel';

import PainterView from './painter-view';
import { CompositeDisposable } from 'atom';
import fs from 'fs';
import path from 'path';

/* global atom */

export default {

  subscriptions: null,
  view: null,

  activate() {
    // Set up commands
    this.subscriptions = new CompositeDisposable();
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'painter:paint': () => this.paint(),
      'painter:paint-fill': () => this.paint(true),
      'painter:paint-next': () => this.paintNext(),
      'painter:paint-next-fill': () => this.paintNext(true)
    }));

    // We need to capture the point at which the context menu is launched
    // That way we can get the element there
    this.listener = window.addEventListener("contextmenu",
      (event) => this.handleContextMenu(event));

    // Set up settings observer. We send slider colors to the stylesheet
    // We do that rather than just manage in in JS because I'm a lazy bitch.
    atom.config.observe('painter._sliderColors', nv => {
      let filePath = path.resolve(__dirname, './../styles/painter.less');
      let validColors = /(rgba?\((?:\d+,?\s*){3,4}\)|#[0-9a-f]{3,6})/;
      let vcList = nv.split(validColors).filter(f => validColors.test(f));
      if (vcList.length == 0) vcList = ["#ff0000", "#00ff00", "#0000ff"];
      fs.readFile(filePath, 'utf8',
        (err, data) => {
          if (err) throw err;
          let saveData = data.replace(/@bar-colors:.*?;/,
            `@bar-colors: ${vcList.join(', ')};`);
          if (saveData !== data) {
            fs.writeFile(filePath, saveData, err => { if (err) throw err;});
          }
        });
    });
  },

  // Main commands
  paint(isFill) {
    if (!this.lastClick) return;
    if (!this.view) this.view = new PainterView();
    this.view.trigger(this.lastClick, isFill);
  },

  paintNext(isFill=false) {
    this.isFill = isFill;
    this.awaitClick = ((that) => (e => that.waitForClick(e)))(this);
    document.addEventListener("mousedown", this.awaitClick);
  },

  // Keys have been pressed, waiting for click
  waitForClick(event) {
    this.lastClick = event;
    document.removeEventListener("mousedown", this.awaitClick);
    this.paint(this.isFill);
  },

  // We just need to store the event
  handleContextMenu(event) {
    this.lastClick = event;
  },

  deactivate() {
    this.subscriptions.dispose();
    window.removeEventListener(this.listener);
    this.view.destroy();
  },

  // Settings
  config: {
    _sliderColors: {
      title: 'Slider Colors',
      description: 'Set the color of the sliders (requires restart)',
      type: 'string',
      default: '#ff0000 #00ff00 #0000ff'
    }
  }
};
