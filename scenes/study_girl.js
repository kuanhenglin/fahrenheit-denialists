import {defs, tiny} from "../classes/common.js";
import {Thing, collision, update_gravity, initialize_rotation_center, GRAVITY_MULTIPLIER} from "../classes/physics.js";
import {
  Color_Phong_Shader,
  Shadow_Textured_Phong_Shader,
  Buffered_Texture,
  LIGHT_DEPTH_TEX_SIZE
} from "../classes/shaders.js";
import {Model} from "../classes/shapes.js";


let DELTA_MULTIPLIER = 0.5;


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


function get_mass(scale) {
  return scale.reduce((sum, x) => sum * x) ** 0.5;
}


export class Study_Girl extends Scene {
  constructor() {
    // constructor(): populate initial values like Shapes and Materials
    super();

    // load shape definitions onto the GPU
    this.shapes = {
      sphere: new defs.Subdivision_Sphere(4),
      cube: new defs.Cube(),
      teapot: new Model("../assets/teapot.obj"),
      desk: new Model("../assets/desk.obj"),
      lamp: new Model("../assets/lamp.obj"),
      notebook: new Model("../assets/notebook.obj"),
      computer: new Model("../assets/laptop.obj"),
      book_case: new Model("../assets/bookcase.obj"),
      // desk
      desk_top: new Model("../assets/desk_top.obj"),
      desk_leg_left_front: new Model("../assets/desk_leg_left_front.obj"),
      desk_leg_left_back: new Model("../assets/desk_leg_left_back.obj"),
      desk_leg_right_front: new Model("../assets/desk_leg_right_front.obj"),
      desk_leg_right_back: new Model("../assets/desk_leg_right_back.obj"),
      // study girl :D
      sg_hair: new Model("../assets/sg_hair.obj"),
      sg_head: new Model("../assets/sg_head.obj"),
      sg_eyes: new Model("../assets/sg_eyes.obj"),
      sg_torso: new Model("../assets/sg_torso.obj"),
      sg_forearms: new Model("../assets/sg_forearms.obj"),
      sg_hands: new Model("../assets/sg_hands.obj"),
      sg_skirt: new Model("../assets/sg_skirt.obj"),
      sg_legs_top: new Model("../assets/sg_legs_top.obj"),
      sg_legs_bottom: new Model("../assets/sg_legs_bottom.obj"),
    };

    // load material definitions onto the GPU
    this.materials = {
      normal: new Material(new Shadow_Textured_Phong_Shader(1),
        {ambient: 0.1, diffusivity: 0.8, specularity: 0.5, color_texture: null, light_depth_texture: null}
      ),
      shiny: new Material(new Shadow_Textured_Phong_Shader(1),
        {ambient: 0.05, diffusivity: 0.3, specularity: 1.0, color_texture: null, light_depth_texture: null}
      ),
      floor: new Material(new Shadow_Textured_Phong_Shader(1), {
        ambient: 0.5, diffusivity: 0.5, specularity: 0.3,
        color_texture: new Texture("../assets/floor.png"), light_depth_texture: null
      }),
      wall: new Material(new Shadow_Textured_Phong_Shader(1), {
        ambient: 0.5, diffusivity: 0.5, specularity: 0.3,
        color_texture: new Texture("../assets/wall.png"), light_depth_texture: null
      }),
      window: new Material(new Shadow_Textured_Phong_Shader(1), {
        ambient: 0.5, diffusivity: 0.5, specularity: 0.3,
        color_texture: new Texture("../assets/window.png"), light_depth_texture: null
      }),
      work_in_progress: new Material(new Shadow_Textured_Phong_Shader(1), {
        ambient: 0.6, diffusivity: 0.5, specularity: 0.3,
        color_texture: new Texture("../assets/work_in_progress.png"), light_depth_texture: null
      }),
      light_source: new Material(new defs.Phong_Shader(),
        {color: hex_color("#ffffff"), ambient: 1.0, diffusivity: 0.0, specularity: 0.0}
      ),
    }

    this.walls = [];
    this.box = {scale: vec3(30.0, 18.0, 30.0), thickness: vec3(2.0, 2.0, 2.0)};

    this.objects = [];
    this.initialize_scene();

    this.camera_initial_position = Mat4.look_at(vec3(25, 12.5, 50), vec3(-5.0, -5.0, 0), vec3(0, 1, 0));
    // this.camera_initial_position = Mat4.look_at(vec3(7.5, 2.5, 15.0), vec3(-1.0, 0, 0), vec3(0, 1, 0));

    this.bounding = false;

    this.pause = true;
    this.time_elapsed = 0.0;

    this.blender = false;

    this.light_position = vec4(-0.75 * this.box.scale[0], 0.75 * this.box.scale[1], 0.75 * this.box.scale[2], 1.0);
    this.light_color = hex_color("#ffdd55");

    this.init_ok = false;
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
    this.key_triggered_button("Ungroup objects", ["Control", "u"], () => this.ungroup_objects());
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
    this.initialize_walls(this.box.scale, this.box.thickness, true);
    this.initialize_objects();
    initialize_rotation_center(this.objects);
    this.time_elapsed = 0;
  }

