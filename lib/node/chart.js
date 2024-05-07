'use strict';

/**
 * FFChart - A Chart video component, using the echarts.js library.
 *
 * ####Example:
 *
 *    const fchart = new FFChart({ theme: 'dark', option, width: 600, height: 450 });
 *    fchart.addEffect(['rotateIn', 'zoomIn'], 1.2, 1);
 *    fchart.update(chart => {
 *        ....
 *        chart.setOption(data);
 *    }, 1000);
 *
 *
 * ####Note
 *     https://echarts.apache.org/examples/zh/index.html
 *
 * @class
 *
 */
const echarts = require('echarts');
const FFImage = require('./image');
const CanvasUtil = require('../utils/canvas');
const TimelineUpdate = require('../timeline/update');
const { createCanvas, Texture } = require('inkpaint-auto');

const echartsPolyfill = () => {
  echarts.Model.prototype.isAnimationEnabled = () => true;
  echarts.SeriesModel.prototype.isAnimationEnabled = () => true;
  //echarts.PictorialBarView.prototype.isAnimationEnabled = () => true;
};
echartsPolyfill();

class FFChart extends FFImage {
  constructor(conf = { list: [] }) {
    super({ type: 'chart', ...conf });

    const { option, optionOpts, theme = 'light', updateNow = false } = this.conf;
    this.theme = theme;
    this.option = option;
    this.runUpdateNow = updateNow;
    this.optionOpts = optionOpts;
    this.userCallback = null;
    this.userCallbackTime = null;
    this.time = 0;
  }

  /**
   * Get the width and height of the chart component
   * @return {array} [width, height] array
   * @public
   */
  getWH() {
    const { width = 300, height = 300 } = this.conf;
    return [width, height];
  }

  /**
   * Set echarts instance option value
   * @param {object} option - option value
   * @public
   */
  setOption(option, opts) {
    const { chart, optionOpts } = this;
    const newOpts = Object.assign({}, optionOpts, opts);
    chart.setOption(option, newOpts);
  }

  /**
   * Set text font file path
   * @param {string} font - text font file path
   * @public
   */
  setFont(font) {
    CanvasUtil.setFont(font, fontFamily => (this.ctx.font = fontFamily));
  }

  /**
   * Timer to update option value
   * @param {function} func - Timer hook call function
   * @param {number} time - Time interval
   * @public
   */
  update(func, time = 0.3) {
    this.userCallback = func;
    this.userCallbackTime = time < 50 ? time * 1000 : time;
  }

  /**
   * Now run the update function immediately
   * @public
   */
  updateNow() {
    this.runUpdateNow = true;
  }

  /**
   * Start rendering
   * @public
   */
  start() {
    this.initECahrts();
    this.initTexture();

    this.animations.start();
    this.updateCallback = this.updateCallback.bind(this);
    TimelineUpdate.addFrameCallback(this.updateCallback);
    if (this.runUpdateNow) this.userCallback(this.chart);
  }

  initECahrts() {
    const [width, height] = this.getWH();
    const ctx = createCanvas(128, 128);
    echarts.setCanvasCreator(() => ctx);

    const { theme, option, optionOpts } = this;
    const canvas = createCanvas(width, height);
    const chart = echarts.init(canvas, theme);
    chart.setOption(option, optionOpts);
    this.fixZrender(chart);

    this.ctx = ctx;
    this.chart = chart;
    this.canvas = canvas;
  }

  initTexture() {
    const { canvas, display } = this;

    const scale = display.scale.clone();
    display.texture = Texture.fromCanvas(canvas);
    this.setDisplaySize();
    display.scale.copy(scale);
    display.setScaleToInit();
  }

  updateCallback(time, delta) {
    const { chart, userCallbackTime } = this;
    if (!this.userCallback) return;

    this.echartsUpdate(chart, time, delta);
    this.time += delta;
    if (this.time >= userCallbackTime) {
      this.userCallback(chart);
      this.time = 0;
    }
  }

  // eslint-disable-next-line
  echartsUpdate(chart, time, delta) {
    const animation = chart._zr.animation;
    if (animation._running && !animation._paused) {
      animation.update();
    }
  }

  fixZrender(chart) {
    const animation = chart._zr.animation;

    animation._startLoop = () => (animation._running = true);
    animation.update = function (notTriggerFrameAndStageUpdate) {
      const time = TimelineUpdate.time;
      const delta = TimelineUpdate.delta;
      let clip = this._clipsHead;

      while (clip) {
        const nextClip = clip.next;
        let finished = clip.step(time, delta);
        if (finished) {
          clip.ondestroy && clip.ondestroy();
          this.removeClip(clip);
          clip = nextClip;
        } else {
          clip = nextClip;
        }
      }

      if (!notTriggerFrameAndStageUpdate) {
        this.onframe(delta);
        this.trigger('frame', delta);
        this.stage.update && this.stage.update();
      }
    };
  }

  destroy() {
    TimelineUpdate.removeFrameCallback(this.updateCallback);
    super.destroy();
    this.chart.dispose();

    this.userCallback = null;
    this.updateCallback = null;
    this.userCallbackTime = null;
    this.canvas = null;
    this.option = null;
    this.optionOpts = null;
    this.chart = null;
    this.ctx = null;
  }
}

module.exports = FFChart;
