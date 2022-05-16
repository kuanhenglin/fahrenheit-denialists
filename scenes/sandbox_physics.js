import {defs, tiny} from "../classes/common.js";
import {Object, collision} from "../classes/physics.js";
import {Model} from "../classes/shapes.js";


const {  // load common classes to the current scope
  Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene,
} = tiny;


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
        {ambient: 0.3, diffusivity: 0.5, specular: 0.5}  // default color
      ),
    }

    this.objects = [
      new Object({
        shape: new Model("../assets/teapot.obj"), material: this.materials.normal,
        position: vec3(0.0, 15.0, -15.0),
        color: hex_color("#88ee77"),
      }),
      new Object({
        shape: this.shapes.cube, material: this.materials.normal,
        position: vec3(-5.0, 5.0, -15.0),
        scale: vec3(3.0, 2.0, 1.0), rotation: vec4(Math.PI / 6, 0.0, 1.0, 0.0),
        color: hex_color("#88aaee"),
      }),
      // new Object({
      //   shape: this.shapes.cube, material: this.materials.normal,
      //   position: vec3(-2.0, 10.0, -15.0),
      //   scale: vec3(1.0, 3.0, 2.0), rotation: vec4(Math.PI / 3, 1.0, 0.0, 1.0),
      //   color: hex_color("#eecc55"),
      // }),
      new Object({
        shape: this.shapes.sphere, material: this.materials.normal,
        position: vec3(-2.0, 10.0, -15.0),
        scale: vec3(1.0, 3.0, 2.0), rotation: vec4(Math.PI / 2, 1.0, 0.0, 1.0),
        color: hex_color("#ee7755"),
      }),
    ]

    this.camera_initial_position = Mat4.look_at(vec3(0, 10, 20), vec3(0, 5, 0), vec3(0, 1, 0));

    this.bounding = true;
  }

  make_control_panel() {
    // draw scene buttons, setup actions and keyboard shortcuts, monitor live measurements.
    this.key_triggered_button(
      "Toggle bounding boxes", ["Control", "0"],
      () => this.bounding = !this.bounding
    );
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
      Math.PI / 4, context.width / context.height, 0.1, 1000
    );

    const time = program_state.animation_time / 1000;
    const delta_time = program_state.animation_delta_time / 1000;

    const light_position = vec4(10, 5, 10, 1);  // light source(s) (phong shader takes maximum of 2 sources)
    program_state.lights = [new Light(light_position, hex_color("#ffffff"), 1000)];  // position, color, size

    collision(this.objects);  // collision detection (no resolution yet)

    for (let i = 0; i < this.objects.length; ++i) {
      this.objects[i].rotation = vec4((i + 1) * time, 1.0, 1.0, 1.0);  // random rotation for fun
      this.objects[i].draw_object({
        context: context, program_state: program_state, delta_time: delta_time, draw_bounding: this.bounding
      });
    }
  }
}