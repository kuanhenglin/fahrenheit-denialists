import {defs, tiny} from "../classes/common.js";
import {Thing, collision, update_gravity, initialize_rotation_center, GRAVITY_MULTIPLIER} from "../classes/physics.js";
import {
  Color_Phong_Shader,
  Shadow_Textured_Phong_Shader,
  Buffered_Texture,
  LIGHT_DEPTH_TEX_SIZE
} from "../classes/shaders.js";
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


function get_mass(scale) {
  return scale.reduce((sum, x) => sum * x) ** 0.5;
}


export class Cake_Physics extends Scene {
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
      lamp: new Model("../assets/lamp.obj"),
      bookcase: new Model("../assets/bookcase.obj"),
      notebook: new Model("../assets/notebook.obj"),
    };

    // load material definitions onto the GPU
    this.materials = {
      normal: new Material(new Shadow_Textured_Phong_Shader(1),
        {ambient: 0.2, diffusivity: 0.8, specularity: 0.5, color_texture: null, light_depth_texture: null}
      ),
      work_in_progress: new Material(new Shadow_Textured_Phong_Shader(1), {
        ambient: 0.5, diffusivity: 0.5, specularity: 0.5,
        color_texture: new Texture("../assets/work_in_progress.png"), light_depth_texture: null
      }),
      light_source: new Material(new defs.Phong_Shader(),
        {color: hex_color("#ffffff"), ambient: 1, diffusivity: 0.0, specularity: 0.0}
      ),
    }

    this.walls = [];
    this.box = {scale: vec3(30.0, 20.0, 30.0), thickness: vec3(2.0, 2.0, 2.0)};

    this.objects = [];
    this.initialize_scene();
    initialize_rotation_center(this.objects);

    this.camera_initial_position = Mat4.look_at(vec3(45, 25, 90), vec3(-5.5, -10.0, 0), vec3(0, 1, 0));

    this.bounding = false;

    this.pause = true;
    this.time_elapsed = 0.0;

    this.blender = false;

    this.light_position = vec4(-0.75 * this.box.scale[0], 0.75 * this.box.scale[1], 0.75 * this.box.scale[2], 1.0);
    this.light_color = hex_color("#ffffff");

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
    this.initialize_objects();
    this.initialize_walls(this.box.scale, this.box.thickness, true);
    this.time_elapsed = 0;
  }

  initialize_objects() {
    this.objects = [
      [
        new Thing({shape: this.shapes.lamp, material: this.materials.normal,
          position: vec3(0,0,0),
          rotation_model: vec3(2.0, 2.0, -4.0),
          scale: vec3(1.0,1.0,1.0), mass: 5.0,
          color: color(...array_random(0.0, 1.0), 1.0),
        })
      ],
      [
        new Thing({shape: this.shapes.notebook, material: this.materials.normal,
          position: vec3(0,0,0),
          rotation_model: vec3(7.0, -4.0, 0.0),
          scale: vec3(1.0,1.0,1.0), mass: 5.0,
          color: color(...array_random(0.0, 1.0), 1.0),
        })
      ],
      [
        new Thing({shape: this.shapes.bookcase, material: this.materials.normal,
          position: vec3(0,0,0),
          rotation_model: vec3(2.0, 4.0, 0.0),
          scale: vec3(1.0,1.0,1.0), mass: 5.0,
          color: color(...array_random(0.0, 1.0), 1.0),
        })
      ],
      [
        new Thing({
          shape: this.shapes.desk,
          material: this.materials.normal,
          position: vec3(-4,10,0),
          rotation_model: vec3(0.0, Math.PI/2, 0.0),
          scale: vec3(1.5,1.5,1.5), mass: 5.0,
          color: color(...array_random(0.0, 1.0), 1.0),
        })
      ],
    ];
  }

  initialize_walls(scale, thickness, add_to_objects=true) {
    let offset = scale.plus(thickness);
    let color = hex_color("#808080");
    let material = this.materials.work_in_progress;

    this.walls = [
      // floor
      new Thing({
        shape: this.shapes.cube, material: material, mass: -1.0,
        position: vec3(0.0, -offset[1], 0.0), scale: vec3(scale[0], thickness[1], scale[2]),
        // rotation: vec3(0.0, 0.0, Math.PI / 8),
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
        shape: this.shapes.cube, material: material, mass: -1.0,
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
        shape: this.shapes.cube, material: material, mass: -1.0,
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

  toggle_blender() {
    if (this.blender) {
      this.objects.pop();
      this.blender = false;
    } else {
      this.objects.push(new Object({
        shape: this.shapes.cube, material: this.materials.normal, mass: -1.0,
        position: vec3(0.0, -10.0, 0.0), rotation_velocity: vec3(0.0, Math.PI / 2, 0.0),
        scale: vec3(40.0, 10.0, this.box.thickness[0]),
        gravity: vec3(0.0, 0.0, 0.0), wall: true, color: hex_color("000000"),
      }));
      this.blender = true;
    }
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
          .times(Mat4.scale(3, 3, 3)),
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
    const delta_time = this.pause? 0.0 : program_state.animation_delta_time / 1000;
    this.time_elapsed += delta_time;

    // light source(s) (phong shader takes maximum of 2 sources)
    program_state.lights = [new Light(this.light_position, this.light_color, 10000)];  // position, color, size

    if (!this.pause) {
      collision(this.objects);  // collision detection and resolution
    }

    // ***** SHADOWING *****

    // This is a rough target of the light.
    // Although the light is point light, we need a target to set the POV of the light
    this.light_view_target = vec4(0, 0, 0, 1);
    this.light_field_of_view = 130 * Math.PI / 180; // 130 degree

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


export class Cake_Physics_Backup extends Scene {
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
      lamp: new Model("../assets/lamp.obj"),
      bookcase: new Model("../assets/bookcase.obj"),
      notebook: new Model("../assets/notebook.obj")
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
    this.box = {scale: vec3(5.0, 3.0, 5.0), thickness: vec3(0.2, 0.2, 0.2)};

    this.objects = [];
    this.initialize_scene();
    initialize_rotation_center(this.objects);

    this.camera_initial_position = Mat4.look_at(vec3(5.0, 2.5, 15.0), vec3(-1.0, -1.5, 0), vec3(0, 1, 0));

    this.bounding = false;

    this.pause = true;
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
    this.initialize_objects();
    //this.initialize_objects_many();
    this.initialize_walls(this.box.scale, this.box.thickness, true);
    this.time_elapsed = 0;
  }

  initialize_objects() {
    let scales = [vec3(5.0, 3.0, 2.0), vec3(2.0, 10.0, 3.5), vec3(5.0, 2.0, 3.0), vec3(4.0, 8.0, 3.5)];
    this.objects = [
      [
        new Thing({shape: this.shapes.lamp, material: this.materials.normal,
          position: vec3(0,0,0),
          rotation_model: vec3(2.0, 2.0, -4.0),
          scale: vec3(1.0,1.0,1.0), mass: 5.0,
          color: color(...array_random(0.0, 1.0), 1.0),
        })
      ],
      [
        new Thing({shape: this.shapes.notebook, material: this.materials.normal,
          position: vec3(0,0,0),
          rotation_model: vec3(7.0, -4.0, 0.0),
          scale: vec3(1.0,1.0,1.0), mass: 5.0,
          color: color(...array_random(0.0, 1.0), 1.0),
        })
      ],
      [
        new Thing({shape: this.shapes.bookcase, material: this.materials.normal,
          position: vec3(0,0,0),
          rotation_model: vec3(2.0, 4.0, 0.0),
          scale: vec3(1.0,1.0,1.0), mass: 5.0,
          color: color(...array_random(0.0, 1.0), 1.0),
        })
      ],
      [
        new Thing({
          shape: this.shapes.desk,
          material: this.materials.normal,
          position: vec3(-4,10,0),
          rotation_model: vec3(0.0, Math.PI/2, 0.0),
          scale: vec3(1.5,1.5,1.5), mass: 5.0,
          color: color(...array_random(0.0, 1.0), 1.0),
        })
      ],
    ];
  }

  initialize_objects_many(number_of_objects) {
    let shape_list = [this.shapes.cube, this.shapes.sphere, this.shapes.teapot, this.shapes.miku, this.shapes.desk];
    let position_range = this.box.scale.minus(vec3(5.0, 5.0, 5.0));
    for (let i = 0; i < number_of_objects; i += shape_list.length) {
      for (let j = 0; j < shape_list.length; ++j) {
        let scale = vec3(...array_random(1.0, 4.0));
        if (j === 4) {
          scale = scale.times(2.0);
        }
        this.objects.push(
          new Thing({
            id: i,
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
      new Thing({
        shape: this.shapes.cube, material: material, mass: -1.0,
        position: vec3(0.0, -offset[1], 0.0), scale: vec3(scale[0], thickness[1], scale[2]),
        // rotation: vec3(0.0, 0.0, Math.PI / 8),
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
        shape: this.shapes.cube, material: material, mass: -1.0,
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
        shape: this.shapes.cube, material: material, mass: -1.0,
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

  toggle_blender() {
    if (this.blender) {
      this.objects.pop();
      this.blender = false;
    } else {
      this.objects.push(new Thing({
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

    if (!this.pause) {
      collision(this.objects, this.objects_group, this.objects_group_search);  // collision detection and resolution
    }

    for (let i = 0; i < this.objects.length; ++i) {
      for (let j = 0; j < this.objects[i].length; ++j) {
        this.objects[i][j].draw_object({
          context: context, program_state: program_state,
          delta_time: delta_time, draw_bounding: this.bounding
        });
      }
    }
  }
}