  initialize_objects() {
    this.objects = this.objects.concat([
      [
        new Thing({shape: this.shapes.lamp, material: this.materials.shiny,
          position: vec3(-22.0, 1.5, -16.0),
          rotation_model: vec3(0.0, -2 * Math.PI / 3, 0.0),
          scale: vec3(1.5, 1.5, 1.5), mass: 0.75,
          color: hex_color("#dd8822"),
        })
      ],
      this.study_girl({
        position: vec3(5.0, 5.0, -5.0),
        scale: vec3(1.5, 1.5, 1.5),
        rotation: vec3(0.0, -Math.PI / 2, 0.0)
      }),
      this.desk({
        position: vec3(-21.0, -9.5, -5.0), scale: vec3(1.5, 1.2, 1.5), rotation: vec3(0.0, Math.PI / 2, 0.0),
        color: hex_color("#a85f22"),
      }),
      this.desk({
        position: vec3(-9.0, -13.0, -5.0), scale: vec3(0.5, 0.7, 0.8), rotation: vec3(0.0, Math.PI / 2, 0.0),
        color: hex_color("#555555"),
      }),
      [
        new Thing({shape: this.shapes.book_case, material: this.materials.normal,
          position: vec3(16.0, -2.3, -27.0),
          scale: vec3(8.0, 9.5, 10.0), mass: 200.0,
          color: hex_color("#a85f22"), do_rotation: false
        })
      ],
      [
        new Thing({shape: this.shapes.computer, material: this.materials.shiny,
          position: vec3(-23.0, -3.0, -6.0),
          rotation_model: vec3(0.0, Math.PI / 2, 0.0),
          scale: vec3(2.5, 2.5, 2.5), mass: 1.5,
          color: hex_color("#eeeeee"),
        })
      ],
      [
        new Thing({shape: this.shapes.notebook, material: this.materials.normal,
          position: vec3(-20.0, -3.0, 2.0),
          rotation_model: vec3(0.0, -Math.PI / 6, 0.0),
          scale: vec3(1.0, 1.0, 1.0), mass: 5.0,
          color: color(...array_random(0.0, 1.0), 1.0),
        })
      ],
    ]);
  }

  initialize_walls(scale, thickness, add_to_objects=true) {
    let offset = scale.plus(thickness);
    let color = hex_color("#303030");
    let material = this.materials.normal;

    this.walls = [
      // floor
      new Thing({
        shape: this.shapes.cube, material: this.materials.floor, mass: -1.0,
        position: vec3(0.0, -offset[1], 0.0), scale: vec3(scale[0], thickness[1], scale[2]),
        gravity: vec3(0.0, 0.0, 0.0), wall: true, color: color,
      }),
      // ceiling
      new Thing({
        shape: this.shapes.cube, material: material, draw: false, mass: -1.0,
        position: vec3(0.0, offset[1], 0.0), scale: vec3(scale[0], thickness[1], scale[2]),
        gravity: vec3(0.0, 0.0, 0.0), wall: true, color: color,
      }),
      // left
      new Thing({
        shape: this.shapes.cube, material: this.materials.wall, mass: -1.0,
        position: vec3(-offset[0], 0.0, 0.0), scale: vec3(thickness[0], scale[1], scale[2]),
        gravity: vec3(0.0, 0.0, 0.0), wall: true, color: color,
      }),
      // right
      new Thing({
        shape: this.shapes.cube, material: material, draw: false, mass: -1.0,
        position: vec3(offset[0], 0.0, 0.0), scale: vec3(thickness[0], scale[1], scale[2]),
        gravity: vec3(0.0, 0.0, 0.0), wall: true, color: color,
      }),
      // back
      new Thing({
        shape: this.shapes.cube, material: this.materials.window, mass: -1.0,
        position: vec3(0.0, 0.0, -offset[2]), scale: vec3(scale[0], scale[1], thickness[2]),
        gravity: vec3(0.0, 0.0, 0.0), wall: true, color: color,
      }),
      // front
      new Thing({
        shape: this.shapes.cube, material: material, draw: false, mass: -1.0,
        position: vec3(0.0, 0.0, offset[2]), scale: vec3(scale[0], scale[1], thickness[2]),
        gravity: vec3(0.0, 0.0, 0.0), wall: true, color: color,
      }),
    ]

    if (add_to_objects) {
      this.objects.push(this.walls);
    }
  }

