const BoxModel = {
    start(x, y, z, color, data) {
        this.dimensions = {
            width: x,
            height: y,
            depth: z
        };

        this.consumed = false;

        this.geometry = new THREE.BoxGeometry(x, y, z);
        this.material = new THREE.MeshLambertMaterial({
            color: color
        });
        this.mesh = new THREE.Mesh(this.geometry, this.material);
    }
};