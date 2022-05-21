import {defs, tiny} from "../classes/common.js";
import {Object, collision, update_gravity, GRAVITY_MULTIPLIER} from "../classes/physics.js";
import {Model} from "../classes/shapes.js";


const {  // load common classes to the current scope
  Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene,
  Texture, Textured_Phong
} = tiny;


function array_random(minimum, maximum, length=3) {
  if (typeof(minimum) === "number") {
    return Array.from(Array(length)).map((_, i) => (Math.random() * (maximum - minimum)) + minimum);
  }
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
      miku: new Model("../assets/miku.obj"),
      desk: new Model("../assets/desk.obj"),
    };

    // load material definitions onto the GPU
    this.materials = {
      normal: new Material(new defs.Phong_Shader(),
        {ambient: 0.2, diffusivity: 0.8, specular: 0.5}  // default color
      ),
      brick_wall: new Material(new defs.Textured_Phong(),
        {ambient: 0.8, diffusivity: 0.1, specular: 0.1, texture: new Texture("../assets/brick_wall.png")}
      ),
      blender: new Material(new defs.Textured_Phong(),
        {ambient: 1.0, diffusivity: 0.5, specular: 0.3, texture: new Texture("../assets/blender.png")}
      ),
      work_in_progress: new Material(new defs.Textured_Phong(),
        {ambient: 0.7, diffusivity: 0.2, specular: 0.3, texture: new Texture("../assets/work_in_progress.png")}
      ),
    }

    this.walls = [];
    this.box = {scale: vec3(30.0, 20.0, 30.0), thickness: vec3(2.0, 2.0, 2.0)};

    this.objects = [];
    this.initialize_scene();

    this.camera_initial_position = Mat4.look_at(vec3(45, 25, 90), vec3(-5.5, -10.0, 0), vec3(0, 1, 0));

    this.bounding = false;

    this.pause = false;
    this.time_elapsed = 0.0;

    this.blender = false;
  }

  make_control_panel() {
    // draw scene buttons, setup actions and keyboard shortcuts, monitor live measurements.
    this.live_string(
      box => box.textContent = "Time elapsed: " + this.time_elapsed.toFixed(2) + "s"
    );
    this.new_line();
    this.key_triggered_button("Toggle pause", ["Control", "p"], () => this.pause = !this.pause);
    this.new_line();
    this.key_triggered_button("Toggle bounding boxes", ["Control", "b"], () => this.bounding = !this.bounding);
    this.new_line();
    this.key_triggered_button("Toggle blender", ["Control", "d"], () => this.toggle_blender());
    this.new_line();
    this.key_triggered_button("Initialize scene", ["Control", "i"], () => this.initialize_scene());
    this.new_line();
    this.live_string(box => box.textContent = "Gravity: ");
    this.key_triggered_button(
      "none", [], () => update_gravity(vec3(0.0, 0.0, 0.0).times(GRAVITY_MULTIPLIER), this.objects)
    );
    this.key_triggered_button(
      "+x", [], () => update_gravity(vec3(9.81, 0.0, 0.0).times(GRAVITY_MULTIPLIER), this.objects)
    );
    this.key_triggered_button(
      "-x", [], () => update_gravity(vec3(-9.81, 0.0, 0.0).times(GRAVITY_MULTIPLIER), this.objects)
    );
    this.key_triggered_button(
      "+y", [], () => update_gravity(vec3(0.0, 9.81, 0.0).times(GRAVITY_MULTIPLIER), this.objects)
    );
    this.key_triggered_button(
      "-y", [], () => update_gravity(vec3(0.0, -9.81, 0.0).times(GRAVITY_MULTIPLIER), this.objects)
    );
    this.key_triggered_button(
      "+z", [], () => update_gravity(vec3(0.0, 0.0, 9.81).times(GRAVITY_MULTIPLIER), this.objects)
    );
    this.key_triggered_button(
      "-z", [], () => update_gravity(vec3(0.0, 0.0, -9.81).times(GRAVITY_MULTIPLIER), this.objects)
    );
  }

  initialize_scene() {
    if (this.blender) {
      this.toggle_blender();
    }
    this.objects = [];
    this.initialize_objects(30);
    this.initialize_walls(this.box.scale, this.box.thickness, true);
    this.time_elapsed = 0;
  }

  initialize_objects(number_of_objects) {
    let shape_list = [this.shapes.cube, this.shapes.sphere, this.shapes.teapot, this.shapes.miku, this.shapes.desk];
    let position_range = this.box.scale.minus(vec3(5.0, 5.0, 5.0));
    for (let i = 0; i < number_of_objects; i += shape_list.length) {
      for (let j = 0; j < shape_list.length; ++j) {
        let scale = vec3(...array_random(1.0, 4.0));
        if (j === 4) {
          scale = scale.times(2.0);
        }
        this.objects.push(
          new Object({
            shape: shape_list[j], material: j === 0? this.materials.brick_wall : this.materials.normal,
            position: vec3(...array_random(position_range.times(-1.0), position_range)),
            velocity: vec3(...array_random(-20.0, 20.0)),
            rotation: vec3(...array_random(position_range.times(-1.0), position_range)),
            scale: scale, mass: scale.reduce((sum, x) => sum * x) ** 0.5,
            bounding_scale: j === 0? undefined : vec3(0.9, 0.9, 0.9),
            color: color(...array_random(0.0, j === 0? 0.3 : 1.0), 1.0),
          }),
        );
      }
    }
  }

  initialize_walls(scale, thickness, add_to_objects=true) {
    let offset = scale.plus(thickness);
    let color = hex_color("#000000");
    let material = this.materials.work_in_progress;

    this.walls = [
      // floor
      new Object({
        shape: this.shapes.cube, material: material, mass: -1.0,
        position: vec3(0.0, -offset[1], 0.0), scale: vec3(scale[0], thickness[1], scale[2]),
        // rotation: vec3(0.0, 0.0, Math.PI / 8),
        gravity: vec3(0.0, 0.0, 0.0), wall: true, color: color,
      }),
      // ceiling
      new Object({
        shape: this.shapes.cube, material: material, draw: false, mass: -1.0,
        position: vec3(0.0, offset[1], 0.0), scale: vec3(scale[0], thickness[1], scale[2]),
        gravity: vec3(0.0, 0.0, 0.0), wall: true, color: color,
      }),
      // left
      new Object({
        shape: this.shapes.cube, material: material, mass: -1.0,
        position: vec3(-offset[0], 0.0, 0.0), scale: vec3(thickness[0], scale[1], scale[2]),
        gravity: vec3(0.0, 0.0, 0.0), wall: true, color: color,
      }),
      // right
      new Object({
        shape: this.shapes.cube, material: material, draw: false, mass: -1.0,
        position: vec3(offset[0], 0.0, 0.0), scale: vec3(thickness[0], scale[1], scale[2]),
        gravity: vec3(0.0, 0.0, 0.0), wall: true, color: color,
      }),
      // back
      new Object({
        shape: this.shapes.cube, material: material, mass: -1.0,
        position: vec3(0.0, 0.0, -offset[2]), scale: vec3(scale[0], scale[1], thickness[2]),
        gravity: vec3(0.0, 0.0, 0.0), wall: true, color: color,
      }),
      // front
      new Object({
        shape: this.shapes.cube, material: material, draw: false, mass: -1.0,
        position: vec3(0.0, 0.0, offset[2]), scale: vec3(scale[0], scale[1], thickness[2]),
        gravity: vec3(0.0, 0.0, 0.0), wall: true, color: color,
      }),
    ]

    if (add_to_objects) {
      this.objects = this.objects.concat(this.walls);
    }
  }

  toggle_blender() {
    if (this.blender) {
      this.objects.pop();
      this.blender = false;
    } else {
      this.objects.push(new Object({
        shape: this.shapes.cube, material: this.materials.blender, mass: -1.0,
        position: vec3(0.0, -10.0, 0.0), rotation_velocity: vec3(0.0, Math.PI / 2, 0.0),
        scale: vec3(40.0, 10.0, this.box.thickness[0]),
        gravity: vec3(0.0, 0.0, 0.0), wall: true, color: hex_color("000000"),
      }));
      this.blender = true;
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
    program_state.lights = [new Light(light_position, hex_color("#ffffff"), 10000)];  // position, color, size

    collision(this.objects);  // collision detection and resolution

    for (let i = 0; i < this.objects.length; ++i) {
      // this.objects[i].rotation_velocity = vec3(i + 1, i + 1, i + 1).times(0.25);  // random rotation for fun
      this.objects[i].draw_object({
        context: context, program_state: program_state,
        delta_time: delta_time, draw_bounding: this.bounding
      });
    }
  }
}