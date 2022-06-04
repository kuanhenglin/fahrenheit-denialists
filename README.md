# UCLA CS 174A Project 

*A `README` file for how to run the code and what to expect.*

## The Fahrenheit Denialists

Yes, that is our team name.

**Jordan Lin:** Physics engine and shadowing <br>
**Joice He:** Modelling and art <br>
**Aidan Cini:** Scene setup

## Running the Code

Clone this repository to your local machine.

For Windows, run/double-click the `host.bat` file in the main directory. For MacOS, run the `host.command` file. Alternatively, execute `python server.py` or `python3 server.py` (should work for both Windows and MacOS). If you are using Linux, you can probably figure this out yourself.

Then, go to `localhost:8000` in your browser and have fun :D

We use `tiny-graphics.js`, which is like `three.js` but worse.

## What to Expect

Our project is a 3D graphics demo of the famous study girl from "[lofi hip hop radio - beats to relax/study to](https://youtu.be/5qap5aO4i9A)." When you start up the scene, you will see the study girl sitting in her chair just vibing to the chill beats. On her desk is a laptop, a notebook, and a study lamp. To her right is a window looking out to the night sky with a purring cat on the windowsill. We hope that our scene with give you the motivation to get though *finals*! Everything seems calm and peaceful until you unpause and unleash the underlying Physics engine that Jordan created.

The following is a list of features of our little demo.

### Toggle Pause (`Ctrl + p`)

Initially the scene is static, meaning that time is completely stopped. Entering `Ctrl + p` will cause time to resume. You should see that the study girl and the table start vibrating, almost like they are vibing to the dope beats. This occurs because small impulses in the Physics engine can quickly snowball into larger impulses, which is a common problem with resting objects in Physics engines that do not dampen tiny motions&mdash;our engine!

### Toggle Bounding Boxes (`Ctrl + b`)

Entering `Ctrl + b` turns on the bounding boxes of the objects, allowing the user to see how the objects interact via collisions. All the bounding boxes are oriented bounding boxes, that is, rectangular prisms of arbitrary size and 3D rotation. It is the most fun to watch the bounding boxes as the objects go flying around after unpausing.

These bounding boxes act as the collision/hit boxes in our Physics engine.

### Toggle Blender (`Ctrl + d`)

Entering `Ctrp + d` spawns a massive rectangular prism that spins around the floor pushing everything in the scene around in the most chaotic way&mdash;we call this a blender. The blender is not for the feint of heart; if you care about the study girl’s safety then please **DO NOT USE**.

### Shoot Object (`Ctrl + e`)

Entering `Ctrl + e` spawns ellipsoidal objects into the scene at roughly random positions and velocities (but all generally pointed towards the girl). When paused, this is not too exciting as the objects just stay static in the scene, but unpause and you can watch all the new objects fly around the scene.

### Angular Velocity and Impulse (On `Ctrl + 6`, Off `Ctrl + 7`)

When angular velocity and impulse is enabled with `Ctrl + 6`, the Physics engine enables angular collision resolution and collisions now affect the rotation and angular velocity of objects. Now, this is not particularly stable, because gravity currently only works on the center-of-mass of objects/object groups instead of all parts of the object. Something something snowballing, and chaos ensues.

When angular velocity and impulse is disabled with `Ctrl + 7`, the Physics engine disables angular collision resolution. This is the *default* of our demo and is a bit more stable, though still not terribly stable. Stay paused if you want peace, though that is not at all the objective of this demo.

### Initialize Scene (`Ctrl + i`)

Entering `Ctrl + i` reinitializes the scene to its original state, which is useful for clearing objects. If the scene and Physics engine crashes (mostly due to spawning too many objects), the initialize scene button will not work, and you will need to refresh the webpage.

### Ungroup objects (`Ctrl + u`)

Do you want to see the study girl break into pieces? If so, this is the feature for you. Since the study girl is a very complicated object to model with complex collision boxes, we modeled her body by breaking it into many different simpler shapes. This button ungroups the individual components of grouped objects (e.g., study girl, desk, chair, etc.) and allows them to move and collide freely.

### Gravity

You can change gravity to any one of the coordinate axes. Simply click the button that displays the direction you want gravity to go and it will follow. `none` causes the objects to float about, `+x` makes the objects fly backward, `-x` pushes the objects toward the brick wall, `+y` makes the objects fly to the ceiling, `-y` is normal gravity pushing objects to the floor, `+z` makes the objects come toward the camera, and `-z` makes the objects fly towards the window wall.

### Movement

As per a feature which comes with `tiny-graphics.js`, you can move around the scene with `w`, `a`, `s` and `d`; you can also move up with `Space` and move down with `z`.

Have fun exploring our demo!

**The Fahrenheit Denialists** <br>
3 June 2022