  study_girl({position=vec3(0.0, 0.0, 0.0), scale=vec3(1.0, 1.0, 1.0), rotation=vec3(0.0, 0.0, 0.0)}) {
    let scale_matrix = Mat4.scale(...scale);
    let position_matrix = Mat4.translation(...position).times(scale_matrix);
    return [
      new Thing({
        shape: this.shapes.sg_hair, material: this.materials.normal,
        scale: scale_matrix.times(vec3(0.85, 0.85, 0.85).to4(0.0)).to3(),
        position: position_matrix.times(vec3(0.0, 2.5, -0.2).to4(1.0)).to3(),
        rotation: rotation, mass: 0.5, color: hex_color("#91311d"),
      }),
      new Thing({
        shape: this.shapes.sg_head, material: this.materials.normal,
        scale: scale_matrix.times(vec3(0.55, 0.55, 0.55).to4(0.0)).to3(),
        position: position_matrix.times(vec3(0.0, 1.85, 0.0).to4(1.0)).to3(),
        rotation: rotation, mass: 7.5, color: hex_color("#ffe5c5"),
      }),
      new Thing({
        shape: this.shapes.sg_eyes, material: this.materials.normal,
        scale: scale_matrix.times(vec3(0.38, 0.38, 0.38).to4(0.0)).to3(),
        position: position_matrix.times(vec3(0.0, 2.1, 0.4).to4(1.0)).to3(),
        rotation: rotation, mass: 0.5, color: hex_color("#1d1d1d"),
      }),
      new Thing({
        shape: this.shapes.sg_torso, material: this.materials.normal,
        scale: scale,
        position: position_matrix.times(vec3(0.0, 0.0, 0.0).to4(1.0)).to3(),
        rotation: rotation, mass: 20.0, color: hex_color("#196b63"),
      }),
      new Thing({
        shape: this.shapes.sg_hands, material: this.materials.normal,
        scale: scale_matrix.times(vec3(0.65, 0.65, 0.65).to4(0.0)).to3(),
        position: position_matrix.times(vec3(0.0, 1.6, 0.7).to4(1.0)).to3(),
        rotation: rotation, mass: 1.5, color: hex_color("#ffe5c5"),
      }),
      new Thing({
        shape: this.shapes.sg_forearms, material: this.materials.normal,
        scale: scale_matrix.times(vec3(1.25, 1.25, 1.25).to4(0.0)).to3(),
        position: position_matrix.times(vec3(0.0, 0.35, 1.0).to4(1.0)).to3(),
        rotation: rotation, mass: 5.0, color: hex_color("#196b63"),
      }),
      new Thing({
        shape: this.shapes.sg_legs_top, material: this.materials.normal,
        scale: scale_matrix.times(vec3(1.1, 1.1, 1.1).to4(0.0)).to3(),
        position: position_matrix.times(vec3(0.0, -2.85, 2.2).to4(1.0)).to3(),
        rotation: rotation, mass: 25.0, color: hex_color("#1d1d1d"),
      }),
      new Thing({
        shape: this.shapes.sg_legs_bottom, material: this.materials.normal,
        scale: scale_matrix.times(vec3(1.1, 1.1, 1.1).to4(0.0)).to3(),
        position: position_matrix.times(vec3(0.0, -4.54, 3.16).to4(1.0)).to3(),
        rotation: rotation, mass: 25.0, color: hex_color("#1d1d1d"),
      }),
      new Thing({
        shape: this.shapes.sg_skirt, material: this.materials.normal,
        scale: scale,
        position: position_matrix.times(vec3(0.0, -2.1, 0.0).to4(1.0)).to3(),
        rotation: rotation, mass: 0.5, color: hex_color("#d13f24"),
      }),
    ];
  }

