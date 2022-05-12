import {defs, tiny} from '../classes/common.js';

const {  // load common classes to the current scope
  Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene,
} = tiny;

export class Sandbox_Shader extends Scene {
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
        {ambient: 0.2, diffusivity: 0.5, specular: 0.5, color: hex_color("#99bbdd")}
      ),
      trace: new Material(new Ray_Tracer(),
        {ambient: 0.2, diffusivity: 0.5, specular: 0.5, color: hex_color("#99bbdd")}
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

    let identity_transform = Mat4.identity();
    let sphere_transform = identity_transform.times(Mat4.scale(3, 3, 3))
    this.shapes.sphere.draw(context, program_state, sphere_transform, this.materials.trace);

    if (time > 0.9 && time < 1.1) {
      console.log(this.shapes.sphere.arrays.position);
    }
  }
}


class Ray_Tracer extends Shader {
  // define number of lights in the scene, set to 1 for testing
  constructor(num_lights = 1) {
    super();
    this.num_lights = num_lights;
  }

  shared_glsl_code() {
    // ********* SHARED CODE, INCLUDED IN BOTH SHADERS *********
    return `
      precision mediump float;
      const int N_LIGHTS = ` + this.num_lights + `;
      uniform float ambient, diffusivity, specularity, smoothness;
      uniform vec4 light_positions_or_vectors[N_LIGHTS], light_colors[N_LIGHTS];
      uniform float light_attenuation_factors[N_LIGHTS];
      uniform vec4 shape_color;
      uniform vec3 squared_scale, camera_center;

      /* "varying" means a variable's final value will be passed from the vertex shader on to the next phase (fragment
         shader), then interpolated per-fragment, weighted by the pixel fragment's proximity to each of the 3 vertices
         (barycentric interpolation). */
      varying vec3 vertex_worldspace;
    `;
  }

  vertex_glsl_code() {
    // ********* VERTEX SHADER *********
    return this.shared_glsl_code() + `
      attribute vec3 position;  // position expressed in object coordinates
      
      uniform mat4 model_transform;
      uniform mat4 projection_camera_model_transform;

      void main() {  
          // the vertex's final resting place (in normalized device coordinate space)
          gl_Position = projection_camera_model_transform * vec4( position, 1.0 );
      }
    `;
  }

  fragment_glsl_code() {
    // ********* FRAGMENT SHADER ********* (where everything happens)
    // a fragment a pixel that's overlapped by the current triangle
    return this.shared_glsl_code() + `
      struct triangle {  // struct for a triangle
        vec3 vertex_0;
        vec3 vertex_1;
        vec3 vertex_2;
      };
      
      
      struct int_data {  // struct for intersection data
        int model_id;
        int triangle_id;
        float t;
      };
      
      
      void ray_intersects_triangle( vec3 ray_origin, vec3 ray_vector,
                                    triangle int_triangle, int_data intersection,
                                    int model_id, int triangle_id );
      
      
      int SAMPLES = 8;
      int RAY_PER_SAMPLE = 1;
    
      void main() {
        // compute an initial (ambient) color:
        gl_FragColor = vec4( shape_color.xyz * ambient, shape_color.w );
      }
      
      
      // we are using the Moller–Trumbore intersection algorithm
      // https://en.wikipedia.org/wiki/M%C3%B6ller%E2%80%93Trumbore_intersection_algorithm
      void ray_intersects_triangle( vec3 ray_origin, vec3 ray_vector,
                                    triangle int_triangle, int_data intersection,
                                    int model_id, int triangle_id ) {
        const float EPSILON = 0.1e-5;  // small tolerance
        vec3 vertex_0 = int_triangle.vertex_0;
        vec3 vertex_1 = int_triangle.vertex_1;
        vec3 vertex_2 = int_triangle.vertex_2;
        
        vec3 edge_1, edge_2, h, s, q;
        float a, f, u, v;
        
        edge_1 = vertex_1 - vertex_0;
        edge_2 = vertex_2 - vertex_0;
        h = cross(ray_vector, edge_2);
        a = dot(edge_1, h);
        
        if (a > EPSILON || a < -EPSILON)  {  // ray not parallel to triangle
          f = 1.0 / a;
          s = ray_vector - vertex_0;
          u = f * dot(s, h);
          if (u < 0.0 && u < 1.0) {
            q = cross(s, edge_1);
            v = f * dot(ray_vector, q);
            
            if (v > 0.0 && u + v < 1.0) {
              float t = f * dot(edge_2, q);
              
              if (t > EPSILON) {  // ray intersection
                intersection.t = t;
                intersection.triangle_id = triangle_id;
                intersection.model_id = model_id;
              }
            }
          }
        }
      }
    `;
  }

