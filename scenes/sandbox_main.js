import {defs, tiny} from '../classes/common.js';

const {  // load common classes to the current scope
  Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene,
} = tiny;

export class Sandbox_Main extends Scene {
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
      matte: new Material(new defs.Phong_Shader(),
        {ambient: 0.2, diffusivity: 0.5, specular: 0.5, color: hex_color("#aaaaaa")}
      ),
    }

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
    program_state.lights = [new Light(light_position, color(1, 1, 1, 1), 1000)];  // position, color, size

    const time = program_state.animation_time / 1000;

    let identity_transform = Mat4.identity();  // cube example
    this.shapes.sphere.draw(context, program_state, identity_transform, this.materials.matte);
  }
}

