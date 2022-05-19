import {defs, tiny} from "../classes/common.js";
import {Object, collision} from "../classes/physics.js";
import {Model} from "../classes/shapes.js";


const {  // load common classes to the current scope
  Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene,
} = tiny;


function array_random(minimum, maximum, length) {
  return Array.from(Array(length)).map((_, i) => (Math.random() * (maximum[i] - minimum[i])) + minimum[i]);
}


export class Sandbox_Physics extends Scene {
  constructor() {
    // constructor(): populate initial values like Shapes and Materials
    super();

    // load shape definitions onto the GPU
    this.shapes = {
      sphere: new defs.Subdivision_Sphere(4),
      cube: new defs.Cube(),
      teapot: new Model("../assets/teapot.obj"),
    };

    // load material definitions onto the GPU
    this.materials = {
      normal: new Material(new defs.Phong_Shader(),
        {ambient: 0.2, diffusivity: 0.8, specular: 0.3}  // default color
      ),
    }

    this.walls = [];
    this.box = {scale: vec3(15.0, 10.0, 15.0), thickness: vec3(0.5, 0.5, 0.5)};

    this.objects = [
      new Object({
        shape: this.shapes.teapot, material: this.materials.normal,
        position: vec3(...array_random(this.box.scale.times(-0.75), this.box.scale.times(0.75), 3)),
        velocity: vec3(...array_random(vec3(-10.0, -10.0, -10.0), vec3(10.0, 10.0, 10.0), 3)),
        scale: vec3(1.5, 1.5, 1.5), rotation: vec3(-Math.PI / 2, 0.0, 0.0),
        bounding_scale: vec3(0.9, 0.9, 0.9),
        color: hex_color("#88ee77"),
      }),
      new Object({
        shape: this.shapes.cube, material: this.materials.normal, mass: 5.0,
        position: vec3(...array_random(this.box.scale.times(-0.75), this.box.scale.times(0.75), 3)),
        velocity: vec3(...array_random(vec3(-10.0, -10.0, -10.0), vec3(10.0, 10.0, 10.0), 3)),
        scale: vec3(3.0, 2.0, 1.0), rotation: vec3(0.0, Math.PI / 6, 0.0),
        color: hex_color("#88aaee"),
      }),
      new Object({
        shape: this.shapes.sphere, material: this.materials.normal, mass: 2.0,
        position: vec3(...array_random(this.box.scale.times(-0.75), this.box.scale.times(0.75), 3)),
        velocity: vec3(...array_random(vec3(-10.0, -10.0, -10.0), vec3(10.0, 10.0, 10.0), 3)),
        scale: vec3(1.0, 3.0, 2.0), rotation: vec3(Math.PI / 2, 0.0, Math.PI / 2),
        bounding_scale: vec3(0.95, 0.95, 0.95),
        color: hex_color("#ee7755"),
      }),
      new Object({
        shape: this.shapes.cube, material: this.materials.normal, mass: -1.0,
        position: vec3(0.0, -5.0, 0.0), scale: vec3(20.0, 5.0, 0.5), rotation_velocity: vec3(0.0, 1.0, 0.0),
        bounding_scale: vec3(0.95, 0.95, 0.95),
        gravity: vec3(0.0, 0.0, 0.0), wall: true, color: hex_color("cccccc"),
      }),
    ]

    this.initialize_walls(this.box.scale, this.box.thickness, true);

    this.camera_initial_position = Mat4.look_at(vec3(20, 15, 50), vec3(-2.5, -5.0, 0), vec3(0, 1, 0));

    this.bounding = false;

    this.pause = false;
    this.time_elapsed = 0.0;
  }

  make_control_panel() {
    // draw scene buttons, setup actions and keyboard shortcuts, monitor live measurements.
    this.live_string(
      box => box.textContent = "Time elapsed: " + this.time_elapsed.toFixed(2) + "s"
    );
    this.new_line();
    this.key_triggered_button(
      "Toggle pause", ["p"],
      () => this.pause = !this.pause
    );
    this.new_line();
    this.key_triggered_button(
      "Toggle bounding boxes", ["b"],
      () => this.bounding = !this.bounding
    );
  }

  initialize_walls(scale, thickness, add_to_objects=true) {
    let offset = scale.plus(thickness);
    let color = hex_color("#cccccc");

    this.walls = [
      // floor
      new Object({
        shape: this.shapes.cube, material: this.materials.normal, mass: -1.0,
        position: vec3(0.0, -offset[1], 0.0), scale: vec3(scale[0], thickness[1], scale[2]),
        gravity: vec3(0.0, 0.0, 0.0), wall: true, color: color,
      }),
      // ceiling
      new Object({
        shape: this.shapes.cube, material: this.materials.normal, draw: false, mass: -1.0,
        position: vec3(0.0, offset[1], 0.0), scale: vec3(scale[0], thickness[1], scale[2]),
        gravity: vec3(0.0, 0.0, 0.0), wall: true, color: color,
      }),
      // left
      new Object({
        shape: this.shapes.cube, material: this.materials.normal, mass: -1.0,
        position: vec3(-offset[0], 0.0, 0.0), scale: vec3(thickness[0], scale[1], scale[2]),
        gravity: vec3(0.0, 0.0, 0.0), wall: true, color: color,
      }),
      // right
      new Object({
        shape: this.shapes.cube, material: this.materials.normal, draw: false, mass: -1.0,
        position: vec3(offset[0], 0.0, 0.0), scale: vec3(thickness[0], scale[1], scale[2]),
        gravity: vec3(0.0, 0.0, 0.0), wall: true, color: color,
      }),
      // back
      new Object({
        shape: this.shapes.cube, material: this.materials.normal, mass: -1.0,
        position: vec3(0.0, 0.0, -offset[2]), scale: vec3(scale[0], scale[1], thickness[2]),
        gravity: vec3(0.0, 0.0, 0.0), wall: true, color: color,
      }),
      // front
      new Object({
        shape: this.shapes.cube, material: this.materials.normal, draw: false, mass: -1.0,
        position: vec3(0.0, 0.0, offset[2]), scale: vec3(scale[0], scale[1], thickness[2]),
        gravity: vec3(0.0, 0.0, 0.0), wall: true, color: color,
      }),
    ]

    if (add_to_objects) {
      this.objects = this.objects.concat(this.walls);
    }
  }

  display(context, program_state) {
    // display():  called once per frame of animation
    // set up the overall camera matrix, projection matrix, and lights
    if (!context.scratchpad.controls) {
      this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
      // define global camera and projection matrices, stored in program_state
      program_state.set_camera(this.camera_initial_position);
    }

    program_state.projection_transform = Mat4.perspective(  // perspective projection
      Math.PI / 4, context.width / context.height, 0.1, 1000
    );

    const time = program_state.animation_time / 1000;
    const delta_time = this.pause? 0.0 : program_state.animation_delta_time / 1000;
    this.time_elapsed += delta_time;

    // light source(s) (phong shader takes maximum of 2 sources)
    const light_position = vec4(-0.75 * this.box.scale[0], 0.75 * this.box.scale[1], 0.75 * this.box.scale[2], 1.0);
    program_state.lights = [new Light(light_position, hex_color("#ffffff"), 1000)];  // position, color, size

    collision(this.objects);  // collision detection (no resolution yet)

    for (let i = 0; i < this.objects.length; ++i) {
      // this.objects[i].rotation_velocity = vec3(i + 1, i + 1, i + 1).times(0.25);  // random rotation for fun
      this.objects[i].draw_object({
        context: context, program_state: program_state,
        delta_time: delta_time, draw_bounding: this.bounding
      });
    }
  }
}