  send_material(gl, gpu, material) {
    // send the desired shape-wide material qualities to the graphics card, where they will tweak the
    // lighting formula
    gl.uniform4fv(gpu.shape_color, material.color);
    gl.uniform1f(gpu.ambient, material.ambient);
    gl.uniform1f(gpu.diffusivity, material.diffusivity);
    gl.uniform1f(gpu.specularity, material.specularity);
    gl.uniform1f(gpu.smoothness, material.smoothness);
  }

  send_gpu_state(gl, gpu, gpu_state, model_transform) {
    // send_gpu_state():  Send the state of our whole drawing context to the GPU.
    const O = vec4(0, 0, 0, 1), camera_center = gpu_state.camera_transform.times(O).to3();
    gl.uniform3fv(gpu.camera_center, camera_center);
    // Use the squared scale trick from "Eric's blog" instead of inverse transpose matrix:
    const squared_scale = model_transform.reduce(
      (acc, r) => {
        return acc.plus(vec4(...r).times_pairwise(r))
      }, vec4(0, 0, 0, 0)).to3();
    gl.uniform3fv(gpu.squared_scale, squared_scale);
    // Send the current matrices to the shader.  Go ahead and pre-compute
    // the products we'll need of the of the three special matrices and just
    // cache and send those.  They will be the same throughout this draw
    // call, and thus across each instance of the vertex shader.
    // Transpose them since the GPU expects matrices as column-major arrays.
    const PCM = gpu_state.projection_transform.times(gpu_state.camera_inverse).times(model_transform);
    gl.uniformMatrix4fv(gpu.model_transform, false, Matrix.flatten_2D_to_1D(model_transform.transposed()));
    gl.uniformMatrix4fv(gpu.projection_camera_model_transform, false, Matrix.flatten_2D_to_1D(PCM.transposed()));

    // Omitting lights will show only the material color, scaled by the ambient term:
    if (!gpu_state.lights.length)
      return;

    const light_positions_flattened = [], light_colors_flattened = [];
    for (let i = 0; i < 4 * gpu_state.lights.length; i++) {
      light_positions_flattened.push(gpu_state.lights[Math.floor(i / 4)].position[i % 4]);
      light_colors_flattened.push(gpu_state.lights[Math.floor(i / 4)].color[i % 4]);
    }
    gl.uniform4fv(gpu.light_positions_or_vectors, light_positions_flattened);
    gl.uniform4fv(gpu.light_colors, light_colors_flattened);
    gl.uniform1fv(gpu.light_attenuation_factors, gpu_state.lights.map(l => l.attenuation));
  }

  update_GPU(context, gpu_addresses, gpu_state, model_transform, material) {
    // update_GPU(): define how to synchronize our JavaScript's variables to the GPU's.  This is where the shader
    // recieves ALL of its inputs.  Every value the GPU wants is divided into two categories:  Values that belong
    // to individual objects being drawn (which we call "Material") and values belonging to the whole scene or
    // program (which we call the "Program_State").  Send both a material and a program state to the shaders
    // within this function, one data field at a time, to fully initialize the shader for a draw.

    // Fill in any missing fields in the Material object with custom defaults for this shader:
    const defaults = {color: color(0, 0, 0, 1), ambient: 0, diffusivity: 1, specularity: 1, smoothness: 40};
    material = Object.assign({}, defaults, material);

    this.send_material(context, gpu_addresses, material);
    this.send_gpu_state(context, gpu_addresses, gpu_state, model_transform);
  }
}