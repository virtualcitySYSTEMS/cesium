import Framebuffer from "../Renderer/Framebuffer.js";
import Texture from "../Renderer/Texture.js";
import PixelFormat from "../Core/PixelFormat.js";
import PixelDatatype from "../Renderer/PixelDatatype.js";
import ClearCommand from "../Renderer/ClearCommand.js";
import Pass from "../Renderer/Pass.js";
import PassState from "../Renderer/PassState.js";
import BoundingRectangle from "../Core/BoundingRectangle.js";
import Cesium3DTilePass from "./Cesium3DTilePass.js";
import Cesium3DTilePassState from "./Cesium3DTilePassState.js";
import DerivedCommand from "./DerivedCommand.js";
import Sampler from "../Renderer/Sampler.js";

class TilesetDepthPass {
  constructor(scene, tileset) {
    this._scene = scene;
    this._tileset = tileset;
    this._tilePass = new Cesium3DTilePassState({
      pass: Cesium3DTilePass.RENDER,
    });
    this._tilePass.commandList = [];

    this._fbo = undefined;
    this._passState = undefined;
    this.depthTexture = undefined;

    // Cache of derived depth-only commands, one slot per source command.
    this._derivedCommands = [];
    this._clearCommand = new ClearCommand({ depth: 1.0 });
  }

  execute() {
    const { context, frameState, view } = this._scene;

    // WEBGL_depth_texture (core in WebGL2). Bail out gracefully otherwise.
    if (!context.depthTexture) {
      return;
    }

    const width = context.drawingBufferWidth;
    const height = context.drawingBufferHeight;

    // (Re)create the target when missing or when the drawing buffer resized.
    if (
      !this._fbo ||
      this.depthTexture.width !== width ||
      this.depthTexture.height !== height
    ) {
      this._destroyResources();

      this.depthTexture = new Texture({
        context,
        width,
        height,
        pixelFormat: PixelFormat.DEPTH_COMPONENT,
        pixelDatatype: PixelDatatype.UNSIGNED_SHORT,
        sampler: Sampler.NEAREST,
      });
      this._fbo = new Framebuffer({
        context,
        depthTexture: this.depthTexture,
        destroyAttachments: false, // we own the texture's lifetime
      });
      this._passState = new PassState(context);
      this._passState.framebuffer = this._fbo;
    }

    // Collect the tileset's render commands into our private pass state.
    const commands = this._tilePass.commandList;
    commands.length = 0;
    this._tileset.updateForPass(frameState, this._tilePass);

    const passState = this._passState;
    passState.viewport = BoundingRectangle.clone(
      view.viewport,
      passState.viewport
    );

    this._clearCommand.execute(context, passState);
    context.uniformState.updatePass(Pass.CESIUM_3D_TILE);

    const derived = this._derivedCommands;
    for (let i = 0; i < commands.length; ++i) {
      // Reuse Cesium's depth-only derivation: pass-through shader when safe,
      // preserves discard / log-depth, and derives the render state per command.
      const result = DerivedCommand.createDepthOnlyDerivedCommand(
        this._scene,
        commands[i],
        context,
        derived[i]
      );
      derived[i] = result;

      const depthCommand = result.depthOnlyCommand;
      depthCommand.framebuffer = this._fbo;
      depthCommand.execute(context, passState);
    }
  }

  _destroyResources() {
    this._fbo = this._fbo && this._fbo.destroy();
    this.depthTexture = this.depthTexture && this.depthTexture.destroy();
    this._passState = undefined;
  }

  isDestroyed() {
    return false;
  }

  destroy() {
    this._destroyResources();
    // ... Cesium.destroyObject(this) if you want the standard pattern
  }
}

export default TilesetDepthPass;
