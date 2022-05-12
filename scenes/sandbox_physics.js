import {defs, tiny} from '../classes/common.js';

const {  // load common classes to the current scope
  Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene,
} = tiny;

const GRAVITY = vec3(0.0, -9.81, 0.0);
const DAMPEN = 0.70;
const ERROR = 0.0001;


class Object {
  constructor(shape, material, position=null, velocity=null, acceleration=null) {
    this.shape = shape;
    this.material = material;
    this.transform = Mat4.identity();

    this.position = position? position : vec3(0.0, 0.0, 0.0);
    this.velocity = velocity? velocity : vec3(0.0, 0.0, 0.0);
    this.acceleration = acceleration? acceleration : GRAVITY;
  }

  draw(context, program_state, update=true,
       delta_time=null, pre_transform=null, post_transform=null) {
    if (update && delta_time < 0.05) {
      this.update(delta_time, pre_transform, post_transform);
    }
    this.shape.draw(context, program_state, this.transform, this.material);
  }

  update(delta_time, pre_transform=null, post_transform=null) {
    this.update_velocity(delta_time);
    this.update_position(delta_time);
    this.update_transform(pre_transform, post_transform);
  }

  update_position(delta_time) {
    this.position = this.position.plus(this.velocity.times(delta_time));
    if (this.position[1] < -5.0) {
      this.velocity[1] = -0.9 * this.velocity[1];
    }
  }

  update_velocity(delta_time) {
    this.velocity = this.velocity.plus(this.acceleration.times(delta_time));
  }

  update_acceleration(acceleration=null) {
    this.acceleration = acceleration? acceleration : GRAVITY;
  }

  update_transform(pre_transform=null, post_transform=null) {
    this.transform = Mat4.identity()
      .times(post_transform? post_transform : Mat4.identity())
      .times(Mat4.translation(...this.position))
      .times(pre_transform? pre_transform : Mat4.identity());
  }
}


export class Sandbox_Physics extends Scene {
  constructor() {
    // constructor(): populate initial values like Shapes and Materials
    super();

    // load shape definitions onto the GPU
    this.shapes = {
      sphere: new defs.Subdivision_Sphere(4),
      cube: new defs.Cube(),
    };

    // load material definitions onto the GPU
    this.materials = {
      normal: new Material(new defs.Phong_Shader(),
        {ambient: 0.2, diffusivity: 0.5, specular: 0.5, color: hex_color("#aaaaaa")}
      ),
    }

    this.objects = [
      new Object(this.shapes.sphere, this.materials.normal, vec3(0.0, 5.0, 0.0)),
    ]

    this.camera_initial_position = Mat4.look_at(vec3(0, 10, 20), vec3(0, 0, 0), vec3(0, 1, 0));
  }

  make_control_panel() {
    // draw scene buttons, setup actions and keyboard shortcuts, monitor live measurements.
    this.key_triggered_button("Here is a button :)", ["Control", "0"], () => null);
    this.new_line();
    this.key_triggered_button("Another button :D", ["Control", "1"], () => null);
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
      Math.PI / 4, context.width / context.height, .1, 1000
    );

    const light_position = vec4(5, 5, 5, 1);  // light source(s) (phong shader takes maximum of 2 sources)
    program_state.lights = [new Light(light_position, color(1.0, 1.0, 1.0, 1.0), 1000)];  // position, color, size

    const time = program_state.animation_time / 1000;
    const delta_time = program_state.animation_delta_time / 1000;

    for (let i = 0; i < this.objects.length; ++i) {
      this.objects[i].draw(context, program_state, true, delta_time);
    }
  }
}