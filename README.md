# Don't Fuck With Joe

A ridiculous, single-page browser game where you throw footballs, golf balls, and microphones at Joe's head. Hit him three times and Janette appears to yell **“JOEEEEEEE!”**. Joe gets faster as your score rises, because apparently he learns.

## Play

Press **START THROWING**, then use either control style:

- **Tap or click** for a quick throw.
- **Tap/click and drag** to choose an aim point and add power.
- Hit Joe's head to score. Every four hits raises the level; Joe accelerates, dashes from level 2 onward, becomes a smaller target, and your throws drop more quickly.
- **MUSIC: ON/OFF** starts muted or unmuted according to your last choice. The game includes an original hard-rock instrumental soundtrack, synthesized throw/hit/level-up effects, Joe’s spoken “Duh, huh?” on each hit, and Janette’s high-pitched “Jooooeeeeee!” on her popup.
- The **New Round** button resets the current score while preserving the high score in local storage when the browser permits it.

The game uses Pointer Events and is designed for phones, tablets, and desktop browsers. It has no backend, analytics, tracking, login, or external dependencies.

## Project structure

```text
dont-fuck-with-joe/
├── index.html         # Page structure and UI
├── css/
│   └── style.css      # Responsive mobile and desktop styling
├── js/
│   └── game.js        # Canvas rendering, controls, game state, and audio
└── assets/
    ├── joe.jpg                 # Joe photo
    ├── janette.jpg             # Janette photo
    ├── joe-hard-rock-loop.mp3  # Original looping gameplay soundtrack
    ├── joe-duh-huh.wav         # Joe's spoken hit reaction
    └── janette-joeeeeee.wav    # Janette's spoken popup reaction
```

> The game is a plain client-side HTML, CSS, and JavaScript project. It is intentionally framework-free and can be hosted as static files.

## Run locally

You can open `index.html` directly in a browser. For a closer simulation of a normal website, serve the repository folder with any local static web server, then open the URL it prints.

For example, with Python installed:

```bash
python3 -m http.server 8000
```

Then visit [http://localhost:8000](http://localhost:8000).

## Update and publish

Keep paths relative when making changes so the game works at a GitHub Pages project URL. Edit `index.html`, `css/style.css`, or `js/game.js`, test locally, commit, and push to the repository.

To publish from GitHub, open **Settings → Pages**, choose **Deploy from a branch**, select the default branch and the repository root, then save. GitHub Pages will serve the project at a URL in the form:

```text
https://YOUR-USERNAME.github.io/dont-fuck-with-joe/
```

The supplied `assets/joe.jpg` and `assets/janette.jpg` should be placed in `assets/` without renaming them. If an image is temporarily unavailable, gameplay stays functional with a simple in-canvas fallback rather than crashing.
