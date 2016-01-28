/*global define*/
define([
        '../Core/defaultValue',
        '../Core/defined',
        '../Core/defineProperties',
        '../Core/destroyObject',
        '../Core/DeveloperError',
        '../Core/Event',
        '../Core/getBaseUri',
        '../Core/getExtensionFromUri',
        '../Core/Intersect',
        '../Core/isDataUri',
        '../Core/joinUrls',
        '../Core/loadJson',
        '../Core/Math',
        '../Core/Request',
        '../Core/RequestScheduler',
        '../Core/RequestType',
        '../ThirdParty/Uri',
        '../ThirdParty/when',
        './Cesium3DTile',
        './Cesium3DTileRefine',
        './Cesium3DTilesetState',
        './CullingVolume',
        './SceneMode'
    ], function(
        defaultValue,
        defined,
        defineProperties,
        destroyObject,
        DeveloperError,
        Event,
        getBaseUri,
        getExtensionFromUri,
        Intersect,
        isDataUri,
        joinUrls,
        loadJson,
        CesiumMath,
        Request,
        RequestScheduler,
        RequestType,
        Uri,
        when,
        Cesium3DTile,
        Cesium3DTileRefine,
        Cesium3DTilesetState,
        CullingVolume,
        SceneMode) {
    "use strict";

    /**
     * A {@link https://github.com/AnalyticalGraphicsInc/3d-tiles/blob/master/README.md|3D Tiles tileset},
     * used for streaming massive heterogeneous 3D geospatial datasets.
     *
     * @alias Cesium3DTileset
     * @constructor
     *
     * @param {Object} options Object with the following properties:
     * @param {String} options.url The url to a tileset.json file or to a directory containing a tileset.json file.
     * @param {Boolean} [options.show=true] Determines if the tileset will be shown.
     * @param {Number} [options.maximumScreenSpaceError=16] The maximum screen-space error used to drive level-of-detail refinement.
     * @param {Boolean} [options.debugShowStatistics=false] For debugging only. Determines if rendering statistics are output to the console.
     * @param {Boolean} [options.debugFreezeFrame=false] For debugging only. Determines if only the tiles from last frame should be used for rendering.
     * @param {Boolean} [options.debugColorizeTiles=false] For debugging only. When true, assigns a random color to each tile.
     * @param {Boolean} [options.debugShowBoundingVolume=false] For debugging only. When true, renders the bounding volume for each tile.
     * @param {Boolean} [options.debugShowContentBoundingVolume=false] For debugging only. When true, renders the bounding volume for each tile's content.
     *
     * @example
     * var tileset = scene.primitives.add(new Cesium.Cesium3DTileset({
     *      url : 'http://localhost:8002/tilesets/Seattle'
     * }));
     */
    function Cesium3DTileset(options) {
        options = defaultValue(options, defaultValue.EMPTY_OBJECT);

        var url = options.url;

        //>>includeStart('debug', pragmas.debug);
        if (!defined(url)) {
            throw new DeveloperError('options.url is required.');
        }
        //>>includeEnd('debug');

        var tilesetUrl;
        var baseUrl;

        if (getExtensionFromUri(url) === 'json') {
            tilesetUrl = url;
            baseUrl = getBaseUri(url);
        } else if (isDataUri(url)) {
            tilesetUrl = url;
            baseUrl = '';
        } else {
            baseUrl = url;
            tilesetUrl = joinUrls(baseUrl, 'tileset.json');
        }

        this._url = url;
        this._baseUrl = baseUrl;
        this._tilesetUrl = tilesetUrl;
        this._state = Cesium3DTilesetState.UNLOADED;
        this._root = undefined;
        this._asset = undefined; // Metadata for the entire tileset
        this._properties = undefined; // Metadata for per-model/point/etc properties
        this._geometricError = undefined; // Geometric error when the tree is not rendered at all
        this._processingQueue = [];
        this._selectedTiles = [];

        /**
         * Determines if the tileset will be shown.
         *
         * @type {Boolean}
         * @default true
         */
        this.show = defaultValue(options.show, true);

        /**
         * The maximum screen-space error used to drive level-of-detail refinement.  Higher
         * values will provide better performance but lower visual quality.
         *
         * @type {Number}
         * @default 16
         */
        this.maximumScreenSpaceError = defaultValue(options.maximumScreenSpaceError, 16);

        /**
         * This property is for debugging only; it is not optimized for production use.
         * <p>
         * Determines if rendering statistics are output to the console.
         * </p>
         *
         * @type {Boolean}
         * @default false
         */
        this.debugShowStatistics = defaultValue(options.debugShowStatistics, false);
        this._statistics = {
            // Rendering stats
            visited : 0,
            numberOfCommands : 0,
            // Loading stats
            numberOfPendingRequests : 0,
            numberProcessing : 0,

            lastSelected : -1,
            lastVisited : -1,
            lastNumberOfCommands : -1,
            lastNumberOfPendingRequests : -1,
            lastNumberProcessing : -1
        };

        /**
         * This property is for debugging only; it is not optimized for production use.
         * <p>
         * Determines if only the tiles from last frame should be used for rendering.  This
         * effectively "freezes" the tileset to the previous frame so it is possible to zoom
         * out and see what was rendered.
         * </p>
         *
         * @type {Boolean}
         * @default false
         */
        this.debugFreezeFrame = defaultValue(options.debugFreezeFrame, false);

        /**
         * This property is for debugging only; it is not optimized for production use.
         * <p>
         * When true, assigns a random color to each tile.  This is useful for visualizing
         * what models belong to what tiles, espeically with additive refinement where models
         * from parent tiles may be interleaved with models from child tiles.
         * </p>
         *
         * @type {Boolean}
         * @default false
         */
        this.debugColorizeTiles = defaultValue(options.debugColorizeTiles, false);

        /**
         * This property is for debugging only; it is not optimized for production use.
         * <p>
         * When true, renders the bounding volume for each tile.  The bounding volume is
         * white if the tile's content has an explicit bounding volume; otherwise, it
         * is red.
         * </p>
         *
         * @type {Boolean}
         * @default false
         */
        this.debugShowBoundingVolume = defaultValue(options.debugShowBoundingVolume, false);

        /**
         * This property is for debugging only; it is not optimized for production use.
         * <p>
         * When true, renders a blue bounding volume for each tile's content.
         * </p>
         *
         * @type {Boolean}
         * @default false
         */
        this.debugShowContentBoundingVolume = defaultValue(options.debugShowContentBoundingVolume, false);

        /**
         * The event fired to indicate progress of loading new tiles.  This event is fired when a new tile
         * is requested, when a requested tile is finished downloading, and when a downloaded tile has been
         * processed and is ready to render.
         * <p>
         * The number of pending tile requests, <code>numberOfPendingRequests</code>, and number of tiles
         * processing, <code>numberProcessing</code> are passed to the event listener.
         * </p>
         * <p>
         * This event is fired at the end of the frame after the scene is rendered.
         * </p>
         *
         * @type {Event}
         * @default new Event()
         *
         * @example
         * city.loadProgress.addEventListener(function(numberOfPendingRequests, numberProcessing) {
         *     if ((numberOfPendingRequests === 0) && (numberProcessing === 0)) {
         *         console.log('Stopped loading');
         *         return;
         *     }
         *
         *     console.log('Loading: requests: ' + numberOfPendingRequests + ', processing: ' + numberProcessing);
         * });
         */
        this.loadProgress = new Event();
        this._loadProgressEventsToRaise = [];

        /**
         * This event fires once for each visible tile in a frame.  This can be used to style a tileset.
         * <p>
         * The visible {@link Cesium3DTile} is passed to the event listener.
         * </p>
         * <p>
         * This event is fired during the tileset traversal while the frame is being rendered
         * so that updates to the tile take effect in the same frame.  Do not create or modify
         * Cesium entities or primitives during the event listener.
         * </p>
         *
         * @type {Event}
         * @default new Event()
         *
         * @example
         * tileset.tileVisible.addEventListener(function(tile) {
         *     if (tile.content instanceof Cesium.Batched3DModel3DTileContentProvider) {
         *         console.log('A Batched 3D Model tile is visible.');
         *     }
         * });
         */
        this.tileVisible = new Event();

        this._readyPromise = when.defer();
    }

    defineProperties(Cesium3DTileset.prototype, {
        /**
         * Gets the tileset's asset object property, which contains metadata about the tileset.
         * <p>
         * See the {@link https://github.com/AnalyticalGraphicsInc/3d-tiles/blob/master/schema/asset.schema.json|asset schema}
         * in the 3D Tiles spec for the full set of properties.
         * </p>
         *
         * @memberof Cesium3DTileset.prototype
         *
         * @type {Object}
         * @readonly
         *
         * @example
         * console.log('3D Tiles version: ' + tileset.asset.version);
         */
        asset : {
            get : function() {
                //>>includeStart('debug', pragmas.debug);
                if (!this.ready) {
                    throw new DeveloperError('The tileset is not loaded.  Use Cesium3DTileset.readyPromise or wait for Cesium3DTileset.ready to be true.');
                }
                //>>includeEnd('debug');

                return this._asset;
            }
        },

        /**
         * Gets the tileset's properties dictionary object, which contains metadata about per-feature properties.
         * <p>
         * See the {@link https://github.com/AnalyticalGraphicsInc/3d-tiles/blob/master/schema/properties.schema.json|properties schema}
         * in the 3D Tiles spec for the full set of properties.
         * </p>
         *
         * @memberof Cesium3DTileset.prototype
         *
         * @type {Object}
         * @readonly
         *
         * @example
         * console.log('Maximum building height: ' + tileset.properties.height.maximum);
         * console.log('Minimum building height: ' + tileset.properties.height.minimum);
         */
        properties : {
            get : function() {
                //>>includeStart('debug', pragmas.debug);
                if (!this.ready) {
                    throw new DeveloperError('The tileset is not loaded.  Use Cesium3DTileset.readyPromise or wait for Cesium3DTileset.ready to be true.');
                }
                //>>includeEnd('debug');

                return this._properties;
            }
        },

        /**
         * When <code>true</code>, the tileset's root tile is loaded and the tileset is ready to render.
         * This is set to <code>true</code> right before {@link Cesium3DTileset#readyPromise} is resolved.
         *
         * @memberof Cesium3DTileset.prototype
         *
         * @type {Boolean}
         * @readonly
         *
         * @default false
         */
        ready : {
            get : function() {
                return defined(this._root);
            }
        },

        /**
         * Gets the promise that will be resolved when the tileset's root tile is loaded and the tileset is ready to render.
         * <p>
         * This promise is resolved at the end of the frame before the first frame the tileset is rendered in.
         * </p>
         *
         * @memberof Cesium3DTileset.prototype
         *
         * @type {Promise.<Cesium3DTileset>}
         * @readonly
         *
         * @example
         * Cesium.when(tileset.readyPromise).then(function(tileset) {
         *     // tile.properties is not defined until readyPromise resolves.
         *     var properties = tileset.properties;
         *     if (Cesium.defined(properties)) {
         *         for (var name in properties) {
         *             console.log(properties[name]);
         *         }
         *     }
         * });
         */
        readyPromise : {
            get : function() {
                return this._readyPromise;
            }
        },

        /**
         * The url to a tileset.json file or to a directory containing a tileset.json file.
         *
         * @memberof Cesium3DTileset.prototype
         *
         * @type {String}
         * @readonly
         */
        url : {
            get : function() {
                return this._url;
            }
        },

        /**
         * DOC_TBA
         *
         * @memberof Cesium3DTileset.prototype
         *
         * @type {String}
         * @readonly
         */
        baseUrl : {
            get : function() {
                return this._baseUrl;
            }
        }
    });

    /**
     * Loads the main tileset.json or a tileset.json referenced from a tile.
     *
     * @private
     */
    Cesium3DTileset.prototype.loadTileset = function(tilesetUrl, parentTile) {
        var tileset = this;

        // We don't know the distance of the tileset until tiles.json is loaded, so use the default distance for now
        var promise = RequestScheduler.schedule(new Request({
            url : tilesetUrl,
            requestFunction : loadJson,
            type : RequestType.TILES3D
        }));

        if (!defined(promise)) {
            return undefined;
        }

        return promise.then(function(tilesetJson) {
            if (tileset.isDestroyed()) {
                return when.reject('tileset is destroyed');
            }

            if (!defined(tilesetJson.asset) || (tilesetJson.asset.version !== '0.0')) {
                throw new DeveloperError('The tileset must be 3D Tiles version 0.0.  See https://github.com/AnalyticalGraphicsInc/3d-tiles#spec-status');
            }

            var baseUrl = tileset._baseUrl;
            var rootTile = new Cesium3DTile(tileset, baseUrl, tilesetJson.root, parentTile);

            // If there is a parentTile, add the root of the currently loading tileset
            // to parentTile's children, and increment its numberOfChildrenWithoutContent
            if (defined(parentTile)) {
                parentTile.children.push(rootTile);
                ++parentTile.numberOfChildrenWithoutContent;
            }

            var refiningTiles = [];

            var stack = [];
            stack.push({
                header : tilesetJson.root,
                cesium3DTile : rootTile
            });

            while (stack.length > 0) {
                var t = stack.pop();
                var tile3D = t.cesium3DTile;
                var children = t.header.children;
                var hasEmptyChild = false;
                if (defined(children)) {
                    var length = children.length;
                    for (var k = 0; k < length; ++k) {
                        var childHeader = children[k];
                        var childTile = new Cesium3DTile(tileset, baseUrl, childHeader, tile3D);
                        tile3D.children.push(childTile);
                        stack.push({
                            header : childHeader,
                            cesium3DTile : childTile
                        });
                        if (!childTile.hasContent) {
                            hasEmptyChild = true;
                        }
                    }
                }
                if (tile3D.hasContent && hasEmptyChild && (tile3D.refine === Cesium3DTileRefine.REPLACE)) {
                    // Tiles that use replacement refinement and have empty child tiles need to keep track of
                    // descendants with content in order to refine correctly.
                    refiningTiles.push(tile3D);
                }
            }

            prepareRefiningTiles(refiningTiles);

            return {
                tilesetJson : tilesetJson,
                root : rootTile
            };
        });
    };

    function prepareRefiningTiles(refiningTiles) {
        var stack = [];
        var length = refiningTiles.length;
        for (var i = 0; i < length; ++i) {
            var refiningTile = refiningTiles[i];
            refiningTile.descendantsWithContent = [];
            stack.push(refiningTile);
            while (stack.length > 0) {
                var tile = stack.pop();
                var children = tile.children;
                var childrenLength = children.length;
                for (var k = 0; k < childrenLength; ++k) {
                    var childTile = children[k];
                    if (childTile.hasContent) {
                        refiningTile.descendantsWithContent.push(childTile);
                    } else {
                        stack.push(childTile);
                    }
                }
            }
        }
    }

    function getScreenSpaceError(geometricError, tile, frameState) {
        // TODO: screenSpaceError2D like QuadtreePrimitive.js
        if (geometricError === 0.0) {
            // Leaf nodes do not have any error so save the computation
            return 0.0;
        }

        // Avoid divide by zero when viewer is inside the tile
        var distance = Math.max(tile.distanceToCamera, CesiumMath.EPSILON7);
        var height = frameState.context.drawingBufferHeight;
        var sseDenominator = frameState.camera.frustum.sseDenominator;

        return (geometricError * height) / (distance * sseDenominator);
    }

    function computeDistanceToCamera(children, frameState) {
        var length = children.length;
        for (var i = 0; i < length; ++i) {
            var child = children[i];
            child.distanceToCamera = child.distanceToTile(frameState);
        }
    }

    // PERFORMANCE_IDEA: is it worth exploiting frame-to-frame coherence in the sort, i.e., the
    // list of children are probably fully or mostly sorted unless the camera moved significantly?
    function sortChildrenByDistanceToCamera(a, b) {
        // Sort by farthest child first since this is going on a stack
        return b.distanceToCamera - a.distanceToCamera;
    }

    ///////////////////////////////////////////////////////////////////////////

    function requestContent(tiles3D, tile, outOfCore) {
        if (!outOfCore) {
            return;
        }
        if (!tile.canRequestContent()) {
            return;
        }

        tile.requestContent();

        if (!tile.isContentUnloaded()) {
            var stats = tiles3D._statistics;
            ++stats.numberOfPendingRequests;
            addLoadProgressEvent(tiles3D);

            var removeFunction = removeFromProcessingQueue(tiles3D, tile);
            when(tile.processingPromise).then(addToProcessingQueue(tiles3D, tile)).otherwise(removeFunction);
            when(tile.readyPromise).then(removeFunction).otherwise(removeFunction);
        }
    }

    function selectTile(selectedTiles, tile, fullyVisible, frameState) {
        // There may also be a tight box around just the tile's contents, e.g., for a city, we may be
        // zoomed into a neighborhood and can cull the skyscrapers in the root node.
        if (tile.isReady() && (fullyVisible || (tile.contentsVisibility(frameState.cullingVolume) !== Intersect.OUTSIDE))) {
            selectedTiles.push(tile);
            tile.selected = true;
        }
    }

    var scratchStack = [];
    var scratchRefiningTiles = [];

    function selectTiles(tiles3D, frameState, outOfCore) {
        if (tiles3D.debugFreezeFrame) {
            return;
        }

        var maximumScreenSpaceError = tiles3D.maximumScreenSpaceError;
        var cullingVolume = frameState.cullingVolume;

        var selectedTiles = tiles3D._selectedTiles;
        selectedTiles.length = 0;

        scratchRefiningTiles.length = 0;

        var root = tiles3D._root;
        root.distanceToCamera = root.distanceToTile(frameState);
        root.parentPlaneMask = CullingVolume.MASK_INDETERMINATE;

        if (getScreenSpaceError(tiles3D._geometricError, root, frameState) <= maximumScreenSpaceError) {
            // The SSE of not rendering the tree is small enough that the tree does not need to be rendered
            return;
        }

        if (root.isContentUnloaded()) {
            requestContent(tiles3D, root, outOfCore);
            return;
        }

        var stats = tiles3D._statistics;

        var stack = scratchStack;
        stack.push(root);
        while (stack.length > 0) {
            // Depth first.  We want the high detail tiles first.
            var t = stack.pop();
            t.selected = false;
            ++stats.visited;

            var planeMask = t.visibility(cullingVolume);
            if (planeMask === CullingVolume.MASK_OUTSIDE) {
                // Tile is completely outside of the view frustum; therefore
                // so are all of its children.
                continue;
            }
            var fullyVisible = (planeMask === CullingVolume.MASK_INSIDE);

            // Tile is inside/intersects the view frustum.  How many pixels is its geometric error?
            var sse = getScreenSpaceError(t.geometricError, t, frameState);
// TODO: refine also based on (1) occlusion/VMSSE and/or (2) center of viewport

            var children = t.children;
            var childrenLength = children.length;
            var child;
            var k;
            var additiveRefinement = (t.refine === Cesium3DTileRefine.ADD);

            if (t.hasTilesetContent) {
                // If tile has tileset content, skip it and process its child instead (the tileset root)
                // No need to check visibility or sse of the child because its bounding volume
                // and geometric error are equal to its parent.
                if (t.isReady()) {
                    child = t.children[0];
                    child.parentPlaneMask = t.parentPlaneMask;
                    child.distanceToCamera = t.distanceToCamera;
                    if (child.isContentUnloaded()) {
                        requestContent(tiles3D, child, outOfCore);
                    } else {
                        stack.push(child);
                    }
                }
                continue;
            }

            if (additiveRefinement) {
                // With additive refinement, the tile is rendered
                // regardless of if its SSE is sufficient.
                selectTile(selectedTiles, t, fullyVisible, frameState);

// TODO: experiment with prefetching children
                if (sse > maximumScreenSpaceError) {
                    // Tile does not meet SSE. Refine them in front-to-back order.

                    // Only sort and refine (render or request children) if any
                    // children are loaded or request slots are available.
                    var anyChildrenLoaded = (t.numberOfChildrenWithoutContent < childrenLength);
                    if (anyChildrenLoaded || t.canRequestContent()) {
                        // Distance is used for sorting now and for computing SSE when the tile comes off the stack.
                        computeDistanceToCamera(children, frameState);

                        // Sort children by distance for (1) request ordering, and (2) early-z
                        children.sort(sortChildrenByDistanceToCamera);
// TODO: is pixel size better?
// TODO: consider priority queue instead of explicit sort, which would no longer be DFS.

                        // With additive refinement, we only request children that are visible, compared
                        // to replacement refinement where we need all children.
                        for (k = 0; k < childrenLength; ++k) {
                            child = children[k];
                            // Store the plane mask so that the child can optimize based on its parent's returned mask
                            child.parentPlaneMask = planeMask;

                            // Use parent's geometric error with child's box to see if we already meet the SSE
                            if (getScreenSpaceError(t.geometricError, child, frameState) > maximumScreenSpaceError) {
                                if (child.isContentUnloaded()) {
                                    if (child.visibility(cullingVolume) !== CullingVolume.MASK_OUTSIDE) {
                                        requestContent(tiles3D, child, outOfCore);
                                    }
                                } else {
                                    stack.push(child);
                                }
                            }
                        }
                    }
                }
            } else {
                // t.refine === Cesium3DTileRefine.REPLACE
                //
                // With replacement refinement, if the tile's SSE
                // is not sufficient, its children (or ancestors) are
                // rendered instead

                if ((sse <= maximumScreenSpaceError) || (childrenLength === 0)) {
                    // This tile meets the SSE so add its commands.
                    // Select tile if it's a leaf (childrenLength === 0)
                    selectTile(selectedTiles, t, fullyVisible, frameState);
                } else {
                    // Tile does not meet SSE.

                    // Only sort children by distance if we are going to refine to them
                    // or slots are available to request them.  If we are just rendering the
                    // tile (and can't make child requests because no slots are available)
                    // then the children do not need to be sorted.

                    var allChildrenLoaded = t.numberOfChildrenWithoutContent === 0;
                    if (allChildrenLoaded || t.canRequestContent()) {
                        // Distance is used for sorting now and for computing SSE when the tile comes off the stack.
                        computeDistanceToCamera(children, frameState);

                        // Sort children by distance for (1) request ordering, and (2) early-z
                        children.sort(sortChildrenByDistanceToCamera);
// TODO: same TODO as above.
                    }

                    if (!allChildrenLoaded) {
                        // Tile does not meet SSE.  Add its commands since it is the best we have and request its children.
                        selectTile(selectedTiles, t, fullyVisible, frameState);

                        if (outOfCore) {
                            for (k = 0; (k < childrenLength) && t.canRequestContent(); ++k) {
                                child = children[k];
// TODO: we could spin a bit less CPU here and probably above by keeping separate lists for unloaded/ready children.
                                if (child.isContentUnloaded()) {
                                    requestContent(tiles3D, child, outOfCore);
                                }
                            }
                        }
                    } else {
                        // Tile does not meet SEE and its children are loaded.  Refine to them in front-to-back order.
                        for (k = 0; k < childrenLength; ++k) {
                            child = children[k];
                            // Store the plane mask so that the child can optimize based on its parent's returned mask
                            child.parentPlaneMask = planeMask;
                            stack.push(child);
                        }

                        if (defined(t.descendantsWithContent)) {
                            scratchRefiningTiles.push(t);
                        }
                    }
                }
            }
        }

        checkRefiningTiles(scratchRefiningTiles, tiles3D, frameState);
    }

    function checkRefiningTiles(refiningTiles, tiles3D, frameState) {
        // In the common case, a tile that uses replacement refinement is refinable once all its
        // children are loaded. However if it has an empty child, refining to its children would
        // show a visible gap. In this case, the empty child's children (or further descendants)
        // would need to be selected before the original tile is refinable. It is hard to determine
        // this easily during the traversal, so this fixes the situation retroactively.
        var descendant;
        var refiningTilesLength = refiningTiles.length;
        for (var i = 0; i < refiningTilesLength; ++i) {
            var j;
            var refinable = true;
            var refiningTile = refiningTiles[i];
            var descendantsLength = refiningTile.descendantsWithContent.length;
            for (j = 0; j < descendantsLength; ++j) {
                descendant = refiningTile.descendantsWithContent[j];
                if (!descendant.selected) {
                    // TODO: also check that its visible
                    refinable = false;
                    break;
                }
            }
            if (!refinable) {
                var fullyVisible = refiningTile.visibility(frameState.cullingVolume) === CullingVolume.MASK_INSIDE;
                selectTile(tiles3D._selectedTiles, refiningTile, fullyVisible, frameState);
                for (j = 0; j < descendantsLength; ++j) {
                    descendant = refiningTile.descendantsWithContent[j];
                    descendant.selected = false;
                }
            }
        }
    }

    ///////////////////////////////////////////////////////////////////////////

    function addToProcessingQueue(tiles3D, tile) {
        return function() {
            tiles3D._processingQueue.push(tile);

            --tiles3D._statistics.numberOfPendingRequests;
            ++tiles3D._statistics.numberProcessing;
            addLoadProgressEvent(tiles3D);
        };
    }

    function removeFromProcessingQueue(tiles3D, tile) {
        return function() {
            var index = tiles3D._processingQueue.indexOf(tile);
            if (index >= 0) {
                // Remove from processing queue
                tiles3D._processingQueue.splice(index, 1);
                --tiles3D._statistics.numberProcessing;
            } else {
                // Not in processing queue
                // For example, when a url request fails and the ready promise is rejected
                --tiles3D._statistics.numberOfPendingRequests;
            }

            addLoadProgressEvent(tiles3D);
        };
    }

    function processTiles(tiles3D, frameState) {
        var tiles = tiles3D._processingQueue;
        var length = tiles.length;

        // Process tiles in the PROCESSING state so they will eventually move to the READY state.
        // Traverse backwards in case a tile is removed as a result of calling process()
        for (var i = length - 1; i >= 0; --i) {
            tiles[i].process(tiles3D, frameState);
        }
    }

    ///////////////////////////////////////////////////////////////////////////

    function clearStats(tiles3D) {
        var stats = tiles3D._statistics;
        stats.visited = 0;
        stats.numberOfCommands = 0;
    }

    function showStats(tiles3D, isPick) {
        var stats = tiles3D._statistics;

        if (tiles3D.debugShowStatistics && (
            stats.lastVisited !== stats.visited ||
            stats.lastNumberOfCommands !== stats.numberOfCommands ||
            stats.lastSelected !== tiles3D._selectedTiles.length ||
            stats.lastNumberOfPendingRequests !== stats.numberOfPendingRequests ||
            stats.lastNumberProcessing !== stats.numberProcessing)) {

            stats.lastVisited = stats.visited;
            stats.lastNumberOfCommands = stats.numberOfCommands;
            stats.lastSelected = tiles3D._selectedTiles.length;
            stats.lastNumberOfPendingRequests = stats.numberOfPendingRequests;
            stats.lastNumberProcessing = stats.numberProcessing;

            // Since the pick pass uses a smaller frustum around the pixel of interest,
            // the stats will be different than the normal render pass.
            var s = isPick ? '[Pick ]: ' : '[Color]: ';
            s +=
                'Visited: ' + stats.visited +
                // Number of commands returned is likely to be higher than the number of tiles selected
                // because of tiles that create multiple commands.
                ', Selected: ' + tiles3D._selectedTiles.length +
                // Number of commands executed is likely to be higher because of commands overlapping
                // multiple frustums.
                ', Commands: ' + stats.numberOfCommands +
                ', Requests: ' + stats.numberOfPendingRequests +
                ', Processing: ' + stats.numberProcessing;

            /*global console*/
            console.log(s);
        }
    }

    function updateTiles(tiles3D, frameState) {
        var commandList = frameState.commandList;
        var numberOfCommands = commandList.length;
        var selectedTiles = tiles3D._selectedTiles;
        var length = selectedTiles.length;
        var tileVisible = tiles3D.tileVisible;
        for (var i = 0; i < length; ++i) {
            var tile = selectedTiles[i];
            if (tile.selected) {
                tileVisible.raiseEvent(tile);
                tile.update(tiles3D, frameState);
            }
        }

        tiles3D._statistics.numberOfCommands = (commandList.length - numberOfCommands);
    }

    ///////////////////////////////////////////////////////////////////////////

    function addLoadProgressEvent(tiles3D) {
        if (tiles3D.loadProgress.numberOfListeners > 0) {
            var stats = tiles3D._statistics;
            tiles3D._loadProgressEventsToRaise.push({
                numberOfPendingRequests : stats.numberOfPendingRequests,
                numberProcessing : stats.numberProcessing
            });
        }
    }

    function evenMoreComplicated(tiles3D, numberOfPendingRequests, numberProcessing) {
        return function() {
            tiles3D.loadProgress.raiseEvent(numberOfPendingRequests, numberProcessing);
        };
    }

    function raiseLoadProgressEvents(tiles3D, frameState) {
        var eventsToRaise = tiles3D._loadProgressEventsToRaise;
        var length = eventsToRaise.length;
        for (var i = 0; i < length; ++i) {
            var numberOfPendingRequests = eventsToRaise[i].numberOfPendingRequests;
            var numberProcessing = eventsToRaise[i].numberProcessing;

            frameState.afterRender.push(evenMoreComplicated(tiles3D, numberOfPendingRequests, numberProcessing));
        }
        eventsToRaise.length = 0;
    }

    ///////////////////////////////////////////////////////////////////////////

    function loadTiles(tileset) {
        var promise = tileset.loadTileset(tileset._tilesetUrl, undefined);
        if (defined(promise)) {
            tileset._state = Cesium3DTilesetState.LOADING;
            promise.then(function(data) {
                var tilesetJson = data.tilesetJson;
                tileset._state = Cesium3DTilesetState.READY;
                tileset._asset = tilesetJson.asset;
                tileset._properties = tilesetJson.properties;
                tileset._geometricError = tilesetJson.geometricError;
                tileset._root = data.root;
                tileset._readyPromise.resolve(tileset);
            }).otherwise(function(error) {
                tileset._state = Cesium3DTilesetState.FAILED;
                tileset._readyPromise.reject(error);
            });
        }
    }
    function selectTilesToUnload(selectedTiles, tilesToUnload){
            for(var i = 0; i < selectedTiles.length; i++){
                var tileVisible = selectedTiles[i];
                for(var j = 0; j < tilesToUnload.length; j++){
                    if(tilesToUnload[j] == tileVisible){
                        tilesToUnload.splice(j, 1);
                        break;
                    }
                }
            }
            // keep parents

            for(var i = tilesToUnload.length - 1; i >= 0; i--){
                var tileToUnload = tilesToUnload[i];
                var keepParent = false;
                var stack = [];
                stack.push(tileToUnload);
                while(stack.length > 0 && !keepParent){
                    var tile = stack.pop();
                    for(var k = 0; k < selectedTiles.length; k++){
                        if(tile == selectedTiles[k]){
                            keepParent = true;
                            break;
                        }
                    }
                    for (var j = 0; j < tile.children.length; j++){
                        var child = tile.children[j];
                        stack.push(child);
                    }
                }
                if(keepParent){
                    tilesToUnload.splice(i, 1);
                }
            }
            //keepsiblings // until a parent with refine === add
            for(var i = tilesToUnload.length - 1; i >= 0; i--){
                var tileToUnload = tilesToUnload[i];
                var keepSiblings = false;
                // go up the parent CHAIN until first tile with replace ADD
                var parent = tileToUnload.parent;

                if(parent && !parent.refine == Cesium3DTileRefine.ADD){  // PARENT IS ALREADY ROOT ELEMENT

                    // go up the chain
                    while(parent.parent && parent.parent.refine != Cesium3DTileRefine.ADD){
                        parent = parent.parent
                    }


                    if(parent){
                        var stack = parent.children.slice();
                        while(stack.length > 0 && !keepSiblings){
                            var child = stack.pop();
                            for(var k = 0; k < selectedTiles.length; k++){
                                if(child == selectedTiles[k]){
                                    keepSiblings = true;
                                    break;
                                }
                            }
                            if(!keepSiblings){
                                for(var k = 0; k < child.children.length; k++){
                                    stack.push(child.children[k]);
                                }
                            }
                        }
                    }
                    if(keepSiblings){
                        tilesToUnload.splice(i, 1);
                    }
                }
            }
        }
        function unloadTiles(tiles){
            for(var i = 0; i < tiles.length; i++){
                if(tiles[i].isReady()){
                    tiles[i].unload();
                }
            }
        }
    /**
     * Called when {@link Viewer} or {@link CesiumWidget} render the scene to
     * get the draw commands needed to render this primitive.
     * <p>
     * Do not call this function directly.  This is documented just to
     * list the exceptions that may be propagated when the scene is rendered:
     * </p>
     *
     * @exception {DeveloperError} The tileset must be 3D Tiles version 0.0.  See https://github.com/AnalyticalGraphicsInc/3d-tiles#spec-status
     */
    Cesium3DTileset.prototype.update = function(frameState) {
        if (this._state === Cesium3DTilesetState.UNLOADED) {
            loadTiles(this);
        }

        // TODO: Support 2D and CV
        if (!this.show || !defined(this._root) || (frameState.mode !== SceneMode.SCENE3D)) {
            return;
        }

        // Do not do out-of-core operations (new content requests, cache removal,
        // process new tiles) during the pick pass.
        var passes = frameState.passes;
        var isPick = (passes.pick && !passes.render);
        var outOfCore = !isPick;

        clearStats(this);

        if (outOfCore) {
            processTiles(this, frameState);
        }

        var tilesToUnload = [];
        if(outOfCore){
          for(var i = 0; i < this._selectedTiles.length; i++){
            tilesToUnload.push(this._selectedTiles[i]);
          }
        }

        selectTiles(this, frameState, outOfCore);
        if(outOfCore){
          selectTilesToUnload(this._selectedTiles, tilesToUnload);
        }
        updateTiles(this, frameState);

        unloadTiles(tilesToUnload);
        // Events are raised (added to the afterRender queue) here since promises
        // may resolve outside of the update loop that then raise events, e.g.,
        // model's readyPromise.
        raiseLoadProgressEvents(this, frameState);

        showStats(this, isPick);
    };

    /**
     * Returns true if this object was destroyed; otherwise, false.
     * <br /><br />
     * If this object was destroyed, it should not be used; calling any function other than
     * <code>isDestroyed</code> will result in a {@link DeveloperError} exception.
     *
     * @returns {Boolean} <code>true</code> if this object was destroyed; otherwise, <code>false</code>.
     *
     * @see Cesium3DTileset#destroy
     */
    Cesium3DTileset.prototype.isDestroyed = function() {
        return false;
    };

    /**
     * Destroys the WebGL resources held by this object.  Destroying an object allows for deterministic
     * release of WebGL resources, instead of relying on the garbage collector to destroy this object.
     * <br /><br />
     * Once an object is destroyed, it should not be used; calling any function other than
     * <code>isDestroyed</code> will result in a {@link DeveloperError} exception.  Therefore,
     * assign the return value (<code>undefined</code>) to the object as done in the example.
     *
     * @returns {undefined}
     *
     * @exception {DeveloperError} This object was destroyed, i.e., destroy() was called.
     *
     *
     * @example
     * tileset = tileset && tileset.destroy();
     *
     * @see Cesium3DTileset#isDestroyed
     */
    Cesium3DTileset.prototype.destroy = function() {
        // Traverse the tree and destroy all tiles
        if (defined(this._root)) {
            var stack = scratchStack;
            stack.push(this._root);

            while (stack.length > 0) {
                var t = stack.pop();
                t.destroy();

                var children = t.children;
                var length = children.length;
                for (var i = 0; i < length; ++i) {
                    stack.push(children[i]);
                }
            }
        }

        this._root = undefined;
        return destroyObject(this);
    };

    return Cesium3DTileset;
});