  desk({
   position=vec3(0.0, 0.0, 0.0), scale=vec3(1.0, 1.0, 1.0), rotation=vec3(0.0, 0.0, 0.0),
   color=hex_color("#aaaaaa"), do_rotation=false
  }) {
    let scale_matrix = Mat4.scale(...scale);
    let position_matrix = Mat4.translation(...position).times(scale_matrix);
    let offset = [7.0, 3.0];
    let restitution = 0.6;
    return [
      new Thing({
        shape: this.shapes.desk_leg_left_front, material: this.materials.normal,
        scale: scale_matrix.times(vec3(5.0, 5.0, 5.0).to4(0.0)).to3(),
        position: position_matrix.times(vec3(-offset[0], -3.0, offset[1]).to4(1.0)).to3(),
        rotation: rotation, mass: 2.0, color: color, restitution: restitution, do_rotation: do_rotation
      }),
      new Thing({
        shape: this.shapes.desk_leg_left_back, material: this.materials.normal,
        scale: scale_matrix.times(vec3(5.0, 5.0, 5.0).to4(0.0)).to3(),
        position: position_matrix.times(vec3(-offset[0], -3.0, -offset[1] - 2.5).to4(1.0)).to3(),
        rotation: rotation, mass: 2.0, color: color, restitution: restitution, do_rotation: do_rotation
      }),
      new Thing({
        shape: this.shapes.desk_leg_right_front, material: this.materials.normal,
        scale: scale_matrix.times(vec3(5.0, 5.0, 5.0).to4(0.0)).to3(),
        position: position_matrix.times(vec3(offset[0] + 1.0, -3.0, offset[1]).to4(1.0)).to3(),
        rotation: rotation, mass: 2.0, color: color, restitution: restitution, do_rotation: do_rotation
      }),
      new Thing({
        shape: this.shapes.desk_leg_right_back, material: this.materials.normal,
        scale: scale_matrix.times(vec3(5.0, 5.0, 5.0).to4(0.0)).to3(),
        position: position_matrix.times(vec3(offset[0] + 1.0, -3.0, -offset[1] - 2.5).to4(1.0)).to3(),
        rotation: rotation, mass: 2.0, color: color, restitution: restitution, do_rotation: do_rotation
      }),
      new Thing({
        shape: this.shapes.desk_top, material: this.materials.normal,
        scale: scale_matrix.times(vec3(8.0, 8.0, 8.0).to4(0.0)).to3(),
        position: position_matrix.times(vec3(0.0, 4.0, 0.0).to4(1.0)).to3(),
        rotation: rotation, mass: 3.0, color: color, restitution: 0.6, do_rotation: do_rotation
      }),
    ];
  }

  toggle_blender() {
    if (this.blender) {
      this.objects[0].pop();
      this.blender = false;
    } else {
      this.objects[0].push(new Thing({
        shape: this.shapes.cube, material: this.materials.normal, mass: -1.0,
        position: vec3(0.0, -10.0, 0.0), rotation_velocity: vec3(0.0, Math.PI / 4, 0.0),
        scale: vec3(40.0, 10.0, this.box.thickness[0]),
        gravity: vec3(0.0, 0.0, 0.0), wall: true, color: hex_color("#aaaaaa"),
      }));
      this.blender = true;
    }
  }

  ungroup_objects() {
    let objects_ungrouped = [];
    for (let i = 0; i < this.objects.length; ++i) {
      for (let j = 0; j < this.objects[i].length; ++j) {
        objects_ungrouped.push([this.objects[i][j]]);
      }
    }
    this.objects = objects_ungrouped;
  }

