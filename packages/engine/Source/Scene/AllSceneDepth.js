import defaultValue from "../Core/defaultValue.js";
import PixelFormat from "../Core/PixelFormat.js";
import Framebuffer from "../Renderer/Framebuffer.js";
import Texture from "../Renderer/Texture.js";
import PixelDatatype from "../Renderer/PixelDatatype.js";

/**
 * @private
 */
function AllSceneDepth() {
  this._texture = undefined;
  this._framebuffer = undefined;
  this._width = 0;
  this._height = 0;
}

Object.defineProperties(AllSceneDepth.prototype, {
  texture: {
    get: function () {
      return this._texture;
    },
  },

  framebuffer: {
    get: function () {
      return this._framebuffer;
    },
  },
});

/**
 * Create / resize depth texture + framebuffer
 */
AllSceneDepth.prototype.update = function (context, width, height) {
  width = defaultValue(width, context.drawingBufferWidth);
  height = defaultValue(height, context.drawingBufferHeight);

  if (width === this._width && height === this._height) {
    return;
  }

  this.destroy();

  this._width = width;
  this._height = height;

  // depth texture
  this._texture = new Texture({
    context: context,
    width: width,
    height: height,
    pixelFormat: PixelFormat.DEPTH_COMPONENT,
    pixelDatatype: PixelDatatype.UNSIGNED_INT,
  });

  this._framebuffer = new Framebuffer({
    context: context,
    depthTexture: this._texture,
  });
};

AllSceneDepth.prototype.destroy = function () {
  if (this._framebuffer) {
    this._framebuffer.destroy();
    this._framebuffer = undefined;
  }

  if (this._texture) {
    this._texture.destroy();
    this._texture = undefined;
  }
};

export default AllSceneDepth;
