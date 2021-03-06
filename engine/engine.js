// Handles timing and synchronization. Subclass this in your own code.

export class Engine {
    // res : Resources as provided by load
    // frames_behind: keep this many frames behind real time to
    //                smooth out fps variations
    MAX_DT = 1/24; // Don't take steps bigger than 1/12th of a second.
    TIME_SPEED = 1.0; // Accelerate time by this factor.
    REPORTING_PERIOD = 10.0; // Time in seconds between reports
    constructor(res,render,env,streams,frames_behind=10) {
        this.res = res;
        this.render = render;
        this.env = env;
        this.frames_behind = frames_behind; 
        this.target_time = 0;
        this.time_reached = 0; 
        this.fps = 0; // Smoothed based on goal mechanism.
        this.last_real_timestamp = null;
        this.sprites = new Set();
        this.streams = streams;
        this.report_timer = 0;
        this.paused = false;
    }
    // Starts requestanimframe to this.runFrame
    start() {
        const that = this; // Closure trick
        (function innerTick(timestamp=null) {
            timestamp = timestamp * 0.001; // ms to sec
            if (timestamp !== null &&
                that.last_real_timestamp !== null) {
                // Advance our target time, but not more than MAX_DT.
                const real_dt = timestamp-that.last_real_timestamp;
                if (!that.paused) {
                    if (real_dt < that.MAX_DT) {
                        that.target_time += real_dt;
                    } else {    
                        that.target_time += that.MAX_DT;
                    }
                }
                // Compute desired timestep based on target and lag.
                let goal_dt = (that.target_time - that.time_reached)
                                    / that.frames_behind;
                if (that.paused) goal_dt = 0.0;
                const time_after_goal_dt = that.time_reached + goal_dt;
                that.fps = 1/goal_dt;
                // Print FPS report
                if (that.report_timer < 0 && false) {
                    that.report_timer = that.REPORTING_PERIOD;
                    console.log(
                        'fps:',1/real_dt,
                        'smoothed fps:',1/goal_dt,
                        'timestep',goal_dt,
                        'multiplied timestep',goal_dt * that.TIME_SPEED,
                    );
                }
                that.report_timer -= real_dt;
                that.runFrame(goal_dt * that.TIME_SPEED,time_after_goal_dt * that.TIME_SPEED);
                that.time_reached = time_after_goal_dt;
            }
            if (timestamp !== null) {
                that.last_real_timestamp = timestamp;
            }
            window.requestAnimationFrame(innerTick);
        })(null);
    }
    runFrame(dt,t) {
        // Moves the simuation ahead dt seconds to reach time t.
        this.res.io.refresh(); // First, update input.
        this.stepSimulation(dt,t);
        // The following will run with a simulated world at time t
        this.updateLogic(t);
        // Send new data for rendering
        for (const stream of this.streams) {
            stream.sync(this.res.gl);
        }
        this.updateAudio(dt,t); // Play audio before render for latency reasons
        // The following will run with consistent logic.
        this.render(this.res.gl,this.env);
    }
    register(sprite) {
        this.sprites.add(sprite);
    }
    unregister(sprite) {
        this.sprites.delete(sprite);
    }
    // Override to advance physics simulation
    stepSimulation(dt,t) {
        for (const sprite of this.sprites) {
            if (!sprite.sleeping) sprite.step(dt,t);
        }
    }
    // Override to advance post-physics logic
    updateLogic(t) {
        for (const sprite of this.sprites) {
            sprite.update(t);
        }
        for (const sprite of this.sprites) {
            if (!sprite.sleeping) sprite.sync();
        }
    }
    // Override to update audio control stuff
    updateAudio(dt,t) {}
}
