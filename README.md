<img src="https://raw.githubusercontent.com/Atomotron/archimedes2/master/logo.svg" alt="AE2 logo" width="250" align="right">

# LD 48: "Deeper and Deeper"

## Running the Release

Go to our ludumdare page, it has instructions and a link to play:
https://ldjam.com/events/ludum-dare/48/inner-pieces

## Running from Source

Due to cross-origin rules, you will need to start a local webserver. I like to use `python -m http.server` , after `cd`ing into the source directory, but any local webserver will suffice. This will host the server at at `localhost:8000`. Simply open up `index.html`.

## Known Issues

The Firefox+NVIDIA+Linux combination has poor performance due to unavoidable software compositing stage, where the whole window has to be transfered to the CPU and back. I talked to the team at Mozilla and they explained that it was due to a longstanding conflict between the Linux kernel team and NVIDIA. The poor performance is due to a workaround. The best I could do was make sure to develop using that trio, so that we left enough unused time in the frame cycle to absorb the compositing overhead.

The framerate calculation sometimes makes the game run slow in real-time due to a step size limiter. It is dangerous to fix this in the most straightforward way because large time steps violate the infinitesimal step assumption of the integrator. Careful tuning of a multi-step-per-frame tactic could solve this, but I don't have any computers where the game runs slow enough to hit the step size limiter. (Naive implementation of a frame step size divider could result in complete freezes due to a positive feedback loop of larger time deltas taking longer to simulate, thereby leading to larger time delta targets. Hence this is not something I can safely fix by speculating about performance and pushing whatever I write.)
