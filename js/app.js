let _currentCount = 1;
const cellCounter = () => {
    _currentCount += 1;
    return _currentCount;
}

const colorBases = [
    '#2980b9',
    '#27ae60',
    '#e67e22',
    '#2c3e50',
    '#8e44ad',
    '#f1c40f'
];

const dataLevels = [
    'agency',
    'federal_account',
    'program_activity',
    'object_class',
    'recipient',
    'award'
];

const Visualization = {
    _buildScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x7f8c8d);
        const fog = new THREE.Fog();
        fog.color = new THREE.Color(0x7f8c8d);
        fog.near = 5;
        fog.far = 50;
        this.scene.fog = fog;

        // create a sun
        const sun = new THREE.HemisphereLight(0xffffff, 0x7f8c8d, 0.8);
        sun.position.set(500, 500, -500);
        this.scene.add(sun);

        // build the grid floor
        const floor = new THREE.GridHelper(200, 200, 0xbdc3c7, 0xbdc3c7);
        this.scene.add(floor);

        // prepare physics
        this.world = new OIMO.World({
            iterations: 8,
            broadphase: 2,
            worldscale: 1,
            random: true,
            info: false,
            gravity: [0, -9.8, 0]
        });

        this.physicalItems = {};

        // create the physical floor
        const floorBody = this.world.add({
            type: 'box',
            size: [1000, 1, 1000],
            pos: [0, -0.5, 0],
            rot: [0, 0, 0],
            move: false,
            friction: 1
        });
    },
    _buildCamera() {
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.3, 1000);
        this.controls = new THREE.VRControls(this.camera);
        this.controls.standing = true;
        // this.controls.userHeight = 12;

        // set up the reticulum
        Reticulum.init(this.camera, {
            proximity: false,
            clickevents: true,
            reticle: {
                visible: true,
                restPoint: 0.03, //Defines the reticle's resting point when no object has been targeted
                color: 0xcc0000,
                innerRadius: 0.0004,
                outerRadius: 0.003,
                hover: {
                    color: 0xcc0000,
                    innerRadius: 0.02,
                    outerRadius: 0.024,
                    speed: 5,
                    vibrate: 50 //Set to 0 or [] to disable
                }
            },
            fuse: {
                visible: false,
                duration: 2.5,
                color: 0x00fff6,
                innerRadius: 0.045,
                outerRadius: 0.06,
                vibrate: 100, //Set to 0 or [] to disable
                clickCancelFuse: false //If users clicks on targeted object fuse is canceled
            }
        });

        this.scene.add(this.camera);
    },
    _buildRenderer(element) {
        this.renderer = new THREE.WebGLRenderer({
            canvas: element,
            antialias: true
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);

        this.renderEffect = new THREE.VREffect(this.renderer);
        this.renderEffect.setSize(window.innerWidth, window.innerHeight);

        this.vrManager = new WebVRManager(this.renderer, this.renderEffect);
    },
    _buildHUD() {
        // set up the text HUD
        this.hudCanvas = document.createElement('canvas');
        this.hudCanvas.width = window.innerWidth;
        this.hudCanvas.height = 200;
        this.hudContext = this.hudCanvas.getContext('2d');
        this.hudContext.font = '40px Arial';
        this.hudContext.fillStyle = 'rgba(0,0,0,0.4)';
        this.hudContext.fillRect(0, 0, this.hudCanvas.width, this.hudCanvas.height);
        this.hudContext.fillStyle = 'white';
        this.hudContext.textAlign = 'center';
        this.hudContext.textBaseline = 'middle';
        this.hudContext.fillText('', this.hudCanvas.width / 2, this.hudCanvas.height / 2);

        this.hudTexture = new THREE.CanvasTexture(this.hudCanvas);

        const hudMaterial = new THREE.MeshBasicMaterial({
            map: this.hudTexture
        });
        hudMaterial.transparent = true;

        this.hudPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(this.hudCanvas.width / 500, this.hudCanvas.height / 500),
            hudMaterial
        );
        this.camera.add(this.hudPlane);
        this.hudPlane.position.set(0, -0.275, -1.3);
        this.hudPlane.visible = false;
    },
    _resize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();

        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderEffect.setSize(window.innerWidth, window.innerHeight);
    },
    _updateHUD(text) {
        // wrap the HUD text
        const words = text.split(' ');
        const lines = words.reduce((parsed, word) => {
            const lineIndex = Math.max(parsed.length - 1, 0);
            const testLine = `${parsed[lineIndex]}${word} `;
            const testLength = this.hudContext.measureText(testLine).width;
            if (testLength > this.hudCanvas.width) {
                parsed.push(`${word} `);
            }
            else {
                // fits into the line
                parsed[lineIndex] = testLine;
            }
            return parsed;
        }, ['']);

        this.hudContext.clearRect(0, 0, this.hudCanvas.width, this.hudCanvas.height);
        this.hudContext.fillStyle = 'rgba(0,0,0,0.4)';
        this.hudContext.fillRect(0, 0, this.hudCanvas.width, this.hudCanvas.height);
        this.hudContext.fillStyle = 'white';
        this.hudContext.textAlign = 'center';
        this.hudContext.textBaseline = 'middle';

        lines.forEach((line, index) => {
            const y = (this.hudCanvas.height / 2) - (Math.floor(lines.length / 2) * 40) + (index * 40);
            this.hudContext.fillText(line, this.hudCanvas.width / 2, y);
        });
        this.hudPlane.visible = text !== '';

        this.hudTexture.needsUpdate = true;
    },
    _showHUD(data) {
        const formattedAmount = accounting.formatMoney(data.amount, {
            symbol: '$',
            precision: 0
        });

        let name = data.name;
        if (data.type === 'award') {
            name = `Award ${data.code}`;
        }

        this._updateHUD(`${name}: ${formattedAmount}`);
    },
    _generateCell(cell, color) {
        const rawWidth = Math.abs(cell.x1 - cell.x0);
        const rawHeight = Math.abs(cell.y1 - cell.y0);
        // calculate the cell's original 2D surface area and treat as though it's the volume
        const volume = rawWidth * rawHeight;
        if (volume <= 0) {
            // will not appear, stop
            return null;
        }

        // get the original width/height ratio
        const ratio = rawWidth / rawHeight;
        // calculate the height as though it is a cube
        const height = Math.pow(volume, (1 / 3));

        // determine what the base surface area is of a rectangular prism for the given volume and height;
        const baseArea = volume / height;

        // determine what the width and depth are for the given base surface area if the
        // two dimensions also have the original treemap cell's aspect ratio
        const firstDimension = Math.pow(baseArea, 0.5) * ratio;
        const secondDimension = baseArea / firstDimension;
        // we actually don't want the depth to ever be greater than the width, so force the width to be the greater value
        const width = Math.max(firstDimension, secondDimension);
        const depth = Math.min(firstDimension, secondDimension);
        
        const model = Object.create(BoxModel);
        model.start(width, height, depth, color);
        model.data = cell.data;
        model.mesh.name = `${cell.data.type}-${cell.data.id}-${cellCounter()}`;

        return model;
    },
    _parseData(data, type, filters, containingVolume) {
        // only parse 50 items
        let values = data.results;
        if (data.results.length > 50) {
            values = data.results.slice(0, 50);
        }

        // no results
        if (values.length === 0) {
            return [];
        }

        // build the treemap in 2D on a 10x10 grid
        const range = [values[values.length - 1].amount, values[0].amount];
        const colorIndex = dataLevels.indexOf(type);
        const minColor = tinycolor(colorBases[colorIndex]).lighten(40).toRgbString();
        const maxColor = tinycolor(colorBases[colorIndex]).darken(40).toRgbString();

        const colorScale = d3.scaleLinear()
            .domain(range)
            .range([minColor, maxColor])
            .interpolate(d3.interpolateHsl);

        const treeData = d3.hierarchy({
                children: values
            })
            .sum((d) => d.amount)
            .sort((a, b) => b.value - a.value);

        // calculate a 3D volume and then convert it to a 2D square whose surface area equals the volume
        const dimension = Math.pow(containingVolume, (1 / 2));

        const chart = d3.treemap()
            .size([dimension, dimension])
            .tile(d3.treemapSquarify)
            .round(true);
        const cells = chart(treeData).leaves();

        return cells.reverse().reduce((parsed, cell) => {
            const color = colorScale(cell.value);
            const box = this._generateCell(cell, color);
            if (!box) {
                return parsed;
            }

            const cellId = box.mesh.name;

            // add hit event to the box
            Reticulum.add(box.mesh, {
                reticleHoverColor: 0x00fff6,
                fuseVisible: true,
                onGazeOver: () => {
                    // do something when user targets object
                    this._showHUD(cell.data);
                },
                onGazeOut: () => {
                    // do something when user moves reticle off targeted object
                    this._updateHUD('');
                },
                onGazeLong: () => {
                    // do something user targetes object for specific time
                    if (box.consumed) {
                        return;
                    }
                    this._selectCell(cellId);
                }
            });

            // add the filter set that was used to get to this point to the box model
            box.filters = filters;
            // keep track of this cell
            this.cellTracker[cellId] = box;
            
            parsed.push(box);
            return parsed;
        }, []);
    },
    _parseRoot(data) {
        const boxes = this._parseData(data, 'agency', {}, Math.pow(15, 3));

        // position the 3D models
        const frontCells = [];
        const backCells = [];

        const maxDisplayWidth = 10;

        boxes.forEach((box, index) => {
            // position the cell
            // determine if it is going in the front or the back
            const isFront = index % 2 === 0;
            const rowRef = isFront ? frontCells : backCells;
            let x = 0;
            let z = 5;
            if (rowRef.length === 0) {
                // first row
                x = -1 * maxDisplayWidth;
                z = 5;

                rowRef[0] = {
                    x: (-1 * maxDisplayWidth) + box.dimensions.width,
                    z: 5,
                    maxDepth: box.dimensions.depth
                };
            }
            else if (rowRef[rowRef.length - 1].x > maxDisplayWidth) {
                // go to the next row
                const newRow = {
                    x: (-1 * maxDisplayWidth) + box.dimensions.width,
                    z: rowRef[rowRef.length - 1].z + rowRef[rowRef.length - 1].maxDepth + 5,
                    maxDepth: box.dimensions.depth
                };

                x = -1 * maxDisplayWidth;
                z = newRow.z;

                rowRef.push(newRow);
            }
            else {
                // append to the existing row
                const currentRow = rowRef[rowRef.length - 1];
                x = currentRow.x;
                z = currentRow.z;

                // update the positioning for the next cell
                currentRow.x = currentRow.x + 5 + box.dimensions.width;
                if (box.dimensions.depth > currentRow.maxDepth) {
                    currentRow.maxDepth = box.dimensions.depth;
                }
                rowRef[rowRef.length - 1] = currentRow;
            }

            if (isFront) {
                z = -1 * z;
            }

            box.mesh.position.set(x, box.dimensions.height / 2, z);
            this.scene.add(box.mesh);

            // also make each box a collider
            const body = this.world.add({
                type: 'box',
                size: [box.dimensions.width, box.dimensions.height, box.dimensions.depth],
                pos: [box.mesh.position.x, box.mesh.position.y, box.mesh.position.z],
                rot: [0, 0, 0],
                move: false
            });

            this.physicalItems[box.mesh.name] = body;
        });
    },
    _parseDepth(data, type, filters) {
        // get the active cell
        const active = this.cellTracker[this.activeCell];
        const parentVolume = active.dimensions.width * active.dimensions.height * active.dimensions.depth;

        const boxes = this._parseData(data, type, filters, parentVolume);

        // remove the parent cell
        Reticulum.remove(active.mesh);
        this.scene.remove(active.mesh);
        if (this.physicalItems[active.mesh.name]) {
            this.physicalItems[active.mesh.name].remove();
            delete this.physicalItems[active.mesh.name];
        }

        // position the boxes to match where the parent cell is
        boxes.forEach((box, index) => {
            box.mesh.position.set(active.mesh.position.x, active.mesh.position.y, active.mesh.position.z);
            this.scene.add(box.mesh);

            // add physics to each item
            const body = this.world.add({
                type: 'box',
                size: [box.dimensions.width, box.dimensions.height, box.dimensions.depth],
                pos: [active.mesh.position.x, 30, active.mesh.position.z],
                rot: [0, 0, 0],
                move: true
            });
            this.physicalItems[box.mesh.name] = body;
            
        });

        delete this.cellTracker[this.activeCell];
        this.activeCell = null;
    },
    _selectCell(id) {
        // indicate the cell is consumed
        this.cellTracker[id].consumed = true;
        this.activeCell = id;

        // throw the cell up 20 meters
        const mesh = this.cellTracker[id].mesh;
        const animation = new TWEEN.Tween(mesh.position)
            .to({
                y: 30,
            }, 1500)
            .start()
            .onComplete(() => {
                mesh.position.y = 30;
                TWEEN.remove(animation);
                this._diveDeeper(id);
            });
    },
    _restoreCell(id) {
        // return the cell to the ground
        const mesh = this.cellTracker[id].mesh;
        const animation = new TWEEN.Tween(mesh.position)
            .to({
                y: this.cellTracker[id].dimensions.height / 2,
            }, 750)
            .start()
            .onComplete(() => {
                TWEEN.remove(animation);
                // indicate the cell is unconsumed
                this.cellTracker[id].consumed = false;
                this.activeCell = null;
            });
    },
    _diveDeeper(id) {
        const data = this.cellTracker[id].data;
        const oldFilters = this.cellTracker[id].filters;
        // determine the next type
        const currentIndex = dataLevels.indexOf(data.type);
        if (currentIndex + 1 >= dataLevels.length) {
            // we're done, no more levels to display
            this._restoreCell(id);
            return;
        }

        // load the next level of data
        const nextLevel = dataLevels[currentIndex + 1];
        const filters = Object.assign({}, oldFilters, {
            [data.type]: data.id
        });

        this._loadData(nextLevel, filters);
    },
    _loadData(level, filters = {}) {
        fetch(`https://api.usaspending.gov/api/v2/spending/`, {
            mode: 'cors',
            method: 'POST',
            headers: {
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                type: level,
                filters: Object.assign({}, filters, {
                    fy: `${currentFY()}`
                })
            })
        })
        .then((res) => res.json())
        .then((data) => {
            const isRoot = level === 'agency';
            if (isRoot) {
                this._parseRoot(data);
            }
            else {
                this._parseDepth(data, level, filters);
            }
        })
        .catch((err) => console.error(err));
    },
    start(element) {
        this._buildScene();
        this._buildCamera();
        this._buildRenderer(element);
        this._buildHUD();

        this.cellTracker = {};
        this.activeCell = null;

        window.addEventListener('resize', this._resize.bind(this));

        this.update();

        // load the first level of data
        this._loadData('agency');
    },
    update(timestamp) {
        window.requestAnimationFrame(this.update.bind(this));

        this._updatePhysics(timestamp);

        TWEEN.update();
        Reticulum.update();

        this.controls.update();
        this.camera.updateMatrixWorld();
        this.vrManager.render(this.scene, this.camera);
    },
    _updatePhysics(timestamp) {
        let step = 0;
        if (!this.lastUpdate) {
            this.lastUpdate = timestamp;
        }
        else {
            step = timestamp - this.lastUpdate;
            this.lastUpdate = timestamp;
        }

        this.world.step(step);

        // update all tracked physics objects
        Object.keys(this.physicalItems).forEach((id) => {
            const mesh = this.cellTracker[id].mesh;
            const body = this.physicalItems[id];
            mesh.position.copy(body.getPosition());
            mesh.quaternion.copy(body.getQuaternion());
        });
    }
};

const canvas = document.getElementById('canvas');
Visualization.start(canvas);

// prevent the browser from sleeping
const noSleep = new NoSleep();

function enableNoSleep() {
  noSleep.enable();
  document.removeEventListener('touchstart', enableNoSleep, false);
}

// Enable wake lock.
// (must be wrapped in a user input event handler e.g. a mouse or touch handler)
document.addEventListener('touchstart', enableNoSleep, false);
