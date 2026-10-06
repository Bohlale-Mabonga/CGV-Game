# CGV Game

A 3D browser game developed for the Computer Graphics and Visualisation
group project at the University of the Witwatersrand.

## Course

- COMS3006A — Computer Graphics and Visualisation


## Group Members
- Kuhle Bikitsha
- Thato Chuene
- Ntobeko Mdakane
- Nkosinathi Tshabalala
- Olwethu Makhabane
- Bohlale Mabonga

## Project

The project is being developed using:

- JavaScript
- Three.js
- Vite


The final game will feature:

- Three distinct levels/stages
- 3D player interaction
- Keyboard and mouse controls
- Lighting, materials, textures and shadows

## Development

### Requirements

- Node.js
- npm
- Modern web browser
- Git

### Install

Clone the repository:

```bash
git clone git@github.com:Bohlale-Mabonga/CGV-Game.git
cd CGV-Game
```

## Testing

See [TESTING.md](TESTING.md) for the full guide.

This project uses Vitest to validate the main gameplay systems.

Run the test suite:

```bash
npm test
```

Generate a coverage report for local review:

```bash
npm run test:coverage
```

The coverage output is stored in the `coverage/` folder and can be uploaded to Codecov or a similar service later.

## Important gameplay checks covered

- objective progression and keycard collection
- level timer countdown and reset logic
- power-puzzle route validation
- security beam hazard detection
- steam vent checkpoint resets
- collapsing corridor checks and checkpoint recovery
- door interaction and unlock flow

