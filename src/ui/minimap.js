export class Minimap {
    constructor(playerControls) {
        this.playerControls = playerControls;
        this.markers = [];
        this.radius = 90; // px, half of container size below

        this.container = document.createElement('div');
        this.container.className = 'minimap';
        Object.assign(this.container.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            width: `${this.radius * 2}px`,
            height: `${this.radius * 2}px`,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(10,20,25,0.85) 0%, rgba(5,10,12,0.95) 100%)',
            border: '2px solid rgba(55,200,255,0.6)',
            boxShadow: '0 0 12px rgba(55,200,255,0.4), inset 0 0 20px rgba(0,0,0,0.6)',
            overflow: 'hidden',
            zIndex: '100'
        });

        this.playerDot = document.createElement('div');
        this.playerDot.className = 'minimap-player';
        Object.assign(this.playerDot.style, {
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: '0',
            height: '0',
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderBottom: '12px solid #ff4444',
            transform: 'translate(-50%, -50%)',
            transformOrigin: 'center',
            filter: 'drop-shadow(0 0 4px #ff4444)',
            zIndex: '2'
        });

        this.container.appendChild(this.playerDot);
        document.body.appendChild(this.container);
    }

    addMarker(object, type) {
        const marker = document.createElement('div');
        marker.className = `minimap-marker ${type}`;

        const colors = {
            keycard: '#ffdd33',
            door: '#33aaff',
            core: '#ff8800'
        };

        Object.assign(marker.style, {
            position: 'absolute',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: colors[type] || '#ffffff',
            boxShadow: `0 0 6px ${colors[type] || '#ffffff'}`,
            transform: 'translate(-50%, -50%)',
            zIndex: '1'
        });

        this.container.appendChild(marker);

        this.markers.push({
            object,
            marker
        });
    }

    update() {
        const playerPosition = this.playerControls.getPlayerPosition();

        // Rotate the player arrow if a facing angle is exposed
        if (typeof this.playerControls.getPlayerRotationY === 'function') {
            const yaw = this.playerControls.getPlayerRotationY();
            this.playerDot.style.transform =
                `translate(-50%, -50%) rotate(${yaw}rad)`;
        }

        const scale = 5; // world units -> minimap pixels

        for (const item of this.markers) {
            if (!item.object.parent) {
                item.marker.style.display = 'none';
                continue;
            }

            item.marker.style.display = 'block';

            const dx = item.object.position.x - playerPosition.x;
            const dz = item.object.position.z - playerPosition.z;

            let x = dx * scale;
            let y = dz * scale;

            // Clamp to inside the circle so markers don't fly off the map
            const dist = Math.sqrt(x * x + y * y);
            const maxDist = this.radius - 6;
            if (dist > maxDist) {
                const ratio = maxDist / dist;
                x *= ratio;
                y *= ratio;
            }

            item.marker.style.left = `${this.radius + x}px`;
            item.marker.style.top = `${this.radius + y}px`;
        }
    }
}