  texture_buffer_init(gl) {
    // Depth Texture
    this.lightDepthTexture = gl.createTexture();
    // Bind it to TinyGraphics
    this.light_depth_texture = new Buffered_Texture(this.lightDepthTexture);

    for (let material of Object.keys(this.materials)) {
      if (material !== "light_source") {
        this.materials[material].light_depth_texture = this.light_depth_texture;
      }
    }

    this.lightDepthTextureSize = LIGHT_DEPTH_TEX_SIZE;
    gl.bindTexture(gl.TEXTURE_2D, this.lightDepthTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,      // target
      0,                  // mip level
      gl.DEPTH_COMPONENT, // internal format
      this.lightDepthTextureSize,   // width
      this.lightDepthTextureSize,   // height
      0,                  // border
      gl.DEPTH_COMPONENT, // format
      gl.UNSIGNED_INT,    // type
      null);              // data
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Depth Texture Buffer
    this.lightDepthFramebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.lightDepthFramebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,       // target
      gl.DEPTH_ATTACHMENT,  // attachment point
      gl.TEXTURE_2D,        // texture target
      this.lightDepthTexture,         // texture
      0);                   // mip level
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // create a color texture of the same size as the depth texture
    // see article why this is needed_
    this.unusedTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.unusedTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      this.lightDepthTextureSize,
      this.lightDepthTextureSize,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // attach it to the framebuffer
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,        // target
      gl.COLOR_ATTACHMENT0,  // attachment point
      gl.TEXTURE_2D,         // texture target
      this.unusedTexture,         // texture
      0);                    // mip level
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  render_scene(context, program_state, time, delta_time,
               shadow_pass, draw_light_source=false, draw_shadow=false) {
    program_state.draw_shadow = draw_shadow;

    if (draw_light_source && shadow_pass) {
      this.shapes.sphere.draw(
        context, program_state,
        Mat4.translation(this.light_position[0], this.light_position[1], this.light_position[2])
          .times(Mat4.scale(1.0, 1.0, 1.0)),
        this.materials.light_source.override({color: this.light_color}));
    }

    for (let i = 0; i < this.objects.length; ++i) {
      for (let j = 0; j < this.objects[i].length; ++j) {
        this.objects[i][j].draw_object({
          context: context, program_state: program_state,
          delta_time: delta_time, draw_bounding: this.bounding, shadow_pass: shadow_pass
        });
      }
    }
  }

  display(context, program_state) {
    // display():  called once per frame of animation

    let gl = context.context;
    if (!this.init_ok) {
      const extension = gl.getExtension('WEBGL_depth_texture');
      if (!extension) {
        return alert('need WEBGL_depth_texture');  // eslint-disable-line
      }
      this.texture_buffer_init(gl);
      this.init_ok = true;
    }

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
    const delta_time = this.pause? 0.0 : program_state.animation_delta_time / 1000 * DELTA_MULTIPLIER;
    this.time_elapsed += delta_time;

    let lamp_object = this.objects[1][0];
    this.light_position = (Mat4.rotation(
      lamp_object.rotation.norm(), ...(lamp_object.rotation.norm() === 0.0? [1.0, 0.0, 0.0] : lamp_object.rotation)
    ).times(vec4(1.5, 2.7, 0.7, 0.0))).plus(this.objects[1][0].position.to4(1.0));

    // light source(s) (phong shader takes maximum of 2 sources)
    program_state.lights = [new Light(this.light_position, this.light_color, 10 ** 9)];  // position, color, size

    if (!this.pause) {
      collision(this.objects);  // collision detection and resolution
    }

    // ***** SHADOWING *****

    // This is a rough target of the light.
    // Although the light is point light, we need a target to set the POV of the light
    this.light_view_target = vec4(0.0, 0.0, 0.0, 1.0);
    this.light_field_of_view = 130 * Math.PI / 180; // 130 degrees

    // Step 1: set the perspective and camera to the POV of light
    const light_view_mat = Mat4.look_at(
      vec3(this.light_position[0], this.light_position[1], this.light_position[2]),
      vec3(this.light_view_target[0], this.light_view_target[1], this.light_view_target[2]),
      vec3(0, 1, 0), // assume the light to target will have a up dir of +y
    );
    const light_proj_mat = Mat4.perspective(this.light_field_of_view, 1, 0.5, 500);
    // Bind the Depth Texture Buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.lightDepthFramebuffer);
    gl.viewport(0, 0, this.lightDepthTextureSize, this.lightDepthTextureSize);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // Prepare uniforms
    program_state.light_view_mat = light_view_mat;
    program_state.light_proj_mat = light_proj_mat;
    program_state.light_tex_mat = light_proj_mat;
    program_state.view_mat = light_view_mat;
    program_state.projection_transform = light_proj_mat;
    this.render_scene(context, program_state, time, delta_time, false, false, false);

    // Step 2: unbind, draw to the canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    program_state.view_mat = program_state.camera_inverse;
    program_state.projection_transform = Mat4.perspective(Math.PI / 4, context.width / context.height, 0.5, 500);
    this.render_scene(context, program_state, time, delta_time, true, true, true);
  }
}